from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo
import os

import httpx
from fastapi import APIRouter, Query

from app.db import d1

router = APIRouter()
KST = ZoneInfo("Asia/Seoul")
CACHE_TTL_SECONDS = 60
_CACHE: dict[str, tuple[datetime, dict[str, Any]]] = {}


async def _d1_query(sql: str, database_id: str | None = None) -> list[dict[str, Any]]:
    return await d1.query(sql, database_id=database_id)


def _cache_get(key: str) -> dict[str, Any] | None:
    row = _CACHE.get(key)
    if not row:
        return None
    ts, payload = row
    if (datetime.now(KST) - ts).total_seconds() > CACHE_TTL_SECONDS:
        _CACHE.pop(key, None)
        return None
    return payload


def _cache_set(key: str, payload: dict[str, Any]) -> None:
    _CACHE[key] = (datetime.now(KST), payload)


def _to_datetime(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=KST)
    if isinstance(value, str):
        s = value.strip()
        if not s:
            return None
        if s.endswith("Z"):
            s = s.replace("Z", "+00:00")
        try:
            dt = datetime.fromisoformat(s)
            return dt if dt.tzinfo else dt.replace(tzinfo=KST)
        except ValueError:
            return None
    return None


def _pick_datetime(row: dict[str, Any], keys: list[str]) -> datetime | None:
    for key in keys:
        if key in row:
            dt = _to_datetime(row.get(key))
            if dt is not None:
                return dt.astimezone(KST)
    return None


async def _fetch_rows(table: str, window_days: int, database_id: str | None = None) -> list[dict[str, Any]]:
    """Fetch rows from Cloudflare D1 with column existence check to avoid 400 errors."""
    start_dt = datetime.now(KST) - timedelta(days=window_days + 2)
    start_day = start_dt.date().isoformat()

    # Get available columns for the table
    cols_info = await _d1_query(f"PRAGMA table_info('{table}');", database_id=database_id)
    available_cols = {row['name'] for row in cols_info}
    
    # Priority order for timestamp columns
    possible_ts_cols = ["base_date", "timestamp", "created_at", "event_ts", "occurred_at"]
    
    for ts_col in possible_ts_cols:
        if ts_col in available_cols:
            sql = (
                f'SELECT * FROM "{table}" '
                f"WHERE {ts_col} >= '{start_day}' 'ORDER BY' {ts_col} DESC LIMIT 10000;"
            )
            # Re-check: D1 sometimes fails with PRAGMA or has specific SQL constraints. 
            # Simple fallback if query fails.
            try:
                rows = await _d1_query(
                    f'SELECT * FROM "{table}" WHERE {ts_col} >= \'{start_day}\' ORDER BY {ts_col} DESC LIMIT 10000;',
                    database_id=database_id
                )
                if rows:
                    return rows
            except Exception:
                continue

    return []


def _calc_daily_counts(rows: list[dict[str, Any]], day_keys: list[str], ts_keys: list[str]) -> dict[str, int]:
    counter = Counter({k: 0 for k in day_keys})
    day_set = set(day_keys)
    for row in rows:
        dt = _pick_datetime(row, ts_keys)
        if dt is None:
            continue
        day = dt.date().isoformat()
        if day in day_set:
            counter[day] += 1
    return counter


