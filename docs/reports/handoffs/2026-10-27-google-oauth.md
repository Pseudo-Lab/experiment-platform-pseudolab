Status: active
Project: 2dfd8326-7ee3-46e8-96a2-12a7bcf31983
Task: BIN-16
Base: 3d04abe37fff2c30e520cbbb8f59c1bc41cdea41 (PR25 security candidate)

# Google OIDC and public project ownership handoff

This candidate adds Google authorization-code login and public signup to the existing administrator login. It is preparation for review, not a production release. The cumulative branch includes PR25: do not independently merge both histories without reviewing overlap. PR25/28 remain untouched.

## Identity and session contract

Google login uses state tied to an HttpOnly browser cookie, ten-minute single-use database attempts, nonce and S256 PKCE. PyJWT verifies an RS256 signature against Google's fixed JWKS endpoint and validates issuer, audience, expiry, issued-at, subject, nonce and authorized-party claims. The callback is fixed by installation configuration; success redirects only to `/projects`, failures only to `/login?oauth=failed`. Caller-controlled return URLs are not supported. No provider access/refresh token, email or profile is stored or logged. `google_sub` is the unique identity: no email matching, account linking, organization/domain rule or administrator promotion.

New account sessions are opaque random credentials, with SHA-256 hashes and expiry in D1. Logout deletes them. Existing administrator signed sessions remain compatible; logout now records their hashes in a revocation table. Security reads fail closed on missing/unavailable D1. Cookie settings for OAuth are Secure, HttpOnly, SameSite=Lax, Path=/; all authentication and management responses use no-store. Existing admin password authentication still requires all three admin configuration values.

## Public-account capability boundary

- Project create/list/read/update/delete, SDK-status, explicit SDK-key reveal, server-key generation/revocation are owner-scoped. Installation administrator retains global access. Existing projects without `project_owner` rows remain administrator-only.
- Experiment list/create/read/update/delete, same-project flag linkage, adopt-winner and experiment visual-change list/create are scoped. Members cannot move resources between projects. Experiment owner metadata is set by the server.
- Flag list/create/update/archive/restore, exposure list/summary and rule list/create are scoped. Shared segment rules are refused. New routes are denied unless explicitly included in `core/authorization.py`.
- Shared segments/query templates, global event analytics, experiment result/analytics/available-events, decision logs, placements, standalone visual-change deletion, community metrics, bug reports, SRM administration, internal data and remaining unproven routes remain administrator-only. The UI hides internal navigation and non-overview experiment tabs; it explains shared feature restrictions. This is a deliberate conservative boundary, **not a claim that tenant-scoped segments or full analysis have been implemented**.
- Global resource slugs remain unique. Public accounts can encounter a generic resource conflict; projects are not organizations or teams. No transfer UI is added.

## SDK and key compatibility

`projects.api_key` remains the public SDK key. New random keys use 192 bits; this change does not rotate existing keys. New owned resources require the matching key for SDK decide/assignment/event references, including nested experiment IDs. Public keys do not authenticate management APIs or become server Bearer credentials. The SDK now supplies its key on assignment and experiment-placement requests; event names/endpoints are unchanged.

Server keys are issued once with `POST /api/v1/projects/{id}/server-key`, returned as `server_key`, and stored only as hashes. Repeating POST replaces the previous key; DELETE revokes it. Keep server keys out of frontend bundles, source control, logs and browser storage. New server keys authenticate `/access/decide` for their project. They cannot probe shared committee segments; those decisions fail closed. Existing unowned-project Bearer keys and legacy reflection/capture/placement routes retain their existing contracts. No production key was rotated or revoked.

Owned-project capture does not read legacy `person` cohort data. For these projects only, the internal deduplication key is prefixed by project ID so one tenant cannot consume another's event ID. The external capture payload is unchanged. Public SDK credentials are intentionally publishable and do not establish visitor identity or trustworthy events. A visitor is not a platform account.

