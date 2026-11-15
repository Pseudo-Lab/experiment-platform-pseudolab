Status: active
Last-Validated: 2026-11-16

# Iterglow 문서

Iterglow는 모든 서비스에 연동할 수 있는 오픈소스 실험 플랫폼입니다. 특정 서비스는 적용·검증 사례이며 플랫폼의 사용자 분류나 운영 방식을 고정하지 않습니다.

## 목적별 시작점

| 하려는 일 | 시작 문서 | 확인할 내용 |
| --- | --- | --- |
| 플랫폼 이해 | [프로젝트 소개](../README.md), [핵심 개념](guides/experiment_platform_concepts.md), [아키텍처](guides/architecture.md) | 실험·flag·대상·노출·행동의 관계 |
| 내 서비스에 연결 | [SDK 가이드](https://iterglow.pseudolab-devfactory.com/docs/sdk), [API·이벤트 계약](../packages/sdk/README.md), [패키징·연동](../packages/sdk/SDK_PACKAGING_GUIDE.md) | 자신의 프로젝트 키와 API 주소, decide → expose → track |
| 직접 설치·운영 | [설치 가이드](guides/setup_guide.md), [데이터 저장소](guides/data_access.md) | 자신의 D1·R2·인증 설정, 새 DB 초기화의 현재 제한 |
| 코드·문서 기여 | [기여 가이드](guides/agent_collaboration.md), [AGENTS.md](../AGENTS.md) | 작업 범위·파일 소유권·검증·PR |
| UI·브랜드 수정 | [디자인 시스템](guides/design_system.md), [브랜드 자산](guides/iterglow-brand.md) | 컴포넌트·테마·로고·색상 |

SDK 연동은 사용 가능한 Iterglow 설치와 자신의 프로젝트가 필요합니다. 셀프호스팅에서는 해당 설치의 `/docs/sdk`를 확인하세요. 직접 설치는 현재 Cloudflare D1을 전제로 하며 빈 DB bootstrap과 전체 Docker Compose 경로에는 [문서화된 제한](guides/setup_guide.md)이 있습니다.

## 기능별 가이드

- [프로젝트 접근·초대·자격증명](guides/project-access.md): 사용자 역할, 이메일 초대, 공개 SDK 키와 서버 credential의 구분.
- [서버 간 접근 판정](guides/access-decision.md): 인증된 서비스 서버의 접근 정책 평가·실패 처리.
- [실험 상태와 결과 확정](guides/experiment-lifecycle.md): 상태 전이, 전환 창·수신 유예, 관찰·확정 단계.

## 참고 문서

- [기술 문서 인덱스](reports/_index.md): 기능별 가이드와 구현 근거.
- [공개 결정 로그](reports/decision-log.md): 제품·저장소의 변경 근거.
- [실험 분석 계획 템플릿](templates/experiment-analyst-brief.md): 가설·지표·해석 기준 정리.
- [PR 작성 양식](templates/pull-request.md): 변경 범위·호환성·검증 근거.

현재 기능·설정은 코드와 해당 기능 가이드가 기준입니다. 진행 중인 기능은 [GitHub Issues](https://github.com/Pseudo-Lab/experiment-platform-pseudolab/issues)에서 확인합니다.

## 문서 변경 기준

1. `Status`, `Last-Validated`와 적용 대상·제약 명시.
2. 변경한 가이드와 문서 진입점의 상대 링크 확인.
3. 코드상 구현·로컬 검증·운영 검증의 구분. 실제 확인하지 않은 성공 경로의 보장 금지.
4. 공통 개발 규칙은 [AGENTS.md](../AGENTS.md) 참고.
5. 문서 전용 변경은 기존 CI/GitOps의 docs-only 제외 조건 유지.
