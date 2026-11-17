import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, CircleAlert, Github, RotateCcw } from 'lucide-react';
import { Button } from './components/ui/button';

const copy = {
  ko: {
    back: '팀 소개로 돌아가기', title: '버튼 한 번으로, A/B 테스트를 경험해 보세요.',
    intro: '서로 다른 버튼 문구를 보여주고, 행동이 어떻게 결과로 이어지는지 살펴봅니다.',
    preview: '브라우저에서만 동작하는 체험 예시입니다. 입력이나 클릭을 서버로 전송하지 않으며, 다른 관객의 데이터는 포함하지 않습니다. 새로고침하거나 팀 소개로 돌아가면 초기화됩니다.',
    steps: ['A/B 화면 체험', '결과 확인 · 선택 응원'],
    readyTitle: '어떤 문구를 만나게 될까요?',
    readyText: '시작하면 A 또는 B 중 하나가 무작위로 표시됩니다. 화면은 같고 버튼 문구만 다릅니다.',
    start: '체험 시작하기', screen: '체험 화면',
    hypothesis: '가설: 구체적인 행동을 안내하는 버튼 문구가 클릭으로 더 잘 이어질까요?',
    cardTitle: '아이디어를 실험으로 바꾸세요.',
    cardText: 'Iterglow는 실험을 설계하고 사용자 행동을 측정해 결과를 비교하는 오픈소스 플랫폼입니다.',
    buttons: { A: '더 알아보기', B: 'SDK로 첫 실험 시작하기' },
    buttonNote: '예시 버튼입니다. 누르면 클릭 1회를 반영하고 결과로 이동합니다.',
    skip: '누르지 않고 결과 확인',
    resultTitle: '방금 한 행동이 이렇게 연결됩니다.',
    resultText: '이번 체험에서 본 화면을 노출 1회로, 예시 버튼을 누른 행동을 클릭 1회로 표시합니다.',
    variant: '화면', exposure: '노출', clicks: '클릭', rate: '클릭률',
    caption: '이번 체험만의 예시 · 클릭률 = 클릭 ÷ 노출',
    noExposure: '미노출', noData: '아직 체험 결과가 없습니다. 시작하면 내 화면의 노출과 클릭을 확인할 수 있습니다.',
    caution: '한 번의 체험으로 더 좋은 문구를 판단할 수 없습니다. 실제 비교에는 충분한 표본과 사전에 정한 실험 기준이 필요합니다.',
    aggregateTitle: '전체 관객의 결과는 아직 제공하지 않습니다.',
    aggregateText: '현재는 공개 집계가 연결되지 않은 미리보기입니다. 위 숫자는 실제 행사 참여자 수나 운영 실험 성과가 아닙니다.',
    starTitle: '이런 실험을 함께 만들고 싶다면',
    starText: 'GitHub에서 Iterglow의 코드와 SDK를 살펴보세요. 유용하다면 저장소의 Star로 프로젝트를 응원해 주세요.',
    star: 'GitHub에서 살펴보고 Star로 응원하기',
    starNote: 'Star는 선택입니다. 링크는 새 탭으로 열리며, GitHub 이동이나 클릭을 실제 Star로 집계하지 않습니다.',
    again: '처음부터 다시 체험', error: '체험 화면을 배정하지 못했습니다. 다시 시도해 주세요.', retry: '다시 시도',
  },
  en: {
    back: 'Back to the team', title: 'Experience an A/B test with a single click.',
    intro: 'See how different button labels turn a visitor’s action into an experiment result.',
    preview: 'This example runs only in your browser. No input or clicks are sent to a server, and no other visitors’ data is included. Reloading or returning to the team page resets it.',
    steps: ['Try an A/B screen', 'Results & optional support'],
    readyTitle: 'Which button label will you see?',
    readyText: 'Start to see a randomly assigned A or B screen. Everything stays the same except the button label.',
    start: 'Start the experience', screen: 'Your example screen',
    hypothesis: 'Hypothesis: will a button describing a specific action lead to more clicks?',
    cardTitle: 'Turn your idea into an experiment.',
    cardText: 'Iterglow is an open-source platform for designing experiments, measuring user behavior, and comparing results.',
    buttons: { A: 'Learn more', B: 'Start your first experiment with the SDK' },
    buttonNote: 'This is an example button. Clicking it adds one click and opens your result.',
    skip: 'See the result without clicking',
    resultTitle: 'Here is how your action becomes a result.',
    resultText: 'Viewing a screen counts as one exposure in this example. Pressing the example button counts as one click.',
    variant: 'Screen', exposure: 'Exposures', clicks: 'Clicks', rate: 'Click rate',
    caption: 'This experience only · Click rate = clicks ÷ exposures',
    noExposure: 'Not shown', noData: 'No results yet. Start to see your screen’s exposure and clicks.',
    caution: 'One experience cannot tell us which label is better. A real comparison needs enough observations and experiment criteria defined in advance.',
    aggregateTitle: 'Audience-wide results are not available yet.',
    aggregateText: 'This preview is not connected to public aggregation. The numbers above are not event attendance or production experiment results.',
    starTitle: 'Help us build more experiments like this.',
    starText: 'Explore Iterglow’s code and SDK on GitHub. If you find the project useful, support it with a Star on the repository.',
    star: 'Explore and support with a Star on GitHub',
    starNote: 'Starring is optional. The link opens a new tab. A visit or click is not counted as an actual GitHub Star.',
    again: 'Try again from the start', error: 'We could not assign an example screen. Please try again.', retry: 'Try again',
  },
};

