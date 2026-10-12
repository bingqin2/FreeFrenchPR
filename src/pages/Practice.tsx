import { useEffect, useMemo, useState } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Eye, EyeOff, RotateCcw } from 'lucide-react';
import Md from '../components/Md';
import { AudioPlayer, FavButton, LevelBadge, LevelTabs, Loading, NoteBox, Options, PageHeader, ProgressBar, Transcript } from '../components/ui';
import { useT } from '../lib/i18n';
import { recordAnswer, useStore } from '../lib/storage';
import { availableLevels, loadListening, loadReading, useAsync } from '../lib/data';
import type { Level, ListeningQuestion, ReadingQuestion } from '../types';

type Q = ListeningQuestion | ReadingQuestion;
type Filter = 'all' | 'wrong' | 'new' | 'fav';
const isListening = (q: Q): q is ListeningQuestion => 'script' in q;

export function QuestionView({
  q,
  onAnswered,
  showFeedback = true,
  initialChoice = null,
}: {
  q: Q;
  onAnswered?: (choice: number, correct: boolean) => void;
  showFeedback?: boolean;
  initialChoice?: number | null;
}) {
  const { t, lang } = useT();
  const [chosen, setChosen] = useState<number | null>(initialChoice);
  const [showScript, setShowScript] = useState(false);
  useEffect(() => {
    setChosen(initialChoice);
    setShowScript(false);
  }, [q.id, initialChoice]);
  const revealed = showFeedback && chosen !== null;

  return (
    <div className="question">
      {isListening(q) ? (
        <>
          {q.context && (
            <p className="context">
              <span className="small muted">{t('p.context')} · </span>
              {q.context}
            </p>
          )}
          <AudioPlayer script={q.script} autoKey={q.id} />
        </>
      ) : (
        <div className="passage card">
          {q.title && <h3 className="passage-title">{q.title}</h3>}
          <Md text={q.passage} />
        </div>
      )}
      <p className="q-text">{q.question}</p>
      <Options
        options={q.options}
        answer={q.answer}
        chosen={chosen}
        reveal={revealed}
        onChoose={(i) => {
          if (revealed) return;
          setChosen(i);
          onAnswered?.(i, i === q.answer);
        }}
      />
      {revealed && (
        <div className={`feedback-box ${chosen === q.answer ? 'ok' : 'bad'}`}>
          <strong>{chosen === q.answer ? t('c.correct') : t('c.wrong')}</strong>
          <Md text={lang === 'zh' ? q.explanationZh : q.explanationEn} />
          {isListening(q) && (
            <>
              <button className="btn small ghost" onClick={() => setShowScript((s) => !s)}>
                {showScript ? <EyeOff size={14} /> : <Eye size={14} />} {showScript ? t('c.hideTranscript') : t('c.showTranscript')}
              </button>
              {showScript && <Transcript script={q.script} />}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function Practice() {
  const { skill = 'listening' } = useParams();
  const { t, lang } = useT();
  const [params, setParams] = useSearchParams();
  const listening = skill === 'listening';
  const levels = availableLevels(listening ? 'listening' : 'reading');
  const level = (levels.includes(params.get('level') as Level) ? params.get('level') : levels[0] ?? 'A1') as Level;
  const questions = useAsync<Q[]>(() => (listening ? loadListening(level) : loadReading(level)), [skill, level]);
  const [answers] = useStore('answers');
  const [favs] = useStore('favorites');
  const [filter, setFilter] = useState<Filter>('all');
  const [set, setSet] = useState<Q[] | null>(null);
  const [pos, setPos] = useState(0);

  useEffect(() => {
    setSet(null);
    setPos(0);
  }, [skill, level]);

  const filtered = useMemo(() => {
    const qs = questions ?? [];
    if (filter === 'wrong') return qs.filter((q) => answers[q.id] && !answers[q.id].correct);
    if (filter === 'new') return qs.filter((q) => !answers[q.id]);
    if (filter === 'fav') return qs.filter((q) => favs.includes(q.id));
    return qs;
    // Only recompute when the set changes, not after every answer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions, filter, set === null]);

  if (skill !== 'listening' && skill !== 'reading') return <Navigate to="/practice/listening" replace />;

  const title = listening ? t('p.listeningTitle') : t('p.readingTitle');

  if (set) {
    const q = set[pos];
    const finished = pos >= set.length;
    const correctInSet = set.filter((x) => answers[x.id]?.correct).length;
    return (
      <div className="practice">
        <div className="study-top">
          <button className="btn ghost small" onClick={() => setSet(null)}>
            <ArrowLeft size={16} /> {t('c.back')}
          </button>
          <LevelBadge level={level} />
          <span className="muted small">
            {Math.min(pos + 1, set.length)} / {set.length}
          </span>
        </div>
        <ProgressBar value={pos} max={set.length} />
        {finished ? (
          <div className="card center finished">
            <h2>{t('p.finished')}</h2>
            <p className="big-score">
              {correctInSet} / {set.length}
            </p>
            <div className="row center">
              <button className="btn" onClick={() => setPos(0)}>
                <RotateCcw size={16} /> {t('c.retry')}
              </button>
              <button className="btn primary" onClick={() => setSet(null)}>
                {t('c.done')}
              </button>
            </div>
          </div>
        ) : (
          <>
            {listening && pos === 0 && <p className="muted small">{t('p.listenFirst')}</p>}
            <div className="q-tools">
              <span className="muted small">{q.id}</span>
              <FavButton id={q.id} />
            </div>
            <QuestionView q={q} onAnswered={(c, ok) => recordAnswer(q.id, c, ok)} />
            <NoteBox id={q.id} />
            <div className="lesson-nav">
              <button className="btn ghost" disabled={pos === 0} onClick={() => setPos((p) => p - 1)}>
                <ArrowLeft size={16} /> {t('c.prev')}
              </button>
              <button className="btn primary" onClick={() => setPos((p) => p + 1)}>
                {t('c.next')} <ArrowRight size={16} />
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  const qs = questions ?? [];
  const done = qs.filter((q) => answers[q.id]).length;
  const right = qs.filter((q) => answers[q.id]?.correct).length;

  return (
    <div>
      <PageHeader title={title} sub={t('p.sub')} />
      <LevelTabs levels={levels} value={level} onChange={(l) => setParams({ level: l })} />
      {!questions ? (
        <Loading />
      ) : (
        <>
          <div className="card practice-summary">
            <div className="fc-stats">
              <div>
                <div className="stat-value">{qs.length}</div>
                <div className="stat-label">{t('c.questions')}</div>
              </div>
              <div>
                <div className="stat-value">{done}</div>
                <div className="stat-label">{lang === 'zh' ? '已做' : 'Done'}</div>
              </div>
              <div>
                <div className="stat-value">{done ? Math.round((right / done) * 100) : 0}%</div>
                <div className="stat-label">{lang === 'zh' ? '正确率' : 'Accuracy'}</div>
              </div>
            </div>
            <div className="chips">
              {(
                [
                  ['all', t('p.practiceAll')],
                  ['new', t('p.practiceNew')],
                  ['wrong', t('p.practiceWrong')],
                  ['fav', t('p.practiceFav')],
                ] as [Filter, string][]
              ).map(([f, label]) => (
                <button key={f} className={`chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                  {label}
                </button>
              ))}
            </div>
            {filtered.length === 0 ? (
              <p className="muted">{filter === 'wrong' ? t('p.noWrong') : t('c.empty')}</p>
            ) : (
              <button
                className="btn primary large"
                onClick={() => {
                  setSet(filtered);
                  setPos(0);
                }}
              >
                {t('c.start')} · {filtered.length} {t('c.questions')}
              </button>
            )}
          </div>
          <div className="q-grid">
            {qs.map((q, i) => {
              const a = answers[q.id];
              return (
                <button
                  key={q.id}
                  className={`q-cell ${a ? (a.correct ? 'ok' : 'bad') : ''} ${favs.includes(q.id) ? 'fav' : ''}`}
                  title={q.question}
                  onClick={() => {
                    setSet(qs);
                    setPos(i);
                  }}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          <p className="muted small legend">
            <span className="q-cell ok mini" /> {t('c.right')} <span className="q-cell bad mini" /> {t('c.wrongShort')} <span className="q-cell mini" /> {t('c.unseen')}
          </p>
        </>
      )}
    </div>
  );
}
