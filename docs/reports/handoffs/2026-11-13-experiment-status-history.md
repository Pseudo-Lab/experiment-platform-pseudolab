Status: active
Last-Validated: 2026-11-14

# SDK v1 상태 이력·전환 기간·불변 결과 확정 — 로컬 구현 인계

> 최신 상태: 2026-11-14 운영 반영·런타임 확인 완료([PR #39](https://github.com/Pseudo-Lab/experiment-platform-pseudolab/pull/39)). 아래의 미커밋·운영 미반영 표현은 해당 단계 당시 기록이다. 실제 Google 계정 선택·동의 및 지정 이메일 초대 수락은 아직 확인하지 않았다. 상세 근거는 [운영 반영 기록](2026-11-13-experiment-status-history.md#운영-반영-완료--2026-11-14)을 따른다.

## Task Metadata
- Task ID: iterglow-event-history-20261113
- Date: 2026-11-13
- Owner: experiment-lead-v3

## Scope
- 중지·재개·종료 후 이벤트 정책을 구현하기 전에 필요한 상태 변경 근거를 기록한다.
- 최초 기반 단계는 상태 이력만 추가했고, 아래 후속 작업에서 최초 수신 당시 중지된 신규 노출의 집계 차단을 구현했다. 초기 단계에는 W/L·확정·UI가 없었고, 최신 후속 단계에서 migration 044의 bounded_v1 및 KO/EN 화면까지 로컬 구현했다. 아래 기록은 각 단계 당시의 범위를 나타내며 최신 절을 현재 기준으로 삼는다. 신진수님은 Causal Inference Hub에 연동해 실제 사용자 입장에서 테스트와 실사용을 함께하는 초기 사용자다. 공통 정책과 검증 기준은 플랫폼 팀이 마련하며 실제 실험별 목표·기간 답변을 플랫폼 검증의 선행 조건으로 두지 않는다.
- 로컬 구현·검증만 수행했다. 커밋, GitHub 게시, 운영 DB 적용·배포, Hub 수정, 실제 실험 실행은 하지 않았다.

## Workspace
- Worktree: `/home/ubuntu/.openclaw/workspace-experiment-event-history-20261113`
- Branch: `feat/event-status-history-20261113`
- Base: `6c7ae1de3c2ebf0203124f07d5aa23852c285fb8`
- Related commits: 없음. 변경은 미커밋 상태다.
- 기존 API 검증 수정은 별도 `fix/api-validation-20261113` worktree에 유지했다. 두 작업을 합친 검증은 저장소 밖의 integration 복사본에서만 수행했다.

## Inputs Used
- `AGENTS.md`, `docs/reports/_index.md`, `docs/reports/decision-log.md`, `docs/guides/agent_collaboration.md`
- `backend/app/services/experiment.py`, 기존 migration 037/038/040, 테스트의 메모리 SQLite 구성
- 정책 검토: `/home/ubuntu/.codex/reviews/iterglow-stop-events-policy-20261113/report.md`
- 공개 Hub 설정 스냅샷: `/home/ubuntu/.codex/reviews/iterglow-event-history-20261113/hub-public-config.json`. 확인 당시 enabled=false이고 연동 키·실험 ID가 비어 있었다. 목표 이벤트 매핑은 후보 설정이며 최종 실험 계약으로 취급하지 않는다.

## Changes Made
- `backend/migrations/041_experiment_status_history.sql`: SDK v1 신규 생성과 실제 상태 변경을 SQL trigger로 기록한다. 일반 수정과 adopt-winner의 직접 SQL 경로를 함께 포괄한다.
- DB 관측 UTC 시각 `recorded_at`과 순서 ID를 사용한다. 이름 수정으로 바뀌는 `updated_at`을 상태 전환 시각으로 사용하지 않는다. 같은 시각의 행은 ID로 순서를 구분한다.
- 기존 실험의 과거 이력은 채우지 않는다. 신규 생성의 from_status=NULL은 최초 관측이며 과거 실행 시작의 증거가 아니다. 기존 행의 첫 변경만으로 그 이전 실행 구간을 복원해서는 안 된다.
- legacy, 이름 변경, 동일 상태 재시도는 추가 이력을 만들지 않는다. 상태 변경과 이력 기록은 같은 SQL 문장 안에서 성공·실패한다. 기존 FK 삭제 규칙에 따라 실험 삭제 시 이력도 삭제한다.
- `backend/tests/conftest.py`: migration 041을 메모리 테스트 DB에 적용한다.
- `backend/tests/test_experiment_status_history.py`: 생성/legacy 구분, 반복 중지·재개, 변경 없는 재시도, adopt-winner, 롤백, 이력 실패 시 상태 쓰기 차단, FK 삭제, migration 재실행·과거 이력 미생성의 8개 검증을 추가했다.
- adopt-winner 테스트만 기존 migration 028의 forced_variant 컬럼을 보충한다. 공유 테스트 스키마 누락에 대한 fixture 보정이며 운영 스키마 변경이 아니다.

## Validation
- 신규 테스트: 8 passed.
- 이 작업 단독 전체 백엔드: 571 passed, 6 warnings.
- 기존 API 검증 수정까지 합친 격리 integration 복사본: 609 passed, 6 warnings.
- `git diff --check`: 통과.
- 실행은 Herdr의 t18/t19에서 수행했고 결과 로그를 별도 보관했다. SQLite/합성 데이터만 사용했다. 경고는 기존 Starlette/httpx, anyio, Pydantic 사용 관련이다.
- 로그·검토 자료: `/home/ubuntu/.codex/reviews/iterglow-event-history-20261113/`.
- Gemini/agy Hydrogen XHigh(`gemini-4-hydrogen-xhigh`)에 SQL·테스트의 읽기 전용 리뷰를 맡겼다. 추가 결함을 발견하지 않았고, Codex가 보고서를 코드·로컬 증거와 대조했다. 선택 이유는 범위가 작은 일반 코드 리뷰이기 때문이다. 이력 시각과 이벤트 시각의 표기 차이를 향후 집계에서 정규화해야 한다는 지적을 후속 주의사항에 활용했다. 비차단 테스트 확장 제안은 이 범위의 결함으로 취급하지 않았다.
- Herdr 대화형 작업자는 t1b의 맥락을 보존해 t1k에서 `--continue --dangerously-skip-permissions --model gemini-4-hydrogen-xhigh --effort xhigh`로 재개했다. 같은 작업자를 동시에 실행하지 않았다. 프로젝트 4개 파일의 SHA-256을 대조해 리뷰어가 수정하지 않았음을 확인했다. 결과: `herdr-review.md`. 검토 내용은 유효했지만 과도한 탐색과 초기 권한 대기로 검토 비용이 컸다.
- 프런트엔드 검증은 코드 변경이 없어 재실행하지 않았다. 실제 Cloudflare D1 적용과 운영 이벤트 수집은 검증하지 않았다.

## Risks / 적용 전 조건
- 기존 `backend/migrations/run_migration.sh`는 줄 끝 세미콜론에서 SQL을 나누므로 trigger 내부 문장을 잘못 분리한다. 기존 trigger migration 037/040에도 해당하는 한계다. 이 스크립트로 041을 적용하지 않는다. 기존 승인된 Ops 경로에서 trigger 전체를 처리할 수 있는 방식으로 적용하고 정의·재실행을 검증해야 한다.
- 로컬 SQLite에서 SQL 전체 적용 시 생성·상태 변경 기록을 확인했고, 기존 runner의 분할 방식을 재현하면 incomplete input으로 실패했다. 근거: `migration-path-proof.json`. 범용 runner 수정은 이 작업에 포함하지 않았다.
- 기존 이력 부재, DB 시계의 순서 역전 가능성, 상태 변경 서비스의 동시성 문제를 이 테이블만으로 해결하지 않는다. ID는 관측 순서를 제공하며 과거 실행 기간이나 클라이언트 노출의 진위를 증명하지 않는다.
- 향후 수집·집계에서 DB의 밀리초 UTC Z 표기와 이벤트의 ISO 시각 표기를 그대로 문자열 비교하지 않는다. 같은 시간 기준으로 파싱·정규화해야 한다. 현재 변경에는 이력을 읽는 집계 로직이 없다.
- 삭제 후에도 남는 감사 로그를 제공하지 않으며, DB 관리자 SQL에 대한 불변성을 보장하지 않는다. 정상 앱 경로의 상태 변경 근거다.
- 아래 후속 집계 차단도 이력 테이블을 읽지는 않는다. 새 노출의 최초 수신 상태를 INSERT 문장 안에서 관측한다. 중지 후 정책 전체가 완료된 것은 아니다.

## 후속: 중지 후 최초 수신한 새 노출의 집계 차단

- `backend/app/services/event.py`: SDK v1 실험 노출을 원본으로 수신할 때, INSERT 문장 내부의 scoped EXISTS로 `running` 여부를 판정해 `properties.sdk_exposure_eligible`에 0/1을 저장한다. id/project/flag/type/event_model 조건을 함께 확인하고 클라이언트가 보낸 동일 이름의 값은 제거한다. 사전 검증과 쓰기 사이의 상태 변경도 INSERT 시점에 반영한다.
- 원본 저장과 기존 202 응답은 유지한다. 실험 노출의 집계 자격을 구분한 것이며 raw 영구 보관 정책이나 모든 오류의 2xx 변환을 추가하지 않았다. 저장 실패는 기존 실패 응답을 유지한다.
- `backend/app/services/sdk_events.py`: 명시적으로 제외된 노출은 결과·라이브·SRM·available-events의 노출 집계에서 제외하고 후속 행동의 귀속 근거로도 사용하지 않는다. 과거 수집기의 marker 없는 행은 기존 해석을 보존하며 소급 분류하지 않는다. 행동 자체는 marker로 차단하지 않는다.
- INSERT OR IGNORE로 첫 수신의 자격을 유지한다. 중지 전 적격 노출의 재전송은 적격으로 남고, 중지 중 제외된 노출을 재개 후 같은 ID로 재전송해도 적격으로 바뀌지 않는다. 재개 후 새 노출 ID는 새로 판정한다.
- `backend/tests/test_sdk_events.py`: 14개 회귀 사례를 추가했다. 중지/종료/보관, draft, marker 위조, 재전송/재개, 순서 역전, 배치, 쓰기 직전 상태 변경, 과거 행, flag-only/legacy, 결과·가드레일·라이브·SRM 일치를 검증한다.
- 변경 전 새 테스트의 첫 13사례는 12 failed / 1 passed로 결함을 재현했다. 변경 후 관련 132개 통과에 이어 최종 단독 전체 **585 passed**, 기존 API 수정과 합친 격리 integration 복사본 전체 **623 passed**를 확인했다. 각각 기존 경고 6개가 있다. 전체 재실행은 마지막 테스트 보강 후 수행했다.
- Gemini/agy **Hydrogen Medium**(`gemini-4-hydrogen-medium`, effort medium)에게 한정된 읽기 전용 설계·최종 리뷰를 맡겼다. NULL 호환성, 쓰기 시점 범위 조건, 행동과 노출 필터 분리 점검에 활용했다. 숫자 0/1도 유효하므로 native JSON boolean만 사용하라는 제안은 채택하지 않았다. 최종 보고서를 Codex가 diff·테스트와 대조했고 이 범위의 추가 결함은 없었다. XHigh 대비 범위를 지키며 유용한 리뷰를 제공했다. 최초 보고서 저장 경로 오류는 지정 경로로 옮겨 바로잡았다.
- 근거: `/home/ubuntu/.codex/reviews/iterglow-stop-events-implementation-20261113/`의 `regression-before.log`, `focused-tests.log`, `backend-full-tests.log`, `combined-tests.log`, `design-review.md`, `final-review.md`.
- 한계: 최초 수신의 서버 상태만으로 자격을 정하며 클라이언트가 주장한 실제 발생 시각의 진위를 증명하지 않는다. 중지 중 발생했지만 재개 후 처음 수신된 노출, 클라이언트 시계 오차, 과거 잘못 수집된 행의 소급 정리는 해결하지 않았다. 기존 원본과 신규 자격을 섞어 과거 이력이 완전하다고 주장하지 않는다.
- 중지 전 적격 노출의 후속 행동은 기존 동작을 유지했다. W/L 상한·결과 동결은 미구현이며, ‘정해진 기간까지 인정’과 ‘중지 즉시 제외’의 제품 선택을 사용자에게 질문했다. 답변 전 해당 선택에 의존하는 집계 변경은 하지 않는다.
- 앱 변경 2개 파일은 새 DB 컬럼이나 migration 041에 의존하지 않는다. 이력 기반도 함께 배포한다면 위 migration 적용 조건을 별도로 충족해야 한다. 로컬 변경만 준비했으며 게시·운영 적용은 하지 않았다.

## Next Owner / Next Action
- 2026-11-14: 사용자가 정책에 동의하고 기본 집계 경계 구현을 위임했다. 최신 결정과 단계별 상태는 `docs/reports/experiment-stop-policy-2026-11-14.md`를 따른다. 기본 활성 구간은 아래와 같이 로컬 구현·검증했다. 명시적 전환 창 W·수신 유예 상한 L·확정 기능은 후속 작업이다. 이전의 제품 선택 답변 대기는 해소됐다.
- Codex 총괄: 리뷰 결과를 대조하고 현재 로컬 변경과 기존 API 수정을 별도로 보존한다.
- 플랫폼 담당자: 공통 중지·종료 정책과 검증 시나리오를 먼저 마련하고, 합성 목표 행동·기간으로 로컬 검증을 진행한다. 신진수님의 정책 결정이나 실제 실험 설계 답변을 기다리는 상태로 두지 않는다. 실사용 피드백으로 보완하며 실험별 목표·기간은 실제 실험 설계 시 정한다.
- 역할 기준 정정(2026-11-13 사용자 피드백, 채택): “실제 사용자 입장으로 테스트+실사용”이라고 명시했고 이 역할 구분에 동의했다. 앞선 ‘진수님의 목표·기간 결정을 기다려야 한다’는 해석을 대체한다. 이 프로젝트의 실사용·QA 협업에만 적용한다.
- 향후 main 반영 승인이 있을 때 기존 GitOps와 migration 적용 조건을 확인한다. 현재 게시·배포는 승인되지 않았다.

## 후속: 기본 활성 구간 집계 — 2026-11-14 로컬 완료

- migration `043_sdk_active_period_policy.sql`로 새 SDK A/B 실험만 `experiment_readout_policy.version=active_period_v1`에 고정한다. 생성 trigger와 버전 UPDATE 차단을 사용하며 기존 실험/이벤트를 채우지 않는다. 기존 정책 없는 실험의 집계는 유지한다.
- `event.py`는 한 INSERT의 `history` CTE에서 041의 전체 이력을 읽고 `lag`로 상태 연결·시각 단조성을 검사한다. 실제 마지막 상태와 일치하며 발생 시각의 상태가 running인 경우만 collector-owned `sdk_active_period_eligible=1`이다. 판정은 raw JSON에 저장하고 재시도로 바꾸지 않는다. 새 노출은 기존 수신 시점 running guard도 통과해야 한다.
- 유효한 실행 구간의 지연 행동은 수신 당시 중지돼도 포함한다. paused 구간의 행동은 재개 후 수신돼도 제외한다. 시각 생략은 수신 시각이며 INSERT 시점 running을 추가 요구한다. 미래 주장 시각은 raw202/집계0으로 보존하며 수신 시각으로 바꾸지 않는다. 잘못된 날짜 형식은 기존 Pydantic 422다.
- `sdk_events.py`는 정책 실험의 노출·행동 모두 명시적 판정 1을 요구하고, 행동 귀속의 노출에도 같은 조건을 적용한다. 정책 없는 실험의 예전 임의 동명 JSON 값은 새 판정으로 재해석하지 않는다. 결과·라이브·가드레일·SRM·available-events의 공통 소스를 유지한다.
- 새로운 `test_sdk_active_period.py`의 30사례는 생성·버전 고정·migration 재적용·미소급·FK/원자 롤백, 상태별/종류별 지연 행동, 시작 포함·중지 제외·1µs 경계·시간대, 동일 시각 ID 순서, 미래/생략/잘못된 시각, 위조·재시도·순서 역전·배치·INSERT 경쟁, 이력 이상, 양 군과 공통 집계를 확인한다. 기존 SDK fixture는 정책 도입 전 코호트를 명시적으로 나타내도록 분리했다. 초기에 테스트의 available-events 기대(주요 지표만 conversion_events에 포함)와 직접 SQL의 필수 생성 시각 누락을 고쳤고 제품 계약을 완화하지 않았다.
- 관련 65개, 최종 단독 백엔드 **615개**, API 검증+프로필/이메일 초대까지 적용한 격리 통합 복사본 **680개** 통과. 기존 경고 6건. 근거: `/home/ubuntu/.codex/reviews/iterglow-active-period-20261114/`. 원본 worktree는 합치지 않았고 커밋·게시·운영 적용은 하지 않았다.
- Gemini/agy `gemini-4-argon-high`와 독립 설계를 교차 확인했고 생략 시각 경쟁·이력 이상 점검을 활용했다. 설계 보고서는 회수했으나 사용량 한도로 최종 코드 리뷰가 실행되지 못했다. Codex가 코드·SQL·전체 회귀를 검증했으며 독립 최종 승인으로 표현하지 않는다. 초기 과도한 경로 탐색과 조율 비용이 있었다. A/B 사용량 기록이 당시 없어 미확인으로 취급했으며 잔여량 0으로 해석하거나 임의 계정 전환하지 않았다.

### 적용 조건·남은 한계

- 041과 043을 **backend보다 먼저** 전체 trigger 문장을 처리하는 승인된 Ops 경로로 적용해야 한다. 042는 별도 프로필 기능을 함께 반영할 때 필요하다. 기존 `run_migration.sh`는 이 경로가 아니다. 새 수집기와 reader는 043 테이블에 의존하며 과거 실험 조회에도 스키마가 필요하다.
- migration 이후 새 수집기 배포 전에는 신규 정책 실험 생성/수집을 진행하지 않도록 반영 순서를 조율한다. 구형 수집기가 기록한 판정 없는 신규 정책 이벤트는 새 reader에서 추정 없이 제외된다. 이 구간에 실험을 운영했다고 가정하지 않는다.
- 구버전 앱은 새 marker를 모르므로 단순 코드 롤백만으로 신규 정책 실험의 집계 계약이 유지되지 않는다. 롤백 시 해당 실험의 수집/결과 제공을 멈추고 재검증해야 하며, 새 테이블·원본·이력을 삭제하거나 정책을 소급 바꾸지 않는다.
- DB 경계 정밀도는 041의 밀리초다. 동일 밀리초의 상태는 ID로 구분하되 이미 저장한 이벤트의 최초 SQL 판정을 소급 변경하지 않는다. 클라이언트 시각의 진위를 증명하지 않으며 미래 시각을 보수적으로 제외하므로 빠른 클라이언트 시계에 의한 누락 가능성이 있다.
- 명시적 W, 수신 유예 상한 L과 결과 확정은 아직 없다. 활성 구간에 발생한 유효한 과거 행동은 늦게 도착해 결과를 바꿀 수 있으므로 현재 결과를 영구 확정이라고 표시하지 않는다. 이력 손상/시계 역전 때문에 제외된 이벤트는 이력을 나중에 고쳐도 같은 ID 재전송으로 자동 구제하지 않는다.
- 운영 DB·Hub·실사용 계정은 건드리지 않았다. 실제 D1/전송 시계·운영 부하 검증은 승인된 운영 단계의 별도 확인 사항이다. API 응답과 UI/SDK 소스 변경이 없어 프런트엔드 검사를 반복하지 않았다.


## 후속: W/L·불변 결과 확정·KO/EN 화면 — 최신 로컬 인계

### 구현과 계약

- 신규 migration 044의 `bounded_v1`은 migration 이후 생성한 SDK A/B 실험에만 등록한다. 기존 무정책 및 active_period_v1만 있는 코호트를 소급 변경하지 않는다. 첫 실행에서 W/L·지표·변형을 원자적으로 잠그고, flag의 control/treatment fallback과 활성 custom 변형을 실행 계약에 기록한다.
- 선택형 W는 기본값 없이 1초~30일, 명시적인 일회성 노출 효과 확인이 필요하다. UI는 시간을 입력받고 API는 정수 초를 받는다. 첫 적격 사용자 노출부터 `[첫 노출, 첫 노출+W)`이며 재노출·중지·재개로 다시 시작하지 않는다. W 없음은 활성 구간 행동만 집계한다. L=24시간은 초기 기술 선택이며 업계 보편값이라는 근거는 없다. 각 이벤트 발생 시각 <= 수신 시각 <= 발생+L을 검사한다.
- 실제 종료 이력 E+(W 또는 0)+L을 지난 최초의 권한 있는 조회에서 확정한다. 경계 시각과 같으면 관찰 중이다. 일시중지는 관찰 중/기한 null, 한 번도 시작하지 않은 초안과 보관 초안은 상태/기한 null이며 스냅샷을 만들지 않는다.
- `sdk_readout.py`는 완전한 041 이력 체인을 검증하고 하나의 INSERT SELECT에서 계약과 canonical 입력을 JSON으로 물리화한다. 지연 INSERT와 중복 확정 경쟁을 막고 결과 JSON은 한 번만 저장한다. 결과 쓰기 전 장애는 같은 입력으로 재시도한다. 원본 추가·삭제 및 현재 지표로 확정 결과를 다시 계산하지 않는다. bounded 결과 계산만 PCG64 seed 0을 명시한다. 누락/역전 이력과 D1 오류는 503이며 빈 결과를 확정하지 않는다.
- 기존 collector-owned marker 제거·event_id 최초 판정·202 원본 보존을 유지한다. 고정 UTC 마이크로초 저장은 bounded 코호트에만 SQL CASE로 적용해 과거 whole-second 행동과 새 같은 시각 노출의 문자열 귀속을 보존한다.
- `Experiment`에 readout_policy_version, conversion_window_seconds, one_time_intervention, ingestion_grace_seconds, measurement_locked를 추가했다. 결과/analytics에 선택형 readout_state/finalizes_at을 추가했다. 기존 endpoint와 권한을 유지하며 일반 멤버의 /result는 여전히 403이다. 일반 멤버는 analytics의 이벤트 합계/상태만 보고, 서버 내부에서 scoped 최종 입력/결과를 준비할 수 있다.
- 기존 생성·설계·결과 화면에 KO/EN 설정/고정 안내·관찰 중/확정을 추가했다. 미선택 flag 때문에 선언한 W가 조용히 사라지지 않으며 1초를 0시간으로 표시하지 않는다. 최초 시작 후 측정 필드는 잠그고 이름/설명은 편집 가능하다. SDK 실험의 연결 flag 교체 affordance는 제거했고 서비스 제공 flag 설정은 별도다. 조회자의 수정/삭제 버튼은 비활성화한다.

### 검증과 협업

- 새 bounded 회귀 **37사례** 포함 단독 backend **652개**, 기존 API 검증+Google 프로필/이메일 초대까지 합친 격리 통합 backend **717개** 통과. 기존 의존성 경고 6건. standalone frontend **229개/21파일**, 통합 frontend **243개/21파일**와 두 production build 통과. 기존 Browserslist·큰 bundle 경고가 있다.
- 실제 production frontend + 로컬 FastAPI + 메모리 SQLite + 합성 계정으로 KO/EN × 390/1280px **4조합** 통과. 1.5시간 저장, 시작 시 고정, 종료 후 W 안 전환 포함, 정확한 W 경계 및 L 초과 제외, 관찰 중→확정, 조회자 수정 차단·/result 403, 확정 후 raw 202 추가에도 결과 JSON 불변을 확인했다. 모바일 생성과 데스크톱 확정 화면을 실제 이미지로 확인했다. 로컬 fixture 시계만 전진했으며 실제 하루 대기·Google OAuth·메일·D1 부하 검증은 아니다.
- input materialization/지연 INSERT/중복 확정/쓰기 장애/원본 삭제/설정 고정/첫 노출/재개/경계/양 군/이력 손상/역순 trigger 생성/과거 timestamp 호환/권한을 SQL과 API 회귀로 확인했다. 마지막 custom rule 메타데이터 회귀는 무관한 legacy placement 시작 조건에 걸려 trigger 직접 실행으로 범위를 바로잡았다.
- Codex B 작업자(gpt-6-astra, medium)가 독립 설계와 backend 구현·관련 테스트, 읽기 전용 frontend 교차 검토를 수행했다. 최신 A/B 수집 결과 B의 주간 잔여량이 더 많음을 확인한 뒤 배정했다. root는 frontend 구현·최종 통합·전체 회귀/브라우저를 담당하고 이력 불변성, 구 코호트 시각 호환, W 누락/단위 표기, fallback 변형 메타데이터를 독립 대조해 보완했다. 같은 파일은 동시에 수정하지 않았다. 이 단계에서는 Gemini를 실행하지 않았고 앞 단계의 사용량 한도를 임의 모델 대체로 우회하지 않았다.
- 근거: `/home/ubuntu/.codex/reviews/iterglow-readout-window-20261114/`의 backend-full-tests.log, combined-backend-tests.log, frontend-full-tests.log, combined-ui-tests.log, frontend-build.log, combined-ui-build.log, browser-results.json 및 window-*.png. git diff --check 통과. UI detector는 정규식 소스 검사 범위이며 실제 DOM 대비 전체 검사라고 표현하지 않는다.

### 남은 운영 조건과 보존

- **041/043/044를 backend보다 먼저** trigger 전체 SQL을 처리하는 승인된 Ops 경로로 적용한다. 계정 기능 포함 시 042도 필요하다. 044는 ALTER를 포함해 1회 적용 기록을 확인해야 한다. 기존 run_migration.sh는 trigger를 나누므로 사용하지 않는다. 이 작업에서 runner나 운영 DB를 변경하지 않았다.
- migration과 새 collector 사이에는 신규 정책 실험 생성·수집을 중단해 순서를 맞춘다. 구형 앱은 새 계약/marker/확정을 모르므로 단순 코드 롤백 시 관련 실험 수집·결과 제공을 멈추고 재검증한다. 테이블·원본·이력을 삭제하거나 코호트를 소급 변경하지 않는다.
- canonical 입력은 D1 단일 행 JSON이므로 provider 크기 한계를 넘으면 503으로 실패한다. 잘라 확정하지 않으며 실제 D1 용량/부하 검증은 미완료다. 입력에는 사용자/이벤트 식별 정보 복사본이 있어 개인정보처리방침·보존/삭제/탈퇴 TODO 범위에 포함했다. 실험 삭제의 FK 정리가 개별 탈퇴 구현을 뜻하지 않는다.
- 코드·문서는 이 worktree에 미커밋 상태로 보존한다. 원본 다른 worktree는 그대로이며 통합은 저장소 밖 복사본에서만 수행했다. GitHub·운영 배포·Hub·실사용 계정·실험은 변경하지 않았다. Personal 기존 정책 카드는 진행 중, 개인정보 문서 카드는 시작 전으로 유지한다.


## D1 입력 크기 보완 — 최신 저장 구조 및 운영 준비

- 앞 절의 단일 입력 JSON 방식은 로컬 D1 준비 중 공식 2,000,000바이트 제한을 적용한 SQLite에서 6천 건의 이벤트만으로 조회가 막히는 결함을 재현해 교체했다. 진행 중/확정 시 모두 해당하며, 이미 큰 입력을 저장한 뒤 결과 JSON을 더할 때의 행 크기 문제도 있었다. 이전 652/717 통과는 이 용량 한계를 검증한 결과가 아니었다.
- 044에 experiment_readout_input을 추가했다. 부모 snapshot INSERT의 AFTER trigger에서 실험/프로젝트·bounded 판정·수신 기한으로 좁힌 후보 이벤트를 복사하고 input_sealed=1로 봉인한다. 정규 귀속에 필요한 SDK 속성 8개만 보존하며 임의 사용자 properties 전체를 복제하지 않는다. 원본 이벤트 ID/순서·시각은 보존하고 raw FK는 두지 않는다. 봉인 뒤 입력 추가/수정/삭제와 봉인 전 결과 저장을 거부하고, 실험 삭제 cascade는 허용한다.
- sdk_readout.py는 동결/실시간 후보를 한 SQL 문장에서 배타적으로 선택하고 기존 canonical CTE를 재사용한다. 메타데이터 헤더 1행과 개별 이벤트 JSON 행을 UNION해 큰 집계 값 및 이벤트마다 반복되는 계약/결과를 없앴다. 빈 집합도 헤더를 반환하고 불완전한 봉인은 503이다. API·지표·전환·권한 의미와 bounded_v1 버전은 바꾸지 않았다. 향후 귀속 의미 변경에는 기존 동결 입력의 버전별 해석이 필요하다.
- Codex B(gpt-6-astra medium)가 읽기 전용 위험/설계를 독립 검토한 뒤 세 파일에 한정해 구현·봉인/경쟁/cascade 테스트를 추가했다. root는 6천 건 capacity 테스트를 별도 파일에 작성해 이전 코드의 실패 2건을 먼저 확인하고, 보완 뒤 2건 통과 및 최종 단독 659개/통합 724개(경고 6건)를 확인했다. root가 SQL·diff와 기존 API 호출을 직접 대조했으며 같은 파일은 동시에 수정하지 않았다.
- Wrangler 4.162.0 / workerd 1.20261113.1의 로컬 D1 binding에서 합친 스키마와 041~044를 complete statement로 적용했다. batch 중간 오류로 ALTER/테이블 변경 전체가 롤백됐고 정상 batch는 성공했다. 044 재실행은 duplicate column 오류여서 적용 기록 확인이 필요하다. generic migration runner는 여전히 사용하지 않는다.
- 로컬 workerd는 2.1MB 값도 허용하므로 그 성공을 원격 한도 검증으로 표현하지 않는다. 별도 Python SQLite의 LIMIT_LENGTH=2,000,000으로 공식 행/값 상한을 강제한 회귀를 병행했다. 원격 D1의 50MB 결과 응답·쿼리 시간·대규모 부하 한계는 제거된 것이 아니며 실제 원격 검증은 미완료다.
- 근거 폴더: `/home/ubuntu/.codex/reviews/iterglow-d1-readiness-20261114/`의 independent-review.md, design.md, capacity-before.json, capacity-red.log, capacity-green.log, backend-full.log, combined-backend-full.log, migration-atomic-results.json. 개인정보 후속 검토에는 이벤트별 동결 입력과 결과의 복사본을 포함한다.

- 보완 후 실제 FastAPI의 strict D1 HTTP adapter를 loopback REST 형식 bridge와 로컬 workerd D1 binding에 연결해 production frontend KO/EN × 390/1280px 4조합을 통과했다. 초기 실패는 fixture에서 Python 시계만 전진하고 DB trigger DEFAULT 시계가 실제 시간이었던 문제였다. fixture 전용 qa_clock과 041 trigger의 명시 recorded_at 주입으로 맞췄으며 운영 SQL은 바꾸지 않았다. 실제 migration 자체는 별도의 시계 주입 없는 atomic probe에서 검증했다.
- 같은 실제 API 경로에서 6천 합성 이벤트의 collecting sample_size=6000, finalizing input_rows=6000, 가장 큰 복사 속성 376바이트, 원본 삭제 후 확정 결과 동일, 입력 DELETE 거부, 실험 삭제 cascade를 확인했다. 다른 프로젝트로 위조한 후보는 복사되지 않았다. 관측 시간은 collecting 0.509초/finalizing 0.648초로 해당 로컬 샘플의 측정이며 원격 D1 성능 보장이 아니다. 결과: d1-capacity-api-results.json, browser-results.json 및 새 window-*.png.
- 현재 원격 main을 읽기 전용 ls-remote로 확인해 base 6c7ae1de3c2ebf0203124f07d5aa23852c285fb8과 같음을 확인했다. backend/frontend 및 기존 인계 문서를 합친 통합 패치와 SHA-256 manifest를 저장소 밖에 만들고 별도 Git index에서 base 적용 검사를 통과했다. 원본 worktree index·브랜치·커밋·원격은 변경하지 않았다. integration.patch와 integration-manifest.json이 검토용 결과다.
- 로컬 증거와 원격 D1 운영 증거는 구분한다. 다음 단계의 분리된 원격 D1 테스트 DB 생성·사용은 기존 로컬 승인 범위를 넘어 사용자에게 1회 확인했으며, 응답 전 생성·원격 쓰기를 진행하지 않는다. 운영 DB 변경·main 반영 승인은 포함하지 않는다.


## 운영 반영 승인·릴리스 준비 — 2026-11-14

- 사용자 ‘이제 운영 반영하면 되지?’에 따라 계정/이메일 초대·입력 검증·SDK 집계/확정의 세 범위와 migration 041~044를 반영한다. 홈페이지·SDK/npm 게시·Hub 수정·약관 작성은 포함하지 않는다. 실제 Google 계정 선택·동의와 이메일 지정 초대의 운영 검수는 배포 후 확인한다.
- 최종 릴리스 worktree는 release/identity-readout-20261114다. 백엔드 726개, 깨끗한 npm ci 후 프런트엔드 243개/빌드와 SDK 빌드를 통과했다. 독립 검토에서 발견한 시작 후 새 variant 유입은 잠근 variant_names를 canonical eligible 단계에 적용해 보완했다. 최초 선언된 custom arm의 전환은 유지하고 이후 추가된 arm은 raw202로 보존하되 실시간/확정에서 제외하는 2사례 회귀를 추가했다.
- 운영 D1 백업의 개인 파일(0600)과 TimeTravel bookmark를 보존하고 복원·무결성·FK·모든 기존 행 보존 및 31개 complete-statement 리허설을 확인했다. DB에는 아직 DDL을 실행하지 않은 준비 단계다.
- 기존 GitOps의 새 이미지가 준비될 때까지 기존 앱을 유지한다. 대상 Application의 자동 동기화 정책을 정확히 보존해 일시 중단하고, DB 적용 직전 backend의 기존 pod 종료/요청 drain을 확인한다. 그 뒤 fresh backup/bookmark·migration 체크포인트 검증을 마치고 원래 자동 동기화를 복원해 정상 이미지/replica가 배포되게 한다. 수동 sync·중복 이미지 갱신은 하지 않는다. 세부 영수증은 서버의 iterglow-release-20261114 검증 폴더에 보관한다.


## 운영 반영 완료 — 2026-11-14

- [PR #39](https://github.com/Pseudo-Lab/experiment-platform-pseudolab/pull/39)를 main `eb271229c81851a3764e53199a05a92b55ca8795`에 반영했다. [main CI](https://github.com/Pseudo-Lab/experiment-platform-pseudolab/actions/runs/43499536569)·[GitOps](https://github.com/Pseudo-Lab/experiment-platform-pseudolab/actions/runs/43499814927) 성공, Ops `614cf7d734fa3b8d0e9f72c39d93ed017677a144`에서 두 이미지 태그가 자동 갱신됐다. main은 배포 시작이며, 아래 런타임 확인까지 수행했다.
- 포함: Google 프로필·이메일 지정 초대·계정/로그아웃 메뉴, API 입력 검증 2건, SDK 상태 이력·중지 노출 guard·신규 측정 계약/전환 창/불변 확정 및 KO/EN UI. 홈페이지·SDK/npm 게시·Hub 변경·메일 발송·개인정보 문서 작성은 제외했다.
- 검증: 최종 백엔드 **726개**, 프런트엔드 **243개**·production build, SDK build. 독립 Codex B(GPT-6-Astra medium) 리뷰가 발견한 변형 집합 누락을 수정했다. launch 시 고정된 `variant_names`를 live/frozen 공통 eligible CTE에서 first_exposure·귀속 전에 적용하며, 시작 후 추가한 변형의 raw 202와 집계 제외 및 선언된 custom arm의 노출·전환·확정 보존을 회귀로 확인했다. 이번 릴리스 검토에는 Gemini를 실행하지 않았다.
- AppProject의 이 앱만 대상으로 하는 임시 deny SyncWindow가 실제 Sync Denied로 평가됨을 확인한 후 main을 반영했다. Application은 상위 services 앱이 관리하므로 자동화 정책 자체를 변경하지 않았다. 기존 backend pod 삭제와 Deployment desired/actual/ready/updated 0을 확인하고 35초 유휴 후 마지막 백업을 받았다. 최초 cutover 백업 실행은 원격 transport 비정상 종료로 실패했지만 DDL·백업 파일 생성 전이었고, 읽기 전용 백업 재실행은 성공했다.
- 운영 D1 `pseudolab-exp`의 fresh SQL export 1,614,960bytes와 복구 bookmark는 0600 개인 저장소에 보존했다. export를 로컬에 복원해 integrity/FK·기존 모든 행/컬럼 보존·migration 리허설을 검증했다. 운영에는 041~044를 trigger를 나누지 않는 **31개 완전한 SQL 문장**으로 적용했고, 매 문장 후 전체 schema와 FK를 대조했다. 2026-11-14 05:21:36 KST 완료: 기존 테이블 행 수 보존, FK 위반 0, 신규 7개 테이블 0건. 기존 실험의 소급 편입·프로필 추정·운영 restore는 하지 않았다. 개별 SQL checkpoint 방식이며 네 migration 전체의 전역 원자성을 주장하지 않는다.
- 마이그레이션 검증 후 해당 임시 window만 제거했다. 기존 자동 prune/selfHeal·CreateNamespace 정책은 그대로이며 수동 sync·이미지 태그 수정 없이 GitOps가 배포했다. frontend/backend 모두 위 main SHA, replicas/ready/updated 1, Argo **Synced / Healthy**를 확인했다. 임시 migration Pod 삭제와 추가 window 부재도 확인했다.
- 운영 [로그인](https://iterglow.pseudolab-devfactory.com/login)에서 새 JS `index-CcfBo5iT.js`·CSS `index-BkMaH9aN.css`, Google provider 활성, 익명 auth/me false, 프로젝트/실험 API 401·no-store를 확인했다. KO/1280px·EN/390px에서 소개·로그인·SDK 가이드와 익명 실험 화면의 로그인 이동을 실제 Chromium으로 확인(8개 검사, page error 0, 가로 넘침 없음)했다. 합성 계정의 공유/편집/제거/로그아웃은 앞서 TS에서 직접 검증했다.
- 남은 범위: 사용자의 실제 Google 재로그인/동의 후 프로필 저장과 Gmail/Workspace 지정 초대의 실제 계정 수락. 새 profile 테이블이 0건이므로 기존 세션만으로는 이름·이메일이 채워지지 않으며 한 번 재로그인이 필요하다. 서명 합성 토큰·TS 검증을 실제 OAuth 통과로 표현하지 않는다. 운영에서 실제 SDK 실험의 전환 축적·확정도 아직 실행하지 않았다.
- 로컬 근거: `/home/ubuntu/.codex/reviews/iterglow-release-20261114/`의 `cutover-backup-metadata.json`, `migration-checkpoints.jsonl`, `migration-result.json`, `runtime-latest.json`, `cleanup-verification.json`, `public-http.json`, `public-browser-results.json` 및 화면 이미지. 원본 3개 작업 worktree와 사용자 TS 미리보기 데이터/서비스는 보존했다.
