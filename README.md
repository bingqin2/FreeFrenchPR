# FreeFrenchPR

**Learn French from zero to Canadian PR — 100% free.**
从零开始学法语，冲刺加拿大 PR —— 完全免费。

A free, open-source alternative to paid TCF Canada prep sites. No account, no paywall: progress is stored in your browser.

**Live site:** https://bingqin2.github.io/FreeFrenchPR/

## Features

| | |
|---|---|
| 📘 **Course** | Step-by-step lessons A1 → B2 (sounds, grammar, vocabulary) with audio examples and four exercise types |
| 🧠 **Flashcards** | Vocabulary A1–C2 (French · English · 中文) with spaced repetition (SM-2) |
| 🎧 **Listening** | TCF-style audio questions by level, transcripts and explanations (audio = browser text-to-speech) |
| 📄 **Reading** | Signs, emails, articles and essays A1–C2 with explanations |
| ✍️ **Writing** | The 3 TCF writing tasks: word counter, timer, free grammar check (LanguageTool), model answers, AI-feedback prompt |
| 🎤 **Speaking** | The 3 TCF speaking tasks: prep/speaking timers, recording, speech-to-text, sample answers |
| 📝 **Mock exam** | 39-question listening or reading test (A1→C2 mix), estimated score /699, CEFR and NCLC |
| 🔎 **Dictionary** | Search all course words in French, English or Chinese |
| 🍁 **PR guides** | TCF Canada, NCLC tables, TCF vs TEF, Express Entry French bonus, CRS, study plan |
| 🌐 | English / 简体中文 interface, light/dark theme, mobile friendly, export/import progress |

## Run locally

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

```bash
npm run validate   # check every content JSON file against the schema
npm run build      # validate + type-check + production build into dist/
```

## Adding or fixing content

All learning content is plain JSON in [`src/data`](src/data). The shapes are documented in [`src/types.ts`](src/types.ts):

| Folder / file | Content |
|---|---|
| `vocab/<level>.json` | flashcard words |
| `listening/<level>.json` | listening questions (scripts are read by text-to-speech) |
| `reading/<level>.json` | reading questions |
| `lessons/<level>.json` | course lessons and exercises |
| `writing.json`, `speaking.json` | TCF production tasks |
| `guides.json` | Canada PR guides |

Run `npm run validate` after editing — it catches missing fields, bad answer indexes and duplicate IDs. Pull requests are welcome.

## Deployment

Every push to `main` builds the site and publishes it to GitHub Pages (see `.github/workflows/deploy.yml`). Routing uses the URL hash, so no server configuration is needed.

## Disclaimer

All content was written for this project. Questions imitate the *format* of TCF Canada but are not official, and score estimates use an unofficial weighting. Guides are general information, not immigration advice — always check [canada.ca](https://www.canada.ca/en/immigration-refugees-citizenship.html). Not affiliated with IRCC, France Éducation International, CCI Paris Île-de-France or any commercial prep site.

## License

Code: MIT. Content (`src/data`): [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). See [LICENSE](LICENSE).
