"""Bounded-v1 uses real SQL, API authorization and deterministic database clocks."""
import asyncio
import json
import sqlite3

import pytest
from fastapi import HTTPException

from test_sdk_events import BASE, client, project, exposure_context, event, capture
from test_sdk_active_period import transition, live


@pytest.fixture
def bounded(project, monkeypatch):
    from app.db import d1
    clock = {'receipt': '2026-10-01T10:10:00+00:00', 'db': '2026-10-01T10:10:00Z'}
    monkeypatch.setattr('app.services.event._now', lambda: clock['receipt'])
    query = d1.security_query

    async def controlled(sql, params=None, **kwargs):
        if 'context AS (' in sql:
            sql = sql.replace("'now'", "'" + clock['db'] + "'")
        return await query(sql, params, **kwargs)

    monkeypatch.setattr(d1, 'security_query', controlled)
    project.execute("DELETE FROM experiments WHERE id='a-one'")
    response = client.post(f'{BASE}/experiments/', json={
        'id': 'a-one', 'name': 'Bounded', 'event_model': 'sdk_v1', 'project_id': 'a',
        'flag_key': 'flag-a', 'primary_metric': 'purchase', 'guardrail_metrics': ['retained'],
        'conversion_window_seconds': 3600, 'one_time_intervention': True,
    })
    assert response.status_code == 201, response.text
    assert response.json()['readout_policy_version'] == 'bounded_v1'
    project.execute("UPDATE experiment_status_history SET recorded_at='2026-10-01T09:00:00.000Z' WHERE experiment_id='a-one'")
    return project, clock


def launch(db):
    transition(db, 'running', '2026-10-01T10:00:00.000Z')


def result():
    response = client.get(f'{BASE}/experiments/a-one/result')
    assert response.status_code == 200, response.text
    return response.json()


def proof(db, event_id):
    row = db.execute("SELECT properties FROM event_log WHERE event_id LIKE ?", ['%' + json.dumps(event_id) + ']']).fetchone()
    return json.loads(row[0])['sdk_bounded_eligible']


@pytest.mark.parametrize('value', [0, -1, 2592001, True, 1.1, '30'])
def test_strict_window_validation(bounded, value):
    assert client.patch(f'{BASE}/experiments/a-one', json={'conversion_window_seconds': value}).status_code == 422


def test_draft_clear_and_atomic_measurement_lock(bounded):
    db, _ = bounded
    assert client.patch(f'{BASE}/experiments/a-one', json={'conversion_window_seconds': None}).json()['conversion_window_seconds'] is None
    assert client.patch(f'{BASE}/experiments/a-one', json={'one_time_intervention': False}).status_code == 200
    assert client.patch(f'{BASE}/experiments/a-one', json={'conversion_window_seconds': 10}).status_code == 422
    launch(db)
    assert client.get(f'{BASE}/experiments/a-one').json()['measurement_locked'] is True
    assert client.patch(f'{BASE}/experiments/a-one', json={'primary_metric': 'other'}).status_code == 422
    assert client.patch(f'{BASE}/experiments/a-one', json={'name': 'Renamed'}).status_code == 200
    with pytest.raises(sqlite3.IntegrityError, match='locked'):
        db.execute("UPDATE experiments SET primary_metric='other' WHERE id='a-one'")
    transition(db, 'paused', '2026-10-01T10:30:00.000Z')
    assert client.patch(f'{BASE}/experiments/a-one', json={'status': 'running', 'conversion_window_seconds': 10, 'one_time_intervention': True}).status_code == 422


@pytest.mark.parametrize('at,expected', [
    ('2026-10-01T10:59:59.999999Z', 1), ('2026-10-01T11:00:00Z', 0),
    ('2026-10-01T11:00:00.000001Z', 0),
])
def test_user_window_after_stop_exclusive_microseconds(bounded, at, expected):
    db, clock = bounded
    launch(db)
    ctx = exposure_context()
    assert capture(event(ctx)).status_code == 202
    transition(db, 'completed', '2026-10-01T10:30:00.000Z')
    clock['receipt'] = '2026-10-01T12:00:00+00:00'
    assert capture(event(ctx, 'conversion', 'purchase', 'after', at)).status_code == 202
    assert live()['conversions']['total'] == expected
    assert result()['readout_state'] == 'observing'


