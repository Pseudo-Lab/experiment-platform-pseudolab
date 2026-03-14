# Docs Guide

실험플랫폼 문서 운영 규칙입니다. 
목표는 **최신 문서 빠른 탐색**과 **과거 기록 보존**입니다.

---

## 1) 문서 상태(Status) 규칙
모든 문서는 아래 상태 중 하나를 가집니다.

- `active`: 현재 운영/개발에서 사용하는 기준 문서
- `superseded`: 최신 문서로 대체됨 (대체 문서 링크 필수)
- `archive`: 과거 기록 보존용 문서

권장: 문서 상단에 아래 메타를 넣습니다.

```md
Status: active
Last-Validated: YYYY-MM-DD
Replaced-By: <path>   # 해당 시만
```

---

## 2) 디렉토리 운영 원칙
- `docs/` : 문서 진입점 및 상위 안내
- `docs/guides/` : 공통 가이드/정책/설계
- `docs/reports/` : 실행 보고서, 분석 보고서, 작업 로그
- `docs/reports/snapshots/` : 시점 고정 스냅샷
- `docs/archive/` : 아카이브 문서
- `docs/superseded/` : 대체된 문서

원칙:
1. 삭제보다 아카이브를 우선합니다.
2. v1/v2가 공존하면 최신본을 `active`, 이전본은 `superseded`로 관리합니다.
3. 동일 주제 문서가 여러 개면 진입점 문서(1개)를 지정합니다.

---

## 3) 작성/수정 체크리스트
문서 변경 시 아래를 확인합니다.

- [ ] 문서 상태(Status) 갱신
- [ ] 날짜(`Last-Validated`) 갱신
- [ ] 대체 문서가 있으면 `Replaced-By` 명시
- [ ] 근거/가정/한계가 필요한 문서는 명시
- [ ] 민감정보(토큰/키/시크릿) 직접 기재 금지
- [ ] UI 텍스트 관련 변경은 KO/EN 동기화 규칙 준수

---

## 4) 민감정보 보안 규칙
- 토큰, API 키, 시크릿은 문서에 직접 쓰지 않습니다.
- 환경변수 **이름만** 기재합니다. (예: `CLOUDFLARE_API_TOKEN`)
- `.env` 파일 내용 복붙 금지

---

## 5) 추천 진입 문서
- 운영 핸드오프: `docs/reports/hand-off-12th-study-platform.md`
- 실행 계획: `docs/reports/dashboard-execution-plan-v1.md`
- 팀장 기준 계획: `docs/reports/team-lead-rebaseline-plan.md`
- KPI 정의: `docs/reports/kpi-definition-v2.md`
- 데이터 검증: `docs/reports/dataset-validation-v2.md`
- 공통 가이드: `docs/guides/setup_guide.md`, `docs/guides/design_system.md`, `docs/guides/data_access.md`

---

## 6) 변경 이력 관리
- 큰 구조 변경(레포 분리, 배포 방식 전환, 지표 정의 변경)은
  반드시 `docs/reports/`에 별도 기록을 남깁니다.
- 커밋 메시지에서 문서 변경 목적이 드러나도록 작성합니다.
