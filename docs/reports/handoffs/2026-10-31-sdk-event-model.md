Status: active
Task: GitHub #20
Owner: SDK event-model worker / experiment-lead review
Date: 2026-10-31

# SDK v1 event model — local review candidate

## Scope and workspace

Goal: separate evaluation/visibility/action and make explicit attribution use one persisted source.
Scope: SDK core/types, public decide/capture validation, new A/B readout selection, tests and SDK guide. Includes the explicitly authorized ExampleApp Provider compatibility setting and its regression test. No new React helper, UI redesign, reflection/LVUP patch, authentication, credentials or deployment changes.
Done checks: API persistence/readout tests, SDK contract tests/build, frontend regression/build, local stub Chromium smoke.

- Worktree: `/home/ubuntu/.openclaw/workspace-experiment-sdk-events`
- Branch: `fix/sdk-event-model`
- Base: `c6ad310f1929a29fbe5d5a5309a060740ca60a4d` (fetched origin/main at start).
- All changes are **uncommitted**. No push, PR/issue mutation, operational migration, remote data write or deployment.
- Root main and other worktrees were not edited/stashed/reset. Existing conversion-scope reproduction tests were read only.
- Inputs: AGENTS.md, reports index/decision log, collaboration guide/template, GitHub issue #20, PR #26 diff and its Google OAuth handoff. Session collaboration used `codex-session-control` / `codex-message`; no subagents or agy were used.

## Acceptance mapping

| #20 acceptance | Candidate and evidence |
|---|---|
| Decide does not save exposure | SDK sends `track:false,event_model:sdk_v1`; server v1 bypasses feature-flag exposure/assignment side effects. API test asserts all four event/assignment tables empty; SDK and browser assert only decide request |
| Expose API | `sdk.expose(decision)` returns ExposureContext. Same decision object keeps the same impression ID/time, explicit new ID starts another instance. Control visibility is countable; hidden placement/fallback cannot fabricate attribution |
| track attribution | Third options argument supplies `tracking_context`; context identity wins over arbitrary properties. Server checks project key, flag/project/experiment relation, source and deterministic assignment identity |
| Shared impression | Exposure/click/conversion share context; action has a separate event ID. Exposure/action retries deduplicate through existing event_log unique event_id; contextual event IDs include project/user namespace |
| Session/assignment meaning | Types and README distinguish tab session, evaluation tuple identity, visible instance and delivery event; identify after exposure does not reassign it |
| Sources/results/dashboard | New immutable `experiments.event_model` explicitly selects legacy vs sdk_v1. Results/guardrails, Live Events, available-events and SRM read v1 event_log only when configured; no data-triggered switch or mixed source sum |
| Usage guide | SDK README replaces incorrect automatic impression and user-ID claims, gives create/decide/expose/track/retry/cutover examples and legacy/React limits |

## Implementation and policy decisions

- `schemas/sdk.py`, `endpoints/sdk.py`: optional v1 request and context response. Only running v1 A/B experiments with matching flag/project are resolved. Multiple active matches require explicit experiment ID. Stable assignment UUID identifies project/experiment/key/user/variant; it is not a signed credential or a sticky-assignment guarantee.
- `schemas/event.py`, `services/event.py`: typed explicit context; mirror normalized attribution in top-level columns/properties; reserved exposure event semantics; v1 timestamps normalized to UTC. `/capture` and batch use the same validation. Legacy capture/events and anonymous user inputs retain existing server contracts.
- `services/sdk_events.py`: shared read SQL for v1 rows and correlated actions. An action must match experiment/project/user/variant/session/assignment/impression and an earlier-or-equal occurrence-time exposure. Late delivery is reconciled on each read. Unmatched actions remain raw diagnostic rows.
- `services/experiment.py`, `experiment_analytics.py`, `srm_monitor.py`: fixed source selection. Result/guardrail/SRM use unique exposed users; multivariant users are excluded from result/SRM. Live Events counts visible instances and at most one primary-metric success per instance; available-events lists raw rows. A single observed variant yields an incomplete result with the true unique-user sample size, avoiding the legacy self-comparison/double sample path.
- `schemas/experiment.py`: event_model is chosen only on create; updates explicitly reject it. v1 requires A/B + flag with matching project; subsequent experiment flag/project/type changes are rejected to preserve attribution identity. Existing UI keeps legacy default; API creation is documented.
- `packages/sdk`: no automatic exposure by default; opt-in `autoExpose` counts evaluations as v1 exposures only. Default v1 event writes use capture. Explicit eventModel=legacy preserves old decide/track mirrors for the bundled example; v1 exposes/context cannot be sent through legacy mode. See the review correction below. No published version bump/release was performed.

