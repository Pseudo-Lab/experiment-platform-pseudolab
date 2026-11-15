Status: active
Last-Validated: 2026-11-16

# Iterglow 이미지 전환·구형 게시 종료

## 목표와 범위

Ops와 운영 Pod의 `iterglow-*` 이미지 전환을 확인한 다음 구형 GHCR 태그 게시를 종료한다. 이미지 패키지·기존 버전 삭제, 서비스명·namespace·인증 변경은 포함하지 않는다.

## 전환 전 확인과 단계별 경과

- 앱 기준: `3c69886472b678ca19fb3881e92a46f358383c0c`.
- [GitOps CI 43730065600](https://github.com/Pseudo-Lab/experiment-platform-pseudolab/actions/runs/43730065600): build/push 및 Ops 태그 갱신 성공. 신·구 이미지는 같은 Buildx 빌드에서 함께 게시된다.
- Ops main `5a88ed7dfaa510b2cc5340f0e36e8cf87849e4bc`: frontend/backend 모두 구형 `experiment-platform-pseudolab-*` 이미지, 태그는 앱 기준 SHA.
- 운영 SSH 읽기 조회: 두 Deployment가 구형 이미지의 위 SHA로 실행 중이며 readyReplicas=1. ArgoCD `experiment-platform`은 위 Ops revision에 Synced/Healthy.
- 공개 경로: 홈페이지 200, `/api/v1/status`는 후행 slash 리다이렉트 후 200, `/api/v1/auth/providers` 200 및 Google 제공자 활성.
- 최초 조회에서 Ops 전환이 완료되지 않아 구형 게시 종료를 보류했다. 이후 사용자가 Ops 전환·운영 배포와 정상 확인 후 구형 게시 종료를 승인했다.
- [Ops PR #35](https://github.com/Pseudo-Lab/DevFactory-Ops/pull/35)의 validate/terraform 성공 후 main `7e982a2f31582ec03889961b6199cb5eb3d896fd`에 반영했다. 기존 ArgoCD 자동 배포 후 두 Pod의 Iterglow 이미지 pull 성공(15:38:18 UTC), Ready=true, 재시작 0과 Synced/Healthy를 확인했다.
- 전환 후 `iterglow.pseudolab-devfactory.com`과 `exp.pseudolab-devfactory.com`의 `/`, `/api/v1/status/`, `/api/v1/auth/providers`, `/api/v1/auth/me` 모두 200. Google 제공자 활성 상태 유지. 인증된 사용자 기능 검증은 포함하지 않는다.
- imageID 문자열은 동일 content digest의 기존 구형 repo 별칭으로 표시되지만, Pod spec과 kubelet Pulled 이벤트가 새 Iterglow repo의 실제 pull 성공을 확인한다.

## 반영한 변경

1. Ops branch `ops/iterglow-images-20261116`, workspace `/home/ubuntu/.openclaw/workspace-ops-iterglow-images-20261116`: prod kustomization의 `newName` 두 개만 `ghcr.io/pseudo-lab/iterglow-frontend`, `ghcr.io/pseudo-lab/iterglow-backend`로 변경한다. base 매칭용 `name`과 기존 SHA는 유지한다.
2. 앱 branch `ci/retire-legacy-images-20261116`, workspace `/home/ubuntu/.openclaw/workspace-experiment-retire-legacy-images-20261116`: CI 이미지 env를 Iterglow로 변경하고 중복 리터럴 태그를 제거한다. Ops 태그 갱신·검증은 `.newName`을 선택한다. ARM64, cache, trigger, 검증 실패 처리는 유지한다.

## 검증

- actionlint: 변경 workflow 통과.
- 실제 workflow의 yq 갱신·검증 스크립트를 임시 Ops 복사본에서 실행: 통과.
- Kustomize render: frontend/backend가 모두 `iterglow-*:review-sha`로 생성됨.
- 전환 전 Ops에 새 workflow 검증을 실행하면 이미지 항목 누락으로 실패함을 확인. 잘못된 갱신을 성공으로 처리하지 않는다.
- 양쪽 `git diff --check`: 통과.
- 새 GHCR 이미지 익명 manifest 조회는 401. 운영 pull 인증으로 새 이미지가 내려받아지는지는 실제 Ops 전환 후 확인해야 한다. 비밀값은 조회하거나 복사하지 않았다.

## 승인 후 적용 순서와 종료 기준

1. 원격 최신 앱/Ops와 당일 GitHub 게시 시간 규칙을 다시 확인한다. Ops의 최신 SHA를 유지하며 `newName` 변경만 반영한다.
2. Ops PR 검증·main 반영 후 기존 ArgoCD 자동 배포를 관찰한다. 수동 sync나 중복 재배포는 하지 않는다.
3. 새 이미지로 실행 중인 두 Deployment/Pod의 readiness·imageID, ArgoCD Synced/Healthy, 공개 홈페이지·status·auth/providers 응답을 확인한다. image pull 실패 또는 readiness 실패 시 앱 변경을 반영하지 않는다.
4. 위 전환 확인 후 앱 CI 변경을 main에 반영한다. CI/GitOps 성공 및 새 SHA의 Iterglow 이미지 게시, Ops 태그 갱신, 운영 반영을 다시 확인한다.
5. 실제 결과와 SHA·CI 링크를 이 기록에 갱신한다.

## 복구 순서

Ops 전환 단계에서 실패하면 동일 SHA의 구형 `newName`으로 되돌린다. 앱 CI까지 전환한 후 구형 이미지로 복귀해야 한다면 구형 게시를 먼저 복원하고 필요한 SHA가 존재하는지 확인한 뒤 Ops를 되돌린다. 기존 구형 GHCR 이미지는 삭제하지 않는다.

## 교차 검토

- Gemini Hydrogen XHigh가 원격 baseline을 독립 분석하고 양쪽 diff를 검토했다. Ops `newName`만 먼저 바꾸면 기존 CI의 `.name` 태그 갱신이 유지됨을 재확인했다.
- 이미지 pull 권한, readiness probe 부재에 따른 HTTP smoke 필요, CI 전환 후 구형 이미지로 복구할 때의 SHA 주의를 반영했다. Pod Ready와 ArgoCD Healthy만으로 서비스 정상 판정을 내리지 않는다.
- 선택적 `(.newName // .name)` fallback은 채택하지 않았다. 현재 Ops는 명시적 `newName`을 사용하며 base 이름 정리는 요청 범위가 아니다. 해당 계약을 유지하고 불일치 시 실패하도록 둔다.
- 적용 직전에 진행 중 GitOps CI와 양쪽 최신 remote를 확인하여 기존 자동 태그 push와 경합을 피한다.

## 앱 CI 반영

- [앱 PR #56](https://github.com/Pseudo-Lab/experiment-platform-pseudolab/pull/56): CI 통과 후 main `2342b4fa746c61503fc715e8a979b12770ad49a4`에 반영.
- [PR CI](https://github.com/Pseudo-Lab/experiment-platform-pseudolab/actions/runs/43731081114): SDK build, frontend tests/build, backend compile/tests 통과.
- [main CI](https://github.com/Pseudo-Lab/experiment-platform-pseudolab/actions/runs/43731308026): 성공.
- [GitOps CI](https://github.com/Pseudo-Lab/experiment-platform-pseudolab/actions/runs/43731441436): build/push와 Ops 태그 갱신 모두 성공. 빌드 명령과 manifest push 로그에 Iterglow frontend/backend의 SHA 및 latest 태그만 있으며 구형 이미지 repo push가 없음을 확인했다.
- GitOps 시작 전에 별도 README 전용 커밋 `94374d14dc436de98708025e61c5b78934e0558a`가 main에 추가되어 실제 게시 SHA는 `94374d1`이다. 검증한 앱 CI SHA `2342b4f`와 backend/frontend/packages/.github diff는 없다. 기존 workflow_run 동작에 따른 결과이며 수동 빌드·배포를 추가하지 않았다.
- Ops 태그 갱신 결과: `dfb2b45` main, 두 Iterglow 이미지의 newTag `94374d14dc436de98708025e61c5b78934e0558a`.

## 최종 운영 확인

- 2026-11-16 00:47 KST: ArgoCD가 Ops `dfb2b45816acb6608ced7b5ff3802c84cf606efa`에서 Synced/Healthy.
- backend/frontend 모두 `ghcr.io/pseudo-lab/iterglow-*:94374d14dc436de98708025e61c5b78934e0558a` 실행, 각 Pod Ready=true, restartCount=0, 대기 오류 없음. kubelet Pulled 이벤트는 각각 15:47:08/09 UTC에 새 태그 pull 성공을 기록한다.
- imageID content digest는 전환 전과 동일하다. 새 태그는 기존 빌드 layer를 재사용하며, containerd가 imageID에 기존 구형 repo 별칭을 반환하는 것은 실제 pull 대상과 별개다. 새 repo/tag의 실행 근거는 Pod spec·Pulled 이벤트로 확인했다.
- 두 도메인의 홈페이지, status, auth/providers, auth/me 모두 200. Google 제공자 활성 유지. 인증된 사용자 동작이나 쓰기 기능은 이번 이미지 전환 smoke 범위에 포함하지 않았다.
- Ops 태그 갱신 뒤 [Ops CI](https://github.com/Pseudo-Lab/DevFactory-Ops/actions/runs/43731509556)도 성공.
- 구형 이미지 태그 게시는 종료했고, 기존 GHCR 패키지·태그는 복구용으로 보존했다. 수동 sync·중복 재배포·시크릿 변경은 수행하지 않았다.
- 이 완료 기록은 docs-only 변경으로 게시하며 추가 앱 빌드·배포를 유발하지 않는다.

## 담당과 완료 상태

Codex가 구현·통합 검증, Gemini Hydrogen XHigh가 읽기 전용 독립 검토를 담당한다. 사용자 승인 후 Ops PR #35를 main에 반영했다. 새 이미지 운영 실행 확인 후 앱 PR #56을 main에 반영했다. GitOps 자동 배포까지 검증을 완료했다. 후속 작업은 없다.
