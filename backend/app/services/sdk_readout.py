"""Prospective bounded readouts: one-statement immutable input snapshots.

Candidate rows freeze atomically with their metadata, without an experiment-wide
JSON aggregate. Storage failures never publish truncated or empty success.
"""
import json

from fastapi import HTTPException
from app.db import d1


# All new SDK timestamps are normalized to fixed UTC microseconds at collection.
# Parse only whole seconds with SQLite; never round the fractional event time.
def _micros(column: str) -> str:
    return f"(CAST(strftime('%s', substr({column},1,19)) AS INTEGER)*1000000 + CAST(substr({column},21,6) AS INTEGER))"


_CONTEXT = """WITH history AS (
    SELECT *, lag(recorded_at) OVER (ORDER BY id) AS previous_at,
        lag(to_status) OVER (ORDER BY id) AS previous_status
    FROM experiment_status_history WHERE experiment_id=?
), context AS (
    SELECT c.*, e.project_id, e.status, h.id AS terminal_history_id, h.recorded_at AS end_at,
        (EXISTS (SELECT 1 FROM history) AND
         e.status IS (SELECT to_status FROM history ORDER BY id DESC LIMIT 1) AND
         NOT EXISTS (SELECT 1 FROM history WHERE
            recorded_at IS NOT strftime('%Y-%m-%dT%H:%M:%fZ',recorded_at)
            OR recorded_at < previous_at OR from_status IS NOT previous_status
            OR (from_status IS NOT NULL AND NOT (
                (from_status='draft' AND to_status IN ('running','archived')) OR
                (from_status='running' AND to_status IN ('paused','completed','archived')) OR
                (from_status='paused' AND to_status IN ('running','completed','archived'))))
         )) AS history_valid,
        CASE WHEN h.id IS NOT NULL AND c.locked_json IS NOT NULL THEN
            strftime('%Y-%m-%dT%H:%M:%S', substr(h.recorded_at,1,19),
                '+' || (COALESCE(json_extract(c.locked_json,'$.conversion_window_seconds'),0)
                        + c.ingestion_grace_seconds) || ' seconds')
            || substr(h.recorded_at,20,4) || '000+00:00' END AS finalizes_at
    FROM experiment_readout_contract c JOIN experiments e ON e.id=c.experiment_id
    LEFT JOIN experiment_status_history h ON h.experiment_id=e.id
        AND h.id=(SELECT max(id) FROM experiment_status_history WHERE experiment_id=e.id)
        AND h.to_status=e.status AND h.to_status IN ('completed','archived')
    WHERE e.id=? AND e.project_id IS ?
)"""
_READ_CONTEXT = """, read_context AS (
    SELECT c.experiment_id,c.project_id,c.history_valid,
        COALESCE(s.contract_json,c.locked_json) AS locked_json,
        COALESCE(s.finalizes_at,c.finalizes_at) AS finalizes_at,
        s.result_json,s.input_sealed,s.experiment_id IS NOT NULL AS frozen
    FROM context c LEFT JOIN experiment_readout_snapshot s ON s.experiment_id=c.experiment_id
)"""
_ROWS = f""", candidates AS (
    SELECT e.id,e.experiment_id,e.project_id,e.user_id,e.variant,e.event_name,
        e.event_time,e.session_id,e.created_at,e.properties
    FROM event_log e JOIN read_context c ON c.experiment_id=e.experiment_id AND c.project_id IS e.project_id
    WHERE c.frozen=0
    UNION ALL
    SELECT e.id,e.experiment_id,e.project_id,e.user_id,e.variant,e.event_name,
        e.event_time,e.session_id,e.created_at,e.properties
    FROM experiment_readout_input e JOIN read_context c
        ON c.experiment_id=e.experiment_id AND c.project_id IS e.project_id
    WHERE c.frozen=1 AND c.input_sealed=1
), eligible AS (
    SELECT e.*, json_extract(e.properties,'$.sdk_event_type') AS sdk_event_type,
        json_extract(e.properties,'$.impression_id') AS impression_id,
        json_extract(e.properties,'$.assignment_id') AS assignment_id,
        json_extract(e.properties,'$.url') AS url,
        json_extract(c.locked_json,'$.conversion_window_seconds') AS window_seconds
    FROM candidates e JOIN read_context c ON c.experiment_id=e.experiment_id AND c.project_id IS e.project_id
    WHERE c.locked_json IS NOT NULL
        AND e.variant IN (SELECT value FROM json_each(c.locked_json,'$.variant_names'))
        AND json_extract(e.properties,'$.event_model')='sdk_v1'
        AND json_extract(e.properties,'$.sdk_bounded_eligible')=1
        AND (c.finalizes_at IS NULL OR e.created_at <= c.finalizes_at)
        AND (json_extract(e.properties,'$.sdk_event_type') <> 'exposure' OR
            (json_extract(e.properties,'$.sdk_active_period_eligible')=1
             AND json_extract(e.properties,'$.sdk_exposure_eligible')=1))
        AND (json_extract(c.locked_json,'$.conversion_window_seconds') IS NOT NULL
             OR json_extract(e.properties,'$.sdk_active_period_eligible')=1)
), first_exposure AS (
    SELECT user_id, MIN(event_time) AS first_at FROM eligible
    WHERE sdk_event_type='exposure' GROUP BY user_id
), canonical AS (
    SELECT e.id, e.user_id, e.variant, e.event_name, e.event_time, e.impression_id,
        e.sdk_event_type, e.url, substr(e.event_time,1,10) AS date,
        CASE WHEN e.sdk_event_type='exposure' OR EXISTS (
            SELECT 1 FROM eligible x WHERE x.user_id=e.user_id AND x.variant=e.variant
                AND x.session_id=e.session_id AND x.event_time<=e.event_time
                AND x.sdk_event_type='exposure' AND x.impression_id=e.impression_id
                AND x.assignment_id=e.assignment_id
        ) THEN 1 ELSE 0 END AS attributed
    FROM eligible e LEFT JOIN first_exposure f ON f.user_id=e.user_id
    WHERE e.sdk_event_type='exposure' OR e.window_seconds IS NULL OR
        ({_micros('e.event_time')} >= {_micros('f.first_at')} AND
         {_micros('e.event_time')} < {_micros('f.first_at')} + e.window_seconds*1000000)
    ORDER BY e.id
)"""
_JSON = """json_object(
    'user_id',user_id,'variant',variant,'event_name',event_name,'event_time',event_time,
    'impression_id',impression_id,'sdk_event_type',sdk_event_type,'url',url,'date',date,
    'attributed',attributed)"""


