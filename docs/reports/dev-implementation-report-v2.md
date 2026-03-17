Status: active
Last-Validated: 2026-03-15

# Dev Implementation Report v2

작성일: 2026-03-11 (KST)
작성자: 개발 에이전트 v2
기준 문서: `docs/reports/dashboard-execution-plan-v1.md` + `docs/reports/kpi-definition-v2.md`

## 1) 설계 요약
목표: `/dashboard`를 실험 목록 기반 화면에서 **전체 현황판(Executive Overview)** 으로 재구성.

핵심 설계:
1. 대시보드 데이터 소스를 `experimentApi.list()` 파생에서 분리
2. `dashboardApi.overview(window=30d)` 계약 기반 렌더
3. 5개 섹션(요약/추세/헬스/TopRepo/액션큐) 고정
4. loading/error/empty/success 명시

---

## 2) 코드 변경 내역

### A. 신규
- `frontend/src/features/dashboard/types/metrics.ts` (GitHub/Discord API 타입)

### B. 수정
- `backend/app/api/v1/endpoints/dashboard.py`
  - `/overview` 합성값 제거(communication=core copy 제거)
  - `/github/overview`, `/discord/overview` 신규 구현
  - Supabase 미설정/테이블 부재 시 안전하게 empty 반환
- `backend/app/db/supabase.py` (lazy init + env 미설정 시 None)
- `backend/tests/test_main.py` (`from app.main import app`로 수정)
- `frontend/src/services/dashboardApi.ts` (githubOverview/discordOverview 추가)
- `frontend/src/features/dashboard/overview/OverviewPage.tsx`
- `frontend/src/features/dashboard/overview/TopRepoTable.tsx`
- `frontend/src/features/dashboard/overview/HealthCards.tsx`
- `frontend/src/features/dashboard/overview/AlertList.tsx`
- `frontend/src/features/dashboard/components/GitHubDashboard.tsx`
- `frontend/src/features/dashboard/components/DiscordDashboard.tsx`
- `frontend/src/__tests__/Dashboard.test.tsx`

### C. 테스트 추가
- `backend/tests/test_dashboard.py`
  - GitHub/Overview API의 window 연동, merge_rate null, overview 합성 규칙 회귀 검증
- `frontend/src/__tests__/DashboardI18n.test.tsx`
  - Overview/GitHub/Discord 화면의 KO/EN 라벨 렌더 검증
- `frontend/src/__tests__/DetailDashboards.test.tsx`
  - GitHub/Discord loading/error/empty/success, 7d/30d 전환, 모바일 툴팁 상호작용 검증

---

## 3) API Contract 테이블 (Phase2 반영)

### Endpoints
- `GET /api/v1/dashboard/overview?window=7d|30d`
- `GET /api/v1/dashboard/github/overview?window=7d|30d`
- `GET /api/v1/dashboard/discord/overview?window=7d|30d`

### 3-1. `/dashboard/overview`
| 필드명 | 타입 | 규칙 |
|---|---|---|
| `generated_at` | string(datetime) | 필수 |
| `window.{from,to,timezone}` | object | `timezone='Asia/Seoul'` |
| `summary.active_projects_count` | number | 0 허용 |
| `summary.weekly_active_contributors` | number | 선택 기간 기준 GitHub `active_contributors` + Discord `active_authors` 단순 합 |
| `summary.weekly_collab_events` | number | 선택 기간 기준 GitHub core + Discord message 합 |
| `summary.pr_merge_rate_28d` | number \| null | 키명은 호환 유지, 값은 선택 기간 기준 / 분모 0이면 null |
| `summary.pipeline_freshness_hours` | number | 최신 이벤트 기준 시간차(없으면 0) |
| `timeseries[].core_activity` | number | GitHub 일별 합계 |
| `timeseries[].communication` | number | Discord 일별 메시지 |
| `timeseries[].merge_rate` | number \| null | 일별 opened 분모 0이면 null |
| `distribution.top_repos_by_activity[]` | array | GitHub PR repo 집계 기반 |
| `distribution.activity_concentration_top3` | number | 분모 0이면 0 |
| `health.coverage_score` | number | github/discord 관측 여부 비율(0~1) |
| `health.missing_day_ratio_30d` | number | 무활동일/조회일수 |
| `alerts[]` | array | 현재 빈 배열 반환 |

