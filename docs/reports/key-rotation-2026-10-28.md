Status: active
Project-ID: 2dfd8326-7ee3-46e8-96a2-12a7bcf31983
Task-ID: BIN-18

# Project credential rotation

The previously exposed `projects.api_key` authenticated both public SDK and server Bearer requests. Public identifiers now authenticate SDK requests only. Server access requires a `sk_live_` credential whose SHA-256 hash exists in `project_server_credential` and has no `revoked_at`. Missing rows, deleted/revoked credentials and storage failures never fall back to public credentials. No admin authority is granted by either key type.

Migration 036 is independent of OAuth 034/035. Apply only 036 for this release. Existing projects and data are preserved; no server credentials are automatically created. Server credentials must be generated with 256 bits or more of cryptographic entropy, stored as hashes in D1, and supplied only to an identified server consumer. For Kubernetes consumers, use the existing strict-scope SealedSecret workflow with the current controller certificate and exact Secret name/namespace. Do not issue unused credentials or add unused Secrets.

`ProjectService.rotate_public_key(project_id, expected_key)` uses a parameterized compare-and-swap update and `RETURNING id`. Run it in a controlled operator process with keys in memory only; confirm the new row, exact affected project and HTTPS rejection of the old value. Never log keys or restore exposed credentials. A stale expected key returns 409. A storage failure returns 503, and an uncertain write must be reconciled by reading current state before retrying.

The bundled demo obtains its public SDK identifier from `GET /api/v1/sdk/demo-config` (only demo-app, no-store), refreshes every 30 seconds, and remounts the SDK when it changes. Loading and error states stop SDK initialization. Existing pre-release browser tabs require a reload after rotation; the old key is not retained for overlap. The public identifier remains public and is never a server secret. New installations generate random SDK identifiers instead of seeded known keys.

Inventory before rotation found two projects: demo-app and lvup. In-memory comparison over 6,011 related local files found demo-app in the bundled example and both old keys in the historical seed migration. LVUP capture/reflection/placement source sends no project-key header. Relevant GitHub Actions configuration names and cluster workload environment/Secret references contain no identified server-key consumer. This is a bounded inventory, not proof that no external consumer exists. No Kubernetes server credential is required by the identified consumers, so no ceremonial SealedSecret is added.

## OAuth PR26 integration requirement

PR26 is not deployed by this change. Before it can be deployed, resolve its `project_server_key`/owned-project assumptions against this release. In particular, its fallback from a missing server-key row to `projects.api_key` MUST NOT be restored, even for unowned projects or after deletion. Preserve migration036, the public/server separation, revocation and DB-failure tests, and the runtime demo configuration. Do not roll back to PR25 or an unmodified PR26 after rotation.

## Verification and operational evidence

Run `python -m pytest -q` in backend, SDK build, and frontend tests/build. Test fixtures contain synthetic values only. Live deployment, exact commit/PR, CAS outcomes and read-only HTTPS results are recorded on BIN-18 and in the task-specific backup directory; this source document alone is not a claim of completed production rotation.


## BIN-18 삭제 수명 정책 후속 보완

- Project ID: `2dfd8326-7ee3-46e8-96a2-12a7bcf31983`; task: BIN-18.
- Migration 036의 FK를 유지한다. 활성·폐기 서버 credential 행이 있는 프로젝트 삭제는 409로 거절하며 프로젝트와 credential을 보존한다. 자동 cascade/credential 제거는 하지 않는다.
- 삭제 사전 조회와 `DELETE ... RETURNING id`는 실패를 숨기지 않는 D1 경로를 사용한다. DB 실패 또는 조회 이후 FK 참조가 생기는 경쟁은 503, 삭제된 행 미확인은 409이며 204로 오인하지 않는다.
- 일회용 SQLite에서 foreign_keys=ON으로 활성·폐기 credential의 409/행 보존, 정상 삭제, provider/result/transport/config 실패와 동시 FK 참조를 검증한다. 서버 Bearer의 자기 프로젝트 access 허용·타 프로젝트 access 거절·관리 flag API 401·SDK 헤더 오용 401을 실제 ASGI API로 검증한다.
- 실행: `/tmp/bin16-venv/bin/pytest -q backend/tests` (저장소 루트). 일반 환경은 backend 의존성을 설치한 뒤 `cd backend && pytest -q`.
- 운영에서는 데이터 생성/삭제 실험 없이 배포 이미지·소스 일치와 읽기 전용 HTTPS/DB 검증만 한다. 완료된 키 회전은 재실행하지 않는다. 새 migration/키/Secret은 없다.
- PR26 통합 시 이 삭제 실패 처리와 credential FK 수명 정책도 보존해야 한다. 폐기 credential 이력 제거 정책은 이번 범위에 추가하지 않는다.
