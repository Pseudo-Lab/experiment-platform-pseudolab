#!/usr/bin/env bash
# demo-app용 멱등 시드 스크립트
#
# 사용:
#   bash examples/demo-app/scripts/seed.sh
#   PLATFORM_API=http://localhost:8000/api/v1 bash examples/demo-app/scripts/seed.sh
#
# 동작:
#   1) Flag 2개 생성 (home_layout_v1, sponsor_slot_v1) — 409=이미 존재=정상
#   2) Rule 2개 생성 (deterministic id, 커스텀 variant: list/sidebar) — 409=이미 존재=정상
#   3) 실험 2개 생성 (home_layout_exp_v1, sponsor_slot_exp_v1) — 이름으로 중복 검사
#   4) 실험 상태 draft→running 전환
#
# 알려진 한계 (실험 결과가 비어있는 이유):
#   - 데모 앱은 /feature-flags/decide 만 호출 → feature_flag_exposure 적재
#   - 실험 결과 계산은 experiment_assignments 테이블 사용
#   - 두 테이블은 독립이므로, 데모 앱이 /experiments/{id}/assign 도 호출해야
#     실험 결과(P(t>c), uplift)에 숫자가 찍힘. 이는 본 스크립트의 범위 밖.

set -euo pipefail

API="${PLATFORM_API:-http://localhost:8000/api/v1}"
TMP="$(mktemp -t seed.XXXXXX)"
trap 'rm -f "$TMP"' EXIT

log()  { printf '[seed] %s\n' "$*"; }
ok()   { printf '[seed] \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '[seed] \033[33m⚠\033[0m %s\n' "$*"; }
fail() { printf '[seed] \033[31m✗\033[0m %s\n' "$*"; exit 1; }

# JSON 파싱 헬퍼 (jq 의존 회피)
json_field() {
  python3 -c "import json,sys; print(json.load(open('$TMP')).get('$1', ''))"
}

json_extract_id_by_name() {
  python3 -c "
import json, sys
try:
    arr = json.load(open('$TMP'))
    for item in arr:
        if item.get('name') == '$1':
            print(item['id']); break
except Exception:
    pass"
}

http() {
  # http METHOD PATH BODY → HTTP code (응답은 $TMP에 저장)
  local method="$1" path="$2" body="${3:-}"
  if [ -n "$body" ]; then
    curl -s -o "$TMP" -w "%{http_code}" -X "$method" "$API$path" \
      -H 'Content-Type: application/json' -d "$body"
  else
    curl -s -o "$TMP" -w "%{http_code}" -X "$method" "$API$path"
  fi
}

create_or_skip() {
  local what="$1" path="$2" body="$3"
  local code
  code=$(http POST "$path" "$body")
  case "$code" in
    201) ok "$what created" ;;
    409) ok "$what already exists" ;;
    *)   fail "$what failed: HTTP $code — $(cat "$TMP")" ;;
  esac
}

# ─── 1) Flags ────────────────────────────────────────────────────────────
log "Step 1/4: feature flags"

create_or_skip "flag home_layout_v1" "/feature-flags/" \
  '{"flag_key":"home_layout_v1","description":"홈 카드 레이아웃 (B-1)","rollout_pct":50,"enabled":true}'

create_or_skip "flag sponsor_slot_v1" "/feature-flags/" \
  '{"flag_key":"sponsor_slot_v1","description":"스폰서 슬롯 위치 (A-1)","rollout_pct":50,"enabled":true}'

# ─── 2) Rules (커스텀 variant 이름 매핑용) ────────────────────────────────
log "Step 2/4: feature flag rules"

create_or_skip "rule home_layout_v1_list" "/feature-flags/home_layout_v1/rules" \
  '{"id":"home_layout_v1_list_rule","priority":1,"rollout_pct":50,"variant":"list","enabled":true}'

create_or_skip "rule sponsor_slot_v1_sidebar" "/feature-flags/sponsor_slot_v1/rules" \
  '{"id":"sponsor_slot_v1_sidebar_rule","priority":1,"rollout_pct":50,"variant":"sidebar","enabled":true}'

# ─── 3) Experiments ──────────────────────────────────────────────────────
log "Step 3/4: experiments"

ensure_experiment() {
  local exp_name="$1" body="$2"
  local code id
  code=$(http GET "/experiments/")
  if [ "$code" != "200" ]; then
    fail "list experiments failed: HTTP $code — $(cat "$TMP")"
  fi
  id=$(json_extract_id_by_name "$exp_name")
  if [ -n "$id" ]; then
    ok "experiment $exp_name already exists ($id)"
    printf '%s' "$id"
    return
  fi
  code=$(http POST "/experiments/" "$body")
  if [ "$code" != "201" ]; then
    fail "experiment $exp_name create failed: HTTP $code — $(cat "$TMP")"
  fi
  id=$(json_field id)
  ok "experiment $exp_name created ($id)"
  printf '%s' "$id"
}

HOME_EXP_BODY='{"name":"home_layout_exp_v1","hypothesis":"리스트 레이아웃이 그리드보다 카드 클릭률이 높을 것","primary_metric":"study_card_clicked","variants":[{"name":"control","traffic_ratio":0.5,"description":"기본 그리드"},{"name":"list","traffic_ratio":0.5,"description":"리스트 레이아웃"}]}'
SPONSOR_EXP_BODY='{"name":"sponsor_slot_exp_v1","hypothesis":"사이드바 위치가 인라인보다 스폰서 클릭률이 높을 것","primary_metric":"sponsor_clicked","variants":[{"name":"control","traffic_ratio":0.5,"description":"기본 인라인"},{"name":"sidebar","traffic_ratio":0.5,"description":"사이드바 배치"}]}'

HOME_EXP_ID=$(ensure_experiment "home_layout_exp_v1" "$HOME_EXP_BODY")
SPONSOR_EXP_ID=$(ensure_experiment "sponsor_slot_exp_v1" "$SPONSOR_EXP_BODY")

# ─── 4) Transition to running ────────────────────────────────────────────
log "Step 4/4: experiment status → running"

ensure_running() {
  local exp_id="$1" exp_name="$2"
  local code status
  code=$(http GET "/experiments/$exp_id")
  if [ "$code" != "200" ]; then
    fail "get experiment $exp_name failed: HTTP $code"
  fi
  status=$(json_field status)
  case "$status" in
    running)
      ok "$exp_name already running" ;;
    draft)
      code=$(http PATCH "/experiments/$exp_id" '{"status":"running"}')
      if [ "$code" = "200" ]; then
        ok "$exp_name → running"
      else
        fail "$exp_name transition failed: HTTP $code — $(cat "$TMP")"
      fi ;;
    *)
      warn "$exp_name in status '$status' (수동 확인 필요)" ;;
  esac
}

ensure_running "$HOME_EXP_ID" "home_layout_exp_v1"
ensure_running "$SPONSOR_EXP_ID" "sponsor_slot_exp_v1"

log "Done."
