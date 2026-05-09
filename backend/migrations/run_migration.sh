#!/bin/bash
# Cloudflare D1 마이그레이션 실행
# 사용법:
#   ./migrations/run_migration.sh             # migrations/*.sql 전체 순차 실행
#   ./migrations/run_migration.sh 005         # 005로 시작하는 migration만 실행
#   ./migrations/run_migration.sh 005 008     # 005~008 범위 실행

set -euo pipefail

# .env 로드
if [ -f .env ]; then
    set -a
    # shellcheck disable=SC1091
    source .env
    set +a
fi

: "${CLOUDFLARE_ACCOUNT_ID:?CLOUDFLARE_ACCOUNT_ID is required}"
: "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN is required}"
: "${D1_DATABASE_ID:?D1_DATABASE_ID is required}"

START_PREFIX="${1:-}"
END_PREFIX="${2:-}"

run_sql() {
    local sql="$1"
    SQL="$sql" python3 - <<'PY' | curl -s -X POST \
  "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}/query" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data-binary @- | python3 -c '
import sys, json
r = json.load(sys.stdin)
if r.get("success"):
    print("  ✅ OK")
else:
    print("  ❌", r.get("errors"))
    sys.exit(1)
'
import json, os
print(json.dumps({"sql": os.environ["SQL"]}))
PY
}

run_file() {
    local migration_file="$1"
    local sql_buffer=""

    echo "D1 마이그레이션 실행: ${migration_file}"

    while IFS= read -r line || [ -n "$line" ]; do
        # 주석, 빈줄 스킵
        [[ "$line" =~ ^[[:space:]]*-- ]] && continue
        [[ -z "${line// }" ]] && continue

        sql_buffer="${sql_buffer} ${line}"

        # 세미콜론으로 statement 끝 감지
        if [[ "$line" == *";" ]]; then
            run_sql "$sql_buffer"
            sql_buffer=""
        fi
    done < "$migration_file"
}

mapfile -t migration_files < <(find ./migrations -maxdepth 1 -type f -name '[0-9][0-9][0-9]_*.sql' | sort)

if [ "${#migration_files[@]}" -eq 0 ]; then
    echo "실행할 migration 파일이 없습니다."
    exit 0
fi

for migration_file in "${migration_files[@]}"; do
    filename="$(basename "$migration_file")"
    prefix="${filename:0:3}"

    if [ -n "$START_PREFIX" ] && [ "$prefix" -lt "$START_PREFIX" ]; then
        continue
    fi
    if [ -n "$END_PREFIX" ] && [ "$prefix" -gt "$END_PREFIX" ]; then
        continue
    fi

    run_file "$migration_file"
done

echo "마이그레이션 완료"