async def read_bounded_diagnostics(experiment_id: str, project_id: str) -> dict | None:
    """Read aggregate diagnostics from the same input and rules as the readout.

    This must not call read_bounded_input: inspecting an integration never creates
    a snapshot or finalizes a result. Frozen input remains the diagnostic basis
    even after raw-event cleanup; it is not a history of every received request.
    """
    # The aggregate reuses eligible in several correlated subqueries. Without
    # this fence SQLite can repeatedly expand the full eligibility query per
    # event. Materialize only for diagnostics; the readout SQL is unchanged.
    diagnostic_rows = _ROWS.replace(', eligible AS (', ', eligible AS MATERIALIZED (', 1)
    rows = await d1.security_query(_CONTEXT + _READ_CONTEXT + diagnostic_rows + """,
        sdk_candidates AS (
            SELECT * FROM candidates WHERE json_extract(properties,'$.event_model')='sdk_v1'
                AND json_extract(properties,'$.sdk_event_type') IN ('exposure','click','conversion')
        ), matched_actions AS (
            SELECT e.id FROM eligible e WHERE e.sdk_event_type<>'exposure' AND EXISTS (
                SELECT 1 FROM eligible x WHERE x.user_id=e.user_id AND x.variant=e.variant
                    AND x.session_id=e.session_id AND x.event_time<=e.event_time
                    AND x.sdk_event_type='exposure' AND x.impression_id=e.impression_id
                    AND x.assignment_id=e.assignment_id
            )
        )
        SELECT c.history_valid,c.frozen,c.input_sealed,
            COALESCE(json_extract(c.locked_json,'$.primary_metric'),
                (SELECT primary_metric FROM experiments WHERE id=c.experiment_id)) AS goal_event,
            (SELECT count(*) FROM sdk_candidates
                WHERE json_extract(properties,'$.sdk_event_type')='exposure') AS exposures,
            (SELECT count(*) FROM sdk_candidates
                WHERE json_extract(properties,'$.sdk_event_type')<>'exposure') AS actions,
            (SELECT count(*) FROM canonical WHERE sdk_event_type='exposure') AS included_exposures,
            (SELECT count(*) FROM canonical WHERE sdk_event_type<>'exposure' AND attributed=1) AS included_actions,
            (SELECT count(*) FROM canonical WHERE sdk_event_type<>'exposure' AND attributed=1
                AND event_name=json_extract(c.locked_json,'$.primary_metric')) AS goal_actions,
            (SELECT count(*) FROM eligible e WHERE sdk_event_type<>'exposure'
                AND NOT EXISTS (SELECT 1 FROM matched_actions m WHERE m.id=e.id)) AS unmatched_actions,
            (SELECT count(*) FROM matched_actions m
                WHERE NOT EXISTS (SELECT 1 FROM canonical e WHERE e.id=m.id)) AS outside_window_actions,
            (SELECT count(*) FROM sdk_candidates e
                WHERE NOT EXISTS (SELECT 1 FROM eligible x WHERE x.id=e.id)) AS policy_excluded_events
        FROM read_context c""", [experiment_id, experiment_id, project_id])
    if not rows:
        return None
    row = rows[0]
    if (row['frozen'] and row['input_sealed'] != 1) or (not row['frozen'] and not row['history_valid']):
        raise HTTPException(503, 'SDK diagnostics unavailable')
    return {key: value for key, value in row.items()
            if key not in ('history_valid', 'frozen', 'input_sealed')} | {
                'source': 'snapshot' if row['frozen'] else 'raw', 'supported': True,
                'experiment_id': experiment_id,
            }


