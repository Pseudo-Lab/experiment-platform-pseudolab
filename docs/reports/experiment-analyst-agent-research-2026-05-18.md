Status: active
Last-Validated: 2026-05-18
Owner: experiment-lab

# Experiment Analyst Agent Research

## 1. 결론

이 저장소에는 `Experiment Analyst` 역할을 별도 에이전트 역할로 두는 것이 맞다.

일반 웹서비스 개발에서는 주로 기능이 동작하는지, UI가 맞는지, API가 안정적인지를 확인한다. 실험 플랫폼에서는 여기에 더해 다음 질문을 반드시 확인해야 한다.

```text
이 실험 결과를 믿고 의사결정해도 되는가?
```

이 질문은 backend/frontend/infra/QA만으로는 놓치기 쉽다. 따라서 `Experiment Analyst`는 코드를 직접 많이 작성하는 역할이 아니라, 가설, 지표, 대상군, 노출 로그, 데이터 품질, 결과 해석을 검토하는 read-only 중심 역할로 둔다.

## 2. 외부 근거 요약

### Statsig

Statsig의 실험 설정 흐름은 hypothesis, exposure source, control group, ID type, primary/secondary metrics를 명시하도록 설계되어 있다.

- Primary metrics는 실험의 overall evaluation criteria로 쓰인다.
- Secondary metrics는 guardrail 또는 explanatory metric 성격이다.
- SRM(sample ratio mismatch)은 expected split과 observed allocation이 어긋난 상태이며, Statsig는 chi-squared test로 이를 감지하고 exposure export를 이용해 원인 segment를 분석하라고 안내한다.

참고:
- https://docs.statsig.com/statsig-warehouse-native/features/configure-an-experiment
- https://docs.statsig.com/experiments/create-new
- https://docs.statsig.com/experiments/monitoring/srm
- https://docs.statsig.com/stats-engine/methodologies/srm-checks

### LaunchDarkly

LaunchDarkly는 실험 audience, randomization unit, metric randomization unit, flag targeting rule의 정합성을 중요하게 다룬다.

- Experiment audience는 flag targeting rule과 연결된다.
- Randomization unit은 traffic allocation과 사용할 수 있는 metric을 결정한다.
- Metric과 experiment의 randomization unit이 맞지 않으면 결과가 왜곡될 수 있다.
- Health check는 exposure, SRM, metric event freshness, flag 상태, targeting rule/audience 정합성을 확인한다.

참고:
- https://launchdarkly.com/docs/home/experimentation/allocation
- https://launchdarkly.com/docs/home/experimentation/randomization
- https://launchdarkly.com/docs/home/experimentation/health-checks
- https://launchdarkly.com/docs/home/experimentation/types
- https://launchdarkly.com/docs/guides/statistical-methodology/sample-ratios

### Optimizely Feature Experimentation

Optimizely는 audience를 user attributes 기반으로 정의하고 flag rule/A-B test/targeted delivery에 재사용한다. 또한 experiment result를 보려면 exposure에 해당하는 `Decide` 이후 conversion event를 track해야 한다.

- Audience는 여러 flag/rule에서 재사용된다.
- Metric은 이벤트를 시간에 따라 집계해 만든다.
- 모든 experiment에는 최소 하나의 metric이 필요하다.
- Conversion event는 사용자가 flag variation에 노출된 뒤 기록되어야 결과에 연결된다.
- Bot traffic은 실험 결과를 왜곡할 수 있어 제외를 권장한다.

참고:
- https://support.optimizely.com/hc/en-us/articles/38683417490957-Target-audiences-in-Feature-Experimentation
- https://support.optimizely.com/hc/en-us/articles/38940214411149-Choose-metrics-in-Feature-Experimentation
- https://docs.developers.optimizely.com/feature-experimentation/docs/track-events

### Microsoft ExP 연구

Microsoft의 controlled experiment metric interpretation 논문은 SRM과 metric sample ratio mismatch를 실험 결과 신뢰도를 깨뜨리는 대표 문제로 설명한다.

- Treatment/control sample은 같은 모집단에서 무작위로 뽑혀야 한다.
- 기대 비율과 실제 비율이 다르면 sampling process 문제가 있을 수 있다.
- SRM은 심한 selection bias를 의미할 수 있고, 실험 결과를 무효로 만들 수 있다.
- Ratio metric은 numerator/denominator를 분해해서 해석해야 한다.

참고:
- https://www.microsoft.com/en-us/research/uploads/prod/2020/08/2017-08-KDDMetricInterpretationPitfalls.pdf

## 3. 현재 저장소 근거

현재 저장소에도 이미 분석가 역할이 필요했던 흔적이 있다.

- `docs/reports/data-analyst-report-v2.md`는 `Data Analyst Subagent`가 KPI 체계, 근거 데이터, 쿼리, 가정, 한계를 정리한 리포트다.
- `docs/reports/dataset-validation-v2.md`는 read-only 분석 스냅샷과 데이터 검증 프레임을 남겼다.
- `docs/reports/feature-flag-improvement-plan.md`는 feature flag를 segment, rule, exposure, analysis와 연결하는 방향을 정의한다.
- `docs/reports/decision-log.md`는 raw Supabase DB를 신규 실험/feature flag 분석 경로로 직접 쓰지 않고, D1 동기화 데이터/export/read-only query/API를 기준으로 삼는다고 결정했다.

