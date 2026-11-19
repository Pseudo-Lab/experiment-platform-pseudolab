import React, { useEffect, useId, useRef, useState } from 'react';
import { Play, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { Button, buttonVariants } from './components/ui/button';
import { cn } from './lib/utils';
import { assignVisitor, compareRates, isClickAt } from './assignmentSimulation';

const DURATION = 0.6;
const INTERVAL = 0.017; // 200 visitors ≈ 3.4s + travel ≈ 4s run
const VISITORS = 200;
const RATES = { A: 8, B: 11 };
const outcomes = ['A', 'B'];
const copy = {
  ko: {
    title: 'A/B 테스트 체험하기',
    intro: '방문자를 두 화면으로 나누고, 반응을 비교해 판단하는 방법이에요.',
    eyebrow: ['실험 01', '구매 버튼'], hypothesis: '버튼을 강조하면 더 많이 클릭할까?',
    steps: ['방문자 배정', '화면 노출', '클릭 측정', '결과 해석'],
    run: '실험 돌려보기', running: '실험 중…', rerun: '다시 돌려보기',
    ratio: 'A/B 배정 비율', ratioToggle: '배정 비율 바꿔보기', presets: 'A:B 빠른 설정',
    shop: '데일리 스토어', productPage: '리빙 / 머그컵', productName: '데일리 세라믹 머그', price: '19,900원', buy: '구매하기',
    names: { A: '기본 버튼', B: '강조 버튼' },
    exposures: '노출', clicks: '클릭', rateLabel: '구매 버튼 클릭률',
    formula: '클릭률 = 구매 버튼을 누른 방문자 ÷ 화면을 본 방문자', formulaNote: '노출과 클릭을 따로 세어 A와 B를 같은 기준으로 비교해요.',
    simulation: '시뮬레이션', verdictTitle: decisive => decisive ? '차이 확인' : '판단 보류',
    verdict: ({ decisive, diff }) => decisive
      ? (diff > 0 ? 'B의 클릭률이 더 높다고 판단할 수 있어요.' : 'A의 클릭률이 더 높다고 판단할 수 있어요.')
      : diff > 0 ? 'B가 앞서지만 아직 판단하기엔 표본이 부족해요.'
        : diff < 0 ? 'A가 앞서지만 아직 판단하기엔 표본이 부족해요.' : '차이가 없어요. 표본을 더 모아야 해요.',
    footnote: n => `가상 방문자 ${n}명 · 클릭률을 A ${RATES.A}%, B ${RATES.B}%로 정해 둔 시뮬레이션이에요.`,
    outro: '배정 · 노출 · 행동 · 판단을 지원합니다.',
    reduced: '모션 감소 설정: 이동 애니메이션 없이 수치만 갱신합니다.',
    chartTitle: '사용자 배정 흐름', chartDescription: '가상 방문자가 설정 비율에 따라 A 또는 B 화면으로 나뉩니다.', incoming: '가상 방문자',
  },
  en: {
    title: 'Try A/B testing',
    intro: 'Split visitors between two versions, compare their responses, and decide.',
    eyebrow: ['Experiment 01', 'Buy button'], hypothesis: 'Will a prominent button get more clicks?',
    steps: ['Assign visitors', 'Show screens', 'Count clicks', 'Read the result'],
    run: 'Run the experiment', running: 'Running…', rerun: 'Run again',
    ratio: 'A/B assignment ratio', ratioToggle: 'Change the split', presets: 'Quick A:B settings',
    shop: 'Daily Store', productPage: 'Living / Mugs', productName: 'Everyday ceramic mug', price: '₩19,900', buy: 'Buy',
    names: { A: 'Current button', B: 'Prominent button' },
    exposures: 'Views', clicks: 'Clicks', rateLabel: 'Buy click rate',
    formula: 'Click rate = visitors who clicked ÷ visitors who saw the screen', formulaNote: 'Views and clicks are counted separately so A and B share one yardstick.',
    simulation: 'Simulation', verdictTitle: decisive => decisive ? 'Difference confirmed' : 'Decision on hold',
    verdict: ({ decisive, diff }) => decisive
      ? (diff > 0 ? 'B has a higher click rate.' : 'A has a higher click rate.')
      : diff > 0 ? 'B is ahead, but the sample is too small to decide.'
        : diff < 0 ? 'A is ahead, but the sample is too small to decide.' : 'No difference yet. Collect more data.',
    footnote: n => `${n} virtual visitors · simulated with click rates fixed at A ${RATES.A}% and B ${RATES.B}%.`,
    outro: 'supports assignment, exposure, action, and decision.',
    reduced: 'Reduced motion: numbers update without traveling animations.',
    chartTitle: 'Visitor assignment flow', chartDescription: 'Virtual visitors split into A or B according to the selected ratio.', incoming: 'Virtual visitors',
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

const emptyCounts = () => ({ A: { exposures: 0, clicks: 0, lastClick: 0 }, B: { exposures: 0, clicks: 0, lastClick: 0 } });
const emptyModel = () => ({ assignments: new Map(), tokens: [], sequence: 0, lastSpawn: -Infinity, counts: emptyCounts() });

export default function ExperimentPreview({ lang, theme }) {
  const t = copy[lang];
  const id = useId();
  const compact = useMediaPreference('(max-width: 700px)');
  const reduced = useMediaPreference('(prefers-reduced-motion: reduce)');
  const [aShare, setAShare] = useState(50);
  const aShareRef = useRef(aShare);
  aShareRef.current = aShare;
  const [phase, setPhase] = useState('idle'); // idle → running → done
  const [ratioOpen, setRatioOpen] = useState(false);
  const [view, setView] = useState(() => ({ tokens: [], counts: emptyCounts() }));
  const model = useRef(emptyModel());
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
    const running = phase === 'running';
    let frame;
    let disposed = false;
    const publish = () => {
      const state = model.current;
      setView({ tokens: [...state.tokens], counts: structuredClone(state.counts) });
    };
    const arrive = token => {
      const counts = model.current.counts[token.outcome];
      counts.exposures += 1;
      if (isClickAt(counts.exposures, RATES[token.outcome])) {
        counts.clicks += 1;
        counts.lastClick = counts.exposures; // re-keys the flash so it replays on every click
      }
    };
    function tick() {
      if (disposed || !running || document.hidden || clock.animationsPaused()) return;
      const now = clock.getCurrentTime();
      const state = model.current;
      const arrived = state.tokens.filter(token => reduced || now - token.started >= DURATION);
      arrived.forEach(arrive);
      state.tokens = state.tokens.filter(token => !arrived.includes(token));
      let spawn = false;
      // Catch up on missed intervals so run length doesn't depend on frame rate.
      while (state.sequence < VISITORS && now - state.lastSpawn >= INTERVAL) {
        state.lastSpawn = state.lastSpawn === -Infinity ? now : state.lastSpawn + INTERVAL;
        const visitor = `U-${String(++state.sequence).padStart(4, '0')}`;
        const token = { id: visitor, outcome: assignVisitor(state.assignments, visitor, 100, aShareRef.current), started: state.lastSpawn };
        if (reduced) arrive(token); else state.tokens.push(token);
        spawn = true;
      }
      if (spawn || arrived.length) publish();
      if (state.sequence === VISITORS && state.tokens.length === 0) {
        clock.pauseAnimations();
        setPhase('done');
        return;
      }
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
  }, [phase, reduced]);

  function reset() {
    svg.current.pauseAnimations();
    svg.current.setCurrentTime(0);
    model.current = emptyModel();
    setView({ tokens: [], counts: emptyCounts() });
  }

  function run() {
    reset();
    setPhase('running');
  }

  function changeRatio(value) {
    if (aShare === value) return;
    reset();
    setPhase('idle');
    setAShare(value);
  }

  const center = chartWidth / 2;
  const left = chartWidth / 4;
  const right = chartWidth * 3 / 4;
  const bottom = compact ? 44 : 56;
  const paths = {
    A: `M${center} 6 V16 C${center} 34 ${left} 24 ${left} ${bottom}`,
    B: `M${center} 6 V16 C${center} 34 ${right} 24 ${right} ${bottom}`,
  };
  const number = value => new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }).format(value);
  const percent = value => `${number(value * 100)}%`;
  const { A, B } = view.counts;
  const result = compareRates(A.clicks, A.exposures, B.clicks, B.exposures);
  const activeStep = phase === 'done' ? 3 : phase === 'running' ? (A.clicks + B.clicks ? 2 : A.exposures + B.exposures ? 1 : 0) : -1;

  return <section id="experiment-preview" tabIndex={-1} className={`assignment-demo is-${phase}`}>
    <div className="wrap">
      <h2>{t.title}</h2><p className="sim-intro">{t.intro}</p>
      <p className="sim-eyebrow">{t.eyebrow[0]}<span aria-hidden="true"> / </span>{t.eyebrow[1]}</p>
      <p className="sim-question">{t.hypothesis}</p>
      <div className="sim-playback">
        <Button onClick={run} disabled={phase === 'running'} className="sim-run">
          {phase === 'done' ? <RotateCcw aria-hidden="true"/> : <Play aria-hidden="true"/>}{phase === 'running' ? t.running : phase === 'done' ? t.rerun : t.run}
        </Button>
        <ol className="sim-steps" aria-label={t.steps.join(' → ')}>
          {t.steps.map((step, index) => <li key={step} className={index === activeStep ? 'is-active' : undefined} aria-current={index === activeStep ? 'step' : undefined}><span>{String(index + 1).padStart(2, '0')}</span> {step}</li>)}
        </ol>
      </div>
      {reduced && <p className="sim-reduced">{t.reduced}</p>}
      <svg ref={svg} className="sim-flow" viewBox={`0 0 ${chartWidth} ${bottom + 4}`} role="img" aria-labelledby={`${id}-title ${id}-description`}>
        <title id={`${id}-title`}>{t.chartTitle}</title><desc id={`${id}-description`}>{t.chartDescription}</desc>
        {outcomes.map(key => <path key={key} d={paths[key]} className={`sim-path sim-${key}`}/>)}
        {view.tokens.map(token => <circle key={token.id} r={compact ? 3.5 : 5} className={`sim-dot sim-${token.outcome}`}>
          {!reduced && <animateMotion path={paths[token.outcome]} begin={`${token.started}s`} dur={`${DURATION}s`} fill="freeze" calcMode="paced"/>}
        </circle>)}
      </svg>
      <div className="sim-results">
        {outcomes.map(key => {
          const counts = view.counts[key];
          return <article key={key} className={`sim-result sim-${key}`} data-outcome={key}>
            <h3><span className="sim-chip">{key}</span>{t.names[key]}</h3>
            <div className="sim-card-body">
              <img className="sim-product-image" src={import.meta.env.BASE_URL + 'demo/everyday-mug.webp'} alt="" width="200" height="200"/>
              <div className="sim-product-info" aria-hidden="true">
                <h4>{t.productName}</h4><p>{t.price}</p>
                <span className={cn(buttonVariants({ variant: key === 'B' ? 'default' : 'outline' }), 'sim-buy')}>
                  {t.buy}{counts.lastClick > 0 && <span key={counts.lastClick} className="sim-flash"/>}
                </span>
              </div>
              <dl className="sim-rate">
                <div className="sim-rate-counts"><dt>{t.exposures}</dt><dd>{number(counts.exposures)}</dd><dt>{t.clicks}</dt><dd>{number(counts.clicks)}</dd></div>
                <div><dt className="sim-rate-label">{t.rateLabel}</dt><dd className="sim-rate-value">{counts.exposures ? percent(counts.clicks / counts.exposures) : '—'}</dd></div>
              </dl>
            </div>
          </article>;
        })}
      </div>
      <div className={`sim-summary${phase === 'done' ? ' is-verdict' : ''}`} role="status">
        {phase === 'done' ? <>
          <div className="sim-verdict-head">
            <span className="sim-diff">{result.diff >= 0 ? 'B' : 'A'} +{number(Math.abs(result.diff) * 100)}%p</span>
            <div><strong>{t.verdictTitle(result.decisive)}</strong><span className="sim-badge">{t.simulation}</span>
              <p className="sim-verdict-text">{t.verdict(result)}</p></div>
          </div>
          <p className="sim-verdict-numbers">A {A.clicks}/{A.exposures} ({percent(result.rateA)}) · B {B.clicks}/{B.exposures} ({percent(result.rateB)})</p>
          <p className="sim-footnote">{t.footnote(VISITORS)}</p>
          <Button variant="outline" className="sim-ratio-toggle" aria-expanded={ratioOpen} aria-controls={`${id}-ratio-panel`} onClick={() => setRatioOpen(open => !open)}><SlidersHorizontal aria-hidden="true"/>{t.ratioToggle}</Button>
        </> : <><strong className="sim-formula">{t.formula}</strong><p className="sim-footnote">{t.formulaNote}</p></>}
      </div>
      {phase === 'done' && <p className="sim-outro">
        <img src={import.meta.env.BASE_URL + 'brand/iterglow-logo' + (theme === 'dark' ? '-dark' : '') + '.svg'} alt="Iterglow" width="120" height="20"/>
        <span>{t.outro}</span>
      </p>}
      {ratioOpen && <div className="sim-controls" id={`${id}-ratio-panel`}>
        <div className="sim-slider">
          <label htmlFor={`${id}-ratio`}>{t.ratio}<output>A {aShare} : B {100 - aShare}</output></label>
          <div className="sim-ratio-line"><input id={`${id}-ratio`} type="range" min="0" max="100" step="1" value={aShare} aria-valuetext={`A ${aShare}%, B ${100 - aShare}%`} onChange={event => changeRatio(Number(event.target.value))}/>
          <div role="group" aria-label={t.presets} className="sim-presets">
            {[50, 80].map(value => <Button key={value} variant="outline" aria-pressed={aShare === value} onClick={() => changeRatio(value)}>{value}:{100 - value}</Button>)}
          </div></div>
        </div>
      </div>}
    </div>
  </section>;
}
