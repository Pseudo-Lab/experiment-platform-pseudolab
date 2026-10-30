import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowUpRight, ArrowRight, Github, Menu, X, Plus, Minus, Code2, BookOpen, Compass, Sun, Moon } from 'lucide-react';
import { Button } from './components/ui/button';
import './style.css';

const urls = {
  repo: 'https://github.com/Pseudo-Lab/experiment-platform-pseudolab',
  service: 'https://exp.pseudolab-devfactory.com/',
  blog: 'https://www.pseudo-lab.com/projects/531b281c-32f8-4477-8e0e-ab5d3e51143c?tab=resources',
  org: 'https://www.pseudo-lab.com/',
  signup: 'https://docs.google.com/forms/d/e/1FAIpQLSerR1rw8fyUqiVQHZkrugJN-iMh9a2AA1aT69imKq2yDqbPKw/viewform?usp=dialog',
};
// Public profile photos/links with contribution descriptions confirmed by the user.
const members = [
  {
    "name": "김수현",
    "profile": "https://www.pseudo-lab.com/profile/3f4fbfee-21b9-4a93-a21d-61fd587ba450",
    "image": "https://zizxaljzqmfcwgjeiwvn.supabase.co/storage/v1/object/public/profiles/3f4fbfee-21b9-4a93-a21d-61fd587ba450/bad3826f-94bb-4895-94a7-0612702f18c5.jpg",
    "lead": true,
    "bio": {
      "ko": "실험플랫폼을 개발하고, 실제 서비스에 연결하는 과정을 조율해요.",
      "en": "I build the experiment platform and coordinate its integration with real services."
    }
  },
  {
    "name": "이동욱",
    "profile": "https://www.pseudo-lab.com/profile/230f3a47-cb3f-4ed7-8f7c-ef19f03ccce8",
    "image": "https://zizxaljzqmfcwgjeiwvn.supabase.co/storage/v1/object/public/profiles/230f3a47-cb3f-4ed7-8f7c-ef19f03ccce8/c2c48110-6c2c-4c96-b245-4212ddad0ab7.jpg",
    "lead": false,
    "bio": {
      "ko": "실험에 활용할 데이터를 연결하고, 데이터 기반 서비스 개발에 참여해요.",
      "en": "I connect data for experiments and contribute to data-driven services."
    }
  },
  {
    "name": "최지환",
    "profile": "https://www.pseudo-lab.com/profile/41b7b98e-2bc1-4c29-ba63-576aefddd4a4",
    "image": "https://zizxaljzqmfcwgjeiwvn.supabase.co/storage/v1/object/public/profiles/41b7b98e-2bc1-4c29-ba63-576aefddd4a4/98635ce4-eddc-4abf-9504-163d14fda97c.jpg",
    "lead": false,
    "bio": {
      "ko": "실험을 설계하고 분석하며, 검증할 기능 아이디어를 구체화해요.",
      "en": "I design and analyze experiments, turning feature ideas into testable plans."
    }
  },
  {
    "name": "신진수",
    "profile": "https://www.pseudo-lab.com/profile/a081b635-7321-42eb-9936-1bcf94f944f0",
    "image": "https://zizxaljzqmfcwgjeiwvn.supabase.co/storage/v1/object/public/profiles/a081b635-7321-42eb-9936-1bcf94f944f0/bc441c7a-b702-46ec-998a-28ad48e1b29d.jpg",
    "lead": false,
    "bio": {
      "ko": "서비스 개선에 필요한 지표를 정의하고, 실험 과정과 가이드를 정리해요.",
      "en": "I define metrics for service improvements and document experiment workflows."
    }
  }
];