즉 이 저장소에서 분석가 역할은 새 개념이 아니라, 이미 수행된 작업을 공식 역할로 고정하는 작업이다.

## 4. 권장 역할 정의

역할명: `Experiment Analyst`

기본 모드: read-only

주 책임:

1. 실험 가설이 명확한지 확인한다.
2. primary metric과 secondary/guardrail metric을 구분한다.
3. metric의 분자, 분모, unit, time window, timezone을 명시한다.
4. randomization unit과 metric unit이 맞는지 확인한다.
5. segment/query template이 실험 목적과 맞는지 확인한다.
6. exposure가 결과 event보다 먼저 기록되는지 확인한다.
7. treatment/control 분포와 SRM 위험을 점검한다.
8. 데이터 신선도, row count, 스키마 변경, 누락일을 확인한다.
9. ratio metric은 numerator/denominator를 분리해서 해석한다.
10. 실험 결과를 `ship`, `hold`, `rollback`, `rerun` 중 어떤 의사결정 후보로 볼지 근거를 제시한다.

비책임:

1. 운영 DB를 직접 수정하지 않는다.
2. raw Supabase DB를 신규 분석 경로로 직접 조회하지 않는다.
3. 제품 최종 결정을 단독으로 내리지 않는다.
4. 통계적으로 확정되지 않은 결과를 “승리”로 단정하지 않는다.
5. backend/frontend 구현을 직접 소유하지 않는다. 구현 변경이 필요하면 해당 도메인 owner에게 넘긴다.

## 5. 호출 조건

`Experiment Analyst`는 모든 작업에 필요하지 않다. 아래 조건 중 하나라도 있으면 호출한다.

1. 새 experiment 또는 feature flag가 의사결정 metric과 연결된다.
2. primary metric, guardrail metric, KPI 정의가 추가/변경된다.
3. query-backed segment, audience, targeting rule이 추가/변경된다.
4. exposure logging, assignment, rollout algorithm이 변경된다.
5. 실험 결과 readout, ship/rollback 판단, post-analysis가 필요하다.
6. 데이터 소스, 스키마, freshness, identifier mapping이 결과 해석에 영향을 준다.
7. “이 숫자를 믿어도 되는가?”가 작업의 핵심 질문이다.

필요하지 않은 경우:

1. 순수 UI 레이아웃 수정
2. 문구/i18n만 바꾸는 작업
3. 테스트/빌드 설정만 고치는 작업
4. 실험 결과 해석과 무관한 인프라 정리

## 6. 입력과 산출물

기본 입력:

1. `docs/guides/experiment_platform_concepts.md`
2. `docs/reports/feature-flag-improvement-plan.md`
3. `docs/reports/kpi-definition-v2.md`
4. `docs/reports/dataset-validation-v2.md`
5. `docs/reports/data-analyst-report-v2.md`
6. D1 read-only 스냅샷 또는 제한 API 결과

기본 산출물:

1. `docs/reports/**` 아래 분석 리포트 또는 readout
2. metric contract 초안 또는 변경 제안
3. segment/exposure 품질 체크 결과
4. 구현 owner에게 넘길 backend/frontend/infra 요구사항

템플릿:

- `docs/templates/experiment-analyst-brief.md`

## 7. 단계별 적용안

### P0

이번 변경에서 역할 정의와 템플릿을 문서화한다.

완료 기준:
- `docs/guides/agent_collaboration.md`에 `Experiment Analyst` 역할 추가
- `docs/templates/experiment-analyst-brief.md` 추가
- 본 리서치 리포트와 decision log 업데이트

### P1

Feature Flag UI와 segment/rule UI 작업에서 분석가 체크를 선택적으로 적용한다.

우선 적용 대상:
- query-backed segment 생성 UI
- rule builder
- exposure summary
- experiment result 연결 API

### P2

분석 품질 체크를 자동화한다.

후보:
- exposure split/SRM 경고 API
- metric freshness check
- metric randomization unit check
- ratio metric numerator/denominator 분해 view
- experiment readout 생성 템플릿 자동화

## 8. 최종 권고

`Experiment Analyst`는 별도 role로 둔다. 다만 모든 작은 작업마다 별도 에이전트를 강제하지는 않는다.

권장 운영 방식:

1. 일반 개발 작업은 기존 Backend/Frontend/Infra/QA 역할로 진행한다.
2. 실험 의사결정, metric, segment, exposure, result 해석이 들어오면 `Experiment Analyst`를 붙인다.
3. 분석가는 read-only로 근거와 리스크를 정리하고, 구현은 도메인 owner가 맡는다.
4. 분석 결과는 코드보다 문서/리포트/metric contract 형태로 남긴다.
