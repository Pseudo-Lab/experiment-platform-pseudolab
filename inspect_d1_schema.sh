#!/usr/bin/env bash
set -euo pipefail

EXP_DB_NAME="${EXP_DB_NAME:-pseudolab-exp}"

source ~/.bashrc

: "${CLOUDFLARE_ACCOUNT_ID:?missing CLOUDFLARE_ACCOUNT_ID}"
: "${CLOUDFLARE_API_TOKEN:?missing CLOUDFLARE_API_TOKEN}"

AUTH="Authorization: Bearer ${CLOUDFLARE_API_TOKEN}"
BASE="https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database"

EXP_DB_ID="$(
  curl -s "$BASE" -H "$AUTH" \
  | jq -r --arg n "$EXP_DB_NAME" '.result[] | select(.name==$n) | .uuid' \
  | head -n1
)"

if [[ -z "${EXP_DB_ID}" ]]; then
  echo "[ERROR] DB not found: ${EXP_DB_NAME}"
  curl -s "$BASE" -H "$AUTH" | jq -r '.result[] | "\(.name)\t\(.uuid)"'
  exit 1
fi

query () {
  local title="$1" sql="$2"
  echo; echo "==== ${title} ===="
  curl -s "${BASE}/${EXP_DB_ID}/query" \
    -H "$AUTH" -H "Content-Type: application/json" \
    --data "$(jq -nc --arg sql "$sql" '{sql:$sql}')" | jq .
}

query "TABLES_VIEWS" \
'SELECT name,type FROM sqlite_master WHERE type IN ("table","view") AND name NOT LIKE "sqlite_%" ORDER BY type,name;'

query "COLUMNS" \
'SELECT m.name table_name,p.cid,p.name column_name,p.type,p."notnull" not_null,p.dflt_value,p.pk
 FROM sqlite_master m, pragma_table_info(m.name) p
 WHERE m.type="table" AND m.name NOT LIKE "sqlite_%"
 ORDER BY m.name,p.cid;'

query "INDEXES_TRIGGERS" \
'SELECT type,name,tbl_name,sql FROM sqlite_master WHERE type IN ("index","trigger") ORDER BY tbl_name,type,name;'

query "FOREIGN_KEYS" \
'WITH t AS (SELECT name FROM sqlite_master WHERE type="table" AND name NOT LIKE "sqlite_%")
 SELECT t.name table_name,fk.id,fk.seq,fk."table" ref_table,fk."from" from_col,fk."to" to_col,fk.on_update,fk.on_delete,fk.match
 FROM t, pragma_foreign_key_list(t.name) fk
 ORDER BY t.name,fk.id,fk.seq;'

echo "[DONE] ${EXP_DB_NAME} (${EXP_DB_ID})"
