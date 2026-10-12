import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Brain, ClipboardCheck, FileText, Flame, Headphones, Library, Map, Mic, PenLine, Sparkles } from 'lucide-react';
import { useT, type StringKey } from '../lib/i18n';
import { streak, useStore, today } from '../lib/storage';
import { isDue } from '../lib/srs';
import { loadAllLessons, useAsync } from '../lib/data';
import { pick } from '../lib/i18n';

const MODULES: { to: string; key: StringKey; desc: StringKey; icon: typeof BookOpen; tone: string }[] = [
  { to: '/learn', key: 'nav.learn', desc: 'm.learn', icon: BookOpen, tone: 'blue' },
  { to: '/flashcards', key: 'nav.flashcards', desc: 'm.flashcards', icon: Brain, tone: 'violet' },
  { to: '/practice/listening', key: 'nav.listening', desc: 'm.listening', icon: Headphones, tone: 'teal' },
  { to: '/practice/reading', key: 'nav.reading', desc: 'm.reading', icon: FileText, tone: 'amber' },
  { to: '/writing', key: 'nav.writing', desc: 'm.writing', icon: PenLine, tone: 'rose' },
  { to: '/speaking', key: 'nav.speaking', desc: 'm.speaking', icon: Mic, tone: 'green' },
  { to: '/exam', key: 'nav.exam', desc: 'm.exam', icon: ClipboardCheck, tone: 'red' },
  { to: '/dictionary', key: 'nav.dictionary', desc: 'm.dictionary', icon: Library, tone: 'slate' },
  { to: '/guides', key: 'nav.guides', desc: 'm.guides', icon: Map, tone: 'blue' },
];

const PATH = [
  { level: 'A1', en: 'Sounds, greetings, être/avoir, present tense, numbers', zh: '发音、问候、être/avoir、现在时、数字' },
  { level: 'A2', en: 'Past tenses, pronouns, future, everyday tasks', zh: '过去时、代词、将来时、日常事务' },
  { level: 'B1', en: 'Subjunctive, si clauses, connectors, opinions', zh: '虚拟式、条件句、连接词、表达观点' },
  { level: 'B2', en: 'Argumentation, register, TCF tasks — NCLC 7', zh: '论证、语域、TCF 任务 —— NCLC 7' },
];

export default function Home() {
  const { t, lang } = useT();
  const [activity] = useStore('activity');
  const [srs] = useStore('srs');
  const [lessons] = useStore('lessons');
  const [answers] = useStore('answers');
  const allLessons = useAsync(loadAllLessons, []);
  const due = Object.values(srs).filter((c) => isDue(c)).length;
  const next = allLessons?.find((l) => !lessons[l.id]);
  const days = streak(activity);
  const started = Object.keys(lessons).length > 0 || Object.keys(answers).length > 0 || Object.keys(srs).length > 0;

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-text">
          <span className="pill">
            <Sparkles size={14} /> 100% free · open source · no sign-up
          </span>
          <h1>{t('home.tagline')}</h1>
          <p className="lead">{t('home.sub')}</p>
          <div className="hero-cta">
            <Link className="btn primary large" to={next ? `/learn/${next.id}` : '/learn'}>
              {started && next ? t('home.nextLesson') : t('home.startZero')} <ArrowRight size={18} />
            </Link>
            <Link className="btn large" to="/exam">
              {t('home.takeExam')}
            </Link>
          </div>
        </div>
        <div className="hero-card" aria-hidden>
          <div className="flash-demo">
            <div className="flash-demo-card back" />
            <div className="flash-demo-card">
              <span className="badge level-a1">A1</span>
              <div className="flash-demo-word">bonjour</div>
              <div className="muted">hello · 你好</div>
              <div className="flash-demo-ex">« Bonjour, je m'appelle Léa. »</div>
            </div>
          </div>
        </div>
      </section>

      <section className="stats-row">
        <div className="stat">
          <Flame size={20} className="stat-icon flame" />
          <div>
            <div className="stat-value">{days}</div>
            <div className="stat-label">{t('home.streak')}</div>
          </div>
        </div>
        <Link to="/flashcards" className="stat">
          <Brain size={20} className="stat-icon" />
          <div>
            <div className="stat-value">{due}</div>
            <div className="stat-label">{t('home.due')}</div>
          </div>
        </Link>
        <Link to="/learn" className="stat">
          <BookOpen size={20} className="stat-icon" />
          <div>
            <div className="stat-value">
              {Object.keys(lessons).length}
              {allLessons ? <span className="muted small"> / {allLessons.length}</span> : null}
            </div>
            <div className="stat-label">{t('home.lessonsDone')}</div>
          </div>
        </Link>
        <Link to="/progress" className="stat">
          <ClipboardCheck size={20} className="stat-icon" />
          <div>
            <div className="stat-value">{Object.keys(answers).length}</div>
            <div className="stat-label">
              {t('home.answered')}
              {activity[today()] ? ` · ${t('home.today')} ${activity[today()]}` : ''}
            </div>
          </div>
        </Link>
      </section>

      {next && (
        <Link to={`/learn/${next.id}`} className="next-lesson card">
          <div>
            <div className="small muted">{t('home.nextLesson')}</div>
            <div className="next-lesson-title">
              <span className={`badge level-${next.level.toLowerCase()}`}>{next.level}</span> {next.titleFr}
            </div>
            <div className="muted small">{pick(next, 'title', lang)}</div>
          </div>
          <ArrowRight />
        </Link>
      )}

      <section>
        <h2>{t('home.modules')}</h2>
        <div className="module-grid">
          {MODULES.map((m) => (
            <Link key={m.to} to={m.to} className={`module card tone-${m.tone}`}>
              <span className="module-icon">
                <m.icon size={22} />
              </span>
              <h3>{t(m.key)}</h3>
              <p className="muted">{t(m.desc)}</p>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2>{t('home.path')}</h2>
        <p className="muted">{t('home.pathSub')}</p>
        <ol className="path">
          {PATH.map((p, i) => (
            <li key={p.level} className="path-step">
              <span className={`path-dot level-${p.level.toLowerCase()}`}>{p.level}</span>
              <div>
                <strong>{p.level}</strong>
                <p className="muted small">{lang === 'zh' ? p.zh : p.en}</p>
              </div>
              {i < PATH.length - 1 && <span className="path-line" aria-hidden />}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
