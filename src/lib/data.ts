// Lazy loaders for the JSON content in src/data. Each file becomes its own chunk,
// so the first page load stays small.
import { useEffect, useState } from 'react';
import type { Guide, Lesson, Level, ListeningQuestion, ReadingQuestion, SpeakingTask, VocabItem, WritingTask } from '../types';
import { LEVELS } from '../types';

type Loader = () => Promise<unknown>;
const vocabFiles = import.meta.glob<{ default: VocabItem[] }>('../data/vocab/*.json');
const listeningFiles = import.meta.glob<{ default: ListeningQuestion[] }>('../data/listening/*.json');
const readingFiles = import.meta.glob<{ default: ReadingQuestion[] }>('../data/reading/*.json');
const lessonFiles = import.meta.glob<{ default: Lesson[] }>('../data/lessons/*.json');
const single = import.meta.glob<{ default: unknown }>(['../data/writing.json', '../data/speaking.json', '../data/guides.json']);

const cache = new Map<string, Promise<unknown>>();

function load<T>(key: string, loader: Loader | undefined): Promise<T> {
  if (!loader) return Promise.resolve([] as T);
  if (!cache.has(key)) cache.set(key, loader().then((m) => (m as { default: T }).default));
  return cache.get(key) as Promise<T>;
}

const fileFor = (dir: string, level: Level) => `../data/${dir}/${level.toLowerCase()}.json`;

export const loadVocab = (level: Level) => load<VocabItem[]>(`v-${level}`, vocabFiles[fileFor('vocab', level)]);
export const loadListening = (level: Level) => load<ListeningQuestion[]>(`l-${level}`, listeningFiles[fileFor('listening', level)]);
export const loadReading = (level: Level) => load<ReadingQuestion[]>(`r-${level}`, readingFiles[fileFor('reading', level)]);
export const loadLessons = (level: Level) => load<Lesson[]>(`c-${level}`, lessonFiles[fileFor('lessons', level)]);
export const loadWriting = () => load<WritingTask[]>('writing', single['../data/writing.json']);
export const loadSpeaking = () => load<SpeakingTask[]>('speaking', single['../data/speaking.json']);
export const loadGuides = () => load<Guide[]>('guides', single['../data/guides.json']);

export const loadAllVocab = () => Promise.all(LEVELS.map(loadVocab)).then((a) => a.flat());
export const loadAllLessons = () => Promise.all(LEVELS.map(loadLessons)).then((a) => a.flat());

/** Levels that actually have content for a section (files may be added later). */
export const availableLevels = (dir: 'vocab' | 'listening' | 'reading' | 'lessons'): Level[] => {
  const files = { vocab: vocabFiles, listening: listeningFiles, reading: readingFiles, lessons: lessonFiles }[dir];
  return LEVELS.filter((l) => fileFor(dir, l) in files);
};

/** React hook: resolves a loader, re-running when deps change. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): T | undefined {
  const [value, setValue] = useState<T>();
  useEffect(() => {
    let alive = true;
    setValue(undefined);
    fn().then((v) => alive && setValue(v));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Normalise French answers for lenient comparison: case, accents, apostrophes, spaces. */
export function normalize(s: string, keepAccents = true): string {
  let t = s.toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, ' ').replace(/\s*([.!?,;:])\s*$/g, '').trim();
  if (!keepAccents) t = t.normalize('NFD').replace(/\p{Diacritic}/gu, '');
  return t;
}