@pytest.mark.parametrize('delta,expected', [('00.000000', 1), ('00.000001', 0)])
def test_transport_lateness_independent_of_window(bounded, delta, expected):
    db, clock = bounded
    launch(db)
    ctx = exposure_context()
    assert capture(event(ctx)).status_code == 202
    clock['receipt'] = '2026-10-02T10:30:' + delta + '+00:00'
    assert capture(event(ctx, 'conversion', 'purchase', 'late', '2026-10-01T10:30:00Z')).status_code == 202
    assert proof(db, 'late') == expected
    assert live()['conversions']['total'] == expected


def test_first_exposure_not_restarted_and_out_of_order_reconciles(bounded):
    db, clock = bounded
    launch(db)
    clock['receipt'] = '2026-10-01T12:00:00+00:00'
    ctx = exposure_context()
    assert capture(event(ctx, time='2026-10-01T10:30:00Z')).status_code == 202
    assert capture(event(ctx, 'conversion', 'purchase', 'purchase', '2026-10-01T11:15:00Z')).status_code == 202
    assert live()['conversions']['total'] == 1
    earlier = {**ctx, 'impression_id': 'earlier'}
    assert capture(event(earlier, time='2026-10-01T10:00:00Z')).status_code == 202
    assert live()['conversions']['total'] == 0
    transition(db, 'paused', '2026-10-01T11:30:00.000Z')
    transition(db, 'running', '2026-10-01T12:00:00.000Z')
    resumed = {**ctx, 'impression_id': 'resumed'}
    clock['receipt'] = '2026-10-01T12:10:00+00:00'
    assert capture(event(resumed, time='2026-10-01T12:00:00Z')).status_code == 202
    assert capture(event(resumed, 'conversion', 'purchase', 'resumed-action', '2026-10-01T12:05:00Z')).status_code == 202
    assert live()['conversions']['total'] == 0


def test_default_active_boundary_missing_future_and_marker_forgery(bounded):
    db, clock = bounded
    assert client.patch(f'{BASE}/experiments/a-one', json={'conversion_window_seconds': None}).status_code == 200
    launch(db)
    ctx = exposure_context()
    assert capture(event(ctx)).status_code == 202
    future = event(ctx, 'conversion', 'purchase', 'future', '2026-10-01T10:10:00.000001Z')
    future['properties']['sdk_bounded_eligible'] = 1
    assert capture(future).status_code == 202
    assert proof(db, 'future') == 0
    missing = event(ctx, 'conversion', 'purchase', 'missing')
    missing.pop('timestamp')
    assert capture(missing).status_code == 202
    assert proof(db, 'missing') == 1
    transition(db, 'paused', '2026-10-01T10:30:00.000Z')
    clock['receipt'] = '2026-10-01T11:00:00+00:00'
    assert capture(event(ctx, 'conversion', 'retained', 'paused', '2026-10-01T10:40:00Z')).status_code == 202
    assert 'retained' not in client.get(f'{BASE}/experiments/a-one/available-events').json()['event_types']
    assert result()['readout_state'] == 'observing'
    assert db.execute('SELECT count(*) FROM experiment_readout_snapshot').fetchone()[0] == 0
    assert capture({**future, 'event_id': 'bad', 'timestamp': 'invalid'}).status_code == 422


def test_atomic_snapshot_survives_source_mutation_and_crash(bounded, monkeypatch):
    from app.db import d1
    from app.services.sdk_events import read_sdk_events
    db, clock = bounded
    launch(db)
    ctx = exposure_context()
    assert capture(event(ctx)).status_code == 202
    transition(db, 'completed', '2026-10-01T10:30:00.000Z')
    clock['db'] = '2026-10-02T11:30:00.001Z'
    frozen = asyncio.run(read_sdk_events('a-one', 'a'))
    assert len(frozen) == 1
    assert db.execute('SELECT result_json FROM experiment_readout_snapshot').fetchone()[0] is None
    # Original sources may be deleted/changed without changing immutable inputs.
    db.execute("DELETE FROM event_log")
    assert asyncio.run(read_sdk_events('a-one', 'a')) == frozen
    original = result()
    assert original['readout_state'] == 'finalized'
    assert original['finalizes_at'] == '2026-10-02T11:30:00Z'
    assert result() == original
    assert live()['readout_state'] == 'finalized'
    assert live()['impressions']['total'] == 1
    with pytest.raises(sqlite3.IntegrityError, match='immutable'):
        db.execute("UPDATE experiment_readout_snapshot SET result_json='{}'")
    assert asyncio.run(read_sdk_events('a-one', 'b')) == []


