import { useEffect, useState } from 'react';
import { NavLink, Link, Outlet, useLocation } from 'react-router-dom';
import {
  BookOpen,
  Brain,
  ClipboardCheck,
  Headphones,
  Languages,
  Library,
  Map,
  Menu,
  Mic,
  Moon,
  PenLine,
  Sun,
  SunMoon,
  TrendingUp,
  X,
  FileText,
} from 'lucide-react';
import { BRAND, useT, type StringKey } from '../lib/i18n';
import { useSettings } from '../lib/storage';
import { stop as stopSpeech } from '../lib/tts';

export const REPO_URL = 'https://github.com/bingqin2/FreeFrenchPR';

const NAV: { to: string; key: StringKey; icon: typeof BookOpen }[] = [
  { to: '/learn', key: 'nav.learn', icon: BookOpen },
  { to: '/flashcards', key: 'nav.flashcards', icon: Brain },
  { to: '/practice/listening', key: 'nav.listening', icon: Headphones },
  { to: '/practice/reading', key: 'nav.reading', icon: FileText },
  { to: '/writing', key: 'nav.writing', icon: PenLine },
  { to: '/speaking', key: 'nav.speaking', icon: Mic },
  { to: '/exam', key: 'nav.exam', icon: ClipboardCheck },
  { to: '/dictionary', key: 'nav.dictionary', icon: Library },
  { to: '/guides', key: 'nav.guides', icon: Map },
];

function Logo() {
  return (
    <svg viewBox="0 0 64 64" width="30" height="30" aria-hidden>
      <rect width="64" height="64" rx="14" fill="var(--primary)" />
      <rect x="10" y="18" width="14" height="28" rx="3" fill="#fff" opacity=".9" />
      <rect x="25" y="18" width="14" height="28" fill="#fff" />
      <rect x="40" y="18" width="14" height="28" rx="3" fill="var(--accent)" />
    </svg>
  );
}

export default function Layout() {
  const { t, lang } = useT();
  const [settings, setSettings] = useSettings();
  const [open, setOpen] = useState(false);
  const loc = useLocation();

  useEffect(() => {
    setOpen(false);
    stopSpeech();
    window.scrollTo(0, 0);
  }, [loc.pathname]);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = settings.theme;
    root.lang = lang === 'zh' ? 'zh-CN' : 'en';
  }, [settings.theme, lang]);

  const nextTheme = settings.theme === 'system' ? 'light' : settings.theme === 'light' ? 'dark' : 'system';
  const ThemeIcon = settings.theme === 'system' ? SunMoon : settings.theme === 'light' ? Sun : Moon;

  return (
    <div className="app">
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="brand" aria-label={BRAND}>
            <Logo />
            <span>
              Free<b>French</b>PR
            </span>
          </Link>
          <nav className="nav-desktop" aria-label="Main">
            {NAV.slice(0, 7).map((n) => (
              <NavLink key={n.to} to={n.to}>
                {t(n.key)}
              </NavLink>
            ))}
          </nav>
          <div className="topbar-actions">
            <button
              className="icon-btn"
              onClick={() => setSettings({ lang: lang === 'zh' ? 'en' : 'zh' })}
              title={lang === 'zh' ? 'Switch to English' : '切换到中文'}
              aria-label={lang === 'zh' ? 'Switch to English' : '切换到中文'}
            >
              <Languages size={18} />
              <span className="lang-label">{lang === 'zh' ? 'EN' : '中文'}</span>
            </button>
            <button
              className="icon-btn"
              onClick={() => setSettings({ theme: nextTheme })}
              title={t(`theme.${settings.theme}` as StringKey)}
              aria-label={t(`theme.${settings.theme}` as StringKey)}
            >
              <ThemeIcon size={18} />
            </button>
            <NavLink to="/progress" className="icon-btn" title={t('nav.progress')} aria-label={t('nav.progress')}>
              <TrendingUp size={18} />
            </NavLink>
            <button className="icon-btn menu-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={t('nav.menu')}>
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
        {open && (
          <nav className="nav-mobile" aria-label="Mobile">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to}>
                <n.icon size={18} /> {t(n.key)}
              </NavLink>
            ))}
            <NavLink to="/progress">
              <TrendingUp size={18} /> {t('nav.progress')}
            </NavLink>
          </nav>
        )}
      </header>
      <main id="main" className="main">
        <Outlet />
      </main>
      <footer className="footer">
        <div className="footer-inner">
          <div>
            <div className="brand small-brand">
              <Logo />
              <span>
                Free<b>French</b>PR
              </span>
            </div>
            <p className="muted small">{t('f.free')}</p>
          </div>
          <div className="footer-links">
            <Link to="/guides">{t('nav.guides')}</Link>
            <Link to="/dictionary">{t('nav.dictionary')}</Link>
            <Link to="/progress">{t('nav.progress')}</Link>
            <Link to="/about">{t('nav.about')}</Link>
            <a href={REPO_URL} target="_blank" rel="noreferrer">
              {t('f.source')}
            </a>
          </div>
          <p className="muted small footer-note">{t('f.notAffiliated')}</p>
        </div>
      </footer>
    </div>
  );
}
