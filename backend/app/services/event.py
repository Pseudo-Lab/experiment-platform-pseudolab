import json
from datetime import datetime, timezone
from app.schemas.event import EventCapture, EventBatch, ExperimentEvent, PersonIdentify
from app.db import d1


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class EventService:

    async def capture(self, data: EventCapture, project_id: str | None = None) -> bool:
        rows = await d1.query(
            "SELECT cohort_id FROM person WHERE user_id = ?", [data.user_id]
        )
        cohort_id = rows[0]["cohort_id"] if rows else None

        event_time = data.timestamp.isoformat() if data.timestamp else _now()
        properties = json.dumps(data.properties) if data.properties else None

        return await d1.execute(
            """INSERT OR IGNORE INTO event_log
               (event_id, user_id, cohort_id, event_name, properties,
                session_id, experiment_id, variant, device, anon_id,
                event_time, created_at, project_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            [
                data.event_id, data.user_id, cohort_id, data.event_name, properties,
                data.session_id, data.experiment_id, data.variant, data.device, data.anon_id,
                event_time, _now(), project_id,
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

    async def track_experiment_event(self, data: ExperimentEvent) -> bool:
        now = _now()
        properties = json.dumps(data.properties) if data.properties else None
        return await d1.execute(
            """INSERT INTO experiment_event
               (event_type, experiment_key, experiment_id, variant, url, user_id, properties, event_time, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            [data.type, data.key, data.experiment_id, data.variant,
             data.url, data.user_id, properties, now, now],
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