def test_delayed_insert_after_snapshot_cannot_enter_readout(bounded, monkeypatch):
    from app.db import d1
    from app.services.sdk_events import read_sdk_events
    db, clock = bounded
    launch(db)
    ctx = exposure_context()
    assert capture(event(ctx)).status_code == 202
    transition(db, 'completed', '2026-10-01T10:30:00.000Z')
    execute = d1.execute

    async def freeze_before_insert(sql, params=None, database_id=None):
        if 'INSERT OR IGNORE INTO event_log' in sql:
            clock['db'] = '2026-10-02T11:30:00.001Z'
            await read_sdk_events('a-one', 'a')
        return await execute(sql, params, database_id)

    monkeypatch.setattr(d1, 'execute', freeze_before_insert)
    clock['receipt'] = '2026-10-01T10:45:00+00:00'
    payload = event(ctx, 'conversion', 'purchase', 'raced', '2026-10-01T10:40:00Z')
    assert capture(payload).status_code == 202
    assert proof(db, 'raced') == 0
    assert db.execute('SELECT count(*) FROM event_log').fetchone()[0] == 2
    assert live()['conversions']['total'] == 0
    assert capture(payload).status_code == 202
    assert proof(db, 'raced') == 0


def test_strict_failure_never_freezes_empty_success(bounded, monkeypatch):
    from app.db import d1
    db, _ = bounded
    launch(db)
    original = d1.security_query

    async def fail(sql, params=None, **kwargs):
        if 'context AS (' in sql:
            raise HTTPException(503, 'Readout storage unavailable')
        return await original(sql, params, **kwargs)

    monkeypatch.setattr(d1, 'security_query', fail)
    assert client.get(f'{BASE}/experiments/a-one/result').status_code == 503
    assert client.get(f'{BASE}/experiments/a-one/analytics').status_code == 503
    assert db.execute('SELECT count(*) FROM experiment_readout_snapshot').fetchone()[0] == 0


def test_deterministic_result_guardrails_srm_and_duplicate_finalizers(bounded, monkeypatch):
    from app.db import d1
    from app.services.experiment import experiment_service
    from app.services.srm_monitor import srm_monitor
    db, clock = bounded
    launch(db)
    groups = {}
    for i in range(100):
        ctx = exposure_context(f'group-{i}')
        groups.setdefault(ctx['variant'], ctx)
        if len(groups) == 2:
            break
    for ctx in groups.values():
        assert capture(event(ctx)).status_code == 202
    clock['receipt'] = '2026-10-01T10:25:00+00:00'
    for name in ['purchase', 'retained']:
        assert capture(event(groups['treatment'], 'conversion', name, name, '2026-10-01T10:20:00Z')).status_code == 202
    first = result()
    assert result() == first
    assert first['control']['conversions'] == 0
    assert first['treatment']['conversions'] == 1
    assert first['guardrail_results'][0]['treatment_rate'] == 1
    assert asyncio.run(srm_monitor._check_srm('a-one')) is False
    transition(db, 'completed', '2026-10-01T10:30:00.000Z')
    clock['db'] = '2026-10-02T11:30:00.001Z'
    query = d1.security_query
    winner = []

    async def competing_finalizer(sql, params=None, **kwargs):
        if sql.startswith('UPDATE experiment_readout_snapshot') and not winner:
            winner.append(None)
            winner[0] = await experiment_service.get_result('a-one')
        return await query(sql, params, **kwargs)

    monkeypatch.setattr(d1, 'security_query', competing_finalizer)
    final = result()
    assert final == winner[0].model_dump(mode='json')
    assert final['probability_treatment_wins'] == first['probability_treatment_wins']
    assert live()['readout_state'] == 'finalized'
    assert live()['conversions']['total'] == 1
    assert client.get(f'{BASE}/experiments/a-one/available-events').json()['conversion_events'] == ['purchase']
    assert asyncio.run(srm_monitor._check_srm('a-one')) is False
    assert db.execute('SELECT count(*) FROM experiment_readout_snapshot').fetchone()[0] == 1


def test_result_write_failure_retries_frozen_input(bounded, monkeypatch):
    from app.db import d1
    db, clock = bounded
    launch(db)
    ctx = exposure_context()
    capture(event(ctx))
    transition(db, 'completed', '2026-10-01T10:30:00.000Z')
    clock['db'] = '2026-10-02T11:30:00.001Z'
    query = d1.security_query

    async def fail_write(sql, params=None, **kwargs):
        if sql.startswith('UPDATE experiment_readout_snapshot'):
            raise HTTPException(503, 'Readout storage unavailable')
        return await query(sql, params, **kwargs)

    monkeypatch.setattr(d1, 'security_query', fail_write)
    assert client.get(f'{BASE}/experiments/a-one/result').status_code == 503
    assert db.execute('SELECT result_json FROM experiment_readout_snapshot').fetchone()[0] is None
    db.execute('DELETE FROM event_log')
    monkeypatch.setattr(d1, 'security_query', query)
    assert result()['sample_size'] == 1
    assert result()['readout_state'] == 'finalized'


