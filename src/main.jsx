import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowUpRight, ArrowRight, FlaskConical, Github, Menu, X, Plus, Minus, Code2, BookOpen, Compass } from 'lucide-react';
import { Button } from './components/ui/button';
import './style.css';

const urls = {
  repo: 'https://github.com/Pseudo-Lab/experiment-platform-pseudolab',
  service: 'https://exp.pseudolab-devfactory.com/',
  blog: 'https://www.pseudo-lab.com/projects/531b281c-32f8-4477-8e0e-ab5d3e51143c?tab=resources',
  org: 'https://www.pseudo-lab.com/',
  signup: 'https://docs.google.com/forms/d/e/1FAIpQLSerR1rw8fyUqiVQHZkrugJN-iMh9a2AA1aT69imKq2yDqbPKw/viewform?usp=dialog',
};
const copy = {
  ko: {
    name: '실험플랫폼 팀', nav: ['진행 소식', '팀 소개', '프로젝트와 기록'],
    skip: '본문으로 이동', menu: '메뉴 열기', close: '메뉴 닫기', language: 'Switch to English',
    eyebrow: '가짜연구소 · EXPERIMENT PLATFORM TEAM',
    title: <>실험플랫폼을 만드는<br/><span>과정과 배움을 기록합니다.</span></>,
    intro: '개발하고, 함께 공부하고, 실제 서비스에 적용하며 배웁니다. 가짜연구소 실험플랫폼 팀의 활동과 진행 소식을 모았습니다.',
    explore: '진행 소식 살펴보기', service: '플랫폼 바로가기',
    note: '제품 소개와 사용은 ExperiBase에서 확인하세요.',
    boardTitle: '지금 우리가 향하는 곳', season: '13기 활동',
    boardItems: [['BUILD', '실험을 위한 기반 만들기', '실험 관리 · SDK/API · 계측'], ['LEARN', '실제 서비스에서 배우기', '개발과 분석을 연결하는 과정'], ['NEXT', '하나의 실험 사이클 완성하기', '기능 개선 → 실험 → 분석과 결정']],
    boardNote: '현재 활동 방향과 목표',
    strip: ['개발 과정', '함께하는 스터디', '실제 적용과 배움'],
    updatesTag: '01 / TEAM LOG', updatesTitle: '무엇을 하고 있나요?',
    updatesIntro: '만들어온 것, 적용하며 배운 것, 다음으로 확인할 것을 구분해 전합니다.',
    updates: [
      ['개발', '만들어온 기반', '실험 관리부터 SDK·API 연동까지', '실험 관리, 사용자별 버전 배정, Feature Flag, 대상 설정, 행동 수집과 결과 확인 기능을 개발해 왔습니다. 실험을 관리하는 화면도 개선하고 있습니다. 기능의 사용 방법은 ExperiBase에서, 구현과 변경 이력은 GitHub에서 확인할 수 있습니다.'],
      ['적용', '실제 서비스에서의 경험', '가짜연구소 홈페이지의 12기 회고에 적용했습니다', '가짜연구소 홈페이지의 12기 회고 진입 화면에 플랫폼을 연결하고, 노출부터 클릭과 제출까지 측정하는 흐름을 검증했습니다. 무작위 대조군이 없는 준실험으로, 기능의 개선 효과를 입증한 사례는 아닙니다. 서비스 연동과 이벤트 정의, 데이터 해석 과정에서 얻은 경험을 다음 실험의 기반으로 삼고 있습니다.'],
      ['다음 단계', '스터디와 13기 목표', '만드는 것에서 실험하고 판단하는 것까지', '13기에는 기능 개선부터 실제 사용자 대상 실험, 결과 분석과 후속 결정까지 한 사이클을 경험하는 것이 목표입니다. 무엇을 실험하고 어떤 지표로 확인할지 함께 검토하며, 사용·연동 가이드와 재사용할 수 있는 배움을 남기려 합니다.'],
    ],
    teamTag: '02 / ABOUT THE TEAM', teamTitle: <>개발과 실험을 연결하며,<br/>함께 배웁니다.</>,
    teamText: '우리는 가짜연구소에서 실제 서비스의 문제를 발견하고, 개선안을 만들며, 데이터를 통해 결과를 살펴보는 팀입니다. 이 과정을 지원하는 오픈소스 실험플랫폼 ExperiBase를 개발하고 있습니다.',
    teamFoot: '이곳에는 팀의 활동과 짧은 진행 소식을 모읍니다. 자세한 기술 글은 팀 블로그로, 소스 코드와 변경 이력은 GitHub로 연결합니다.',
    teamTopics: ['개발과 운영', '실험 설계와 분석', '스터디와 경험 공유'],
    linksTag: '03 / EXPLORE MORE', linksTitle: '프로젝트와 기록을 찾아보세요.',
    linksIntro: '제품 사용부터 자세한 기술 이야기까지, 필요한 곳으로 바로 연결합니다.',
    resources: [
      ['ExperiBase', '서비스', '제품을 살펴보고 실험을 운영하는 공간입니다.', '플랫폼 바로가기', 'service'],
      ['GitHub', '코드와 변경 이력', '구현 내용과 개발 진행 상황을 저장소에서 확인하세요.', '저장소 살펴보기', 'repo'],
      ['팀 블로그', '기술 글과 경험', '팀의 글과 자료를 모아둔 블로그입니다.', '블로그 둘러보기', 'blog'],
    ],
    stayTitle: <>소식을 받아보고,<br/>함께할 뜻도 남겨주세요.</>,
    stayText: '개발 소식을 받아보거나, 기여할 수 있는 부분이 있다면 함께하고 싶은 뜻을 남겨주세요.',
    stayCta: '소식·기여 관심 등록하기', stayNote: '구글폼에서 소식 받기와 기여 의향 중 원하는 방식을 선택할 수 있습니다.',
    footer: '가짜연구소 실험플랫폼 팀의 활동 기록', org: '가짜연구소', footerNote: 'BUILD TOGETHER · LEARN TOGETHER',
  },
  en: {
    name: 'Experiment Platform Team', nav: ['Updates', 'Our team', 'Project & resources'],
    skip: 'Skip to content', menu: 'Open menu', close: 'Close menu', language: '한국어로 전환',
    eyebrow: 'PSEUDOLAB · EXPERIMENT PLATFORM TEAM',
    title: <>Building a platform.<br/><span>Sharing the journey.</span></>,
    intro: 'We build, study together, and learn from real services. Follow the work and progress of PseudoLab’s Experiment Platform Team.',
    explore: 'Explore our updates', service: 'Open the platform',
    note: 'Visit ExperiBase for product information and use.',
    boardTitle: 'What we are working toward', season: 'Season 13',
    boardItems: [['BUILD', 'Build the foundations', 'Experiment management · SDK/API · measurement'], ['LEARN', 'Learn from real services', 'Connect development and analysis'], ['NEXT', 'Complete an experiment cycle', 'Improve → experiment → analyze and decide']],
    boardNote: 'Our current direction and goals',
    strip: ['Development journey', 'Learning together', 'Lessons from practice'],
    updatesTag: '01 / TEAM LOG', updatesTitle: 'What have we been working on?',
    updatesIntro: 'Separating what we have built, what we have learned, and what we aim to explore next.',
    updates: [
      ['Build', 'The foundations', 'From experiment management to SDK integration', 'We have developed experiment management, consistent assignment, feature flags, targeting, event collection, and result views. We are also improving the management interface. Visit ExperiBase for product use and GitHub for the implementation and change history.'],
      ['Apply', 'Experience from a real service', 'Applying the platform to Season 12 reflections on the PseudoLab website', 'We integrated the platform with the Season 12 reflection entry UI on the PseudoLab website and validated a measurement flow from exposure to click to submission. This was a quasi-experiment without a randomized control group, rather than proof of an improvement caused by the feature. The experience informs our next experiments.'],
      ['Up next', 'Learning and our Season 13 goal', 'From building to experimenting and deciding', 'Our Season 13 goal is a complete cycle: improve a feature, run a real-user experiment, analyze the results, and decide what follows. We review experiment questions and metrics together and aim to document reusable lessons and integration guidance.'],
    ],
    teamTag: '02 / ABOUT THE TEAM', teamTitle: <>Connecting development<br/>and experimentation.</>,
    teamText: 'At PseudoLab, we find problems in real services, build improvements, and examine outcomes through data. We are developing ExperiBase, an open-source experimentation platform that supports this process.',
    teamFoot: 'This page brings together short updates and team activities. Detailed technical writing belongs on the team blog; source code and change history live on GitHub.',
    teamTopics: ['Development & operations', 'Experiment design & analysis', 'Study & shared experience'],
    linksTag: '03 / EXPLORE MORE', linksTitle: 'Explore the project and its resources.',
    linksIntro: 'Find the product, source code, and longer technical stories in their own spaces.',
    resources: [
      ['ExperiBase', 'The service', 'Explore the product and manage experiments.', 'Open the platform', 'service'],
      ['GitHub', 'Code & change history', 'Explore the implementation and development progress.', 'Explore the repository', 'repo'],
      ['Team Blog', 'Technical writing & experience', 'Our team’s blog, bringing together articles and resources.', 'Explore the blog', 'blog'],
    ],
    stayTitle: <>Follow our progress.<br/>Explore ways to contribute.</>,
    stayText: 'Receive project news, or let us know you would like to contribute when an opportunity fits.',
    stayCta: 'Updates & contribution interest', stayNote: 'Choose updates or interest in contributing in the Google Form.',
    footer: 'Notes from PseudoLab’s Experiment Platform Team', org: 'PseudoLab', footerNote: 'BUILD TOGETHER · LEARN TOGETHER',
  },
};