### 3-2. `/dashboard/github/overview` (계약 확정)
| 필드명 | 타입 | 빈값 규칙 |
|---|---|---|
| `generated_at` | string(datetime) | 필수 |
| `window.{from,to,timezone}` | object | `timezone='Asia/Seoul'` |
| `summary.push_events` | number | 0 허용 |
| `summary.pr_opened` | number | 0 허용 |
| `summary.pr_merged` | number | 0 허용 |
| `summary.issue_comments` | number | 0 허용 |
| `summary.pr_reviews` | number | 0 허용 |
| `summary.merge_rate_28d` | number \| null | 키명은 호환 유지, 값은 선택 기간 기준 / `pr_opened===0`이면 null |
| `summary.total_core_events` | number | 0 허용 |
| `summary.active_contributors` | number | 0 허용 |
| `timeseries[].date` | string(YYYY-MM-DD) | 조회 기간 day spine 고정 |
| `timeseries[].events` | number | 활동 없으면 0 |
| `timeseries[].merge_rate` | number \| null | 일별 opened=0이면 null |
| `top_repos[].repo_name` | string | 없으면 배열 비움 |
| `top_repos[].events` | number | - |
| `top_repos[].ratio` | number | 분모 0이면 0 |
| `UI Empty 판정` | boolean 식 | `summary.total_core_events===0 && top_repos.length===0` |

### 3-3. `/dashboard/discord/overview` (계약 확정)
| 필드명 | 타입 | 빈값 규칙 |
|---|---|---|
| `generated_at` | string(datetime) | 필수 |
| `window.{from,to,timezone}` | object | `timezone='Asia/Seoul'` |
| `summary.message_count` | number | 0 허용 |
| `summary.active_authors` | number | 0 허용 |
| `summary.active_channels` | number | 0 허용 |
| `timeseries[].date` | string(YYYY-MM-DD) | 조회 기간 day spine 고정 |
| `timeseries[].messages` | number | 활동 없으면 0 |
| `top_channels[].channel` | string | 없으면 배열 비움 |
| `top_channels[].messages` | number | - |
| `top_authors[].author` | string | 없으면 배열 비움 |
| `top_authors[].messages` | number | - |
| `UI Empty 판정` | boolean 식 | `summary.message_count===0 && top_channels.length===0` |

### 3-4. 현재 데이터 제약/정책
- Discord 작성자 표시는 아래 fallback 순서를 사용:
  - `nickname` -> `global_name` -> `author_nickname` -> `author_global_name` -> `author_username` -> `author` -> `username` -> `author_id`
- Discord 채널 표시는 `channel_name`만 사용:
  - `channel_id` fallback은 사용하지 않음
- 소스 미연결/테이블 부재 시 현재 API 정책:
  - 예외 대신 empty payload(0/빈 배열) 반환
  - `partial_sources`, `SOURCE_UNAVAILABLE`, `reason_code`는 아직 응답 계약에 포함되지 않음
- merge rate 키 정책:
  - `merge_rate_28d`, `pr_merge_rate_28d` 키명은 호환 유지
  - 실제 값은 선택된 `window=7d|30d` 기준으로 계산

### 3-5. FE 타입 1:1 매핑 증적
- 타입 정의 파일: `frontend/src/features/dashboard/types/metrics.ts`
  - `GitHubOverviewResponse` ↔ `GET /dashboard/github/overview` 응답 본문 1:1
  - `DiscordOverviewResponse` ↔ `GET /dashboard/discord/overview` 응답 본문 1:1
  - 공통 `window` 구조는 `DashboardWindow`(`timezone: 'Asia/Seoul'`)로 강제
- API 소비 파일: `frontend/src/services/dashboardApi.ts`
  - `dashboardApi.githubOverview(): Promise<GitHubOverviewResponse>`
  - `dashboardApi.discordOverview(): Promise<DiscordOverviewResponse>`
  - endpoint 경로 고정:
    - `/dashboard/github/overview?window=...`
    - `/dashboard/discord/overview?window=...`

