import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Bot, CheckSquare, Eye, EyeOff, Pause, Play, SpellCheck, Timer } from 'lucide-react';
import Md from '../components/Md';
import { LevelBadge, Loading, PageHeader, SpeakButton, formatTime, useTimer } from '../components/ui';
import { AccentKeys } from './LessonPage';
import { useT, pick } from '../lib/i18n';
import { logActivity, set as setStore, useStore } from '../lib/storage';
import { loadWriting, useAsync } from '../lib/data';
import type { WritingTask } from '../types';

export const countWords = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

const SUGGESTED_MIN: Record<number, number> = { 1: 10, 2: 20, 3: 30 };

const CHECKLIST: Record<number, { en: string; zh: string }[]> = {
  1: [
    { en: 'I greet and sign off appropriately (Salut / Bonjour …, À bientôt / Cordialement)', zh: '有恰当的称呼和结尾（Salut / Bonjour……，À bientôt / Cordialement）' },
    { en: 'I answer every point the instructions ask for', zh: '回应了题目要求的每一个要点' },
    { en: 'I use tu or vous consistently for the person I write to', zh: '对收信人统一使用 tu 或 vous' },
    { en: 'Verbs agree with their subjects; past participles agree when needed', zh: '动词与主语一致；过去分词在需要时配合' },
  ],
  2: [
    { en: 'My text has a title or clear opening, and paragraphs', zh: '有标题或清晰的开头，并分段' },
    { en: 'I narrate with passé composé + imparfait correctly', zh: '正确使用复合过去时和未完成过去时叙述' },
    { en: 'I give my opinion and justify it', zh: '表达了自己的观点并说明理由' },
    { en: 'I use connectors (d’abord, ensuite, cependant, finalement…)', zh: '使用了连接词（d’abord、ensuite、cependant、finalement……）' },
  ],
  3: [
    { en: 'Part 1 summarises BOTH documents neutrally (40–60 words)', zh: '第一部分客观概括两篇文档的观点（40–60 词）' },
    { en: 'Part 2 states my own position and defends it with arguments and examples (80–120 words)', zh: '第二部分明确表达自己的立场，并用论据和例子支撑（80–120 词）' },
    { en: 'I don’t copy whole sentences from the documents', zh: '没有照抄文档中的整句话' },
    { en: 'I use concession and contrast (certes… mais, en revanche, néanmoins)', zh: '使用了让步和对比（certes… mais、en revanche、néanmoins）' },
  ],
};

interface LtMatch {
  message: string;
  offset: number;
  length: number;
  replacements: { value: string }[];
  rule: { issueType: string };
}

