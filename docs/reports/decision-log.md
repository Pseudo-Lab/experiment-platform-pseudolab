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
