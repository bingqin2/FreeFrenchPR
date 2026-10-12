import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Clock, FileText, Headphones } from 'lucide-react';
import { LevelBadge, Loading, PageHeader, ProgressBar, formatTime, useTimer } from '../components/ui';
import { QuestionView } from './Practice';
import { useT } from '../lib/i18n';
import { logActivity, recordAnswer, set as setStore, useStore } from '../lib/storage';
import { loadListening, loadReading, shuffle, useAsync } from '../lib/data';
import { EXAM_MIX, POINTS, cefr, nclc } from '../lib/scoring';
import { LEVELS } from '../types';
import type { Level, ListeningQuestion, ReadingQuestion } from '../types';

type Section = 'listening' | 'reading';
type Q = ListeningQuestion | ReadingQuestion;
const DURATION: Record<Section, number> = { listening: 35 * 60, reading: 60 * 60 };

function buildExam(bank: Record<Level, Q[]>): Q[] | null {
  const out: Q[] = [];
  for (const [level, n] of EXAM_MIX) {
    const pool = bank[level] ?? [];
    if (pool.length < n) return null;
    out.push(...shuffle(pool).slice(0, n));
  }
  return out;
}

function Result({ section, questions, choices, seconds, onClose }: { section: Section; questions: Q[]; choices: (number | null)[]; seconds: number; onClose: () => void }) {
  const { t, lang } = useT();
  const [open, setOpen] = useState<number | null>(null);
  const score = questions.reduce((s, q, i) => s + (choices[i] === q.answer ? POINTS[q.level] : 0), 0);
  const correct = questions.filter((q, i) => choices[i] === q.answer).length;
  const level = nclc(score, section);
  const byLevel = LEVELS.map((l) => {
    const qs = questions.map((q, i) => [q, i] as const).filter(([q]) => q.level === l);
    return { l, total: qs.length, ok: qs.filter(([q, i]) => choices[i] === q.answer).length };
  });
  return (
    <div className="exam-result">
      <div className="card result-hero">
        <div>
          <div className="small muted">{t('ex.estimated')}</div>
          <div className="big-score">
            {score}
            <span className="muted"> / 699</span>
          </div>
          <div className="row">
            <span className="badge">{cefr(score)}</span>
            <span className={`badge ${level >= 7 ? 'ok' : ''}`}>{level ? `NCLC ${level}${level === 10 ? '+' : ''}` : 'NCLC < 4'}</span>
            <span className="muted small">
              {correct}/{questions.length} · {formatTime(seconds)}
            </span>
          </div>
        </div>
        <div className="level-bars">
          {byLevel.map((b) => (
            <div key={b.l} className="level-bar">
              <LevelBadge level={b.l} />
              <ProgressBar value={b.ok} max={b.total} />
              <span className="small muted">
                {b.ok}/{b.total}
              </span>
            </div>
          ))}
        </div>
      </div>
      <p className="muted small">{t('ex.disclaimer')}</p>
      <h2>{t('ex.review')}</h2>
      <div className="q-grid">
        {questions.map((q, i) => (
          <button key={q.id} className={`q-cell ${choices[i] === null ? '' : choices[i] === q.answer ? 'ok' : 'bad'} ${open === i ? 'current' : ''}`} onClick={() => setOpen(open === i ? null : i)}>
            {i + 1}
          </button>
        ))}
      </div>
      {open !== null && (
        <div className="card">
          <div className="row">
            <strong>
              {lang === 'zh' ? `第 ${open + 1} 题` : `Question ${open + 1}`}
            </strong>
            <LevelBadge level={questions[open].level} />
            {choices[open] === null && <span className="badge warn">{t('ex.unanswered')}</span>}
          </div>
          <QuestionView q={questions[open]} initialChoice={choices[open] ?? -1} />
        </div>
      )}
      <button className="btn primary" onClick={onClose}>
        {t('c.done')}
      </button>
    </div>
  );
}

function Running({ section, timed, questions, onFinish }: { section: Section; timed: boolean; questions: Q[]; onFinish: (choices: (number | null)[], seconds: number) => void }) {
  const { t } = useT();
  const [pos, setPos] = useState(0);
  const [choices, setChoices] = useState<(number | null)[]>(() => questions.map(() => null));
  const timer = useTimer(timed ? DURATION[section] : 0, true, () => onFinish(choices, DURATION[section]));
  const q = questions[pos];
  const answered = choices.filter((c) => c !== null).length;

  const finish = () => {
    if (answered < questions.length && !window.confirm(t('ex.confirmFinish'))) return;
    onFinish(choices, timer.elapsed);
  };

  return (
    <div className="exam-running">
      <div className="exam-bar card">
        <span className="badge">{section === 'listening' ? 'CO' : 'CE'}</span>
        <span className="small">
          {pos + 1} / {questions.length}
        </span>
        <ProgressBar value={answered} max={questions.length} />
        <span className={`exam-time ${timed && timer.remaining < 300 ? 'warn' : ''}`}>
          <Clock size={14} /> {timed ? formatTime(timer.remaining) : formatTime(timer.elapsed)}
        </span>
        <button className="btn small danger" onClick={finish}>
          {t('ex.finish')}
        </button>
      </div>
      {!timed && (
        <div className="q-grid compact">
          {questions.map((_, i) => (
            <button key={i} className={`q-cell ${choices[i] !== null ? 'answered' : ''} ${i === pos ? 'current' : ''}`} onClick={() => setPos(i)}>
              {i + 1}
            </button>
          ))}
        </div>
      )}
      <div className="row">
        <LevelBadge level={q.level} />
        <span className="muted small">{POINTS[q.level]} pts</span>
      </div>
      <QuestionView
        key={q.id}
        q={q}
        showFeedback={!timed}
        initialChoice={choices[pos]}
        onAnswered={(c, ok) => {
          setChoices((cs) => Object.assign([...cs], { [pos]: c }));
          recordAnswer(q.id, c, ok);
        }}
      />
      <div className="lesson-nav">
        {!timed ? (
          <button className="btn ghost" disabled={pos === 0} onClick={() => setPos((p) => p - 1)}>
            ← {t('c.prev')}
          </button>
        ) : (
          <span />
        )}
        {pos < questions.length - 1 ? (
          <button className="btn primary" onClick={() => setPos((p) => p + 1)}>
            {t('c.next')} <ArrowRight size={16} />
          </button>
        ) : (
          <button className="btn primary" onClick={finish}>
            {t('ex.finish')}
          </button>
        )}
      </div>
    </div>
  );
}