@router.get('/github/overview')
async def get_github_overview(window: str = Query('30d', pattern='^(7d|30d)$')):
    cache_key = f"github:{window}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    now = datetime.now(KST)
    days = 30 if window == '30d' else 7
    start = now - timedelta(days=days - 1)
    day_keys = [(start + timedelta(days=i)).date().isoformat() for i in range(days)]

    main_db_id = os.getenv("D1_MAIN_DATABASE_ID")
    push_rows = await _fetch_rows('dl_push_events', days, database_id=main_db_id)
    pr_rows = await _fetch_rows('dl_pull_request_events', days, database_id=main_db_id)
    review_rows = await _fetch_rows('dl_pull_request_review_events', days, database_id=main_db_id)
    issue_comment_rows = await _fetch_rows('dl_issue_comment_events', days, database_id=main_db_id)

    push_daily = _calc_daily_counts(push_rows, day_keys, ['base_date', 'timestamp', 'created_at'])
    pr_daily = _calc_daily_counts(pr_rows, day_keys, ['base_date', 'timestamp', 'created_at'])
    review_daily = _calc_daily_counts(review_rows, day_keys, ['base_date', 'timestamp', 'created_at'])
    issue_comment_daily = _calc_daily_counts(issue_comment_rows, day_keys, ['base_date', 'timestamp', 'created_at'])

    opened_window = 0
    merged_window = 0
    repo_counter: Counter[str] = Counter()
    contributor_set: set[str] = set()

    for row in pr_rows:
        action = str(row.get('pr_action') or row.get('action') or '').lower()
        is_merged = bool(row.get('is_merged')) or action == 'merged'
        if action == 'opened':
            opened_window += 1
        if is_merged:
            merged_window += 1

        repo_name = row.get('repo_name') or row.get('repository') or row.get('repo')
        if repo_name:
            repo_counter[str(repo_name)] += 1

        actor = row.get('actor') or row.get('author') or row.get('user_login') or row.get('username')
        if actor:
            contributor_set.add(str(actor))

    total_core_events = sum(push_daily.values()) + sum(pr_daily.values()) + sum(review_daily.values()) + sum(issue_comment_daily.values())

    timeseries = []
    for day in day_keys:
        opened_d = 0
        merged_d = 0
        for row in pr_rows:
            dt = _pick_datetime(row, ['base_date', 'timestamp', 'created_at'])
            if dt is None or dt.date().isoformat() != day:
                continue
            action = str(row.get('pr_action') or row.get('action') or '').lower()
            is_merged = bool(row.get('is_merged')) or action == 'merged'
            if action == 'opened':
                opened_d += 1
            if is_merged:
                merged_d += 1

        events = push_daily[day] + pr_daily[day] + review_daily[day] + issue_comment_daily[day]
        timeseries.append({
            'date': day,
            'events': events,
            'merge_rate': (min(1.0, merged_d / opened_d)) if opened_d > 0 else None,
        })

    repo_total = sum(repo_counter.values())
    top_repos = [
        {
            'repo_name': name,
            'events': count,
            'ratio': (count / repo_total) if repo_total > 0 else 0,
        }
        for name, count in repo_counter.most_common(10)
    ]

    payload = {
        'generated_at': now.isoformat(),
        'window': {'from': day_keys[0], 'to': day_keys[-1], 'timezone': 'Asia/Seoul'},
        'summary': {
            'push_events': sum(push_daily.values()),
            'pr_opened': opened_window,
            'pr_merged': merged_window,
            'issue_comments': sum(issue_comment_daily.values()),
            'pr_reviews': sum(review_daily.values()),
            # Backward-compatible key name; value now follows selected window (7d/30d).
            'merge_rate_28d': (min(1.0, merged_window / opened_window)) if opened_window > 0 else None,
            'total_core_events': total_core_events,
            'active_contributors': len(contributor_set),
        },
        'timeseries': timeseries,
        'top_repos': top_repos,
    }
    _cache_set(cache_key, payload)
    return payload


@router.get('/discord/overview')
async def get_discord_overview(window: str = Query('30d', pattern='^(7d|30d)$')):
    cache_key = f"discord:{window}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    now = datetime.now(KST)
    days = 30 if window == '30d' else 7
    start = now - timedelta(days=days - 1)
    day_keys = [(start + timedelta(days=i)).date().isoformat() for i in range(days)]

    main_db_id = os.getenv("D1_MAIN_DATABASE_ID")
    rows = await _fetch_rows('discord_messages', days, database_id=main_db_id)
    daily = _calc_daily_counts(rows, day_keys, ['timestamp', 'created_at', 'base_date'])

    author_counter: Counter[str] = Counter()
    channel_counter: Counter[str] = Counter()

    for row in rows:
        author = (
            row.get('nickname')
            or row.get('global_name')
            or row.get('author_nickname')
            or row.get('author_global_name')
            or row.get('author_username')
            or row.get('author')
            or row.get('username')
            or row.get('author_id')
        )
        channel_name = row.get('channel_name')

        if author:
            author_counter[str(author)] += 1

        # 정책: channel_id fallback 없이 channel_name만 사용
        if channel_name and str(channel_name).strip():
            channel_counter[str(channel_name).strip()] += 1

    payload = {
        'generated_at': now.isoformat(),
        'window': {'from': day_keys[0], 'to': day_keys[-1], 'timezone': 'Asia/Seoul'},
        'summary': {
            'message_count': sum(daily.values()),
            'active_authors': len(author_counter),
            'active_channels': len(channel_counter),
        },
        'timeseries': [{'date': day, 'messages': daily[day]} for day in day_keys],
        'top_channels': [
            {'channel': name, 'messages': count}
            for name, count in channel_counter.most_common(10)
        ],
        'top_authors': [
            {'author': name, 'messages': count}
            for name, count in author_counter.most_common(10)
        ],
    }
    _cache_set(cache_key, payload)
    return payload


