Status: archive
Last-Validated: 2026-03-14

# Cloudflare D1/R2 데이터 요약 리포트 (READ ONLY)

> 작성 기준: 조회 전용 API/SELECT 결과
> 민감정보 원칙: 비밀값 미기록(환경변수 참조)

## 1) 조사 범위

- Account: `${CLOUDFLARE_ACCOUNT_ID}`
- D1: `${D1_DATABASE_ID}`(exp), `pseudolab-main`
- R2: `${R2_BUCKET_NAME}` 포함 버킷 현황

## 2) 핵심 자산 현황

### D1
- `pseudolab-exp`: 사실상 초기 상태 (`_cf_KV` 중심)
- `pseudolab-main`: 운영 데이터 허브
  - 카탈로그/사전/Discord/GitHub 이벤트 테이블 보유

### R2
- 버킷 2개
  - `github-archive-raw`
  - `pseudolab-exp`

### Zone
- 현재 account 기준 zone 없음 (0)

## 3) 데이터 볼륨 스냅샷 (pseudolab-main)

- `discord_messages`: 7,271
- `discord_watermarks`: 14
- `daily_stats`: 3,690
- `catalog_datasets`: 16
- `catalog_columns`: 241
- `glossary_terms`: 0
- `glossary_backfill_conflicts`: 0

## 4) GitHub 이벤트(Data Lake) 요약

총 14개 `dl_*` 테이블 확인.

상위 볼륨:
- `dl_push_events`: 4,304
- `dl_pull_request_events`: 1,521
- `dl_watch_events`: 888
- `dl_issues_events`: 618

하위/희소:
- `dl_public_events`: 8
- `dl_release_events`: 0

기간(대체로 `base_date`):
- 약 `2025-01` ~ `2026-03`

## 5) Discord 데이터 요약

- 범위: `2022-02-23` ~ `2026-03-07`
- 월별 분포가 장기 누적 형태
- 상위 채널 집중도 높음(몇 개 채널이 큰 비중 차지)

## 6) 카탈로그 품질 관점

- 도메인 분포:
  - `github`: 14
  - `discord`: 2
- 컬럼 타입 분포:
  - `TEXT`: 194
  - `INTEGER`: 47
- PII 플래그 컬럼 수: 3
- 용어사전(`glossary_terms`)은 아직 비어 있음

## 7) 분석 인사이트 (데이터 분석가 관점)

1. **분석 중심축은 GitHub 이벤트 + Discord 메시지**
   - 현재 양과 기간이 충분하여 시계열/행동 패턴 분석 가능

2. **`push`/`PR` 이벤트가 핵심 활동 지표**
   - 개발 생산성/협업도 지표 설계에 유리

3. **릴리즈 이벤트 부재**
   - 배포/릴리즈 프로세스 데이터가 비어 있어, SDLC 완전성 분석은 제한적

4. **용어사전 미구축 상태**
   - 분석/대시보드의 해석 일관성 확보를 위해 glossary 채우는 작업 필요

5. **exp DB는 실험 샌드박스 역할이 적합**
   - main 구조를 기준으로 실험 쿼리/피처 검증 수행 권장

## 8) 즉시 활용 가능한 분석 주제

- 리포지토리별 활동성 랭킹 (push/pr/issue)
- 조직별 협업 패턴 변화 (월별)
- Discord 대화량 vs GitHub 이벤트 상관 분석
- PR/Issue action 전환율 (opened→closed 등)

## 9) 데이터 활용 시나리오 (분석가 관점)

1. **활동성 모니터링 대시보드**
   - 입력: `dl_push_events`, `dl_pull_request_events`, `dl_issues_events`, `discord_messages`
   - 활용: 주/월 단위 팀 활동량, 협업 밀도, 이벤트 급증/감소 감지

2. **협업 전환 퍼널 분석**
   - 입력: PR/Issue 관련 이벤트 + Discord 대화량
   - 활용: `opened → reviewed → merged/closed` 전환 흐름 파악, 병목 구간 식별

3. **커뮤니티-개발 연계 분석**
   - 입력: 월별 Discord 메시지량 vs GitHub 이벤트량
   - 활용: 커뮤니케이션 증가가 코드 활동으로 이어지는지 상관/시차 분석

## 10) 한계/편향 (READ ONLY 관점)

- **수집 커버리지 편향**: release 계열 이벤트가 희소하여 배포 단계 해석이 과소평가될 수 있음
- **채널 집중 편향**: Discord 상위 채널 비중이 높아 전체 커뮤니티 의견 대표성이 낮을 수 있음
- **권한 기반 관측 한계**: Workers/KV, R2 객체 단위 메타 미포함으로 end-to-end 데이터 흐름 복원이 제한됨
- **정의 체계 부재**: `glossary_terms` 미구축으로 지표 해석이 분석가별로 달라질 위험 존재

## 11) 추천 지표 정의 (초안)

1. **개발 활동 지수 (Dev Activity Index)**
   - 정의: `(Push 수 + PR 생성 수 + Issue 생성 수)`를 기간별로 정규화한 지표
   - 목적: 저장소/조직 단위 활동성 비교

2. **협업 전환율 (Collab Conversion Rate)**
   - 정의: `PR merged 수 / PR opened 수` (동일 기간)
   - 목적: 코드 리뷰/통합 효율 측정

3. **대화-개발 연계율 (Talk-to-Code Ratio)**
   - 정의: `Discord 메시지 수 / (Push + PR + Issue 이벤트 수)`
   - 목적: 커뮤니케이션 대비 실개발 산출 강도 측정

4. **이벤트 다양성 지수 (Event Mix Diversity)**
   - 정의: 이벤트 타입 분포의 엔트로피(또는 상위 타입 집중도 역수)
   - 목적: 활동이 특정 이벤트에 과도 집중되는지 진단

5. **데이터 신뢰도 커버리지 (Coverage Score)**
   - 정의: 핵심 도메인(코드/협업/배포/대화) 중 실제 관측 가능한 도메인 비율
   - 목적: 분석 결과 해석 시 신뢰 범위 명시

## 12) 제약/한계

- Workers/KV는 현재 토큰 권한 미포함으로 조회 불가
- R2는 버킷 목록까지 확인(객체 단위 인벤토리는 별도 권한/절차 필요)
