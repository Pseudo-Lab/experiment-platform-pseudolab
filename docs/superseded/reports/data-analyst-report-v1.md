Status: superseded
Last-Validated: 2026-03-14
Replaced-By: docs/reports/data-analyst-report-v2.md

# 가짜연구소 활동률/협업지표 데이터 분석 리포트 v1

작성일: 2026-03-10 (KST)  
작성자: 데이터 분석 서브에이전트

---

## 1) 목적
Cloudflare **D1/R2** 데이터를 기반으로, 대시보드 MVP에서 즉시 사용 가능한
- 활동률(Activity)
- 협업지표(Collaboration)
를 정의하고, 개발팀이 바로 구현 가능한 데이터 계약(JSON Schema)을 제시한다.

> 보안 원칙: 민감정보는 값 대신 환경변수명만 표기 (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `D1_MAIN_DATABASE_ID`, `R2_BUCKET_NAME` 등)

---

## 2) 데이터 소스 및 관측 범위

### D1 (main)
주요 테이블:
- `discord_messages`
- `dl_push_events`
- `dl_pull_request_events`
- `dl_issues_events`
- `dl_pull_request_review_events`
- `dl_issue_comment_events`

### R2
버킷(목록 기준):
- `github-archive-raw`
- `pseudolab-exp`

> 현재 R2는 버킷 목록 레벨까지 확인됨(객체 목록/용량/라이프사이클 미확인).

---

## 3) 지표 정의식 (Dashboard KPI)

아래 지표는 월(`YYYY-MM`) 기준 집계를 기본 단위로 한다.

### M1. Core Dev Activity (핵심 개발 활동량)
- **정의식**:  
  `core_dev_activity = push_events + pr_events + issue_events`
- **의미**: 코드/PR/이슈 기반 실질 개발 활동 총량
- **소스**: `dl_push_events`, `dl_pull_request_events`, `dl_issues_events`

### M2. PR Merge Rate (PR 병합 전환율)
- **정의식**:  
  `pr_merge_rate = pr_merged / pr_opened`
- **의미**: PR 생성 대비 병합 효율
- **소스**: `dl_pull_request_events` (`pr_action`, `is_merged`)

### M3. Review Depth Proxy (리뷰 밀도 근사치)
- **정의식**:  
  `review_depth_proxy = pr_review_events / pr_opened`
- **의미**: PR 당 리뷰 이벤트 밀도
- **소스**: `dl_pull_request_review_events`, `dl_pull_request_events`

### M4. Talk-to-Code Ratio (대화/개발 비율)
- **정의식**:  
  `talk_to_code_ratio = discord_messages / (push_events + pr_events + issue_events)`
- **의미**: 커뮤니케이션 대비 코드 활동 강도
- **소스**: `discord_messages` + GitHub core 이벤트

### M5. Collaboration Throughput (협업 처리량)
- **정의식**:  
  `collab_throughput = pr_opened + pr_review_events + issue_comment_events`
- **의미**: PR/리뷰/코멘트 상호작용 총량
- **소스**: `dl_pull_request_events`, `dl_pull_request_review_events`, `dl_issue_comment_events`

### M6. Activity Concentration (활동 집중도)
- **정의식(권장)**:  
  `activity_concentration_topN = topN_repo_events / total_repo_events`
- **의미**: 상위 저장소로 활동이 편중되는 정도
- **소스**: 각 `dl_*`의 `repo_name`

### M7. Data Coverage Score (관측 커버리지)
- **정의식**:  
  `coverage_score = observed_domains / target_domains`
- **권장 target_domains**: `{code, pr, issue, review, discussion, release, storage}` = 7
- **현재 관측**: release는 희소, storage 객체 레벨 미확인 → 부분 커버리지

---

## 4) 데이터 근거 테이블

## 4-1. 테이블별 볼륨/기간 스냅샷