const copy = {
  ko: {
    name: '실험플랫폼 팀', nav: ['진행 소식', '팀 소개', '프로젝트와 기록', '소식·기여'],
    lightMode: '라이트모드로 전환', darkMode: '다크모드로 전환',
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
    updatesIntro: '만들어온 것과 적용하며 배운 것, 다음으로 해볼 일을 나눠요.',
    updates: [
      ['개발', '만들어온 기반', '실험 관리부터 SDK·API 연동까지', '실험 관리부터 사용자별 버전 배정, Feature Flag, 행동 수집과 결과 확인까지 필요한 기능을 만들어 왔어요. 실험을 관리하는 화면도 다듬고 있어요. 사용 방법은 ExperiBase에서, 코드와 변경 이력은 GitHub에서 확인할 수 있어요.'],
      ['적용', '실제 서비스에서의 경험', '가짜연구소 홈페이지의 12기 회고 연동', '가짜연구소 홈페이지의 12기 회고 진입 화면에 플랫폼을 연결해, 노출부터 클릭과 제출까지 측정하는 흐름을 확인했어요. 무작위 대조군이 없는 준실험이라 기능의 개선 효과까지 입증한 사례는 아니에요. 서비스 연동과 이벤트 정의, 데이터 해석 과정에서 배운 점을 다음 실험으로 이어가고 있어요.'],
      ['다음 단계', '스터디와 13기 목표', '만드는 것에서 실험하고 판단하는 것까지', '13기에는 기능을 개선하고, 실제 사용자와 실험하고, 결과를 살펴 다음 결정을 내리는 과정을 함께 경험하려고 해요. 무엇을 실험하고 어떤 지표로 확인할지 검토하면서, 다음에도 활용할 수 있는 가이드와 배움을 남기는 게 목표예요.'],
    ],
    teamTag: '02 / ABOUT THE TEAM', teamTitle: <>개발과 실험을 연결하며,<br/>함께 배웁니다.</>,
    teamText: '우리는 가짜연구소에서 실제 서비스의 문제를 발견하고, 개선안을 만들며, 데이터를 통해 결과를 살펴보는 팀입니다. 이 과정을 지원하는 오픈소스 실험플랫폼 ExperiBase를 개발하고 있습니다.',
    teamFoot: '이곳에는 팀의 활동과 짧은 진행 소식을 모읍니다. 자세한 기술 글은 팀 블로그로, 소스 코드와 변경 이력은 GitHub로 연결합니다.',
    teamTopics: ['개발과 운영', '실험 설계와 분석', '스터디와 경험 공유'],
    membersTitle: '함께 만드는 사람들', membersIntro: '서로 다른 경험을 모아 실험플랫폼을 만들고 있어요.',
    lead: '프로젝트 리더', member: '팀원', profile: '프로필 보기',
    linksTag: '03 / EXPLORE MORE', linksTitle: '프로젝트와 기록을 찾아보세요.',
    linksIntro: '제품 사용부터 자세한 기술 이야기까지, 필요한 곳으로 바로 연결합니다.',
    resources: [
      ['ExperiBase', '서비스', '제품을 살펴보고 실험을 운영하는 공간입니다.', '플랫폼 바로가기', 'service'],
      ['GitHub', '코드와 변경 이력', '구현 내용과 개발 진행 상황을 저장소에서 확인하세요.', '저장소 살펴보기', 'repo'],
      ['팀 블로그', '기술 글과 경험', '팀의 글과 자료를 모아둔 블로그입니다.', '블로그 둘러보기', 'blog'],
    ],
    stayTitle: <>소식을 받아보고,<br/>함께할 뜻도 남겨주세요.</>,
    stayText: '프로젝트 소식을 받아보거나, 기여할 수 있는 부분이 있다면 함께하고 싶은 뜻을 남겨주세요.',
    stayCta: '소식·기여 관심 등록하기', stayNote: '구글폼에서 소식 받기와 기여 의향 중 원하는 방식을 선택할 수 있습니다.',
    footer: '가짜연구소 실험플랫폼 팀의 활동 기록', org: '가짜연구소', footerNote: 'BUILD TOGETHER · LEARN TOGETHER',
  },
  en: {
    name: 'Experiment Platform Team', nav: ['Updates', 'Our team', 'Project & resources', 'Get involved'],
    lightMode: 'Switch to light mode', darkMode: 'Switch to dark mode',
    skip: 'Skip to content', menu: 'Open menu', close: 'Close menu', language: '한국어로 전환',
    eyebrow: 'PSEUDO LAB · EXPERIMENT PLATFORM TEAM',
    title: <>Building a platform.<br/><span>Sharing the journey.</span></>,
    intro: 'We build, study together, and learn from real services. Follow the work and progress of Pseudo Lab’s Experiment Platform Team.',
    explore: 'Explore our updates', service: 'Open the platform',
    note: 'Visit ExperiBase for product information and use.',
    boardTitle: 'What we are working toward', season: 'Season 13',
    boardItems: [['BUILD', 'Build the foundations', 'Experiment management · SDK/API · measurement'], ['LEARN', 'Learn from real services', 'Connect development and analysis'], ['NEXT', 'Complete an experiment cycle', 'Improve → experiment → analyze and decide']],
    boardNote: 'Our current direction and goals',
    strip: ['Development journey', 'Learning together', 'Lessons from practice'],
    updatesTag: '01 / TEAM LOG', updatesTitle: 'What have we been working on?',
    updatesIntro: 'Here’s what we’ve built, what we’ve learned, and what we’d like to try next.',
    updates: [
      ['Build', 'The foundations', 'From experiment management to SDK integration', 'We’ve been building the pieces for running experiments, from consistent assignment and feature flags to event collection and results. We’re also refining the management interface. You can explore the product on ExperiBase and follow the code and changes on GitHub.'],
      ['Apply', 'Experience from a real service', 'Connecting Season 12 reflections on the Pseudo Lab website', 'We connected the platform to the Season 12 reflection entry UI on the Pseudo Lab website and checked the measurement flow from exposure to click to submission. Without a randomized control group, this quasi-experiment doesn’t establish that the feature improved outcomes. We’re taking what we learned about integration, event definitions, and interpretation into our next experiments.'],
      ['Up next', 'Learning and our Season 13 goal', 'From building to experimenting and deciding', 'In Season 13, we’d like to experience the full cycle together: improve a feature, run a real-user experiment, look at the results, and decide what to do next. We’re reviewing experiment questions and metrics and aiming to leave behind guides and lessons we can use again.'],
    ],
    teamTag: '02 / ABOUT THE TEAM', teamTitle: <>Connecting development<br/>and experimentation.</>,
    teamText: 'At Pseudo Lab, we find problems in real services, build improvements, and examine outcomes through data. We are developing ExperiBase, an open-source experimentation platform that supports this process.',
    teamFoot: 'This page brings together short updates and team activities. Detailed technical writing belongs on the team blog; source code and change history live on GitHub.',
    teamTopics: ['Development & operations', 'Experiment design & analysis', 'Study & shared experience'],
    membersTitle: 'The people behind the project', membersIntro: 'Bringing different experiences together to build the platform.',
    lead: 'Project lead', member: 'Team member', profile: 'View profile',
    linksTag: '03 / EXPLORE MORE', linksTitle: 'Explore the project and its resources.',
    linksIntro: 'Find the product, source code, and longer technical stories in their own spaces.',
    resources: [
      ['ExperiBase', 'The service', 'Explore the product and manage experiments.', 'Open the platform', 'service'],
      ['GitHub', 'Code & change history', 'Explore the implementation and development progress.', 'Explore the repository', 'repo'],
      ['Team Blog', 'Technical writing & experience', 'Our team’s blog, bringing together articles and resources.', 'Explore the blog', 'blog'],
    ],
    stayTitle: <>Follow our progress.<br/>Explore ways to contribute.</>,
    stayText: 'Receive updates about the project, or let us know you would like to contribute when an opportunity fits.',
    stayCta: 'Updates & contribution interest', stayNote: 'Choose updates or interest in contributing in the Google Form.',
    footer: 'Notes from Pseudo Lab’s Experiment Platform Team', org: 'Pseudo Lab', footerNote: 'BUILD TOGETHER · LEARN TOGETHER',
  },
};

