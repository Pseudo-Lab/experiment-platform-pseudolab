import React from 'react';
import { AbsoluteFill, random } from 'remotion';
import { useCurrentFrame } from 'remotion';
import { C, FONT, fade, pp, ramp, sec } from './AbHold.jsx';
import { diffCI } from './stats.js';

// Vertical 1080×1920 cut: opens on a "success report" and lets the viewer misread it first.
const BEFORE = 6; // prior-period reference rate (%), not part of the experiment
const N = 100, CLICKS = { A: 8, B: 11 };
const CI = diffCI(CLICKS.A, N, CLICKS.B, N);
export const REELS_FRAMES = sec(15);

const SUBS = [
  [0, 2, ''],
  [2, 5, '바꾸기 전과 비교하면 +5%p.\n같은 기간 A/B 차이는 +3%p.'],
  [5, 9, '안 바꾼 A도 올랐어요.\n그 몫은 버튼과 무관한 변화예요.'],
  [9, 15, '비교 대상을 바꾸니,\n결론도 달라졌습니다.'],
];

function Bubble({ who, text, f, at, big, align = 'left' }) {
  const t = ramp(f, at, at + 6);
  return <div style={{ display: 'flex', flexDirection: align === 'left' ? 'row' : 'row-reverse', alignItems: 'flex-end', gap: 20, opacity: t, transform: `translateY(${(1 - t) * 60}px) scale(${0.9 + 0.1 * t})` }}>
    <div style={{ width: 92, height: 92, flexShrink: 0, borderRadius: 46, display: 'grid', placeItems: 'center', background: align === 'left' ? '#dcefe9' : C.soft, color: align === 'left' ? C.B : C.A, fontSize: 34, fontWeight: 800 }}>{who}</div>
    <div style={{ maxWidth: 820, padding: big ? '34px 42px' : '26px 34px', borderRadius: 36, background: align === 'left' ? '#fff' : C.A, color: align === 'left' ? C.ink : '#fff', fontSize: big ? 66 : 50, fontWeight: 800, lineHeight: 1.3, whiteSpace: 'pre-line', boxShadow: '0 16px 40px #00000018' }}>{text}</div>
  </div>;
}

function Confetti({ f }) {
  // Bursts for ~8 frames, then freezes mid-air and greys out when the objection lands.
  const t = Math.min(f, sec(0.9)) - sec(0.6);
  if (t <= 0) return null;
  const frozen = f > sec(0.9);
  return <svg width="1080" height="1920" style={{ position: 'absolute', opacity: frozen ? 0.25 : 1, filter: frozen ? 'grayscale(1)' : 'none' }}>
    {Array.from({ length: 36 }, (_, i) => {
      const a = random(`a${i}`) * Math.PI * 2, v = 30 + random(`v${i}`) * 50;
      return <rect key={i} x={540 + Math.cos(a) * v * t} y={760 + Math.sin(a) * v * t} width="18" height="30" rx="4"
        fill={[C.A, C.B, '#f2b134', '#e46a5b'][i % 4]} transform={`rotate(${i * 37} ${540 + Math.cos(a) * v * t} ${760 + Math.sin(a) * v * t})`}/>;
    })}
  </svg>;
}

function Arm({ arm, label, f, at }) {
  const t = ramp(f, at, at + 10);
  const color = C[arm];
  return <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 80px', opacity: t, transform: `translateX(${(1 - t) * (arm === 'A' ? -80 : 80)}px)` }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 18, fontSize: 44, fontWeight: 700 }}>
      <span style={{ display: 'grid', placeItems: 'center', width: 70, height: 70, borderRadius: 16, background: arm === 'A' ? C.soft : '#dcefe9', color }}>{arm}</span>{label}
      <span style={{ marginLeft: 'auto', padding: '8px 20px', borderRadius: 999, background: C.ink, color: '#fff', fontSize: 32 }}>같은 기간</span>
    </div>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 26, marginTop: 10 }}>
      <span style={{ fontSize: 260, fontWeight: 900, color, lineHeight: 1 }}>{CLICKS[arm]}%</span>
      <span style={{ fontSize: 36, color: C.muted }}>{CLICKS[arm]}/{N}명 클릭</span>
    </div>
  </div>;
}

