import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, random, staticFile, useCurrentFrame } from 'remotion';
import { diffCI } from './stats.js';

export const C = { bg: '#f6f5f1', ink: '#1d2333', muted: '#6b7280', line: '#e3e1da', card: '#fffefb', A: '#5147c8', B: '#177464', soft: '#ecebf9' };
export const FONT = "Pretendard, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif";
const N = 100, CLICKS = { A: 8, B: 11 };
const CI = diffCI(CLICKS.A, N, CLICKS.B, N);
const s = 1 / 30; // seconds → frames helper below
export const sec = t => Math.round(t / s);
export const ease = Easing.bezier(0.2, 0.7, 0.2, 1);
export const ramp = (f, a, b, from = 0, to = 1) => interpolate(f, [a, b], [from, to], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease });
export const fade = (f, a, b, d = 8) => Math.min(ramp(f, a, a + d), 1 - ramp(f, b - d, b));
export const pp = v => `${v < 0 ? '−' : '+'}${Math.abs(v).toFixed(1).replace(/\.0$/, '')}%p`;

const SUBS = [
  [0, 2, 'B가 앞섰다. 바로 바꿀까?'],
  [2, 5, '버튼 하나만 바꿔 비교합니다.'],
  [5, 9, '배정 → 실제 노출 → 버튼 클릭'],
  [9, 12, '구매 버튼 클릭률 차이 +3%p'],
  [12, 17, 'B가 앞섰지만, 실제 효과의 방향은 아직 확실하지 않아요.'],
  [17, 20, 'Iterglow · 숫자를 비교하고, 바꿀 근거를 확인합니다.'],
];

// 100 A + 100 B in a seeded shuffle → exact 100/100 split, random order.
const VISITORS = Array.from({ length: 2 * N }, (_, i) => (i < N ? 'A' : 'B'))
  .map((arm, i) => ({ arm, k: random(`v${i}`) })).sort((x, y) => x.k - y.k).map(v => v.arm);
const SPAWN0 = sec(5.2), GAP = 0.45, TRAVEL = 18;
const arrivedBy = f => VISITORS.filter((_, i) => f >= SPAWN0 + i * GAP + TRAVEL);
const clicksAt = (n, arm) => Math.floor(n * CLICKS[arm] / N); // even spread, ends exactly at 8 / 11

function ApplyButton({ f, crossed }) {
  return <div style={{ display: 'inline-flex', alignItems: 'center', gap: 14, padding: '22px 56px', borderRadius: 16, background: crossed ? '#d9d8d3' : C.B, color: crossed ? C.muted : '#fff', fontSize: 40, fontWeight: 700, textDecoration: crossed ? 'line-through' : 'none' }}>B 적용</div>;
}

function Cursor({ x, y }) {
  return <svg width="48" height="48" viewBox="0 0 24 24" style={{ position: 'absolute', left: x, top: y }}><path d="M4 2l15 9-7 1.5L9 20z" fill={C.ink} stroke="#fff" strokeWidth="1.2"/></svg>;
}

function Card({ arm, f, exposures, clicks, showRate }) {
  const color = C[arm];
  const rate = exposures ? Math.round(clicks / exposures * 100) : null;
  const flash = clicks > 0 && f - lastClickFrame(arm, clicks) < 8;
  return <div style={{ width: 760, padding: '26px 30px', borderRadius: 22, background: C.card, border: `2px solid ${C.line}`, boxShadow: '0 10px 30px #00000010' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingBottom: 18, borderBottom: `2px solid ${C.line}`, fontSize: 32, fontWeight: 700 }}>
      <span style={{ display: 'grid', placeItems: 'center', width: 46, height: 46, borderRadius: 10, background: arm === 'A' ? C.soft : '#dcefe9', color }}>{arm}</span>
      {arm === 'A' ? '기본 버튼' : '강조 버튼'}
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 26, marginTop: 22 }}>
      <Img src={staticFile('everyday-mug.webp')} style={{ width: 150, height: 150, borderRadius: 14, background: '#e5dfd8' }}/>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 30, fontWeight: 650 }}>데일리 세라믹 머그</div>
        <div style={{ fontSize: 26, color: C.muted, marginTop: 4 }}>19,900원</div>
        <div style={{ position: 'relative', overflow: 'hidden', display: 'inline-block', marginTop: 14, padding: '12px 40px', borderRadius: 10, fontSize: 24, fontWeight: 700,
          border: `2px solid ${color}`, background: arm === 'B' ? color : 'transparent', color: arm === 'B' ? '#fff' : color }}>
          구매하기{flash && <span style={{ position: 'absolute', inset: 0, background: '#fff', opacity: 0.45 }}/>}
        </div>
      </div>
      <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', opacity: showRate }}>
        <div style={{ fontSize: 24, color: C.muted }}>노출 {exposures} · 클릭 {clicks}</div>
        <div style={{ fontSize: 96, fontWeight: 800, color, lineHeight: 1.1 }}>{rate === null ? '—' : `${rate}%`}</div>
        <div style={{ fontSize: 22, color: C.muted }}>구매 버튼 클릭률</div>
      </div>
    </div>
  </div>;
}

