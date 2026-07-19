#!/usr/bin/env python3
"""부스 데모용 실험 데이터 시드 스크립트.

지정한 실험에 가짜 사용자들의 노출(exp_exposure)·전환 이벤트를 넣어
실험 상세 화면의 Bayesian 판정(SHIP 배너, P(T>C), Δ%p + CI)과
z-검정 패널(배정 추이, 전환율)이 채워진 상태를 만든다.

의존성 없음(표준 라이브러리만 사용).

사용 예:
    # 로컬 백엔드에 300명 시드
    python3 seed_demo_data.py --experiment-id <UUID>

    # 배포 환경에 시드
    python3 seed_demo_data.py \
        --base-url https://exp.pseudolab-devfactory.com/api/v1 \
        --experiment-id <UUID>

동작:
  1. GET /experiments/{id} 로 flag_key·primary_metric·variant 목록을 읽는다.
  2. 사용자를 절반씩 control / treatment variant에 배정한다.
  3. event_log 로 가는 배치 수집(POST /ingest/events):
     - exp_exposure 이벤트 (properties: {experiment_id, variant})
     - primary_metric 전환 이벤트 (variant별 전환율 적용)
     event_id 가 결정론적(UUID5)이라 재실행해도 중복 적재되지 않는다.
  4. experiment_event 로 가는 수집(POST /events):
     - impression / conversion (z-검정·차트 패널용)
     이 테이블은 멱등 키가 없어 재실행 시 중복된다. 재시드가 필요하면
     --skip-experiment-events 로 3번만 다시 넣을 것.

이벤트에는 properties.seed = true 마커가 들어가므로 나중에 구분/정리 가능.
"""

import argparse
import hashlib
import json
import sys
import urllib.error
import urllib.request
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

SEED_NAMESPACE = uuid.UUID("6ba7b810-9dad-11d1-80b4-00c04fd430c8")


def http_json(method: str, url: str, body: dict | None = None) -> dict:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        url, data=data, method=method,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=60) as res:
        return json.loads(res.read().decode())


def converts(uid: str, salt: str, rate: float) -> bool:
    """사용자별 결정론적 전환 여부 (재실행해도 동일한 결과)."""
    h = int(hashlib.sha256(f"{salt}:{uid}".encode()).hexdigest(), 16) % 10_000
    return h / 10_000 < rate