function Interval({ f }) {
  const [lo, hi] = [-8, 14];
  const X = v => 90 + (v - lo) / (hi - lo) * 900;
  const grow = ramp(f, sec(9.6), sec(11));
  const cross = ramp(f, sec(11), sec(11.5));
  const y = 760;
  return <svg width="1080" height="1920" style={{ position: 'absolute' }}>
    <rect x={X(lo)} y={y - 90} width={X(0) - X(lo)} height="180" fill="#fbe9e5" opacity={cross}/>
    <line x1={X(lo)} x2={X(hi)} y1={y} y2={y} stroke={C.line} strokeWidth="6"/>
    {[-5, 0, 5, 10].map(v => <g key={v}>
      <line x1={X(v)} x2={X(v)} y1={y - 18} y2={y + 18} stroke={v === 0 ? C.ink : C.line} strokeWidth={v === 0 ? 6 : 4}/>
      <text x={X(v)} y={y + 70} textAnchor="middle" fontSize="38" fontWeight={v === 0 ? 800 : 500} fill={v === 0 ? C.ink : C.muted} fontFamily={FONT}>{v === 0 ? '0' : pp(v)}</text>
    </g>)}
    <line x1={X(CI.diff + (CI.low - CI.diff) * grow)} x2={X(CI.diff + (CI.high - CI.diff) * grow)} y1={y} y2={y} stroke={C.A} strokeWidth="22" strokeLinecap="round" opacity={grow ? 0.55 : 0}/>
    <circle cx={X(CI.diff)} cy={y} r="30" fill={C.A}/>
    <text x={X(CI.diff)} y={y - 64} textAnchor="middle" fontSize="88" fontWeight="900" fill={C.A} fontFamily={FONT}>{pp(CI.diff)}</text>
    <text x="540" y={y + 160} textAnchor="middle" fontSize="40" fill={C.ink} opacity={cross} fontFamily={FONT}>95% 구간 {pp(CI.low)} ~ {pp(CI.high)}</text>
    <text x="540" y={y + 220} textAnchor="middle" fontSize="40" fontWeight="800" fill="#c2412f" opacity={cross} fontFamily={FONT}>0을 지나요 → 방향이 아직 불확실</text>
  </svg>;
}

