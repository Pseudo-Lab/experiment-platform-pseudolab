"""Integration diagnostics use real collector/readout SQL, without changing it."""
import pytest
from fastapi import HTTPException

from test_sdk_events import BASE, client, project, exposure_context, event, capture
from test_sdk_bounded_readout import bounded, launch, result
from test_sdk_active_period import transition


def diagnose(experiment='a-one', project_id='a'):
    return client.get(f'{BASE}/projects/{project_id}/sdk-status', params={'experiment_id': experiment})


def test_empty_diagnostics_and_compatible_project_status(bounded):
    db, _ = bounded
    assert set(client.get(f'{BASE}/projects/a/sdk-status').json()) == {'project_id', 'status'}
    changes = db.total_changes
    response = diagnose()
    assert response.status_code == 200, response.text
    d = response.json()['diagnostics']
    assert d['supported'] is True and d['source'] == 'raw' and d['goal_event'] == 'purchase'
    assert d['exposures'] == d['actions'] == d['goal_actions'] == 0
    assert db.total_changes == changes


def test_unmatched_action_reconciles_when_real_exposure_arrives(bounded):
    db, _ = bounded
    launch(db)
    ctx = exposure_context()
    assert capture(event(ctx, 'conversion', 'purchase', 'first', '2026-10-01T10:01:00Z')).status_code == 202
    d = diagnose().json()['diagnostics']
    assert d['actions'] == d['unmatched_actions'] == 1
    assert d['outside_window_actions'] == d['included_actions'] == 0
    assert capture(event(ctx)).status_code == 202
    d = diagnose().json()['diagnostics']
    assert d['exposures'] == d['included_exposures'] == d['included_actions'] == d['goal_actions'] == 1
    assert d['unmatched_actions'] == 0


def test_exact_window_attribution_and_collector_exclusion_are_distinct(bounded):
    db, clock = bounded
    launch(db)
    ctx = exposure_context()
    assert capture(event(ctx)).status_code == 202
    clock['receipt'] = '2026-10-01T12:00:00+00:00'
    for payload in [
        event(ctx, 'conversion', 'purchase', 'inside', '2026-10-01T10:05:00Z'),
        event(ctx, 'conversion', 'purchase', 'boundary', '2026-10-01T11:00:00Z'),
        event({**ctx, 'impression_id': 'not-shown'}, 'click', 'open', 'orphan', '2026-10-01T10:06:00Z'),
        event(ctx, 'conversion', 'purchase', 'future', '2026-10-01T12:00:01Z'),
    ]:
        assert capture(payload).status_code == 202
    d = diagnose().json()['diagnostics']
    assert d['exposures'] == d['included_exposures'] == 1
    assert d['actions'] == 4
    assert d['included_actions'] == d['goal_actions'] == d['unmatched_actions'] == d['outside_window_actions'] == d['policy_excluded_events'] == 1
    assert result()['sample_size'] == 1
    assert 'url' not in d and 'user_id' not in d and 'properties' not in d


def test_stopped_default_actions_are_policy_excluded_not_window_or_orphan(bounded):
    db, clock = bounded
    assert client.patch(f'{BASE}/experiments/a-one', json={'conversion_window_seconds': None}).status_code == 200
    launch(db)
    ctx = exposure_context()
    assert capture(event(ctx)).status_code == 202
    transition(db, 'paused', '2026-10-01T10:30:00.000Z')
    clock['receipt'] = '2026-10-01T12:00:00+00:00'
    assert capture(event(ctx, 'conversion', 'purchase', 'paused', '2026-10-01T11:00:00Z')).status_code == 202
    d = diagnose().json()['diagnostics']
    assert d['actions'] == d['policy_excluded_events'] == 1
    assert d['unmatched_actions'] == d['outside_window_actions'] == 0


