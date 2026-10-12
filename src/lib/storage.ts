// All learner data lives in the browser's localStorage under the "ffpr:" prefix.
// Nothing is sent to a server. Each key is a small reactive store.
import { useSyncExternalStore } from 'react';

const PREFIX = 'ffpr:';

export interface Settings {
  lang: 'en' | 'zh';
  theme: 'system' | 'light' | 'dark';
  rate: number; // speech rate, 0.6–1.2
  accent: 'auto' | 'fr-FR' | 'fr-CA';
  newPerDay: number; // new flashcards per day
}

export interface SrsCard {
  due: number; // epoch ms
  interval: number; // days
  ease: number;
  reps: number;
  lapses: number;
}

export interface AnswerRecord {
  correct: boolean;
  chosen: number;
  at: number;
  attempts: number;
}

export interface LessonRecord {
  score: number;
  total: number;
  completedAt: number;
}

export interface ExamRecord {
  id: string;
  section: 'listening' | 'reading';
  at: number;
  score: number;
  correct: number;
  total: number;
  seconds: number;
  timed: boolean;
}

export interface Draft {
  text: string;
  updatedAt: number;
}

export interface Schema {
  settings: Settings;
  srs: Record<string, SrsCard>;
  srsNew: Record<string, number>; // YYYY-MM-DD → new cards introduced that day
  answers: Record<string, AnswerRecord>;
  lessons: Record<string, LessonRecord>;
  favorites: string[];
  notes: Record<string, string>;
  exams: ExamRecord[];
  drafts: Record<string, Draft>;
  speaking: Record<string, { status: 'practiced' | 'redo'; at: number }>;
  activity: Record<string, number>; // YYYY-MM-DD → actions
}

const defaults: Schema = {
  settings: {
    lang: typeof navigator !== 'undefined' && navigator.language?.startsWith('zh') ? 'zh' : 'en',
    theme: 'system',
    rate: 0.95,
    accent: 'auto',
    newPerDay: 15,
  },
  srs: {},
  srsNew: {},
  answers: {},
  lessons: {},
  favorites: [],
  notes: {},
  exams: [],
  drafts: {},
  speaking: {},
  activity: {},
};

export type Key = keyof Schema;
const cache = new Map<Key, unknown>();
const listeners = new Map<Key, Set<() => void>>();

function read<K extends Key>(key: K): Schema[K] {
  if (cache.has(key)) return cache.get(key) as Schema[K];
  let value: Schema[K] = defaults[key];
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw) {
      const parsed = JSON.parse(raw);
      value = (key === 'settings' ? { ...defaults.settings, ...parsed } : parsed) as Schema[K];
    }
  } catch {
    // Storage unavailable (private mode) or corrupt: fall back to defaults.
  }
  cache.set(key, value);
  return value;
}

export function get<K extends Key>(key: K): Schema[K] {
  return read(key);
}

export function set<K extends Key>(key: K, value: Schema[K] | ((prev: Schema[K]) => Schema[K])) {
  const next = typeof value === 'function' ? (value as (p: Schema[K]) => Schema[K])(read(key)) : value;
  cache.set(key, next);
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(next));
  } catch {
    // Quota exceeded or storage blocked; the in-memory value still works this session.
  }
  listeners.get(key)?.forEach((fn) => fn());
}

function subscribe(key: Key, fn: () => void) {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key)!.add(fn);
  return () => listeners.get(key)!.delete(fn);
}

export function useStore<K extends Key>(key: K): [Schema[K], (v: Schema[K] | ((p: Schema[K]) => Schema[K])) => void] {
  const value = useSyncExternalStore(
    (fn) => subscribe(key, fn),
    () => read(key),
  );
  return [value, (v) => set(key, v)];
}

export function useSettings() {
  const [s, setS] = useStore('settings');
  return [s, (patch: Partial<Settings>) => setS((p) => ({ ...p, ...patch }))] as const;
}

export const today = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Record one learning action for the streak/activity calendar. */
export function logActivity(n = 1) {
  set('activity', (a) => ({ ...a, [today()]: (a[today()] ?? 0) + n }));
}

export function streak(activity: Record<string, number>): number {
  let n = 0;
  const d = new Date();
  if (!activity[today(d)]) d.setDate(d.getDate() - 1); // today not started yet doesn't break the streak
  while (activity[today(d)]) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export function recordAnswer(id: string, chosen: number, correct: boolean) {
  set('answers', (a) => ({
    ...a,
    [id]: { chosen, correct, at: Date.now(), attempts: (a[id]?.attempts ?? 0) + 1 },
  }));
  logActivity();
}

export function toggleFavorite(id: string) {
  set('favorites', (f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));
}

const ALL_KEYS = Object.keys(defaults) as Key[];

export function exportData(): string {
  const out: Record<string, unknown> = { app: 'FreeFrenchPR', version: 1, exportedAt: new Date().toISOString() };
  for (const k of ALL_KEYS) out[k] = read(k);
  return JSON.stringify(out, null, 2);
}

export function importData(json: string) {
  const data = JSON.parse(json);
  if (data?.app !== 'FreeFrenchPR') throw new Error('Not a FreeFrenchPR backup file');
  for (const k of ALL_KEYS) if (k in data) set(k, data[k]);
}

export function resetData() {
  for (const k of ALL_KEYS) {
    try {
      localStorage.removeItem(PREFIX + k);
    } catch {
      /* ignore */
    }
    cache.delete(k);
    listeners.get(k)?.forEach((fn) => fn());
  }
}
