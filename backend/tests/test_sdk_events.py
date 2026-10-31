"""Exercise real routes, persisted rows and both readouts with SQLite, no remote writes."""
import copy
import json
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
BASE = '/api/v1'


@pytest.fixture
def project(mock_d1):
    for project_id in ('a', 'b'):
        mock_d1.execute('INSERT INTO projects (id, name, api_key) VALUES (?, ?, ?)',
                        (project_id, project_id, f'public-{project_id}'))
        mock_d1.execute("""INSERT INTO feature_flag (flag_key, project_id, enabled, rollout_pct, created_at, updated_at)
                           VALUES (?, ?, 1, 50, '2026-01-01', '2026-01-01')""", (f'flag-{project_id}', project_id))
        for suffix in ('one', 'two'):
            mock_d1.execute("""INSERT INTO experiments (id, name, project_id, flag_key, status, primary_metric,
                               guardrail_metrics, created_at, updated_at, event_model) VALUES (?, ?, ?, ?, 'running',
                               'purchase', '["retained"]', '2026-01-01', '2026-01-01', 'sdk_v1')""",
                            (f'{project_id}-{suffix}', suffix, project_id, f'flag-{project_id}'))
    mock_d1.commit()
    return mock_d1


def decide(user='u', exp='a-one', key='public-a'):
    return client.post(f'{BASE}/decide', headers={'x-api-key': key}, json={
        'key': 'flag-a', 'user_id': user, 'event_model': 'sdk_v1', 'experiment_id': exp,
    })


def event(context, kind='exposure', name='exp_exposure', event_id=None, time='2026-10-01T10:00:00Z'):
    return dict(user_id=context['user_id'], event_name=name,
                event_id=event_id or context['impression_id'], session_id=context['session_id'],
                experiment_id=context['experiment_id'], variant=context['variant'],
                tracking_context=context, sdk_event_type=kind, timestamp=time,
                properties={'variant': 'forged', 'experiment_id': 'b-one', 'url': '/checkout'})


def capture(payload, key='public-a'):
    return client.post(f'{BASE}/capture', headers={'x-api-key': key}, json=payload)


def exposure_context(user='u', exp='a-one'):
    response = decide(user, exp)
    assert response.status_code == 200, response.text
    return dict(response.json()['tracking_context'], impression_id=f'{exp}-{user}', session_id='tab')


def test_decide_does_not_log_and_context_is_stable(project):
    first = decide().json()['tracking_context']
    assert first == decide().json()['tracking_context']
    assert first['assignment_id'] != decide('different-user').json()['tracking_context']['assignment_id']
    assert first['assignment_id'] != decide(exp='a-two').json()['tracking_context']['assignment_id']
    for table in ('event_log', 'experiment_event', 'feature_flag_exposure', 'experiment_assignments'):
        assert project.execute(f'SELECT COUNT(*) FROM {table}').fetchone()[0] == 0
    assert decide(exp=None).status_code == 409  # no guessing between active experiments
    assert decide(exp='b-one').status_code == 422
    assert decide(key='public-b').status_code == 403
    assert decide(key='invalid').status_code == 401


def test_capture_is_idempotent_and_does_not_dual_write(project):
    ctx = exposure_context()
    payload = event(ctx)
    assert capture(payload).status_code == 202
    assert capture(payload).status_code == 202
    assert project.execute('SELECT COUNT(*) FROM event_log').fetchone()[0] == 1
    assert project.execute('SELECT COUNT(*) FROM experiment_event').fetchone()[0] == 0
    row = dict(project.execute('SELECT * FROM event_log').fetchone())
    props = json.loads(row['properties'])
    assert row['project_id'] == props['project_id'] == 'a'
    assert row['experiment_id'] == props['experiment_id'] == 'a-one'
    assert row['variant'] == props['variant'] == ctx['variant']
    assert props['impression_id'] == ctx['impression_id']
    assert capture(payload, 'public-b').status_code == 403
    for field, value in [('experiment_id', 'b-one'), ('user_id', 'other'), ('variant', 'other')]:
        bad = copy.deepcopy(payload)
        bad[field] = value
        assert capture(bad).status_code == 422
    bad = copy.deepcopy(payload)
    bad['tracking_context']['assignment_id'] = 'forged'
    assert capture(bad).status_code == 422
    bad = copy.deepcopy(payload)
    bad['tracking_context']['experiment_id'] = bad['experiment_id'] = 'b-one'
    assert capture(bad).status_code == 403
    assert capture({'user_id': 'u', 'event_name': 'purchase', 'properties': {'event_model': 'sdk_v1'}}).status_code == 422