function App() {
  const [lang, setLang] = useState('ko');
  const [menu, setMenu] = useState(false);
  const menuToggle = useRef(null);
  useEffect(() => {
    if (!menu) return;
    const closeOnEscape = event => {
      if (event.key === 'Escape') {
        setMenu(false);
        menuToggle.current?.focus();
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [menu]);
  const [opened, setOpened] = useState(0);
  const cancelScroll = useRef(() => {});
  useEffect(() => () => cancelScroll.current(), []);

  function navigateToSection(event) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    cancelScroll.current();
    setMenu(false);
    const hash = event.currentTarget.hash;
    const target = document.getElementById(hash.slice(1));
    if (!target || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    event.preventDefault();
    const root = document.documentElement;
    const start = window.scrollY;
    const offset = parseFloat(getComputedStyle(root).scrollPaddingTop) || 0;
    const end = Math.max(0, Math.min(start + target.getBoundingClientRect().top - offset, root.scrollHeight - window.innerHeight));
    const previousBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    if (window.location.hash !== hash) window.history.pushState(null, '', hash);
    const started = performance.now();
    let frame;
    const interruptions = ['wheel', 'touchstart', 'pointerdown', 'keydown'];
    const stop = () => {
      cancelAnimationFrame(frame);
      root.style.scrollBehavior = previousBehavior;
      interruptions.forEach(type => window.removeEventListener(type, stop));
      cancelScroll.current = () => {};
    };
    cancelScroll.current = stop;
    interruptions.forEach(type => window.addEventListener(type, stop, { passive: true }));
    const animate = now => {
      const progress = Math.min((now - started) / 750, 1);
      const eased = (1 - Math.cos(Math.PI * progress)) / 2;
      window.scrollTo(0, start + (end - start) * eased);
      if (progress < 1) {
        frame = requestAnimationFrame(animate);
      } else {
        stop();
        target.focus({ preventScroll: true });
      }
    };
    frame = requestAnimationFrame(animate);
  }

  const [themePreference, setThemePreference] = useState(() => {
    try {
      const saved = localStorage.getItem('team-theme');
      return saved === 'dark' || saved === 'light' ? saved : null;
    } catch {
      return null;
    }
  });
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  const theme = themePreference ?? (systemDark ? 'dark' : 'light');
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystemDark(media.matches);
    media.addEventListener('change', update);
    update();
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#121725' : '#f8f9fc';
    if (themePreference) {
      try { localStorage.setItem('team-theme', themePreference); } catch { /* Theme still works without storage. */ }
    }
  }, [theme, themePreference]);
  const t = copy[lang];
  const ids = ['updates', 'team', 'resources', 'subscribe'];
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = lang === 'ko' ? '활동과 소식 | 가짜연구소 실험플랫폼 팀' : 'Team Log | Pseudo Lab Experiment Platform Team';
    document.querySelector('meta[name="description"]').content = t.intro;
  }, [lang, t]);
  return <>
    <a className="skip" href="#main">{t.skip}</a>
    <header><div className="nav wrap">
      <a href="#" className="brand"><span className="brand-text"><b>Pseudo Lab</b><small>{t.name}</small></span></a>
      <nav id="team-navigation" aria-label={lang === 'ko' ? '주 메뉴' : 'Main navigation'} className={menu ? 'is-open' : ''}>
        {ids.map((id, i) => <a key={id} href={'#' + id} onClick={navigateToSection}>{t.nav[i]}</a>)}
      </nav>
      <div className="nav-actions">
        <Button variant="ghost" size="icon" className="theme-toggle" aria-label={theme === 'dark' ? t.lightMode : t.darkMode} title={theme === 'dark' ? t.lightMode : t.darkMode} onClick={() => setThemePreference(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? <Sun size={18} aria-hidden="true"/> : <Moon size={18} aria-hidden="true"/>}
        </Button>
        <Button variant="ghost" size="sm" aria-label={t.language} onClick={() => setLang(lang === 'ko' ? 'en' : 'ko')}>{lang === 'ko' ? 'EN' : 'KO'}</Button>
        <Button asChild variant="outline" className="github-button"><a href={urls.repo} target="_blank" rel="noreferrer"><Github size={16}/>GitHub<ArrowUpRight size={14}/></a></Button>
        <Button variant="ghost" size="icon" className="menu-button" ref={menuToggle} aria-controls="team-navigation" aria-expanded={menu} aria-label={menu ? t.close : t.menu} onClick={() => setMenu(!menu)}>{menu ? <X/> : <Menu/>}</Button>
      </div>
    </div></header>
    <main id="main" tabIndex={-1}>
      <section className="hero wrap activity-hero">
        <div className="hero-copy">
          <div className="eyebrow"><span className="status-dot"/>{t.eyebrow}</div>
          <h1>{t.title}</h1><p>{t.intro}</p>
          <div className="hero-actions"><Button asChild size="lg"><a href={urls.service} target="_blank" rel="noreferrer">{t.service}<ArrowUpRight size={17}/></a></Button><Button asChild size="lg" variant="outline"><a href="#updates" onClick={navigateToSection}>{t.explore}<ArrowRight size={17}/></a></Button></div>
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
      <section id="updates" tabIndex={-1} className="updates section"><div className="wrap">
        <div className="section-top"><div><p className="eyebrow">{t.updatesTag}</p><h2>{t.updatesTitle}</h2></div><p className="section-description">{t.updatesIntro}</p></div>
        <div className="update-list">{t.updates.map(([tag, sub, title, body], i) => <article className={opened === i ? 'expanded' : ''} key={tag}>
          <Button variant="ghost" className="update-toggle" aria-expanded={opened === i} aria-controls={'update-' + i} onClick={() => setOpened(opened === i ? null : i)}><span className={'update-tag tag-' + i}>{tag}</span><span className="update-title"><small>{sub}</small><strong>{title}</strong></span><span className="update-indicator">{opened === i ? <Minus size={20}/> : <Plus size={20}/>}</span></Button>
          <div id={'update-' + i} hidden={opened !== i} className="update-body"><p>{body}</p></div>
        </article>)}</div>
      </div></section>
      <section id="team" tabIndex={-1} className="section wrap compact-team">
        <div><p className="eyebrow">{t.teamTag}</p><h2>{t.teamTitle}</h2></div>
        <div className="team-story"><p>{t.teamText}</p><p>{t.teamFoot}</p><div className="team-topics">{t.teamTopics.map(s => <span key={s}>{s}</span>)}</div></div>
        <div id="members" className="members">
          <h3>{t.membersTitle}</h3><p className="members-intro">{t.membersIntro}</p>
          <div className="member-grid">{members.map(person => <article className="member-card" key={person.profile}>
            <div className="member-avatar" aria-hidden="true"><span>{person.name.slice(0, 1)}</span><img src={person.image} alt="" width="56" height="56" loading="lazy" decoding="async" onError={event => { event.currentTarget.style.display = 'none'; }}/></div>
            <span className="member-role">{person.lead ? t.lead : t.member}</span>
            <h4>{person.name}</h4><p>{person.bio[lang]}</p>
            <a className="text-link" href={person.profile} target="_blank" rel="noreferrer" aria-label={`${person.name} ${t.profile}`}>{t.profile}<ArrowUpRight size={15}/></a>
          </article>)}</div>
        </div>
      </section>
      <section id="resources" tabIndex={-1} className="resources-section"><div className="wrap">
        <p className="eyebrow">{t.linksTag}</p><h2>{t.linksTitle}</h2><p className="resource-intro">{t.linksIntro}</p>
        <div className="resource-grid">{t.resources.map(([title, label, text, action, key], i) => { const Icon = [Compass, Code2, BookOpen][i]; return <article key={key}><div className="resource-top"><Icon size={24}/><span>{label}</span></div><h3>{title}</h3><p>{text}</p><a className="text-link" href={urls[key]} target="_blank" rel="noreferrer">{action}<ArrowUpRight size={17}/></a></article>; })}</div>
      </div></section>
      <section id="subscribe" tabIndex={-1} className="stay wrap"><div className="stay-decor" aria-hidden="true">✳</div><div><p className="eyebrow">KEEP IN THE LOOP</p><h2>{t.stayTitle}</h2><p>{t.stayText}</p></div>
        <div className="stay-action"><div className="stay-buttons"><Button asChild size="lg"><a href={urls.signup} target="_blank" rel="noreferrer">{t.stayCta}<ArrowUpRight size={17}/></a></Button><Button asChild size="lg" variant="outline"><a href={urls.repo} target="_blank" rel="noreferrer"><Github size={18}/>GitHub<ArrowUpRight size={17}/></a></Button></div><small>{t.stayNote}</small></div>
      </section>
    </main>
    <footer className="wrap"><div><a className="footer-brand" href={urls.org} target="_blank" rel="noreferrer">Pseudo Lab<ArrowUpRight size={16}/></a><p>{t.footer}</p></div><div className="footer-right"><div><a href={urls.service} target="_blank" rel="noreferrer">ExperiBase ↗</a><a href={urls.repo} target="_blank" rel="noreferrer">GitHub ↗</a><a href={urls.blog} target="_blank" rel="noreferrer">{lang === 'ko' ? '팀 블로그' : 'Team Blog'} ↗</a><a href={urls.org} target="_blank" rel="noreferrer">{t.org} ↗</a></div><small>{t.footerNote}</small></div></footer>
  </>;
}
createRoot(document.getElementById('root')).render(<App/>);
