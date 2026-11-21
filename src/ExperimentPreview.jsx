import React, { useEffect, useId, useRef, useState } from 'react';
import { Check, Pause, Play, RotateCcw, ShoppingCart } from 'lucide-react';
import { Button } from './components/ui/button';
import { assignVisitor } from './assignmentSimulation';

const DURATION = 0.8;
const INTERVAL = 0.05;
const outcomes = ['A', 'B'];
const copy = {
  ko: {
    title: 'A/B 테스트 체험하기',
    intro: '같은 할인, 다른 표현. ‘20% 할인’과 ‘4,000원 할인’ 중 어떤 문구가 더 구매하고 싶게 하나요?',
    ratio: 'A/B 배정 비율', presets: 'A:B 빠른 설정',
    start: '시작', pause: '일시정지', reset: '배정 초기화', restart: '다시 실행', resume: '계속하기',
    results: '배정 결과', shop: '데일리 스토어', productPage: '리빙 / 머그컵',
    completed: count => `${count}명 배정 완료`,
    incoming: '가상 방문자',
    names: { A: 'A · 비율로 표현', B: 'B · 금액으로 표현' },
    productName: '데일리 세라믹 머그', originalPrice: '20,000원', price: '16,000원',
    originalPriceLabel: '정가', priceLabel: '할인가', discounts: { A: '20%', B: '4,000원' }, discount: '할인',
    purchased: '구매 완료', buy: '구매하기',
    people: '명', observed: '실제',
    noData: '배정 전', generated: '입장', moving: '이동 중',
    reduced: '모션 감소 설정: 이동 애니메이션 대신 배정 수만 갱신합니다.',
    chartTitle: '사용자 배정 흐름', chartDescription: '가상 방문자가 설정 비율에 따라 A 또는 B 화면으로 이동합니다. 아래 수치는 각 화면에 도착한 누적 배정입니다.',
  },
  en: {
    title: 'Try A/B testing',
    intro: 'Same discount, different wording. Which makes you want to buy: “20% off” or “₩4,000 off”?',
    ratio: 'A/B assignment ratio', presets: 'Quick A:B settings',
    start: 'Start', pause: 'Pause', reset: 'Reset assignments', restart: 'Run again', resume: 'Resume',
    results: 'Assignment results', shop: 'Daily Store', productPage: 'Living / Mugs',
    completed: count => `${count} visitors assigned`,
    incoming: 'Virtual visitors',
    names: { A: 'A · Percentage', B: 'B · Amount' },
    productName: 'Everyday ceramic mug', originalPrice: '₩20,000', price: '₩16,000',
    originalPriceLabel: 'Original price', priceLabel: 'Sale price', discounts: { A: '20%', B: '₩4,000' }, discount: 'off',
    purchased: 'Purchase complete', buy: 'Buy',
    people: 'visitors', observed: 'Actual',
    noData: 'No arrivals', generated: 'Entered', moving: 'In transit',
    reduced: 'Reduced motion: counts update without traveling animations.',
    chartTitle: 'Visitor assignment flow', chartDescription: 'Virtual visitors take the A or B path according to the selected ratio. Counts show cumulative arrivals on each page.',
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

const emptyView = () => ({ tokens: [], counts: { A: 0, B: 0 }, entered: 0 });

export default function ExperimentPreview({ lang }) {
  const t = copy[lang];
  const id = useId();
  const compact = useMediaPreference('(max-width: 700px)');
  const reduced = useMediaPreference('(prefers-reduced-motion: reduce)');
  const [aShare, setAShare] = useState(() => 20 + Math.floor(Math.random() * 61));
  const [visitorLimit, setVisitorLimit] = useState(() => 100 + Math.floor(Math.random() * 101));
  const settings = useRef({ aShare, visitorLimit });
  settings.current = { aShare, visitorLimit };
  const [running, setRunning] = useState(false);
  const [view, setView] = useState(emptyView);
  const [purchased, setPurchased] = useState({ A: false, B: false });
  const model = useRef({ assignments: new Map(), tokens: [], sequence: 0, lastSpawn: -Infinity, counts: { A: 0, B: 0 } });
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
      setView({ tokens: [...state.tokens], counts: { ...state.counts }, entered: state.sequence });
    };
    const arrive = token => {
      const state = model.current;
      state.counts[token.outcome] += 1;
    };
    function tick() {
      if (disposed || !running || document.hidden || clock.animationsPaused()) return;
      const now = clock.getCurrentTime();
      const state = model.current;
      const arrived = state.tokens.filter(token => reduced || now - token.started >= DURATION);
      arrived.forEach(arrive);
      state.tokens = state.tokens.filter(token => !arrived.includes(token));
      const spawn = state.sequence < settings.current.visitorLimit && now - state.lastSpawn >= INTERVAL;
      if (spawn) {
        const visitor = `U-${String(++state.sequence).padStart(4, '0')}`;
        const { aShare: share } = settings.current;
        const token = { id: visitor, outcome: assignVisitor(state.assignments, visitor, 100, share), started: now };
        state.lastSpawn = now;
        if (reduced) arrive(token); else state.tokens.push(token);
      }
      if (spawn || arrived.length) publish();
      if (state.sequence === settings.current.visitorLimit && state.tokens.length === 0) {
        clock.pauseAnimations();
        setRunning(false);
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
  }, [running, reduced]);

  function reset() {
    setRunning(false);
    svg.current.pauseAnimations();
    svg.current.setCurrentTime(0);
    model.current = { assignments: new Map(), tokens: [], sequence: 0, lastSpawn: -Infinity, counts: { A: 0, B: 0 } };
    setView(emptyView());
    setVisitorLimit(100 + Math.floor(Math.random() * 101));
    setPurchased({ A: false, B: false });
  }

  function changeRatio(value) {
    if (settings.current.aShare === value) return;
    if (completed) reset();
    setAShare(value);
  }

  function togglePlayback() {
    if (completed) {
      reset();
      setRunning(true);
    } else {
      if (running) svg.current.pauseAnimations();
      setRunning(value => !value);
    }
  }

  const center = chartWidth / 2;
  const left = chartWidth / 4;
  const right = chartWidth * 3 / 4;
  const bottom = compact ? 64 : 82;
  const paths = {
    A: `M${center} 8 V28 C${center} 52 ${left} 38 ${left} ${bottom}`,
    B: `M${center} 8 V28 C${center} 52 ${right} 38 ${right} ${bottom}`,
  };
  const number = value => new Intl.NumberFormat(lang, { maximumFractionDigits: 2 }).format(value);
  const total = outcomes.reduce((sum, key) => sum + view.counts[key], 0);
  const completed = view.entered === visitorLimit && view.tokens.length === 0;

  return <section id="experiment-preview" tabIndex={-1} className="assignment-demo">
    <div className="wrap">
      <h2>{t.title}</h2><p className="sim-intro">{t.intro}</p>
      <div className="sim-controls">
        <div className="sim-slider">
          <label htmlFor={`${id}-ratio`}>{t.ratio}<output>A {aShare} : B {100 - aShare}</output></label>
          <div className="sim-ratio-line"><input id={`${id}-ratio`} type="range" min="0" max="100" step="1" value={aShare} aria-valuetext={`A ${aShare}%, B ${100 - aShare}%`} onChange={event => changeRatio(Number(event.target.value))}/>
          <div role="group" aria-label={t.presets} className="sim-presets">
            {[50, 80].map(value => <Button key={value} variant="outline" aria-pressed={aShare === value} onClick={() => changeRatio(value)}>{value}:{100 - value}</Button>)}
          </div></div>
        </div>
      </div>
      <div className="sim-playback">
        <div className="sim-playback-actions">
          <Button onClick={togglePlayback}>{running ? <Pause aria-hidden="true"/> : <Play aria-hidden="true"/>}{running ? t.pause : completed ? t.restart : view.entered ? t.resume : t.start}</Button>
        </div>
        <div className="sim-progress">{completed ? <span role="status"><Check size={15} aria-hidden="true"/>{t.completed(number(total))}</span> : <span>{t.generated} {number(view.entered)} / {number(visitorLimit)} · {t.moving} {number(view.tokens.length)}</span>}</div>
      </div>
      {reduced && <p className="sim-reduced">{t.reduced}</p>}
      <svg ref={svg} className="sim-flow" viewBox={`0 0 ${chartWidth} ${bottom + 22}`} role="img" aria-labelledby={`${id}-title ${id}-description`}>
        <title id={`${id}-title`}>{t.chartTitle}</title><desc id={`${id}-description`}>{t.chartDescription}</desc>
        <text x={center - 12} y="16" textAnchor="end" className="sim-incoming">{t.incoming}</text>
        {outcomes.map(key => <path key={key} d={paths[key]} className={`sim-path sim-${key}`}/>)}
        {outcomes.map((key, index) => <text key={key} x={[left, right][index]} y={bottom + 18} textAnchor="middle" className={`sim-endpoint sim-${key}`}>{key}</text>)}
        {view.tokens.map(token => <circle key={token.id} r={compact ? 4 : 6} cx={reduced ? { A: left, B: right }[token.outcome] : undefined} cy={reduced ? bottom - 12 : undefined} className={`sim-dot sim-${token.outcome}`} data-visitor={token.id} data-outcome={token.outcome}>
          {!reduced && <animateMotion path={paths[token.outcome]} begin={`${token.started}s`} dur={`${DURATION}s`} fill="freeze" calcMode="paced"/>}
        </circle>)}
      </svg>
      <div className="sim-result-actions"><strong>{t.results}</strong><Button variant="outline" onClick={reset}><RotateCcw aria-hidden="true"/>{t.reset}</Button></div>
      <div className="sim-results">
        {outcomes.map(key => <article key={key} className={`sim-result sim-${key}`} data-outcome={key}>
          <div className="sim-assignment-summary">
            <h3>{t.names[key]}</h3>
            <p className="sim-count"><strong>{number(view.counts[key])}</strong> {t.people}</p>
          </div>
          <p className="sim-observed">{total ? `${t.observed} ${number(view.counts[key] / total * 100)}%` : t.noData}</p>
          <div className="sim-shop">
            <div className="sim-shop-header"><strong>{t.shop}</strong><ShoppingCart size={17} aria-hidden="true"/></div>
            <div className="sim-shop-content">
              <p className="sim-breadcrumb">{t.productPage}</p>
              <img className="sim-product-image" src={import.meta.env.BASE_URL + 'demo/everyday-mug.webp'} alt="" width="200" height="200"/>
              <div className="sim-product-info">
                <h4>{t.productName}</h4>
                <p className="sim-discount"><strong>{t.discounts[key]}</strong>{' '}<span>{t.discount}</span></p>
                <p className="sim-prices"><s><span className="sr-only">{t.originalPriceLabel} </span>{t.originalPrice}</s>{' '}<strong><span className="sr-only">{t.priceLabel} </span>{t.price}</strong></p>
              </div>
              <Button className="sim-buy" aria-disabled={purchased[key]} onClick={() => { if (!purchased[key]) setPurchased(current => ({ ...current, [key]: true })); }} aria-label={`${t.names[key]} ${purchased[key] ? t.purchased : t.buy}`}>
                {purchased[key] ? <Check aria-hidden="true"/> : <ShoppingCart aria-hidden="true"/>}{purchased[key] ? t.purchased : t.buy}
              </Button>
            </div>
          </div>
        </article>)}
      </div>
    </div>
  </section>;
}
