import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Download, Eye, EyeOff, Mic, RotateCcw, Square, Volume2 } from 'lucide-react';
import Md from '../components/Md';
import { LevelBadge, Loading, PageHeader, SpeakButton, formatTime, useTimer } from '../components/ui';
import { useT, pick } from '../lib/i18n';
import { logActivity, set as setStore, useStore } from '../lib/storage';
import { loadSpeaking, useAsync } from '../lib/data';
import { ttsSupported, useSpeaker } from '../lib/tts';
import type { SpeakingTask } from '../types';

// Minimal typing for the (prefixed) Web Speech recognition API.
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}
const SR: (new () => Recognition) | undefined =
  typeof window !== 'undefined' ? ((window as unknown as Record<string, unknown>).SpeechRecognition ?? (window as unknown as Record<string, unknown>).webkitSpeechRecognition) as never : undefined;

function useRecorder() {
  const [recording, setRecording] = useState(false);
  const [url, setUrl] = useState<string>();
  const [error, setError] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const rec = useRef<MediaRecorder | null>(null);
  const recog = useRef<Recognition | null>(null);
  const active = useRef(false);

  const stop = () => {
    active.current = false;
    rec.current?.state === 'recording' && rec.current.stop();
    recog.current?.stop();
    setRecording(false);
    setInterim('');
  };

  useEffect(() => () => stop(), []);

  const start = async () => {
    setError(false);
    setTranscript('');
    if (url) URL.revokeObjectURL(url);
    setUrl(undefined);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: Blob[] = [];
      const r = new MediaRecorder(stream);
      r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      r.onstop = () => {
        setUrl(URL.createObjectURL(new Blob(chunks, { type: r.mimeType })));
        stream.getTracks().forEach((t) => t.stop());
      };
      r.start();
      rec.current = r;
      active.current = true;
      setRecording(true);
    } catch {
      setError(true);
      return;
    }
    if (SR) {
      const g = new SR();
      g.lang = 'fr-FR';
      g.continuous = true;
      g.interimResults = true;
      g.onresult = (e) => {
        let fin = '';
        let tmp = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) fin += r[0].transcript + ' ';
          else tmp += r[0].transcript;
        }
        if (fin) setTranscript((tr) => tr + fin);
        setInterim(tmp);
      };
      // Chrome ends recognition after a pause; restart while still recording.
      g.onend = () => active.current && setTimeout(() => active.current && g.start(), 100);
      g.onerror = () => undefined;
      try {
        g.start();
        recog.current = g;
      } catch {
        /* recognition unavailable */
      }
    }
  };

  return { recording, url, error, transcript, interim, start, stop };
}

type Phase = 'idle' | 'prep' | 'speak' | 'done';

