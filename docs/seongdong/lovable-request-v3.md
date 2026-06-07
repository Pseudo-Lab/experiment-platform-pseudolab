# Lovable 요청서 — 회고 기능 배너 연결 (v3)

> **기준**: v2 요청 10(회고 가이드 페이지)이 완료된 상태를 전제로 작성  
> **API Base**: `${VITE_API_URL}/api/v1`  
> **이번 v3의 핵심**: 대시보드에 회고 배너를 추가하고, 배너 → 회고 가이드 페이지를 연결한다

---

## 배경

v2 요청 10에서 `/reflection/:experimentId` 페이지를 구현했다.  
당시 마지막 항목에 "사이드바 진입 링크 추가 불필요 — 직접 URL 접근 또는 대시보드 배너 연결 예정"이라고 남겨뒀다.  
v3는 그 **대시보드 배너 연결** 부분을 구현한다.

---

## 요청 1 — 대시보드 배너 카드 추가

### 복붙 프롬프트

```
대시보드 홈에 회고 안내 배너 카드를 추가해줘.

--- 첨부 이미지 설명 ---
첨부한 image.png를 배너 카드의 왼쪽 또는 상단 이미지 영역에 사용해줘.
(비율 유지, 카드 높이에 맞게 적절히 조절)

--- 배너 카드 UI ---
1. 위치: 대시보드 메인 콘텐츠 상단 또는 stat 카드 아래 별도 "배너 영역"
2. 스타일:
   - 배경: #0d2035, 테두리: rgba(99,179,237,0.3) 1px, border-radius: 12px
   - padding: 16px 20px
   - 왼쪽에 image.png 이미지 (width 48px, height 48px, border-radius 8px)
   - 이미지 오른쪽에 텍스트 두 줄:
     - 상단 (굵게, 흰색): "중간 회고 작성하기"
     - 하단 (작게, 회색): "지금까지의 여정을 정리하고 남은 기간 방향을 잡아봐요"
   - 카드 오른쪽 끝에 "→" 화살표 아이콘
3. 호버 시: border-color rgba(74,158,255,0.6)으로 변경, cursor: pointer

--- 노출 조건 ---
아래 두 조건을 모두 만족할 때만 배너를 렌더링한다.

조건 ①: 현재 날짜가 회고 노출 기간 안에 있을 것
  - 실험 정보의 reflection_start_date 와 reflection_window_days 를 사용
  - reflection_start_date 가 null 이면 배너 숨김
  - 현재 날짜 < reflection_start_date → 배너 숨김
  - 현재 날짜 > reflection_start_date + reflection_window_days일 → 배너 숨김

조건 ②: 사용자가 아직 회고를 제출하지 않았을 것
  - GET ${VITE_API_URL}/api/v1/reflections/check?user_id=&experiment_id=
  - 응답: { submitted: boolean, completed_at: string | null }
  - submitted: true 이면 배너 숨김

두 조건을 모두 통과했을 때만 배너가 나타난다.

--- 데이터 소스 ---
- 실험 ID: 현재 사용자가 속한 실험의 experimentId (기존 대시보드 데이터에서 추출)
  - 실험 ID를 특정할 수 없는 경우엔 VITE_EXPERIMENT_ID 환경변수를 fallback으로 사용
- 노출 조건 체크에 필요한 GET 요청 2개는 TanStack Query로 캐싱 (staleTime: 5분)

--- 클릭 동작 ---
배너 카드 클릭 시: navigate(`/reflection/${experimentId}`)
```

---

## 요청 2 — 회고 가이드 페이지 UI 정밀 구현 (standalone 레퍼런스 기반)

### 배경

v2 요청 10에서 `/reflection/:experimentId` 페이지 구조는 구현했다.  
v3에서는 **첨부한 `___standalone_.html` 파일**의 UI를 정밀하게 맞춰달라는 추가 요청이다.

### 복붙 프롬프트

