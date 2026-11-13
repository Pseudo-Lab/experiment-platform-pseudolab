Status: active
Last-Validated: 2026-11-13

# Experiment API input validation — local fix

> 최신 상태: 2026-11-14 운영 반영·런타임 확인 완료([PR #39](https://github.com/Pseudo-Lab/experiment-platform-pseudolab/pull/39)). 아래의 미커밋·운영 미반영 표현은 해당 단계 당시 기록이다. 실제 Google 계정 선택·동의 및 지정 이메일 초대 수락은 아직 확인하지 않았다. 상세 근거는 [운영 반영 기록](2026-11-13-experiment-status-history.md#운영-반영-완료--2026-11-14)을 따른다.

## Task Metadata
- Task ID: experiment-api-validation-20261113
- Date: 2026-11-13
- Owner: experiment-lead-v3

## Scope
- In scope: reject a blank primary metric on initial launch; validate partial exposure-window updates against stored dates and reject invalid windows on launch/resume.
- Out of scope: event collection after pause/completion, flag rollout policy, account display, deployment and production data changes.

## Workspace
- Worktree: /home/ubuntu/.openclaw/workspace-experiment-api-validation-20261113
- Branch: fix/api-validation-20261113
- Base: 6c7ae1de3c2ebf0203124f07d5aa23852c285fb8
- Changes remain local and uncommitted; no GitHub publication or deployment.

## Inputs Used
- AGENTS.md, docs/reports/_index.md, docs/guides/agent_collaboration.md.
- Reproduction: local API accepted whitespace-only primary_metric and a single-field update that placed end_at before the stored start_at.
- Existing placement helpers interpret timezone-less timestamps as UTC.

## Changes Made
- backend/app/services/experiment.py: initial launch rejects empty/whitespace-only primary_metric with 422. Date edits and transitions to running compare the effective stored-plus-patched start/end before writing. Equal or reversed windows return 422.
- Comparison uses local UTC-aware values and preserves stored timestamp formats. Existing null-is-ignored PATCH behavior and one-sided windows remain supported.
- Invalid historical windows cannot start/resume until corrected; correction and launch may occur together. Completion remains available.
- backend/tests/test_experiments.py and backend/tests/test_public_accounts.py add 38 regression cases, including ordinary account-owned SDK v1 projects and cross-account access checks.

## Validation
- Initial regression run before the fix: 16 failed, 8 passed. Rejected-write assertions failed against the original implementation.
- Final full backend suite: 601 passed, 6 existing deprecation warnings, 41.28s.
- Isolated real FastAPI requests with synthetic owner sessions: original invalid requests now return 422 without persistence; corrected metric/window launch requests return 200.
- git diff --check passes.
- Frontend tests/build were not repeated: no UI or frontend changes.
- All persistence checks used in-memory SQLite; production D1, Google OAuth, and deployment were not exercised.

## Gemini Review
- agy model list confirmed gemini-4-hydrogen-xhigh; explicitly selected Hydrogen XHigh for routine code review.
- Gemini reviewed the supplied implementation proposal and test diff without editing project files.
- Adopted useful suggestions: UTC-discriminating naive/aware cases, null-ignore interaction, running-state updates, missing-record 404 and completion of historical invalid windows.
- Extra parsing and Enum-normalization suggestions were unnecessary after checking Pydantic datetime fields and the str-based status Enum. Codex implemented and verified the final diff.
- Assessment: useful for test boundaries, with manual filtering needed for suggestions based on incomplete schema context.
- External local evidence directory: /home/ubuntu/.codex/reviews/iterglow-api-validation-fix-20261113 (test logs, API proof and Gemini review).

## Risks
- Existing records are not rewritten. Records with an invalid window need a valid date correction before launch/resume.
- Pause/completion event collection policy remains a separate, unresolved follow-up.

## Next Owner
- Owner: experiment-lead-v3 / user.
- Expected next action: review the local diff; publish/deploy only within separately authorized scope and the existing GitHub time rules.
