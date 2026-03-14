Status: archive
Last-Validated: 2026-03-14

# Cloudflare 조사 노트 (실험플랫폼)

> 목적: Cloudflare 계정/리소스 현황을 READ ONLY로 조사하고, 향후 실험플랫폼 개발 시 참고할 수 있는 기준 문서를 유지한다.

## 1) 조사 원칙

- **조회 전용(READ ONLY)**
- 금지: `INSERT`, `UPDATE`, `DELETE`, `ALTER`, `DROP`, `CREATE`
- 허용: 계정/리소스 목록 조회, 스키마/메타데이터 조회

## 2) 사용 환경

- Account: `${CLOUDFLARE_ACCOUNT_NAME:-unknown}`
- `CLOUDFLARE_ACCOUNT_ID`: `${CLOUDFLARE_ACCOUNT_ID}`
- 인증: `${CLOUDFLARE_API_TOKEN}` (환경변수 참조만 표기, 값 미기록)
- 작업 경로: `/home/ubuntu/.openclaw/experiment-platform-pseudolab`

## 3) 현재 확인된 리소스

### 3.1 D1

- `pseudolab-exp` (`${D1_DATABASE_ID}`)
  - 용도 추정: 실험/검증
  - 상태: 거의 빈 상태
- `pseudolab-main` (`${D1_MAIN_DATABASE_ID:-unknown}`)
  - 용도 추정: 메인 데이터 저장소
  - 상태: 다수의 테이블/인덱스 존재

### 3.2 R2

- `github-archive-raw`
- `pseudolab-exp`

### 3.3 Zone

- 현재 account 기준 Zone: `0개`
- 해석: DNS/WAF/CDN Zone 운영보다는 D1/R2 중심 데이터 계정으로 사용 중일 가능성

## 4) API 권한 상태

- 조회 성공:
  - Account 조회
  - D1 목록/단건 조회
  - R2 버킷 조회
  - Zones 조회
- 조회 실패:
  - Workers Scripts (`10000 Authentication error`)
  - KV Namespaces (`10000 Authentication error`)

### 권한 해석

현재 토큰은 D1/R2/Account 조회 권한은 포함되어 있으나, Workers/KV 권한은 미포함.

## 5) D1 스키마 조사 결과(요약)

### 5.1 `pseudolab-exp`

- 확인된 테이블: `_cf_KV`
- 의미: 실험플랫폼 도메인 테이블은 아직 본격 구성 전

### 5.2 `pseudolab-main`

다음 계열 테이블 다수 확인:

- 카탈로그/메타
  - `catalog_datasets`, `catalog_columns`
- 용어사전
  - `glossary_terms`, `glossary_backfill_conflicts`
- 통계/메시지
  - `daily_stats`, `discord_messages`, `discord_watermarks`
- GitHub 이벤트(Data Lake) 계열
  - `dl_push_events`, `dl_pull_request_events`, `dl_issues_events`, `dl_issue_comment_events`,
    `dl_release_events`, `dl_watch_events`, `dl_fork_events`, `dl_create_events`, `dl_delete_events`,
    `dl_member_events`, `dl_gollum_events`, `dl_public_events`,
    `dl_pull_request_review_events`, `dl_pull_request_review_comment_events` 등
- 마이그레이션
  - `d1_migrations`

또한 이벤트/도메인 조회 최적화를 위한 인덱스 다수 존재.

## 6) 개발 참고 포인트

1. **실험환경 분리 유지**
   - `pseudolab-exp`: 실험/스테이징
   - `pseudolab-main`: 운영/기준

2. **초기 실험 스키마 설계 위치**
   - 신규 기능은 우선 `pseudolab-exp`에 적용 후 검증

3. **R2 연계 설계**
   - 원본/중간산출물 저장: `pseudolab-exp` 버킷
   - 대용량 아카이브는 `github-archive-raw`와 용도 분리

4. **권한 모델**
   - 운영 자동화 전용 토큰과 조회 전용 토큰 분리 권장

## 7) 추후 TODO

- [ ] `pseudolab-main`의 핵심 테이블 관계(ERD Lite) 문서화
- [ ] `pseudolab-exp` 초기 스키마 제안서 작성
- [ ] 실험플랫폼 서비스 레이어 기준 D1 쿼리 패턴/인덱스 전략 정리
- [ ] Workers/KV 분석 필요 시 관리자에게 read 권한 추가 요청

## 8) 재현 가능한 조회 커맨드 (READ ONLY)

```bash
source ~/.bashrc

curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
"https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID" | jq .

curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
"https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/d1/database" | jq .

curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
"https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/r2/buckets" | jq .

curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
"https://api.cloudflare.com/client/v4/zones?account.id=$CLOUDFLARE_ACCOUNT_ID&per_page=50" | jq .
```