// Frame at which the given click count was reached for this arm (for the button flash).
function lastClickFrame(arm, clicks) {
  let seen = 0;
  for (let i = 0; i < VISITORS.length; i++) {
    if (VISITORS[i] !== arm) continue;
    seen += 1;
    if (clicksAt(seen, arm) === clicks) return SPAWN0 + i * GAP + TRAVEL;
  }
  return -Infinity;
}

function CardsScene({ f }) {
  const arrived = arrivedBy(f);
  const count = arm => arrived.filter(a => a === arm).length;
  const nA = count('A'), nB = count('B');
  const enter = arm => ramp(f, sec(2) + (arm === 'B' ? 6 : 0), sec(2) + 20 + (arm === 'B' ? 6 : 0));
  const resultIn = ramp(f, sec(9), sec(9.6));
  const y0 = 470;
  return <AbsoluteFill style={{ opacity: fade(f, sec(2), sec(12)) }}>
    <svg width="1920" height="1080" style={{ position: 'absolute' }}>
      <path d="M960 250 V300 C960 380 530 330 530 430" fill="none" stroke={C.A} strokeWidth="3" opacity={0.35 * fade(f, sec(5), sec(9))}/>
      <path d="M960 250 V300 C960 380 1390 330 1390 430" fill="none" stroke={C.B} strokeWidth="3" opacity={0.35 * fade(f, sec(5), sec(9))}/>
      {VISITORS.map((arm, i) => {
        const t = (f - SPAWN0 - i * GAP) / TRAVEL;
        if (t < 0 || t > 1) return null;
        const x = 960 + (arm === 'A' ? -430 : 430) * Easing.inOut(Easing.quad)(t);
        const y = 250 + 180 * t;
        return <circle key={i} cx={x} cy={y} r="9" fill={C[arm]} stroke="#fff" strokeWidth="2"/>;
      })}
    </svg>
    <div style={{ position: 'absolute', top: 170, width: '100%', textAlign: 'center', fontSize: 28, color: C.muted, opacity: fade(f, sec(5), sec(9.2)) }}>
      같은 기간 · 가상 방문자 {arrived.length}/{2 * N}명 무작위 배정
    </div>
    <div style={{ position: 'absolute', top: y0, width: '100%', display: 'flex', justifyContent: 'center', gap: 60 }}>
      {['A', 'B'].map(arm => <div key={arm} style={{ opacity: enter(arm), transform: `translateY(${(1 - enter(arm)) * 40}px)` }}>
        <Card arm={arm} f={f} exposures={arm === 'A' ? nA : nB} clicks={clicksAt(arm === 'A' ? nA : nB, arm)} showRate={ramp(f, sec(5), sec(5.4))}/>
      </div>)}
    </div>
    <div style={{ position: 'absolute', top: 300, width: '100%', textAlign: 'center', opacity: resultIn, transform: `scale(${0.8 + 0.2 * resultIn})` }}>
      <span style={{ fontSize: 110, fontWeight: 800, color: C.A }}>{pp(CI.diff)}</span>
    </div>
    <div style={{ position: 'absolute', top: 820, width: '100%', textAlign: 'center', fontSize: 28, color: C.muted, opacity: fade(f, sec(2.3), sec(5)) }}>
      상품 · 가격 · 문구는 같고, <b style={{ color: C.ink }}>버튼 강조만</b> 다릅니다
    </div>
  </AbsoluteFill>;
}

