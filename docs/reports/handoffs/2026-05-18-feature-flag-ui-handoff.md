Status: active
Last-Validated: 2026-05-18
Owner: experiment-lab

# Handoff: Feature Flag UI Continuation

## Task Metadata
- Task ID: feature-flag-ui-continuation
- Date: 2026-05-18
- Owner: next frontend/backend agent

## Scope
- In scope: Continue Feature Flag work from the backend MVP into operator-facing UI.
- Out of scope: Rework experiment analysis/statistics engine, add RBAC, or change production deployment topology unless explicitly requested.

## Workspace
- Worktree path: `/home/ubuntu/.openclaw/workspace-experiment`
- Branch: `main`
- Base: `origin/main`
- Related commit: `a655f51 feat(feature-flags): add query-backed segments`

## Inputs Used
- `AGENTS.md`
- `docs/reports/_index.md`
- `docs/guides/experiment_platform_concepts.md`
- `docs/reports/feature-flag-improvement-plan.md`
- `docs/guides/data_access.md`

## Current State
- Feature flag backend supports CRUD, enable/disable, archive/restore, decide, rollout, exposure logging, exposure summary, rules, segments, and rule-based decide.
- Segment backend supports manual segments and allowlisted query-backed segments.
- Current query templates:
- `project_members`
- `discord_active_users`
- `GET /api/v1/segments/query-templates` exposes template metadata.
- `D1_MAIN_DATABASE_ID` is required for query-backed segment refresh.
- Frontend currently has a Feature Flags list page with exposure summary and archive/restore.
- Frontend does not yet have `/segments`, segment member inspection, flag detail page, or rule builder UI.

## Operational Snapshot
- Required D1 environment variable names were present in local `.env`.
- `pseudolab-exp` contains:
- `feature_flag`: 7 rows
- `feature_segment`: 0 rows
- `feature_flag_rule`: 4 rows
- `feature_flag_exposure`: 361 rows
- `pseudolab-main` contains:
- `dl_project_members`: 9,121 rows / 213 distinct users
- `discord_messages`: 7,367 rows / 11 active users in 30 days / 8 active users in 7 days
- No dangling rules were found.
- `discord_messages` does not currently expose an `is_bot` column, so `discord_active_users` cannot exclude bot accounts yet.

## Changes Already Committed
- Query-backed segment implementation and tests.
- Segment query template API and frontend API client.
- Beginner-friendly experiment platform concept guide.
- Feature flag improvement plan updated with operational D1 snapshot.

## Validation Already Run
- `cd backend && ./venv/bin/pytest`
- Result: `117 passed`, 5 warnings.
- `cd frontend && npm run build`
- Result: passed, existing Vite large chunk warning remains.
- `git diff --check`
- Result: passed before and after docs updates.

## Recommended Next Work
1. Add `/segments` route and sidebar entry.
2. Build `Segments.tsx`:
   - query template list
   - segment list
   - manual segment create
   - query-backed segment create
   - refresh action
   - member count and member preview
   - loading/error/empty/success states
3. Add `Segments.test.tsx`:
   - renders templates
   - creates query segment
   - refreshes segment
   - renders member preview
   - handles refresh failure
4. Add Feature Flag detail or inline rule management:
   - list rules per flag
   - create rule with segment selection
   - edit priority, rollout, variant, enabled, window
5. Add frontend tests for rule builder.
6. Re-run backend tests, frontend tests, and frontend build.

## Risks
- Current feature flag page is a broad table and may become crowded if rules are added inline. A flag detail route may be cleaner.
- Rule API exists, but no UI currently prevents risky rollout settings beyond archive/restore confirmation.
- Segment refresh can fail if source D1 schema changes or `D1_MAIN_DATABASE_ID` is missing.
- Discord active user segments currently include all authors because bot identification is not present in D1.

## Next Owner
- Owner: Frontend owner first, backend owner only if API gaps appear.
- Expected next action: Implement `/segments` management UI with tests, then proceed to rule builder UI.
