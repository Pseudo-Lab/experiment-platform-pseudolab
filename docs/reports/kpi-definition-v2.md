# KPI Definition v2 (Phase 1 Freeze)

작성일: 2026-03-11 (KST)  
기준 문서: `docs/reports/dashboard-execution-plan-v1.md`  
상태: **확정(Frozen for Phase 1 MVP)**

---

## 0) 변경 이력

| 날짜 | 작성자 role | 변경 요약 |
|---|---|---|
| 2026-03-11 | Data Analyst Subagent | Phase 1 KPI Freeze 범위로 재정렬(Overview/GitHub/Discord), KPI별 목적/정의식/분자/분모/예외/해석/오용주의 및 데이터 근거 테이블 확정 |

---

## 1) 공통 계산 규칙

- 시간대(Timezone): `Asia/Seoul`
- 기본 조회 구간(Default window): `7d` (옵션: `30d`)
- 일자 경계: `00:00:00 KST` 기준
- 집계 단위: Count는 정수, Rate는 0~1 실수(표시 시 % 변환 가능)
- 분모가 0인 비율 KPI: `null` 반환 + `reason_code='DIVIDE_BY_ZERO'`
- 데이터 없음: `null` 반환 + `reason_code='SOURCE_UNAVAILABLE'`
- 동일값 정렬 tie-break: `value DESC`, 그 다음 `name ASC`
- 민감정보 원칙: 문서에는 비밀값 미기재. 필요 시 환경변수명만 사용 (예: `DATABASE_URL`, `CLOUDFLARE_API_TOKEN`)

---

## 2) KPI 정의 (Phase 1 범위)

## A. Overview KPI

### A-1. `total_datasets`
- 목적: 현재 플랫폼에서 분석 가능한 데이터셋 규모를 빠르게 파악
- 정의식: `COUNT(DISTINCT dataset_name)`
- 분자: 고유 데이터셋 수
- 분모: 없음(절대값)
- 예외:
  - 메타테이블 부재 시 `null` + `SOURCE_UNAVAILABLE`
- 해석 가이드:
  - 증가: 관측 범위 확장 가능성
  - 감소: 파이프라인/등록 누락 점검 필요
- 오용 주의:
  - 데이터셋 수만으로 품질/완성도를 판단하지 말 것

### A-2. `total_columns`
- 목적: 전체 스키마 폭(구조 복잡도) 파악
- 정의식: `SUM(column_count by dataset)` 또는 `COUNT(*) from information_schema columns`
- 분자: 전체 컬럼 수
- 분모: 없음(절대값)
- 예외:
  - 스키마 메타 접근 불가 시 `null` + `SOURCE_UNAVAILABLE`
- 해석 가이드:
  - 증가: 데이터 표현력 확대 가능
  - 급증: 정규화/중복 컬럼 여부 점검 필요
- 오용 주의:
  - 컬럼 수가 많다고 분석 품질이 자동으로 좋아지지 않음

### A-3. `github_core_events_total`
- 목적: GitHub 핵심 활동량 총규모 파악
- 정의식: `COUNT(push_events + pr_events + issue_events + review_events) within window`
- 분자: 조회 구간 내 GitHub 핵심 이벤트 건수
- 분모: 없음(절대값)
- 예외:
  - 소스 일부 누락 시 누락 소스명과 함께 반환(`partial_sources`)
- 해석 가이드:
  - 7d 기준 추이로 팀 개발 리듬 확인
- 오용 주의:
  - 이벤트 건수만으로 생산성/품질 단정 금지

### A-4. `discord_message_total`
- 목적: 커뮤니케이션 활동량 총규모 파악
- 정의식: `COUNT(discord_messages) within window`
- 분자: 조회 구간 내 Discord 메시지 건수
- 분모: 없음(절대값)
- 예외:
  - 메시지 테이블 미수집 시 `null` + `SOURCE_UNAVAILABLE`
- 해석 가이드:
  - GitHub 활동량과 함께 볼 때 협업 밀도 파악에 유효
- 오용 주의:
  - 메시지 수를 협업 품질의 직접 대리값으로 사용 금지

