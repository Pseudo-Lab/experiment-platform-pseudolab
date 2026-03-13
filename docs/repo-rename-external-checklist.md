# Repository Rename External Impact Checklist

대상 레포: `Pseudo-Lab/experiment-platform-pseudolab`

## 1) GitHub Repository

- [ ] 레포 URL 접근 확인: `https://github.com/Pseudo-Lab/experiment-platform-pseudolab`
- [ ] 구 URL 리다이렉트 확인: `https://github.com/Pseudo-Lab/experiment-platform`
- [ ] README 배지/링크가 새 레포를 가리키는지 확인
- [ ] 브랜치 보호 규칙(branch protection) 유지 여부 확인
- [ ] CODEOWNERS/리뷰어 규칙 동작 확인

## 2) CI/CD (GitHub Actions)

- [ ] Actions 실행 성공 확인 (`main` push 또는 manual dispatch)
- [ ] `GITHUB_TOKEN` 권한 이슈 없는지 확인
- [ ] 레포 시크릿(`OPS_REPO_TOKEN` 등) 유효성 확인
- [ ] workflow에서 레포 슬러그 하드코딩 여부 재검색

## 3) Container Registry (GHCR)

- [ ] 이미지 네이밍 정책 결정
- [ ] `ghcr.io/pseudo-lab/experiment-platform-pseudolab-frontend` 유지/변경 여부 결정
- [ ] `ghcr.io/pseudo-lab/experiment-platform-pseudolab-backend` 유지/변경 여부 결정
- [ ] 변경 시 배포 매니페스트/ops repo 동시 반영

## 4) Ops Repository / GitOps

- [ ] DevFactory-Ops 경로 유효성 확인
- [ ] `services/experiment-platform-pseudolab/overlays/prod/kustomization.yaml` 경로 유효성 확인
- [ ] 이미지 태그 업데이트 커밋 정상 반영 확인
- [ ] ArgoCD/Flux 등 GitOps 동기화 상태 확인

## 5) Integrations (Webhooks / Apps / Bots)

- [ ] GitHub Webhook delivery 정상 여부 확인
- [ ] Slack/Discord 알림 대상 레포명 표시 확인
- [ ] 외부 GitHub App 설치 대상이 새 레포로 유지되는지 확인
- [ ] 개인/조직 자동화 스크립트에 구 슬러그 하드코딩 없는지 확인

## 6) Documentation & Onboarding

- [ ] clone 명령이 새 레포명으로 안내되는지 확인
- [ ] 로컬 경로 예시(`cd ...`)가 현재 레포명과 일치하는지 확인
- [ ] 운영 문서(위키/노션/런북) 링크 업데이트

## 7) Post-Rename Smoke Test

- [ ] `frontend` 빌드/테스트 통과
- [ ] `backend` 앱 기동 및 `/api/v1/status/` 응답 확인
- [ ] Docker Compose 기동 확인
- [ ] 대시보드 핵심 API (`/api/v1/dashboard/*`) 정상 응답 확인

## 8) Rollback / Fallback Note

- [ ] 외부 시스템에서 구 슬러그 의존 발견 시 임시 리다이렉트/별칭 전략 기록
- [ ] 변경 이력(언제, 무엇을, 왜 바꿨는지) 문서화