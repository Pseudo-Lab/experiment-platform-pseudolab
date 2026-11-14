Status: active
Last-Validated: 2026-11-15

# 데이터 저장소 설정과 접근

Iterglow는 설치 운영자가 준비한 Cloudflare D1·R2를 사용합니다. 특정 조직의 DB·사용자 데이터·팀 계정은 설치 전제가 아닙니다. 이 가이드는 현재 구현의 연결 설정과 접근 경계를 설명합니다.

## 저장소 역할

| 설정 | 역할 | 필요 범위 |
| --- | --- | --- |
| `D1_DATABASE_ID` | 프로젝트·실험·설정·수집 이벤트 저장 | 실험 플랫폼 기능 |
| `D1_MAIN_DATABASE_ID` | 기존 allowlisted query segment·조직 대시보드의 별도 소스 | 해당 기능 사용 시 |
| `R2_BUCKET_NAME` | 첨부파일 객체 저장 | 첨부파일 기능 사용 시 |

DB·bucket 이름은 자신의 설치에 맞게 선택합니다. 설정값은 ID와 bucket 이름이며 예전 팀 운영 리소스를 사용할 필요가 없습니다. R2 bucket 이름은 명시적으로 설정해 코드의 과거 기본값에 의존하지 않습니다.

현재 query segment 템플릿은 특정 외부 소스 테이블을 전제로 합니다. `D1_MAIN_DATABASE_ID`에 임의 DB를 연결하는 것만으로 모든 서비스의 사용자 속성을 지원하지 않습니다. manual segment와 구분하고 사용할 template의 스키마를 확인해야 합니다. 사용자 속성 기반의 범용 세그먼트별 결과 분석은 [#23](https://github.com/Pseudo-Lab/experiment-platform-pseudolab/issues/23)의 후속 범위입니다.

## 자신의 Cloudflare 리소스 준비

1. [Cloudflare D1 시작 가이드](https://developers.cloudflare.com/d1/get-started/)에 따라 자신의 계정에 개발용 D1 생성 및 database ID 확인.
2. 자신의 Cloudflare account ID와 D1 읽기·쓰기 API token 준비. 앱은 Workers binding이 아닌 [D1 HTTP API](https://developers.cloudflare.com/api/resources/d1/)를 사용하므로 backend 환경에 세 값 설정.
3. [마이그레이션](../../backend/migrations/)의 스키마·seed·선행 조건 검토. 빈 DB 초기화의 현재 제약은 [설치 가이드](setup_guide.md#새-db-초기화의-현재-제한) 참고.
4. 첨부파일 사용 시 자신의 R2 bucket 생성 후 해당 bucket의 Object Read & Write S3 자격증명 발급. [R2 인증 가이드](https://developers.cloudflare.com/r2/api/tokens/) 참고.

```dotenv
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_API_TOKEN=your-d1-api-token
D1_DATABASE_ID=your-experiment-database-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_BUCKET_NAME=your-attachment-bucket
```

D1 API token과 R2 S3 access key는 서로 다른 자격증명입니다. 값은 자신의 `backend/.env`나 배포 환경의 secret 저장소에 보관하고 저장소에 커밋하지 않습니다. API token은 필요한 계정·권한 범위로 제한하며 R2 키도 대상 bucket으로 제한합니다.

## 서비스 연동과 접근 권한

- 연동 서비스에서 사용자 식별자·수집 이벤트·목표 지표 정의. 수집에 필요한 최소 정보만 전달.
- 공개 SDK 키: 해당 프로젝트의 SDK 호출용. 관리자 계정·서버 자격증명과 별도 관리.
- 일반 계정: 자신의 프로젝트와 공유받은 역할 범위의 기능 사용. 설치 전체 분석·세그먼트·placement 등 관리자 전용 기능과 구분.
- 분석: 권한이 적용된 결과·집계 API 우선 사용. DB 직접 접근이나 export가 필요하면 설치 운영자가 대상·범위·보관 기준 결정.
- 외부 서비스의 원천 DB: Iterglow가 범용적으로 직접 연결·조회하는 기능은 아님. 서비스별 수집 계약·제한 API·명시적 동기화 경로로 필요한 데이터 제공.

백엔드는 실험 설정·사용자 행동 수집 등에서 D1에 **읽기와 쓰기**를 수행합니다. 읽기 전용 분석 계정과 앱 런타임 자격증명을 혼용하지 않습니다.

## 개발·검증 기준

- 운영과 분리된 자신의 개발 DB·bucket 및 합성 데이터 사용.
- 테스트는 backend의 기존 fixture 사용. D1 설정 누락을 자동 mock 동작이나 수집 성공으로 간주 금지.
- query segment refresh에 `D1_MAIN_DATABASE_ID`가 없으면 실패 처리. 빈 세그먼트 생성 성공과 구분.
- migration·데이터 정리 전 대상과 보존·복구 기준 확인. 개발 테스트를 실제 운영 DB에 쓰는 방식으로 실행 금지.
- 원문 사용자 데이터·키·토큰을 로그·이슈·문서에 게시 금지.

추가 접근 권한은 자신의 설치 운영자에게 요청합니다. 특정 팀원의 개인 계정이나 기존 조직의 접근 권한을 요구하지 않습니다.