### A-5. `latest_data_update_ts`
- 목적: 대시보드 신선도(freshness) 확인
- 정의식: `MAX(latest_ingested_at across required sources)`
- 분자: 없음
- 분모: 없음
- 예외:
  - 어떤 소스도 최신시각이 없으면 `null` + `SOURCE_UNAVAILABLE`
- 해석 가이드:
  - 현재시각과 차이가 크면 파이프라인 지연 가능성
- 오용 주의:
  - 1개 소스의 최신성만으로 전체 정상 판단 금지

---

## B. GitHub KPI

### B-1. `github_push_volume`
- 목적: 코드 반영 빈도 파악
- 정의식: `COUNT(push_events) within window`
- 분자: push 이벤트 수
- 분모: 없음
- 예외: push 소스 누락 시 `null` + `SOURCE_UNAVAILABLE`
- 해석 가이드: 급감 시 릴리즈 직전/휴일/파이프라인 이슈 구분 필요
- 오용 주의: push 수를 코드 품질 지표로 사용 금지

### B-2. `github_pr_volume`
- 목적: 변경 제안(코드 리뷰 대상) 규모 파악
- 정의식: `COUNT(pr_events where action='opened') within window`
- 분자: opened PR 수
- 분모: 없음
- 예외: PR 이벤트 누락 시 `null`
- 해석 가이드: push 대비 PR 비율로 협업 방식 점검 가능
- 오용 주의: PR 수만으로 성과 비교 금지

### B-3. `github_issue_volume`
- 목적: 이슈 기반 문제/요구 흐름 파악
- 정의식: `COUNT(issue_events where action='opened') within window`
- 분자: opened Issue 수
- 분모: 없음
- 예외: issue 소스 누락 시 `null`
- 해석 가이드: 증가 시 품질/요구 변화 가능성 점검
- 오용 주의: 증가를 무조건 부정 신호로 해석 금지

### B-4. `github_review_volume`
- 목적: 리뷰 활동량 파악
- 정의식: `COUNT(review_events) within window`
- 분자: PR review 이벤트 수
- 분모: 없음
- 예외: review 소스 누락 시 `null`
- 해석 가이드: PR volume과 함께 보면 리뷰 병목 탐지 가능
- 오용 주의: 리뷰 건수만으로 리뷰 품질 단정 금지

### B-5. `github_pr_merge_rate`
- 목적: PR 통합 효율 파악
- 정의식: `merged_pr_count / opened_pr_count` (window 기준)
- 분자: 병합된 PR 수
- 분모: 생성(opened)된 PR 수
- 예외: 분모 0이면 `null` + `DIVIDE_BY_ZERO`
- 해석 가이드:
  - 낮은 값 지속 시 리뷰 병목/품질 게이트 지연 가능성 점검
- 오용 주의:
  - merge rate를 단독 KPI로 목표화해 무리한 병합 유도 금지

### B-6. `github_top_repos_by_activity`
- 목적: 저장소별 활동 집중도 파악
- 정의식: `Top N repos by COUNT(push+pr+issue+review) within window`
- 분자: repo별 이벤트 수
- 분모: (비율 산출 시) 전체 repo 이벤트 수
- 예외:
  - `repo_name` 누락은 `unknown` 버킷 처리
- 해석 가이드:
  - 상위 집중이 높으면 버스팩터/지식 편중 리스크 검토
- 오용 주의:
  - 하위 repo를 즉시 저가치로 단정 금지

---

## C. Discord KPI

### C-1. `discord_message_volume`
- 목적: 커뮤니케이션 볼륨 측정
- 정의식: `COUNT(discord_messages) within window`
- 분자: 메시지 건수
- 분모: 없음
- 예외: 메시지 소스 누락 시 `null`
- 해석 가이드: GitHub 이벤트와 시차 비교 시 협업 흐름 파악 가능
- 오용 주의: 단순 수치로 팀 생산성 판단 금지

