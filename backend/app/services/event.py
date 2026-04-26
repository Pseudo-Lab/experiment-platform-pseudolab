import json
from datetime import datetime, timezone
from app.schemas.event import EventCapture, PersonIdentify
from app.db import d1


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class EventService:

    async def capture(self, data: EventCapture) -> bool:
        rows = await d1.query(
            "SELECT cohort_id FROM person WHERE user_id = ?", [data.user_id]
        )
        cohort_id = rows[0]["cohort_id"] if rows else None

        event_time = data.timestamp.isoformat() if data.timestamp else _now()
        properties = json.dumps(data.properties) if data.properties else None

        return await d1.execute(
            """INSERT INTO event_log (user_id, cohort_id, event_name, properties, event_time, created_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            [data.user_id, cohort_id, data.event_name, properties, event_time, _now()],
        )

    async def identify(self, data: PersonIdentify) -> bool:
        now = _now()
        return await d1.execute(
            """INSERT INTO person (user_id, cohort_id, cohort_name, team_name, role, updated_at)
               VALUES (?, ?, ?, ?, ?, ?)
               ON CONFLICT(user_id) DO UPDATE SET
                 cohort_id   = excluded.cohort_id,
                 cohort_name = excluded.cohort_name,
                 team_name   = excluded.team_name,
                 role        = excluded.role,
                 updated_at  = excluded.updated_at""",
            [data.user_id, data.cohort_id, data.cohort_name, data.team_name, data.role, now],
        )


event_service = EventService()