def test_final_deadline_and_independent_receipt_limit(bounded):
    db, clock = bounded
    launch(db)
    ctx = exposure_context()
    capture(event(ctx))
    transition(db, 'completed', '2026-10-01T10:30:00.000Z')
    clock['db'] = '2026-10-02T11:30:00Z'
    assert result()['readout_state'] == 'observing'
    assert db.execute('SELECT count(*) FROM experiment_readout_snapshot').fetchone()[0] == 0
    clock['db'] = '2026-10-02T11:30:00.001Z'
    assert result()['readout_state'] == 'finalized'


def test_paused_one_time_omitted_timestamp_and_wrong_view(bounded):
    db, clock = bounded
    launch(db)
    ctx = exposure_context()
    capture(event(ctx))
    transition(db, 'paused', '2026-10-01T10:30:00.000Z')
    clock['receipt'] = '2026-10-01T10:45:00+00:00'
    payload = event(ctx, 'conversion', 'purchase', 'omitted')
    payload.pop('timestamp')
    assert capture(payload).status_code == 202
    assert live()['conversions']['total'] == 1
    wrong = {**ctx, 'impression_id': 'unseen'}
    assert capture(event(wrong, 'conversion', 'retained', 'wrong', '2026-10-01T10:45:00Z')).status_code == 202
    assert result()['readout_state'] == 'observing'
    # No new eligible exposure while paused, even if occurrence claims running.
    assert capture(event(wrong)).status_code == 202
    assert live()['impressions']['total'] == 1


def test_launch_and_stale_update_race_is_enforced_in_sql(bounded, monkeypatch):
    from app.db import d1
    db, _ = bounded
    query = d1.security_query

    async def launch_before_patch(sql, params=None, **kwargs):
        if sql.startswith('UPDATE experiments SET'):
            db.execute("UPDATE experiments SET status='running' WHERE id='a-one'")
        return await query(sql, params, **kwargs)

    monkeypatch.setattr(d1, 'security_query', launch_before_patch)
    response = client.patch(f'{BASE}/experiments/a-one', json={'primary_metric': 'raced'})
    assert response.status_code == 409
    assert db.execute("SELECT primary_metric FROM experiments WHERE id='a-one'").fetchone()[0] == 'purchase'
    assert json.loads(db.execute("SELECT locked_json FROM experiment_readout_contract WHERE experiment_id='a-one'").fetchone()[0])['primary_metric'] == 'purchase'


def test_migration_prospective_atomic_creation_and_cascade():
    from pathlib import Path
    from conftest import _SCHEMA
    db = sqlite3.connect(':memory:')
    db.execute('PRAGMA foreign_keys=ON')
    db.executescript(_SCHEMA)
    migrations = Path(__file__).parents[1] / 'migrations'
    for name in ['038_sdk_event_model.sql', '041_experiment_status_history.sql', '043_sdk_active_period_policy.sql']:
        db.executescript((migrations / name).read_text())
    db.execute("INSERT INTO experiments(id,name,event_model,created_at,updated_at) VALUES('pre044','Old','sdk_v1','x','x')")
    db.executescript((migrations / '044_bounded_readout.sql').read_text())
    assert db.execute('SELECT count(*) FROM experiment_readout_contract').fetchone()[0] == 0
    db.execute("CREATE TRIGGER reject_contract BEFORE INSERT ON experiment_readout_contract BEGIN SELECT RAISE(ABORT,'reject'); END")
    with pytest.raises(sqlite3.IntegrityError, match='reject'):
        db.execute("INSERT INTO experiments(id,name,event_model,created_at,updated_at) VALUES('broken','Bad','sdk_v1','x','x')")
    assert db.execute("SELECT count(*) FROM experiments WHERE id='broken'").fetchone()[0] == 0
    assert db.execute("SELECT count(*) FROM experiment_status_history WHERE experiment_id='broken'").fetchone()[0] == 0
    db.execute('DROP TRIGGER reject_contract')
    db.execute("INSERT INTO experiments(id,name,event_model,created_at,updated_at) VALUES('new','New','sdk_v1','x','x')")
    db.execute("UPDATE experiments SET status='running',primary_metric='purchase' WHERE id='new'")
    assert json.loads(db.execute("SELECT locked_json FROM experiment_readout_contract WHERE experiment_id='new'").fetchone()[0])['primary_metric'] == 'purchase'
    db.execute("DELETE FROM experiments WHERE id='new'")
    assert db.execute('SELECT count(*) FROM experiment_readout_contract').fetchone()[0] == 0
    assert db.execute("SELECT version FROM experiment_readout_policy WHERE experiment_id='pre044'").fetchone()[0] == 'active_period_v1'
    db.close()