### C-2. `discord_top_channels`
- 목적: 대화가 집중되는 채널 파악
- 정의식: `Top N channels by message_count within window`
- 분자: 채널별 메시지 수
- 분모: (비율 산출 시) 전체 메시지 수
- 예외: 채널 식별 불가 시 `unknown_channel`로 집계
- 해석 가이드: 운영/개발/잡담 채널 편중도를 분리 해석
- 오용 주의: 채널 볼륨을 의사결정 품질과 동일시 금지

### C-3. `discord_top_authors`
- 목적: 발화 집중도 및 참여 분포 파악
- 정의식: `Top N authors by message_count within window`
- 분자: 사용자별 메시지 수
- 분모: (비율 산출 시) 전체 메시지 수
- 예외:
  - 익명/삭제 계정은 `unknown_author`로 집계
  - 봇 계정 제외 여부는 `exclude_bots` 파라미터로 명시
- 해석 가이드: 상위 소수 집중 시 커뮤니케이션 편중 신호 가능
- 오용 주의: 개인 성과 평가 지표로 사용 금지

### C-4. `discord_message_trend_7d`
- 목적: 최근 7일 일별 커뮤니케이션 추세 확인
- 정의식: `daily COUNT(messages) for last 7 days`
- 분자: 일자별 메시지 수
- 분모: 없음
- 예외:
  - 결측일은 0으로 채우고 `is_imputed=true` 표기
- 해석 가이드: 급등/급락일의 이벤트(릴리즈, 장애, 회의)와 함께 해석
- 오용 주의: 단일일 스파이크로 조직 상태 일반화 금지

---

## 3) 데이터 근거 테이블 (Source of Truth)

| KPI 키 | 주요 소스 테이블(예시) | 필드(최소) | 비고 |
|---|---|---|---|
| total_datasets | `dataset_registry` 또는 `information_schema.tables` | `dataset_name` | 메타 저장소 기준 |
| total_columns | `information_schema.columns` | `table_name`, `column_name` | DB 엔진별 스키마 차이 주의 |
| github_core_events_total | `dl_push_events`, `dl_pull_request_events`, `dl_issue_events`, `dl_pull_request_review_events` | `event_id`, `repo_name`, `event_ts` | 소스별 timestamp 컬럼명 정규화 필요 |
| discord_message_total | `discord_messages` | `message_id`, `channel_id`, `author_id`, `timestamp` | 봇 제외 규칙 선택 가능 |
| latest_data_update_ts | 상기 전체 소스 | `ingested_at` 또는 `base_date`/`timestamp` | 소스별 max 후 전역 max |
| github_push_volume | `dl_push_events` | `event_id`, `repo_name`, `event_ts` | |
| github_pr_volume | `dl_pull_request_events` | `pr_id`, `action`, `repo_name`, `event_ts` | action='opened' 기준 |
| github_issue_volume | `dl_issue_events` | `issue_id`, `action`, `repo_name`, `event_ts` | action='opened' 기준 |
| github_review_volume | `dl_pull_request_review_events` | `review_id`, `repo_name`, `event_ts` | |
| github_pr_merge_rate | `dl_pull_request_events` | `pr_id`, `action`, `is_merged`, `event_ts` | opened/merged 정의 통일 필요 |
| github_top_repos_by_activity | GitHub 4개 이벤트 통합 뷰 | `repo_name`, `event_ts` | 통합 시 중복 제거 규칙 필요 |
| discord_message_volume | `discord_messages` | `message_id`, `timestamp` | |
| discord_top_channels | `discord_messages` | `channel_id`, `timestamp` | channel name 매핑 테이블 선택 |
| discord_top_authors | `discord_messages` | `author_id`, `is_bot`, `timestamp` | 개인정보 최소화(식별자만) |
| discord_message_trend_7d | `discord_messages` | `timestamp`, `message_id` | date spine 조인 권장 |

---

## 4) 구현 메모 (Phase 2 연계용)

- API 범위(계획서 기준)
  - `GET /api/v1/dashboard/overview?window=7d|30d`
  - `GET /api/v1/dashboard/github/overview`
  - `GET /api/v1/dashboard/discord/overview`
- 프론트는 원시 이벤트 재가공이 아니라 서버 집계값을 SSOT로 사용
- KPI 의미 충돌/쿼리 경로 과복잡 시 Split Gate 조건 재평가
