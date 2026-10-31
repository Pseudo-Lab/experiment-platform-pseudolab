"""Canonical SDK v1 rows shared by result and live analytics; legacy stores stay separate."""
from app.db import d1


async def read_sdk_events(experiment_id: str, project_id: str | None) -> list[dict]:
    # Actions are attributable only to an earlier exposure of the same visible instance.
    # Keep raw rejected/unmatched actions in event_log for diagnostics, not the readout.
    return await d1.query(
        """SELECT e.user_id, e.variant, e.event_name, e.event_time,
                  json_extract(e.properties, '$.impression_id') AS impression_id,
                  json_extract(e.properties, '$.sdk_event_type') AS sdk_event_type,
                  json_extract(e.properties, '$.url') AS url,
                  substr(e.event_time, 1, 10) AS date,
                  CASE WHEN json_extract(e.properties, '$.sdk_event_type') = 'exposure'
                    OR EXISTS (
                      SELECT 1 FROM event_log x
                      WHERE x.project_id IS e.project_id AND x.experiment_id = e.experiment_id
                        AND x.user_id = e.user_id AND x.variant = e.variant
                        AND x.session_id = e.session_id AND x.event_time <= e.event_time
                        AND json_extract(x.properties, '$.event_model') = 'sdk_v1'
                        AND json_extract(x.properties, '$.sdk_event_type') = 'exposure'
                        AND json_extract(x.properties, '$.impression_id') = json_extract(e.properties, '$.impression_id')
                        AND json_extract(x.properties, '$.assignment_id') = json_extract(e.properties, '$.assignment_id')
                    ) THEN 1 ELSE 0 END AS attributed
             FROM event_log e
             WHERE e.experiment_id = ? AND e.project_id IS ?
               AND json_extract(e.properties, '$.event_model') = 'sdk_v1'""",
        [experiment_id, project_id],
    )