```
첨부한 HTML 파일(___standalone_.html)을 디자인 레퍼런스로 사용해서
/reflection/:experimentId 페이지 UI를 아래 스펙에 맞게 구현(또는 수정)해줘.

--- 전체 색상 토큰 ---
--bg: #0f1923
--surface: #16232f
--surface-2: #1c2e3e
--surface-3: #0d1e2b
--border: rgba(255,255,255,0.06)
--border-strong: rgba(255,255,255,0.12)
--text-primary: #f0f4f8
--text-secondary: #a0aab4
--text-hint: #4a5568
--accent: #4a9eff
--accent-bg: rgba(74,158,255,0.10)
--accent-text: #93c5fd
--green: #4ade80
--green-bg: rgba(74,222,128,0.10)
--green-text: #86efac

--- 상단 네비게이션 ---
- 왼쪽: 초록 점(온라인 표시) + "← 돌아가기" 버튼 + 빵부스러기 ("차세대 지능형 실험 플랫폼 › 중간 회고")
- 오른쪽: 공유 버튼 (⤴)
- 하단에 progress bar (--accent 색, 진행도에 따라 width 변화)

--- 스텝 인디케이터 ---
- 섹션 A~E 총 5단계를 점(dot)으로 표시
- 현재 섹션: dot 가로로 늘어남 (width: 20px, border-radius: 4px)
- 완료된 섹션: --accent 색
- 미완료: rgba(255,255,255,0.12)

--- 섹션 A: 프로젝트 성격 ---
- section-label (대문자 소형, --accent 색): "섹션 A"
- section-title: "지금 우리 프로젝트는\n어떤 성격인가요?"
- chip-group: 연구형 / 구현형 / 발표형 / 문서형 / 오픈소스형 (단일 선택)
  - chip 선택 시 --accent 테두리 + --accent-bg 배경
  - 선택 후 해당 유형의 핵심 산출물 안내 카드(hint-card) 표시
  - 힌트 카드 내용:
    - 연구형: "논문 초안, 실험 결과 문서, 데이터셋 정리, 분석 보고서가 중심이에요."
    - 구현형: "GitHub 저장소가 가장 중요해요. README 정비, 실행 가능한 코드, 데모 영상도 챙겨두세요."
    - 발표형: "발표 슬라이드와 발표 영상(또는 회고 문서)이 핵심이에요."
    - 문서형: "블로그 게시물, 노션/Docs 정리, 가이드 문서가 중심이에요."
    - 오픈소스형: "LICENSE, README, CONTRIBUTING 파일까지 포함해야 완성도 있는 오픈소스예요."
- 선택 시 project_type(백엔드 값): research / implementation / presentation / document / opensource

--- 섹션 B: 진행 상태 ---
- section-title: "지금까지의 진행 상태"
- stat-grid (4열): 출석률, 발표 횟수, GitHub 업로드, 게시물/문서
  - Supabase 프로필 데이터에서 읽어옴
  - 값이 없으면 "-" 표시
  - 각 카드 하단에 stat-bar (초록 색 progress bar)
- 뱃지: "공개 가능한 결과물 있음" (badge-green) / "내부 공유 자료 포함" (badge-amber) 조건부 표시

--- 섹션 C: 남은 기간 핵심 경로 ---
- section-title: "남은 기간, 이렇게 가면\n완주에 가까워져요"
- action-list: project_type에 따라 추천 산출물 2~3개 (action-item 컴포넌트)
  - 번호 뱃지(원형, --accent-bg) + 제목 + 설명 + 우선순위 뱃지
- warm-box (초록 배경): "지금까지 잘 걸어오고 있어요. 이제 남은 경로를 함께 정리해볼까요? 🌱"

--- 섹션 D: 자유 텍스트 입력 ---
- form-block: 3개의 textarea + 1개의 체크박스 그리드
  1. "지금 가장 잘 되고 있는 점" (placeholder 포함)
  2. "현재 막히는 점"
  3. "남은 기간 가장 중요한 목표 1가지" (min-height 64px)
  4. "우리 팀의 최종 산출물 형태" — output-grid (3열, 체크박스 다중 선택)
     - GitHub 저장소 / 블로그·게시물 / 발표 슬라이드 / 문서·보고서 / 공개용 자료 / 내부 공유 자료
     - 선택 시 --accent 테두리 + --accent-bg 배경

--- 섹션 E: 제출 ---
- 제출 전 확인 체크리스트 (check-row):
  - 프로젝트 성격 선택 여부
  - 회고 내용 입력 여부 (최소 1개)
  - 최종 산출물 형태 선택 여부
  - 완료된 항목: ✓ (초록), 미완료: ○ (회색)
- "회고 제출하기 →" 버튼 (초록 그라디언트)
- 하단 안내 문구: "프로젝트마다 완주의 모양은 조금씩 다릅니다. 우리 팀만의 완주를 응원해요."

--- 반응형 ---
- 600px 이하: stat-grid 2열, output-grid 2열

--- 제출 API ---
POST ${VITE_API_URL}/api/v1/reflections
body:
{
  experiment_id: string,
  user_id: string,
  project_id: string,
  project_type: "research"|"implementation"|"presentation"|"document"|"opensource",
  output_types: string[],
  response_good: string,
  response_blocked: string,
  response_goal: string,
  final_output_type: string
}
성공 시 → "회고가 완료되었어요 🎉" 완료 화면 전환
```

