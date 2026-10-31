Status: active
Last-Validated: 2026-10-31

# SDK developer guide — local review handoff

## Task Metadata
- Task ID: sdk-developer-guide
- Owner: experiment-sdk-guide; next reviewer: experiment-lead
- Outcome: a public, static `/docs/sdk` guide for the currently published SDK. Local implementation and verification only; no commit, push, PR update, main integration, deployment, production writes or Notion change.

## Scope and workspace
- Worktree: `/home/ubuntu/.openclaw/workspace-experiment-sdk-guide`
- Branch: `feat/sdk-developer-guide`
- Base: fetched `origin/main`, `e03810486a659b637f9025c70561704a094d138f`.
- Common root and other worktrees were preserved. No packages/sdk, backend, API client or AuthContext changes.
- Intro owner explicitly handed off App.tsx, LoginPage.tsx and ServiceIntroPage.tsx; UI owner reported no active common-file editing. MainLayout adds only a guide link adjacent to the existing introduction link, available without a selected project.
- No agy or spawned subagents used. Registered peer coordination used codex-session-control.

## Inputs Used
- AGENTS.md → reports index/decision log → collaboration and design guides.
- Read-only SDK worktree sources: `packages/sdk/SDK_PACKAGING_GUIDE.md` (current published quickstart section), `packages/sdk/README.md`, `docs/reports/handoffs/2026-10-31-sdk-event-model.md` in `workspace-experiment-sdk-events`.
- Current main SDK core and types; npm registry `npm view @pseudo-lab/experibase-sdk version dist.tarball --json`: latest **0.1.5** on 2026-10-31.
- SDK owner independently confirmed 0.1.5 and its legacy collection limitations via registered peer reply.
- Published package artifact: https://registry.npmjs.org/@pseudo-lab/experibase-sdk/-/experibase-sdk-0.1.5.tgz . Actual installed package at `/tmp/sdk-guide-current/node_modules/@pseudo-lab/experibase-sdk` was read only for execution checks.

## Changes Made / final diff
- `frontend/src/features/docs/SdkGuidePage.tsx`: bilingual KO/EN static guide, existing Button/Card and theme variables, responsive section navigation, focusable horizontally scrollable code. Version/access → public key → exact install/API URL → decide/actual exposure/action → first collection → troubleshooting → separate upcoming migration note.
- `frontend/src/App.tsx`: exact `/docs/sdk` and `/docs/sdk/` public handling before authentication loading/anonymous branches and ProjectProvider; skips backend status fetch on guide routes. Existing AuthProvider remains and may request `/auth/me`; reading is independent of its completion or failure.
- `frontend/src/features/about/ServiceIntroPage.tsx`: desktop navigation and mobile-visible footer guide links.
- `frontend/src/features/auth/LoginPage.tsx`: supporting guide link, retaining login behavior and introduction return state.
- `frontend/src/layouts/MainLayout.tsx`: bilingual guide link in persistent sidebar footer, separate from project SDK Integration.
- `frontend/src/__tests__/SdkGuide.test.tsx`: 14 tests for pending/failed/anonymous/authenticated access, language/theme, anchors/code keyboard focusability, entry links and protected/invalid paths.
- This handoff is the only new report. No task cards, existing Jinsu feature/use/integration guide status, or reports index were changed.
- Full review patch including new files: `/tmp/sdk-guide-review/final.diff` (generated after this handoff).

## Content contract
- Install is pinned: `npm install --save-exact @pseudo-lab/experibase-sdk@0.1.5`.
- Examples contain only fake `.invalid` URL, public-key placeholder and experiment ID. No real project/key fetching or executable event calls occur on the guide page.
- Documented legacy side effects: decide server evaluation plus automatic /events impression; control may have show=false; trackExposure /capture exp_exposure with experiment/session guard set before failure; track /capture + /events conversion mirror; React Provider pageview collection; no promise-completion success guarantee.
- Request response checks distinguish evaluation from actual visibility. Connection status is recent 30-day event/flag-evaluation presence, not proven attribution. Legacy results and Live Events use different stores; do not sum their counts.
- No Google/public signup availability claim. New expose/tracking_context/event_model APIs are described only as unreleased, not included in runnable current examples.

