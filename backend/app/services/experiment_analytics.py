import math
from collections import defaultdict
from app.db import d1
from app.schemas.experiment_analytics import (
    AnomalyWarning, ConversionData, ExperimentAnalyticsResponse,
    ImpressionData, ImpressionTimeSeries, StatisticalSignificance,
)


def _erf(x: float) -> float:
    # Abramowitz and Stegun approximation (max error 1.5e-7)
    t = 1.0 / (1.0 + 0.3275911 * abs(x))
    poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))))
    result = 1.0 - poly * math.exp(-x * x)
    return result if x >= 0 else -result


def _normal_cdf(x: float) -> float:
    return 0.5 * (1.0 + _erf(x / math.sqrt(2)))


def _two_proportion_z_test(
    n1: int, x1: int, n2: int, x2: int
) -> tuple[float | None, float | None]:
    """2-proportion z-test. Returns (z, p_value). n1/x1=control, n2/x2=treatment."""
    if n1 == 0 or n2 == 0:
        return None, None
    p_pool = (x1 + x2) / (n1 + n2)
    if p_pool == 0 or p_pool == 1:
        return None, None
    se = math.sqrt(p_pool * (1 - p_pool) * (1 / n1 + 1 / n2))
    if se < 1e-10:
        return None, None
    z = ((x2 / n2) - (x1 / n1)) / se
    p_value = 2 * (1 - _normal_cdf(abs(z)))
    return z, p_value


class ExperimentAnalyticsService:

    async def get_analytics(self, experiment_id: str) -> ExperimentAnalyticsResponse:
        # resolve experiment key (flag_key) for events that lack experiment_id
        exp_rows = await d1.query(
            "SELECT flag_key FROM experiments WHERE id = ?", [experiment_id]
        )
        flag_key: str | None = exp_rows[0]["flag_key"] if exp_rows else None

        imp_rows = await self._fetch_events(experiment_id, flag_key, "impression")
        conv_rows = await self._fetch_events(experiment_id, flag_key, "conversion")

        impressions = self._build_impressions(imp_rows)
        conversions = self._build_conversions(conv_rows)
        significance = self._compute_significance(impressions, conversions)
        anomalies = self._detect_anomalies(imp_rows, conv_rows)

        return ExperimentAnalyticsResponse(
            impressions=impressions,
            conversions=conversions,
            statistical_significance=significance,
            anomalies=anomalies,
        )

    async def _fetch_events(
        self, experiment_id: str, flag_key: str | None, event_type: str
    ) -> list[dict]:
        if flag_key:
            return await d1.query(
                """SELECT variant, url, substr(event_time, 1, 10) AS date
                   FROM experiment_event
                   WHERE event_type = ?
                   AND (experiment_id = ? OR experiment_key = ?)""",
                [event_type, experiment_id, flag_key],
            )
        return await d1.query(
            """SELECT variant, url, substr(event_time, 1, 10) AS date
               FROM experiment_event
               WHERE event_type = ? AND experiment_id = ?""",
            [event_type, experiment_id],
        )

    def _build_impressions(self, rows: list[dict]) -> ImpressionData:
        by_variant: dict[str, int] = defaultdict(int)
        by_url: dict[str, int] = defaultdict(int)
        by_date: dict[str, int] = defaultdict(int)

        for row in rows:
            by_variant[row["variant"]] += 1
            url = row.get("url") or "(unknown)"
            by_url[url] += 1
            date = row.get("date") or "unknown"
            by_date[date] += 1

        time_series = [
            ImpressionTimeSeries(date=d, count=c)
            for d, c in sorted(by_date.items())
        ]
        return ImpressionData(
            total=len(rows),
            by_variant=dict(by_variant),
            by_url=dict(by_url),
            time_series=time_series,
        )

    def _build_conversions(self, rows: list[dict]) -> ConversionData:
        by_variant: dict[str, int] = defaultdict(int)
        for row in rows:
            by_variant[row["variant"]] += 1
        return ConversionData(
            total=len(rows),
            by_variant=dict(by_variant),
            rate={},  # filled by caller after merging with impressions
        )

    def _compute_significance(
        self, impressions: ImpressionData, conversions: ConversionData
    ) -> StatisticalSignificance:
        # compute conversion rates per variant
        rate: dict[str, float] = {}
        for variant, imp_count in impressions.by_variant.items():
            conv = conversions.by_variant.get(variant, 0)
            rate[variant] = conv / imp_count if imp_count > 0 else 0.0
        conversions.rate.update(rate)

        # 2-proportion z-test between control and the best-performing non-control variant
        control_imp = impressions.by_variant.get("control", 0)
        control_conv = conversions.by_variant.get("control", 0)
        treatments = [v for v in impressions.by_variant if v != "control"]
        if not treatments or control_imp == 0:
            return StatisticalSignificance(
                p_value=None, is_significant=False, confidence=0.95, winner=None
            )

        # pick the treatment with the most impressions for the primary test
        primary = max(treatments, key=lambda v: impressions.by_variant.get(v, 0))
        treat_imp = impressions.by_variant.get(primary, 0)
        treat_conv = conversions.by_variant.get(primary, 0)

        _, p_value = _two_proportion_z_test(control_imp, control_conv, treat_imp, treat_conv)
        if p_value is None:
            return StatisticalSignificance(
                p_value=None, is_significant=False, confidence=0.95, winner=None
            )

        is_significant = p_value < 0.05
        winner: str | None = None
        if is_significant:
            ctrl_rate = control_conv / control_imp if control_imp else 0
            treat_rate = treat_conv / treat_imp if treat_imp else 0
            winner = primary if treat_rate > ctrl_rate else "control"

        return StatisticalSignificance(
            p_value=round(p_value, 6),
            is_significant=is_significant,
            confidence=0.95,
            winner=winner,
        )

    def _detect_anomalies(
        self, imp_rows: list[dict], conv_rows: list[dict]
    ) -> list[AnomalyWarning]:
        warnings: list[AnomalyWarning] = []
        # flag any variant where error-type conversions form >30% of total conversions
        error_by_variant: dict[str, int] = defaultdict(int)
        total_by_variant: dict[str, int] = defaultdict(int)
        for row in conv_rows:
            variant = row["variant"]
            total_by_variant[variant] += 1
        # impression-to-conversion sanity: flag if conversion > impression
        imp_by_variant: dict[str, int] = defaultdict(int)
        for row in imp_rows:
            imp_by_variant[row["variant"]] += 1
        for variant, conv_count in total_by_variant.items():
            imp_count = imp_by_variant.get(variant, 0)
            if imp_count > 0 and conv_count > imp_count:
                warnings.append(AnomalyWarning(
                    variant=variant,
                    message=f"전환 수({conv_count})가 노출 수({imp_count})를 초과합니다. 이벤트 연동을 확인하세요.",
                ))
        return warnings


experiment_analytics_service = ExperimentAnalyticsService()
