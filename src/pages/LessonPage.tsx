import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Lightbulb, PartyPopper, RotateCcw, Volume2, X } from 'lucide-react';
import Md, { Inline } from '../components/Md';
import { LevelBadge, Loading, Options, ProgressBar, SpeakButton } from '../components/ui';
import { useT, pick, tr } from '../lib/i18n';
import { logActivity, set as setStore, useStore } from '../lib/storage';
import { loadLessons, normalize, shuffle, useAsync } from '../lib/data';
import { ttsSupported, useSpeaker } from '../lib/tts';
import type { Exercise, LessonSection, Level } from '../types';
import { LEVELS } from '../types';

function Section({ s, lang }: { s: LessonSection; lang: 'en' | 'zh' }) {
  switch (s.type) {
    case 'text':
      return <Md text={tr(s, lang)} className="lesson-text" />;
    case 'tip':
      return (
        <div className="callout tip">
          <Lightbulb size={18} />
          <Md text={tr(s, lang)} />
        </div>
      );
    case 'table':
      return (
        <div className="table-wrap">
          <table>
            {s.caption && <caption>{s.caption}</caption>}
            <thead>
              <tr>
                {s.headers.map((h, i) => (
                  <th key={i}>
                    <Inline text={h} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {s.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) => (
                    <td key={j}>
                      <Inline text={c} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'examples':
      return (
        <ul className="examples">
          {s.items.map((it, i) => (
            <li key={i}>
              <SpeakButton text={it.fr} />
              <div>
                <div className="ex-fr">{it.fr}</div>
                <div className="muted small">{lang === 'zh' ? it.zh : it.en}</div>
              </div>
            </li>
          ))}
        </ul>
      );
  }
}

type Result = boolean | null;

function McqEx({ x, onDone }: { x: Extract<Exercise, { type: 'mcq' }>; onDone: (ok: boolean) => void }) {
  const { lang } = useT();
  const [chosen, setChosen] = useState<number | null>(null);
  const expl = lang === 'zh' ? x.explanationZh : x.explanationEn;
  return (
    <>
      <p className="ex-prompt">
        <Inline text={x.prompt} />
      </p>
      <Options
        options={x.options}
        answer={x.answer}
        chosen={chosen}
        reveal={chosen !== null}
        onChoose={(i) => {
          setChosen(i);
          onDone(i === x.answer);
        }}
      />
      {chosen !== null && expl && <Md className="small muted ex-expl" text={expl} />}
    </>
  );
}

function FillEx({ x, onDone }: { x: Extract<Exercise, { type: 'fill' }>; onDone: (ok: boolean) => void }) {
  const { t, lang } = useT();
  const [value, setValue] = useState('');
  const [state, setState] = useState<'idle' | 'ok' | 'accent' | 'wrong'>('idle');
  const [before, after] = x.prompt.split('___');
  const check = () => {
    if (!value.trim()) return;
    const exact = x.answers.some((a) => normalize(a) === normalize(value));
    const loose = x.answers.some((a) => normalize(a, false) === normalize(value, false));
    const s = exact ? 'ok' : loose ? 'accent' : 'wrong';
    setState(s);
    onDone(s !== 'wrong');
  };
  const translation = lang === 'zh' ? x.zh : x.en;
  return (
    <>
      <form
        className="fill"
        onSubmit={(e) => {
          e.preventDefault();
          check();
        }}
      >
        <span>{before}</span>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={state !== 'idle'}
          aria-label={t('learn.typeAnswer')}
          placeholder="…"
          size={Math.max(6, (x.answers[0]?.length ?? 6) + 2)}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className={state === 'idle' ? '' : state === 'wrong' ? 'wrong' : 'correct'}
        />
        <span>{after}</span>
        {x.hint && <span className="muted small"> {x.hint}</span>}
        {state === 'idle' && (
          <button className="btn small primary" type="submit" disabled={!value.trim()}>
            {t('c.check')}
          </button>
        )}
      </form>
      <AccentKeys onKey={(k) => setValue((v) => v + k)} disabled={state !== 'idle'} />
      {translation && <p className="muted small">{translation}</p>}
      {state === 'accent' && (
        <p className="feedback ok small">
          {t('learn.accentNote')} <strong>{x.answers[0]}</strong>
        </p>
      )}
      {state === 'wrong' && (
        <p className="feedback bad small">
          {t('c.answer')}: <strong>{x.answers[0]}</strong>
        </p>
      )}
    </>
  );
}

export function AccentKeys({ onKey, disabled }: { onKey: (k: string) => void; disabled?: boolean }) {
  return (
    <div className="accent-keys" aria-label="French characters">
      {['é', 'è', 'ê', 'à', 'â', 'ç', 'ô', 'î', 'ï', 'ù', 'û', 'œ'].map((k) => (
        <button key={k} type="button" className="key" disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => onKey(k)}>
          {k}
        </button>
      ))}
    </div>
  );
}

function ListenEx({ x, onDone }: { x: Extract<Exercise, { type: 'listen' }>; onDone: (ok: boolean) => void }) {
  const { t } = useT();
  const sp = useSpeaker();
  const [chosen, setChosen] = useState<number | null>(null);
  return (
    <>
      <p className="ex-prompt">{t('learn.whatHeard')}</p>
      {ttsSupported() ? (
        <button className={`btn listen-btn ${sp.playing ? 'playing' : ''}`} onClick={() => sp.play(x.text)}>
          <Volume2 size={18} /> {t('c.play')}
        </button>
      ) : (
        <p className="callout warn small">{t('c.listenNoSupport')}</p>
      )}
      <Options
        options={x.options}
        answer={x.answer}
        chosen={chosen}
        reveal={chosen !== null}
        onChoose={(i) => {
          setChosen(i);
          onDone(i === x.answer);
        }}
      />
    </>
  );
}

function OrderEx({ x, onDone }: { x: Extract<Exercise, { type: 'order' }>; onDone: (ok: boolean) => void }) {
  const { t, lang } = useT();
  const pool = useMemo(() => {
    const tiles = x.words.map((w, i) => ({ w, i }));
    let s = shuffle(tiles);
    for (let n = 0; n < 5 && s.map((t) => t.w).join(' ') === x.answer; n++) s = shuffle(tiles);
    return s;
  }, [x]);
  const [picked, setPicked] = useState<number[]>([]);
  const [state, setState] = useState<'idle' | 'ok' | 'wrong'>('idle');
  const sentence = picked.map((i) => x.words[i]).join(' ');
  const translation = lang === 'zh' ? x.zh : x.en;
  return (
    <>
      <p className="ex-prompt">{t('learn.tapWords')}</p>
      {translation && <p className="muted small">{translation}</p>}
      <div className={`order-answer ${state}`}>
        {picked.length === 0 && <span className="muted small">…</span>}
        {picked.map((i, n) => (
          <button key={n} className="tile" disabled={state !== 'idle'} onClick={() => setPicked((p) => p.filter((_, k) => k !== n))}>
            {x.words[i]}
          </button>
        ))}
      </div>
      <div className="order-pool">
        {pool.map(({ w, i }) => (
          <button key={i} className="tile" disabled={picked.includes(i) || state !== 'idle'} onClick={() => setPicked((p) => [...p, i])}>
            {w}
          </button>
        ))}
      </div>
      {state === 'idle' ? (
        <button
          className="btn small primary"
          disabled={picked.length !== x.words.length}
          onClick={() => {
            const ok = normalize(sentence) === normalize(x.answer);
            setState(ok ? 'ok' : 'wrong');
            onDone(ok);
          }}
        >
          {t('c.check')}
        </button>
      ) : (
        <div className="row">
          <SpeakButton text={x.answer} />
          {state === 'wrong' && (
            <span className="feedback bad small">
              {t('c.answer')}: <strong>{x.answer}</strong>
            </span>
          )}
        </div>
      )}
    </>
  );
}

function ExerciseCard({ x, index, onResult }: { x: Exercise; index: number; onResult: (ok: boolean) => void }) {
  const [result, setResult] = useState<Result>(null);
  const done = (ok: boolean) => {
    setResult(ok);
    onResult(ok);
  };
  return (
    <div className={`exercise card ${result === null ? '' : result ? 'ok' : 'bad'}`}>
      <div className="exercise-head">
        <span className="ex-num">{index + 1}</span>
        {result !== null && (result ? <Check className="ok-icon" size={18} /> : <X className="bad-icon" size={18} />)}
      </div>
      {x.type === 'mcq' && <McqEx x={x} onDone={done} />}
      {x.type === 'fill' && <FillEx x={x} onDone={done} />}
      {x.type === 'listen' && <ListenEx x={x} onDone={done} />}
      {x.type === 'order' && <OrderEx x={x} onDone={done} />}
    </div>
  );
}

export default function LessonPage() {
  const { id = '' } = useParams();
  const { t, lang } = useT();
  const level = (id.slice(0, 2).toUpperCase() as Level) || 'A1';
  const lessons = useAsync(() => (LEVELS.includes(level) ? loadLessons(level) : Promise.resolve([])), [level]);
  const nextLevelLessons = useAsync(() => {
    const nl = LEVELS[LEVELS.indexOf(level) + 1];
    return nl ? loadLessons(nl) : Promise.resolve([]);
  }, [level]);
  const [records] = useStore('lessons');
  const [results, setResults] = useState<Record<number, boolean>>({});
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setResults({});
    setAttempt(0);
  }, [id]);

  if (!lessons) return <Loading />;
  const idx = lessons.findIndex((l) => l.id === id);
  const lesson = lessons[idx];
  if (!lesson) return <p className="muted">{t('c.empty')}</p>;
  const next = lessons[idx + 1] ?? nextLevelLessons?.[0];
  const prev = lessons[idx - 1];
  const total = lesson.exercises.length;
  const answered = Object.keys(results).length;
  const score = Object.values(results).filter(Boolean).length;
  const finished = answered === total;
  const rec = records[lesson.id];

  const onResult = (i: number, ok: boolean) => {
    const updated = { ...results, [i]: ok };
    setResults(updated);
    logActivity();
    if (Object.keys(updated).length === total) {
      const s = Object.values(updated).filter(Boolean).length;
      setStore('lessons', (l) => ({
        ...l,
        [lesson.id]: { score: Math.max(s, l[lesson.id]?.score ?? 0), total, completedAt: Date.now() },
      }));
    }
  };

  return (
    <article className="lesson">
      <Link to="/learn" className="back-link">
        <ArrowLeft size={16} /> {t('learn.title')}
      </Link>
      <header className="lesson-header">
        <div className="row">
          <LevelBadge level={lesson.level} />
          <span className="muted small">
            {idx + 1} / {lessons.length}
          </span>
          {rec && (
            <span className="lesson-score small">
              <Check size={14} /> {rec.score}/{rec.total}
            </span>
          )}
        </div>
        <h1>
          {lesson.titleFr} <SpeakButton text={lesson.titleFr} />
        </h1>
        <p className="lead muted">{pick(lesson, 'title', lang)}</p>
        <div className="goals card">
          <strong>{t('learn.goals')}</strong>
          <ul>
            {(lang === 'zh' ? lesson.goalsZh : lesson.goalsEn).map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        </div>
      </header>

      <div className="lesson-body">
        {lesson.sections.map((s, i) => (
          <Section key={i} s={s} lang={lang} />
        ))}
      </div>

      <section className="exercises" key={`${lesson.id}-${attempt}`}>
        <div className="exercises-head">
          <h2>{t('learn.exercises')}</h2>
          <span className="muted small">
            {answered} / {total}
          </span>
        </div>
        <ProgressBar value={answered} max={total} />
        {lesson.exercises.map((x, i) => (
          <ExerciseCard key={i} x={x} index={i} onResult={(ok) => onResult(i, ok)} />
        ))}
      </section>

      {finished ? (
        <div className="complete card">
          <PartyPopper size={28} />
          <div>
            <h3>{t('learn.complete')}</h3>
            <p>
              {t('c.score')}: <strong>{score}</strong> / {total}
            </p>
          </div>
          <div className="row">
            <button
              className="btn"
              onClick={() => {
                setResults({});
                setAttempt((a) => a + 1);
              }}
            >
              <RotateCcw size={16} /> {t('c.retry')}
            </button>
            {next && (
              <Link className="btn primary" to={`/learn/${next.id}`}>
                {t('learn.nextLesson')} <ArrowRight size={16} />
              </Link>
            )}
          </div>
        </div>
      ) : (
        <p className="muted small center">{t('learn.finishExercises')}</p>
      )}

      <nav className="lesson-nav">
        {prev ? (
          <Link to={`/learn/${prev.id}`} className="btn ghost">
            <ArrowLeft size={16} /> {prev.titleFr}
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link to={`/learn/${next.id}`} className="btn ghost">
            {next.titleFr} <ArrowRight size={16} />
          </Link>
        )}
      </nav>
      <p className="center">
        <Link to={`/flashcards?level=${lesson.level}`} className="small">
          {t('learn.practiceVocab')} →
        </Link>
      </p>
    </article>
  );
}
