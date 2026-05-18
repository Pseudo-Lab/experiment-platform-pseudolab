Status: active
Last-Validated: 2026-05-18
Owner: experiment-lab

# Handoff: Segments UI Agent Work

## Task Metadata
- Task ID: segments-ui-agent-work
- Date: 2026-05-18
- Owner: next frontend agent
- Mode recommendation: single frontend agent first; team agent mode only if rule builder and analysis readout are included in the same pass

## Scope
- In scope: Implement operator-facing `/segments` management UI and tests.
- In scope: Add route/sidebar entry, segment list, query template list, segment creation, refresh, member preview, loading/error/empty/success states.
- Out of scope: Backend schema changes, production D1 mutation outside existing API, RBAC, experiment statistics engine, raw Supabase access.
- Out of scope for first agent: Feature Flag rule builder, flag detail route, experiment result readout. These can follow after `/segments` UI lands.

## Workspace
- Worktree path: `/home/ubuntu/.openclaw/workspace-experiment`
- Branch: `main`
- Base: `origin/main`
- Current local state: `main` is ahead of `origin/main` by 4 commits.
- Current local commits:
  - `12446cc feat(feature-flags): add query-backed segments`
  - `a4b27ac docs(agents): add collaboration workflow`
  - `b30c2dd docs(agents): tailor workflow to experiment platform`
  - `f0a8a78 docs(agents): add experiment analyst role`
- Safety branch before commit retime: `backup/retime-before-20260518`

## Required Reading
1. `AGENTS.md`
2. `docs/reports/_index.md`
3. `docs/guides/agent_collaboration.md`
4. `docs/guides/design_system.md`
5. `docs/guides/experiment_platform_concepts.md`
6. `docs/reports/feature-flag-improvement-plan.md`
7. `docs/reports/handoffs/2026-05-18-feature-flag-ui-handoff.md`

## Current Backend/API State
- Backend already supports manual and query-backed segments.
- Existing API client methods are in `frontend/src/services/api.ts`:
  - `segmentApi.queryTemplates()`
  - `segmentApi.list()`
  - `segmentApi.create(data)`
  - `segmentApi.refresh(segmentId, data?)`
  - `segmentApi.members(segmentId, limit?)`
- Existing segment types are in `frontend/src/services/api.ts`:
  - `Segment`
  - `SegmentCreate`
  - `SegmentMember`
  - `SegmentRefreshResponse`
  - `SegmentQueryTemplate`
- Query templates currently expected:
  - `project_members`
  - `discord_active_users`
- `D1_MAIN_DATABASE_ID` is required for query-backed refresh. If missing, refresh should surface an error rather than silently showing an empty segment.
- `discord_active_users` cannot currently exclude bots because `discord_messages` does not expose an `is_bot` column.

## Frontend Files To Own
- `frontend/src/features/dashboard/components/Segments.tsx`
- `frontend/src/__tests__/Segments.test.tsx`
- `frontend/src/App.tsx`
- `frontend/src/layouts/MainLayout.tsx`
- Optional only if needed: `frontend/src/services/api.ts`

Do not edit backend files unless an API contract gap is discovered and documented.

## Suggested Implementation Plan
1. Add `Segments.tsx`.
2. Add `/segments` route in `frontend/src/App.tsx`.
3. Add sidebar item in `frontend/src/layouts/MainLayout.tsx`.
4. Load query templates and segment list on page load.
5. Show template cards with description and rules schema summary.
6. Support manual segment creation:
   - `id`
   - `name`
   - `description`
   - multiline `user_ids`
7. Support query-backed segment creation:
   - `id`
   - `name`
   - `description`
   - `query_name`
   - `rules_json`
8. Support segment refresh:
   - manual segment refresh can pass user IDs if entered for refresh.
   - query segment refresh should pass rules from `rules_json` only if needed by UI.
9. Support member preview:
   - fetch `segmentApi.members(segment.id, 20)` on demand.
   - show user id, reason, refreshed_at.
10. Show clear states:
   - loading while templates/segments load
   - empty when no segments exist
   - error when list/create/refresh/member preview fails
   - success after create/refresh

## UI/UX Requirements
- Follow existing dashboard/shadcn style used by `FeatureFlags.tsx`.
- Keep KO/EN strings together in the component translation object.
- Avoid raw SQL input. The UI should only expose allowlisted `query_name` and JSON rules.
- For `discord_active_users`, show a small warning that bot exclusion is not currently available.
- For query segment refresh failure, show a message that source D1/env/schema may be missing. Do not expose secrets.
- Do not present query-backed segment refresh as real-time. It creates a snapshot.

## Test Requirements
Add `frontend/src/__tests__/Segments.test.tsx`.

Minimum cases:
1. renders loading then query templates and empty segment state
2. creates a manual segment with user IDs
3. creates a query-backed segment from `project_members`
4. refreshes a segment and shows refreshed count
5. loads and displays member preview
6. handles refresh failure with an operator-visible error
7. verifies KO/EN route text or key labels if the test setup already covers language behavior

Use existing test style from:
- `frontend/src/__tests__/FeatureFlags.test.tsx`
- `frontend/src/__tests__/Dashboard.test.tsx`
- `frontend/src/__tests__/MainLayout.test.tsx`

## Validation Commands
Frontend:

```bash
cd frontend
npm test -- --run
npm run build
```

Docs/process sanity if handoff is updated:

```bash
git diff --check
```

Backend tests are not required if no backend files are changed. If backend files are changed:

```bash
cd backend
./venv/bin/pytest
```

## Team Agent Split If Needed
Use team agent mode only if the task expands beyond `/segments`.

Recommended split:
- Agent A, Segment UI owner: `Segments.tsx`, `Segments.test.tsx`, `/segments` route/sidebar.
- Agent B, Rule Builder owner: `FeatureFlags.tsx` or a new flag detail/rule component, related tests.
- Agent C, Experiment Analyst owner: metric/segment/exposure quality notes only under `docs/reports/**`; no code ownership.

Each agent should use a separate worktree and avoid editing the same files.

## Risks
- `FeatureFlags.tsx` is already broad; avoid adding rule builder inline during the first `/segments` pass.
- Segment refresh can fail because `D1_MAIN_DATABASE_ID` is missing or source D1 schema changed.
- `rules_json` is typed as string in the frontend API client. Validate JSON before submit to avoid sending invalid payloads.
- Manual segment creation and refresh must not allow accidental empty user list to look successful unless backend explicitly returns success.
- Member preview may return empty for newly created query segments until refresh is run.

## Done Criteria
- `/segments` route is reachable from the sidebar.
- Operator can see query templates.
- Operator can create manual and query-backed segments.
- Operator can refresh a segment and inspect members.
- Loading/error/empty/success states are covered in UI and tests.
- `npm test -- --run`, `npm run build`, and `git diff --check` pass.

## Next Owner
- Owner: Frontend Dashboard agent
- Expected next action: Implement `/segments` UI using existing segment API client, then hand off to rule builder work.
