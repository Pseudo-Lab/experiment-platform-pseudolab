# 🔬 실험 플랫폼: 데이터로 서비스를 개선하기

<div align="center">
  <a href="https://pseudo-lab.com"><img src="https://img.shields.io/badge/PseudoLab-S12-808080" alt="PseudoLab Season 12"/></a>
  <a href="https://pseudo-lab.com"><img src="https://img.shields.io/badge/PseudoLab-S13-3776AB" alt="PseudoLab Season 13"/></a>
  <a href="https://discord.gg/EPurkHVtp2"><img src="https://img.shields.io/badge/Discord-BF40BF" alt="Discord Community"/></a>
  <a href="https://github.com/Pseudo-Lab/experiment-platform-pseudolab/stargazers"><img src="https://img.shields.io/github/stars/Pseudo-Lab/experiment-platform-pseudolab" alt="Stars Badge"/></a>
  <a href="https://github.com/Pseudo-Lab/experiment-platform-pseudolab/network/members"><img src="https://img.shields.io/github/forks/Pseudo-Lab/experiment-platform-pseudolab" alt="Forks Badge"/></a>
  <a href="https://github.com/Pseudo-Lab/experiment-platform-pseudolab/pulls"><img src="https://img.shields.io/github/issues-pr/Pseudo-Lab/experiment-platform-pseudolab" alt="Pull Requests Badge"/></a>
  <a href="https://github.com/Pseudo-Lab/experiment-platform-pseudolab/issues"><img src="https://img.shields.io/github/issues/Pseudo-Lab/experiment-platform-pseudolab" alt="Issues Badge"/></a>
  <a href="https://github.com/Pseudo-Lab/experiment-platform-pseudolab/graphs/contributors"><img alt="GitHub contributors" src="https://img.shields.io/github/contributors/Pseudo-Lab/experiment-platform-pseudolab?color=2b9348"></a>
</div>
<br>

> **ExperiBase — Open-source experimentation platform**
>
> 가짜연구소의 실제 서비스를 개선하며, A/B 테스트를 운영할 수 있는 오픈소스 실험 플랫폼을 개발합니다.

ExperiBase는 사용자 그룹에 서로 다른 기능 버전을 제공하고, 이후의 행동을 비교할 수 있도록 실험을 지원하는 플랫폼입니다. 실험 도구를 직접 개발하고 서비스에 적용하면서 **문제 발견 → 기능 개발 → 실험 → 분석·개선**으로 이어지는 과정을 만들어갑니다.

12기에서 시작한 플랫폼 개발을 이어, 13기에는 가짜연구소 홈페이지와 서비스에 적용해 실제 기능 개선 사이클을 완주하는 데 집중합니다.

## ✨ Why this project?

새로운 기능을 만들었다고 해서 서비스가 반드시 좋아지는 것은 아닙니다. 구성원이 자료를 더 쉽게 찾는지, 필요한 정보를 얻는지, 활동에 참여하는 데 도움이 되는지 확인할 필요가 있습니다.

비영리 커뮤니티에서도 한정된 개발·운영 여력 안에서 무엇을 개선할지 판단할 근거가 필요합니다. 하지만 기능 개발, 사용자 행동 기록, 실험 설계와 분석이 연결되어 있지 않으면 바꾼 기능의 효과를 확인하기 어렵습니다.

### 우리가 풀고 싶은 문제

> 커뮤니티 서비스를 만드는 사람들이 기능 변경과 사용자 행동 데이터를 연결해, 어떤 변화가 실제로 도움이 되었는지 판단할 수 있도록 돕고자 합니다.

### 무엇을 만드나요?

1. **서비스에 연결되는 실험 플랫폼** — 사용자 배정, 기능 버전 분기, 노출·전환 수집과 분석을 연결하는 도구를 개발합니다. SDK를 통해 실제 서비스에서 실험할 수 있는 기반을 마련합니다.
2. **실험으로 개선하는 기능과 서비스** — 기존 기능을 개선하거나 외부 데이터를 활용한 작은 서비스를 만들고, 사용자 반응을 확인합니다.
3. **다시 활용할 수 있는 데이터와 실험 과정** — 어떤 행동을 기록하고 무엇을 지표로 볼지 정의하며, 설계·운영·분석·후속 결정 과정을 가이드로 정리합니다.

## 🎯 Goal — 13기에 만들고 싶은 것

- [ ] 실험 플랫폼 SDK를 정리하고 가짜연구소 홈페이지에 연동합니다.
- [ ] 작은 개선 과제를 선정해 기능을 개선하거나 새로 만듭니다.
- [ ] 실제 사용자 대상 실험을 최소 1회 진행하고 결과와 후속 결정을 기록합니다.
- [ ] 실험에 활용한 데이터·지표 정의와 재사용 가능한 실험 가이드를 남깁니다.

