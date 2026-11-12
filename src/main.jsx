import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowUpRight, ArrowRight, Github, Menu, X, Code2, BookOpen, Compass, Sun, Moon, Boxes, Database, FlaskConical, Cable, NotebookPen } from 'lucide-react';
import { Button } from './components/ui/button';
import './style.css';

const urls = {
  repo: 'https://github.com/Pseudo-Lab/experiment-platform-pseudolab',
  service: 'https://iterglow.pseudolab-devfactory.com',
  guide: 'https://iterglow.pseudolab-devfactory.com/docs/sdk',
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

const activityIcons = [Boxes, Database, FlaskConical, Cable, NotebookPen];

const copy = {
  "ko": {
    "name": "데이터 이니셔티브",
    "nav": [
      "주요 활동",
      "함께하는 사람들",
      "프로젝트와 기록",
      "소식받기"
    ],
    "lightMode": "라이트모드로 전환",
    "darkMode": "다크모드로 전환",
    "skip": "본문으로 이동",
    "menu": "메뉴 열기",
    "close": "메뉴 닫기",
    "language": "Switch to English",
    "title": [
      "데이터로 배우고 실험하며,",
      "커뮤니티의 더 나은 결정을 돕습니다."
    ],
    "intro": [
      "가짜연구소 Data Initiative는 데이터를 바탕으로 가설을 세우고, 실제 서비스에서 실험을 통해 검증합니다.",
      "연구와 실험을 이어갈 환경을 만들고, 이를 지원하는 오픈소스 실험 플랫폼 Iterglow를 구축합니다."
    ],
    "explore": "주요 활동 살펴보기",
    "service": "플랫폼 바로가기",
    "guide": "SDK 연동 가이드 보기",
    "activitiesTitle": "주요 활동",
    "activitiesIntro": "플랫폼 개발부터 데이터 정리, 실험 설계와 서비스 연동까지 함께 진행합니다.",
    "activities": [
      [
        "실험 플랫폼 구축",
        "실험 관리·측정·결과 확인을 지원하는 오픈소스 플랫폼 Iterglow를 구축합니다."
      ],
      [
        "비영리 커뮤니티 데이터 수집·정리",
        "흩어진 활동 기록과 데이터를 연구와 분석에 활용할 수 있도록 정리합니다."
      ],
      [
        "실험 설계와 분석",
        "가설과 지표를 정의하고, 수집한 실험 결과를 분석·해석합니다."
      ],
      [
        "서비스 연동",
        "서비스에 Iterglow를 연결하고, 데이터 수집과 동작을 확인합니다."
      ],
      [
        "기술 조사와 문서화",
        "다른 실험 플랫폼과 방법을 조사하고, 연동 가이드와 적용 경험을 정리합니다."
      ]
    ],
    "visionTitle": "경험을 쌓아, 더 넓은 기준으로",
    "visionText": "현장에서 쌓은 경험을 공유하며 데이터의 가치를 검증하는 방법을 발전시키려 합니다. 장기적으로는 데이터 가치평가의 글로벌 표준을 제시하는 비영리 조직을 지향합니다.",
    "membersTitle": "함께 만드는 사람들",
    "membersIntro": "개발·분석·실험 설계의 경험을 모아 Data Initiative의 활동을 함께합니다.",
    "lead": "리드 빌더",
    "member": "빌더",
    "profile": "프로필 보기",
    "linksTitle": "프로젝트와 기록을 찾아보세요.",
    "linksIntro": "제품 사용부터 자세한 기술 이야기까지, 필요한 곳으로 바로 연결합니다.",
    "resources": [
      [
        "Iterglow",
        "서비스",
        "실험을 설계하고 사용자 행동을 측정해 결과를 비교하는 오픈소스 실험 플랫폼입니다.",
        "플랫폼 바로가기",
        "service"
      ],
      [
        "GitHub",
        "코드와 변경 이력",
        "플랫폼의 구현 내용과 개발 진행 상황을 확인하세요.",
        "저장소 살펴보기",
        "repo"
      ],
      [
        "팀 블로그",
        "기술 글과 경험",
        "실험을 설계하고 플랫폼을 구축하며 겪은 시행착오와 배움을 나눕니다.",
        "블로그 둘러보기",
        "blog"
      ]
    ],
    "stayTitle": [
      "소식을 받아보고,",
      "함께할 뜻도 남겨주세요."
    ],
    "stayText": "프로젝트 소식이 궁금하거나, 함께하고 싶다면 알려주세요.",
    "stayCta": "참여 관심 남기기 / 소식받기",
    "stayNote": "프로젝트 소식만 받아보거나, 앞으로 함께하고 싶은 분야를 남길 수 있습니다.",
    "footer": "가짜연구소 데이터 이니셔티브",
    "org": "가짜연구소",
    "footerNote": "BUILD TOGETHER · LEARN TOGETHER"
  },
  "en": {
    "name": "Data Initiative",
    "nav": [
      "Activities",
      "People",
      "Project & resources",
      "Updates"
    ],
    "lightMode": "Switch to light mode",
    "darkMode": "Switch to dark mode",
    "skip": "Skip to content",
    "menu": "Open menu",
    "close": "Close menu",
    "language": "한국어로 전환",
    "title": [
      "Learning and experimenting with data.",
      "Helping our community make better decisions."
    ],
    "intro": [
      "At Pseudo Lab’s Data Initiative, we form hypotheses from data and test them through experiments in real services.",
      "We create an environment for ongoing research and experimentation, and build Iterglow, an open-source experiment platform, to support this work."
    ],
    "explore": "Explore our activities",
    "service": "Open the platform",
    "guide": "Read the SDK integration guide",
    "activitiesTitle": "Our activities",
    "activitiesIntro": "Our work spans platform development, data preparation, experiment design, and service integration.",
    "activities": [
      [
        "Experiment platform development",
        "We build Iterglow, an open-source platform for managing experiments, measuring behavior, and examining results."
      ],
      [
        "Community data collection and organization",
        "We organize nonprofit community activity records and data for research and analysis."
      ],
      [
        "Experiment design and analysis",
        "We define hypotheses and metrics, then analyze and interpret experiment results."
      ],
      [
        "Service integration",
        "We connect Iterglow to services and verify data collection and behavior."
      ],
      [
        "Technical research and documentation",
        "We research experiment platforms and methods, and document integration guides and practical experience."
      ]
    ],
    "visionTitle": "From shared experience to broader standards",
    "visionText": "By sharing experience from real services, we aim to advance methods for evaluating the value of data. Our long-term vision is to become a nonprofit organization that proposes global standards for data valuation.",
    "membersTitle": "The people behind the work",
    "membersIntro": "We bring experience in development, analysis, and experiment design to Data Initiative.",
    "lead": "Lead Builder",
    "member": "Builder",
    "profile": "View profile",
    "linksTitle": "Explore the project and its resources.",
    "linksIntro": "Find the product, source code, and longer technical stories in their own spaces.",
    "resources": [
      [
        "Iterglow",
        "The service",
        "An open-source experiment platform for designing experiments, measuring user behavior, and comparing results.",
        "Open the platform",
        "service"
      ],
      [
        "GitHub",
        "Code & change history",
        "Explore the platform’s implementation and development progress.",
        "Explore the repository",
        "repo"
      ],
      [
        "Team Blog",
        "Technical writing & experience",
        "We share the trials and lessons from designing experiments and building the platform.",
        "Explore the blog",
        "blog"
      ]
    ],
    "stayTitle": [
      "Follow our progress.",
      "Let us know you’re interested."
    ],
    "stayText": "Let us know if you’d like project updates or are interested in taking part.",
    "stayCta": "Express interest / Get updates",
    "stayNote": "Receive project updates, or tell us how you’d like to take part in the future.",
    "footer": "Pseudo Lab’s Data Initiative",
    "org": "Pseudo Lab",
    "footerNote": "BUILD TOGETHER · LEARN TOGETHER"
  }
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
  const ids = ['activities', 'team', 'resources', 'subscribe'];
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = lang === 'ko' ? 'Data Initiative | 팀 소개' : 'Data Initiative | About the team';
    document.querySelector('meta[name="description"]').content = t.intro.join(' ');
  }, [lang, t]);
  return <>
    <a className="skip" href="#main">{t.skip}</a>
    <header><div className="nav wrap">
      <a href="#" className="brand" aria-label={lang === 'ko' ? '데이터 이니셔티브 홈' : 'Data Initiative home'}><span className="brand-text"><b className="wordmark">Data <span className="wordmark-lab">Initiative</span></b></span></a>
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
      <section className="hero wrap initiative-hero">
        <div className="hero-copy">
          <h1>{t.title[0]}<br/><span>{t.title[1]}</span></h1>
          <ul className="hero-intro">{t.intro.map(item => <li key={item}>{item}</li>)}</ul>
          <div className="hero-actions">
            <Button asChild size="lg"><a href="#activities" onClick={navigateToSection}>{t.explore}<ArrowRight size={17}/></a></Button>
            <Button asChild size="lg" variant="outline"><a href={urls.service} target="_blank" rel="noreferrer">{t.service}<ArrowUpRight size={17}/></a></Button>
          </div>
        </div>
      </section>
      <section id="activities" tabIndex={-1} className="section activities-section"><div className="wrap">
        <h2>{t.activitiesTitle}</h2><p className="section-lead">{t.activitiesIntro}</p>
        <div className="activity-cards" role="region" aria-label={t.activitiesTitle} tabIndex={0}>{t.activities.map(([title, body], i) => {
          const Icon = activityIcons[i];
          return <article className="activity-card" key={title}>
            <div className="activity-icon" aria-hidden="true"><Icon size={25} strokeWidth={1.7}/></div>
            <h3>{title}</h3><p className="activity-card-body">{body}</p>
          </article>;
        })}</div>
        <div className="initiative-vision"><h3>{t.visionTitle}</h3><p>{t.visionText}</p></div>
      </div></section>
      <section id="team" tabIndex={-1} className="section wrap people-section">
        <h2>{t.membersTitle}</h2><p className="section-lead">{t.membersIntro}</p>
          <div className="member-grid">{members.map(person => <article className="member-card" key={person.profile}>
            <div className="member-avatar" aria-hidden="true"><span>{person.name.slice(0, 1)}</span><img src={person.image} alt="" width="56" height="56" loading="lazy" decoding="async" onError={event => { event.currentTarget.style.display = 'none'; }}/></div>
            <span className="member-role">{person.lead ? t.lead : t.member}</span>
            <h3>{person.name}</h3><p>{person.bio[lang]}</p>
            <a className="text-link" href={person.profile} target="_blank" rel="noreferrer" aria-label={`${person.name} ${t.profile}`}>{t.profile}<ArrowUpRight size={15}/></a>
          </article>)}</div>
      </section>
      <section id="resources" tabIndex={-1} className="resources-section"><div className="wrap">
        <h2>{t.linksTitle}</h2><p className="resource-intro">{t.linksIntro}</p>
        <div className="resource-grid">{t.resources.map(([title, label, text, action, key], i) => { const Icon = [Compass, Code2, BookOpen][i]; return <article key={key}><div className="resource-top"><Icon size={24}/><span>{label}</span></div><h3>{key === 'service' ? <img className="service-logo" src={import.meta.env.BASE_URL + 'brand/iterglow-logo' + (theme === 'dark' ? '-dark' : '') + '.svg'} alt={title}/> : title}</h3><p>{text}</p><a className="text-link" href={urls[key]} target="_blank" rel="noreferrer">{action}<ArrowUpRight size={17}/></a>{key === 'service' && <a className="text-link sdk-guide-link" href={urls.guide} target="_blank" rel="noreferrer">{t.guide}<ArrowUpRight size={15}/></a>}</article>; })}</div>
      </div></section>
      <section id="subscribe" tabIndex={-1} className="stay wrap"><div className="stay-decor" aria-hidden="true">✳</div><div><h2>{t.stayTitle[0]}<br/>{t.stayTitle[1]}</h2><p>{t.stayText}</p></div>
        <div className="stay-action"><div className="stay-buttons"><Button asChild size="lg"><a href={urls.signup} target="_blank" rel="noreferrer">{t.stayCta}<ArrowUpRight size={17}/></a></Button></div><small>{t.stayNote}</small></div>
      </section>
    </main>
    <footer className="wrap"><div><a className="footer-brand" href="#"><b className="wordmark">Data <span className="wordmark-lab">Initiative</span></b></a><p>{t.footer}</p></div><div className="footer-right"><div><a href={urls.service} target="_blank" rel="noreferrer">Iterglow ↗</a><a href={urls.repo} target="_blank" rel="noreferrer">GitHub ↗</a><a href={urls.blog} target="_blank" rel="noreferrer">{lang === 'ko' ? '팀 블로그' : 'Team Blog'} ↗</a><a href={urls.org} target="_blank" rel="noreferrer">{t.org} ↗</a></div><small>{t.footerNote}</small></div></footer>
  </>;
}
createRoot(document.getElementById('root')).render(<App/>);
