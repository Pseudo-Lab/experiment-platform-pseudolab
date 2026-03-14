Status: archive
Last-Validated: 2026-03-14

# 2026-03-11 분석 스냅샷 (READ ONLY)

작성일: 2026-03-11 (KST)  
작성자: Data Analyst Subagent

---

## 1) 목적

P0-2 데이터 값 확정(재스냅샷+샘플대조)을 위해 핵심 6개 테이블의 **분석 스냅샷**을 READ ONLY로 재수집했다.

---

## 2) 대상 테이블 (핵심 6개)

- `discord_messages`
- `dl_push_events`
- `dl_pull_request_events`
- `dl_issues_events`
- `dl_pull_request_review_events`
- `dl_issue_comment_events`

---

## 3) 조회 원칙

- 읽기 전용(`SELECT`) 쿼리만 사용
- 쓰기/수정/삭제 없음
- 민감정보(토큰/계정 식별값/개인 메시지 본문) 미기록

---

## 4) 분석 스냅샷 결과

| table_name | row_count | min_ts | max_ts |
|---|---:|---|---|
| discord_messages | 7,279 | 2022-02-23T06:18:34Z | 2026-03-10T21:17:49Z |
| dl_push_events | 4,305 | 2025-01-02 | 2026-03-10 |
| dl_pull_request_events | 1,522 | 2025-01-02 | 2026-03-10 |
| dl_issues_events | 621 | 2025-02-21 | 2026-03-11 |
| dl_pull_request_review_events | 468 | 2025-02-19 | 2026-02-06 |
| dl_issue_comment_events | 437 | 2025-01-15 | 2026-02-06 |

추가 확인(샘플 대조용 KPI 원시값):

| metric | value |
|---|---:|
| pr_opened | 648 |
| pr_merged | 406 |

---

## 5) 사용 쿼리(요약)

```sql
-- 6개 테이블 row_count/min/max
SELECT 'discord_messages' table_name, COUNT(*) row_count, MIN(created_at) min_ts, MAX(created_at) max_ts FROM discord_messages;
SELECT 'dl_push_events' table_name, COUNT(*) row_count, MIN(base_date) min_ts, MAX(base_date) max_ts FROM dl_push_events;
SELECT 'dl_pull_request_events' table_name, COUNT(*) row_count, MIN(base_date) min_ts, MAX(base_date) max_ts FROM dl_pull_request_events;
SELECT 'dl_issues_events' table_name, COUNT(*) row_count, MIN(base_date) min_ts, MAX(base_date) max_ts FROM dl_issues_events;
SELECT 'dl_pull_request_review_events' table_name, COUNT(*) row_count, MIN(base_date) min_ts, MAX(base_date) max_ts FROM dl_pull_request_review_events;
SELECT 'dl_issue_comment_events' table_name, COUNT(*) row_count, MIN(base_date) min_ts, MAX(base_date) max_ts FROM dl_issue_comment_events;

-- 샘플 대조용 KPI 원시값
SELECT
  SUM(CASE WHEN pr_action='opened' THEN 1 ELSE 0 END) AS pr_opened,
  SUM(CASE WHEN is_merged=1 THEN 1 ELSE 0 END) AS pr_merged
FROM dl_pull_request_events;
```

---

## 6) 판정

- 핵심 6개 테이블에 대한 분석 스냅샷 수집 완료
- 값 변화는 실시간 적재에 따른 자연 증가로 해석 가능
- P0-2 클로징용 근거 데이터로 사용 가능
