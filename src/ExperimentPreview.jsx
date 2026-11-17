import React, { useEffect, useId, useRef, useState } from 'react';
import { ArrowUpRight, Pause, Play, RotateCcw, Star } from 'lucide-react';
import { Button } from './components/ui/button';
import { assignVisitor } from './assignmentSimulation';

const DURATION = 1.2;
const INTERVAL = 0.05;
const outcomes = ['outside', 'A', 'B'];
const copy = {
  ko: {
    title: '비율을 바꾸면, 사용자의 길이 달라집니다.',
    intro: '참여율은 전체 중 실험에 들어오는 비중, A:B는 참여한 사용자 안에서의 비중입니다.',
    participation: '실험 참여율', ratio: '참여자 안의 A:B', presets: 'A:B 빠른 설정',
    start: '재생', pause: '일시정지', reset: '배정 초기화',
    incoming: '입장하는 가상 사용자', gate: '참여', split: 'A:B',
    names: { outside: '비참여', A: 'A 화면', B: 'B 화면' },
    screen: { outside: '기본 화면', A: '짧은 안내', B: '구체적인 안내' },
    buttons: { outside: '더 보기', A: '더 알아보기', B: '코드 살펴보기' },
    people: '명', target: '설정상 전체', observed: '누적 배정 비중',
    noData: '아직 도착한 사용자 없음', generated: '입장', moving: '이동 중', pending: '배정 대기', latest: '최근 도착',
    status: '재생 상태', stopped: '일시정지 중', playing: '재생 중',
    history: '비율 변경은 다음 사용자부터 적용됩니다. 새로 비교하려면 배정 초기화를 눌러보세요.',
    sample: '점 하나는 가상 사용자 한 명입니다. 설정 비율과 누적 배정 비중을 비교해 보세요.',
    reduced: '모션 감소 설정: 이동 애니메이션 대신 배정 수만 갱신합니다.',
    support: 'GitHub Star로 Iterglow를 응원해 주세요.',
    github: 'GitHub Star로 응원하기', githubLabel: 'GitHub Star로 응원하기 (새 탭)',
    chartTitle: '사용자 배정 흐름', chartDescription: '가상 사용자가 참여율 관문을 지나 비참여 또는 A/B로 갈라집니다. 아래 수치는 각 경로에 도착한 누적 배정입니다.',
  },
  en: {
    title: 'Change the ratio. Watch visitors take a different path.',
    intro: 'Participation is the share of all visitors entering the experiment. A:B splits those participants.',
    participation: 'Experiment participation', ratio: 'A:B within participants', presets: 'Quick A:B settings',
    start: 'Play', pause: 'Pause', reset: 'Reset assignments',
    incoming: 'Virtual visitors', gate: 'Join', split: 'A:B',
    names: { outside: 'Not enrolled', A: 'Screen A', B: 'Screen B' },
    screen: { outside: 'Default screen', A: 'Short label', B: 'Specific label' },
    buttons: { outside: 'View', A: 'Learn more', B: 'Explore code' },
    people: 'visitors', target: 'Target of all visitors', observed: 'Cumulative share of all',
    noData: 'No arrivals yet', generated: 'Entered', moving: 'In transit', pending: 'Pending', latest: 'Latest arrival',
    status: 'Playback status', stopped: 'Paused', playing: 'Playing',
    history: 'Ratio changes apply to the next visitors. Reset assignments to start a fresh comparison.',
    sample: 'Each dot is one virtual visitor. Compare the target ratios with the cumulative assignments.',
    reduced: 'Reduced motion: counts update without traveling animations.',
    support: 'Support Iterglow with a GitHub Star.',
    github: 'Support us with a GitHub Star', githubLabel: 'Support us with a GitHub Star (new tab)',
    chartTitle: 'Visitor assignment flow', chartDescription: 'Synthetic visitors pass a participation gate, then take a non-participation, A, or B path. Counts below show cumulative arrivals on each path.',
  },
};

function useMediaPreference(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    media.addEventListener('change', update);
    update();
    return () => media.removeEventListener('change', update);
  }, [query]);
  return matches;
}

const emptyView = () => ({ tokens: [], counts: { outside: 0, A: 0, B: 0 }, entered: 0, latest: null });