@pytest.mark.parametrize('fault', ['malformed', 'regressed', 'missing-first', 'missing-middle', 'missing-terminal', 'broken-chain'])
def test_invalid_history_never_finalizes(bounded, fault):
    db, clock = bounded
    launch(db)
    capture(event(exposure_context()))
    transition(db, 'paused', '2026-10-01T10:20:00.000Z')
    transition(db, 'completed', '2026-10-01T10:30:00.000Z')
    if fault == 'malformed':
        db.execute("UPDATE experiment_status_history SET recorded_at='bad' WHERE experiment_id='a-one' AND to_status='paused'")
    elif fault == 'regressed':
        db.execute("UPDATE experiment_status_history SET recorded_at='2026-10-01T09:00:00.000Z' WHERE experiment_id='a-one' AND to_status='completed'")
    elif fault == 'missing-first':
        db.execute("DELETE FROM experiment_status_history WHERE experiment_id='a-one' AND from_status IS NULL")
    elif fault == 'missing-middle':
        db.execute("DELETE FROM experiment_status_history WHERE experiment_id='a-one' AND to_status='paused'")
    elif fault == 'missing-terminal':
        db.execute("DELETE FROM experiment_status_history WHERE experiment_id='a-one' AND to_status='completed'")
    else:
        db.execute("UPDATE experiment_status_history SET from_status='running' WHERE experiment_id='a-one' AND to_status='completed'")
    clock['db'] = '2026-10-03T12:00:00Z'
    assert client.get(f'{BASE}/experiments/a-one/result').status_code == 503
    assert client.get(f'{BASE}/experiments/a-one/analytics').status_code == 503
    assert db.execute('SELECT count(*) FROM experiment_readout_snapshot').fetchone()[0] == 0


@pytest.mark.parametrize('reverse_order', [False, True])
def test_direct_running_insert_locks_regardless_of_trigger_order(mock_d1, reverse_order):
    from pathlib import Path
    if reverse_order:
        mock_d1.execute('DROP TRIGGER record_sdk_experiment_creation')
        mock_d1.executescript((Path(__file__).parents[1] / 'migrations/041_experiment_status_history.sql').read_text())
    mock_d1.execute("""INSERT INTO experiments(id,name,status,event_model,primary_metric,created_at,updated_at)
        VALUES('direct-running','Direct','running','sdk_v1','purchase','2026-10-01','2026-10-01')""")
    row = mock_d1.execute("SELECT locked_json FROM experiment_readout_contract WHERE experiment_id='direct-running'").fetchone()
    assert json.loads(row[0])['primary_metric'] == 'purchase'
    assert mock_d1.execute("SELECT count(*) FROM experiment_status_history WHERE experiment_id='direct-running'").fetchone()[0] == 1


def test_historic_same_instant_action_then_new_exposure_preserves_text_order(project):
    ctx = exposure_context()
    # Represents a pre-044 unmarked action already stored in established format.
    payload = event(ctx, 'conversion', 'purchase', 'old-action', '2026-10-01T10:00:00Z')
    assert capture(payload).status_code == 202
    project.execute("UPDATE event_log SET properties=json_remove(properties,'$.sdk_bounded_eligible')")
    old = dict(project.execute("SELECT * FROM event_log WHERE event_name='purchase'").fetchone())
    assert old['event_time'] == '2026-10-01T10:00:00+00:00'
    assert live()['conversions']['total'] == 0
    assert capture(event(ctx, time='2026-10-01T10:00:00Z')).status_code == 202
    exposure = project.execute("SELECT event_time FROM event_log WHERE event_name='exp_exposure'").fetchone()[0]
    assert exposure == old['event_time']
    assert live()['conversions']['total'] == 1
    assert dict(project.execute("SELECT * FROM event_log WHERE event_name='purchase'").fetchone()) == old


