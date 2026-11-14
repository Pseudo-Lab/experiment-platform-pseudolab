Status: active
Last-Validated: 2026-11-15

# 기여 가이드

이 가이드는 기여자의 개발 환경, 변경 범위, 검증 및 Pull Request 작성 기준입니다.

## 제품과 작업 기준

Iterglow는 모든 서비스에서 사용할 수 있는 범용 실험 플랫폼입니다. 특정 서비스의 사용자 분류·운영 데이터·조직 구조를 플랫폼 고정 조건으로 추가하지 않습니다. 서비스별 요구는 플랫폼 공통 기능과 연동 서비스의 책임으로 구분합니다.

작업 시작 시 다음을 확인합니다.

1. [AGENTS.md](../../AGENTS.md)의 공통 규칙.
2. [문서 시작점](../README.md)과 변경하려는 기능 가이드·코드.
3. 기존 Issue·PR의 요청 범위, 호환성·보존 조건 및 완료 기준.

기술 변경에 필요한 요구사항과 근거는 Issue·PR 또는 해당 기능 가이드에서 확인합니다.

## 구조와 파일 소유권

| 영역 | 경로 및 도구 |
| --- | --- |
| Backend | `backend/app/**`, `backend/migrations/**`, `backend/tests/**` — FastAPI·Pydantic·pytest |
| Frontend | `frontend/src/**` — React·Vite·TypeScript·Vitest |
| Example | `frontend/src/features/example/**` — `/example` 경로 |
| SDK | `packages/sdk/**` — TypeScript, React 연동 및 Node 테스트 |
| Infra/Ops | `.github/**`, Docker·배포 설정 |
| Docs/Process | `AGENTS.md`, `docs/**` |

여러 작업자가 병렬 작업하면 branch와 linked worktree를 분리하고 같은 파일은 한 작업자만 편집합니다. 저장소 루트는 동기화·조율용으로 사용하며, 기존 변경을 초기화하거나 가져오지 않습니다. 작업 시작 전에 목표·포함/제외 범위·완료 확인 방법을 정리합니다.

## 개발 환경

[설치 가이드](setup_guide.md)에서 의존성·인증·개발용 저장소를 준비합니다. 클라우드와 무관한 테스트는 기존 fixture로 수행합니다. 자신의 운영 DB나 다른 서비스의 원천 DB를 개발 테스트의 쓰기 대상으로 사용하지 않습니다.

- 플랫폼 DB: 자신의 `D1_DATABASE_ID`. 앱의 읽기·쓰기 저장소.
- 기존 query segment 소스: `D1_MAIN_DATABASE_ID`. 등록된 template과 실제 테이블 계약 확인.
- query segment는 서버 allowlist만 사용. raw SQL 자유 입력 추가 금지.
- 소스 DB 설정 누락·갱신 실패를 빈 세그먼트 성공으로 처리 금지.
- 서비스의 raw DB 직접 접근·추가 수집은 별도 데이터·접근 계약 검토.

## 변경별 검증

저장소 루트에서 SDK 의존성을 먼저 준비한 뒤 관련 검사를 실행합니다. 전체 개발 환경 준비는 설치 가이드를 따릅니다.

```bash
npm test --prefix packages/sdk
npm test --prefix frontend -- --run
npm run build --prefix frontend
```

백엔드는 설치 가이드에서 준비한 가상환경으로 실행합니다.

```bash
cd backend
.venv/bin/python -m pytest
```

문서 전용 변경의 최소 확인:

```bash
git diff --check
```

추가로 변경한 Markdown 상대 링크와 설정·명령의 실제 코드 일치를 확인합니다. API·권한·DB 변경은 관련 회귀, 기존 데이터 보존·마이그레이션 적용 순서·실패 처리를 검증합니다. UI 텍스트 변경은 KO/EN 동시 반영, loading/error/empty/success 상태 확인이 필수입니다.

## Pull Request

[PR 작성 양식](../templates/pull-request.md)을 참고해 변경에 필요한 내용을 남깁니다.

- 해결할 문제와 변경 후 동작
- 변경 범위와 호환성·권한·데이터 보존 영향
- 실행한 검증과 결과, 미검증 범위
- 필요한 설정·migration 및 적용 순서

설명과 검증의 상세 수준은 변경 위험에 맞춥니다. API·권한·DB·배포 설정 또는 개발 규칙 변경은 영향과 적용·복구 절차를 함께 검토합니다.

배포 관련 변경은 [저장소 운영 규칙](../../AGENTS.md)을 따릅니다. docs-only 변경은 기존 파이프라인의 경로 제외를 유지합니다.