문서함 개선을 우선 후보로 검토합니다. 콘텐츠 요약·활동 이력 연동·메일링, 뱃지·도전과제, 외부 데이터 기반 서비스 등을 살펴보되, 사용자 가치와 구현·측정 가능성을 확인해 범위를 정합니다. 모든 후보를 구현하는 것은 아닙니다.

### 📦 Expected Outcome

- **Product**: 실제 서비스에 연결한 실험 플랫폼과 개선 기능
- **Experiment**: 실험 설계·운영·분석, 해석의 한계와 후속 결정 기록
- **Data & Documentation**: 데이터·사용자 행동·지표 정의와 실험 가이드
- **Open Source**: 다른 비영리 단체와 작은 커뮤니티도 참고할 수 있는 코드와 방법

지표 상승만을 성공으로 보지 않습니다. 변화가 없거나 데이터가 부족해 판단하기 어려운 경우에도 근거와 한계를 남기는 것이 중요한 결과입니다.

## 🗺️ Weekly Roadmap — 12주

핵심 실험 1개를 기준으로 한 13기 활동 초안입니다. 대상 기능과 세부 일정은 팀 검토 및 준비 상태에 따라 조정합니다. 주차별 날짜와 방학 배치는 확정 후 반영합니다.

| Week | 주요 활동 | 결과물 |
|---|---|---|
| W01 | OT·로드맵 공유, 기존 서비스·데이터 확인, SDK 연동 준비 | 현황 요약, SDK 보완 항목 |
| W02 | 개선 과제와 최소 기능 범위 선정, 관련·외부 데이터 활용 검토 | 개선 과제와 선정 근거, 최소 범위 |
| W03 | 가설·지표·분석 방법·종료 기준 설계, 기능 구현 시작 | 실험 계획, 데이터·지표 정의 초안 |
| W04 | 기능·SDK 연동, 사용자 배정·화면 분기·데이터 수집 흐름 점검 | 연동·실험 흐름 점검 결과, 시작 전 확인 사항 |
| W05 | 준비가 완료된 실험 시작, 초기 데이터·오류 점검 | 실험 시작·초기 운영 기록 |
| W06 | 실험 운영과 데이터 품질 확인, 분석용 데이터 정리 | 운영 기록, 데이터·지표 정의 보완 |
| W07 | 실험 운영 지속, 실제 사례를 바탕으로 진행 절차 보완 | 실험 과정과 가이드 초안 |
| W08 | 사전 종료 기준과 분석 준비 상태 확인 | 종료·분석 준비 점검 결과 |
| W09 | 사전 기준에 따른 종료 여부 판단, 분석 데이터 정리 | 종료 또는 추가 수집 판단 기록, 분석용 데이터 |
| W10 | 사전 계획에 따른 결과 분석과 한계 정리 | 결과 보고서 초안 |
| W11 | 기능의 후속 방향 결정, 데이터·지표 정의와 가이드 정리 | 후속 결정, 실험 가이드 |
| W12 | Ending — 개선 사이클 회고와 결과 공유 | 최종 결과와 후속 계획 |

서비스 연동 준비와 데이터 정리는 초반부터 병행합니다. 준비가 완료되면 실험을 앞당겨 시작할 수 있으며, 실제 시작·종료 시점은 점검 결과와 사전에 정한 기준에 따릅니다.

운영·분석에 지장이 없는 여유가 생기면 다음 후보 조사, 소규모 서비스 시제품이나 작은 개선을 병행합니다. 추가 배포·실험은 진행 중인 실험에 대한 영향과 남은 분석 시간을 검토한 뒤 결정하며, 두 번째 실험은 필수 결과물이 아닙니다.

## 👥 Team — 13기

| 역할 | 이름 | 주요 담당 |
|---|---|---|
| Builder · 프로젝트 리드 | 김수현 | 프로젝트 조율, 실험 플랫폼·서비스 개발과 운영 |
| Builder · 데이터 분석가 | 최지환 | 실험 설계·분석, 실험 워크플로우와 기능 아이디어 구체화 |
| Builder · 데이터 엔지니어 | 이동욱 | 외부 데이터 조회 기반, 데이터 기반 소규모 서비스 개발·실험 연동 |
| Builder · 데이터 분석가 | 신진수 | 데이터의 서비스 활용·지표 정의, 실험 워크플로우·가이드 |

네 명 모두 빌더로 참여하며, 김수현이 프로젝트 리드를 맡아 방향과 진행을 조율합니다. 각자의 전문성을 바탕으로 개발·데이터·실험 역할을 나누고, 설계·코드·분석 결과를 함께 검토하며 서로 피드백합니다.

## 🧑‍🤝‍🧑 How We Work