def test_history_corruption_between_validation_and_snapshot_is_atomic(bounded, monkeypatch):
    from app.db import d1
    db, clock = bounded
    launch(db)
    capture(event(exposure_context()))
    transition(db, 'completed', '2026-10-01T10:30:00.000Z')
    clock['db'] = '2026-10-03T12:00:00Z'
    query = d1.security_query

    async def corrupt_before_snapshot(sql, params=None, **kwargs):
        if 'INSERT INTO experiment_readout_snapshot' in sql:
            db.execute("DELETE FROM experiment_status_history WHERE experiment_id='a-one' AND from_status IS NULL")
        return await query(sql, params, **kwargs)

    monkeypatch.setattr(d1, 'security_query', corrupt_before_snapshot)
    assert client.get(f'{BASE}/experiments/a-one/result').status_code == 503
    assert db.execute('SELECT count(*) FROM experiment_readout_snapshot').fetchone()[0] == 0


def test_never_launched_draft_or_archived_has_no_readout_lifecycle(bounded):
    db, clock = bounded
    for archived in (False, True):
        if archived:
            transition(db, 'archived', '2026-10-01T10:30:00.000Z')
        clock['db'] = '2026-12-01T12:00:00Z'
        value = result()
        assert value['sample_size'] == 0
        assert value['readout_state'] is None
        assert value['finalizes_at'] is None
        analytics = live()
        assert analytics['readout_state'] is None
        assert analytics['finalizes_at'] is None
        assert db.execute('SELECT count(*) FROM experiment_readout_snapshot').fetchone()[0] == 0
    assert client.get(f'{BASE}/experiments/a-one').json()['status'] == 'archived'


def test_analytics_uses_contract_when_initial_metadata_read_is_stale(bounded, monkeypatch):
    from app.db import d1
    db, _ = bounded
    launch(db)
    ctx = exposure_context()
    capture(event(ctx))
    capture(event(ctx, 'conversion', 'purchase', 'metric-action', '2026-10-01T10:05:00Z'))
    query = d1.security_query

    async def stale_metadata(sql, params=None, **kwargs):
        rows = await query(sql, params, **kwargs)
        if sql.startswith('SELECT flag_key, experiment_type, primary_metric, project_id, event_model'):
            return [{**row, 'primary_metric': 'pre-launch-value'} for row in rows]
        return rows

    monkeypatch.setattr(d1, 'security_query', stale_metadata)
    assert live()['conversions']['total'] == 1
    available = client.get(f'{BASE}/experiments/a-one/available-events').json()
    assert available['conversion_events'] == ['purchase']
    assert available['has_conversions'] is True


@pytest.mark.parametrize('custom_rule', [False, True])
def test_launch_contract_records_fallback_arms_alongside_rule_variants(bounded, custom_rule):
    db, _ = bounded
    if custom_rule:
        db.execute("""INSERT INTO feature_flag_rule
            (id, flag_key, priority, rollout_pct, variant, enabled, created_at, updated_at)
            VALUES ('custom', 'flag-a', 1, 50, 'custom-arm', 1, '2026-10-01', '2026-10-01')""")
        db.commit()
    # Exercise the launch trigger directly; legacy placement validation is unrelated
    # to the complete set of arms that the flag can return.
    db.execute("UPDATE experiments SET status='running' WHERE id='a-one'")
    db.commit()
    contract = json.loads(db.execute("SELECT locked_json FROM experiment_readout_contract WHERE experiment_id='a-one'").fetchone()[0])
    assert set(contract['variant_names']) == ({'control', 'treatment', 'custom-arm'} if custom_rule else {'control', 'treatment'})


