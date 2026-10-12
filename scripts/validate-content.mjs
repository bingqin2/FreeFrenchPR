#!/usr/bin/env node
// Validates every content file in src/data against the shapes in src/types.ts.
// Usage: node scripts/validate-content.mjs   (exit code 1 on any error)
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data');
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const errors = [];
const ids = new Map();
let count = 0;

const err = (where, msg) => errors.push(`${where}: ${msg}`);
const isStr = (v) => typeof v === 'string' && v.trim().length > 0;
const isStrArr = (v, min = 1) => Array.isArray(v) && v.length >= min && v.every(isStr);

function load(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    err(file, `invalid JSON: ${e.message}`);
    return null;
  }
}

function reqStr(obj, keys, where) {
  for (const k of keys) if (!isStr(obj[k])) err(where, `missing/empty string "${k}"`);
}

function uniqueId(id, where) {
  if (!isStr(id)) return err(where, 'missing id');
  if (ids.has(id)) err(where, `duplicate id "${id}" (also in ${ids.get(id)})`);
  ids.set(id, where);
}

function checkMcq(q, where) {
  if (!isStrArr(q.options, 4) || q.options.length !== 4) err(where, 'options must be exactly 4 non-empty strings');
  else if (new Set(q.options).size !== 4) err(where, 'options must be distinct');
  if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) err(where, 'answer must be 0-3');
}

function forLevelFiles(dir, fn) {
  const path = join(DATA, dir);
  if (!existsSync(path)) return;
  for (const f of readdirSync(path).filter((f) => f.endsWith('.json'))) {
    const level = f.replace('.json', '').toUpperCase();
    if (!LEVELS.includes(level)) err(`${dir}/${f}`, 'file name must be a level, e.g. a1.json');
    const arr = load(join(path, f));
    if (arr === null) continue;
    if (!Array.isArray(arr)) { err(`${dir}/${f}`, 'top level must be an array'); continue; }
    arr.forEach((item, i) => { count++; fn(item, `${dir}/${f}[${i}]${item?.id ? ` (${item.id})` : ''}`, level); });
  }
}

// Vocabulary
const POS = ['n.m.', 'n.f.', 'n.m.pl.', 'n.f.pl.', 'n.', 'v.', 'adj.', 'adv.', 'prép.', 'pron.', 'conj.', 'interj.', 'expr.', 'num.', 'dét.'];
const seenFr = new Map();
forLevelFiles('vocab', (v, where) => {
  uniqueId(v.id, where);
  reqStr(v, ['fr', 'pos', 'en', 'zh', 'ex', 'exEn', 'exZh', 'topic'], where);
  if (isStr(v.pos) && !POS.includes(v.pos)) err(where, `pos "${v.pos}" not one of ${POS.join(' ')}`);
  const key = `${v.fr}|${v.pos}`.toLowerCase();
  if (seenFr.has(key)) err(where, `duplicate headword "${v.fr}" (${v.pos}), also ${seenFr.get(key)}`);
  seenFr.set(key, where);
});

// Listening
forLevelFiles('listening', (q, where, level) => {
  uniqueId(q.id, where);
  if (q.level !== level) err(where, `level "${q.level}" does not match file ${level}`);
  if (!['dialogue', 'announcement', 'message', 'interview', 'radio', 'short'].includes(q.kind)) err(where, `bad kind "${q.kind}"`);
  if (!Array.isArray(q.script) || q.script.length === 0) err(where, 'script must be a non-empty array');
  else q.script.forEach((l, j) => {
    if (!['A', 'B', 'N'].includes(l.speaker)) err(where, `script[${j}].speaker must be A, B or N`);
    if (!isStr(l.text)) err(where, `script[${j}].text empty`);
  });
  reqStr(q, ['question', 'explanationEn', 'explanationZh'], where);
  checkMcq(q, where);
});

// Reading
forLevelFiles('reading', (q, where, level) => {
  uniqueId(q.id, where);
  if (q.level !== level) err(where, `level "${q.level}" does not match file ${level}`);
  if (!['sign', 'message', 'ad', 'email', 'article', 'opinion', 'literary', 'form', 'schedule'].includes(q.kind)) err(where, `bad kind "${q.kind}"`);
  reqStr(q, ['passage', 'question', 'explanationEn', 'explanationZh'], where);
  checkMcq(q, where);
});

