Status: active
Owner: soo
Created: 2026-07-23
Last-Updated: 2026-07-23
Task ID: access-decision-api

# Server-to-Server Access Decision API Handoff

## Task Metadata

- Task ID: `access-decision-api`
- Date: 2026-07-23
- Owner: soo

## Scope

- In scope:
  - 외부 플랫폼 서버가 공통으로 호출하는 `POST /api/v1/access/decide`
  - project API key를 사용하는 필수 Bearer 인증
  - feature flag payload 기반 `private | committee | public` 판정
  - manual segment 기반 committee allowlist 판정
  - 알 수 없는 정책, 잘못된 설정, 저장소 장애의 fail-closed 처리
  - LVUP Edge Function에서 사용할 요청·응답 계약
- Out of scope:
  - LVUP 코드와 배포 설정 변경
  - SDK wrapper 추가
  - 운영 project/flag/segment 데이터 생성
  - 기존 project/feature flag/segment 관리 API의 관리자 인증 보강
  - GitOps Secret 또는 운영 배포 변경

## Workspace

- Worktree path: `/home/ubuntu/.openclaw/workspace-experiment-access-decision`
- Branch: `feature/access-decision-api`
- Base: `origin/main` at `26a8855`

## API Contract

Endpoint:

```http
POST /api/v1/access/decide
Authorization: Bearer {PROJECT_API_KEY}
Content-Type: application/json
```

Request:

```json
{
  "user_id": "verified-user-uuid",
  "flag_key": "sudocon_networking_access_mode",
  "route": "/events/pseudocon-2026/networking"
}
```

Success or policy denial returns HTTP 200:

```json
{
  "allow": true,
  "access_mode": "committee",
  "reason": "allowed_committee"
}
```

Allowed `reason` values:

```text
not_authenticated
access_mode_private
not_committee
allowed_committee
allowed_public
evaluation_error
```

Protocol errors:

- `401`: Bearer token missing, malformed, or invalid
- `422`: request schema invalid
- Policy lookup/evaluation/storage failures return HTTP 200 with `allow=false`, `access_mode=private`, `reason=evaluation_error` so clients receive a stable fail-closed decision.
- Callers must also treat timeout, non-200 responses, invalid JSON, and unknown response values as denied.

## Policy Configuration

The authenticated project must own the feature flag (`feature_flag.project_id`). An unassigned flag or a flag owned by another project is denied with `evaluation_error`.

Private:

```json
{
  "access_mode": "private",
  "routes": ["/events/pseudocon-2026/networking"]
}
```

Committee:

```json
{
  "access_mode": "committee",
  "committee_segment_id": "sudocon_networking_committee",
  "routes": ["/events/pseudocon-2026/networking"]
}
```

Public for authenticated users:

```json
{
  "access_mode": "public",
  "routes": ["/events/pseudocon-2026/networking"]
}
```

- `routes` is optional. When present, the request route must match one configured value exactly.
- A disabled or archived policy acts as private/denied.
- Committee mode requires an existing enabled segment and explicit membership.
- Mode changes use the existing feature flag PATCH API and require no application redeploy.
- There is no application-level decision cache; the next request reads current D1 values.

## Changes Made

- `backend/app/api/deps.py`: required Bearer project authentication dependency
- `backend/app/api/v1/endpoints/access.py`: access decision endpoint
- `backend/app/schemas/access.py`: request/response and enum contract
- `backend/app/services/access.py`: project ownership, mode, route, segment, fail-closed evaluation
- `backend/app/api/v1/api.py`: `/access` router registration
- `backend/tests/test_access_decision.py`: authentication, modes, allowlist, ownership, route, storage-failure coverage

No DB migration is required. Existing `projects`, `feature_flag`, `feature_segment`, and `feature_segment_member` tables are reused.

## Validation

- Targeted: `pytest tests/test_access_decision.py -q`
- Result: 14 passed
- Full backend suite: `pytest -q`
- Result: 264 passed, 9 existing deprecation warnings

## Risks

- Existing project, flag, and segment management endpoints are not protected by the new Bearer dependency. 운영 데이터 생성·변경 경로는 배포 전 관리자 인증 또는 네트워크 제한을 별도로 확인해야 한다.
- Project API keys are returned by existing project management responses. Treat them as server-side secrets and never expose them to browsers.
- Manual segment refresh currently replaces members by delete followed by inserts. For frequent or high-volume allowlist updates, transactional/atomic replacement is a follow-up.
- No staging endpoint or production policy data is created by this change.

## Next Owner

- Owner: Backend/Infra owner
- Expected next action:
  1. Review and merge the API contract.
  2. Confirm management endpoint protection.
  3. Create the LVUP project credential, owned access flag, and committee manual segment without committing secret or raw allowlist values.
  4. Deploy, then execute private → committee → private → public → private QA with LVUP Edge Function.
