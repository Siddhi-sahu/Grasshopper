# Grasshopper

Tiny side quests that get you outside. Gemma writes 5 things to find on a walk (easy → hard);
you photograph each one and CLIP checks the photo on-device. Entry for the DEV Hacktoberfest
Open-Source AI Challenge Week 1, theme "Touch Grass" (due Sun Oct 11 2026, 11:59 PM PDT).

## Run it

```bash
ollama serve            # needs gemma3:4b pulled
npm install
npm run dev             # server :3001 + web :5173 (also on LAN for phone testing)
npm run typecheck
```

Config lives in `.env` (see `.env.example`): `PORT`, `OLLAMA_URL`, `GEMMA_MODEL`, and for hosted
Gemma `GEMMA_PROVIDER=gemini`, `GEMINI_API_KEY`, `GEMINI_GEMMA_MODEL` (default `gemma-4-26b-a4b-it`).
Render: build `npm ci && npm run build`, start `npm start`; Express serves `web/dist`.

## Layout

- `server/` Express 5 + TypeScript (ESM, NodeNext, run with tsx)
  - `src/gemma.ts`: `GemmaClient` interface; `ollamaGemma` (local) and `geminiGemma` (Google
    AI Studio). Hosted Gemma 4 errors/times out with `responseJsonSchema` or `systemInstruction`,
    so both ride in the prompt; it also 500s intermittently, hence one retry in `quests.ts`.
  - `src/place.ts`: `GET /api/place?lat&lon` → city via OpenStreetMap Nominatim (coords rounded).
  - `src/quests.ts`: prompt + zod schema, passed to Ollama as a JSON-schema `format`.
    Difficulty is assigned by position (`LADDER`): Gemma miscounts the 2/2/1 split.
  - `src/index.ts`: `POST /api/quests { place? }` → `{ quests }`; 502 if Ollama fails.
- `web/` Vite + vanilla TypeScript, no framework
  - `src/main.ts`: views (home / loading / hunt) rendered as HTML strings, event delegation
    via `data-action`. Gemma text is escaped with `esc()`.
  - `src/clip.worker.ts`: Transformers.js `Xenova/clip-vit-base-patch32` zero-shot in a Web
    Worker. Candidates = target + other quests' `visual`s + generic decoys. Pass if top-1 or
    target score ≥ 0.3.
  - `src/verify.ts`: promise wrapper around the worker + model load status.
  - `src/store.ts`: current hunt (quests, photos as Blobs) in IndexedDB via idb-keyval.
  - `src/style.css`: green Y2K look: pixel font (Silkscreen) title bars, chunky ink shadows.
    Inspired by meowfolio (https://github.com/ThunderKhan/meowfolio).

## Decisions

- Local-first: photos never leave the device; CLIP is cached after first load so checks
  work with no signal. Only quest generation needs the server.
- The human has the final say: when CLIP isn't convinced, show what it thinks the photo is
  and offer "count it anyway" (stored as `trusted: true`).
- Photos are downscaled to 1024px JPEG before storing and checking.
- The user handles git (commits, pushes) themselves. Don't commit.

## Status (Oct 11)

Done: quest generation verified against local gemma3:4b (~13s, incl. place-specific quests
for "Jhansi, India"); CLIP pass/fail logic verified in Node on sample images (4/4 correct).

Not yet verified: the full UI in a real browser/phone (camera input, worker load in browser).

## Next

1. Test on a phone outside; tune the 0.3 threshold and decoys on real photos.
2. Auto-detect location (Geolocation API → OpenStreetMap Nominatim reverse geocode).
3. PWA/service worker so the app shell also loads offline.
4. Deploy: Render (Express + static) with a hosted Gemma.
5. DEV post using the challenge template; embed agent sessions; consider partner
   categories (Gemma, Render, Entire, ElevenLabs).
