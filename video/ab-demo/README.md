# A/B 체험 홍보 영상 (Remotion)

> **📄 요약 ·** 팀 페이지 "A/B 테스트 체험하기"를 소개하는 시뮬레이션 영상 2종. 사이트 빌드와 분리된 독립 패키지이며, 상품 이미지는 `public/demo/everyday-mug.webp`를 그대로 사용한다.

| 컴포지션 | 형식 | 렌더 결과 | 내용 |
|---|---|---|---|
| `AbHold` | 1920×1080 · 20초 | `renders/ab-hold-20s.mp4` | "+3%p, 지금 바꿔도 될까?" → 95% 구간이 0을 지나 판단 보류 |
| `AbReels` | 1080×1920 · 15초 | `renders/ab-reels-15s.mp4` | "근데 안 바꾼 쪽도 올랐는데요?" 말풍선 오프닝 → 같은 기간 A/B 비교 → 판단 보류 |

- 수치: 이전 기간 6%는 참고값, A 8/100 · B 11/100은 같은 기간 시뮬레이션 값. 95% 구간(Wald) −5.1~+11.1%p는 `src/stats.js`가 계산하고 `npm test`가 0을 지나는지 확인한다.
- 실행 (Node 22+): `npm ci` → `npm run studio`(미리보기) / `npm run render` · `npm run render:reels`.
- 라이선스: Remotion은 비영리 단체 무료 라이선스 대상 ([LICENSE](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md)).
- 글꼴은 로컬 Pretendard → Apple SD Gothic Neo → Noto Sans KR 순서. 다른 환경에서 렌더하면 글꼴이 달라질 수 있다.
