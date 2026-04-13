#!/bin/bash
# Cloudflare D1 마이그레이션 실행
# 사용법: ./migrations/run_migration.sh

set -e

# .env 로드
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

MIGRATION_FILE="./migrations/001_experiment_platform_core.sql"

echo "D1 마이그레이션 실행: $MIGRATION_FILE"

# SQL 파일을 줄 단위로 읽어 각 statement 실행
while IFS= read -r line || [ -n "$line" ]; do
    # 주석, 빈줄 스킵
    [[ "$line" =~ ^-- ]] && continue
    [[ -z "${line// }" ]] && continue
    SQL_BUFFER="${SQL_BUFFER} ${line}"
    # 세미콜론으로 statement 끝 감지
    if [[ "$line" == *";" ]]; then
        curl -s -X POST \
            "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}/query" \
            -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
            -H "Content-Type: application/json" \
            -d "{\"sql\": \"$(echo $SQL_BUFFER | sed 's/"/\\"/g')\"}" | python3 -c "
import sys, json
r = json.load(sys.stdin)
if r.get('success'):
    print('  ✅ OK')
else:
    print('  ❌', r.get('errors'))
"
        SQL_BUFFER=""
    fi
done < "$MIGRATION_FILE"

echo "마이그레이션 완료"