The coordinator rejected automatic switching on the first v1 row and accepted a minimal immutable field on new experiments. ID-less legacy conversion inclusion/exclusion remains a separate unresolved policy; `_users_with_event` legacy logic is untouched. This candidate fixes explicit v1 cross-experiment attribution, not that separate historical issue.

## Migration and recovery

`backend/migrations/038_sdk_event_model.sql` adds a NOT NULL column with legacy default and CHECK constraint. Existing rows/data survive. It is intentionally one-time ALTER: inspect `PRAGMA table_info(experiments)` before applying; replay raises duplicate-column error (tested). Do not run the seed-bearing migration directory wholesale. Only disposable SQLite has been migrated here.

Number 037 was already used by `oauth-security-integration-20261028/backend/migrations/037_atomic_owned_projects_and_credentials.sql`; 038 was unused in inspected main/candidates. Recheck allocation before integration.

After review/authorization: apply the additive schema before the app, then create **new** v1 experiment IDs; do not change existing experiments or retrofit old rows. For local review rollback, discard this worktree's diff only. After a future deployment, prefer a forward fix/disable new v1 collection; do not drop the column or delete events. An old backend would interpret v1 exposures through legacy algorithms, so code rollback after v1 collection is not semantically safe without suspending affected analysis. Keep schema/data and review exact recovery behavior.

## Verification

- Full backend suite on Python 3.11 with project-pinned modern FastAPI/Starlette: **342 passed** (6 existing deprecation warnings); log `/tmp/sdk-review-backend.log`.
- Earlier root venv run: 329 passed/7 failed because old Starlette lacked current parser limits/threadpool behavior. No unrelated upload/runtime source was changed. Pinned environment rerun passed those tests. A separate `/tmp/sdk-events-venv` was also prepared from exact requirements; final run used the already available Python 3.11 `/tmp/experiment-security-py311`.
- New `backend/tests/test_sdk_events.py`: actual routes + SQLite persistence, no-exposure decide, ambiguous experiments, mismatched/missing keys, forged context, idempotency, no dual write, metric/guardrail and cross-experiment attribution, before-exposure events, delayed exposure arrival, immutable source, empty v1 isolation, migration preservation/replay, SRM source, batch validation, repeat-instance/user denominator distinction.
- `npm test --prefix packages/sdk`: 6 passed plus TypeScript build. Covers original-user attribution after identify, control exposure, shared IDs, retries, explicit autoExpose, uncontextual pageviews and invalid decisions.
- `npm test --prefix frontend -- --run`: 18 files / 112 passed. `npm run build --prefix frontend`: passed; existing large-chunk warning. ExampleApp adds only eventModel="legacy"; its test uses the actual SDK Provider/bridge/action hook.
- Chromium local HTTP stub smoke: passed, 5 requests, no browser errors; no event on decide, shared exposure/action ID, localStorage anonymous ID and sessionStorage tab ID survive reload. Evidence `/tmp/sdk-events-browser-result.json`; script `/tmp/sdk-events-browser/smoke.mjs` uses locally installed Playwright and cached ARM64 Chromium. This is not an operational Cloudflare/browser deployment test.
- `git diff --check`: passed.

## PR #26 integration / ownership warnings

Do not merge this report as permission to merge PR #26. Its Google OAuth/member project boundaries remain absent from main and were not imported here.

Overlapping areas: `services/event.py`, `services/experiment.py`, `services/experiment_analytics.py`, `tests/conftest.py`, SDK core and README. SDK event worker owns this worktree only; authentication candidate owner must review integration.

