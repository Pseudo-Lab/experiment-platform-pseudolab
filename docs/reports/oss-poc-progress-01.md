Status: active
Last-Validated: 2026-03-16

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

## Pre-split Preparation Update
- Added `packages/core` package scaffold for OSS handoff preparation (without physical repo split yet):
  - `packages/core/package.json` (`@pseudo-lab/core`, exports, build/typecheck scripts)
  - `packages/core/tsconfig.build.json`
  - `packages/core/src/index.ts`
  - `packages/core/src/ui/cn.ts` aligned with existing app behavior (`clsx` + `tailwind-merge`)
- Validation:
  - `cd packages/core && npm run build` PASS
  - frontend button test/build PASS after scaffold (`vitest`, `vite build`)