export default function ExperimentPreview({ lang, repo }) {
  const t = copy[lang];
  const id = useId();
  const compact = useMediaPreference('(max-width: 700px)');
  const reduced = useMediaPreference('(prefers-reduced-motion: reduce)');
  const [participation, setParticipation] = useState(60);
  const [aShare, setAShare] = useState(50);
  const settings = useRef({ participation, aShare });
  settings.current = { participation, aShare };
  const [running, setRunning] = useState(false);
  const [view, setView] = useState(emptyView);
  const model = useRef({ assignments: new Map(), tokens: [], sequence: 0, lastSpawn: -Infinity, counts: { outside: 0, A: 0, B: 0 }, latest: null });
  const svg = useRef(null);
  const [chartWidth, setChartWidth] = useState(720);

  useEffect(() => {
    if (window.location.hash === '#experiment-preview') {
      document.getElementById('experiment-preview').scrollIntoView({ block: 'start', behavior: 'instant' });
    }
  }, []);

  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      const width = Math.round(entries[0].contentRect.width);
      if (width > 0) setChartWidth(width);
    });
    observer.observe(svg.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const clock = svg.current;
    let frame;
    let disposed = false;
    const publish = () => {
      const state = model.current;
      setView({ tokens: [...state.tokens], counts: { ...state.counts }, entered: state.sequence, latest: state.latest });
    };
    const arrive = token => {
      const state = model.current;
      state.counts[token.outcome] += 1;
      state.latest = token;
    };
    function tick() {
      if (disposed || !running || document.hidden) return;
      const now = clock.getCurrentTime();
      const state = model.current;
      const arrived = state.tokens.filter(token => reduced || now - token.started >= DURATION);
      arrived.forEach(arrive);
      state.tokens = state.tokens.filter(token => !arrived.includes(token));
      const spawn = now - state.lastSpawn >= INTERVAL;
      if (spawn) {
        const visitor = `U-${String(++state.sequence).padStart(4, '0')}`;
        const { participation: join, aShare: share } = settings.current;
        const token = { id: visitor, outcome: assignVisitor(state.assignments, visitor, join, share), started: now };
        state.lastSpawn = now;
        if (reduced) arrive(token); else state.tokens.push(token);
      }
      if (spawn || arrived.length) publish();
      frame = requestAnimationFrame(tick);
    }
    const syncPlayback = () => {
      cancelAnimationFrame(frame);
      if (running && !document.hidden) {
        clock.unpauseAnimations();
        frame = requestAnimationFrame(tick);
      } else clock.pauseAnimations();
    };
    syncPlayback();
    document.addEventListener('visibilitychange', syncPlayback);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      clock.pauseAnimations();
      document.removeEventListener('visibilitychange', syncPlayback);
    };
  }, [running, reduced]);

  function reset() {
    setRunning(false);
    svg.current.pauseAnimations();
    svg.current.setCurrentTime(0);
    model.current = { assignments: new Map(), tokens: [], sequence: 0, lastSpawn: -Infinity, counts: { outside: 0, A: 0, B: 0 }, latest: null };
    setView(emptyView());
  }

  const center = chartWidth / 2;
  const left = chartWidth / 6;
  const right = chartWidth * 5 / 6;
  const split = chartWidth * 0.66;
  const bottom = compact ? 258 : 218;
  const paths = {
    outside: `M${center} 22 V72 C${center} 118 ${left} 80 ${left} 150 V${bottom}`,
    A: `M${center} 22 V72 C${center} 118 ${split} 95 ${split} 150 C${split} 196 ${center} 178 ${center} 210 V${bottom}`,
    B: `M${center} 22 V72 C${center} 118 ${split} 95 ${split} 150 C${split} 196 ${right} 178 ${right} 210 V${bottom}`,
  };
  const number = value => new Intl.NumberFormat(lang, { maximumFractionDigits: 2 }).format(value);
  const total = outcomes.reduce((sum, key) => sum + view.counts[key], 0);
  const target = { outside: 100 - participation, A: participation * aShare / 100, B: participation * (100 - aShare) / 100 };

  return <section id="experiment-preview" tabIndex={-1} className="assignment-demo">
    <div className="wrap">
      <h2>{t.title}</h2><p className="sim-intro">{t.intro}</p>
      <div className="sim-controls">
        <div className="sim-slider">
          <label htmlFor={`${id}-participation`}>{t.participation}<output>{participation}%</output></label>
          <input id={`${id}-participation`} type="range" min="0" max="100" step="1" value={participation} onChange={event => setParticipation(Number(event.target.value))}/>
          <div className="sim-range-ends" aria-hidden="true"><span>0%</span><span>100%</span></div>
        </div>
        <div className="sim-slider">
          <label htmlFor={`${id}-ratio`}>{t.ratio}<output>A {aShare} : B {100 - aShare}</output></label>
          <input id={`${id}-ratio`} type="range" min="0" max="100" step="1" value={aShare} aria-valuetext={`A ${aShare}%, B ${100 - aShare}%`} onChange={event => setAShare(Number(event.target.value))}/>
          <div className="sim-range-ends" aria-hidden="true"><span>A 0 : B 100</span><span>A 100 : B 0</span></div>
          <div role="group" aria-label={t.presets} className="sim-presets">
            {[50, 80].map(value => <Button key={value} variant="outline" aria-pressed={aShare === value} onClick={() => setAShare(value)}>{value}:{100 - value}</Button>)}
          </div>
        </div>
        <div className="sim-actions">
          <Button onClick={() => setRunning(value => !value)}>{running ? <Pause aria-hidden="true"/> : <Play aria-hidden="true"/>}{running ? t.pause : t.start}</Button>
          <Button variant="outline" onClick={reset}><RotateCcw aria-hidden="true"/>{t.reset}</Button>
        </div>
      </div>
      <div className="sim-playback"><span role="status" aria-label={t.status}>{running ? t.playing : t.stopped}</span><span>{t.generated} {number(view.entered)} · {reduced ? t.pending : t.moving} {number(view.tokens.length)}</span></div>
      {reduced && <p className="sim-reduced">{t.reduced}</p>}
      <svg ref={svg} className="sim-flow" viewBox={`0 0 ${chartWidth} ${compact ? 292 : 250}`} role="img" aria-labelledby={`${id}-title ${id}-description`}>
        <title id={`${id}-title`}>{t.chartTitle}</title><desc id={`${id}-description`}>{t.chartDescription}</desc>
        <text x={center - 20} y="20" textAnchor="end" className="sim-incoming">{compact && lang === 'ko' ? '가상 사용자' : t.incoming}</text>
        {outcomes.map(key => <path key={key} d={paths[key]} className={`sim-path sim-${key}`}/>)}
        <circle cx={center} cy="72" r="9" className="sim-gate"/>
        <text x={center + 18} y="65" className="sim-gate-label">{t.gate} {participation}%</text>
        <circle cx={split} cy="150" r="9" className="sim-gate"/>
        <text x={split + 8} y="132" className="sim-gate-label">{t.split} {aShare}:{100 - aShare}</text>
        {outcomes.map((key, index) => <text key={key} x={[left, center, right][index]} y={bottom + 25} textAnchor="middle" className={`sim-endpoint sim-${key}`}>{key === 'outside' ? t.names.outside : key}</text>)}
        {view.tokens.map(token => <circle key={token.id} r="8" cx={reduced ? { outside: left, A: center, B: right }[token.outcome] : undefined} cy={reduced ? bottom - 12 : undefined} className={`sim-dot sim-${token.outcome}`} data-visitor={token.id} data-outcome={token.outcome}>
          {!reduced && <animateMotion path={paths[token.outcome]} begin={`${token.started}s`} dur={`${DURATION}s`} fill="freeze" calcMode="paced"/>}
        </circle>)}
      </svg>
      <div className="sim-results">
        {outcomes.map(key => <article key={key} className={`sim-result sim-${key}`} data-outcome={key}>
          <h3>{t.names[key]}</h3><p className="sim-target">{t.target} <b>{number(target[key])}%</b></p>
          <p className="sim-count"><strong className={view.counts[key] >= 1000 ? 'sim-large-count' : undefined}>{number(view.counts[key])}</strong> {t.people}</p>
          <p className="sim-observed">{total ? `${t.observed} ${number(view.counts[key] / total * 100)}%` : t.noData}</p>
          <div className="sim-screen"><span>{t.screen[key]}</span><span className="sim-example-button">{t.buttons[key]}</span></div>
        </article>)}
      </div>
      <p className="sim-latest">{t.latest}: {view.latest ? `${view.latest.id} → ${t.names[view.latest.outcome]}` : '—'}</p>
      <p className="sim-explanation">{t.sample}</p><p className="sim-explanation">{t.history}</p>
      <div className="sim-support"><p>{t.support}</p><Button asChild><a href={repo} target="_blank" rel="noreferrer" aria-label={t.githubLabel}><Star aria-hidden="true"/>{t.github}<ArrowUpRight aria-hidden="true"/></a></Button></div>
    </div>
  </section>;
}