@pytest.mark.parametrize('declared_before_launch', [False, True])
def test_only_declared_variant_arms_enter_live_and_final_readouts(bounded, declared_before_launch):
    from app.services.sdk_readout import read_bounded_input
    db, clock = bounded
    rule = """INSERT INTO feature_flag_rule
        (id,flag_key,priority,rollout_pct,variant,enabled,created_at,updated_at)
        VALUES ('custom','flag-a',1,?,'custom-arm',1,'2026-10-01','2026-10-01')"""
    if declared_before_launch:
        db.execute(rule, [0])
    # This test exercises the atomic launch contract, independent of legacy placements.
    db.execute("UPDATE experiments SET status='running' WHERE id='a-one'")
    db.execute("UPDATE experiment_status_history SET recorded_at='2026-10-01T10:00:00.000Z' WHERE id=(SELECT max(id) FROM experiment_status_history WHERE experiment_id='a-one')")
    db.commit()
    baseline = next(ctx for i in range(32)
                    if (ctx := exposure_context(f'baseline-{i}'))['variant'] == 'control')
    assert capture(event(baseline)).status_code == 202
    if declared_before_launch:
        db.execute("UPDATE feature_flag_rule SET rollout_pct=100 WHERE id='custom'")
    else:
        db.execute(rule, [100])
    db.commit()
    custom = exposure_context('custom-user')
    assert custom['variant'] == 'custom-arm'
    assert capture(event(custom)).status_code == 202
    assert capture(event(custom, 'conversion', 'purchase', 'custom-purchase', '2026-10-01T10:05:00Z')).status_code == 202
    expected = 2 if declared_before_launch else 1
    assert live()['impressions']['total'] == expected
    assert live()['conversions']['total'] == int(declared_before_launch)
    current_result = result()
    assert current_result['sample_size'] == expected
    if declared_before_launch:
        assert current_result['treatment']['variant_name'] == 'custom-arm'
        assert current_result['treatment']['conversions'] == 1
    else:
        assert current_result['treatment'] is None
    current = asyncio.run(read_bounded_input('a-one', 'a'))
    assert {e['variant'] for e in current['events']} == ({'control', 'custom-arm'} if declared_before_launch else {'control'})
    transition(db, 'completed', '2026-10-01T10:30:00.000Z')
    clock['db'] = '2026-10-03T00:00:00Z'
    finalized = result()
    assert finalized['readout_state'] == 'finalized'
    assert finalized['sample_size'] == expected
    assert finalized['treatment'] == current_result['treatment']


def test_frozen_candidates_are_projected_sealed_and_cascade_with_experiment(bounded):
    from app.services.sdk_readout import read_bounded_input
    db, clock = bounded
    db.commit()
    db.execute('PRAGMA foreign_keys=ON')
    launch(db)
    ctx = exposure_context()
    capture(event(ctx))
    capture(event(ctx, 'conversion', 'purchase', 'purchase', '2026-10-01T10:05:00Z'))
    db.execute("UPDATE event_log SET properties=json_set(properties,'$.private_payload','do-not-copy')")
    source_ids = [r[0] for r in db.execute('SELECT id FROM event_log ORDER BY id')]
    transition(db, 'completed', '2026-10-01T10:30:00.000Z')
    clock['db'] = '2026-10-02T11:30:00.001Z'
    frozen = asyncio.run(read_bounded_input('a-one', 'a'))
    assert [r[0] for r in db.execute('SELECT id FROM experiment_readout_input ORDER BY id')] == source_ids
    for row in db.execute('SELECT properties FROM experiment_readout_input'):
        assert set(json.loads(row[0])) == {
            'sdk_event_type', 'impression_id', 'assignment_id', 'url', 'sdk_bounded_eligible',
            'sdk_active_period_eligible', 'sdk_exposure_eligible', 'event_model',
        }
    assert db.execute('SELECT input_sealed FROM experiment_readout_snapshot').fetchone()[0] == 1
    with pytest.raises(sqlite3.IntegrityError, match='sealed'):
        db.execute('INSERT INTO experiment_readout_input SELECT experiment_id,id+10000,project_id,user_id,'
                   'variant,event_name,event_time,session_id,created_at,properties FROM experiment_readout_input')
    with pytest.raises(sqlite3.IntegrityError, match='immutable'):
        db.execute("UPDATE experiment_readout_input SET user_id='changed'")
    with pytest.raises(sqlite3.IntegrityError, match='immutable'):
        db.execute('DELETE FROM experiment_readout_input')
    with pytest.raises(sqlite3.IntegrityError, match='immutable'):
        db.execute('UPDATE experiment_readout_snapshot SET input_sealed=0')
    db.execute('DELETE FROM event_log')
    assert asyncio.run(read_bounded_input('a-one', 'a'))['events'] == frozen['events']
    db.execute("DELETE FROM experiments WHERE id='a-one'")
    assert db.execute('SELECT count(*) FROM experiment_readout_snapshot').fetchone()[0] == 0
    assert db.execute('SELECT count(*) FROM experiment_readout_input').fetchone()[0] == 0


