# Repo Rename Progress Log

Last updated: 2026-03-14 (Asia/Seoul)

## Goal

Align this repository and deployment identifiers to:

- Repository: `Pseudo-Lab/experiment-platform-pseudolab`
- Service/image naming: `experiment-platform-pseudolab-*`

## Current Status

- Local commit created: `6f85399`
- Commit message: `chore: align repo/service identifiers to experiment-platform-pseudolab`
- Working tree: clean
- Main merge: **pending** (intentionally waiting for Ops repository updates)

## Completed in This Repository

1. GitHub and docs links updated to new repo slug.
2. CI identifiers updated in `.github/workflows/gitops-ci.yml`:
   - `FRONTEND_IMAGE` -> `ghcr.io/pseudo-lab/experiment-platform-pseudolab-frontend`
   - `BACKEND_IMAGE` -> `ghcr.io/pseudo-lab/experiment-platform-pseudolab-backend`
   - `OPS_KUSTOMIZATION_FILE` -> `services/experiment-platform-pseudolab/overlays/prod/kustomization.yaml`
   - bot name/email + commit prefix updated to pseudolab naming.
3. Docker service/container names updated in:
   - `docker-compose.yml`
   - `docker-compose.dev.yml`
4. Frontend identifiers updated:
   - `frontend/vite.config.ts` proxy target name
   - `frontend/package.json` and `frontend/package-lock.json` package name
5. External impact checklist created:
   - `docs/repo-rename-external-checklist.md`

## Pending Before Main Merge

Ops repository must be updated first to avoid deployment workflow failure.

Required Ops conditions:

1. Path exists:
   - `services/experiment-platform-pseudolab/overlays/prod/kustomization.yaml`
2. Image names in Ops kustomization match:
   - `ghcr.io/pseudo-lab/experiment-platform-pseudolab-frontend`
   - `ghcr.io/pseudo-lab/experiment-platform-pseudolab-backend`
3. GitOps/Kustomize validation passes in Ops repo.

## Resume Steps (When Returning Later)

1. Check this repo status:
   - `git status`
   - `git log --oneline -n 3`
2. Confirm whether Ops updates are complete.
3. If Ops is ready:
   - merge commit `6f85399` to `main`
   - trigger/observe GitHub Actions on `main`
4. Verify CI jobs:
   - build-and-push success
   - update-ops-repo success
5. If CI fails, inspect:
   - image name mismatch
   - missing Ops kustomization path
   - stale hardcoded `experiment-platform` references

## Known Notes

- `docker compose config` check previously failed only because `backend/.env` was missing in local environment.
- One old slug reference intentionally remains in checklist doc as a redirect check item:
  - `docs/repo-rename-external-checklist.md` (`https://github.com/Pseudo-Lab/experiment-platform`)