// Lessons
forLevelFiles('lessons', (l, where, level) => {
  uniqueId(l.id, where);
  if (l.level !== level) err(where, `level "${l.level}" does not match file ${level}`);
  reqStr(l, ['titleFr', 'titleEn', 'titleZh'], where);
  if (!isStrArr(l.goalsEn) || !isStrArr(l.goalsZh)) err(where, 'goalsEn/goalsZh must be non-empty string arrays');
  if (!Array.isArray(l.sections) || l.sections.length < 2) err(where, 'needs at least 2 sections');
  else l.sections.forEach((s, j) => {
    const w = `${where} sections[${j}]`;
    if (s.type === 'text' || s.type === 'tip') reqStr(s, ['en', 'zh'], w);
    else if (s.type === 'table') {
      if (!isStrArr(s.headers)) err(w, 'table headers required');
      if (!Array.isArray(s.rows) || !s.rows.every((r) => Array.isArray(r) && r.length === s.headers?.length)) err(w, 'every table row must have as many cells as headers');
    } else if (s.type === 'examples') {
      if (!Array.isArray(s.items) || s.items.length === 0) err(w, 'examples need items');
      else s.items.forEach((it, k) => reqStr(it, ['fr', 'en', 'zh'], `${w} items[${k}]`));
    } else err(w, `unknown section type "${s.type}"`);
  });
  if (!Array.isArray(l.exercises) || l.exercises.length < 5) err(where, 'needs at least 5 exercises');
  else l.exercises.forEach((x, j) => {
    const w = `${where} exercises[${j}]`;
    if (x.type === 'mcq') {
      reqStr(x, ['prompt'], w);
      if (!isStrArr(x.options, 2)) err(w, 'mcq needs 2+ options');
      if (!Number.isInteger(x.answer) || x.answer < 0 || x.answer >= (x.options?.length ?? 0)) err(w, 'mcq answer out of range');
    } else if (x.type === 'fill') {
      reqStr(x, ['prompt'], w);
      if (!x.prompt?.includes('___')) err(w, 'fill prompt must contain ___');
      if (!isStrArr(x.answers)) err(w, 'fill needs answers[]');
    } else if (x.type === 'listen') {
      reqStr(x, ['text'], w);
      if (!isStrArr(x.options, 2)) err(w, 'listen needs 2+ options');
      if (!Number.isInteger(x.answer) || x.answer < 0 || x.answer >= (x.options?.length ?? 0)) err(w, 'listen answer out of range');
    } else if (x.type === 'order') {
      if (!isStrArr(x.words, 2)) err(w, 'order needs 2+ words');
      reqStr(x, ['answer'], w);
      if (isStrArr(x.words) && isStr(x.answer) && [...x.words].sort().join(' ') !== x.answer.split(' ').sort().join(' '))
        err(w, 'order: words must be exactly the words of answer (split on spaces)');
    } else err(w, `unknown exercise type "${x.type}"`);
  });
});

// Writing
const writing = existsSync(join(DATA, 'writing.json')) ? load(join(DATA, 'writing.json')) : [];
(writing ?? []).forEach((t, i) => {
  const where = `writing.json[${i}]${t?.id ? ` (${t.id})` : ''}`;
  count++;
  uniqueId(t.id, where);
  if (![1, 2, 3].includes(t.task)) err(where, 'task must be 1, 2 or 3');
  if (!LEVELS.includes(t.level)) err(where, 'bad level');
  reqStr(t, ['titleEn', 'titleZh', 'promptFr', 'promptEn', 'promptZh', 'modelAnswer'], where);
  if (!(t.minWords > 0 && t.maxWords > t.minWords)) err(where, 'minWords/maxWords invalid');
  if (!isStrArr(t.usefulPhrases)) err(where, 'usefulPhrases required');
  if (t.task === 3 && (!Array.isArray(t.documents) || t.documents.length !== 2)) err(where, 'task 3 needs exactly 2 documents');
});

// Speaking
const speaking = existsSync(join(DATA, 'speaking.json')) ? load(join(DATA, 'speaking.json')) : [];
(speaking ?? []).forEach((t, i) => {
  const where = `speaking.json[${i}]${t?.id ? ` (${t.id})` : ''}`;
  count++;
  uniqueId(t.id, where);
  if (![1, 2, 3].includes(t.task)) err(where, 'task must be 1, 2 or 3');
  if (!LEVELS.includes(t.level)) err(where, 'bad level');
  reqStr(t, ['titleEn', 'titleZh', 'promptFr', 'promptEn', 'promptZh', 'sampleAnswer'], where);
  if (!(Number.isInteger(t.prepSeconds) && t.prepSeconds >= 0)) err(where, 'prepSeconds invalid');
  if (!(Number.isInteger(t.speakSeconds) && t.speakSeconds > 0)) err(where, 'speakSeconds invalid');
  if (!isStrArr(t.ideas)) err(where, 'ideas required');
});

// Guides
const guides = existsSync(join(DATA, 'guides.json')) ? load(join(DATA, 'guides.json')) : [];
(guides ?? []).forEach((g, i) => {
  const where = `guides.json[${i}]${g?.id ? ` (${g.id})` : ''}`;
  count++;
  uniqueId(g.id, where);
  reqStr(g, ['titleEn', 'titleZh', 'summaryEn', 'summaryZh', 'updated'], where);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(g.updated ?? '')) err(where, 'updated must be YYYY-MM-DD');
  if (!Array.isArray(g.sections) || g.sections.length === 0) err(where, 'sections required');
  else g.sections.forEach((s, j) => {
    reqStr(s, ['headingEn', 'headingZh', 'bodyEn', 'bodyZh'], `${where} sections[${j}]`);
    if (s.table && (!isStrArr(s.table.headers) || !s.table.rows?.every((r) => r.length === s.table.headers.length)))
      err(`${where} sections[${j}]`, 'table rows must match headers');
  });
  if (!Array.isArray(g.sources) || !g.sources.every((s) => isStr(s.label) && /^https:\/\//.test(s.url ?? ''))) err(where, 'sources need label + https url');
});

if (errors.length) {
  console.error(errors.slice(0, 200).join('\n'));
  console.error(`\n✗ ${errors.length} error(s) across ${count} items`);
  process.exit(1);
}
console.log(`✓ ${count} content items valid`);
