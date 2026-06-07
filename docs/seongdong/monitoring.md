# 모니터링 vs Analytics 구분

## 개요

ExperiBase의 데이터 분석 UI는 두 레이어로 나뉜다:

| 구분 | 위치 | 데이터 소스 | 분석 단위 |
|---|---|---|---|
| **이벤트 분석** | 사이드바 > 이벤트 분석 | `event_log` 테이블 | 프로젝트 전체 |
| **실험 모니터링** | 실험 상세 > 모니터링 탭 | `experiment_event` 테이블 | 특정 실험 |

---

## 사이드바 "이벤트 분석" (프로젝트 전체 분석)

### 역할
프로젝트에서 발생한 **모든 사용자 행동 이벤트**를 분석하는 공간.  
실험과 무관하게 제품 전체의 사용 패턴을 파악한다.

### 세 가지 분석 뷰

**트렌드 (Trend)**
- 이벤트 발생 건수를 시계열로 시각화
- 예: "checkout_completed" 이벤트가 최근 7일간 얼마나 발생했나
- 사용 목적: 기능 사용 추이, 이상치 탐지

**퍼널 (Funnel)**
- 여러 이벤트의 순차적 전환율 분석
- 예: page_view → add_to_cart → checkout_started → purchase_completed
- 각 단계별 드롭오프 비율 계산
- 사용 목적: 전환 병목 구간 파악

**리텐션 (Retention)**
- 코호트 기반 재방문/재사용 분석
- 예: 특정 날 첫 방문 사용자가 D+1, D+7, D+30에 얼마나 돌아왔나
- `person` 테이블의 `cohort_id` 기준으로 그룹화
- 사용 목적: 제품 습관 형성 여부 측정

### 데이터 수집 경로
```
sdk.track('event_name', { ...properties })
    │
    ▼
POST /capture → event_log 테이블
  - user_id
  - cohort_id (person 테이블에서 join)
  - event_name
  - properties (JSON)
  - event_time
  - project_id
```

---

## 실험 상세 "모니터링" 탭 (실험별 실시간 추적)

### 역할
**특정 실험**의 impression과 conversion을 실시간으로 추적하고 통계적 유의성을 계산한다.

### 표시 데이터

**Impression 현황**
- 전체 노출 수 및 variant별 분포 (`by_variant`)
- 페이지별 노출 분포 (`by_url`)
- 날짜별 시계열 추이 (`time_series`)

**Conversion 현황**
- variant별 전환 수 및 전환율
- 전환율 = conversion_count / impression_count per variant

**통계적 유의성**
- p_value, is_significant (p < 0.05), winner

**이상 감지 (Anomaly)**
- 전환 수 > 노출 수인 variant 경고 (이벤트 연동 오류 의심)

### 데이터 수집 경로

```
experiment_event 테이블
  - event_type: "impression" | "conversion"
  - experiment_key: flag_key 또는 placement_key
  - experiment_id: 실험 ID (옵션)
  - variant: 'control' | 'treatment' | ...
  - user_id
  - url (impression 시 현재 페이지 경로)
  - event_time
```

`experiment_id` 또는 `experiment_key(flag_key)` 중 하나만 있어도 집계 가능:
```python
# experiment_analytics.py:63
WHERE event_type = ?
  AND (experiment_id = ? OR experiment_key = ?)
```

---

## A/B 테스트 Placement: SDK 자동 수집

A/B 테스트는 Feature Flag 기반이므로 SDK가 impression을 자동으로 수집한다.

```
sdk.decide('new-checkout-flow')
                │
                ├── 응답: { variant: 'treatment' }
                │
                └── 자동 fire-and-forget
                    POST /events {
                      type: 'impression',
                      key: 'new-checkout-flow',
                      variant: 'treatment',
                      url: '/checkout',
                      user_id: 'uuid-xxx'
                    }
```

**개발자가 별도 코드 작성 없이** 노출 이벤트가 수집된다.  
전환 이벤트(`track()`)만 명시적으로 호출하면 된다.

```ts
// impression: 자동
const result = await sdk.decide('new-checkout-flow')

// conversion: 수동
await sdk.track('purchase_completed', {
  placement_key: 'new-checkout-flow',
  variant: result.variant,
})
```

---

## 준실험 Placement: 수동 payload 입력 기반

준실험은 사용자가 특정 경험에 **자연스럽게 노출**되는 것을 관찰하므로, 전환 이벤트 정의가 핵심이다.

```
sdk.decide('lvup-reflection-v2')
                │
                ├── 서버에서 cohort/role/시간 조건 검사
                │
                ├── 응답: { show: true, payload: { completed: false } }
                │
                └── 자동 impression 수집 (show=true인 경우)
                    POST /events {
                      type: 'impression',
                      key: 'lvup-reflection-v2',
                      variant: 'treatment',
                      ...
                    }

사용자가 반성 제출
                │
sdk.track('reflection_submitted', {
  placement_key: 'lvup-reflection-v2',
  variant: 'treatment',
  // 추가 맥락 정보
  completion_rate: 0.87,
  team_size: 5,
})
                │
                ├── POST /capture → event_log (이벤트 분석용)
                └── POST /events { type: 'conversion' } → experiment_event
```

**준실험에서 payload가 중요한 이유**: Placement의 `completed`, `reason` 등 상태 정보를 `payload`로 받아 UI 분기 처리에 활용한다. 이 정보는 이벤트로 별도 저장되지 않으므로 필요 시 `track()` properties에 포함해야 한다.

---

## 통계적 유의성 계산 방식

### 알고리즘: 2-proportion z-test

코드 위치: `backend/app/services/experiment_analytics.py`

```python
def _two_proportion_z_test(n1, x1, n2, x2):
    # n1, x1 = control impression, conversion
    # n2, x2 = treatment impression, conversion
    p_pool = (x1 + x2) / (n1 + n2)          # 풀링된 전환율
    se = sqrt(p_pool * (1-p_pool) * (1/n1 + 1/n2))  # 표준 오차
    z = ((x2/n2) - (x1/n1)) / se            # z-통계량
    p_value = 2 * (1 - Φ(|z|))              # 양측 검정
```

### 판정 기준

| 조건 | 결과 |
|---|---|
| p_value < 0.05 | `is_significant = True` |
| p_value ≥ 0.05 | `is_significant = False` |
| treatment rate > control rate | `winner = treatment_variant_name` |
| control rate ≥ treatment rate | `winner = 'control'` |

**신뢰 수준**: 95% (α = 0.05 고정)

### Primary treatment 선정 기준
treatment variant가 여러 개인 경우 **impression이 가장 많은 variant**를 primary test 대상으로 선택한다.

### 이상 감지 (Anomaly Detection)
```python
# conversion > impression인 variant 탐지
if conv_count > imp_count:
    AnomalyWarning("전환 수가 노출 수를 초과합니다. 이벤트 연동을 확인하세요.")
```

이는 `track()`을 `decide()` 없이 호출하거나 이벤트 key 불일치 시 발생한다.

### SRM (Sample Ratio Mismatch) 감지
`experiment.py`의 `get_result()`에서 `chi2_contingency`로 SRM 체크:
```python
_, p_value, _, _ = chi2_contingency(
    [[t_total, c_total], [t_total + c_total, t_total + c_total]]
)
srm_warning = bool(p_value < 0.01)
```
variant 간 사용자 수 비율이 예상치와 크게 다를 때 `srm_warning = True`. 이 경우 실험 결과 신뢰도가 낮으므로 Flag Rule의 rollout_pct 설정을 재확인해야 한다.