| table_name | row_count | min_ts | max_ts |
|---|---:|---|---|
| discord_messages | 7,273 | 2022-02-23T06:18:34Z | 2026-03-09T14:15:13Z |
| dl_push_events | 4,305 | 2025-01-02 | 2026-03-10 |
| dl_pull_request_events | 1,521 | 2025-01-02 | 2026-03-07 |
| dl_issues_events | 618 | 2025-02-21 | 2026-02-01 |
| dl_pull_request_review_events | 468 | 2025-02-19 | 2026-02-06 |
| dl_issue_comment_events | 437 | 2025-01-15 | 2026-02-06 |

## 4-2. KPI 원시 계산값 (전체 누적 기준)

| metric | value |
|---|---:|
| pr_opened | 648 |
| pr_merged | 406 |
| pr_merge_rate | 0.6265 |
| pr_review_events | 468 |
| review_depth_proxy | 0.7222 |
| gh_core_events (push+pr+issue) | 6,444 |
| discord_messages | 7,273 |
| talk_to_code_ratio | 1.1286 |

## 4-3. 최근 월별 코어 활동 (샘플: 2025-04 ~ 2026-03)

| ym | push | pr | issue | gh_core | discord |
|---|---:|---:|---:|---:|---:|
| 2025-04 | 512 | 166 | 62 | 740 | 171 |
| 2025-05 | 805 | 250 | 82 | 1,137 | 138 |
| 2025-06 | 157 | 69 | 60 | 286 | 68 |
| 2025-07 | 248 | 78 | 46 | 372 | 63 |
| 2025-08 | 165 | 52 | 48 | 265 | 51 |
| 2025-09 | 321 | 78 | 68 | 467 | 104 |
| 2025-10 | 248 | 74 | 85 | 407 | 120 |
| 2025-11 | 216 | 77 | 72 | 365 | 64 |
| 2025-12 | 197 | 150 | 39 | 386 | 39 |
| 2026-01 | 181 | 178 | 20 | 379 | 31 |
| 2026-02 | 152 | 114 | 3 | 269 | 45 |
| 2026-03* | 13 | 6 | 0 | 19 | 12 |

> `2026-03`은 월 진행 중(partial month) 데이터임.

---

## 5) 시각화 추천 (차트 타입/축)

| 목적 | 차트 타입 | X축 | Y축 | 시리즈 |
|---|---|---|---|---|
| 월별 개발 활동 추이 | Stacked Column | `ym` | 이벤트 수 | push, pr, issue |
| 커뮤니케이션 vs 개발 | Dual-axis Line | `ym` | 좌:gh_core / 우:discord | gh_core, discord |
| 협업 효율 | Line | `ym` | 비율(0~1) | pr_merge_rate, review_depth_proxy |
| 저장소 편중도 | Pareto (Bar+Line) | repo_name(rank) | 이벤트 수/누적비율 | total_events, cumulative_ratio |
| 협업 처리량 | Area | `ym` | 이벤트 수 | pr_opened+review+issue_comment |
| 데이터 커버리지 | Radar 또는 Bullet | domain | score | observed 여부 |

---

## 6) 한계/편향

1. **이벤트 편향**: push/PR 중심 데이터가 커서, release/배포 단계 해석이 과소평가될 수 있음.
2. **기간 비대칭**: Discord는 2022년부터, GitHub DL은 2025년 중심으로 시작되어 장기 비교 시 기준선 불일치 존재.
3. **월말 확정 전 변동성**: 진행 중 월 데이터(예: 2026-03)는 낮게 보이는 자연 편향이 있음.
4. **R2 객체 레벨 공백**: 버킷 목록만 확인 가능하여 적재 신선도/용량 기반 지표 정밀도 제한.
5. **행동의 질적 해석 한계**: 이벤트 개수 기반 지표는 코드 복잡도/영향도를 직접 반영하지 않음.

---

## 7) 개발 전달용 데이터 계약 (JSON Schema)