def test_diagnostics_never_freeze_and_use_existing_snapshot_after_raw_cleanup(bounded):
    db, clock = bounded
    launch(db)
    ctx = exposure_context()
    assert capture(event(ctx)).status_code == 202
    assert capture(event(ctx, 'conversion', 'purchase', 'goal', '2026-10-01T10:01:00Z')).status_code == 202
    transition(db, 'completed', '2026-10-01T10:30:00.000Z')
    clock['db'] = '2026-10-03T00:00:00Z'
    changes = db.total_changes
    before = diagnose().json()['diagnostics']
    assert before['source'] == 'raw'
    assert db.total_changes == changes
    assert db.execute('SELECT count(*) FROM experiment_readout_snapshot').fetchone()[0] == 0
    frozen_result = result()
    assert frozen_result['readout_state'] == 'finalized'
    db.execute("DELETE FROM event_log WHERE project_id='a' AND experiment_id='a-one'")
    changes = db.total_changes
    d = diagnose().json()['diagnostics']
    assert d == {**before, 'source': 'snapshot'}
    assert db.total_changes == changes
    assert result() == frozen_result


@pytest.mark.parametrize('experiment,project_id', [('b-one', 'a'), ('a-one', 'b'), ('missing', 'a'), ("a-one' OR 1=1--", 'a')])
def test_cross_project_and_unknown_experiment_are_not_disclosed(bounded, experiment, project_id):
    assert diagnose(experiment, project_id).status_code == 404


def test_unsupported_historical_experiment_is_explicit(project):
    response = diagnose()
    assert response.status_code == 200
    d = response.json()['diagnostics']
    assert d['supported'] is False and d['source'] == 'unsupported'


def test_existing_long_experiment_ids_remain_selectable(bounded):
    db, _ = bounded
    identifier = 'experiment-' + 'x' * 210
    # Creation now validates 3–80 character slugs, but the persisted schema has
    # no such limit. Diagnostics must not add restrictions to existing/imported ids.
    db.execute("""INSERT INTO experiments(id,name,event_model,project_id,flag_key,primary_metric,created_at,updated_at)
        VALUES (?, 'Existing long identifier', 'sdk_v1', 'a', 'flag-a', 'purchase',
        '2026-10-01', '2026-10-01')""", [identifier])
    response = diagnose(identifier)
    assert response.status_code == 200, response.text
    assert response.json()['diagnostics']['experiment_id'] == identifier


def test_storage_error_is_not_no_data(bounded, monkeypatch):
    async def fail(*args, **kwargs):
        raise HTTPException(503, 'Storage unavailable')
    monkeypatch.setattr('app.db.d1.security_query', fail)
    assert diagnose().status_code == 503
    assert client.get(f'{BASE}/projects/a/sdk-status').status_code == 503


def test_corrupt_history_fails_closed(bounded):
    db, _ = bounded
    launch(db)
    db.execute("UPDATE experiment_status_history SET from_status='completed' WHERE experiment_id='a-one' AND to_status='running'")
    assert diagnose().status_code == 503


def test_unsealed_snapshot_fails_closed(bounded):
    db, clock = bounded
    launch(db)
    transition(db, 'completed', '2026-10-01T10:30:00.000Z')
    clock['db'] = '2026-10-03T00:00:00Z'
    result()
    db.execute('DROP TRIGGER immutable_readout_snapshot')
    db.execute("UPDATE experiment_readout_snapshot SET input_sealed=0 WHERE experiment_id='a-one'")
    assert diagnose().status_code == 503


def test_large_input_returns_only_aggregate_counts(bounded):
    import json
    db, _ = bounded
    launch(db)
    records = []
    for i in range(3000):
        for kind, name, at in [('exposure', 'exp_exposure', '10:00:00'), ('conversion', 'purchase', '10:01:00')]:
            props = json.dumps({'event_model': 'sdk_v1', 'sdk_event_type': kind,
                'assignment_id': f'a-{i}', 'impression_id': f'i-{i}', 'sdk_exposure_eligible': 1,
                'sdk_active_period_eligible': 1, 'sdk_bounded_eligible': 1})
            records.append((f'user-{i}', name, f'2026-10-01T{at}.000000+00:00', props))
    db.executemany("""INSERT INTO event_log(user_id,event_name,event_time,properties,experiment_id,
        project_id,variant,session_id,created_at) VALUES (?,?,?,?,'a-one','a','control','session',
        '2026-10-01T10:10:00.000000+00:00')""", records)
    response = diagnose()
    assert response.status_code == 200, response.text
    d = response.json()['diagnostics']
    assert d['exposures'] == d['included_exposures'] == d['actions'] == d['included_actions'] == d['goal_actions'] == 3000
    assert d['unmatched_actions'] == d['outside_window_actions'] == d['policy_excluded_events'] == 0
    assert len(response.content) < 2000