1. PR #26 `get_analytics` / available-events return early from `_owned_events` reading `project_experiment_event`. Those returns would bypass this v1 selector. Integrate authenticated experiment ownership first, then explicit event_model: v1 project-filtered event_log; legacy owned project_experiment_event; legacy unowned experiment_event. Never fall through to global legacy events for an owned project.
2. Preserve PR #26 capture owner classification via fail-closed security_query and suppression of legacy person/cohort lookup for owned projects. This main-based candidate still uses main's person lookup. Resolve capture namespace logic explicitly rather than accidentally double-prefixing or removing tenant dedup isolation.
3. Extend/review `core/sdk_scope.py` traversal of typed `tracking_context` in addition to existing top-level/properties references; retain shared-segment restrictions, same-project experiment/flag checks and unknown-key rules. Our context validation is not a substitute for account authorization.
4. Preserve main's current hashed `project_server_credential` and public-key/Bearer separation. PR #26's older credential/rollback wording is not current main authority. SDK assignment/experimentPlacement request-header additions from PR #26 still need to be retained on integration.
5. Member user-level result/decision/guardrail restrictions in PR #26 must remain. This candidate does not authorize exposing those routes or changing frontend membership permissions.
6. Follow with integrated A/B account/SDK negative tests, missing security DB behavior, legacy/owned/v1 source fixtures and actual candidate migration sequence. This standalone main-based verification is not evidence that the combined OAuth candidate works.

## Remaining limitations and next owner

- v1 is flag-linked A/B only. Generic placement and 12th-cohort experimentPlacement remain legacy; no React viewport helper.
- Assignment ID is correlation metadata and public clients can fabricate telemetry; no new visitor authentication/anti-fraud guarantee.
- No attribution timeout, offline queue, event historical backfill or clock correction. Reused explicit impression IDs should retain original context/time; remount needs caller state.
- v1 Live Events significance/winner inference is disabled. Instance counts/rates remain descriptive; SRM now uses unique single-variant users, consistent with result/batch. Existing user-level binary result statistics/equal-split assumptions remain.
- JSON correlation read query has not been load-tested on operational D1; existing event_log indexes are reused. No speculative schema/index tuning added.
- New SDK is a behavioral change for legacy callers relying on automatic impression/dual write. Do not silently publish it as a patch upgrade; choose release version/migration plan in coordinator review.

Next owner: experiment-lead reviews actual uncommitted diff, tests, migration and PR #26 boundaries, then presents a concrete commit/main decision to the user. Current authorization ends before any commit. Under updated user rules, approved main integration would start existing GitOps automatically; no separate manual deployment is implied here.


## 11/1 SDK guide preparation addendum

The coordinator connected Suhyeon's SDK guide card to #20. Existing `packages/sdk/SDK_PACKAGING_GUIDE.md` now contains the current-main quickstart, public-key/API-address distinction, decide/actual exposure/track examples, per-request collection verification and error diagnosis, current-vs-proposed API table, and a five-part in-platform guide-tab content outline. No app tab/common UI files or Notion cards were edited. Jinsu's separate feature/use/integration guide authoring is **not marked complete**.

Read-only fetch found `origin/main be4485e`; SDK core and relevant capture/key code are unchanged from the implementation base. Registry reports latest 0.1.5. Installed published 0.1.5 in `/tmp/sdk-guide-current` and executed the guide flow against mock fetch: decide → events impression → capture exposure → capture action → events conversion; expose is absent. Evidence `/tmp/sdk-guide-current/result.json`, script `verify.mjs`. This verifies the published client request contract, not production storage. `git diff --check` passed; this addendum changes docs only, so application suites were not rerun.

Unconfirmed: running production SHA, actual external-service CORS and storage, public-key rollout state, final v1 release version and OAuth integration. Main's SDK UI key description still reflects historical shared-key wording despite backend public/server separation; recorded for the UI owner without editing its file. Production sdk-status means recent event/flag-evaluation presence, not proven impression/metric attribution. Final guide writing and card status remain with their assigned owners.


## Coordinator review corrections — repeated observations and bundled example

Both reported defects reproduced before their fixes. No commit or remote mutation was performed. This section supersedes any earlier description of instance-based Live inference or protection by npm pinning alone.

| Defect / reproduction | Final correction | Regression evidence |
|---|---|---|
| One control user and one treatment user, 100 views each; all treatment views convert. Previously analytics inferred significant treatment winner while result sample_size=2 | v1 Live retains 200 views/100 converted views but does not run independent-instance significance. p_value=null, is_significant=false, winner=null. User-level inference remains /result | New API/SQLite test failed before fix, now passes. Another 100 control views does not manufacture SRM |
| Same user seen in control and treatment, with 1 vs 100 views, manufactured Live SRM | Live SRM uses unique users with exactly one observed variant, as result and batch do. Multi-variant user's diagnostic views stay visible but are excluded from assignment-unit SRM | New API test failed before fix; result sample_size=0, Live 101 views and no SRM, batch no SRM after fix |
| Vite source alias upgraded /example immediately, removing /events impression/conversion | SDKConfig and Provider accept explicit eventModel=legacy. ExampleApp chooses it. Legacy preserves old decide server side effects + automatic impression, capture exposure, and track capture/events mirror. Default v1 stays capture-only; expose/context and autoExpose reject incompatible legacy use | New real-Provider/bridge/useTrack frontend test failed before the ExampleApp setting, then passed. SDK regression checks exact request endpoints and mode separation |

