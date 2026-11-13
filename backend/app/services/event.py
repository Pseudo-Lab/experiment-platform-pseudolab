import json
from datetime import datetime, timezone, timedelta
from uuid import NAMESPACE_URL, uuid5
from fastapi import HTTPException
from app.schemas.event import EventCapture, EventBatch, ExperimentEvent, PersonIdentify
from app.db import d1


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class EventService:

    async def capture(self, data: EventCapture, project_id: str | None = None) -> bool:
        if data.tracking_context:
            context = data.tracking_context
            if context.project_id != project_id:
                raise HTTPException(status_code=403, detail="Matching project SDK key required")
            flags = await d1.query("SELECT project_id FROM feature_flag WHERE flag_key = ?", [context.key])
            if not flags or flags[0]["project_id"] != project_id:
                raise HTTPException(status_code=403, detail="Flag does not belong to SDK project")
            if context.experiment_id:
                experiments = await d1.query(
                    """SELECT id FROM experiments WHERE id = ? AND flag_key = ?
                       AND project_id IS ? AND experiment_type = 'ab_test' AND event_model = 'sdk_v1'""",
                    [context.experiment_id, context.key, project_id],
                )
                if not experiments:
                    raise HTTPException(status_code=403, detail="Invalid experiment attribution")
            expected = str(uuid5(NAMESPACE_URL, json.dumps([
                project_id, context.experiment_id, context.key, context.user_id, context.variant,
            ])))
            if context.assignment_id != expected:
                raise HTTPException(status_code=422, detail="Invalid assignment identity")
            sdk_properties = {**(data.properties or {}), **context.model_dump(),
                              "event_model": "sdk_v1", "sdk_event_type": data.sdk_event_type}
            # Eligibility is collector-owned, never a claim from the public SDK.
            sdk_properties.pop("sdk_exposure_eligible", None)
            sdk_properties.pop("sdk_active_period_eligible", None)
            sdk_properties.pop("sdk_bounded_eligible", None)
            data = data.model_copy(update={
                "event_id": "sdk_v1:" + json.dumps([project_id, data.user_id, data.event_id]),
                "properties": sdk_properties,
            })
        elif data.properties and data.properties.get("event_model") == "sdk_v1":
            raise HTTPException(status_code=422, detail="tracking_context required for sdk_v1")
        owned = project_id and await d1.security_query("SELECT 1 FROM project_owner WHERE project_id = ?", [project_id])
        rows = [] if owned else await d1.query(
            "SELECT cohort_id FROM person WHERE user_id = ?", [data.user_id]
        )
        cohort_id = rows[0]["cohort_id"] if rows else None

        received_at = _now()
        event_time = data.timestamp.isoformat() if data.timestamp else received_at
        if data.tracking_context and data.timestamp:
            event_time = data.timestamp.replace(tzinfo=data.timestamp.tzinfo or timezone.utc).astimezone(timezone.utc).isoformat()
        properties = json.dumps(data.properties) if data.properties else None
        properties_sql = "?"
        properties_params = [properties]
        history_sql = ""
        history_params = []
        if (data.tracking_context and data.experiment_id
                and data.sdk_event_type == "exposure"):
            # Observe status in the write statement, not an earlier HTTP/DB check.
            # Keep raw receipt; only the first insert fixes readout eligibility.
            properties_sql = """json_set(?, '$.sdk_exposure_eligible', EXISTS (
                SELECT 1 FROM experiments WHERE id = ? AND project_id IS ?
                  AND flag_key = ? AND experiment_type = 'ab_test'
                  AND event_model = 'sdk_v1' AND status = 'running'
            ))"""
            properties_params.extend([data.experiment_id, project_id, data.tracking_context.key])

        if data.tracking_context and data.experiment_id:
            # One write snapshot: a stop between validation and INSERT must be visible.
            # 041 records UTC milliseconds; pad to microseconds for exact half-open
            # boundaries rather than rounding the event through SQLite julianday().
            occurred = datetime.fromisoformat(event_time).astimezone(timezone.utc).isoformat(timespec="microseconds")
            received = datetime.fromisoformat(received_at).astimezone(timezone.utc).isoformat(timespec="microseconds")
            history_sql = """WITH history AS (
                SELECT id, from_status, to_status, recorded_at,
                       lag(recorded_at) OVER (ORDER BY id) AS previous_at,
                       lag(to_status) OVER (ORDER BY id) AS previous_status
                FROM experiment_status_history WHERE experiment_id = ?
            )"""
            history_params = [data.experiment_id]
            properties_sql = f"""json_set({properties_sql}, '$.sdk_active_period_eligible',
                CASE WHEN EXISTS (
                    SELECT 1 FROM experiment_readout_policy
                    WHERE experiment_id = ? AND version = 'active_period_v1'
                ) THEN (? <= ? AND NOT EXISTS (
                    SELECT 1 FROM history h
                    WHERE h.recorded_at IS NOT strftime('%Y-%m-%dT%H:%M:%fZ', h.recorded_at)
                       OR h.recorded_at < h.previous_at
                       OR h.from_status IS NOT h.previous_status
                ) AND EXISTS (
                    SELECT 1 FROM experiments e WHERE e.id = ?
                      AND e.project_id IS ? AND e.flag_key = ?
                      AND e.event_model = 'sdk_v1' AND e.experiment_type = 'ab_test'
                      AND (? OR e.status = 'running')
                      AND e.status = (SELECT to_status FROM history ORDER BY id DESC LIMIT 1)
                ) AND COALESCE((
                    SELECT h.to_status = 'running' FROM history h
                    WHERE substr(h.recorded_at, 1, 23) || '000+00:00' <= ?
                    ORDER BY h.id DESC LIMIT 1
                ), 0)) ELSE NULL END)"""
            properties_params.extend([
                data.experiment_id, occurred, received,
                data.experiment_id, project_id, data.tracking_context.key,
                int(data.timestamp is not None), occurred,
            ])

        if data.tracking_context and data.experiment_id:
            # Separate proof: an active-period rejection during a pause is distinct
            # from invalid history, future claims, or excessive transport lateness.
            earliest = (datetime.fromisoformat(received_at) - timedelta(seconds=86400)).isoformat(timespec="microseconds")
            properties_sql = f"""json_set({properties_sql}, '$.sdk_bounded_eligible',
                CASE WHEN EXISTS (SELECT 1 FROM experiment_readout_contract WHERE experiment_id=?)
                THEN (? <= ? AND ? <= ? AND NOT EXISTS (
                    SELECT 1 FROM experiment_readout_snapshot WHERE experiment_id=?
                ) AND NOT EXISTS (
                    SELECT 1 FROM history h
                    WHERE h.recorded_at IS NOT strftime('%Y-%m-%dT%H:%M:%fZ', h.recorded_at)
                       OR h.recorded_at < h.previous_at OR h.from_status IS NOT h.previous_status
                ) AND EXISTS (
                    SELECT 1 FROM experiments e JOIN experiment_readout_contract c ON c.experiment_id=e.id
                    WHERE e.id=? AND e.project_id IS ? AND e.flag_key=?
                      AND e.event_model='sdk_v1' AND e.experiment_type='ab_test' AND c.locked_json IS NOT NULL
                      AND e.status=(SELECT to_status FROM history ORDER BY id DESC LIMIT 1)
                )) ELSE NULL END)"""
            properties_params.extend([data.experiment_id, earliest, occurred, occurred, received,
                                      data.experiment_id, data.experiment_id, project_id, data.tracking_context.key])

        event_time_sql = receipt_sql = "?"
        event_time_params, receipt_params = [event_time], [received_at]
        if data.tracking_context and data.experiment_id:
            # Fixed precision belongs only to bounded_v1. Preserve old stored-text
            # comparisons when a historical cohort receives new events.
            event_time_sql = receipt_sql = """CASE WHEN EXISTS (
                SELECT 1 FROM experiment_readout_contract WHERE experiment_id=?
            ) THEN ? ELSE ? END"""
            event_time_params = [data.experiment_id, occurred, event_time]
            receipt_params = [data.experiment_id, received, received_at]

        return await d1.execute(
            f"""{history_sql} INSERT OR IGNORE INTO event_log
               (event_id, user_id, cohort_id, event_name, properties,
                session_id, experiment_id, variant, device, anon_id,
                event_time, created_at, project_id)
               VALUES (?, ?, ?, ?, {properties_sql}, ?, ?, ?, ?, ?, {event_time_sql}, {receipt_sql}, ?)""",
            [
                *history_params,
                (f"{project_id}:{data.event_id}" if owned and data.event_id and not data.tracking_context else data.event_id), data.user_id, cohort_id, data.event_name, *properties_params,
                data.session_id, data.experiment_id, data.variant, data.device, data.anon_id,
                *event_time_params, *receipt_params, project_id,
            ],
        )

    async def capture_batch(self, batch: EventBatch, project_id: str | None = None) -> int:
        """배치 이벤트 수집. 성공한 건수를 반환. event_id 기반 멱등 적재."""
        succeeded = 0
        for event in batch.events:
            ok = await self.capture(event, project_id=project_id)
            if ok:
                succeeded += 1
        return succeeded

    async def track_experiment_event(self, data: ExperimentEvent, project_id: str | None = None) -> bool:
        now = _now()
        event_time = data.timestamp.isoformat() if data.timestamp else now
        properties = json.dumps(data.properties) if data.properties else None
        if project_id:
            return await d1.execute(
                """INSERT INTO project_experiment_event
                   (project_id, event_type, experiment_key, experiment_id, variant, url, user_id, properties, event_time, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                [project_id, data.type, data.key, data.experiment_id, data.variant,
                 data.url, data.user_id, properties, event_time, now],
            )
        return await d1.execute(
            """INSERT INTO experiment_event
               (event_type, experiment_key, experiment_id, variant, url, user_id, properties, event_time, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            [data.type, data.key, data.experiment_id, data.variant,
             data.url, data.user_id, properties, event_time, now],
        )

    async def identify(self, data: PersonIdentify) -> bool:
        now = _now()
        traits_json = json.dumps(data.traits, ensure_ascii=False) if data.traits else None
        return await d1.execute(
            """INSERT INTO person (user_id, cohort_id, cohort_name, team_name, role, properties_json, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(user_id) DO UPDATE SET
                 cohort_id       = excluded.cohort_id,
                 cohort_name     = excluded.cohort_name,
                 team_name       = excluded.team_name,
                 role            = excluded.role,
                 properties_json = excluded.properties_json,
                 updated_at      = excluded.updated_at""",
            [data.user_id, data.cohort_id, data.cohort_name, data.team_name, data.role, traits_json, now],
        )


event_service = EventService()
