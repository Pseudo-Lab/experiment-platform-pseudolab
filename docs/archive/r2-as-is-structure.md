Status: archive
Last-Validated: 2026-03-14

# R2 AS-IS 구조 문서 (READ ONLY)

> 기준: Cloudflare R2 API 조회 결과 기반 현행 구조 기록

## 1) 조사 범위

- 대상 계정: `${CLOUDFLARE_ACCOUNT_ID}`
- 인증: `${CLOUDFLARE_API_TOKEN}` (조회)
- S3 호환 자격증명(보유):
  - `${R2_ACCESS_KEY_ID}`
  - `${R2_SECRET_ACCESS_KEY}`
  - `${R2_SESSION_TOKEN}`

## 2) 버킷 현황

조회 시점 기준 버킷 2개 확인:

1. `github-archive-raw`
2. `pseudolab-exp`

## 3) 용도 추정

- `github-archive-raw`
  - GitHub 원천(raw) 데이터 아카이브 성격
- `pseudolab-exp`
  - 실험플랫폼 실험/중간 산출물 저장 버킷

## 4) 현재 확인된 한계

토큰 권한 범위상 확인 완료:
- 버킷 목록 조회: 가능

미확인(추가 권한 또는 S3 listing 절차 필요):
- 버킷별 객체(prefix) 구조
- 객체 수/총 용량
- lifecycle/retention 정책
- public 접근 정책(CORS, policy)

## 5) 권장 추가 조회(READ ONLY)

다음은 추후 조회 권한/툴 준비 후 수행:

1. 버킷별 prefix 트리 샘플링
2. 최근 30일 업로드 추세
3. 객체 크기 분포(소형/대형)
4. 환경 분리(dev/staging/prod) 네이밍 일관성

## 6) 데이터 활용 시나리오 (분석가 관점)

1. **Raw→Curated 파이프라인 추적**
   - R2 prefix 단위로 원천(raw), 정제(curated), 파생(derived) 레이어 구분
   - D1 메타와 결합해 데이터 계보(lineage) 가시화

2. **수집 신선도(Freshness) 모니터링**
   - 객체 `last_modified` 기반으로 소스별 최신 적재 시각 추적
   - 지연 임계치 초과 시 품질 경보 지표로 활용

3. **스토리지 비용/효율 분석**
   - 객체 크기 분포 + 접근 빈도(가능 시)로 hot/cold 데이터 분리 정책 수립

## 7) 한계/편향 (READ ONLY 관점)

- **버킷 단위 관찰 편향**: 현재는 버킷 목록만 확인되어 객체 레벨 구조 해석이 불가능
- **정책 정보 공백**: lifecycle/retention/policy 미확인으로 보관 전략 평가가 제한됨
- **실사용량 추정 한계**: 객체 수·총용량·prefix 분포 부재로 비용/성능 분석 정확도 낮음

## 8) 추천 지표 정의 (R2 중심)

1. **Ingestion Freshness Lag (IFL)**
   - 정의: 현재 시각 - 최신 객체 업로드 시각(소스/prefix별)

2. **Prefix Concentration Ratio (PCR)**
   - 정의: 상위 N개 prefix가 차지하는 객체 수 또는 용량 비율

3. **Small Object Ratio (SOR)**
   - 정의: 임계 크기(예: 1MB) 이하 객체 비율
   - 목적: 과도한 소형 객체로 인한 운영비 증가 신호 탐지

4. **Retention Policy Coverage (RPC)**
   - 정의: lifecycle/retention 정책이 명시된 버킷 비율

5. **Env Segregation Score (ESS)**
   - 정의: dev/staging/prod 네이밍 규칙 충족 버킷/프리픽스 비율

## 9) 개발 참고 포인트

- D1 메타 + R2 원본/파일 구조의 책임 분리 유지
- `pseudolab-exp` 버킷을 실험 전용으로 유지하고 운영 버킷과 분리
- 장기적으로는 lifecycle 정책 문서화 필요