def test_candidate_copy_failure_rolls_back_parent_and_all_inputs(bounded):
    from app.services.sdk_readout import read_bounded_input
    db, clock = bounded
    launch(db)
    ctx = exposure_context()
    capture(event(ctx))
    capture(event(ctx, 'conversion', 'purchase', 'purchase', '2026-10-01T10:05:00Z'))
    transition(db, 'completed', '2026-10-01T10:30:00.000Z')
    clock['db'] = '2026-10-02T11:30:00.001Z'
    db.execute("CREATE TRIGGER reject_candidate BEFORE INSERT ON experiment_readout_input "
               "WHEN NEW.event_name='purchase' BEGIN SELECT RAISE(ABORT,'copy failed'); END")
    with pytest.raises(sqlite3.IntegrityError, match='copy failed'):
        asyncio.run(read_bounded_input('a-one', 'a'))
    assert db.execute('SELECT count(*) FROM experiment_readout_snapshot').fetchone()[0] == 0
    assert db.execute('SELECT count(*) FROM experiment_readout_input').fetchone()[0] == 0
    db.execute('DROP TRIGGER reject_candidate')
    assert len(asyncio.run(read_bounded_input('a-one', 'a'))['events']) == 2


def test_empty_snapshot_seals_and_corrupt_unsealed_snapshot_fails_closed(bounded):
    db, clock = bounded
    launch(db)
    transition(db, 'completed', '2026-10-01T10:30:00.000Z')
    clock['db'] = '2026-10-02T11:30:00.001Z'
    assert result()['sample_size'] == 0
    assert db.execute('SELECT input_sealed FROM experiment_readout_snapshot').fetchone()[0] == 1
    assert db.execute('SELECT count(*) FROM experiment_readout_input').fetchone()[0] == 0
    guard = db.execute("SELECT sql FROM sqlite_master WHERE name='immutable_readout_snapshot'").fetchone()[0]
    db.execute('DROP TRIGGER immutable_readout_snapshot')
    db.execute('UPDATE experiment_readout_snapshot SET input_sealed=0,result_json=NULL')
    db.execute(guard)
    with pytest.raises(sqlite3.IntegrityError, match='immutable'):
        db.execute("UPDATE experiment_readout_snapshot SET result_json='{}'")
    assert client.get(f'{BASE}/experiments/a-one/result').status_code == 503
    assert client.get(f'{BASE}/experiments/a-one/analytics').status_code == 503


def test_freeze_candidate_scope_uses_contract_project_proof_and_receipt(bounded):
    from app.services.sdk_readout import read_bounded_input
    db, clock = bounded
    launch(db)
    ctx = exposure_context()
    capture(event(ctx))
    for name in ('wrong-project', 'late', 'unproven'):
        capture(event(ctx, 'conversion', name, name, '2026-10-01T10:05:00Z'))
    db.execute("UPDATE event_log SET project_id='b' WHERE event_name='wrong-project'")
    db.execute("UPDATE event_log SET created_at='2026-10-02T11:30:00.000001+00:00' WHERE event_name='late'")
    db.execute("UPDATE event_log SET properties=json_set(properties,'$.sdk_bounded_eligible',0) "
               "WHERE event_name='unproven'")
    transition(db, 'completed', '2026-10-01T10:30:00.000Z')
    clock['db'] = '2026-10-02T11:30:00.001Z'
    assert len(asyncio.run(read_bounded_input('a-one', 'a'))['events']) == 1
    assert db.execute('SELECT count(*) FROM experiment_readout_input').fetchone()[0] == 1


def test_header_and_events_choose_one_snapshot_when_finalizer_races(bounded, monkeypatch):
    from app.db import d1
    from app.services.sdk_readout import read_bounded_input
    db, clock = bounded
    launch(db)
    capture(event(exposure_context()))
    transition(db, 'completed', '2026-10-01T10:30:00.000Z')
    # Outer reader's freeze attempt is still before the deadline.
    clock['db'] = '2026-10-02T11:30:00.000Z'
    query = d1.security_query
    final_reads = []
    raced = False

    async def freeze_before_coherent_read(sql, params=None, **kwargs):
        nonlocal raced
        if 'SELECT 0 AS kind' in sql:
            if not raced:
                raced = True
                clock['db'] = '2026-10-02T11:30:00.001Z'
                assert (await read_bounded_input('a-one', 'a'))['frozen']
                db.execute('DELETE FROM event_log')
            rows = await query(sql, params, **kwargs)
            final_reads.append(rows)
            # The large header fields are present exactly once, not per event.
            assert len([r for r in rows if r['kind'] == 0]) == 1
            assert all(r['contract_json'] is None and r['result_json'] is None
                       for r in rows if r['kind'] == 1)
            return rows
        return await query(sql, params, **kwargs)

    monkeypatch.setattr(d1, 'security_query', freeze_before_coherent_read)
    value = asyncio.run(read_bounded_input('a-one', 'a'))
    assert value['frozen'] and len(value['events']) == 1
    assert len(final_reads) == 2  # One coherent read per caller, including the competing finalizer.
