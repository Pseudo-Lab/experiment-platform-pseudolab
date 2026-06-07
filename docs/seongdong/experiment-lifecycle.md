# 실험 수명주기 및 상태 머신

## 상태 전이 다이어그램

```
          ┌─────────────────┐
          │      DRAFT      │  ← 실험 생성 시 초기 상태
          └────────┬────────┘
                   │ (검증 통과 후)
                   ▼
          ┌─────────────────┐
          │  PROVISIONING   │  ← (예약: 오케스트레이션 레이어 도입 시)
          └────────┬────────┘
                   │
                   ▼
          ┌─────────────────┐
     ┌───▶│    RUNNING      │◀───┐
     │    └────────┬────────┘    │
     │             │             │ (재개)
     │      ┌──────┴──────┐      │
     │      ▼             ▼      │
     │  ┌────────┐  ┌──────────┐ │
     │  │ PAUSED │  │ STOPPING │ │
     │  └────┬───┘  └──────────┘ │
     └────────┘
                   │
                   ▼
          ┌─────────────────┐
          │   ANALYZING     │  ← 데이터 수집 완료, 분석 중
          └────────┬────────┘
                   │
                   ▼
          ┌─────────────────┐
          │   CONCLUDED     │  ← 최종 결론 도출 완료
          └─────────────────┘
```

코드 참조: `backend/app/schemas/experiment.py`의 `VALID_TRANSITIONS`

---

## RUNNING 전환 시 필수 조건

`draft → running` 전환은 `_validate_running_preconditions()`에서 검증한다.

### 공통 조건 (모든 실험 타입)
- `primary_metric` 설정 필수

### A/B 테스트 전용 추가 조건
1. **Feature Flag 연결**: `flag_key`가 설정되고, 해당 flag가 존재하며 archived 상태가 아닐 것
2. **Placement 연결**: control을 제외한 모든 variant에 Placement가 연결되어 있을 것
   - `experiment_placement_config` 테이블의 `variant_key` 컬럼으로 확인

```python
# backend/app/services/experiment.py:337
async def _validate_running_preconditions(self, current, patch):
    # paused → running 재개는 재검증 생략 (이미 통과한 상태)
    if current.status == ExperimentStatus.PAUSED:
        return

    # primary_metric 필수
    if not next_primary_metric:
        raise HTTPException(422, "primary_metric을 먼저 설정해야 합니다")

    # A/B 테스트만 아래 검증
    if next_experiment_type != "ab_test":
        return

    # Feature Flag 연결 필수
    if not next_flag_key:
        raise HTTPException(400, "Feature flag must be connected before starting")

    # 모든 non-control variant에 placement 연결 필수
    for variant in current.variants:
        if variant.name != "control" and variant.name not in covered:
            raise HTTPException(400, "All non-control variants must have a placement")
```

---

## Temporal 기반 오케스트레이션 레이어 설계 (제안)

현재 ExperiBase는 상태 전이를 API 호출 기반으로 처리한다. 실험 규모가 커지고 자동화가 필요해지면 **Temporal** 워크플로우 엔진 도입이 적합하다.

### 현재 구조의 한계
- 상태 전이 트리거가 모두 수동 (대시보드 버튼 클릭)
- 실험 시작/종료 시간 자동 제어 없음
- 장애 발생 시 중간 상태 복구 불가

### Temporal 도입 설계

```
[ExperiBase API]
      │ experiment.start()
      ▼
[Temporal Client]
      │ StartWorkflow("ExperimentOrchestrator", experiment_id)
      ▼
[ExperimentOrchestrator Workflow]
  ├── Activity: ProvisionFlag(flag_key)
  │     └── Feature Flag enabled = true, rollout_pct 설정
  ├── Activity: WaitForStartTime(start_at)
  │     └── Timer signal
  ├── Activity: TransitionToRunning(experiment_id)
  │     └── status = "running"
  ├── Activity: MonitorUntilEndTime(end_at)
  │     └── 주기적 SRM 체크, 이상 감지 시 Signal
  ├── Activity: TransitionToAnalyzing(experiment_id)
  │     └── status = "analyzing"
  └── Activity: GenerateReport(experiment_id)
        └── 통계 계산 + Slack 알림
```

### 워크플로우 신호(Signal) 설계
- `pause`: 실험 일시 정지 (트래픽 이상 감지 시 자동 트리거 가능)
- `resume`: 실험 재개
- `terminate`: 조기 종료 (명확한 winner 확인 시)

### 장점
- 실험 상태가 Temporal이 관리 → 서버 재시작에도 안전
- 분산 트랜잭션: Flag provision + DB 업데이트를 atomic하게 처리
- 재시도/타임아웃 내장

---

## 확장 방향

### Multi-armed Bandit
현재 A/B 테스트는 고정 traffic split (50/50 or flag rule 기반). Bandit 알고리즘 도입 시:
- Thompson Sampling 기반 variant별 prior 업데이트
- Temporal 워크플로우에서 주기적으로 conversion rate 조회 → flag rollout_pct 동적 조정
- `feature_flag_rule.rollout_pct`를 Bandit 에이전트가 실시간 변경

```python
# 예시: Bandit 에이전트 주기 실행 (Temporal Activity)
async def update_bandit_allocation(experiment_id: str):
    stats = await get_variant_stats(experiment_id)
    new_weights = thompson_sampling(stats)
    for variant, weight in new_weights.items():
        await update_flag_rule_rollout(flag_key, variant, weight)
```

### Cross-experiment Interference 감지
동일 사용자가 여러 실험에 동시 참여할 경우 interaction effect 발생 가능:
- `experiment_assignments` 조인으로 중복 참여 사용자 탐지
- 실험 간 상관관계 분석 (Pearson correlation on conversion events)
- 대시보드에 "충돌 실험" 경고 배지 표시

### AI 자율 실험 루프
```
[AI Agent]
    │ 1. 가설 생성 (LLM: 과거 실험 결과 학습)
    │    └── POST /experiments (draft 생성)
    │
    │ 2. 실험 설정 자동화
    │    ├── Feature Flag 생성
    │    ├── Placement 연결
    │    └── primary_metric 자동 선택
    │
    │ 3. Temporal 워크플로우 실행
    │    └── RUNNING → ANALYZING → CONCLUDED
    │
    │ 4. 결과 해석 (LLM)
    │    ├── learning_note 자동 생성
    │    └── 다음 실험 가설 제안
    └────┘ (루프 반복)
```

Anthropic Claude API를 `learning_note` 생성과 가설 추출에 활용:
- `claude-opus-4-8`: 실험 결과 해석, 인사이트 생성
- `claude-haiku-4-5`: 실험 파라미터 자동 분류, 라벨링
