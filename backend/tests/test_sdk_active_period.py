"""Prospective active-period readouts, real routes + memory SQLite, no live data."""
import json
from pathlib import Path
import sqlite3

import pytest

from test_sdk_events import BASE, client, project, exposure_context, event, capture


START = '2026-10-01T10:00:00.123Z'


def transition(db, status, at):
    response = client.patch(f'{BASE}/experiments/a-one', json={'status': status})
    assert response.status_code == 200, response.text
    # Control the DB clock evidence without sleeps or changing the production clock.
    db.execute("UPDATE experiment_status_history SET recorded_at=? WHERE id=(SELECT max(id) FROM experiment_status_history WHERE experiment_id='a-one')", [at])
    db.commit()


@pytest.fixture
def active(project, monkeypatch):
    project.execute("DELETE FROM experiments WHERE id='a-one'")
    response = client.post(f'{BASE}/experiments/', json={
        'id': 'a-one', 'name': 'Prospective SDK', 'project_id': 'a', 'flag_key': 'flag-a',
        'event_model': 'sdk_v1', 'primary_metric': 'purchase', 'guardrail_metrics': ['retained'],
    })
    assert response.status_code == 201, response.text
    project.execute("DELETE FROM experiment_readout_contract WHERE experiment_id='a-one'")
    assert project.execute("SELECT version FROM experiment_readout_policy WHERE experiment_id='a-one'").fetchone()[0] == 'active_period_v1'
    project.execute("UPDATE experiment_status_history SET recorded_at='2026-10-01T09:00:00.000Z' WHERE experiment_id='a-one'")
    transition(project, 'running', START)
    monkeypatch.setattr('app.services.event._now', lambda: '2026-10-03T00:00:00+00:00')
    return project


def view(user='u'):
    ctx = exposure_context(user)
    assert capture(event(ctx, time=START)).status_code == 202
    return ctx


def marker(db, event_id):
    row = db.execute("SELECT properties FROM event_log WHERE event_id LIKE ?", ['%' + json.dumps(event_id) + ']']).fetchone()
    assert row is not None, event_id
    return json.loads(row[0]).get('sdk_active_period_eligible')


def live():
    response = client.get(f'{BASE}/experiments/a-one/analytics')
    assert response.status_code == 200, response.text
    return response.json()


@pytest.mark.parametrize('status', ['paused', 'completed', 'archived'])
@pytest.mark.parametrize('kind', ['click', 'conversion'])
def test_default_counts_late_active_action_but_not_post_stop_action(active, status, kind):
    ctx = view()
    transition(active, status, '2026-10-01T11:00:00.000Z')
    for event_id, timestamp in [('late-active', '2026-10-01T10:59:59.999999Z'), ('post-stop', '2026-10-01T11:00:00Z')]:
        assert capture(event(ctx, kind, 'purchase', event_id, timestamp)).status_code == 202
    assert marker(active, 'late-active') == 1
    assert marker(active, 'post-stop') == 0
    assert active.execute('SELECT count(*) FROM event_log').fetchone()[0] == 3
    assert live()['impressions']['total'] == live()['conversions']['total'] == 1


@pytest.mark.parametrize('at, expected', [
    ('2026-10-01T10:00:00.122999Z', 0), ('2026-10-01T10:00:00.123000Z', 1),
    ('2026-10-01T10:59:59.999999Z', 1), ('2026-10-01T11:00:00Z', 0),
    ('2026-10-01T11:30:00Z', 0), ('2026-10-01T11:59:59.999999Z', 0),
    ('2026-10-01T12:00:00Z', 1), ('2026-10-01T12:59:59.999999Z', 1),
    ('2026-10-01T13:00:00Z', 0), ('2026-10-01T21:00:00+09:00', 1),
])
def test_half_open_intervals_offsets_and_microseconds(active, at, expected):
    ctx = view()
    transition(active, 'paused', '2026-10-01T11:00:00.000Z')
    transition(active, 'running', '2026-10-01T12:00:00.000Z')
    transition(active, 'completed', '2026-10-01T13:00:00.000Z')
    assert capture(event(ctx, 'conversion', 'purchase', 'boundary', at)).status_code == 202
    assert marker(active, 'boundary') == expected
    assert live()['conversions']['total'] == expected


