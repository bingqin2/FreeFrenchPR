import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeftRight, List, Play, RotateCcw } from 'lucide-react';
import { LevelBadge, LevelTabs, Loading, PageHeader, ProgressBar, SpeakButton } from '../components/ui';
import { useT } from '../lib/i18n';
import { get, logActivity, set as setStore, today, useSettings, useStore } from '../lib/storage';
import { availableLevels, loadVocab, shuffle, useAsync } from '../lib/data';
import { isDue, isLearned, previewInterval, review, type Grade } from '../lib/srs';
import { speak } from '../lib/tts';
import type { Level, VocabItem } from '../types';

function Card({
  item,
  reverse,
  flipped,
  onFlip,
}: {
  item: VocabItem;
  reverse: boolean;
  flipped: boolean;
  onFlip: () => void;
}) {
  const { lang } = useT();
  const meaning = lang === 'zh' ? item.zh : item.en;
  const other = lang === 'zh' ? item.en : item.zh;
  return (
    <div className={`flashcard ${flipped ? 'flipped' : ''}`} onClick={onFlip} role="button" tabIndex={0} aria-label="Flip card">
      <div className="flashcard-face">
        <span className="pos">{item.pos}</span>
        {reverse ? (
          <>
            <div className="fc-meaning">{meaning}</div>
            <div className="muted">{other}</div>
          </>
        ) : (
          <div className="fc-word">
            {item.fr} <SpeakButton text={item.fr.replace(/\s*\((m|f)\.\)/, '')} />
          </div>
        )}
        {flipped && (
          <div className="fc-back">
            {reverse ? (
              <div className="fc-word">
                {item.fr} <SpeakButton text={item.fr.replace(/\s*\((m|f)\.\)/, '')} />
              </div>
            ) : (
              <>
                <div className="fc-meaning">{meaning}</div>
                <div className="muted small">{other}</div>
              </>
            )}
            <div className="fc-example">
              <div>
                {item.ex} <SpeakButton text={item.ex} />
              </div>
              <div className="muted small">{lang === 'zh' ? item.exZh : item.exEn}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Flashcards() {
  const { t, lang } = useT();
  const [params, setParams] = useSearchParams();
  const levels = availableLevels('vocab');
  const level = (levels.includes(params.get('level') as Level) ? params.get('level') : levels[0] ?? 'A1') as Level;
  const items = useAsync(() => loadVocab(level), [level]);
  const [srs] = useStore('srs');
  const [srsNew] = useStore('srsNew');
  const [settings, setSettings] = useSettings();
  const [topic, setTopic] = useState('all');
  const [reverse, setReverse] = useState(false);
  const [mode, setMode] = useState<'home' | 'study' | 'browse'>('home');
  const [queue, setQueue] = useState<VocabItem[]>([]);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);

  useEffect(() => {
    setTopic('all');
    setMode('home');
  }, [level]);

  const pool = useMemo(() => (items ?? []).filter((v) => topic === 'all' || v.topic === topic), [items, topic]);
  const topics = useMemo(() => [...new Set((items ?? []).map((v) => v.topic))].sort(), [items]);
  const stats = useMemo(() => {
    const now = Date.now();
    return {
      total: pool.length,
      fresh: pool.filter((v) => !srs[v.id]).length,
      due: pool.filter((v) => isDue(srs[v.id], now)).length,
      learned: pool.filter((v) => isLearned(srs[v.id])).length,
    };
  }, [pool, srs]);
  const newLeftToday = Math.max(0, settings.newPerDay - (srsNew[today()] ?? 0));

  const start = () => {
    const now = Date.now();
    const due = pool.filter((v) => isDue(srs[v.id], now)).sort((a, b) => srs[a.id].due - srs[b.id].due);
    const fresh = pool.filter((v) => !srs[v.id]).slice(0, newLeftToday);
    setQueue([...shuffle(due), ...fresh]);
    setReviewed(0);
    setFlipped(false);
    setMode('study');
  };

  const current = queue[0];

  const grade = useCallback(
    (g: Grade) => {
      if (!current) return;
      const before = get('srs')[current.id];
      if (!before) setStore('srsNew', (n) => ({ ...n, [today()]: (n[today()] ?? 0) + 1 }));
      setStore('srs', (s) => ({ ...s, [current.id]: review(s[current.id], g) }));
      logActivity();
      setReviewed((r) => r + 1);
      setFlipped(false);
      setQueue((q) => {
        const rest = q.slice(1);
        if (g === 0) rest.splice(Math.min(3, rest.length), 0, current);
        return rest;
      });
    },
    [current],
  );

  useEffect(() => {
    if (mode !== 'study') return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (!flipped) {
          setFlipped(true);
          if (current && reverse) speak(current.fr);
        }
      } else if (flipped && ['1', '2', '3', '4'].includes(e.key)) grade((Number(e.key) - 1) as Grade);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, flipped, grade, current, reverse]);

  if (!items) return <Loading />;

  const levelSelect = (
    <LevelTabs
      levels={levels}
      value={level}
      onChange={(l) => setParams({ level: l })}
    />
  );

  if (mode === 'study') {
    return (
      <div className="study">
        <div className="study-top">
          <button className="btn ghost small" onClick={() => setMode('home')}>
            ← {t('c.back')}
          </button>
          <LevelBadge level={level} />
          <span className="muted small">
            {queue.length} {t('fc.remaining')}
          </span>
        </div>
        <ProgressBar value={reviewed} max={reviewed + queue.length} />
        {current ? (
          <>
            <Card
              item={current}
              reverse={reverse}
              flipped={flipped}
              onFlip={() => {
                if (!flipped) {
                  setFlipped(true);
                  if (reverse) speak(current.fr);
                }
              }}
            />
            {!flipped ? (
              <button className="btn primary large block" onClick={() => setFlipped(true)}>
                {t('fc.showAnswer')} <kbd>Space</kbd>
              </button>
            ) : (
              <div className="grade-row">
                {([0, 1, 2, 3] as Grade[]).map((g) => (
                  <button key={g} className={`grade g${g}`} onClick={() => grade(g)}>
                    <span>{t((['fc.again', 'fc.hard', 'fc.good', 'fc.easy'] as const)[g])}</span>
                    <span className="small">{previewInterval(srs[current.id], g)}</span>
                    <kbd>{g + 1}</kbd>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="card center finished">
            <h2>🎉 {t('fc.finished')}</h2>
            <p className="muted">
              {reviewed} {lang === 'zh' ? '张卡片已复习' : 'cards reviewed'}
            </p>
            <button className="btn" onClick={() => setMode('home')}>
              {t('c.back')}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t('fc.title')} sub={t('fc.sub')} />
      {levelSelect}
      <div className="fc-home card">
        <div className="fc-stats">
          <div>
            <div className="stat-value">{stats.due}</div>
            <div className="stat-label">{t('fc.due')}</div>
          </div>
          <div>
            <div className="stat-value">{Math.min(stats.fresh, newLeftToday)}</div>
            <div className="stat-label">
              {t('fc.new')} <span className="muted">/ {stats.fresh}</span>
            </div>
          </div>
          <div>
            <div className="stat-value">{stats.learned}</div>
            <div className="stat-label">{t('fc.learned')}</div>
          </div>
          <div>
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">{t('fc.total')}</div>
          </div>
        </div>
        <div className="fc-controls">
          <label className="field">
            <span>{t('fc.topic')}</span>
            <select value={topic} onChange={(e) => setTopic(e.target.value)}>
              <option value="all">{t('c.all')}</option>
              {topics.map((tp) => (
                <option key={tp} value={tp}>
                  {tp}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t('fc.newPerDay')}</span>
            <select value={settings.newPerDay} onChange={(e) => setSettings({ newPerDay: Number(e.target.value) })}>
              {[5, 10, 15, 20, 30, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <button className="btn" onClick={() => setReverse((r) => !r)} aria-pressed={reverse}>
            <ArrowLeftRight size={16} /> {reverse ? t('fc.reverse') : t('fc.forward')}
          </button>
        </div>
        <div className="row">
          <button className="btn primary large" onClick={start} disabled={stats.due === 0 && Math.min(stats.fresh, newLeftToday) === 0}>
            <Play size={18} /> {t('fc.study')}
          </button>
          <button className="btn large" onClick={() => setMode(mode === 'browse' ? 'home' : 'browse')}>
            <List size={18} /> {t('fc.browse')}
          </button>
        </div>
        {stats.due === 0 && Math.min(stats.fresh, newLeftToday) === 0 && <p className="muted small">{t('fc.nothing')}</p>}
      </div>

      {mode === 'browse' && (
        <div className="table-wrap">
          <table className="vocab-table">
            <thead>
              <tr>
                <th>Français</th>
                <th>{lang === 'zh' ? '释义' : 'Meaning'}</th>
                <th className="hide-sm">{lang === 'zh' ? '例句' : 'Example'}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pool.map((v) => {
                const c = srs[v.id];
                return (
                  <tr key={v.id}>
                    <td>
                      <SpeakButton text={v.fr.replace(/\s*\((m|f)\.\)/, '')} /> <strong>{v.fr}</strong> <span className="muted small">{v.pos}</span>
                    </td>
                    <td>
                      {lang === 'zh' ? v.zh : v.en}
                      <div className="muted small">{lang === 'zh' ? v.en : v.zh}</div>
                    </td>
                    <td className="hide-sm small">{v.ex}</td>
                    <td>
                      {c ? (
                        isLearned(c) ? (
                          <span className="badge ok">✓</span>
                        ) : (
                          <button
                            className="icon-btn"
                            title={t('c.reset')}
                            onClick={() =>
                              setStore('srs', (s) => {
                                const n = { ...s };
                                delete n[v.id];
                                return n;
                              })
                            }
                          >
                            <RotateCcw size={14} />
                          </button>
                        )
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
