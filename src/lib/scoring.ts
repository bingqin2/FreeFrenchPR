// TCF Canada score estimation and NCLC conversion.
import type { Level } from '../types';

// Widely cited but UNOFFICIAL points per question by difficulty (39 questions, max 699).
export const POINTS: Record<Level, number> = { A1: 3, A2: 9, B1: 15, B2: 21, C1: 26, C2: 33 };
// How many questions of each level a 39-question test contains, in order.
export const EXAM_MIX: [Level, number][] = [
  ['A1', 4],
  ['A2', 6],
  ['B1', 9],
  ['B2', 10],
  ['C1', 6],
  ['C2', 4],
];

// IRCC TCF Canada → NCLC equivalency (lower bound of each band).
const LISTENING: [number, number][] = [[549, 10], [523, 9], [503, 8], [458, 7], [398, 6], [369, 5], [331, 4]];
const READING: [number, number][] = [[549, 10], [524, 9], [499, 8], [453, 7], [406, 6], [375, 5], [342, 4]];
const PRODUCTION: [number, number][] = [[16, 10], [14, 9], [12, 8], [10, 7], [7, 6], [6, 5], [4, 4]];

export const NCLC_TABLE = { listening: LISTENING, reading: READING, production: PRODUCTION };

export function nclc(score: number, skill: 'listening' | 'reading' | 'writing' | 'speaking'): number {
  const table = skill === 'listening' ? LISTENING : skill === 'reading' ? READING : PRODUCTION;
  for (const [min, level] of table) if (score >= min) return level;
  return 0; // below NCLC 4
}

export function cefr(score699: number): string {
  if (score699 >= 600) return 'C2';
  if (score699 >= 500) return 'C1';
  if (score699 >= 400) return 'B2';
  if (score699 >= 300) return 'B1';
  if (score699 >= 200) return 'A2';
  if (score699 >= 100) return 'A1';
  return '< A1';
}