def test_retry_and_forged_markers_cannot_change_first_classification(active):
    ctx = view()
    transition(active, 'paused', '2026-10-01T11:00:00.000Z')
    payload = event(ctx, 'conversion', 'purchase', 'gap', '2026-10-01T11:30:00Z')
    payload['properties']['sdk_active_period_eligible'] = True
    payload['properties']['sdk_exposure_eligible'] = True
    assert capture(payload).status_code == 202
    original = dict(active.execute("SELECT * FROM event_log WHERE event_name='purchase'").fetchone())
    assert marker(active, 'gap') == 0
    transition(active, 'running', '2026-10-01T12:00:00.000Z')
    payload['timestamp'] = '2026-10-01T12:10:00Z'
    assert capture(payload).status_code == 202
    assert dict(active.execute("SELECT * FROM event_log WHERE event_name='purchase'").fetchone()) == original
    valid = event(ctx, 'conversion', 'purchase', 'new-active', '2026-10-01T12:10:00Z')
    valid['properties']['sdk_active_period_eligible'] = False
    assert capture(valid).status_code == 202
    assert marker(active, 'new-active') == 1
    assert live()['conversions']['total'] == 1


def test_missing_timestamp_uses_receipt_and_future_claim_is_not_rewritten(active, monkeypatch):
    ctx = view()
    monkeypatch.setattr('app.services.event._now', lambda: '2026-10-01T10:05:00+00:00')
    payload = event(ctx, 'conversion', 'purchase', 'no-time-active')
    payload.pop('timestamp')
    assert capture(payload).status_code == 202
    assert marker(active, 'no-time-active') == 1
    future = event(ctx, 'conversion', 'purchase', 'future', '2026-10-01T10:05:00.000001Z')
    assert capture(future).status_code == 202
    assert marker(active, 'future') == 0
    assert active.execute("SELECT event_time FROM event_log WHERE event_time LIKE '%.000001%'").fetchone()[0].startswith('2026-10-01T10:05:00.000001')
    transition(active, 'paused', '2026-10-01T11:00:00.000Z')
    monkeypatch.setattr('app.services.event._now', lambda: '2026-10-01T11:05:00+00:00')
    payload['event_id'] = 'no-time-paused'
    assert capture(payload).status_code == 202
    assert marker(active, 'no-time-paused') == 0
    assert capture(future).status_code == 202  # same id remains excluded after time advances
    assert marker(active, 'future') == 0
    bad = {**future, 'event_id': 'bad-time', 'timestamp': 'not-a-time'}
    assert capture(bad).status_code == 422


def test_equal_clock_status_changes_use_id_and_missing_history_fails_closed(active):
    ctx = view()
    transition(active, 'paused', '2026-10-01T11:00:00.000Z')
    transition(active, 'running', '2026-10-01T11:00:00.000Z')
    assert capture(event(ctx, 'conversion', 'purchase', 'equal-start', '2026-10-01T11:00:00Z')).status_code == 202
    assert marker(active, 'equal-start') == 1
    transition(active, 'completed', '2026-10-01T11:00:00.000Z')
    assert capture(event(ctx, 'conversion', 'purchase', 'equal-end', '2026-10-01T11:00:00Z')).status_code == 202
    assert marker(active, 'equal-end') == 0
    active.execute("DELETE FROM experiment_status_history WHERE experiment_id='a-one'")
    active.commit()
    assert capture(event(ctx, 'conversion', 'purchase', 'no-history', '2026-10-01T10:30:00Z')).status_code == 202
    assert marker(active, 'no-history') == 0


def test_action_before_exposure_can_reconcile_but_gap_exposure_cannot(active):
    ctx = exposure_context()
    assert capture(event(ctx, 'conversion', 'purchase', 'first-action', '2026-10-01T10:30:00Z')).status_code == 202
    assert live()['conversions']['total'] == 0
    assert capture(event(ctx, time=START)).status_code == 202
    assert live()['conversions']['total'] == 1
    transition(active, 'paused', '2026-10-01T11:00:00.000Z')
    transition(active, 'running', '2026-10-01T12:00:00.000Z')
    gap = {**ctx, 'impression_id': 'gap-view'}
    assert capture(event(gap, time='2026-10-01T11:30:00Z')).status_code == 202
    assert capture(event(gap, 'conversion', 'purchase', 'gap-view-action', '2026-10-01T12:30:00Z')).status_code == 202
    assert marker(active, 'gap-view') == 0
    assert live()['impressions']['total'] == live()['conversions']['total'] == 1