```text
문제 발견 → 데이터 확인·가설 및 지표 정의 → 기능 개발 → 실험 → 분석·후속 결정 → 공유
```

- **작은 범위부터**: 실제 사용자 문제를 기준으로 개선 과제를 고르고, 필요한 만큼 구현합니다.
- **개발과 데이터 정리를 함께**: 설계가 합의된 부분부터 병행하며 주간 모임에서 진행 상황과 필요한 협업을 공유합니다.
- **근거와 한계까지 기록**: 실험 전에 판단 기준을 정하고, 기대한 변화가 없더라도 결과와 배운 점을 남깁니다.
- **공개 범위를 구분**: 공개 가능한 코드와 실험 방법을 공유합니다. 개인정보·내부 운영 데이터·회의록·접근 정보는 공개하지 않습니다.
- **정기 모임**: 매주 일요일 오후 10시(KST), Discord

## 🏛️ Architecture & Tech Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS
- **Backend**: FastAPI, Python, Pydantic
- **SDK**: TypeScript, React 연동
- **Data**: Cloudflare D1·R2, Supabase PostgreSQL·Auth
- **Infrastructure**: Docker, Kubernetes, ArgoCD

## 🖥️ Local Deployment

Docker와 Docker Compose가 필요합니다. 실행 전에 [환경 변수 템플릿](./backend/.env.sample)을 참고해 `backend/.env`를 작성하고 필요한 설정을 채워주세요. 실제 키나 토큰은 저장소에 커밋하지 않습니다.

```bash
# Bring up the Vite DEV Frontend and FastAPI Backend
docker compose -f docker-compose.dev.yml up -d --build
```

- **Frontend App**: [localhost:8081](http://localhost:8081)
- **Backend API**: [localhost:8000/docs](http://localhost:8000/docs)

위 명령은 [개발용 Compose 설정](./docker-compose.dev.yml)을 기준으로 합니다. 로컬 실행과 실제 서비스 대상 실험 운영은 구분하며, 운영 데이터·권한은 별도로 준비해야 합니다.

## 📚 Archive & Documentation

12기의 개발을 이어가는 저장소이며, 13기 결과는 공개 가능한 범위를 확인해 정리합니다.

| 자료 | 링크 |
|---|---|
| 소스 코드·변경 이력 | [GitHub Repository](https://github.com/Pseudo-Lab/experiment-platform-pseudolab) |
| 실험 플랫폼·Feature Flag 개념 | [실험 플랫폼 개념 가이드](./docs/guides/experiment_platform_concepts.md) |
| 서비스 연동 | [SDK 설치·사용 안내](./packages/sdk/README.md) |
| 데이터 접근 기준 | [데이터 접근 가이드](./docs/guides/data_access.md) |
| 문서 구조·관리 규칙 | [Docs Guide](./docs/README.md) |

문서는 `active / superseded / archive` 상태로 관리하며, `docs/guides`, `docs/reports`, `docs/archive`, `docs/superseded`로 구분합니다.

## 🌱 참여 및 기여 안내 (How to Engage)

**13기에는 러너를 추가 모집하지 않습니다.** 저장소에 대한 버그 리포트, 문서 개선과 코드 기여는 환영합니다.

- 버그·개선 제안: [GitHub Issues](https://github.com/Pseudo-Lab/experiment-platform-pseudolab/issues)
- 코드·문서 기여: 관련 Issue에서 범위를 논의한 뒤 Pull Request를 보내주세요.
- 커뮤니티 문의: [가짜연구소 Discord](https://discord.gg/EPurkHVtp2)

Issue와 Pull Request에도 개인정보, 내부 회의 내용, 실제 운영 데이터나 인증 정보를 포함하지 말아주세요.

## Acknowledgement 🙏

이 프로젝트는 가짜연구소 Open Academy로 진행됩니다.
여러분의 참여와 기여가 ‘우연한 혁명(Serendipity Revolution)’을 가능하게 합니다. 모두에게 깊은 감사를 전합니다.

ExperiBase is developed as part of Pseudo-Lab's Open Research Initiative. Special thanks to our contributors and the open source community for their valuable insights and contributions.

## About Pseudo Lab 👋🏼

[Pseudo-Lab](https://pseudo-lab.com/) is a non-profit organization focused on advancing machine learning and AI technologies. Our core values of Sharing, Motivation, and Collaborative Joy drive us to create impactful open-source projects. With over 5k+ researchers, we are committed to advancing machine learning and AI technologies.

## Contributors 😃

<a href="https://github.com/Pseudo-Lab/experiment-platform-pseudolab/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=Pseudo-Lab/experiment-platform-pseudolab" alt="ExperiBase contributors" />
</a>

## License 🗞

This project is licensed under the [MIT License](https://opensource.org/licenses/MIT).