## Validation
- `npm ci --prefix frontend --ignore-scripts`: completed; lockfile unchanged.
- `npm test --prefix frontend -- --run`: **19 files / 127 tests passed**; `/tmp/sdk-guide-tests.log`.
- `npm run build --prefix frontend`: passed; `/tmp/sdk-guide-build.log`. Existing chunk-size and outdated Browserslist warnings remain; existing chart sizing/act warnings appear in suite output.
- Subsequently removed an asynchronous warning from the new test by making its irrelevant auth request pending. Targeted rerun: **14/14 passed**, `/tmp/sdk-guide-targeted.log`. No production source changed after the full test/build.
- `git diff --check`: passed.
- Published-client check: `/tmp/sdk-guide-review/published.mjs` extracts the exact three code strings from the page and executes them using installed npm **0.1.5**, replacing only the import with dependency injection. Mock fetch verifies decide → /events impression → /capture exp_exposure → /capture purchase_completed → /events conversion, control and experiment fields. Evidence `/tmp/sdk-guide-review/published-result.json`. This is request-contract verification, not real event persistence or actual service visibility.
- Chromium production-build static server with local API stubs: 390px and 1280px, KO→EN, theme, anchor navigation, keyboard tab/code focus, no page-wide horizontal overflow, introduction/login links, anonymous /experiments and /api-key protection, invalid /docs/sdk/missing fallback, network failure readability, no browser exceptions. `/tmp/sdk-guide-review/browser.mjs`, `browser-result.json`, `guide-390.png`, `guide-1280.png`.
- The static guide requested only existing `/api/v1/auth/me`; no project/key/status/event API calls. Unit tests additionally verify readability with an indefinitely pending auth promise and authenticated state.
- Browser harness uses local static fallback server at port 4188; no production traffic. The first attempt on Vite dev hit its existing `/api` proxy matching direct `/api-key` navigation, so final route checks use built static SPA assets instead. No unrelated proxy configuration changes.

## Risks and remaining verification
- No operational runtime SHA, external-service CORS, real production storage, backend deployment compatibility, or statistical correctness verification. No real login/signup or event writes were performed.
- Existing npm legacy attribution/duplicate-storage behavior remains. The guide explains it rather than claiming it fixed.
- Unknown SDK guide subpaths preserve the current anonymous login fallback; no new global 404 behavior was introduced. Authenticated unknown-route behavior is unchanged.
- Local screenshots/logs/patch in /tmp are temporary review artifacts. Source, tests and this report are in the worktree.

## If SDK #20 is integrated/released
1. Confirm the actual published release version and compatible deployed API/migration before changing the install pin. Candidate package.json still saying 0.1.5 is not release evidence.
2. Replace the quickstart with the reviewed explicit exposure/context API only for new sdk_v1 experiment IDs. Update preparation for immutable event_model and flag linkage; do not imply old experiments/data migrate automatically.
3. Update collection/diagnostic guidance for single capture/event_log source, IDs/idempotency and prior-exposure matching. Distinguish Live Events instance counts from unique-user inference, and disabled Live p-value/winner. Keep legacy integration instructions if that release still supports them.
4. Re-run exact published-package examples and frontend tests/build. Review OAuth ownership integration separately; this guide does not prove combined #20/OAuth compatibility.

## Next Owner
experiment-lead: review the uncommitted diff and evidence with the user before any commit. Implementation/testing is complete within this local scope; no publishing or operational action is implied. Existing guide-authoring assignments remain with their owners.

## Combined-review follow-up: preserve login return state