def test_batch_and_insert_time_status_race_use_same_policy(active, monkeypatch):
    from app.db import d1
    ctx = view()
    execute = d1.execute
    stopped = False

    async def stop_before_insert(sql, params=None, database_id=None):
        nonlocal stopped
        if not stopped and 'INSERT OR IGNORE INTO event_log' in sql:
            stopped = True
            active.execute("UPDATE experiments SET status='paused' WHERE id='a-one'")
            active.execute("UPDATE experiment_status_history SET recorded_at='2026-10-01T11:00:00.000Z' WHERE id=(SELECT max(id) FROM experiment_status_history WHERE experiment_id='a-one')")
            active.commit()
        return await execute(sql, params, database_id)

    monkeypatch.setattr(d1, 'execute', stop_before_insert)
    excluded = event(ctx, 'conversion', 'purchase', 'race-end', '2026-10-01T11:00:00Z')
    allowed = event(ctx, 'conversion', 'purchase', 'race-late', '2026-10-01T10:59:59Z')
    response = client.post(f'{BASE}/ingest/events', headers={'x-api-key': 'public-a'}, json={'events': [excluded, allowed, allowed]})
    assert response.status_code == 202
    assert response.json() == {'success': True, 'accepted': 3, 'total': 3}
    assert marker(active, 'race-end') == 0
    assert marker(active, 'race-late') == 1
    assert active.execute('SELECT count(*) FROM event_log').fetchone()[0] == 3
    assert live()['conversions']['total'] == 1


def test_result_live_guardrail_available_and_srm_share_filtered_rows(active):
    import asyncio
    from app.services.srm_monitor import srm_monitor
    groups = {}
    for i in range(100):
        ctx = exposure_context(f'group-{i}')
        groups.setdefault(ctx['variant'], ctx)
        if len(groups) == 2:
            break
    for ctx in groups.values():
        assert capture(event(ctx, time=START)).status_code == 202
    transition(active, 'completed', '2026-10-01T11:00:00.000Z')
    for variant, ctx in groups.items():
        for name in ['purchase', 'retained']:
            at = '2026-10-01T10:30:00Z' if variant == 'treatment' else '2026-10-01T11:00:00Z'
            assert capture(event(ctx, 'conversion', name, variant + name, at)).status_code == 202
    result = client.get(f'{BASE}/experiments/a-one/result').json()
    assert result['sample_size'] == 2
    assert result['control']['conversions'] == 0
    assert result['treatment']['conversions'] == 1
    assert result['guardrail_results'][0]['control_rate'] == 0
    assert result['guardrail_results'][0]['treatment_rate'] == 1
    assert live()['conversions']['total'] == 1
    available = client.get(f'{BASE}/experiments/a-one/available-events').json()
    assert available['conversion_events'] == ['purchase']
    assert 'retained' in available['event_types']
    assert available['has_conversions'] is True
    assert asyncio.run(srm_monitor._check_srm('a-one')) is False
    # Existing project checks still apply before accepting or attributing an event.
    assert capture(event(groups['control']), 'public-b').status_code == 404


def test_migration_replay_no_backfill_and_creation_rollback(project):
    migration = (Path(__file__).parents[1] / 'migrations/043_sdk_active_period_policy.sql').read_text()
    project.executescript(migration)
    project.executescript(migration)
    assert project.execute('SELECT count(*) FROM experiment_readout_policy').fetchone()[0] == 0
    project.execute("INSERT INTO experiments (id,name,event_model,created_at,updated_at) VALUES ('old-model','Legacy','legacy','2026-10-01','2026-10-01')")
    assert project.execute('SELECT count(*) FROM experiment_readout_policy').fetchone()[0] == 0
    project.execute("CREATE TRIGGER reject_policy BEFORE INSERT ON experiment_readout_policy BEGIN SELECT RAISE(ABORT, 'reject'); END")
    with pytest.raises(sqlite3.IntegrityError, match='reject'):
        project.execute("INSERT INTO experiments (id,name,event_model,created_at,updated_at) VALUES ('broken','Broken','sdk_v1','2026-10-01','2026-10-01')")
    assert project.execute("SELECT count(*) FROM experiments WHERE id='broken'").fetchone()[0] == 0
    assert project.execute("SELECT count(*) FROM experiment_status_history WHERE experiment_id='broken'").fetchone()[0] == 0
    project.execute('DROP TRIGGER reject_policy')
    project.execute("INSERT INTO experiments (id,name,event_model,created_at,updated_at) VALUES ('new-model','New','sdk_v1','2026-10-01','2026-10-01')")
    assert project.execute("SELECT version FROM experiment_readout_policy WHERE experiment_id='new-model'").fetchone()[0] == 'active_period_v1'
    with pytest.raises(sqlite3.IntegrityError, match='immutable'):
        project.execute("UPDATE experiment_readout_policy SET version=version WHERE experiment_id='new-model'")
    project.execute("DELETE FROM experiments WHERE id='new-model'")
    assert project.execute('SELECT count(*) FROM experiment_readout_policy').fetchone()[0] == 0