### 3-6. KO/EN i18n 매핑표 (대시보드 UI)
| 화면 | 키(의미) | EN | KO |
|---|---|---|---|
| Overview | summaryActiveProjects | Active Projects | 활성 프로젝트 |
| Overview | summaryContributors | Active Contributors | 활성 기여자 |
| Overview | summaryCollabEvents | Collaboration Events | 협업 이벤트 |
| Overview | summaryMergeRate | PR Merge Rate | PR 머지율 |
| Overview | summaryPipelineFreshness | Pipeline Freshness | 파이프라인 최신성 |
| Overview | trendTitle7d / trendTitle30d / trendDescription | Trend Panel (7d/30d) / Core activity / communication / merge rate | 추세 패널 (7일/30일) / 핵심 활동 / 커뮤니케이션 / 머지율 |
| Overview | topRepoTitle / topRepoConcentration | Top Repositories / Top3 concentration | 상위 저장소 / 상위 3개 집중도 |
| Overview | alertTitle / alertEmpty | Action Queue / No active alerts. | 액션 큐 / 활성 알림이 없습니다. |
| GitHub 상세 | totalCoreEvents | Total Core Events | 핵심 이벤트 수 |
| GitHub 상세 | pushEvents | Push Events | 푸시 이벤트 |
| GitHub 상세 | prOpenedMerged | PR Opened / Merged | PR 오픈 / 머지 |
| GitHub 상세 | mergeRate | Merge Rate | 머지율 |
| GitHub 상세 | topRepositories / repoShare | Top Repositories / Activity share by repository | 상위 저장소 / 저장소별 활동 비중 |
| Discord 상세 | messages | Messages | 메시지 수 |
| Discord 상세 | activeAuthors | Active Authors | 활성 작성자 |
| Discord 상세 | activeChannels | Active Channels | 활성 채널 |
| Discord 상세 | topChannels / volumeByChannel | Top Channels / Message volume by channel | 상위 채널 / 채널별 메시지 볼륨 |

---

## 4) 검증 결과

### 4-1. 최소 API 호출 검증 (성공/빈값 케이스)
- 실행 환경: `backend` 디렉터리, `./venv/bin/python + fastapi.testclient`

1) **실데이터(또는 미연결) 빈값 케이스**
- 호출: `GET /api/v1/dashboard/github/overview?window=7d` → **200**
  - `summary.total_core_events=0`, `top_repos=[]`
  - Empty rule 평가: **True**
- 호출: `GET /api/v1/dashboard/discord/overview?window=7d` → **200**
  - `summary.message_count=0`, `top_channels=[]`
  - Empty rule 평가: **True**

2) **성공(비어있지 않음) 케이스**
- 방법: 테스트 스크립트에서 `dashboard._fetch_rows` 임시 주입(mock) 후 동일 endpoint 호출
- 호출: `GET /api/v1/dashboard/github/overview?window=7d` → **200**
  - 예시 결과: `total_core_events=5`, `merge_rate_28d=1.0`, `top_repos[0].repo_name='repo-a'`
  - Empty rule 평가: **False**
- 호출: `GET /api/v1/dashboard/discord/overview?window=7d` → **200**
  - 예시 결과: `message_count=2`, `active_authors=2`, `top_channels[0].channel='general'`
  - Empty rule 평가: **False**

### 4-2. 테스트
- Backend
  - 실행: `PYTHONPATH=. ./venv/bin/pytest -q`
  - 결과: **4 passed (warnings 4)**
- Frontend
  - 실행: `npm test -- --run`
  - 결과: **8 files / 41 tests passed**
- 비고: recharts container size 경고(stderr) 존재하나 실패 아님

### 4-3. 빌드
- Frontend 실행: `npm run build`
- 결과: **성공**
- 비고: 번들 사이즈 warning(>500kB) 존재 (`dist/assets/index-*.js ~698kB`)

---

## 5) 리스크 및 대응
1. **백엔드 엔드포인트 미구현/스키마 드리프트 리스크**
   - 대응: error/retry 이미 구현, contract 문서 고정 필요
2. **merge_rate null 처리 정책 미통일 리스크**
   - 대응: 현재 `-` 표기 통일, definitions API 연결(P1)
3. **영문/국문 라벨 일부 하드코딩 리스크**
   - 대응: Overview/GitHub/Discord 라벨을 KO/EN 매핑으로 통일, 본 문서 3-5에 매핑표 추가 (P0-1 해소)
4. **차트 렌더 경고(recharts width -1)**
   - 대응: 테스트 환경 wrapper min-size 보강(P1)

---

## 6) 완료조건 체크리스트

### P0 (릴리즈 게이트)
- [x] `/dashboard` 5섹션 렌더
- [x] overview 전용 API contract 사용 (`experimentApi.list()` 파생 제거)
- [x] loading/success/empty/error 분기
- [x] 테스트 증적 첨부 (test/build)
- [x] KO/EN 전체 텍스트 동기화 완결 (Overview/GitHub/Discord 하드코딩 제거 + 매핑표 반영)

### P1
- [ ] `GET /dashboard/overview/definitions` 연결
- [ ] Alert action URL 내비게이션
- [ ] 차트 경고 제거 및 시각 접근성 개선

### P2
- [ ] Drill-down 필터(기간/repo)
- [ ] R2 freshness/cost 상세 연동
- [ ] 운영 리포트 자동 생성

---

## 7) 민감정보 점검
- 토큰/키/계정ID 직접 노출 없음
- 환경변수명 외 민감정보 기록 없음