Files added to review delta: `backend/app/services/experiment_analytics.py`, `backend/tests/test_sdk_events.py`, `packages/sdk/src/{core,types,react}.ts*`, `packages/sdk/tests/events.test.mjs`, `frontend/src/features/example/ExampleApp.tsx` (one prop), `frontend/src/__tests__/ExampleApp.test.tsx`, README/packaging guide/this handoff. No unrelated example hooks or UI were refactored.

File coordination: other staged ExampleApp changes were found in workspace-experiment-login. The coordinator confirmed those are an old integration snapshot already represented by main and authorized the one-prop change only in this SDK worktree. No files in that worktree were changed or imported.

Validation after corrections:

- Backend full suite: **342 passed**, `/tmp/sdk-review-backend.log`; original reproduction failures: `/tmp/sdk-review-before.log`.
- SDK tests/build: **6 passed**, `/tmp/sdk-review-sdk-final.log`.
- Frontend full suite: **18 files / 112 passed**, `/tmp/sdk-review-frontend.log`; original example regression failure `/tmp/sdk-review-example-before.log`.
- Frontend production build: passed, `/tmp/sdk-review-frontend-build.log`; existing chunk-size and Browserslist age warnings only.
- Actual `/example/experiments` served by local Vite with the real aliased SDK and API responses stubbed in Chromium: **passed**, 18 SDK/event requests, no browser errors. Button interaction produced capture action + legacy conversion; initial load produced legacy impressions and bridge exposures. Importing the same SDK source in the browser with default v1 produced no /events writes. `/tmp/sdk-review-browser.json`, reproducible script `/tmp/sdk-events-browser/example-review.mjs`. All API requests intercepted locally; no operational data writes.
- `git diff --check`: passed.

Guide alignment: npm 0.1.5, default candidate v1, and source-aliased internal legacy example are distinguished. Live instance counts, disabled p-value/winner, unique-user SRM and /result inference are explicit. Team assignment/session/coordinator-process text was removed from the user-facing packaging guide and remains only here. No final release version is chosen and no package tag/version was published.

Remaining risks: explicit legacy compatibility intentionally retains historical automatic exposure/dual-write limitations. v1 Live provides no significance inference, including for large samples; use the existing user-level /result. Existing dashboard treats null p-value as unavailable and does not show a winner. Migration 038 and PR26 integration boundaries above remain unchanged, as does the unresolved ID-less legacy conversion policy. The candidate still needs coordinator independent diff review before any commit/main integration.


## Approved combined release preparation — 2026-10-31

This section supersedes earlier local-only status for the approved combined release. The user authorized checking migration 038 and, if ready, committing the reviewed SDK + developer guide to main. npm publication/tags remain explicitly excluded.

- Integration base: latest main c4dafa4d9bde12b586974cae02529801d8212213, including PR29 reflection retirement. Original worktrees and root main remain untouched.
- Release workspace: workspace-experiment-sdk-release / feat/sdk-event-model-and-guide.
- Fresh integrated verification: backend 345 passed; frontend 138 passed; SDK 6 passed; SDK/frontend builds and diff check passed. Prior combined browser verification covered KO/EN login→guide→login and guide→introduction→login returning to the original protected path using stub authentication. No actual user login or telemetry write was used.
- Production D1 pseudolab-exp: schema inspection confirmed event_model absent. Applied only 038_sdk_event_model.sql, then re-read schema and aggregate counts. All six existing experiments remain legacy, total six before/after. No historical event data was changed or exported. Migration must not be replayed without checking the existing column.
- Existing CI/GitOps will deploy automatically after main changes; no manual image-tag update/sync is planned. Main publication and runtime verification results are tracked in the coordinator release report. No sdk-v* tag or npm publish is authorized. Package version remains 0.1.5; guide quickstart stays pinned to the already published artifact rather than claiming a new SDK release.
