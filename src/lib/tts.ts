// Text-to-speech using the browser's built-in Web Speech API (free, offline on most systems).
import { useEffect, useState } from 'react';
import { get } from './storage';
import type { ScriptLine } from '../types';

let voicesCache: SpeechSynthesisVoice[] = [];

export const ttsSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

function loadVoices(): SpeechSynthesisVoice[] {
  if (!ttsSupported()) return [];
  voicesCache = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('fr'));
  return voicesCache;
}

if (ttsSupported()) {
  loadVoices();
  speechSynthesis.addEventListener?.('voiceschanged', loadVoices);
}

export function useFrenchVoices() {
  const [voices, setVoices] = useState(loadVoices);
  useEffect(() => {
    if (!ttsSupported()) return;
    const h = () => setVoices(loadVoices());
    speechSynthesis.addEventListener?.('voiceschanged', h);
    return () => speechSynthesis.removeEventListener?.('voiceschanged', h);
  }, []);
  return voices;
}

/** Up to two distinct French voices: preferred accent first, natural/online voices preferred. */
function pickVoices(): SpeechSynthesisVoice[] {
  const voices = voicesCache.length ? voicesCache : loadVoices();
  const accent = get('settings').accent;
  const score = (v: SpeechSynthesisVoice) =>
    (accent !== 'auto' && v.lang.replace('_', '-') === accent ? 10 : 0) +
    (/natural|neural|premium|enhanced|online|google/i.test(v.name) ? 3 : 0) +
    // Good built-in macOS/iOS/Windows voices.
    (/^(thomas|amélie|amelie|audrey|aurélie|aurelie|marie|chantal|nicolas|daniel|julie|hortense|paul|denise|henri|sylvie|antoine)\b/i.test(v.name) ? 2 : 0) +
    // macOS novelty/robotic voices.
    (/^(eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley|jacques)\b/i.test(v.name) ? -5 : 0) +
    (v.lang.replace('_', '-') === 'fr-FR' ? 1 : 0);
  return [...voices].sort((a, b) => score(b) - score(a)).slice(0, 2);
}

let session = 0;

export function stop() {
  session++;
  if (ttsSupported()) speechSynthesis.cancel();
}

/** Chrome cuts off very long utterances, so speak sentence by sentence. */
function chunks(text: string): string[] {
  return text.match(/[^.!?…]+[.!?…»"]*\s*/g)?.map((s) => s.trim()).filter(Boolean) ?? [text];
}

export interface SpeakOptions {
  rate?: number;
  onEnd?: () => void;
  onLine?: (index: number) => void;
}

/** Speak a script line by line; speaker B gets the second voice (or a higher pitch). */
export function speakScript(lines: ScriptLine[], opts: SpeakOptions = {}) {
  if (!ttsSupported()) return;
  stop();
  const my = ++session;
  const [v1, v2] = pickVoices();
  const rate = opts.rate ?? get('settings').rate;
  const queue: { text: string; line: number; speaker: ScriptLine['speaker'] }[] = [];
  lines.forEach((l, i) => chunks(l.text).forEach((c) => queue.push({ text: c, line: i, speaker: l.speaker })));
  let i = 0;
  const next = () => {
    if (my !== session) return;
    if (i >= queue.length) return opts.onEnd?.();
    const item = queue[i++];
    const u = new SpeechSynthesisUtterance(item.text);
    u.lang = v1?.lang ?? 'fr-FR';
    u.rate = rate;
    if (item.speaker === 'B') {
      if (v2) {
        u.voice = v2;
        u.lang = v2.lang;
      } else {
        if (v1) u.voice = v1;
        u.pitch = 1.35;
      }
    } else if (v1) u.voice = v1;
    if (item.speaker === 'N') u.pitch = 0.95;
    opts.onLine?.(item.line);
    u.onend = () => setTimeout(next, queue[i]?.line !== item.line ? 350 : 60);
    u.onerror = () => setTimeout(next, 60);
    speechSynthesis.speak(u);
  };
  next();
}

export function speak(text: string, opts: SpeakOptions = {}) {
  speakScript([{ speaker: 'A', text }], opts);
}

/** Hook: { playing, play, stop } bound to one piece of audio. */
export function useSpeaker() {
  const [playing, setPlaying] = useState(false);
  const [line, setLine] = useState(-1);
  useEffect(() => () => stop(), []);
  return {
    playing,
    line,
    play(lines: ScriptLine[] | string, rate?: number) {
      setPlaying(true);
      const arr = typeof lines === 'string' ? [{ speaker: 'A' as const, text: lines }] : lines;
      speakScript(arr, {
        rate,
        onLine: setLine,
        onEnd: () => {
          setPlaying(false);
          setLine(-1);
        },
      });
    },
    stop() {
      stop();
      setPlaying(false);
      setLine(-1);
    },
  };
}