function GrammarCheck({ text, onApply }: { text: string; onApply: (offset: number, length: number, value: string) => void }) {
  const { t } = useT();
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [matches, setMatches] = useState<LtMatch[]>([]);
  const [checked, setChecked] = useState('');
  const run = async () => {
    setState('loading');
    try {
      const res = await fetch('https://api.languagetool.org/v2/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ text, language: 'fr' }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      setMatches(data.matches ?? []);
      setChecked(text);
      setState('done');
    } catch {
      setState('error');
    }
  };
  const stale = state === 'done' && checked !== text;
  return (
    <div className="grammar card">
      <div className="row">
        <button className="btn" onClick={run} disabled={state === 'loading' || !text.trim()}>
          <SpellCheck size={16} /> {state === 'loading' ? t('c.loading') : t('w.grammar')}
        </button>
        <span className="muted small">{t('w.grammarNote')}</span>
      </div>
      {state === 'error' && <p className="feedback bad small">LanguageTool is unavailable right now (rate limit or offline). Try again in a minute.</p>}
      {state === 'done' && matches.length === 0 && <p className="feedback ok small">{t('w.noIssues')}</p>}
      {state === 'done' && matches.length > 0 && (
        <>
          <p className="small">
            <strong>{matches.length}</strong> {t('w.issues')}
            {stale && <span className="muted"> · text changed since the check</span>}
          </p>
          <ul className="lt-list">
            {matches.map((m, i) => (
              <li key={i} className={`lt-${m.rule.issueType}`}>
                <span className="lt-err">{checked.slice(m.offset, m.offset + m.length)}</span>
                <span className="small">{m.message}</span>
                {!stale &&
                  m.replacements.slice(0, 3).map((r) => (
                    <button
                      key={r.value}
                      className="chip"
                      onClick={() => {
                        onApply(m.offset, m.length, r.value);
                        const delta = r.value.length - m.length;
                        setMatches((ms) => ms.filter((x) => x !== m).map((x) => (x.offset > m.offset ? { ...x, offset: x.offset + delta } : x)));
                        setChecked((c) => c.slice(0, m.offset) + r.value + c.slice(m.offset + m.length));
                      }}
                    >
                      → {r.value}
                    </button>
                  ))}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function aiPrompt(task: WritingTask, text: string) {
  const docs = task.documents?.map((d) => `### ${d.title}\n${d.text}`).join('\n\n') ?? '';
  return `You are an experienced TCF Canada examiner. Grade my answer to Expression écrite task ${task.task} (required length ${task.minWords}–${task.maxWords} words).

Task instructions:
${task.promptFr}
${docs ? `\nDocuments:\n${docs}\n` : ''}
My answer (${countWords(text)} words):
"""
${text}
"""

Please:
1. Give an estimated score out of 20 and the corresponding NCLC level, with a short justification (task completion, coherence, vocabulary range, grammatical accuracy).
2. List every grammar, spelling and agreement mistake with the correction and a one-line explanation.
3. Suggest 5 more advanced words or structures I could have used.
4. Rewrite my text as an improved version at NCLC 9 level, keeping my ideas.`;
}

function TaskView({ task }: { task: WritingTask }) {
  const { t, lang } = useT();
  const [drafts] = useStore('drafts');
  const [text, setText] = useState(drafts[task.id]?.text ?? '');
  const [showModel, setShowModel] = useState(false);
  const [showTr, setShowTr] = useState(false);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [checks, setChecks] = useState<boolean[]>([]);
  const area = useRef<HTMLTextAreaElement>(null);
  const total = (SUGGESTED_MIN[task.task] ?? 20) * 60;
  const timer = useTimer(total, running, () => setRunning(false));
  const words = countWords(text);
  const saveTimer = useRef<number>(undefined);

  useEffect(() => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      if ((drafts[task.id]?.text ?? '') === text) return;
      setStore('drafts', (d) => ({ ...d, [task.id]: { text, updatedAt: Date.now() } }));
      if (text.trim()) logActivity();
    }, 600);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const insert = (k: string) => {
    const el = area.current;
    if (!el) return setText((v) => v + k);
    const { selectionStart: s, selectionEnd: e } = el;
    const next = text.slice(0, s) + k + text.slice(e);
    setText(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + k.length, s + k.length);
    });
  };

  const range = words < task.minWords ? 'short' : words > task.maxWords ? 'long' : 'ok';

  return (
    <article className="task">
      <Link to="/writing" className="back-link">
        <ArrowLeft size={16} /> {t('w.title')}
      </Link>
      <div className="row">
        <span className="badge">Tâche {task.task}</span>
        <LevelBadge level={task.level} />
        <span className="muted small">
          {task.minWords}–{task.maxWords} {t('c.words')}
        </span>
      </div>
      <h1>{pick(task, 'title', lang)}</h1>
      <div className="prompt card">
        <Md text={task.promptFr} />
        <button className="btn small ghost" onClick={() => setShowTr((s) => !s)}>
          {showTr ? <EyeOff size={14} /> : <Eye size={14} />} {lang === 'zh' ? '翻译' : 'Translation'}
        </button>
        {showTr && <Md className="muted small" text={pick(task, 'prompt', lang)} />}
      </div>
      {task.documents && (
        <div className="docs">
          {task.documents.map((d, i) => (
            <div key={i} className="passage card">
              <h3 className="passage-title">{/^document/i.test(d.title) ? d.title : `Document ${i + 1} · ${d.title}`}</h3>
              <Md text={d.text} />
            </div>
          ))}
        </div>
      )}

      <div className="editor card">
        <div className="editor-head">
          <strong>{t('w.yourText')}</strong>
          <div className="row">
            <span className={`wordcount ${range}`}>
              {words} {t('c.words')} · {range === 'short' ? t('w.tooShort') : range === 'long' ? t('w.tooLong') : t('w.inRange')}
            </span>
            <button className="btn small" onClick={() => setRunning((r) => !r)} title={t('c.timer')}>
              {running ? <Pause size={14} /> : timer.elapsed ? <Play size={14} /> : <Timer size={14} />} {formatTime(timer.remaining)}
            </button>
          </div>
        </div>
        <textarea
          ref={area}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('w.placeholder')}
          rows={12}
          lang="fr"
          spellCheck
        />
        <AccentKeys onKey={insert} />
        <p className="muted small">{t('w.saved')}</p>
      </div>

      <GrammarCheck text={text} onApply={(o, l, v) => setText((s) => s.slice(0, o) + v + s.slice(o + l))} />

      <div className="card">
        <h3>
          <CheckSquare size={18} /> {t('w.checklist')}
        </h3>
        <ul className="checklist">
          {(CHECKLIST[task.task] ?? []).map((c, i) => (
            <li key={i}>
              <label>
                <input type="checkbox" checked={!!checks[i]} onChange={(e) => setChecks((cs) => Object.assign([...cs], { [i]: e.target.checked }))} />
                {lang === 'zh' ? c.zh : c.en}
              </label>
            </li>
          ))}
        </ul>
        <div className="row">
          <button
            className="btn"
            disabled={!text.trim()}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(aiPrompt(task, text));
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                /* clipboard blocked */
              }
            }}
          >
            <Bot size={16} /> {copied ? t('c.copied') : t('w.aiPrompt')}
          </button>
          <span className="muted small">{t('w.aiPromptNote')}</span>
        </div>
      </div>

      <div className="card">
        <h3>{t('w.phrases')}</h3>
        <ul className="phrases">
          {task.usefulPhrases.map((p, i) => (
            <li key={i}>
              <button className="chip" onClick={() => insert((text && !/\s$/.test(text) ? ' ' : '') + p)} title="Insert">
                + {p}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <button className="btn" onClick={() => setShowModel((s) => !s)}>
          {showModel ? <EyeOff size={16} /> : <Eye size={16} />} {t('w.showModel')}
        </button>
        {showModel && (
          <div className="model">
            <div className="row">
              <strong>{t('w.model')}</strong>
              <span className="muted small">
                {countWords(task.modelAnswer)} {t('c.words')}
              </span>
              <SpeakButton text={task.modelAnswer} />
            </div>
            <Md text={task.modelAnswer} />
          </div>
        )}
      </div>
    </article>
  );
}

export default function Writing() {
  const { id } = useParams();
  const { t, lang } = useT();
  const tasks = useAsync(loadWriting, []);
  const [drafts] = useStore('drafts');
  const groups = useMemo(() => [1, 2, 3].map((n) => (tasks ?? []).filter((x) => x.task === n)), [tasks]);
  if (!tasks) return <Loading />;
  if (id) {
    const task = tasks.find((x) => x.id === id);
    return task ? <TaskView key={task.id} task={task} /> : <p className="muted">{t('c.empty')}</p>;
  }
  return (
    <div>
      <PageHeader title={t('w.title')} sub={t('w.sub')} />
      {tasks.length === 0 && <p className="muted">{t('c.empty')}</p>}
      {groups.map((g, i) =>
        g.length ? (
          <section key={i}>
            <h2>{t((['w.task1', 'w.task2', 'w.task3'] as const)[i])}</h2>
            <div className="task-grid">
              {g.map((x) => {
                const d = drafts[x.id];
                const n = d ? countWords(d.text) : 0;
                return (
                  <Link key={x.id} to={`/writing/${x.id}`} className="card task-card">
                    <div className="row">
                      <LevelBadge level={x.level} />
                      {n > 0 && (
                        <span className={`badge ${n >= x.minWords ? 'ok' : ''}`}>
                          {n} {t('c.words')}
                        </span>
                      )}
                    </div>
                    <strong>{pick(x, 'title', lang)}</strong>
                    <span className="muted small clamp">{x.promptFr}</span>
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null,
      )}
    </div>
  );
}
