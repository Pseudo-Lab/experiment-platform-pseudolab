#!/usr/bin/env bash
set -euo pipefail

# Guardrail: core must not import overlay(app) paths.
# Fails when packages/core contains imports from frontend/src or @/* aliases.

violations=$(grep -RInE "from ['\"](@/|\.\./\.\./frontend/src|frontend/src|@/features|@/services|@/layouts)" packages/core/src || true)

if [ -n "$violations" ]; then
  echo "[FAIL] core -> overlay import violation(s) found:"
  echo "$violations"
  exit 1
fi

echo "[PASS] no core -> overlay import violations"