export default function EventExperience({ lang, repo, onBack }) {
  const t = copy[lang];
  const [variant, setVariant] = useState(null);
  const [step, setStep] = useState('ready');
  const [clicked, setClicked] = useState(false);
  const [error, setError] = useState(false);
  const heading = useRef(null);
  const previousStep = useRef(step);

  useEffect(() => {
    if (previousStep.current === step) return;
    previousStep.current = step;
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, [step]);

  function start() {
    try {
      const value = new Uint8Array(1);
      window.crypto.getRandomValues(value);
      setVariant(value[0] % 2 === 0 ? 'A' : 'B');
      setClicked(false);
      setError(false);
      setStep('screen');
    } catch {
      setError(true);
    }
  }

  function showResult(didClick) {
    setClicked(didClick);
    setStep('result');
  }

  return <div className="experience wrap">
    <a className="text-link experience-back" href={import.meta.env.BASE_URL} onClick={onBack}><ArrowLeft size={16} aria-hidden="true"/>{t.back}</a>
    <h1>{t.title}</h1>
    <p className="experience-intro">{t.intro}</p>
    <p className="experience-notice">{t.preview}</p>
    <ol className="experience-steps" aria-label={lang === 'ko' ? '체험 순서' : 'Experience steps'}>
      {t.steps.map((label, i) => <li key={label} aria-current={i === (step === 'result' ? 1 : 0) ? 'step' : undefined}><span aria-hidden="true">{i + 1}</span>{label}</li>)}
    </ol>

    {step === 'ready' && <section className="experience-stage" aria-labelledby="experience-stage-title">
      <h2 id="experience-stage-title" ref={heading} tabIndex={-1}>{t.readyTitle}</h2>
      <p>{t.readyText}</p>
      <p className="experience-hypothesis">{t.hypothesis}</p>
      {error && <p className="experience-error" role="alert"><CircleAlert size={20} aria-hidden="true"/>{t.error}</p>}
      <Button size="lg" onClick={start}>{error ? t.retry : t.start}<ArrowRight aria-hidden="true"/></Button>
      <p className="experience-empty">{t.noData}</p>
    </section>}

    {step === 'screen' && <section className="experience-stage" aria-labelledby="experience-stage-title">
      <h2 id="experience-stage-title" ref={heading} tabIndex={-1}>{t.screen} <span className="experience-variant">{variant}</span></h2>
      <p className="experience-hypothesis">{t.hypothesis}</p>
      <div className="experience-sample">
        <h3>{t.cardTitle}</h3><p>{t.cardText}</p>
        <Button size="lg" onClick={() => showResult(true)}>{t.buttons[variant]}<ArrowRight aria-hidden="true"/></Button>
        <p className="experience-small">{t.buttonNote}</p>
      </div>
      <Button variant="outline" onClick={() => showResult(false)}>{t.skip}</Button>
    </section>}

    {step === 'result' && <>
      <section className="experience-stage" aria-labelledby="experience-stage-title">
        <h2 id="experience-stage-title" ref={heading} tabIndex={-1}>{t.resultTitle}</h2>
        <p>{t.resultText}</p>
        <div className="experience-table-wrap"><table className="experience-table">
          <caption>{t.caption}</caption>
          <thead><tr><th scope="col">{t.variant}</th><th scope="col">{t.exposure}</th><th scope="col">{t.clicks}</th><th scope="col">{t.rate}</th></tr></thead>
          <tbody>{['A', 'B'].map(v => <tr key={v} className={v === variant ? 'is-assigned' : undefined}>
            <th scope="row">{v}<small>{t.buttons[v]}</small></th>
            <td>{v === variant ? 1 : 0}</td><td>{v === variant && clicked ? 1 : 0}</td>
            <td>{v === variant ? (clicked ? '100%' : '0%') : <span className="experience-small">{t.noExposure}</span>}</td>
          </tr>)}</tbody>
        </table></div>
        <p className="experience-caution">{t.caution}</p>
        <div className="experience-aggregate"><h3>{t.aggregateTitle}</h3><p>{t.aggregateText}</p></div>
      </section>
      <section className="experience-support" aria-labelledby="experience-support-title">
        <h2 id="experience-support-title">{t.starTitle}</h2><p>{t.starText}</p>
        <Button asChild size="lg"><a href={repo} target="_blank" rel="noreferrer"><Github aria-hidden="true"/>{t.star}<ArrowUpRight aria-hidden="true"/></a></Button>
        <p className="experience-small">{t.starNote}</p>
      </section>
      <Button variant="outline" onClick={() => { setStep('ready'); setVariant(null); setClicked(false); setError(false); }}><RotateCcw aria-hidden="true"/>{t.again}</Button>
    </>}
  </div>;
}
