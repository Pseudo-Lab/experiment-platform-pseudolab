# Iterglow

**오픈소스 A/B 테스트·실험 플랫폼**

Iterglow는 서비스의 기능을 사용자별로 나누어 제공하고, 실제 노출과 행동을 수집해 결과를 비교하는 플랫폼입니다. 서비스별 사용자 식별자·이벤트·목표 지표를 정의하고 SDK로 연결할 수 있습니다.

[서비스](https://iterglow.pseudolab-devfactory.com) · [팀 소개 및 활동](https://pseudo-lab.github.io/experiment-platform-pseudolab/) · [문서](docs/README.md) · [SDK](packages/sdk/README.md) · [기여 가이드](docs/guides/agent_collaboration.md) · [Issues](https://github.com/Pseudo-Lab/experiment-platform-pseudolab/issues)

## 주요 기능

- 프로젝트별 실험·Feature Flag 및 구성원 권한 관리
- 사용자별 variant 판단과 점진적 기능 공개
- SDK의 `decide → expose → track` 흐름을 통한 판단·실제 노출·행동 분리
- 노출·전환 집계, SRM·가드레일 및 데이터 품질 경고
- 신규 SDK A/B 실험의 상태 이력·전환 창·수신 유예·결과 확정
- Google 로그인과 프로젝트 공유·초대

플랫폼은 실험·수집·분석의 공통 기능을 제공하고, 연결하는 서비스에서 화면·사용자 속성·이벤트·목표 지표를 정의합니다.

## 시작하기

### 기존 설치에 서비스 연결

1. Iterglow에 로그인하고 프로젝트 생성 또는 초대 수락.
2. 자신의 프로젝트 공개 SDK 키와 설치의 API 주소 확인.
3. [SDK 가이드](packages/sdk/README.md)에 따라 variant 판단, 실제 노출, 행동 전송 연결.
4. 수집 이벤트와 접근 가능한 결과 화면에서 연결 상태 확인.

```bash
npm install @pseudo-lab/iterglow-sdk
```

브라우저에는 공개 SDK 키를 사용합니다. 서버 credential과 설치 관리자 자격증명은 브라우저에 전달하지 않습니다.

### 직접 설치·개발

[설치 가이드](docs/guides/setup_guide.md)에서 Python 3.11·Node.js 22, 자신의 Cloudflare D1·R2, 인증과 개발 서버 설정을 안내합니다.

현재 빈 DB 초기화와 전체 Docker Compose 실행에는 [설명된 제약](docs/guides/setup_guide.md#새-db-초기화의-현재-제한)이 있습니다. 설치 가이드의 실행 경로와 초기화 조건을 확인해야 하며, 서버 기동만으로 전체 설치 성공을 판단하지 않습니다.

## 문서

| 목적 | 가이드 |
| --- | --- |
| 플랫폼 이해 | [핵심 개념](docs/guides/experiment_platform_concepts.md), [아키텍처](docs/guides/architecture.md) |
| 서비스 연결 | [SDK](packages/sdk/README.md), [패키징·연동](packages/sdk/SDK_PACKAGING_GUIDE.md) |
| 설치·데이터 저장소 | [설치](docs/guides/setup_guide.md), [데이터 접근](docs/guides/data_access.md) |
| 프로젝트·초대·키 | [접근 권한](docs/guides/project-access.md) |
| 서버 접근 정책 | [접근 판정 API](docs/guides/access-decision.md) |
| 실험 중지·종료·결과 | [실험 수명주기](docs/guides/experiment-lifecycle.md) |
| 코드·문서 기여 | [기여 가이드](docs/guides/agent_collaboration.md) |
| UI·브랜드 | [디자인 시스템](docs/guides/design_system.md), [브랜드 자산](docs/guides/iterglow-brand.md) |

## 기술 구성

| 구성 | 기술 |
| --- | --- |
| 관리 화면 | React·Vite·TypeScript·Tailwind CSS |
| API | FastAPI·Python·Pydantic |
| SDK | TypeScript·React 연동 |
| 저장소 | Cloudflare D1·R2 |
| 개발·배포 | Docker, Kubernetes·ArgoCD |

SDK v1과 legacy의 이벤트 계약은 구분됩니다. 기존 query segment는 등록된 소스 스키마가 필요하며, 임의 사용자 속성 기반의 세그먼트별 결과 비교가 자동 제공되는 기능은 아닙니다. 현재 지원 범위는 각 가이드와 [기능 이슈](https://github.com/Pseudo-Lab/experiment-platform-pseudolab/issues)에서 확인합니다.

## 기여

버그 제보, 문서 개선과 코드 기여를 환영합니다. [기여 가이드](docs/guides/agent_collaboration.md)에서 개발 환경·검증·PR 작성 기준을 확인합니다.

- 버그·기능 제안: [GitHub Issues](https://github.com/Pseudo-Lab/experiment-platform-pseudolab/issues)
- 변경 제안: 관련 Issue와 연결한 Pull Request
- 변경 설명: 해결할 문제, 변경 후 동작, 실행한 검증과 호환성·데이터 영향

실제 키·토큰·개인정보·운영 원문 데이터는 Issue·PR·로그에 게시하지 않습니다.

## 라이선스와 기여자

[MIT License](LICENSE).

Iterglow는 [Pseudo-Lab](https://pseudo-lab.com/)에서 시작한 오픈소스 프로젝트입니다. [모든 기여자](https://github.com/Pseudo-Lab/experiment-platform-pseudolab/graphs/contributors)에게 감사드립니다.

프로젝트를 만드는 팀과 활동 소식은 [팀 소개 및 활동](https://pseudo-lab.github.io/experiment-platform-pseudolab/)에서 확인할 수 있습니다.
