Status: active
Last-Validated: 2026-03-16

# OSS PoC Progress 01 — `cn` Utility Parallel Extraction

## What was done
- Created local core PoC path: `packages/core/`
- Added candidate utility: `packages/core/src/ui/cn.ts`
- Kept existing app utility intact (`frontend/src/lib/utils.ts`) to avoid runtime risk.

## Why this PoC
- Very low-risk utility
- Easy to validate import boundary and package layout
- Good first step before functional module extraction

## Next
1. Add import-boundary lint rule draft (`core -> overlay` deny)
2. Add tiny unit test for `cn` in core path
3. Replace one usage site behind a reversible commit (no push yet)
