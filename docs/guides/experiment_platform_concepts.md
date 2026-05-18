Status: active
Last-Validated: 2026-05-18
Owner: experiment-lab

# 실험 플랫폼 개념 가이드

이 문서는 실험 플랫폼, feature flag, segment 개념이 익숙하지 않은 인프라/백엔드/프론트엔드 개발자가 현재 코드와 운영 구조를 빠르게 이해하기 위한 첫 진입 문서입니다.

대상 독자는 개발 경험은 있지만 A/B 테스트, 실험 설계, 머신러닝, 데이터 분석 용어에 익숙하지 않은 사람입니다.

---

## 0. 먼저 이렇게 생각하기

실험 플랫폼은 고등학교에서 급식 메뉴를 바꿔도 되는지 확인하는 과정과 비슷합니다.

학교가 기존 김치볶음밥 대신 새 치킨마요 메뉴를 도입하고 싶다고 가정합니다. 전교생에게 바로 새 메뉴를 주면 위험합니다. 맛이 없을 수도 있고, 비용이 많이 들 수도 있고, 불만이 많을 수도 있습니다.

그래서 일부 학생에게만 새 메뉴를 줘보고 반응을 비교합니다.

```text
기존 메뉴를 먹은 학생들 = control
새 메뉴를 먹은 학생들 = treatment
```

그리고 질문을 세웁니다.

```text
치킨마요를 주면 학생들이 급식을 더 많이 먹을까?
```

이 질문과 기준을 묶은 것이 `Experiment`입니다.

개발로 바꾸면 다음과 같습니다.

```text
질문:
스터디 목록 화면을 바꾸면 신청 버튼 클릭이 늘어날까?

기존 버전:
현재 스터디 목록 화면

새 버전:
새 카드형 스터디 목록 화면

성공 기준:
신청 버튼 클릭률

대상:
최근 활동한 사용자 일부
```

이처럼 실험은 “새 기능이 진짜 좋은지 작은 범위에서 확인하는 방법”입니다.

---

## 1. 한 줄 요약

실험 플랫폼은 **사용자에게 서로 다른 경험을 보여주고, 어떤 경험이 더 나은지 데이터로 판단하는 시스템**입니다.

예를 들어 스터디 목록 화면을 바꾸는 경우:

1. 일부 사용자는 기존 화면을 봅니다. 이 그룹을 `control`이라고 부릅니다.
2. 일부 사용자는 새 화면을 봅니다. 이 그룹을 `treatment` 또는 특정 variant 이름으로 부릅니다.
3. 누가 어떤 화면을 봤는지 `exposure`로 기록합니다.
4. 이후 신청률, 클릭률, 재방문 같은 지표를 비교합니다.
5. 결과가 좋으면 새 화면을 전체 배포하고, 나쁘면 롤백합니다.

---

## 2. 실험은 껍데기인가

구현 관점에서는 어느 정도 맞습니다. `Experiment`는 직접 화면을 바꾸는 스위치라기보다 여러 정보를 묶는 관리 단위입니다.

하지만 그냥 빈 껍데기는 아닙니다. 실험이 있어야 다음 정보를 한곳에서 관리할 수 있습니다.

```text
Experiment
  - 왜 하는가: hypothesis
  - 무엇을 비교하는가: variants
  - 누구에게 보여주는가: segment / assignment
  - 어떻게 노출하는가: feature flag / rule
  - 무엇으로 판단하는가: primary metric
  - 결과는 어땠는가: result
  - 그래서 어떤 결정을 했는가: decision
```

Feature flag는 “스위치”입니다. Segment는 “대상자 목록”입니다. Exposure는 “누가 무엇을 봤는지 기록”입니다. Metric은 “성공 여부를 판단하는 숫자”입니다.

Experiment는 이 요소들을 묶어서 “이 변경이 효과 있었는가?”를 판단하게 만드는 실험 계획서입니다.

---

## 3. 핵심 용어

| 용어 | 쉬운 설명 | 현재 코드/DB에서의 의미 |
|---|---|---|
| Experiment | 비교하려는 실험 단위 | `experiments`, `variants`, `assignments` |
| Variant | 사용자가 보게 되는 버전 | `control`, `treatment`, `list`, `sidebar` 등 |
| Feature Flag | 런타임 기능 스위치 | `feature_flag` |
| Segment | 사용자 그룹 | `feature_segment`, `feature_segment_member` |
| Rule | 어떤 segment에 어떤 variant를 줄지 정하는 조건 | `feature_flag_rule` |
| Exposure | 사용자가 실제로 어떤 flag/variant를 평가받았는지 기록 | `feature_flag_exposure` |
| Rollout | 몇 퍼센트에게 켤지 정하는 비율 | `rollout_pct` |
| Metric | 실험 성공 여부를 판단할 지표 | 예: 신청률, 클릭률, 세션 참여율 |

---