@router.get('/overview')
async def get_dashboard_overview(window: str = Query('30d', pattern='^(7d|30d)$')):
    cache_key = f"overview:{window}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    now = datetime.now(KST)
    days = 30 if window == '30d' else 7
    start = now - timedelta(days=days - 1)
    day_keys = [(start + timedelta(days=i)).date().isoformat() for i in range(days)]

    from app.services.experiment import experiment_service
    experiments = await experiment_service.get_all()
    active_count = sum(1 for e in experiments if e.status == 'running' or getattr(e.status, 'value', None) == 'running')

    github = await get_github_overview(window)
    discord = await get_discord_overview(window)

    # timeseries by same day spine, no synthetic copy between domains.
    gh_by_day = {row['date']: row for row in github['timeseries']}
    dc_by_day = {row['date']: row for row in discord['timeseries']}

    timeseries = []
    for day in day_keys:
        gh = gh_by_day.get(day, {'events': 0, 'merge_rate': None})
        dc = dc_by_day.get(day, {'messages': 0})
        timeseries.append({
            'date': day,
            'core_activity': gh['events'],
            'communication': dc['messages'],
            'merge_rate': gh['merge_rate'],
            'is_partial_period': False,
        })

    latest_ts: datetime | None = None
    for group in (github['timeseries'], discord['timeseries']):
        for row in group:
            # only days with events/messages contribute freshness anchor.
            if row.get('events', 0) == 0 and row.get('messages', 0) == 0:
                continue
            dt = _to_datetime(f"{row['date']}T23:59:59+09:00")
            if dt and (latest_ts is None or dt > latest_ts):
                latest_ts = dt

    freshness_h = (now - latest_ts).total_seconds() / 3600 if latest_ts else None
    if freshness_h is not None:
        freshness_h = max(0.0, freshness_h)

    total_repo_events = sum(item['events'] for item in github['top_repos'])
    top3_sum = sum(item['events'] for item in github['top_repos'][:3])

    covered_domains = 0
    if github['summary']['total_core_events'] > 0:
        covered_domains += 1
    if discord['summary']['message_count'] > 0:
        covered_domains += 1

    missing_days = sum(1 for row in timeseries if row['core_activity'] == 0 and row['communication'] == 0)

    payload = {
        'generated_at': now.isoformat(),
        'window': {'from': day_keys[0], 'to': day_keys[-1], 'timezone': 'Asia/Seoul'},
        'summary': {
            'active_projects_count': active_count,
            'weekly_active_contributors': github['summary']['active_contributors'] + discord['summary']['active_authors'],
            'weekly_collab_events': github['summary']['total_core_events'] + discord['summary']['message_count'],
            'pr_merge_rate_28d': github['summary']['merge_rate_28d'],
            'pipeline_freshness_hours': round(freshness_h, 1) if freshness_h is not None else 0,
        },
        'timeseries': timeseries,
        'distribution': {
            'top_repos_by_activity': github['top_repos'],
            'activity_concentration_top3': (top3_sum / total_repo_events) if total_repo_events > 0 else 0,
        },
        'health': {
            'coverage_score': covered_domains / 2,
            'missing_day_ratio_30d': missing_days / days,
            'schema_violation_count': 0,
        },
        'alerts': [],
    }
    _cache_set(cache_key, payload)
    return payload
