// Content schema. Every JSON file under src/data must match these shapes;
// `npm run validate` checks them (see scripts/validate-content.mjs).

export type Level = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export const LEVELS: Level[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

/** src/data/vocab/<level>.json → VocabItem[] */
export interface VocabItem {
  id: string; // unique, e.g. "a1-bonjour"
  fr: string; // headword; nouns include the article: "le livre", "l'eau (f.)"
  pos: string; // "n.m." | "n.f." | "v." | "adj." | "adv." | "prép." | "pron." | "conj." | "interj." | "expr." | "num." | "dét."
  en: string;
  zh: string;
  ex: string; // example sentence in French
  exEn: string;
  exZh: string;
  topic: string; // short English slug, e.g. "greetings", "food", "work"
}

/** One line of a listening script. Speakers A/B get different voices. */
export interface ScriptLine {
  speaker: 'A' | 'B' | 'N'; // N = narrator / announcer
  text: string;
}

/** src/data/listening/<level>.json → ListeningQuestion[] */
export interface ListeningQuestion {
  id: string; // e.g. "lis-a1-001"
  level: Level;
  kind: 'dialogue' | 'announcement' | 'message' | 'interview' | 'radio' | 'short';
  context?: string; // optional French scene-setter shown before playing, e.g. "Dans une boulangerie."
  script: ScriptLine[];
  question: string; // in French
  options: string[]; // exactly 4, in French
  answer: number; // 0-3
  explanationEn: string;
  explanationZh: string;
}

/** src/data/reading/<level>.json → ReadingQuestion[] */
export interface ReadingQuestion {
  id: string; // e.g. "rea-a1-001"
  level: Level;
  kind: 'sign' | 'message' | 'ad' | 'email' | 'article' | 'opinion' | 'literary' | 'form' | 'schedule';
  title?: string;
  passage: string; // French text; use \n for line breaks
  question: string; // in French
  options: string[]; // exactly 4, in French
  answer: number; // 0-3
  explanationEn: string;
  explanationZh: string;
}

/** Text supports a tiny markdown subset: **bold**, *italic*, `code`, and \n line breaks. */
export type LessonSection =
  | { type: 'text'; en: string; zh: string }
  | { type: 'table'; caption?: string; headers: string[]; rows: string[][] }
  | { type: 'examples'; items: { fr: string; en: string; zh: string }[] }
  | { type: 'tip'; en: string; zh: string };

export type Exercise =
  | {
      type: 'mcq';
      prompt: string; // may be French or a bilingual instruction
      options: string[];
      answer: number;
      explanationEn?: string;
      explanationZh?: string;
    }
  | {
      type: 'fill';
      prompt: string; // contains "___" where the answer goes, e.g. "Je ___ étudiant."
      answers: string[]; // accepted answers (compared case- and accent-insensitively as a fallback)
      hint?: string; // e.g. "(être)"
      en?: string;
      zh?: string;
    }
  | {
      type: 'listen';
      text: string; // French text spoken by TTS
      options: string[];
      answer: number;
    }
  | {
      type: 'order';
      words: string[]; // shuffled at runtime
      answer: string; // the correct sentence, words joined by single spaces
      en?: string;
      zh?: string;
    };

/** src/data/lessons/<level>.json → Lesson[] */
export interface Lesson {
  id: string; // e.g. "a1-01"
  level: Level;
  titleFr: string;
  titleEn: string;
  titleZh: string;
  goalsEn: string[];
  goalsZh: string[];
  sections: LessonSection[];
  exercises: Exercise[];
}

/** src/data/writing.json → WritingTask[] */
export interface WritingTask {
  id: string; // e.g. "w1-01"
  task: 1 | 2 | 3;
  level: Level;
  titleEn: string;
  titleZh: string;
  promptFr: string;
  promptEn: string;
  promptZh: string;
  minWords: number;
  maxWords: number;
  documents?: { title: string; text: string }[]; // task 3: two short opposing texts
  modelAnswer: string;
  usefulPhrases: string[];
}

/** src/data/speaking.json → SpeakingTask[] */
export interface SpeakingTask {
  id: string; // e.g. "s2-01"
  task: 1 | 2 | 3;
  level: Level;
  titleEn: string;
  titleZh: string;
  promptFr: string;
  promptEn: string;
  promptZh: string;
  prepSeconds: number;
  speakSeconds: number;
  ideas: string[]; // French hints / question starters
  sampleAnswer: string;
}

/** src/data/guides.json → Guide[] */
export interface Guide {
  id: string; // slug, e.g. "nclc"
  titleEn: string;
  titleZh: string;
  summaryEn: string;
  summaryZh: string;
  updated: string; // YYYY-MM-DD the facts were last checked
  sections: {
    headingEn: string;
    headingZh: string;
    bodyEn: string; // markdown subset as above
    bodyZh: string;
    table?: { headers: string[]; rows: string[][] };
  }[];
  sources: { label: string; url: string }[];
}