---

## 요청 3 — 환경변수 추가

### 복붙 프롬프트

```
.env 에 아래 환경변수를 추가해줘.

VITE_EXPERIMENT_ID=   # 대시보드 배너에서 사용할 기본 실험 ID (실험 ID를 동적으로 특정할 수 없는 경우 fallback)
```

---

## 요청 순서

```
요청 3 (환경변수)
  → 요청 1 (배너 카드) — VITE_EXPERIMENT_ID 필요
  → 요청 2 (회고 가이드 UI 정밀화) — 요청 1 배너의 진입점이 되는 페이지
```

---

## 체크리스트

### 배너
- [ ] 대시보드에 배너 카드 추가 (image.png 사용)
- [ ] 노출 조건 ① — reflection_start_date + reflection_window_days 기간 체크
- [ ] 노출 조건 ② — /reflections/check API, submitted: true 이면 숨김
- [ ] 배너 클릭 → navigate(`/reflection/${experimentId}`)
- [ ] TanStack Query 캐싱 (staleTime 5분)

### 회고 가이드 UI
- [ ] 색상 토큰 적용 (standalone.html 기준)
- [ ] 상단 nav + progress bar + 스텝 인디케이터
- [ ] 섹션 A: chip-group 단일 선택 + hint-card 조건부 표시
- [ ] 섹션 B: stat-grid 4열, Supabase 프로필 데이터 연결
- [ ] 섹션 C: project_type별 action-list 정적 콘텐츠
- [ ] 섹션 D: textarea 3개 + output-grid 체크박스 다중 선택
- [ ] 섹션 E: 체크리스트 + 제출 버튼 + 완료 화면
- [ ] 반응형 (600px 이하 그리드 2열)
- [ ] POST /api/v1/reflections 연결

### 환경변수
- [ ] VITE_EXPERIMENT_ID .env 추가
```

---

## v2 대비 추가·변경 사항

| 항목 | v2 | v3 |
|------|----|----|
| 배너 진입 | 언급만 ("배너 연결 예정") | 구체적 UI + 노출 조건 구현 |
| 배너 이미지 | 없음 | image.png 첨부 사용 |
| 회고 UI 디자인 레퍼런스 | 없음 | `___standalone_.html` 첨부 |
| 환경변수 | 없음 | VITE_EXPERIMENT_ID 추가 |