The coordinator reproduced a navigation regression: login → SDK guide → login dropped `location.state.from`, so successful login used `/experiments` instead of the original protected screen. The new links did not forward state, unlike the existing introduction/login links.

Minimal correction in this worktree:
- LoginPage's SDK link and both ServiceIntroPage SDK links pass `state={location.state}`.
- SdkGuidePage reads `useLocation()` and passes the same state to its login link, introduction link and brand/home link.
- No new return URL/query parameter, redirect parsing, AuthContext/API/backend change, or expansion of the existing pathname-only post-login policy.

Regression evidence:
- Before the fix, the new return-path matrix failed **8 cases** at the first guide transition (state became null); 16 existing/default cases passed. `/tmp/sdk-guide-return-before.log`.
- After the fix, **24 guide tests passed**, covering KO/EN protected-route redirect → login → guide → login and guide → introduction/brand → login; introduction navigation/footer → guide round trips; preservation of the entire received state; mock login reaching `/experiments/review-original`; pathname-only restoration (original query/hash are not restored); and direct guide access without state retaining `/experiments` as default.
- Destination experiment rendering is stubbed only in this navigation test file so unrelated experiment data loading is not part of the route assertions. AuthProvider, App routing, LoginPage, guide and introduction navigation are real; authentication API calls are mocked.
- Final full frontend suite: **19 files / 137 passed**, including the 24 guide tests. `/tmp/sdk-guide-return-full.log`.
- Final TypeScript/Vite build: passed; `/tmp/sdk-guide-return-build.log`. Existing Browserslist/chunk-size warnings remain.
- `git diff --check`: passed. This follow-up changes navigation state only; previous browser visual/SDK request-contract evidence remains applicable, and no new real login/event writes were performed.

All changes remain uncommitted. The coordinator-owned combined worktree was not modified. Next: experiment-lead reconstitutes the latest SDK + guide diffs in a fresh combined review workspace and independently verifies them before presenting any commit decision. No combined-test success is claimed by this guide-only follow-up.


## Approved combined release preparation — 2026-10-31

This section supersedes earlier local-only status for the approved combined release. The user authorized checking migration 038 and, if ready, committing the reviewed SDK + developer guide to main. npm publication/tags remain explicitly excluded.

- Integration base: latest main c4dafa4d9bde12b586974cae02529801d8212213, including PR29 reflection retirement. Original worktrees and root main remain untouched.
- Release workspace: workspace-experiment-sdk-release / feat/sdk-event-model-and-guide.
- Fresh integrated verification: backend 345 passed; frontend 138 passed; SDK 6 passed; SDK/frontend builds and diff check passed. Prior combined browser verification covered KO/EN login→guide→login and guide→introduction→login returning to the original protected path using stub authentication. No actual user login or telemetry write was used.
- Production D1 pseudolab-exp: schema inspection confirmed event_model absent. Applied only 038_sdk_event_model.sql, then re-read schema and aggregate counts. All six existing experiments remain legacy, total six before/after. No historical event data was changed or exported. Migration must not be replayed without checking the existing column.
- Existing CI/GitOps will deploy automatically after main changes; no manual image-tag update/sync is planned. Main publication and runtime verification results are tracked in the coordinator release report. No sdk-v* tag or npm publish is authorized. Package version remains 0.1.5; guide quickstart stays pinned to the already published artifact rather than claiming a new SDK release.

## Combined production verification — 2026-10-31

Released with the SDK integration at main application SHA c0162d2c97f9cd0b3cd7c21bef2aececc1132105. CI and automatic GitOps succeeded. Actual production Chromium verified Korean/English guide headings, mobile overflow, anonymous protected-route redirection and /api-key return-state preservation through login → guide → login. No real login or valid event write was performed. npm remains 0.1.5 with no new publication. Full release evidence and limits: [SDK release outcome](2026-10-31-sdk-event-model.md#combined-release-outcome--2026-10-31-1956-kst).
