Status: active
Last-Validated: 2026-03-17

# OSS PoC Progress 01 — `cn` Utility Parallel Extraction

## What was done
- Created local core PoC path: `packages/core/`
- Added candidate utility: `packages/core/src/ui/cn.ts`
- Added alias wiring for PoC import:
  - `frontend/vite.config.ts` (`@core`)
  - `frontend/tsconfig.json` (`@core/*`)
- Switched usage sites to core utility import:
  - `frontend/src/components/ui/button.tsx` → `import { cn } from '@core/ui/cn'`
  - `frontend/src/components/ui/input.tsx` → `import { cn } from '@core/ui/cn'`
  - `frontend/src/components/ui/badge.tsx` → `import { cn } from '@core/ui/cn'`
  - `frontend/src/components/ui/card.tsx` → `import { cn } from '@core/ui/cn'`
  - `frontend/src/components/ui/textarea.tsx` → `import { cn } from '@core/ui/cn'`
  - `frontend/src/components/ui/table.tsx` → `import { cn } from '@core/ui/cn'`
  - `frontend/src/components/ui/select.tsx` → `import { cn } from '@core/ui/cn'`
  - `frontend/src/components/ui/dropdown-menu.tsx` → `import { cn } from '@core/ui/cn'`
  - `frontend/src/features/dashboard/components/mvp/DashboardKpiCards.tsx` → `import { cn } from '@core/ui/cn'`
- Verified build passes after the change (`npm run build`).
- Aligned frontend container builds with the PoC alias by including
  `packages/core` in Docker and CI build inputs.

## Why this PoC
- Very low-risk utility
- Easy to validate import boundary and package layout
- Good first step before functional module extraction

## Next
1. Add import-boundary lint rule draft (`core -> overlay` deny)
2. Add tiny unit test for `cn` in core path
3. Replace one usage site behind a reversible commit (no push yet)

## Progress Update — Guardrail Added
- Added boundary guard script: `scripts/check-core-boundary.sh`
- Rule: fail if `packages/core/src` imports overlay app paths (`@/`, `frontend/src`, feature/service/layout aliases)
- Current result: PASS (no violation)

## Progress Update ??Container Build Alignment
- Frontend Docker and CI builds now use the repository root as the build
  context so `@core/ui/cn` resolves inside containerized builds.
- Dev compose mounts `packages/core` alongside `frontend` to preserve the same
  alias behavior during Vite development in the container.