async def read_bounded_input(experiment_id: str, project_id: str | None) -> dict | None:
    params = [experiment_id, experiment_id, project_id]
    # A failed enrollment lookup must not silently downgrade to the historic reader.
    enrolled = await d1.security_query(_CONTEXT + """
        SELECT history_valid, EXISTS (SELECT 1 FROM experiment_readout_snapshot s
            WHERE s.experiment_id=c.experiment_id) AS frozen FROM context c""", params)
    if not enrolled:
        return None
    if not enrolled[0]['history_valid'] and not enrolled[0]['frozen']:
        raise HTTPException(503, 'Readout history unavailable')
    await d1.security_query(_CONTEXT + """
        INSERT INTO experiment_readout_snapshot
            (experiment_id,contract_json,terminal_history_id,end_at,finalizes_at,frozen_at)
        SELECT experiment_id,locked_json,terminal_history_id,end_at,finalizes_at,
            strftime('%Y-%m-%dT%H:%M:%f','now') || '000+00:00'
        FROM context WHERE history_valid=1 AND locked_json IS NOT NULL AND finalizes_at IS NOT NULL
            AND strftime('%Y-%m-%dT%H:%M:%f','now') || '000+00:00' > finalizes_at
            AND NOT EXISTS (SELECT 1 FROM experiment_readout_snapshot s WHERE s.experiment_id=context.experiment_id)
        ON CONFLICT(experiment_id) DO NOTHING""", params)
    # Header and events share one SQLite statement/snapshot. Metadata occurs once,
    # including for an empty cohort; event rows never repeat the result/contract.
    rows = await d1.security_query(_CONTEXT + _READ_CONTEXT + _ROWS + f"""
        SELECT 0 AS kind,0 AS source_id,locked_json AS contract_json,result_json,
            finalizes_at,frozen,history_valid,input_sealed,NULL AS event_json
        FROM read_context
        UNION ALL
        SELECT 1,id,NULL,NULL,NULL,NULL,NULL,NULL,{_JSON} FROM canonical
        ORDER BY kind,source_id""", params)
    if not rows or rows[0]['kind'] != 0:
        raise HTTPException(503, 'Readout storage unavailable')
    row = rows[0]
    if row['frozen'] and row['input_sealed'] != 1:
        raise HTTPException(503, 'Readout storage unavailable')
    if not row['history_valid'] and not row['frozen']:
        raise HTTPException(503, 'Readout history unavailable')
    row['events'] = [json.loads(event['event_json']) for event in rows[1:]]
    row['contract'] = json.loads(row.pop('contract_json') or '{}')
    for key in ('kind', 'source_id', 'input_sealed', 'event_json'):
        row.pop(key)
    return row