def main() -> int:
    p = argparse.ArgumentParser(description="부스 데모용 실험 데이터 시드")
    p.add_argument("--base-url", default="http://localhost:8000/api/v1")
    p.add_argument("--experiment-id", required=True)
    p.add_argument("--users", type=int, default=300, help="총 사용자 수 (기본 300)")
    p.add_argument("--control-rate", type=float, default=0.18, help="control 전환율")
    p.add_argument("--treatment-rate", type=float, default=0.34, help="treatment 전환율")
    p.add_argument("--days", type=int, default=7, help="이벤트를 분산할 최근 일수")
    p.add_argument("--treatment-variant", default=None,
                   help="treatment variant 이름 (기본: 실험의 첫 non-control variant)")
    p.add_argument("--skip-experiment-events", action="store_true",
                   help="experiment_event(임프레션/전환) 적재 생략 — 재시드 시 중복 방지용")
    args = p.parse_args()

    base = args.base_url.rstrip("/")
    exp_id = args.experiment_id

    # 1. 실험 메타 조회
    try:
        exp = http_json("GET", f"{base}/experiments/{exp_id}")
    except urllib.error.HTTPError as e:
        print(f"실험 조회 실패: HTTP {e.code} — experiment-id를 확인하세요.")
        return 1

    flag_key = exp.get("flag_key")
    primary_metric = exp.get("primary_metric")
    variant_names = [v["name"] for v in exp.get("variants", [])]
    non_control = [v for v in variant_names if v != "control"]

    if not primary_metric:
        print("이 실험에 primary_metric이 없습니다. 대시보드에서 설정 후 다시 실행하세요.")
        return 1

    treatment = args.treatment_variant or (non_control[0] if non_control else "treatment")
    print(f"실험: {exp.get('name')} ({exp_id})")
    print(f"  flag_key={flag_key}  primary_metric={primary_metric}")
    print(f"  variants: control vs {treatment}")
    print(f"  사용자 {args.users}명, 전환율 control {args.control_rate:.0%} / {treatment} {args.treatment_rate:.0%}")

    # 2. 사용자 생성 및 배정 (절반씩, 결정론적 uid)
    now = datetime.now(timezone.utc)
    users = []
    for i in range(args.users):
        uid = f"seed-{exp_id[:8]}-{i:04d}"
        variant = "control" if i % 2 == 0 else treatment
        rate = args.control_rate if variant == "control" else args.treatment_rate
        # 최근 N일에 고르게 분산
        ts = now - timedelta(days=(i % args.days), hours=(i * 7) % 24, minutes=(i * 13) % 60)
        users.append({
            "uid": uid,
            "variant": variant,
            "converted": converts(uid, primary_metric, rate),
            "ts": ts,
        })

    # 3. event_log 배치 적재 (exp_exposure + 전환) — event_id 기반 멱등
    log_events = []
    for u in users:
        props = {"experiment_id": exp_id, "variant": u["variant"], "seed": True}
        log_events.append({
            "user_id": u["uid"],
            "event_name": "exp_exposure",
            "event_id": str(uuid.uuid5(SEED_NAMESPACE, f"{exp_id}:{u['uid']}:exp_exposure")),
            "session_id": str(uuid.uuid5(SEED_NAMESPACE, f"{exp_id}:{u['uid']}:session")),
            "experiment_id": exp_id,
            "variant": u["variant"],
            "device": "desktop",
            "properties": props,
            "timestamp": u["ts"].isoformat(),
        })
        if u["converted"]:
            log_events.append({
                "user_id": u["uid"],
                "event_name": primary_metric,
                "event_id": str(uuid.uuid5(SEED_NAMESPACE, f"{exp_id}:{u['uid']}:{primary_metric}")),
                "session_id": str(uuid.uuid5(SEED_NAMESPACE, f"{exp_id}:{u['uid']}:session")),
                "experiment_id": exp_id,
                "variant": u["variant"],
                "device": "desktop",
                "properties": props,
                "timestamp": (u["ts"] + timedelta(minutes=3)).isoformat(),
            })

    CHUNK = 10
    chunks = [log_events[i:i + CHUNK] for i in range(0, len(log_events), CHUNK)]
    print(f"\nevent_log 적재: {len(log_events)}건 ({len(chunks)} 배치)...")
    accepted = 0
    with ThreadPoolExecutor(max_workers=4) as ex:
        for res in ex.map(lambda c: http_json("POST", f"{base}/ingest/events", {"events": c}), chunks):
            accepted += res.get("accepted", 0)
    print(f"  적재 완료: {accepted}건 (0이면 이미 시드된 상태 — 멱등 스킵)")

    # 4. experiment_event 적재 (impression/conversion) — z-검정·차트 패널용
    if args.skip_experiment_events:
        print("experiment_event 적재 생략 (--skip-experiment-events)")
    elif not flag_key:
        print("flag_key가 없어 experiment_event 적재를 생략합니다.")
    else:
        exp_events = []
        for u in users:
            common = {
                "key": flag_key,
                "variant": u["variant"],
                "user_id": u["uid"],
                "experiment_id": exp_id,
                "url": "/example",
                "properties": {"seed": True},
            }
            exp_events.append({**common, "type": "impression", "timestamp": u["ts"].isoformat()})
            if u["converted"]:
                exp_events.append({
                    **common, "type": "conversion",
                    "timestamp": (u["ts"] + timedelta(minutes=3)).isoformat(),
                })
        print(f"experiment_event 적재: {len(exp_events)}건... (주의: 재실행 시 중복 적재)")
        with ThreadPoolExecutor(max_workers=8) as ex:
            list(ex.map(lambda e: http_json("POST", f"{base}/events", e), exp_events))
        print("  적재 완료")

    # 5. 결과 확인
    result = http_json("GET", f"{base}/experiments/{exp_id}/result")
    print("\n── 시드 후 실험 결과 ──")
    print(f"  judgment: {result.get('judgment')}")
    print(f"  P(T>C):   {result.get('probability_treatment_wins')}")
    print(f"  uplift:   {result.get('uplift')}  CI: {result.get('confidence_interval')}")
    print(f"  표본:     {result.get('sample_size')} (분모: {result.get('denominator_source')})")
    if result.get("message"):
        print(f"  message:  {result['message']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
