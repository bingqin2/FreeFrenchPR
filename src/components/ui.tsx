import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, Pause, Play, Snail, Star, StickyNote, Volume2, X } from 'lucide-react';
import type { Level, ScriptLine } from '../types';
import { useT } from '../lib/i18n';
import { set as setStore, toggleFavorite, useStore } from '../lib/storage';
import { ttsSupported, useSpeaker } from '../lib/tts';

export function PageHeader({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {sub && <p className="muted">{sub}</p>}
      </div>
      {children && <div className="page-header-actions">{children}</div>}
    </header>
  );
}

export function LevelBadge({ level }: { level: Level | string }) {
  return <span className={`badge level-${String(level).toLowerCase()}`}>{level}</span>;
}

export function LevelTabs<L extends string>({
  levels,
  value,
  onChange,
  counts,
}: {
  levels: readonly L[];
  value: L;
  onChange: (l: L) => void;
  counts?: Partial<Record<L, string>>;
}) {
  return (
    <div className="tabs" role="tablist">
      {levels.map((l) => (
        <button key={l} role="tab" aria-selected={value === l} className={value === l ? 'tab active' : 'tab'} onClick={() => onChange(l)}>
          {l}
          {counts?.[l] && <span className="tab-count">{counts[l]}</span>}
        </button>
      ))}
    </div>
  );
}

/** Small speaker icon that reads a French string aloud. */
export function SpeakButton({ text, label, className }: { text: string; label?: string; className?: string }) {
  const sp = useSpeaker();
  if (!ttsSupported()) return null;
  return (
    <button
      type="button"
      className={`icon-btn speak ${sp.playing ? 'playing' : ''} ${className ?? ''}`}
      aria-label={label ?? `Play: ${text}`}
      title={label ?? 'Écouter'}
      onClick={(e) => {
        e.stopPropagation();
        if (sp.playing) sp.stop();
        else sp.play(text);
      }}
    >
      <Volume2 size={16} />
    </button>
  );
}

/** Player for listening scripts: play/stop, slow mode and a play counter. */
export function AudioPlayer({ script, autoKey }: { script: ScriptLine[]; autoKey?: string }) {
  const { t } = useT();
  const [settings] = useStore('settings');
  const sp = useSpeaker();
  const [plays, setPlays] = useState(0);
  useEffect(() => {
    setPlays(0);
    sp.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoKey]);
  if (!ttsSupported()) return <div className="callout warn">{t('c.listenNoSupport')}</div>;
  const play = (slow: boolean) => {
    setPlays((n) => n + 1);
    sp.play(script, slow ? Math.max(0.6, settings.rate - 0.25) : undefined);
  };
  return (
    <div className="audio-player">
      <button className={`play-btn ${sp.playing ? 'playing' : ''}`} onClick={() => (sp.playing ? sp.stop() : play(false))} aria-label={sp.playing ? t('c.stop') : t('c.play')}>
        {sp.playing ? <Pause size={26} /> : <Play size={26} />}
      </button>
      <div className="audio-meta">
        <div className="wave" aria-hidden>
          {Array.from({ length: 24 }, (_, i) => (
            <span key={i} style={{ animationDelay: `${(i % 6) * 0.12}s` }} className={sp.playing ? 'on' : ''} />
          ))}
        </div>
        <div className="audio-row">
          <button className="btn small ghost" onClick={() => play(true)} disabled={sp.playing}>
            <Snail size={14} /> {t('c.slow')}
          </button>
          <span className="muted small">
            ▶ ×{plays}
          </span>
        </div>
      </div>
    </div>
  );
}

export function Transcript({ script, activeLine = -1 }: { script: ScriptLine[]; activeLine?: number }) {
  const multi = new Set(script.map((l) => l.speaker)).size > 1;
  return (
    <div className="transcript">
      {script.map((l, i) => (
        <p key={i} className={i === activeLine ? 'active' : ''}>
          {multi && <span className={`speaker sp-${l.speaker}`}>{l.speaker === 'N' ? '🎙' : l.speaker}</span>}
          {l.text}
        </p>
      ))}
    </div>
  );
}

/** Four-option multiple choice with instant feedback. */
export function Options({
  options,
  answer,
  chosen,
  onChoose,
  reveal,
}: {
  options: string[];
  answer: number;
  chosen: number | null;
  onChoose: (i: number) => void;
  reveal: boolean;
}) {
  return (
    <div className="options">
      {options.map((o, i) => {
        let cls = 'option';
        if (reveal && i === answer) cls += ' correct';
        else if (reveal && i === chosen) cls += ' wrong';
        else if (!reveal && i === chosen) cls += ' selected';
        return (
          <button key={i} className={cls} disabled={reveal} onClick={() => onChoose(i)}>
            <span className="option-letter">{'ABCD'[i] ?? i + 1}</span>
            <span className="option-text">{o}</span>
            {reveal && i === answer && <Check size={18} className="option-icon" />}
            {reveal && i === chosen && i !== answer && <X size={18} className="option-icon" />}
          </button>
        );
      })}
    </div>
  );
}

export function FavButton({ id }: { id: string }) {
  const { t } = useT();
  const [favs] = useStore('favorites');
  const on = favs.includes(id);
  return (
    <button className={`icon-btn ${on ? 'fav-on' : ''}`} onClick={() => toggleFavorite(id)} aria-pressed={on} title={t('c.favorite')} aria-label={t('c.favorite')}>
      <Star size={18} fill={on ? 'currentColor' : 'none'} />
    </button>
  );
}

export function NoteBox({ id }: { id: string }) {
  const { t } = useT();
  const [notes] = useStore('notes');
  const [open, setOpen] = useState(!!notes[id]);
  const [text, setText] = useState(notes[id] ?? '');
  const timer = useRef<number>(undefined);
  useEffect(() => {
    setText(notes[id] ?? '');
    setOpen(!!notes[id]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  const save = (v: string) => {
    setText(v);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setStore('notes', (n) => {
        const next = { ...n };
        if (v.trim()) next[id] = v;
        else delete next[id];
        return next;
      });
    }, 400);
  };
  if (!open)
    return (
      <button className="btn small ghost" onClick={() => setOpen(true)}>
        <StickyNote size={14} /> {t('c.note')}
      </button>
    );
  return (
    <label className="note-box">
      <span className="small muted">
        <StickyNote size={14} /> {t('c.note')}
      </span>
      <textarea value={text} onChange={(e) => save(e.target.value)} placeholder={t('c.notePlaceholder')} rows={2} />
    </label>
  );
}

export function ProgressBar({ value, max, label }: { value: number; max: number; label?: string }) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return (
    <div className="progress" role="progressbar" aria-valuenow={value} aria-valuemax={max} aria-label={label}>
      <div className="progress-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Loading() {
  const { t } = useT();
  return <div className="loading">{t('c.loading')}</div>;
}

export function formatTime(sec: number) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Count-down (or count-up when total is 0) timer. */
export function useTimer(total: number, running: boolean, onDone?: () => void) {
  const [elapsed, setElapsed] = useState(0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    if (!running) return;
    const start = Date.now() - elapsed * 1000;
    const id = window.setInterval(() => {
      const e = (Date.now() - start) / 1000;
      setElapsed(e);
      if (total && e >= total) {
        window.clearInterval(id);
        doneRef.current?.();
      }
    }, 250);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, total]);
  return { elapsed, remaining: total ? Math.max(0, total - elapsed) : 0, reset: () => setElapsed(0) };
}