function App() {
  const [lang, setLang] = useState('ko');
  const [menu, setMenu] = useState(false);
  const [opened, setOpened] = useState(0);
  const t = copy[lang];
  const ids = ['updates', 'team', 'resources'];
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = lang === 'ko' ? '활동과 소식 | 가짜연구소 실험플랫폼 팀' : 'Team Log | PseudoLab Experiment Platform Team';
    document.querySelector('meta[name="description"]').content = t.intro;
  }, [lang, t]);
  return <>
    <a className="skip" href="#main">{t.skip}</a>
    <header><div className="nav wrap">
      <a href="#" className="brand"><span className="brand-symbol"><FlaskConical size={22}/></span><span><b>PseudoLab<span className="brand-dot">.</span></b><small>{t.name}</small></span></a>
      <nav aria-label={lang === 'ko' ? '주 메뉴' : 'Main navigation'} className={menu ? 'is-open' : ''}>
        {ids.map((id, i) => <a key={id} href={'#' + id} onClick={() => setMenu(false)}>{t.nav[i]}</a>)}
      </nav>
      <div className="nav-actions">
        <Button variant="ghost" size="sm" aria-label={t.language} onClick={() => setLang(lang === 'ko' ? 'en' : 'ko')}>{lang === 'ko' ? 'EN' : 'KO'}</Button>
        <Button asChild variant="outline" className="github-button"><a href={urls.repo} target="_blank" rel="noreferrer"><Github size={16}/>GitHub<ArrowUpRight size={14}/></a></Button>
        <Button variant="ghost" size="icon" className="menu-button" aria-expanded={menu} aria-label={menu ? t.close : t.menu} onClick={() => setMenu(!menu)}>{menu ? <X/> : <Menu/>}</Button>
      </div>
    </div></header>
    <main id="main">
      <section className="hero wrap activity-hero">
        <div className="hero-copy">
          <div className="eyebrow"><span className="status-dot"/>{t.eyebrow}</div>
          <h1>{t.title}</h1><p>{t.intro}</p>
          <div className="hero-actions"><Button asChild size="lg"><a href={urls.service} target="_blank" rel="noreferrer">{t.service}<ArrowUpRight size={17}/></a></Button><Button asChild size="lg" variant="outline"><a href="#updates">{t.explore}<ArrowRight size={17}/></a></Button></div>
          <div className="hero-note">{t.note}</div>
        </div>
        <aside className="activity-board" aria-label={t.boardTitle}>
          <div className="board-top"><span>FIELD NOTES / 013</span><span className="board-season">{t.season}</span></div>
          <h2>{t.boardTitle}</h2>
          <div className="board-items">{t.boardItems.map(([tag, title, desc], i) => <div className="board-item" key={tag}><span className="board-number">0{i + 1}</span><div><small>{tag}</small><h3>{title}</h3><p>{desc}</p></div></div>)}</div>
          <div className="board-foot"><span className="status-dot"/>{t.boardNote}<span aria-hidden="true">↗</span></div>
        </aside>
      </section>
      <div className="principles"><div className="wrap">{t.strip.map((s, i) => <div key={s}><span>0{i + 1}</span>{s}{i < 2 && <ArrowUpRight size={20}/>}</div>)}</div></div>
      <section id="updates" className="updates section"><div className="wrap">
        <div className="section-top"><div><p className="eyebrow">{t.updatesTag}</p><h2>{t.updatesTitle}</h2></div><p className="section-description">{t.updatesIntro}</p></div>
        <div className="update-list">{t.updates.map(([tag, sub, title, body], i) => <article className={opened === i ? 'expanded' : ''} key={tag}>
          <Button variant="ghost" className="update-toggle" aria-expanded={opened === i} aria-controls={'update-' + i} onClick={() => setOpened(opened === i ? null : i)}><span className={'update-tag tag-' + i}>{tag}</span><span className="update-title"><small>{sub}</small><strong>{title}</strong></span><span className="update-indicator">{opened === i ? <Minus size={20}/> : <Plus size={20}/>}</span></Button>
          <div id={'update-' + i} hidden={opened !== i} className="update-body"><p>{body}</p></div>
        </article>)}</div>
      </div></section>
      <section id="team" className="section wrap compact-team">
        <div><p className="eyebrow">{t.teamTag}</p><h2>{t.teamTitle}</h2></div>
        <div className="team-story"><p>{t.teamText}</p><p>{t.teamFoot}</p><div className="team-topics">{t.teamTopics.map(s => <span key={s}>{s}</span>)}</div></div>
      </section>
      <section id="resources" className="resources-section"><div className="wrap">
        <p className="eyebrow">{t.linksTag}</p><h2>{t.linksTitle}</h2><p className="resource-intro">{t.linksIntro}</p>
        <div className="resource-grid">{t.resources.map(([title, label, text, action, key], i) => { const Icon = [Compass, Code2, BookOpen][i]; return <article key={key}><div className="resource-top"><Icon size={24}/><span>{label}</span></div><h3>{title}</h3><p>{text}</p><a className="text-link" href={urls[key]} target="_blank" rel="noreferrer">{action}<ArrowUpRight size={17}/></a></article>; })}</div>
      </div></section>
      <section id="subscribe" className="stay wrap"><div className="stay-decor" aria-hidden="true">✳</div><div><p className="eyebrow">KEEP IN THE LOOP</p><h2>{t.stayTitle}</h2><p>{t.stayText}</p></div>
        <div className="stay-action"><div className="stay-buttons"><Button asChild size="lg"><a href={urls.signup} target="_blank" rel="noreferrer">{t.stayCta}<ArrowUpRight size={17}/></a></Button><Button asChild size="lg" variant="outline"><a href={urls.repo} target="_blank" rel="noreferrer"><Github size={18}/>GitHub<ArrowUpRight size={17}/></a></Button></div><small>{t.stayNote}</small></div>
      </section>
    </main>
    <footer className="wrap"><div><a className="footer-brand" href={urls.org} target="_blank" rel="noreferrer">PseudoLab<span>.</span><ArrowUpRight size={16}/></a><p>{t.footer}</p></div><div className="footer-right"><div><a href={urls.service} target="_blank" rel="noreferrer">ExperiBase ↗</a><a href={urls.repo} target="_blank" rel="noreferrer">GitHub ↗</a><a href={urls.blog} target="_blank" rel="noreferrer">{lang === 'ko' ? '팀 블로그' : 'Team Blog'} ↗</a><a href={urls.org} target="_blank" rel="noreferrer">{t.org} ↗</a></div><small>{t.footerNote}</small></div></footer>
  </>;
}
createRoot(document.getElementById('root')).render(<App/>);