function IntervalScene({ f }) {
  const [lo, hi] = [-8, 14];
  const X = v => 260 + (v - lo) / (hi - lo) * 1400;
  const grow = ramp(f, sec(13), sec(15));
  const left = CI.diff + (CI.low - CI.diff) * grow, right = CI.diff + (CI.high - CI.diff) * grow;
  const crossZero = ramp(f, sec(15), sec(15.6));
  const verdict = ramp(f, sec(17), sec(17.8));
  const axisY = interpolate(verdict, [0, 1], [470, 330]);
  return <AbsoluteFill style={{ opacity: ramp(f, sec(12), sec(12.4)) }}>
    <svg width="1920" height="1080" style={{ position: 'absolute' }}>
      <rect x={X(lo)} y={axisY - 70} width={X(0) - X(lo)} height="140" fill="#fbe9e5" opacity={crossZero}/>
      <line x1={X(lo)} x2={X(hi)} y1={axisY} y2={axisY} stroke={C.line} strokeWidth="4"/>
      {[-5, 0, 5, 10].map(v => <g key={v}>
        <line x1={X(v)} x2={X(v)} y1={axisY - 12} y2={axisY + 12} stroke={v === 0 ? C.ink : C.line} strokeWidth={v === 0 ? 4 : 3}/>
        <text x={X(v)} y={axisY + 56} textAnchor="middle" fontSize="28" fill={v === 0 ? C.ink : C.muted} fontWeight={v === 0 ? 700 : 400} fontFamily={FONT}>{v === 0 ? '0 (차이 없음)' : pp(v)}</text>
      </g>)}
      <line x1={X(left)} x2={X(right)} y1={axisY} y2={axisY} stroke={C.A} strokeWidth="14" strokeLinecap="round" opacity={grow > 0 ? 0.55 : 0}/>
      <circle cx={X(CI.diff)} cy={axisY} r="20" fill={C.A}/>
      <text x={X(CI.diff)} y={axisY - 44} textAnchor="middle" fontSize="54" fontWeight="800" fill={C.A} fontFamily={FONT}>{pp(CI.diff)}</text>
      <text x={960} y={axisY + 120} textAnchor="middle" fontSize="28" fill={C.ink} opacity={ramp(f, sec(15), sec(15.5))} fontFamily={FONT}>95% 신뢰구간 {pp(CI.low)} ~ {pp(CI.high)} · 0을 지나요</text>
    </svg>
    <div style={{ position: 'absolute', top: 560, width: '100%', display: 'flex', justifyContent: 'center', opacity: verdict, transform: `translateY(${(1 - verdict) * 30}px)` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 40, padding: '34px 48px', borderRadius: 22, background: '#ebeae4' }}>
        <ApplyButton crossed/>
        <div>
          <div style={{ fontSize: 56, fontWeight: 800 }}>판단 보류</div>
          <div style={{ fontSize: 30, color: C.muted, marginTop: 6 }}>기존안 유지 · 다음: 더 많은 데이터로 검증</div>
        </div>
      </div>
    </div>
  </AbsoluteFill>;
}

function OpeningScene({ f }) {
  const cx = interpolate(f, [0, 40], [1300, 1010], { extrapolateRight: 'clamp', easing: ease });
  const cy = interpolate(f, [0, 40], [900, 640], { extrapolateRight: 'clamp', easing: ease });
  return <AbsoluteFill style={{ opacity: fade(f, -10, sec(2.2)), alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ fontSize: 240, fontWeight: 800, color: C.A, lineHeight: 1 }}>{pp(CI.diff)}</div>
    <div style={{ marginTop: 50 }}><ApplyButton/></div>
    <Cursor x={cx} y={cy}/>
  </AbsoluteFill>;
}

export function AbHold() {
  const f = useCurrentFrame();
  const sub = SUBS.find(([a, b]) => f >= sec(a) && f < sec(b)) ?? SUBS.at(-1);
  return <AbsoluteFill style={{ background: C.bg, color: C.ink, fontFamily: FONT }}>
    <div style={{ position: 'absolute', top: 44, left: 80, right: 80, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 30, fontWeight: 700 }}>
      <span>Iterglow <span style={{ color: C.muted, fontWeight: 500, fontSize: 24 }}>실험 01 / 구매 버튼</span></span>
      <span style={{ padding: '6px 18px', borderRadius: 999, background: C.soft, color: C.A, fontSize: 22 }}>시뮬레이션</span>
    </div>
    <OpeningScene f={f}/>
    <CardsScene f={f}/>
    <IntervalScene f={f}/>
    <div key={sub[2]} style={{ position: 'absolute', bottom: 70, width: '100%', textAlign: 'center' }}>
      <span style={{ padding: '14px 30px', borderRadius: 12, background: '#1d2333e6', color: '#fff', fontSize: 38, fontWeight: 600, opacity: ramp(f, sec(sub[0]), sec(sub[0]) + 6) }}>{sub[2]}</span>
    </div>
  </AbsoluteFill>;
}
