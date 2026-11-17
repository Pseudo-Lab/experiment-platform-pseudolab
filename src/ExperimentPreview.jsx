import React, { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Button } from './components/ui/button';

const copy = {
  ko: {
    title: '작은 화면으로 실험해 보기',
    intro: '화면 전체를 바꾸지 않고도 한 요소를 다르게 보여줄 수 있습니다. 아래 예시 설정을 바꿔 버튼 문구의 차이를 살펴보세요.',
    settings: '미리보기 설정', options: ['A 설정', 'B 설정'],
    current: ['A 설정을 미리보고 있습니다.', 'B 설정을 미리보고 있습니다.'],
    sampleTitle: '실험을 만드는 오픈소스, Iterglow',
    sampleText: '실험을 설계하고 사용자 행동을 측정해 결과를 비교하는 플랫폼을 함께 만듭니다.',
    buttons: ['GitHub에서 보기', 'Iterglow 코드 살펴보기'],
    note: '문구는 체험용 예시입니다. 실제 실험 설정과 연결되지 않으며 배정·클릭을 수집하지 않습니다.',
    support: '버튼은 GitHub 저장소를 새 탭으로 엽니다. 프로젝트가 유용하다면 Star로 응원해 주세요. Star는 선택이며, 이동 클릭을 실제 Star로 집계하지 않습니다.',
  },
  en: {
    title: 'Try an experiment on a small part of the page',
    intro: 'An experiment can change a single element while keeping the rest of the page the same. Switch the example setting below to compare button labels.',
    settings: 'Preview setting', options: ['Setting A', 'Setting B'],
    current: ['Previewing setting A.', 'Previewing setting B.'],
    sampleTitle: 'Iterglow, open source for experimentation',
    sampleText: 'We build a platform for designing experiments, measuring user behavior, and comparing results.',
    buttons: ['View on GitHub', 'Explore the Iterglow code'],
    note: 'These labels are examples. This preview is not connected to real experiment settings and does not collect assignments or clicks.',
    support: 'The button opens the GitHub repository in a new tab. If you find the project useful, support it with a Star. Starring is optional; a click is not counted as an actual Star.',
  },
};

export default function ExperimentPreview({ lang, repo }) {
  const [setting, setSetting] = useState(0);
  const t = copy[lang];

  return <section id="experiment-preview" tabIndex={-1} className="experiment-preview-section">
    <div className="wrap experiment-preview-layout">
      <div className="experiment-preview-copy">
        <h2>{t.title}</h2><p>{t.intro}</p>
        <div className="experiment-preview-settings" role="group" aria-label={t.settings}>
          {t.options.map((label, index) => <Button key={index} variant={setting === index ? 'default' : 'outline'} aria-pressed={setting === index} onClick={() => setSetting(index)}>{label}</Button>)}
        </div>
        <p className="experiment-preview-current" role="status">{t.current[setting]}</p>
        <p className="experiment-preview-note">{t.note}</p>
      </div>
      <div className="experiment-preview-sample">
        <h3>{t.sampleTitle}</h3><p>{t.sampleText}</p>
        <Button asChild size="lg"><a href={repo} target="_blank" rel="noreferrer">{t.buttons[setting]}<ArrowUpRight size={16} aria-hidden="true"/></a></Button>
        <p className="experiment-preview-support">{t.support}</p>
      </div>
    </div>
  </section>;
}
