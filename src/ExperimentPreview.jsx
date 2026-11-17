import React, { useEffect, useId, useRef, useState } from 'react';
import { ArrowUpRight, Pause, Play, RotateCcw } from 'lucide-react';
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
    screen: { outside: '기본 화면', A: '짧은 문구 예시', B: '구체적 문구 예시' },
    buttons: { outside: '더 보기', A: '더 알아보기', B: '코드 살펴보기' },
    people: '명', target: '설정상 전체', observed: '관측된 전체 비중',
    noData: '아직 도착한 사용자 없음', generated: '입장', moving: '이동 중', pending: '배정 대기', latest: '최근 도착',
    status: '재생 상태', stopped: '일시정지 중', playing: '재생 중',
    notice: '가상 ID로만 동작하는 시뮬레이션입니다. 실제 사용자·SDK·운영 API와 연결하거나 이벤트를 저장하지 않습니다.',
    history: '설정 변경은 새 ID부터. 기존·이동 중 배정과 누적은 유지됩니다. 새 비율만 보려면 배정 초기화하세요.',
    sample: '점 1개 = 가상 ID 1개. 도착한 배정 수이며 전환율이 아닙니다. 소수 표본의 비중은 설정 비율과 다를 수 있습니다.',
    rulesTitle: '이 시뮬레이션과 Iterglow의 차이',
    rules: '이 모형은 참여 여부와 A/B를 별도 ID 버킷으로 정하고, 같은 실행 안의 동일 ID는 첫 경로(비참여 포함)를 유지합니다. 초기화하면 기록만 지우고 설정은 유지합니다. Iterglow의 기존 실험 배정 기록 재사용을 설명하기 위한 규칙입니다. 현재 SDK v1의 Feature Flag 응답은 비율 변경 후 같은 ID라도 바뀔 수 있고, 실제 노출은 화면 표시 뒤 expose()로 기록합니다. 독립된 참여율·A:B 조절은 제품 설정을 그대로 재현한 것이 아닙니다. 현재 제품의 표본 비율 검사(SRM)는 균등 배정을 기준으로 하므로, 이 80:20 시연은 제품 분석의 유효성을 보장하지 않습니다.',
    reduced: '모션 감소 설정: 이동 애니메이션 대신 배정 수만 갱신합니다.',
    support: 'Iterglow가 유용하다면 GitHub Star로 응원해 주세요.',
    github: 'GitHub 저장소 보기', githubLabel: 'GitHub 저장소 보기 (새 탭)',
    chartTitle: '사용자 배정 흐름', chartDescription: '가상 사용자가 참여율 관문을 지나 비참여 또는 A/B로 갈라집니다. 아래 수치는 각 경로에 도착한 누적 배정입니다.',
  },
  en: {
    title: 'Change the ratio. Watch visitors take a different path.',
    intro: 'Participation is the share of all visitors entering the experiment. A:B splits those participants.',
    participation: 'Experiment participation', ratio: 'A:B within participants', presets: 'Quick A:B settings',
    start: 'Play', pause: 'Pause', reset: 'Reset assignments',
    incoming: 'Virtual visitors', gate: 'Join', split: 'A:B',
    names: { outside: 'Not enrolled', A: 'Screen A', B: 'Screen B' },
    screen: { outside: 'Default screen', A: 'Short label example', B: 'Specific label example' },
    buttons: { outside: 'View', A: 'Learn more', B: 'Explore code' },
    people: 'visitors', target: 'Target of all visitors', observed: 'Observed share of all',
    noData: 'No arrivals yet', generated: 'Entered', moving: 'In transit', pending: 'Pending', latest: 'Latest arrival',
    status: 'Playback status', stopped: 'Paused', playing: 'Playing',
    notice: 'A simulation with synthetic IDs only. No real visitors, SDK, production API, or event storage is connected.',
    history: 'Changes apply to new IDs only. In-flight paths and cumulative counts stay intact. Reset assignments to compare a new ratio alone.',
    sample: 'One dot = one synthetic ID. These are arrived assignments, not conversions. Small samples can differ from target ratios.',
    rulesTitle: 'How this model differs from Iterglow',
    rules: 'This model uses separate ID buckets for participation and A/B and retains the first path for the same ID within a run, including non-participation. Reset clears assignments and keeps settings. It illustrates reuse of legacy experiment assignment records. Current SDK v1 Feature Flag responses can change for the same ID when rollout changes; real exposures are recorded with expose() after rendering. Independent participation and A:B controls do not reproduce product settings. Current product sample-ratio checks (SRM) assume equal allocation, so this 80:20 demonstration does not validate product analysis.',
    reduced: 'Reduced motion: counts update without traveling animations.',
    support: 'If you find Iterglow useful, support it with a GitHub Star.',
    github: 'View the GitHub repository', githubLabel: 'View the GitHub repository (new tab)',
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
      <p className="sim-notice">{t.notice}</p>
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
        </div>
        <div className="sim-actions">
          <div role="group" aria-label={t.presets} className="sim-presets">
            {[50, 80].map(value => <Button key={value} variant="outline" aria-pressed={aShare === value} onClick={() => setAShare(value)}>{value}:{100 - value}</Button>)}
          </div>
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
          <p className="sim-count"><strong>{number(view.counts[key])}</strong> {t.people}</p>
          <p className="sim-observed">{total ? `${t.observed} ${number(view.counts[key] / total * 100)}%` : t.noData}</p>
          <div className="sim-screen"><span>{t.screen[key]}</span><span className="sim-example-button">{t.buttons[key]}</span></div>
        </article>)}
      </div>
      <p className="sim-latest">{t.latest}: {view.latest ? `${view.latest.id} → ${t.names[view.latest.outcome]}` : '—'}</p>
      <p className="sim-explanation">{t.sample}</p><p className="sim-explanation">{t.history}</p>
      <details className="sim-rules"><summary>{t.rulesTitle}</summary><p>{t.rules}</p></details>
      <div className="sim-support"><p>{t.support}</p><Button asChild variant="outline"><a href={repo} target="_blank" rel="noreferrer" aria-label={t.githubLabel}>{t.github}<ArrowUpRight aria-hidden="true"/></a></Button></div>
    </div>
  </section>;
}