function TaskView({ task }: { task: SpeakingTask }) {
  const { t, lang } = useT();
  const sp = useSpeaker();
  const r = useRecorder();
  const [phase, setPhase] = useState<Phase>('idle');
  const [showTr, setShowTr] = useState(false);
  const [showSample, setShowSample] = useState(false);
  const [status] = useStore('speaking');
  const prep = useTimer(task.prepSeconds, phase === 'prep', () => beginSpeaking());
  const speakT = useTimer(task.speakSeconds, phase === 'speak', () => finish());

  function beginSpeaking() {
    setPhase('speak');
    r.start();
  }
  function finish() {
    r.stop();
    setPhase('done');
    logActivity();
  }
  const reset = () => {
    r.stop();
    prep.reset();
    speakT.reset();
    setPhase('idle');
  };
  const mark = (s: 'practiced' | 'redo') => setStore('speaking', (m) => ({ ...m, [task.id]: { status: s, at: Date.now() } }));

  const examinerText = task.promptFr.replace(/\*\*/g, '');

  return (
    <article className="task">
      <Link to="/speaking" className="back-link">
        <ArrowLeft size={16} /> {t('sp.title')}
      </Link>
      <div className="row">
        <span className="badge">Tâche {task.task}</span>
        <LevelBadge level={task.level} />
        {status[task.id] && <span className={`badge ${status[task.id].status === 'practiced' ? 'ok' : 'warn'}`}>{status[task.id].status === 'practiced' ? t('sp.practiced') : t('sp.redo')}</span>}
      </div>
      <h1>{pick(task, 'title', lang)}</h1>
      <div className="prompt card">
        <Md text={task.promptFr} />
        <div className="row">
          {ttsSupported() && (
            <button className="btn small" onClick={() => (sp.playing ? sp.stop() : sp.play(examinerText))}>
              <Volume2 size={14} /> {sp.playing ? t('c.stop') : t('sp.readPrompt')}
            </button>
          )}
          <button className="btn small ghost" onClick={() => setShowTr((s) => !s)}>
            {showTr ? <EyeOff size={14} /> : <Eye size={14} />} {lang === 'zh' ? '翻译' : 'Translation'}
          </button>
        </div>
        {showTr && <Md className="muted small" text={pick(task, 'prompt', lang)} />}
      </div>

      <div className="card speak-stage">
        {phase === 'idle' && (
          <div className="stage-center">
            <p className="muted">
              {task.prepSeconds > 0 && (
                <>
                  {t('sp.prep')}: {formatTime(task.prepSeconds)} ·{' '}
                </>
              )}
              {t('sp.speak')}: {formatTime(task.speakSeconds)}
            </p>
            <button className="btn primary large" onClick={() => (task.prepSeconds > 0 ? setPhase('prep') : beginSpeaking())}>
              {task.prepSeconds > 0 ? t('sp.startPrep') : t('sp.startSpeaking')}
            </button>
          </div>
        )}
        {phase === 'prep' && (
          <div className="stage-center">
            <div className="small muted">{t('sp.prep')}</div>
            <div className="big-timer">{formatTime(prep.remaining)}</div>
            <button className="btn primary" onClick={beginSpeaking}>
              <Mic size={16} /> {t('sp.startSpeaking')}
            </button>
          </div>
        )}
        {phase === 'speak' && (
          <div className="stage-center">
            <div className="small muted">{t('sp.speak')}</div>
            <div className={`big-timer ${speakT.remaining < 30 ? 'warn' : ''}`}>{formatTime(speakT.remaining)}</div>
            {r.recording && (
              <div className="rec-indicator">
                <span className="rec-dot" /> REC
              </div>
            )}
            {r.error && <p className="feedback bad small">{t('sp.noMic')}</p>}
            <button className="btn danger" onClick={finish}>
              <Square size={16} /> {t('sp.stopRecord')}
            </button>
          </div>
        )}
        {phase === 'done' && (
          <div className="stage-done">
            {r.url ? (
              <>
                <strong>{t('sp.yourRecording')}</strong>
                <audio controls src={r.url} />
                <a className="btn small ghost" href={r.url} download={`${task.id}.webm`}>
                  <Download size={14} /> {t('sp.download')}
                </a>
              </>
            ) : (
              r.error && <p className="feedback bad small">{t('sp.noMic')}</p>
            )}
            <div className="row">
              <button className="btn" onClick={reset}>
                <RotateCcw size={16} /> {t('c.retry')}
              </button>
              <button className="btn primary" onClick={() => mark('practiced')}>
                <CheckCircle2 size={16} /> {t('sp.markPracticed')}
              </button>
              <button className="btn ghost" onClick={() => mark('redo')}>
                {t('sp.markRedo')}
              </button>
            </div>
          </div>
        )}
        {SR && (phase === 'speak' || (phase === 'done' && r.transcript)) && (
          <div className="live-transcript">
            <div className="small muted">{t('sp.transcript')}</div>
            <p>
              {r.transcript}
              <span className="muted">{r.interim}</span>
            </p>
            <p className="muted small">{t('sp.transcriptNote')}</p>
          </div>
        )}
      </div>

      <div className="card">
        <h3>{t('sp.ideas')}</h3>
        <ul className="ideas">
          {task.ideas.map((i, n) => (
            <li key={n}>
              {i} <SpeakButton text={i} />
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <button className="btn" onClick={() => setShowSample((s) => !s)}>
          {showSample ? <EyeOff size={16} /> : <Eye size={16} />} {t('sp.showSample')}
        </button>
        {showSample && (
          <div className="model">
            <div className="row">
              <strong>{t('sp.sample')}</strong>
              <SpeakButton text={task.sampleAnswer} />
            </div>
            <Md text={task.sampleAnswer} />
          </div>
        )}
      </div>
    </article>
  );
}

export default function Speaking() {
  const { id } = useParams();
  const { t, lang } = useT();
  const tasks = useAsync(loadSpeaking, []);
  const [status] = useStore('speaking');
  const groups = useMemo(() => [1, 2, 3].map((n) => (tasks ?? []).filter((x) => x.task === n)), [tasks]);
  if (!tasks) return <Loading />;
  if (id) {
    const task = tasks.find((x) => x.id === id);
    return task ? <TaskView key={task.id} task={task} /> : <p className="muted">{t('c.empty')}</p>;
  }
  return (
    <div>
      <PageHeader title={t('sp.title')} sub={t('sp.sub')} />
      {tasks.length === 0 && <p className="muted">{t('c.empty')}</p>}
      {groups.map((g, i) =>
        g.length ? (
          <section key={i}>
            <h2>{t((['sp.task1', 'sp.task2', 'sp.task3'] as const)[i])}</h2>
            <div className="task-grid">
              {g.map((x) => (
                <Link key={x.id} to={`/speaking/${x.id}`} className="card task-card">
                  <div className="row">
                    <LevelBadge level={x.level} />
                    {status[x.id] && (
                      <span className={`badge ${status[x.id].status === 'practiced' ? 'ok' : 'warn'}`}>
                        {status[x.id].status === 'practiced' ? t('sp.practiced') : t('sp.redo')}
                      </span>
                    )}
                  </div>
                  <strong>{pick(x, 'title', lang)}</strong>
                  <span className="muted small clamp">{x.promptFr}</span>
                </Link>
              ))}
            </div>
          </section>
        ) : null,
      )}
    </div>
  );
}
