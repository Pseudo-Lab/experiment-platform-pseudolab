Status: archived
Last-Updated: 2026-03-22
Archived-Reason: physical split execution is paused pending product-value decision (including GrowthBook adoption review)

# OSS Physical Split Plan v1

> Note (2026-03-22): kept for reference only. Current direction is MVP-first process simplification and value validation before physical OSS split execution.

## 목적

`packages/core` 로컬 스캐폴드를 독립 OSS 레포(`Pseudo-Lab/experiment-platform`)로 물리적으로 분리하고,
pseudolab 레포가 로컬 경로 대신 패키지를 참조하도록 cutover한다.

---

## 확정 사항

| 항목 | 결정 |
| :--- | :--- |
| OSS 레포명 | `Pseudo-Lab/experiment-platform` (추후 변경 가능) |
| npm 패키지명 | `@pseudo-lab/core` (현재 scaffold 그대로) |
| 배포 채널 | GitHub Packages |
| 외부 사용자 대상 | 사실상 내부 전용 — 패키지명 변경 비용 낮음 |

---

## Phase 2-A: OSS 레포 준비

> pseudolab 레포와 독립적으로 진행 가능

### Step 1 — GitHub 레포 생성 (soo 직접)

- `Pseudo-Lab/experiment-platform` 생성 (Public, MIT License)
- `main` 브랜치 보호 규칙 설정 (PR 필수)
- GitHub Packages 활성화

### Step 2 — 레포 구조 초기화

`packages/core/` 내용을 OSS 레포 루트로 이관한다.

```
experiment-platform/            ← OSS 레포 루트
├── src/
│   ├── index.ts                ← packages/core/src/index.ts
│   └── ui/
│       └── cn.ts               ← packages/core/src/ui/cn.ts
├── package.json                ← packages/core/package.json 기반
│                                  (private: false, publishConfig 추가)
├── tsconfig.build.json         ← packages/core/tsconfig.build.json
├── tsconfig.json               ← 개발용 (extends build)
├── .gitignore                  ← node_modules, dist
└── README.md                   ← 설치/사용법 포함
```

`package.json` 변경 사항:
```diff
- "private": true,
+ "private": false,
+ "publishConfig": {
+   "registry": "https://npm.pkg.github.com"
+ }
```

### Step 3 — CI 구성

`.github/workflows/ci.yml`:
```yaml
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://npm.pkg.github.com'
      - run: npm ci
      - run: npm run typecheck
      - run: npm run build
```

`.github/workflows/publish.yml` (릴리즈 트리거):
```yaml
on:
  release:
    types: [published]
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://npm.pkg.github.com'
      - run: npm ci && npm run build
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Step 4 — 초기 릴리즈

- `v0.1.0` 태그 생성
- GitHub Release 생성 → publish workflow 트리거

---

## Phase 2-B: pseudolab Cutover

> Phase 2-A (v0.1.0 릴리즈) 완료 후 진행

### Step 5 — 패키지 설치

`frontend/` 디렉터리에서:
```bash
# .npmrc 추가 (GitHub Packages 인증)
echo "@pseudo-lab:registry=https://npm.pkg.github.com" >> .npmrc
echo "//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}" >> .npmrc

npm install @pseudo-lab/core@0.1.0
```

### Step 6 — alias 제거

```diff
# frontend/vite.config.ts
- '@core': path.resolve(__dirname, '../packages/core/src'),
```

```diff
# frontend/tsconfig.json
- "@core/*": ["../packages/core/src/*"]
```

### Step 7 — import 경로 일괄 교체 (9개 파일)

```diff
- import { cn } from '@core/ui/cn'
+ import { cn } from '@pseudo-lab/core/ui/cn'
```

대상 파일:
- `frontend/src/components/ui/button.tsx`
- `frontend/src/components/ui/input.tsx`
- `frontend/src/components/ui/badge.tsx`
- `frontend/src/components/ui/card.tsx`
- `frontend/src/components/ui/textarea.tsx`
- `frontend/src/components/ui/table.tsx`
- `frontend/src/components/ui/select.tsx`
- `frontend/src/components/ui/dropdown-menu.tsx`
- `frontend/src/features/dashboard/components/mvp/DashboardKpiCards.tsx`

### Step 8 — 로컬 packages/core 제거

```bash
rm -rf packages/core/
```

`docker-compose.dev.yml`에서 core 볼륨 마운트 제거:
```diff
- - ./packages/core:/app/packages/core
```

### Step 9 — 검증

```bash
npm run build                    # 빌드 통과
npm run test                     # 프론트엔드 테스트 통과
scripts/check-core-boundary.sh   # 경계 가드 (OSS 패키지 경로 기준 업데이트 필요)
```

대시보드 주요 뷰 육안 확인:
- [ ] Overview KPI 카드 렌더링
- [ ] GitHub 대시보드 렌더링
- [ ] Discord 대시보드 렌더링
- [ ] 다크모드 / 라이트모드 전환

---

## 롤백 플랜

| 단계 | 롤백 방법 |
| :--- | :--- |
| Step 6~7 후 빌드 실패 | `@core` alias 복원, import 경로 revert |
| Step 8 후 오류 | `packages/core` git checkout으로 복원 |
| OSS 레포 CI 실패 | pseudolab cutover 중단, 로컬 경로 유지 |

---

## Exit Criteria

- [ ] OSS 레포 독립 빌드/typecheck CI 통과
- [ ] `@pseudo-lab/core@0.1.0` GitHub Packages 배포 완료
- [ ] pseudolab 프론트엔드 빌드 및 테스트 통과
- [ ] 대시보드 UI 회귀 없음
- [ ] `packages/core` 로컬 경로 완전 제거

---

## 참조 문서

- `docs/reports/oss-split-cutover-checklist.md`
- `docs/reports/oss-poc-progress-01.md`
- `docs/reports/oss-core-boundary-spec-v1.md`
- `scripts/check-core-boundary.sh`
