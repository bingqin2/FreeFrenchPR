// Spaced repetition (a simplified SM-2, similar to Anki's defaults).
import type { SrsCard } from './storage';

export type Grade = 0 | 1 | 2 | 3; // again, hard, good, easy
const DAY = 86_400_000;

export function newCard(): SrsCard {
  return { due: 0, interval: 0, ease: 2.5, reps: 0, lapses: 0 };
}

export function review(card: SrsCard | undefined, grade: Grade, now = Date.now()): SrsCard {
  const c = { ...(card ?? newCard()) };
  if (grade === 0) {
    c.reps = 0;
    c.interval = 0;
    c.lapses += card ? 1 : 0;
    c.ease = Math.max(1.3, c.ease - 0.2);
    c.due = now + 60_000; // see it again in this session
    return c;
  }
  if (grade === 1) {
    c.interval = c.reps === 0 ? 1 : Math.max(1, c.interval * 1.2);
    c.ease = Math.max(1.3, c.ease - 0.15);
  } else if (grade === 2) {
    c.interval = c.reps === 0 ? 1 : c.reps === 1 ? 3 : c.interval * c.ease;
  } else {
    c.interval = c.reps === 0 ? 4 : c.interval * c.ease * 1.3;
    c.ease += 0.15;
  }
  c.interval = Math.min(Math.round(c.interval * 10) / 10, 365);
  c.reps += 1;
  c.due = now + c.interval * DAY;
  return c;
}

/** Human-readable preview of the next interval for a grade button. */
export function previewInterval(card: SrsCard | undefined, grade: Grade): string {
  if (grade === 0) return '1m';
  const days = review(card, grade, 0).interval;
  if (days < 30) return `${Math.round(days)}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return '1y';
}

export const isDue = (c: SrsCard | undefined, now = Date.now()) => !!c && c.due <= now;
export const isLearned = (c: SrsCard | undefined) => !!c && c.interval >= 21;