@pytest.mark.parametrize('fault', ['malformed', 'regressed', 'desynced', 'broken-chain'])
def test_corrupt_history_cannot_reclassify_an_action_as_active(active, fault):
    ctx = view()
    transition(active, 'paused', '2026-10-01T11:00:00.000Z')
    if fault == 'malformed':
        active.execute("UPDATE experiment_status_history SET recorded_at='broken' WHERE experiment_id='a-one' AND to_status='paused'")
    elif fault == 'regressed':
        active.execute("UPDATE experiment_status_history SET recorded_at='2026-10-01T08:00:00.000Z' WHERE experiment_id='a-one' AND to_status='paused'")
    elif fault == 'desynced':
        active.execute("DELETE FROM experiment_status_history WHERE experiment_id='a-one' AND to_status='paused'")
    else:
        active.execute("UPDATE experiment_status_history SET from_status='draft' WHERE experiment_id='a-one' AND to_status='paused'")
    active.commit()
    assert capture(event(ctx, 'conversion', 'purchase', 'bad-history', '2026-10-01T10:30:00Z')).status_code == 202
    assert marker(active, 'bad-history') == 0
    assert live()['conversions']['total'] == 0


def test_omitted_timestamp_is_checked_against_write_time_stop(active, monkeypatch):
    from app.db import d1
    ctx = view()
    monkeypatch.setattr('app.services.event._now', lambda: '2026-10-01T10:59:59.999999+00:00')
    execute = d1.execute

    async def stop_before_insert(sql, params=None, database_id=None):
        if 'INSERT OR IGNORE INTO event_log' in sql:
            active.execute("UPDATE experiments SET status='paused' WHERE id='a-one'")
            active.execute("UPDATE experiment_status_history SET recorded_at='2026-10-01T11:00:00.000Z' WHERE id=(SELECT max(id) FROM experiment_status_history WHERE experiment_id='a-one')")
            active.commit()
        return await execute(sql, params, database_id)

    monkeypatch.setattr(d1, 'execute', stop_before_insert)
    payload = event(ctx, 'conversion', 'purchase', 'no-time-race')
    payload.pop('timestamp')
    assert capture(payload).status_code == 202
    assert marker(active, 'no-time-race') == 0


def test_active_policy_requires_collector_proof_for_exposure_and_action(active):
    ctx = view()
    action = event(ctx, 'conversion', 'purchase', 'proof-action', '2026-10-01T10:30:00Z')
    assert capture(action).status_code == 202
    assert live()['conversions']['total'] == 1
    active.execute("UPDATE event_log SET properties=json_remove(properties, '$.sdk_active_period_eligible') WHERE event_name='exp_exposure'")
    active.commit()
    assert live()['impressions']['total'] == live()['conversions']['total'] == 0
    active.execute("UPDATE event_log SET properties=json_set(properties, '$.sdk_active_period_eligible', 1) WHERE event_name='exp_exposure'")
    active.execute("UPDATE event_log SET properties=json_remove(properties, '$.sdk_active_period_eligible') WHERE event_name='purchase'")
    active.commit()
    assert live()['impressions']['total'] == 1
    assert live()['conversions']['total'] == 0


def test_policyless_history_and_untrusted_old_property_are_not_reinterpreted(project):
    ctx = exposure_context()
    assert capture(event(ctx)).status_code == 202
    transition(project, 'completed', '2026-10-01T11:00:00.000Z')
    assert capture(event(ctx, 'conversion', 'purchase', 'legacy-post-end', '2026-10-02T10:00:00Z')).status_code == 202
    # Before this policy existed the same property name was arbitrary user data.
    project.execute("UPDATE event_log SET properties=json_set(properties, '$.sdk_active_period_eligible', 0)")
    project.commit()
    assert live()['conversions']['total'] == 1
