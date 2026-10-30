# 실험플랫폼 팀 활동 페이지

Status: active
Last-Validated: 2026-10-30

가짜연구소 실험플랫폼 팀의 진행 소식과 짧은 팀 소개를 모으고,
ExperiBase·GitHub·팀 블로그·소식 신청으로 연결합니다.
한국어와 영어를 함께 제공합니다.
다크모드는 기기 설정을 따르며, 상단 해·달 버튼으로 직접 선택한 모드는 다음 방문에도 유지됩니다.

- 공개 주소: https://pseudo-lab.github.io/experiment-platform-pseudolab/
- 홈페이지 소스 및 배포: 이 레포의 `pages` 브랜치
- 실제 서비스 코드: `main` 브랜치

## 개발 및 배포

Node.js 22에서 실행합니다.

```sh
npm ci
npm run dev
npm run build
npm run preview
```

문서만 바꾼 경우를 제외하고 `pages` 브랜치에 push하면 `.github/workflows/pages.yml`이 `dist/`를
GitHub Pages로 배포합니다. Pages의 게시 방식은 GitHub Actions이며,
`github-pages` 환경은 `pages` 브랜치 배포만 허용합니다.
서비스의 Docker·GitOps workflow는 이 브랜치에 포함하지 않습니다.
이 브랜치는 홈페이지 전용의 독립 이력이며 `main`에 병합하지 않습니다.

## 내용 변경

- 문구·진행 소식·외부 링크: `src/main.jsx`의 `copy`와 `urls`
- 한국어(`ko`)와 영어(`en`)를 함께 수정합니다.
- 팀원 사진·프로필 링크·소개: `src/main.jsx`의 `members` (공개 프로필의 2026-10-30 정보로 초기 구성, 자동 동기화 아님)
- 스타일: `src/style.css`
- 기술 글 원문은 팀 블로그에 게시하고 관련 링크로 연결합니다.
- 비밀값·운영 데이터·내부 회의록은 공개하지 않습니다.

## 이전 및 검증 인계

- 기존 Sites 시안에서 홈페이지 소스만 복사했습니다. Sites 식별자·인증정보·스크린샷·기존 저장소 이력은 포함하지 않았습니다.
- GitHub Pages의 레포 경로에 맞춰 Vite `base`를 설정하고 재현 가능한 설치를 위해 lockfile을 포함합니다.
- 배포 전 clean install·build 및 실제 경로에서 KO/EN·주/보조 버튼·외부 링크·모바일 메뉴·진행 소식·가로 넘침을 검증합니다.