def test_results_and_live_events_share_only_correlated_v1_cohort(project):
    # Find real deterministic flag assignments for both groups through the API.
    users = {}
    for i in range(100):
        ctx = exposure_context(f'u{i}')
        users.setdefault(ctx['variant'], ctx)
        if len(users) == 2:
            break
    assert set(users) == {'control', 'treatment'}
    for ctx in users.values():
        # Action before exposure, another impression, another experiment: never a success in A.
        assert capture(event(ctx, 'conversion', 'purchase', 'early-'+ctx['user_id'], '2026-10-01T09:00:00Z')).status_code == 202
        assert capture(event(ctx)).status_code == 202
        assert capture(event(ctx)).status_code == 202
        wrong = {**ctx, 'impression_id': 'unseen'}
        assert capture(event(wrong, 'conversion', 'purchase', 'unseen-'+ctx['user_id'])).status_code == 202
        other = exposure_context(ctx['user_id'], 'a-two')
        assert capture(event(other)).status_code == 202
        assert capture(event(other, 'conversion', 'purchase', 'other-'+ctx['user_id'])).status_code == 202
        assert capture(event(ctx, 'click', 'unrelated', 'click-'+ctx['user_id'])).status_code == 202
        # Historical capture and dual-written /events must not be added to v1.
        assert capture({'user_id': ctx['user_id'], 'event_name': 'purchase'}).status_code == 202
        assert client.post(f'{BASE}/events', json={'user_id': ctx['user_id'], 'type': 'conversion',
            'key': 'flag-a', 'variant': ctx['variant'], 'experiment_id': 'a-one'}).status_code == 202
    treatment = users['treatment']
    for i in range(2):  # two real actions on one impression still yield one metric success
        assert capture(event(treatment, 'conversion', 'purchase', f'purchase-{i}')).status_code == 202
    assert capture(event(treatment, 'click', 'retained', 'guardrail')).status_code == 202
    result = client.get(f'{BASE}/experiments/a-one/result').json()
    assert result['sample_size'] == 2
    assert result['control']['conversions'] == 0
    assert result['treatment']['conversions'] == 1
    assert result['guardrail_results'][0]['control_rate'] == 0
    assert result['guardrail_results'][0]['treatment_rate'] == 1
    live = client.get(f'{BASE}/experiments/a-one/analytics').json()
    assert live['impressions']['total'] == 2
    assert live['conversions']['total'] == 1
    assert live['conversions']['rate'] == {'control': 0, 'treatment': 1}
    available = client.get(f'{BASE}/experiments/a-one/available-events').json()
    assert available['conversion_events'] == ['purchase']
    assert available['has_impressions'] is True


def test_unexposed_actions_do_not_fall_back_to_legacy_denominator(project):
    ctx = exposure_context()
    assert capture(event(ctx, 'conversion', 'purchase', 'action')).status_code == 202
    assert capture({'user_id': 'legacy', 'event_name': 'exp_exposure',
                    'properties': {'experiment_id': 'a-one', 'variant': 'control'}}).status_code == 202
    assert client.get(f'{BASE}/experiments/a-one/result').json()['sample_size'] == 0
    live = client.get(f'{BASE}/experiments/a-one/analytics').json()
    assert live['impressions']['total'] == live['conversions']['total'] == 0


def test_out_of_order_delivery_is_reconciled_at_read_time(project):
    ctx = exposure_context()
    action = event(ctx, 'click', 'purchase', 'delayed-action', '2026-10-01T10:01:00Z')
    assert capture(action).status_code == 202
    assert client.get(f'{BASE}/experiments/a-one/analytics').json()['conversions']['total'] == 0
    # Older exposure arrives later; the original occurrence timestamp restores attribution.
    assert capture(event(ctx)).status_code == 202
    assert client.get(f'{BASE}/experiments/a-one/analytics').json()['conversions']['total'] == 1


def test_source_is_fixed_at_creation_and_empty_v1_never_uses_legacy(project):
    response = client.post(f'{BASE}/experiments/', json={
        'name': 'New SDK cohort', 'event_model': 'sdk_v1', 'project_id': 'a',
        'flag_key': 'flag-a', 'primary_metric': 'purchase',
    })
    assert response.status_code == 201, response.text
    exp = response.json()
    assert exp['event_model'] == 'sdk_v1'
    assert client.patch(f"{BASE}/experiments/{exp['id']}", json={'event_model': 'legacy'}).status_code == 422
    assert client.patch(f"{BASE}/experiments/{exp['id']}", json={'project_id': 'b'}).status_code == 422
    assert capture({'user_id': 'legacy', 'event_name': 'exp_exposure',
        'properties': {'experiment_id': exp['id'], 'variant': 'control'}}).status_code == 202
    assert client.get(f"{BASE}/experiments/{exp['id']}/result").json()['sample_size'] == 0
    assert client.get(f"{BASE}/experiments/{exp['id']}/analytics").json()['impressions']['total'] == 0
    legacy = client.post(f'{BASE}/experiments/', json={'name': 'Legacy default'}).json()
    assert legacy['event_model'] == 'legacy'
    assert client.post(f'{BASE}/experiments/', json={'name': 'Invalid', 'event_model': 'sdk_v1'}).status_code == 422
    assert client.post(f'{BASE}/experiments/', json={'name': 'Cross project', 'event_model': 'sdk_v1',
        'flag_key': 'flag-a', 'project_id': 'b'}).status_code == 422


