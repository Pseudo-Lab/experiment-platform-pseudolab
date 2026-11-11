Status: active
Last-Validated: 2026-11-12

# Project sharing and invitations

## Behavior

Project owners create a link for one viewer or editor, copy it and share it with the intended person. The recipient signs in with Google, previews the project name and role, then explicitly accepts. The shared project, its experiments and flags appear in the recipient's lists. No email delivery or email-address binding is implemented: whoever receives the link can accept it first. The UI states this before creation.

| Action | Viewer | Editor | Owner / installation admin |
| --- | --- | --- | --- |
| Project, experiment, flag and member-accessible aggregates | Read | Read | Read |
| Create/edit/delete A/B experiments; manage flags and public SDK key | No | Yes | Yes |
| Invitations, member roles and removal | No | No | Yes |
| Project settings/deletion and server credentials | No | No | Yes |
| Installation-wide analytics, segments, placements and `/result` | No | No | Installation admin only |

Existing owners and event models are retained. Owner transfer is not part of this change. Project removal never promotes another member. The installation administrator retains the existing global management authority. Account IDs identify members; profile/email storage is unchanged.

## Invitation safety

- Cryptographically random 256-bit tokens, 7-day expiration, single-account acceptance, owner revocation.
- Only SHA-256 token hashes persist. List responses never return tokens/hashes. The newly created link is shown once; other pending links can be revoked and replaced.
- The token is carried in a URL fragment, never a query parameter. Authenticated preview/accept requests send it in the POST body. Existing OAuth return-path handling preserves the fragment; joining requires explicit confirmation.
- A SQLite view trigger atomically creates membership and consumes the invitation. FK failures roll back consumption. A consumed link cannot be claimed by a different account or restore a removed member. Retrying an accepted link is allowed only for the same account while access still exists and the link remains valid.
- Every management request checks current database access; browser controls are supplementary. Missing membership yields 404, insufficient role 403, unavailable invitation 410. Security storage errors fail closed.
- No invitations, account permissions, production data or service configuration were changed during local development.

## Verification

- Backend: 561 tests pass, including the regression suite and additional cross-account sharing/role/expiry/revocation/storage-failure/atomicity tests.
- Frontend: 209 tests pass across 21 files, covering KO/EN creation, explicit acceptance, retry, clipboard-failure handling, viewer key protection and OAuth invitation-fragment restoration tests; TypeScript and production build.
- Chromium KO/EN at 390px and 1280px: separate synthetic owner/member sessions, real React UI and FastAPI authorization with an in-memory SQLite fixture. Create link → accept → view shared experiment → deny viewer writes/key access → grant editor → allow edit → deny member invitations → remove → deny access. Four cases pass, no page errors or horizontal overflow.
- These are local synthetic-account tests, not actual Google authentication or Cloudflare D1 production acceptance tests. Hub experiment collection remains a separate task.

## Release order and rollback

**Migration 040 must be applied before deploying this application version.** Project authorization and filtered lists now depend on `project_access`. Deploying before migration would fail project operations. Do not merge the application to main until the migration gate is satisfied, because main starts production GitOps deployment.

1. Review `backend/migrations/040_project_sharing.sql`. It only adds membership/invitation tables, an access view and the atomic-accept trigger; it does not backfill members or alter project owners.
2. Through the existing authorized Ops migration path, take the required backup and apply 040. Verify table/view/trigger definitions and replay safety without reading member data. No generic migration runner or silent fallback is introduced.
3. Merge the reviewed application PR, let existing CI/GitOps finish, then verify deployed bundles and owner/member behavior with dedicated test accounts.
4. On application rollback, retain additive migration 040. Old application versions ignore shared membership and return to owner-only access; do not drop live membership/invitation records as rollback cleanup.

Implementation is prepared for review. Production migration and deployment are not performed by this implementation task.
