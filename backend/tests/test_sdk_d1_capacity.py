"""Exercise the published D1 value limit, which local workerd does not enforce."""
import asyncio
import json
import sqlite3

import pytest

from test_sdk_events import project
from test_sdk_bounded_readout import bounded, launch
from test_sdk_active_period import transition
from app.services.sdk_readout import read_bounded_input


@pytest.mark.parametrize('terminal', [False, True])
def test_input_larger_than_d1_value_limit_remains_readable(bounded, terminal):
    db, clock = bounded
    launch(db)
    properties = json.dumps({
        'event_model': 'sdk_v1', 'sdk_event_type': 'exposure',
        'sdk_bounded_eligible': 1, 'sdk_active_period_eligible': 1,
        'sdk_exposure_eligible': 1, 'impression_id': 'impression',
        'assignment_id': 'assignment',
        'url': 'https://capacity.invalid/' + 'x' * 150,
    })
    # Per-event rows fit D1; only the experiment-wide aggregate exceeds its limit.
    db.executemany('''INSERT INTO event_log
        (event_id,user_id,cohort_id,event_name,properties,experiment_id,variant,
         event_time,created_at,project_id,session_id)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)''', [
        (f'capacity-{i}', f'user-{i}', 13, 'page', properties, 'a-one',
         'control', '2026-10-01T10:05:00.000000+00:00',
         '2026-10-01T10:05:00.000000+00:00', 'a', 'session')
        for i in range(6000)
    ])
    db.commit()
    if terminal:
        transition(db, 'completed', '2026-10-01T10:30:00.000Z')
        clock['db'] = '2026-10-03T12:00:00Z'
    original_limit = db.setlimit(sqlite3.SQLITE_LIMIT_LENGTH, 2_000_000)
    try:
        readout = asyncio.run(read_bounded_input('a-one', 'a'))
        assert len(readout['events']) == 6000
        assert len(json.dumps(readout['events']).encode()) > 2_000_000
        assert bool(readout['frozen']) is terminal
        if terminal:
            db.execute("DELETE FROM event_log WHERE experiment_id='a-one'")
            db.commit()
            after_delete = asyncio.run(read_bounded_input('a-one', 'a'))
            assert after_delete['events'] == readout['events']
    finally:
        db.setlimit(sqlite3.SQLITE_LIMIT_LENGTH, original_limit)
