import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Trash2, Upload, Volume2 } from 'lucide-react';
import { PageHeader } from '../components/ui';
import { useT, type StringKey } from '../lib/i18n';
import { exportData, importData, resetData, streak, today, useSettings, useStore } from '../lib/storage';
import { isLearned } from '../lib/srs';
import { speak, useFrenchVoices } from '../lib/tts';

function Heatmap({ activity }: { activity: Record<string, number> }) {
  const days: { date: string; n: number }[] = [];
  const d = new Date();
  d.setDate(d.getDate() - (7 * 12 - 1) - d.getDay());
  for (let i = 0; i < 7 * 12 + new Date().getDay() + 1; i++) {
    days.push({ date: today(d), n: activity[today(d)] ?? 0 });
    d.setDate(d.getDate() + 1);
  }
  const lvl = (n: number) => (n === 0 ? 0 : n < 5 ? 1 : n < 15 ? 2 : n < 40 ? 3 : 4);
  return (
    <div className="heatmap" role="img" aria-label="Activity calendar">
      {days.map((x) => (
        <span key={x.date} className={`hm hm${lvl(x.n)}`} title={`${x.date}: ${x.n}`} />
      ))}
    </div>
  );
}

export default function Progress() {
  const { t, lang } = useT();
  const [settings, setSettings] = useSettings();
  const [activity] = useStore('activity');
  const [answers] = useStore('answers');
  const [lessons] = useStore('lessons');
  const [srs] = useStore('srs');
  const [notes] = useStore('notes');
  const [favs] = useStore('favorites');
  const [exams] = useStore('exams');
  const voices = useFrenchVoices();
  const [msg, setMsg] = useState('');
  const file = useRef<HTMLInputElement>(null);

  const skill = (prefix: string) => {
    const list = Object.entries(answers).filter(([id]) => id.startsWith(prefix));
    const ok = list.filter(([, a]) => a.correct).length;
    return { n: list.length, pct: list.length ? Math.round((ok / list.length) * 100) : 0 };
  };
  const lis = skill('lis-');
  const rea = skill('rea-');
  const best = (s: 'listening' | 'reading') => Math.max(0, ...exams.filter((e) => e.section === s).map((e) => e.score));

  const download = () => {
    const blob = new Blob([exportData()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `freefrenchpr-backup-${today()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div>
      <PageHeader title={t('pr.title')} sub={t('pr.sub')} />
      <div className="stats-row">
        <div className="stat">
          <div>
            <div className="stat-value">{streak(activity)}</div>
            <div className="stat-label">{t('home.streak')}</div>
          </div>
        </div>
        <div className="stat">
          <div>
            <div className="stat-value">{Object.keys(lessons).length}</div>
            <div className="stat-label">{t('home.lessonsDone')}</div>
          </div>
        </div>
        <div className="stat">
          <div>
            <div className="stat-value">
              {Object.values(srs).filter(isLearned).length}
              <span className="muted small"> / {Object.keys(srs).length}</span>
            </div>
            <div className="stat-label">
              {t('pr.vocab')} · {t('fc.learned')}
            </div>
          </div>
        </div>
        <div className="stat">
          <div>
            <div className="stat-value">
              {lis.pct}% <span className="muted small">({lis.n})</span>
            </div>
            <div className="stat-label">
              {t('nav.listening')} · {t('pr.accuracy')}
            </div>
          </div>
        </div>
        <div className="stat">
          <div>
            <div className="stat-value">
              {rea.pct}% <span className="muted small">({rea.n})</span>
            </div>
            <div className="stat-label">
              {t('nav.reading')} · {t('pr.accuracy')}
            </div>
          </div>
        </div>
        {exams.length > 0 && (
          <Link to="/exam" className="stat">
            <div>
              <div className="stat-value">
                {best('listening') || '–'} / {best('reading') || '–'}
              </div>
              <div className="stat-label">{lang === 'zh' ? '模考最高分（听/读）' : 'Best mock (CO / CE)'}</div>
            </div>
          </Link>
        )}
      </div>

      <section className="card">
        <h3>{t('pr.activity')}</h3>
        <Heatmap activity={activity} />
      </section>

      {(Object.keys(notes).length > 0 || favs.length > 0) && (
        <section className="card">
          <h3>
            {t('pr.notes')} · {t('c.favorites')} ({favs.length})
          </h3>
          <ul className="notes-list">
            {Object.entries(notes).map(([id, n]) => (
              <li key={id}>
                <code>{id}</code> {n}
              </li>
            ))}
          </ul>
          {favs.length > 0 && (
            <p className="small muted">
              {favs.map((f) => (
                <code key={f} className="fav-code">
                  {f}
                </code>
              ))}
            </p>
          )}
        </section>
      )}

      <section className="card settings">
        <h3>{t('pr.settings')}</h3>
        <div className="settings-grid">
          <label className="field">
            <span>{t('pr.language')}</span>
            <select value={settings.lang} onChange={(e) => setSettings({ lang: e.target.value as 'en' | 'zh' })}>
              <option value="en">English</option>
              <option value="zh">简体中文</option>
            </select>
          </label>
          <label className="field">
            <span>{t('pr.theme')}</span>
            <select value={settings.theme} onChange={(e) => setSettings({ theme: e.target.value as 'system' })}>
              {(['system', 'light', 'dark'] as const).map((th) => (
                <option key={th} value={th}>
                  {t(`theme.${th}` as StringKey)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t('pr.accent')}</span>
            <select value={settings.accent} onChange={(e) => setSettings({ accent: e.target.value as 'auto' })}>
              {(['auto', 'fr-FR', 'fr-CA'] as const).map((a) => (
                <option key={a} value={a}>
                  {t(`accent.${a}` as StringKey)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>
              {t('pr.rate')}: {settings.rate.toFixed(2)}×
            </span>
            <input type="range" min={0.6} max={1.2} step={0.05} value={settings.rate} onChange={(e) => setSettings({ rate: Number(e.target.value) })} />
          </label>
        </div>
        <div className="row">
          <button className="btn small" onClick={() => speak('Bonjour ! Bienvenue. On apprend le français ensemble ?')}>
            <Volume2 size={14} /> {t('pr.testVoice')}
          </button>
          <span className="muted small">
            {t('pr.voices')}: {voices.length ? voices.map((v) => `${v.name} (${v.lang})`).join(', ') : '0'}
          </span>
        </div>
      </section>

      <section className="card">
        <div className="row">
          <button className="btn" onClick={download}>
            <Download size={16} /> {t('pr.export')}
          </button>
          <button className="btn" onClick={() => file.current?.click()}>
            <Upload size={16} /> {t('pr.import')}
          </button>
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                importData(await f.text());
                setMsg(t('pr.imported'));
              } catch (err) {
                setMsg(String((err as Error).message));
              }
              e.target.value = '';
            }}
          />
          <button
            className="btn danger"
            onClick={() => {
              if (window.confirm(t('pr.confirmReset'))) resetData();
            }}
          >
            <Trash2 size={16} /> {t('pr.resetAll')}
          </button>
        </div>
        {msg && <p className="small">{msg}</p>}
      </section>
    </div>
  );
}