아래 스키마는 대시보드 API 응답의 최소 계약으로 권장한다.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://pseudolab.dev/schemas/dashboard-metrics-v1.json",
  "title": "DashboardMetricsV1",
  "type": "object",
  "required": ["generated_at", "window", "summary", "monthly"],
  "properties": {
    "generated_at": {
      "type": "string",
      "format": "date-time"
    },
    "window": {
      "type": "object",
      "required": ["from", "to", "timezone"],
      "properties": {
        "from": { "type": "string", "format": "date" },
        "to": { "type": "string", "format": "date" },
        "timezone": { "type": "string", "default": "Asia/Seoul" }
      }
    },
    "summary": {
      "type": "object",
      "required": [
        "pr_opened",
        "pr_merged",
        "pr_merge_rate",
        "pr_review_events",
        "review_depth_proxy",
        "gh_core_events",
        "discord_messages",
        "talk_to_code_ratio"
      ],
      "properties": {
        "pr_opened": { "type": "integer", "minimum": 0 },
        "pr_merged": { "type": "integer", "minimum": 0 },
        "pr_merge_rate": { "type": "number", "minimum": 0 },
        "pr_review_events": { "type": "integer", "minimum": 0 },
        "review_depth_proxy": { "type": "number", "minimum": 0 },
        "gh_core_events": { "type": "integer", "minimum": 0 },
        "discord_messages": { "type": "integer", "minimum": 0 },
        "talk_to_code_ratio": { "type": "number", "minimum": 0 },
        "coverage_score": { "type": "number", "minimum": 0, "maximum": 1 }
      }
    },
    "monthly": {
      "type": "array",
      "items": {
        "type": "object",
        "required": [
          "ym",
          "push_events",
          "pr_events",
          "issue_events",
          "gh_core_events",
          "discord_messages",
          "pr_opened",
          "pr_merged",
          "pr_merge_rate",
          "pr_review_events",
          "review_depth_proxy",
          "talk_to_code_ratio"
        ],
        "properties": {
          "ym": { "type": "string", "pattern": "^[0-9]{4}-[0-9]{2}$" },
          "push_events": { "type": "integer", "minimum": 0 },
          "pr_events": { "type": "integer", "minimum": 0 },
          "issue_events": { "type": "integer", "minimum": 0 },
          "gh_core_events": { "type": "integer", "minimum": 0 },
          "discord_messages": { "type": "integer", "minimum": 0 },
          "pr_opened": { "type": "integer", "minimum": 0 },
          "pr_merged": { "type": "integer", "minimum": 0 },
          "pr_merge_rate": { "type": "number", "minimum": 0 },
          "pr_review_events": { "type": "integer", "minimum": 0 },
          "review_depth_proxy": { "type": "number", "minimum": 0 },
          "issue_comment_events": { "type": "integer", "minimum": 0 },
          "collab_throughput": { "type": "integer", "minimum": 0 },
          "talk_to_code_ratio": { "type": "number", "minimum": 0 },
          "is_partial_month": { "type": "boolean", "default": false }
        }
      }
    },
    "r2": {
      "type": "object",
      "properties": {
        "bucket_count": { "type": "integer", "minimum": 0 },
        "buckets": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["name", "creation_date"],
            "properties": {
              "name": { "type": "string" },
              "creation_date": { "type": "string", "format": "date-time" }
            }
          }
        },
        "object_level_observability": { "type": "boolean", "default": false }
      }
    }
  }
}
```

---

## 8) 구현 우선순위 제안 (MVP)

1. **1차 배포**: M1~M4 + 월별 시계열 API
2. **2차 배포**: M5(협업 처리량) + 저장소 집중도
3. **3차 배포**: R2 객체 레벨 수집 연동 후 freshness/cost 계열 지표 추가

---

## 9) 결론
현재 D1 데이터만으로도 활동률/협업지표 MVP는 충분히 구현 가능하다.  
핵심은 `PR 전환율`, `리뷰 밀도`, `대화-개발 비율` 3축을 월별로 일관되게 제공하는 것이다.  
R2는 현재 버킷 메타 수준이므로, 객체 레벨 관측을 열면 데이터 파이프라인 품질 지표까지 확장 가능하다.
