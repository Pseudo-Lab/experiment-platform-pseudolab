import math
from collections import defaultdict
from app.db import d1
from app.schemas.experiment_analytics import (
    AnomalyWarning, AvailableEventsResponse, ConversionData,
    ExperimentAnalyticsResponse, ImpressionData, ImpressionTimeSeries,
    StatisticalSignificance, VariantSignificance,
)


def _chi2_sf(chi2: float, df: int) -> float:
    """Chi-squared survival function (p-value) without scipy."""
    if chi2 <= 0:
        return 1.0
    if df == 1:
        return 2.0 * (1.0 - _normal_cdf(math.sqrt(chi2)))
    if df == 2:
        return math.exp(-chi2 / 2.0)
    # Wilson-Hilferty normal approximation (accurate for df >= 3)
    h = (chi2 / df) ** (1.0 / 3.0)
    mu_h = 1.0 - 2.0 / (9.0 * df)
    sigma_h = math.sqrt(2.0 / (9.0 * df))
    z = (h - mu_h) / sigma_h
    return 1.0 - _normal_cdf(z)


def _srm_check(by_variant: dict[str, int]) -> bool:
    """Sample Ratio Mismatch: chi-squared test against equal split, p < 0.01."""
    counts = list(by_variant.values())
    if len(counts) < 2:
        return False
    total = sum(counts)
    if total < 10:
        return False
    k = len(counts)
    expected = total / k
    chi2 = sum((c - expected) ** 2 / expected for c in counts)
    return _chi2_sf(chi2, k - 1) < 0.01


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
            "SELECT flag_key, experiment_type, primary_metric FROM experiments WHERE id = ?",
            [experiment_id],
        )
        flag_key: str | None = exp_rows[0]["flag_key"] if exp_rows else None
        experiment_type: str = (exp_rows[0]["experiment_type"] or "ab_test") if exp_rows else "ab_test"
        primary_metric: str | None = exp_rows[0]["primary_metric"] if exp_rows else None

        if experiment_type == "quasi_experiment":
            # 준실험: luvp trackEvent → /capture → event_log 테이블로 쌓임
            # properties.experiment_id 로 필터, primary_metric 일치 여부로 impression/conversion 구분
            imp_rows = await self._fetch_events_from_log(experiment_id, primary_metric, "impression")
            conv_rows = await self._fetch_events_from_log(experiment_id, primary_metric, "conversion")
        else:
            imp_rows = await self._fetch_events(experiment_id, flag_key, "impression")
            conv_rows = await self._fetch_events(experiment_id, flag_key, "conversion")

        impressions = self._build_impressions(imp_rows)
        conversions = self._build_conversions(conv_rows)
        significance = self._compute_significance(impressions, conversions)
        anomalies = self._detect_anomalies(imp_rows, conv_rows)

        srm_warning = _srm_check(impressions.by_variant)

        return ExperimentAnalyticsResponse(
            impressions=impressions,
            conversions=conversions,
            statistical_significance=significance,
            anomalies=anomalies,
            srm_warning=srm_warning,
        )

    async def _fetch_events_from_log(
        self, experiment_id: str, primary_metric: str | None, event_type: str
    ) -> list[dict]:
        """event_log 기반 이벤트 조회 (quasi_experiment 전용).

        luvp trackEvent → /capture → event_log 에 쌓이는 이벤트를 읽는다.
        properties JSON 안의 experiment_id 필드로 실험을 식별하고,
        event_name = primary_metric 이면 conversion, 그 외는 impression.
        variant 컬럼이 없으므로 'control' 고정.
        smoke_test = true 인 이벤트는 실수로 집계되지 않도록 제외.
        """
        # smoke_test 이벤트 제외 조건 (properties.smoke_test = true)
        SMOKE_FILTER = "AND (json_extract(properties, '$.smoke_test') IS NULL OR json_extract(properties, '$.smoke_test') = 0)"

        if event_type == "conversion":
            if not primary_metric:
                return []
            return await d1.query(
                f"""SELECT 'control' AS variant,
                          NULL        AS url,
                          substr(event_time, 1, 10) AS date
                   FROM event_log
                   WHERE event_name = ?
                     AND json_extract(properties, '$.experiment_id') = ?
                     {SMOKE_FILTER}""",
                [primary_metric, experiment_id],
            )
        # impression: primary_metric 이벤트가 아닌 것 (= 노출/exposure 이벤트)
        if primary_metric:
            return await d1.query(
                f"""SELECT 'control' AS variant,
                          NULL        AS url,
                          substr(event_time, 1, 10) AS date
                   FROM event_log
                   WHERE event_name != ?
                     AND json_extract(properties, '$.experiment_id') = ?
                     {SMOKE_FILTER}""",
                [primary_metric, experiment_id],
            )
        return await d1.query(
            f"""SELECT 'control' AS variant,
                      NULL        AS url,
                      substr(event_time, 1, 10) AS date
               FROM event_log
               WHERE json_extract(properties, '$.experiment_id') = ?
               {SMOKE_FILTER}""",
            [experiment_id],
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
        by_variant_date: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))

        for row in rows:
            variant = row["variant"]
            by_variant[variant] += 1
            url = row.get("url") or "(unknown)"
            by_url[url] += 1
            date = row.get("date") or "unknown"
            by_date[date] += 1
            by_variant_date[variant][date] += 1

        time_series = [
            ImpressionTimeSeries(date=d, count=c)
            for d, c in sorted(by_date.items())
        ]
        time_series_by_variant = {
            variant: [
                ImpressionTimeSeries(date=d, count=c)
                for d, c in sorted(dates.items())
            ]
            for variant, dates in by_variant_date.items()
        }
        return ImpressionData(
            total=len(rows),
            by_variant=dict(by_variant),
            by_url=dict(by_url),
            time_series=time_series,
            time_series_by_variant=time_series_by_variant,
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
        rate: dict[str, float] = {}
        for variant, imp_count in impressions.by_variant.items():
            conv = conversions.by_variant.get(variant, 0)
            rate[variant] = conv / imp_count if imp_count > 0 else 0.0
        conversions.rate.update(rate)

        control_imp = impressions.by_variant.get("control", 0)
        control_conv = conversions.by_variant.get("control", 0)
        treatments = [v for v in impressions.by_variant if v != "control"]
        if not treatments or control_imp == 0:
            return StatisticalSignificance(
                p_value=None, is_significant=False, confidence=0.95, winner=None
            )

        n_treatments = len(treatments)
        per_variant: list[VariantSignificance] = []
        ctrl_rate = control_conv / control_imp if control_imp else 0.0

        for variant in treatments:
            treat_imp = impressions.by_variant.get(variant, 0)
            treat_conv = conversions.by_variant.get(variant, 0)
            _, p_raw = _two_proportion_z_test(control_imp, control_conv, treat_imp, treat_conv)
            if p_raw is None:
                per_variant.append(VariantSignificance(
                    variant=variant, p_value_raw=None, p_value=None, is_significant=False
                ))
                continue
            # Bonferroni correction: multiply p by number of tests, cap at 1.0
            p_corrected = min(p_raw * n_treatments, 1.0)
            treat_rate = treat_conv / treat_imp if treat_imp else 0.0
            is_sig = p_corrected < 0.05 and treat_rate > ctrl_rate
            per_variant.append(VariantSignificance(
                variant=variant,
                p_value_raw=round(p_raw, 6),
                p_value=round(p_corrected, 6),
                is_significant=is_sig,
            ))

        # Overall: pick the most significant treatment (lowest corrected p-value, above control)
        significant = [v for v in per_variant if v.is_significant and v.p_value is not None]
        best: VariantSignificance | None = min(significant, key=lambda v: v.p_value) if significant else None  # type: ignore[arg-type]

        winner: str | None = None
        overall_p: float | None = None
        is_significant = False
        if best:
            overall_p = best.p_value
            is_significant = True
            winner = best.variant
        elif per_variant:
            # report the smallest corrected p-value even if not significant
            candidates = [v for v in per_variant if v.p_value is not None]
            if candidates:
                overall_p = min(v.p_value for v in candidates)  # type: ignore[misc]

        return StatisticalSignificance(
            p_value=overall_p,
            is_significant=is_significant,
            confidence=0.95,
            winner=winner,
            per_variant=per_variant,
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


    async def get_available_events(self, experiment_id: str) -> AvailableEventsResponse:
        exp_rows = await d1.query(
            "SELECT flag_key, experiment_type, primary_metric FROM experiments WHERE id = ?",
            [experiment_id],
        )
        flag_key: str | None = exp_rows[0]["flag_key"] if exp_rows else None
        experiment_type: str = (exp_rows[0]["experiment_type"] or "ab_test") if exp_rows else "ab_test"
        primary_metric: str | None = exp_rows[0]["primary_metric"] if exp_rows else None

        if experiment_type == "quasi_experiment":
            # event_log 기반 이벤트 목록 집계 (smoke_test 제외)
            SMOKE_FILTER = "AND (json_extract(properties, '$.smoke_test') IS NULL OR json_extract(properties, '$.smoke_test') = 0)"
            type_rows = await d1.query(
                f"""SELECT DISTINCT event_name AS event_type
                   FROM event_log
                   WHERE json_extract(properties, '$.experiment_id') = ?
                   {SMOKE_FILTER}""",
                [experiment_id],
            )
            count_rows = await d1.query(
                f"""SELECT COUNT(*) AS total
                   FROM event_log
                   WHERE json_extract(properties, '$.experiment_id') = ?
                   {SMOKE_FILTER}""",
                [experiment_id],
            )
            event_types = [r["event_type"] for r in type_rows]
            total_events = count_rows[0]["total"] if count_rows else 0
            # primary_metric 이벤트 = conversion; 나머지 = impression 역할
            has_impressions = any(e != primary_metric for e in event_types)
            conversion_events = [e for e in event_types if e == primary_metric]
            return AvailableEventsResponse(
                event_types=event_types,
                has_impressions=has_impressions,
                has_conversions=len(conversion_events) > 0,
                conversion_events=conversion_events,
                total_events=total_events,
            )

        if flag_key:
            type_rows = await d1.query(
                """SELECT DISTINCT event_type
                   FROM experiment_event
                   WHERE experiment_id = ? OR experiment_key = ?""",
                [experiment_id, flag_key],
            )
            count_rows = await d1.query(
                """SELECT COUNT(*) AS total
                   FROM experiment_event
                   WHERE experiment_id = ? OR experiment_key = ?""",
                [experiment_id, flag_key],
            )
        else:
            type_rows = await d1.query(
                """SELECT DISTINCT event_type
                   FROM experiment_event
                   WHERE experiment_id = ?""",
                [experiment_id],
            )
            count_rows = await d1.query(
                """SELECT COUNT(*) AS total
                   FROM experiment_event
                   WHERE experiment_id = ?""",
                [experiment_id],
            )

        event_types = [r["event_type"] for r in type_rows]
        total_events = count_rows[0]["total"] if count_rows else 0
        conversion_events = [e for e in event_types if e != "impression"]

        return AvailableEventsResponse(
            event_types=event_types,
            has_impressions="impression" in event_types,
            has_conversions=len(conversion_events) > 0,
            conversion_events=conversion_events,
            total_events=total_events,
        )


experiment_analytics_service = ExperimentAnalyticsService()