export default function Exam() {
  const { t, lang } = useT();
  const [section, setSection] = useState<Section>('listening');
  const [timed, setTimed] = useState(true);
  const [history] = useStore('exams');
  const banks = useAsync(
    () =>
      Promise.all([Promise.all(LEVELS.map(loadListening)), Promise.all(LEVELS.map(loadReading))]).then(([l, r]) => ({
        listening: Object.fromEntries(LEVELS.map((lv, i) => [lv, l[i]])) as Record<Level, Q[]>,
        reading: Object.fromEntries(LEVELS.map((lv, i) => [lv, r[i]])) as Record<Level, Q[]>,
      })),
    [],
  );
  const [running, setRunning] = useState<Q[] | null>(null);
  const [result, setResult] = useState<{ choices: (number | null)[]; seconds: number } | null>(null);
  const ready = useMemo(
    () => ({
      listening: !!banks && EXAM_MIX.every(([l, n]) => (banks.listening[l]?.length ?? 0) >= n),
      reading: !!banks && EXAM_MIX.every(([l, n]) => (banks.reading[l]?.length ?? 0) >= n),
    }),
    [banks],
  );

  useEffect(() => {
    if (!running || result) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [running, result]);

  if (!banks) return <Loading />;

  if (running && result)
    return (
      <Result
        section={section}
        questions={running}
        choices={result.choices}
        seconds={result.seconds}
        onClose={() => {
          setRunning(null);
          setResult(null);
        }}
      />
    );

  if (running)
    return (
      <Running
        section={section}
        timed={timed}
        questions={running}
        onFinish={(choices, seconds) => {
          const score = running.reduce((s, q, i) => s + (choices[i] === q.answer ? POINTS[q.level] : 0), 0);
          setStore('exams', (h) => [
            ...h,
            {
              id: String(Date.now()),
              section,
              at: Date.now(),
              score,
              correct: running.filter((q, i) => choices[i] === q.answer).length,
              total: running.length,
              seconds: Math.round(seconds),
              timed,
            },
          ]);
          logActivity(5);
          setResult({ choices, seconds });
        }}
      />
    );

  return (
    <div>
      <PageHeader title={t('ex.title')} sub={t('ex.sub')} />
      <div className="exam-setup">
        <div className="choice-grid">
          {(['listening', 'reading'] as Section[]).map((s) => (
            <button key={s} className={`choice card ${section === s ? 'active' : ''}`} onClick={() => setSection(s)} aria-pressed={section === s}>
              {s === 'listening' ? <Headphones /> : <FileText />}
              <strong>{s === 'listening' ? t('ex.listening') : t('ex.reading')}</strong>
              <span className="muted small">39 {t('c.questions')}</span>
              {!ready[s] && <span className="badge warn small">{t('ex.notEnough')}</span>}
            </button>
          ))}
        </div>
        <div className="radio-list">
          <label>
            <input type="radio" checked={timed} onChange={() => setTimed(true)} /> {t('ex.timed')}
          </label>
          <label>
            <input type="radio" checked={!timed} onChange={() => setTimed(false)} /> {t('ex.free')}
          </label>
        </div>
        <button
          className="btn primary large"
          disabled={!ready[section]}
          onClick={() => {
            const qs = buildExam(banks[section]);
            if (qs) setRunning(qs);
          }}
        >
          {t('ex.begin')} <ArrowRight size={18} />
        </button>
        <p className="muted small">{t('ex.disclaimer')}</p>
      </div>

      {history.length > 0 && (
        <section>
          <h2>{t('ex.history')}</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{lang === 'zh' ? '日期' : 'Date'}</th>
                  <th>{lang === 'zh' ? '科目' : 'Section'}</th>
                  <th>{t('c.score')}</th>
                  <th>NCLC</th>
                  <th>{lang === 'zh' ? '正确' : 'Correct'}</th>
                </tr>
              </thead>
              <tbody>
                {[...history].reverse().map((h) => (
                  <tr key={h.id}>
                    <td>{new Date(h.at).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-CA')}</td>
                    <td>{h.section === 'listening' ? t('nav.listening') : t('nav.reading')}</td>
                    <td>
                      <strong>{h.score}</strong> · {cefr(h.score)}
                    </td>
                    <td>{nclc(h.score, h.section) || '< 4'}</td>
                    <td>
                      {h.correct}/{h.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