## 4. 개발자가 기억할 최소 모델

처음에는 아래 6개만 기억해도 충분합니다.

| 개념 | 비유 | 개발 관점 |
|---|---|---|
| Experiment | 실험 계획서 | 왜, 무엇을, 어떤 기준으로 비교할지 저장 |
| Feature Flag | 스위치 | 사용자에게 어떤 버전을 보여줄지 결정 |
| Segment | 대상자 명단 | 누구에게 실험할지 정함 |
| Rule | 조건문 | 이 대상자에게 이 variant를 몇 퍼센트 줄지 정함 |
| Exposure | 출석부 | 누가 어떤 variant를 봤는지 기록 |
| Metric | 성적표 | 결과가 좋아졌는지 판단하는 숫자 |

가장 단순한 흐름은 다음과 같습니다.

```text
Experiment를 만든다
  → Feature Flag로 사용자에게 버전을 나눠 보여준다
  → Exposure를 기록한다
  → Metric을 비교한다
  → Ship / Hold / Rollback을 결정한다
```

---

## 5. Feature Flag는 무엇인가

Feature flag는 코드 배포 없이 기능을 켜고 끄는 스위치입니다.

예를 들어 `new_study_layout`이라는 flag가 있으면 애플리케이션은 API에 묻습니다.

```text
GET /api/v1/feature-flags/decide?flag_key=new_study_layout&user_id=user-1
```

응답이 `control`이면 기존 레이아웃을 보여주고, `list` 또는 `sidebar` 같은 값이면 새 레이아웃 중 해당 버전을 보여줍니다.

인프라 관점에서는 feature flag를 **배포와 기능 활성화를 분리하는 운영 장치**로 보면 됩니다. 코드는 이미 배포되어 있어도, flag를 꺼두면 사용자에게 노출되지 않습니다.

---

## 6. Segment는 무엇인가

Segment는 실험이나 feature flag의 대상자 그룹입니다.

예시:

| Segment | 의미 |
|---|---|
| `project_members` | 프로젝트에 참여한 적 있는 사용자 |
| `discord_active_users` | 최근 N일 안에 Discord에서 활동한 사용자 |
| `manual_beta_users` | 운영자가 직접 넣은 베타 사용자 |

Segment는 두 종류가 있습니다.

| 종류 | 설명 | 사용 시점 |
|---|---|---|
| `manual` | API 요청으로 user id 목록을 직접 넣음 | 소규모 테스트, 베타 사용자 |
| `query` | 서버에 등록된 안전한 query template으로 D1에서 계산 | 운영 데이터 기반 대상자 |

중요한 점은 사용자가 raw SQL을 직접 입력하지 않는다는 것입니다. query-backed segment는 서버 코드에 등록된 allowlist만 실행합니다.

---

## 7. Rule은 무엇인가

Rule은 feature flag가 segment를 어떻게 사용할지 정하는 조건입니다.

예시:

```text
flag: new_study_layout
segment: discord_active_users
rollout_pct: 30
variant: sidebar
```

이 rule은 “최근 Discord 활동자 중 30%에게 `sidebar` variant를 보여준다”는 뜻입니다.

Rule이 없거나 rule에 매칭되지 않으면 flag의 기본 rollout 설정이 적용됩니다. flag가 꺼져 있거나 archived 상태면 안전하게 `control`을 반환합니다.

---

## 8. Exposure는 무엇인가

Exposure는 사용자가 어떤 feature flag 결과를 받았는지 남기는 로그입니다.

예시:

| flag_key | user_id | variant | reason |
|---|---|---|---|
| `new_study_layout` | `user-1` | `sidebar` | `rule:active_users` |
| `new_study_layout` | `user-2` | `control` | `rule:active_users:rollout_miss` |

분석에서는 exposure가 매우 중요합니다. 나중에 “새 레이아웃을 본 사람들의 신청률이 올랐나?”를 보려면, 먼저 누가 새 레이아웃을 봤는지 알아야 합니다.

현재 decide API는 기본적으로 exposure를 기록합니다. 기록을 남기지 않을 때는 `track=false`를 사용할 수 있습니다.

```text
GET /api/v1/feature-flags/decide?flag_key=new_study_layout&user_id=user-1&track=false
```

---

## 9. 현재 데이터 흐름

현재 구조는 다음처럼 이해하면 됩니다.

```text
pseudolab-main D1
  Discord/GitHub/성장시스템 동기화 데이터
  예: dl_project_members, discord_messages

        ↓ allowlisted query template

Segment refresh
  feature_segment_member에 사용자 스냅샷 저장

        ↓ rule에서 segment 참조

Feature Flag decide
  사용자별 variant 계산

        ↓

Exposure logging
  feature_flag_exposure에 노출 기록 저장

        ↓

Analysis
  variant별 결과 지표 비교
```

---

## 10. 현재 주요 API

Feature flag:

| API | 역할 |
|---|---|
| `GET /api/v1/feature-flags` | flag 목록 조회 |
| `POST /api/v1/feature-flags` | flag 생성 |
| `PATCH /api/v1/feature-flags/{flag_key}` | flag 설정 변경 |
| `POST /api/v1/feature-flags/{flag_key}/archive` | flag 보관 |
| `POST /api/v1/feature-flags/{flag_key}/restore` | flag 복구 |
| `GET /api/v1/feature-flags/decide` | 사용자별 variant 결정 |
| `GET /api/v1/feature-flags/{flag_key}/exposures` | 노출 로그 조회 |
| `GET /api/v1/feature-flags/{flag_key}/exposure-summary` | 노출 요약 조회 |

Segment and rule:

| API | 역할 |
|---|---|
| `GET /api/v1/segments` | segment 목록 조회 |
| `GET /api/v1/segments/query-templates` | 서버에 등록된 query template 목록 조회 |
| `POST /api/v1/segments` | segment 생성 |
| `POST /api/v1/segments/{segment_id}/refresh` | segment 멤버 스냅샷 갱신 |
| `GET /api/v1/segments/{segment_id}/members` | segment 멤버 확인 |
| `GET /api/v1/feature-flags/{flag_key}/rules` | flag rule 목록 조회 |
| `POST /api/v1/feature-flags/{flag_key}/rules` | flag rule 생성 |
| `PATCH /api/v1/feature-flags/{flag_key}/rules/{rule_id}` | flag rule 변경 |

---

## 11. 인프라 담당자가 특히 봐야 하는 부분

### DB 역할

| DB | 역할 | 주의점 |
|---|---|---|
| `pseudolab-exp` | 실험 플랫폼 메타데이터 저장 | flag, segment, exposure, experiment 데이터 |
| `pseudolab-main` | Discord/GitHub/성장시스템 동기화 데이터 | query-backed segment의 읽기 소스 |
| Supabase raw DB | 운영 원천 DB | 실험 플랫폼/feature flag 분석에서 직접 조회하지 않음 |

### 환경변수

| 환경변수 | 역할 |
|---|---|
| `D1_DATABASE_ID` | `pseudolab-exp` 연결 |
| `D1_MAIN_DATABASE_ID` | `pseudolab-main` 연결 |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 계정 |
| `CLOUDFLARE_API_TOKEN` | D1 API 호출 인증 |

`D1_MAIN_DATABASE_ID`가 없으면 query-backed segment refresh는 실패합니다. 이는 빈 segment로 조용히 성공하는 문제를 막기 위한 의도된 동작입니다.

### 보안 원칙

문서에는 토큰, 키, connection string 값을 쓰지 않습니다. 환경변수 이름만 기록합니다.

Supabase raw DB는 운영 원천 DB입니다. 실험 플랫폼에서 직접 자유 쿼리하지 않고, D1 동기화 데이터, export, 또는 제한된 API를 기준으로 사용합니다.

---

## 12. 자주 헷갈리는 지점

| 헷갈리는 점 | 정리 |
|---|---|
| Feature flag와 experiment는 같은가 | 같지 않습니다. flag는 기능 노출 제어 장치이고, experiment는 결과 비교 단위입니다. 다만 A/B 테스트에서는 flag가 experiment 실행 수단이 됩니다. |
| Segment와 rule은 같은가 | 같지 않습니다. segment는 사용자 그룹이고, rule은 그 그룹에 어떤 variant를 줄지 정하는 조건입니다. |
| Exposure는 이벤트 로그와 같은가 | 목적이 다릅니다. exposure는 “무엇을 보여줬는지”이고, 이벤트 로그는 “사용자가 무엇을 했는지”입니다. |
| Rollout 30%는 랜덤인가 | 사용자 id와 flag/rule 정보를 이용해 결정론적으로 계산합니다. 같은 사용자는 같은 조건에서 같은 결과를 받아야 합니다. |
| query-backed segment가 항상 실시간인가 | 아닙니다. refresh 시점의 스냅샷을 `feature_segment_member`에 저장합니다. |

---

## 13. 로컬 검증 명령

백엔드 테스트:

```bash
cd backend
./venv/bin/pytest
```

프론트 테스트:

```bash
cd frontend
npm test -- --run
```

프론트 빌드:

```bash
cd frontend
npm run build
```

---

## 14. 다음 개발 방향

현재 자연스러운 다음 작업은 `/segments` 관리 UI입니다.

운영자가 UI에서 할 수 있어야 하는 일:

1. 등록된 query template을 확인한다.
2. manual 또는 query segment를 만든다.
3. segment refresh를 실행한다.
4. segment member 수와 일부 member를 확인한다.
5. feature flag rule을 만들 때 segment를 선택한다.

이 UI가 붙으면 인프라/운영 담당자는 SQL이나 API 직접 호출 없이도 실험 대상자 그룹을 점검할 수 있습니다.