def test_migration_preserves_existing_experiments_and_is_one_time():
    import sqlite3
    from pathlib import Path
    conn = sqlite3.connect(':memory:')
    conn.execute('CREATE TABLE experiments (id TEXT PRIMARY KEY)')
    conn.execute("INSERT INTO experiments VALUES ('historical')")
    migration = (Path(__file__).parents[1] / 'migrations/038_sdk_event_model.sql').read_text()
    conn.executescript(migration)
    assert conn.execute('SELECT * FROM experiments').fetchall() == [('historical', 'legacy')]
    with pytest.raises(sqlite3.IntegrityError):
        conn.execute("INSERT INTO experiments VALUES ('bad', 'unknown')")
    with pytest.raises(sqlite3.OperationalError, match='duplicate column'):
        conn.executescript(migration)
    conn.close()


def test_srm_uses_fixed_v1_source_and_ignores_legacy_imbalance(project):
    import asyncio
    from app.services.srm_monitor import srm_monitor
    ctx = exposure_context()
    assert capture(event(ctx)).status_code == 202
    for i in range(100):
        project.execute("""INSERT INTO event_log(user_id, event_name, properties, event_time, created_at)
                           VALUES (?, 'exp_exposure', ?, '2026-01-01', '2026-01-01')""",
                        (f'legacy-{i}', json.dumps({'experiment_id': 'a-one', 'variant': 'other'})))
    project.commit()
    assert asyncio.run(srm_monitor._check_srm('a-one')) is False


def test_explicit_context_is_required_and_batch_uses_same_validation(project):
    ctx = exposure_context()
    response = client.post(f'{BASE}/ingest/events', headers={'x-api-key': 'public-a'},
                           json={'events': [event(ctx), event(ctx)]})
    assert response.status_code == 202
    assert project.execute('SELECT COUNT(*) FROM event_log').fetchone()[0] == 1
    assert client.post(f'{BASE}/ingest/events', headers={'x-api-key': 'public-b'},
                       json={'events': [event(ctx)]}).status_code == 403


def test_repeated_exposures_keep_user_and_instance_denominators_distinct(project):
    ctx = exposure_context()
    for i in range(2):
        view = {**ctx, 'impression_id': f'view-{i}'}
        assert capture(event(view)).status_code == 202
        assert capture(event(view, 'conversion', 'purchase', f'buy-{i}')).status_code == 202
    result = client.get(f'{BASE}/experiments/a-one/result').json()
    live = client.get(f'{BASE}/experiments/a-one/analytics').json()
    assert result['sample_size'] == 1
    assert live['impressions']['total'] == live['conversions']['total'] == 2


def test_missing_public_key_cannot_capture_project_context(project):
    ctx = exposure_context()
    assert client.post(f'{BASE}/capture', json=event(ctx)).status_code == 403
    assert client.post(f'{BASE}/decide', json={'key': 'flag-a', 'user_id': 'u',
        'event_model': 'sdk_v1', 'experiment_id': 'a-one'}).status_code == 403


def test_live_repeated_views_never_claim_independent_samples_or_false_srm(project):
    users = {}
    for i in range(100):
        ctx = exposure_context(f'repeat-{i}')
        users.setdefault(ctx['variant'], ctx)
        if len(users) == 2:
            break
    for variant, ctx in users.items():
        for i in range(100):
            view = {**ctx, 'impression_id': f'{variant}-{i}'}
            assert capture(event(view)).status_code == 202
            if variant == 'treatment':
                assert capture(event(view, 'conversion', 'purchase', f'buy-{i}')).status_code == 202
    live = client.get(f'{BASE}/experiments/a-one/analytics').json()
    assert live['impressions']['total'] == 200
    assert live['conversions']['total'] == 100
    assert client.get(f'{BASE}/experiments/a-one/result').json()['sample_size'] == 2
    assert live['statistical_significance']['is_significant'] is False
    assert live['statistical_significance']['p_value'] is None
    assert live['statistical_significance']['winner'] is None
    # Unequal repeat rates do not imply unequal assignment: still one user in each arm.
    for i in range(100):
        assert capture(event({**users['control'], 'impression_id': f'extra-{i}'})).status_code == 202
    assert client.get(f'{BASE}/experiments/a-one/analytics').json()['srm_warning'] is False


def test_live_srm_excludes_multivariant_users_like_result_and_batch(project):
    import asyncio
    from app.services.srm_monitor import srm_monitor
    for rollout in (0, 100):
        project.execute('UPDATE feature_flag SET rollout_pct = ? WHERE flag_key = ?', (rollout, 'flag-a'))
        project.commit()
        ctx = exposure_context('changed-assignment')
        for i in range(1 if rollout == 0 else 100):
            assert capture(event({**ctx, 'impression_id': f'{rollout}-{i}'})).status_code == 202
    assert client.get(f'{BASE}/experiments/a-one/result').json()['sample_size'] == 0
    live = client.get(f'{BASE}/experiments/a-one/analytics').json()
    assert live['impressions']['total'] == 101  # retained diagnostic views
    assert live['srm_warning'] is False
    assert asyncio.run(srm_monitor._check_srm('a-one')) is False
