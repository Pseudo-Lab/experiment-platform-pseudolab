import json
from datetime import datetime
from typing import List, Optional
from app.schemas.analytics import (
    EventLogItem, EventListResponse,
    TrendPoint, TrendsResponse,
    FunnelStep, FunnelResponse,
    RetentionCell, RetentionResponse,
)
from app.db import d1


def _parse_properties(raw) -> Optional[dict]:
    if raw is None:
        return None
    if isinstance(raw, dict):
        return raw
    try:
        return json.loads(raw)
    except Exception:
        return None


class AnalyticsService:

    async def get_events(
        self,
        event_name: Optional[str],
        from_dt: Optional[datetime],
        to_dt: Optional[datetime],
        page: int,
        limit: int,
    ) -> EventListResponse:
        conditions = []
        params: list = []

        if event_name:
            conditions.append("event_name = ?")
            params.append(event_name)
        if from_dt:
            conditions.append("event_time >= ?")
            params.append(from_dt.isoformat())
        if to_dt:
            conditions.append("event_time <= ?")
            params.append(to_dt.isoformat())

        where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
        offset = (page - 1) * limit

        count_rows = await d1.query(f"SELECT COUNT(*) as cnt FROM event_log {where}", params)
        total = int(count_rows[0]["cnt"]) if count_rows else 0

        rows = await d1.query(
            f"SELECT * FROM event_log {where} ORDER BY event_time DESC LIMIT ? OFFSET ?",
            params + [limit, offset],
        )
        items = [
            EventLogItem(
                id=r["id"],
                user_id=r["user_id"],
                cohort_id=r.get("cohort_id"),
                event_name=r["event_name"],
                properties=_parse_properties(r.get("properties")),
                event_time=r["event_time"],
                created_at=r["created_at"],
            )
            for r in rows
        ]
        return EventListResponse(total=total, page=page, limit=limit, items=items)

    async def get_event_names(self) -> List[str]:
        rows = await d1.query("SELECT DISTINCT event_name FROM event_log ORDER BY event_name")
        return [r["event_name"] for r in rows]

    async def get_trends(
        self,
        event_name: str,
        from_dt: datetime,
        to_dt: datetime,
        granularity: str,
    ) -> TrendsResponse:
        if granularity == "week":
            date_expr = "strftime('%Y-%W', event_time)"
        else:
            date_expr = "DATE(event_time)"

        rows = await d1.query(
            f"""SELECT {date_expr} as date, COUNT(*) as count
                FROM event_log
                WHERE event_name = ? AND event_time BETWEEN ? AND ?
                GROUP BY {date_expr}
                ORDER BY date""",
            [event_name, from_dt.isoformat(), to_dt.isoformat()],
        )
        data = [TrendPoint(date=r["date"], count=int(r["count"])) for r in rows]
        return TrendsResponse(event_name=event_name, granularity=granularity, data=data)

    async def get_funnels(
        self,
        steps: List[str],
        from_dt: Optional[datetime],
        to_dt: Optional[datetime],
    ) -> FunnelResponse:
        time_conditions = []
        time_params: list = []
        if from_dt:
            time_conditions.append("event_time >= ?")
            time_params.append(from_dt.isoformat())
        if to_dt:
            time_conditions.append("event_time <= ?")
            time_params.append(to_dt.isoformat())
        time_where = (" AND " + " AND ".join(time_conditions)) if time_conditions else ""

        prev_users: Optional[set] = None
        result: List[FunnelStep] = []

        for step in steps:
            rows = await d1.query(
                f"SELECT DISTINCT user_id FROM event_log WHERE event_name = ?{time_where}",
                [step] + time_params,
            )
            step_users = {r["user_id"] for r in rows}

            if prev_users is not None:
                step_users = step_users & prev_users

            count = len(step_users)
            rate = (count / len(prev_users)) if prev_users else None
            result.append(FunnelStep(step=step, users=count, conversion_rate=rate))
            prev_users = step_users

        return FunnelResponse(steps=result)

    async def get_retention(self, event_name: str) -> RetentionResponse:
        rows = await d1.query(
            """SELECT
                 strftime('%Y-%W', first_seen.first_time) as cohort_week,
                 CAST((JULIANDAY(el.event_time) - JULIANDAY(first_seen.first_time)) / 7 AS INTEGER) as week_num,
                 COUNT(DISTINCT el.user_id) as retained,
                 COUNT(DISTINCT first_seen.user_id) as cohort_size
               FROM event_log el
               JOIN (
                 SELECT user_id, MIN(event_time) as first_time
                 FROM event_log WHERE event_name = ?
                 GROUP BY user_id
               ) first_seen ON el.user_id = first_seen.user_id
               WHERE el.event_name = ?
               GROUP BY cohort_week, week_num
               ORDER BY cohort_week, week_num""",
            [event_name, event_name],
        )
        data = [
            RetentionCell(
                cohort_week=r["cohort_week"],
                week_num=int(r["week_num"]),
                retained=int(r["retained"]),
                cohort_size=int(r["cohort_size"]),
                retention_rate=round(int(r["retained"]) / int(r["cohort_size"]), 4) if int(r["cohort_size"]) > 0 else 0.0,
            )
            for r in rows
        ]
        return RetentionResponse(event_name=event_name, data=data)


analytics_service = AnalyticsService()
