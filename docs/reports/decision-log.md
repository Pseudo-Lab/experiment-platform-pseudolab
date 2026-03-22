Status: active
Last-Validated: 2026-03-22

# Decision Log (append-only)

포맷:
- Date:
- Decision:
- Why:
- Impact:
- Owner:

---

- Date: 2026-03-22
- Decision: 운영 모드를 MVP로 고정하고, 이번 주는 경량 프로세스 적용/검증에 집중한다.
- Why: 빠르게 적용하고 빠르게 확인하는 주기를 확보하기 위함.
- Impact: PR/QA/Release 문서가 축약되고, 적용 속도 우선으로 운영.
- Owner: soo

- Date: 2026-03-22
- Decision: Guard/Freeze 전면 적용은 보류하고, 고위험 3종(배포/시크릿·권한/DB 스키마)만 승인 게이트 적용.
- Why: 운영 부담을 줄이면서 필수 안전장치만 유지하기 위함.
- Impact: 승인 병목 감소, 고위험 변경 추적 유지.
- Owner: soo

- Date: 2026-03-22
- Decision: OSS 물리 분리는 즉시 실행하지 않고 가치 판단(GrowthBook 포함) 이후 재개한다.
- Why: 현재는 문제정의/가치 확정 전 대규모 전환 리스크가 큼.
- Impact: MVP 운영/검증 우선, OSS 분리는 보류.
- Owner: soo

- Date: 2026-03-22
- Decision: 멀티 에이전트 병렬 작업을 위해 source 우선순위와 PR/핸드오프 최소 트리거를 공통 규칙에 추가한다.
- Why: 소규모 팀이라도 병렬 작업이 잦아지면 속도보다 충돌 비용이 커지므로 최소한의 경계 규칙이 필요함.
- Impact: 작은 단일 작업은 계속 빠르게 진행하고, 교차 영향 작업만 명시적으로 공유/검토한다.
- Owner: soo
