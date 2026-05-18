Status: active
Last-Validated: 2026-05-18
Owner: soo

# Agent Collaboration Guide

이 문서는 Codex, Claude, Gemini 등 여러 에이전트나 여러 에디터 창이 같은 저장소에서 작업할 때 따르는 협업 기준입니다.

기본 목표는 단순합니다.

1. 같은 기준 문서를 보고 작업한다.
2. 같은 파일을 동시에 고치지 않는다.
3. 작업 결과와 검증 근거를 다음 사람에게 남긴다.

---

## 0. 이 저장소 운영 프로필

이 저장소는 실험 플랫폼 애플리케이션 저장소입니다. agent 작업은 아래 프로젝트 경계를 기준으로 판단합니다.

| 영역 | 현재 기준 |
|---|---|
| Backend | FastAPI, Pydantic, Cloudflare D1/R2 client, pytest |
| Frontend | React, Vite, TypeScript, Tailwind CSS, shadcn/ui 스타일 컴포넌트, Vitest |
| Experiment DB | Cloudflare D1 `pseudolab-exp` |
| Data source DB | Cloudflare D1 `pseudolab-main` |
| Raw 운영 DB | Supabase raw DB. 실험 플랫폼/feature flag 분석에서는 직접 조회하지 않음 |
| Demo app | `examples/demo-app/**` |
| Local dev | `docker-compose.dev.yml`, backend `:8000`, frontend `:8081`, demo app `:8082` |

현재 주요 작업 흐름은 Feature Flag 운영 UI 확장입니다.

다음 작업자가 우선 확인할 문서:

1. `docs/reports/handoffs/2026-05-18-feature-flag-ui-handoff.md`
2. `docs/reports/feature-flag-improvement-plan.md`
3. `docs/guides/experiment_platform_concepts.md`
4. `frontend/src/features/dashboard/components/FeatureFlags.tsx`
5. `frontend/src/services/api.ts`

---

## 1. 기준 문서 우선순위

작업 시작 시 아래 순서로 확인합니다.

1. `AGENTS.md`
2. `docs/reports/_index.md`
3. 작업 영역별 가이드
   - UI: `docs/guides/design_system.md`
   - 데이터/DB: `docs/guides/data_access.md`
   - 실험 플랫폼 개념: `docs/guides/experiment_platform_concepts.md`
   - Feature Flag: `docs/reports/feature-flag-improvement-plan.md`
   - Feature Flag UI 이어받기: `docs/reports/handoffs/2026-05-18-feature-flag-ui-handoff.md`

기준 문서가 충돌하면 `AGENTS.md`를 우선하고, 그 다음 최신 active 문서를 따릅니다.

---

## 2. 작업 시작 3줄 브리프

에이전트는 작업을 시작할 때 내부적으로 아래를 먼저 정리합니다.

```text
Goal: 무엇을 끝낼 것인가
Scope: 포함 범위 / 제외 범위
Done checks: 어떤 테스트, 빌드, 문서 확인으로 완료를 판단할 것인가
```

이 브리프는 작은 작업에서는 최종 응답이나 PR 설명에 녹이면 충분합니다. 중간 이상 규모 작업이나 handoff가 필요한 작업에서는 handoff 문서에 남깁니다.

---

## 3. Worktree 격리 정책

병렬 작업, 여러 에이전트, 여러 에디터 창이 예상되면 `git worktree`를 기본으로 사용합니다.

저장소 루트는 `main` 동기화와 조율용으로 둡니다. 실제 구현은 별도 linked worktree에서 진행합니다.

권장 절차:

```bash
git fetch origin
git switch main
git pull --ff-only
git worktree add ../workspace-experiment-<task> -b <type>/<short-task> origin/main
cd ../workspace-experiment-<task>
```

운영 규칙:

1. 작업 전 `git worktree list`와 `git status --short`를 확인합니다.
2. 하나의 worktree는 하나의 작업/역할/브랜치만 소유합니다.
3. 같은 브랜치를 둘 이상의 worktree에서 체크아웃하지 않습니다.
4. 같은 파일은 한 번에 하나의 활성 작업자만 편집합니다.
5. 완료된 worktree는 브랜치가 머지, 푸시, 또는 폐기된 뒤 제거합니다.

`git worktree`는 로컬 파일 충돌을 줄이지만 머지 충돌을 없애지는 않습니다. 파일 소유권과 작은 작업 범위가 여전히 중요합니다.

---

## 4. 도메인 소유권

| 도메인 | 소유 범위 |
|---|---|
| Backend | `backend/app/**`, `backend/migrations/**`, `backend/tests/**`, `backend/requirements.txt` |
| Frontend Dashboard | `frontend/src/**`, `frontend/package.json`, `frontend/vite.config.ts`, `frontend/tailwind.config.js` |
| Demo App | `examples/demo-app/**` |
| Infra/Ops | `.github/**`, `docker-compose*.yml`, `backend/.env.sample`, `frontend/.env.sample`, 배포/운영 매니페스트, 런타임 설정 |
| Docs/Process | `AGENTS.md`, `docs/**` |

Feature Flag UI 작업의 권장 파일 소유:

| 작업 | 주 소유 파일 |
|---|---|
| Segment 관리 UI | `frontend/src/features/dashboard/components/Segments.tsx`, `frontend/src/__tests__/Segments.test.tsx` |
| Segment API client | `frontend/src/services/api.ts` |
| Routing/sidebar | `frontend/src/App.tsx`, `frontend/src/layouts/MainLayout.tsx` |
| Rule builder UI | `frontend/src/features/dashboard/components/FeatureFlags.tsx` 또는 신규 detail/rule 컴포넌트 |
| Backend API gap | `backend/app/api/v1/endpoints/**`, `backend/app/services/**`, `backend/tests/**` |

여러 도메인을 동시에 바꾸면 PR 또는 명시적 handoff가 필요합니다.

---

## 5. Impact Trigger

아래 조건 중 하나라도 해당하면 PR 또는 명시적 handoff가 필요합니다.

1. Backend, Frontend, Infra, Docs 등 여러 도메인을 동시에 변경합니다.
2. API 계약, 인증/권한, DB 스키마, 마이그레이션에 영향이 있습니다.
3. CI/CD, 배포, 보안, ingress, secrets, 런타임 토폴로지가 바뀝니다.
4. `AGENTS.md`, `docs/guides/**`, active report 등 기준 문서를 바꿉니다.
5. 운영 데이터, export, 개인정보성 데이터 흐름에 영향이 있습니다.
6. Product Owner 또는 도메인 소유자가 리뷰를 요청합니다.

저위험 단일 도메인 작업은 handoff 문서를 생략할 수 있습니다. 이 경우 커밋이나 PR 설명에 변경 내용, 검증, 후속 작업을 짧게 남깁니다.

---

## 6. Team Lead Mode

Team Lead Mode는 사용자가 팀 방식, 멀티 에이전트, 병렬 위임을 명시적으로 요청할 때만 사용합니다.

Team Lead 책임:

1. 목표, 범위, 완료 기준을 명확히 합니다.
2. 필요한 최소 문서만 읽고 작업을 분해합니다.
3. 역할과 파일 소유권을 배정합니다.
4. 병렬 가능한 작업과 순차 작업을 구분합니다.
5. 하위 에이전트 결과를 검토하고 최종 결과로 통합합니다.
6. 충돌은 기준 문서, 사용자 의도, 도메인 소유자 판단 순서로 해결합니다.

`git worktree` 사용만으로 Team Lead Mode가 켜지는 것은 아닙니다.

---

## 7. 역할 기준

| 역할 | 주 관심사 |
|---|---|
| Backend API | FastAPI endpoint, schema, service, D1 migration, backend tests |
| Frontend Dashboard | Dashboard UI, Feature Flag/Segment UI, API client, responsive states, frontend tests |
| Demo App | `examples/demo-app` behavior, SDK usage, demo seed flow |
| Infra/Ops | Docker compose, CI, env vars, D1/R2 runtime connectivity, deployment notes |
| Data/Analytics | D1 source tables, metric definitions, exposure/result connection |
| QA | regression, edge cases, loading/error/empty/success states, release confidence |
| Security | auth, permission, secrets, privacy-sensitive data flow |
| Product | scope, acceptance criteria, prioritization |

모든 작업에 모든 역할이 필요한 것은 아닙니다. 필요한 최소 역할만 사용합니다.

---

## 8. Handoff 정책

handoff는 아래 경우에 작성합니다.

1. 작업이 중간 이상 규모입니다.
2. 여러 도메인을 건드립니다.
3. 다음 작업자가 이어받아야 합니다.
4. 운영/DB/API/보안 영향이 있습니다.
5. 기준 문서를 변경했습니다.

템플릿은 `docs/templates/agent-handoff.md`를 사용합니다.

handoff 최소 항목:

1. Task ID
2. Scope
3. Workspace / branch / base
4. Inputs used
5. Changes made
6. Validation
7. Risks
8. Next owner / next action

---

## 9. 검증 원칙

변경 범위에 맞춰 검증합니다.

Backend:

```bash
cd backend
./venv/bin/pytest
```

Frontend:

```bash
cd frontend
npm test -- --run
npm run build
```

Docs/process only:

```bash
git diff --check
```

검증하지 않은 항목은 이유를 남깁니다.

---

## 10. 작업 유형별 기본 검증

| 작업 유형 | 최소 검증 |
|---|---|
| Backend API/service | `cd backend && ./venv/bin/pytest` |
| Frontend UI/API client | `cd frontend && npm test -- --run`, `cd frontend && npm run build` |
| Demo app | `cd examples/demo-app && npm run build` |
| Docs/process only | `git diff --check` |
| D1 schema/query change | backend tests + 운영 D1에는 민감정보 값 없이 테이블/컬럼/row count만 확인 |
| Feature Flag UI | frontend tests/build + `docs/reports/handoffs/2026-05-18-feature-flag-ui-handoff.md` 업데이트 여부 확인 |

---

## 11. Feature Flag 작업 시 주의사항

1. Supabase raw DB를 직접 query source로 추가하지 않습니다.
2. query-backed segment는 서버 allowlist template만 사용합니다.
3. `D1_MAIN_DATABASE_ID` 누락은 빈 segment 성공이 아니라 실패로 처리해야 합니다.
4. Discord active user segment는 현재 `is_bot` 컬럼이 없으므로 bot 제외를 전제로 쓰지 않습니다.
5. UI 텍스트를 추가/수정하면 KO/EN을 함께 반영합니다.
6. operator-facing UI는 loading/error/empty/success 상태를 테스트에 포함합니다.
7. rule builder는 100% rollout, disabled/archived flag, refresh 실패 같은 위험 상태를 눈에 띄게 표시해야 합니다.