export function AbReels() {
  const f = useCurrentFrame();
  const sub = SUBS.find(([a, b]) => f >= sec(a) && f < sec(b)) ?? SUBS.at(-1);
  const hook = fade(f, -10, sec(2.1));
  const split = fade(f, sec(2), sec(9.2));
  const ending = ramp(f, sec(9), sec(9.4));
  const hold = ramp(f, sec(12), sec(12.6));
  const seats = Array.from({ length: 40 }, (_, i) => (random(`s${i}`) < 0.5 ? 'A' : 'B'));
  return <AbsoluteFill style={{ background: C.bg, color: C.ink, fontFamily: FONT }}>
    <div style={{ position: 'absolute', top: 70, right: 60, padding: '8px 22px', borderRadius: 999, background: C.soft, color: C.A, fontSize: 30, fontWeight: 700, zIndex: 5 }}>시뮬레이션</div>

    {/* 0–2s hook: success report, then the objection */}
    <AbsoluteFill style={{ opacity: hook }}>
      <div style={{ position: 'absolute', top: 470, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 168, fontWeight: 900, letterSpacing: -5, lineHeight: 1 }}><span style={{ color: C.muted }}>6%</span> → <span style={{ color: C.B }}>11%</span></div>
        <div style={{ marginTop: 22, fontSize: 36, color: C.muted }}>이전 기간 (참고값) → 버튼 바꾼 뒤</div>
      </div>
      <Confetti f={f}/>
      <div style={{ position: 'absolute', top: 1000, left: 60, right: 60 }}><Bubble who="기획" text="버튼 바꿨더니 클릭률 올랐어요 🎉" f={f} at={2}/></div>
      <div style={{ position: 'absolute', top: 1250, left: 60, right: 60, opacity: f >= sec(0.8) ? 1 : 0 }}><Bubble who="데이터" text={"근데 안 바꾼 쪽도\n올랐는데요?"} f={f} at={sec(0.8)} big align="right"/></div>
    </AbsoluteFill>

    {/* 2–9s split: same-period A vs B, then why */}
    <AbsoluteFill style={{ opacity: split, flexDirection: 'column', paddingTop: 170, paddingBottom: 420 + 400 * ramp(f, sec(5), sec(5.5)) }}>
      <Arm arm="A" label="그대로 둔 버튼" f={f} at={sec(2)}/>
      <div style={{ height: 4, margin: '0 80px', background: C.line }}/>
      <Arm arm="B" label="강조한 버튼" f={f} at={sec(2.3)}/>
      <div style={{ position: 'absolute', top: 1180, left: 80, right: 80, opacity: ramp(f, sec(5), sec(5.5)) }}>
        <div style={{ fontSize: 40, fontWeight: 700 }}>같은 기간에 방문자를 무작위로 나눴기 때문에</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 22 }}>
          {seats.map((arm, i) => <span key={i} style={{ width: 34, height: 34, borderRadius: 17, background: C[arm], opacity: ramp(f, sec(5.3) + i, sec(5.3) + i + 4) }}/>)}
        </div>
        <div style={{ marginTop: 26, fontSize: 40, color: C.muted, opacity: ramp(f, sec(6.6), sec(7)) }}>
          시기 효과는 양쪽에 똑같이 → 남는 차이 <b style={{ color: C.A }}>{pp(CI.diff)}</b>
        </div>
      </div>
    </AbsoluteFill>

    {/* 9–15s interval crosses 0 → hold */}
    <AbsoluteFill style={{ opacity: ending }}>
      <div style={{ position: 'absolute', top: 330, width: '100%', textAlign: 'center', fontSize: 52, fontWeight: 800 }}>같은 기간 A/B 차이</div>
      <Interval f={f}/>
      <div style={{ position: 'absolute', top: 1140, width: '100%', display: 'flex', justifyContent: 'center', opacity: hold, transform: `scale(${0.85 + 0.15 * hold})` }}>
        <div style={{ padding: '36px 60px', borderRadius: 30, background: C.ink, color: '#fff', textAlign: 'center' }}>
          <div style={{ fontSize: 92, fontWeight: 900 }}>판단 보류</div>
          <div style={{ fontSize: 36, opacity: 0.8, marginTop: 6 }}>기존안 유지 · 데이터 더 모아 검증</div>
        </div>
      </div>
      <div style={{ position: 'absolute', top: 1420, width: '100%', textAlign: 'center', fontSize: 34, color: C.muted, opacity: ramp(f, sec(13), sec(13.4)) }}>Iterglow · 숫자를 비교하고, 바꿀 근거를 확인합니다</div>
    </AbsoluteFill>

    {sub[2] && <div style={{ position: 'absolute', bottom: 230, width: '100%', textAlign: 'center' }}>
      <span style={{ display: 'inline-block', whiteSpace: 'pre-line', padding: '20px 36px', borderRadius: 18, background: '#1d2333e6', color: '#fff', fontSize: 50, fontWeight: 700, lineHeight: 1.35, opacity: ramp(f, sec(sub[0]), sec(sub[0]) + 6) }}>{sub[2]}</span>
    </div>}
  </AbsoluteFill>;
}