[SDK issue #20](https://github.com/Pseudo-Lab/experiment-platform-pseudolab/issues/20) remains the event-model authority: decide/expose/track separation, attribution and the dual event stores are not redesigned here. Existing automatic impression and dual writes remain a documented SDK limitation. Do not interpret this OAuth candidate as completion of #20 or expose legacy global analytics to members to compensate.

## Migration and rollout sequence (not executed in production)

1. Confirm the final candidate/CI, approve production release separately, and snapshot the experiment D1 database with the existing operator backup procedure. Do not use the data-source D1 database.
2. Apply **only** `backend/migrations/034_public_accounts.sql` to that existing experiment database. Do not run the historical seed-bearing migration directory wholesale. The migration uses additive `CREATE ... IF NOT EXISTS`, FK constraints and indexes; no existing row is assigned or removed. Check tables `platform_account`, `project_owner`, `platform_session`, `revoked_admin_session`, `oauth_attempt`, `project_server_key`; run `PRAGMA foreign_key_check` and verify `idx_project_owner_account`, session/attempt expiry indexes. Applying 034 twice is supported; this does not make earlier migrations replay-safe.
3. Prepare the existing admin auth settings first (PR28 has its own approval), then installation-specific `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`, `AUTH_SESSION_SECRET`, `AUTH_COOKIE_SECURE=true`, `AUTH_COOKIE_SAMESITE=lax`, exact `BACKEND_CORS_ORIGINS`. Inject secrets through the approved secret mechanism. Never commit real values. Existing admin settings are preserved. Empty Google credentials disable the button and start route returns 503.
4. Google Cloud, **only after separate authorization**: select the approved project, configure external audience/branding and required consent information; start in testing with approved test accounts; create/select an OAuth **Web application** client; register exactly `https://<installation-origin>/api/v1/auth/google/callback` with no trailing slash/query. The local HTTPS smoke callback is exactly `https://localhost:18943/api/v1/auth/google/callback`. `https://platform.example.com/api/v1/auth/google/callback` in the sample is not a production domain. Confirm the real public origin before registering it; never infer it from an old `.env.sample`. Keep the app and API on the same HTTPS origin, route `/api` to backend, and preserve forwarded scheme/host. Separate frontend-origin redirects are not supported by this candidate.
5. Release the app only after the migration/settings checks. No main merge, workflow dispatch, image publication, Ops update or Argo sync is authorized by this handoff. After explicit release approval, compare running image SHA, verify administrator recovery, missing-config behavior, real Google success/denial and A/B project isolation over the actual HTTPS ingress.
6. Actual Google authorization has **not** been exercised: local tests use generated RSA/JWKS and a mock token endpoint. Real client configuration, consent branding, provider callback registration and production D1 transport remain operator validation tasks.

## Recovery and existing project transfer

Disable Google credentials to stop new sign-ins, and revoke affected public sessions if required through an approved operator change. Existing account sessions remain valid until revoked/expired. Do not drop account/session/ownership tables after signup: that would destroy identity and ownership history. A rollback to PR25 can disable public-account access while preserving additive tables, but PR25 does not honor the new administrator revocation table; revoke/rotate administrator sessions through an approved setting change before such a rollback. Never roll back to the unauthenticated pre-PR25 backend. Back up first; restoring a DB snapshot after writes can lose newer rows and needs an explicit recovery decision.

No existing project is automatically claimed, even when its ID/email resembles a new account. To transfer later: approve the exact project/account identity, verify the account's `google_sub` privately, audit related flags/experiments/placements/keys and cross-project links, snapshot data, and insert a single `project_owner(project_id, account_id)` row in an authorized transaction. Owned-project SDK and Bearer semantics then change; inventory consumers and issue a new server key before cutover. No transfer or key rotation was performed here.

Expired opaque session/revoked-admin rows may be purged by an approved maintenance process after their expiry. Login start removes expired OAuth attempts. No scheduler or new operational job was introduced.

## Local verification and reproduction

Use Python 3.11 with `backend/requirements.txt`, then `python -m pytest backend/tests -q`. Build SDK with `npm ci --prefix packages/sdk && npm run build --prefix packages/sdk`; install frontend and run its tests/build. `test_public_accounts.py` applies the actual 034 migration against a disposable SQLite baseline, tests replay/FK/data preservation, A/B/admin boundaries, key scoping/revocation, signatures/claims/state/refusal and session revocation. Existing tests keep legacy contracts.

ARM64 images can be built locally with `docker build --platform linux/arm64 -t <local-tag> backend` and `docker build --platform linux/arm64 -f frontend/Dockerfile -t <local-tag> .`. Do not push as part of local validation. HTTPS scripts and sanitized logs are preserved in the task evidence directory. Local D1/R2/provider substitutes are not real Cloudflare/Google validation.
