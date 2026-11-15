# Zamu-Check

A web-based shift handover system for cargo and warehouse teams. Staff record
updates for the next shift in the SBAR structure (Situation, Background,
Assessment, Recommendation), the outgoing and incoming staff each sign, and an
administrator approves the handover.

Built as an Informatics and Computer Science capstone project at Strathmore
University.

## What it does

- **Record:** staff start a shift and log SBAR updates as things happen, with an
  optional safety warning shown at the top of an update.
- **Sign:** the outgoing staff member signs first, then the incoming staff
  member signs with a different account.
- **Approve:** an administrator approves the signed handover. It is archived and
  the next shift opens with open items carried over.
- **Administer:** manage users, facility zones, incidents and the override log.
- **Measure:** statistics on handovers, a System Usability Scale (SUS) survey,
  and an assistant that answers questions about the aggregate figures.

## Tech stack

- React 19, TypeScript, Vite and Tailwind CSS 4
- Firebase Firestore for shared records, with a browser-storage cache
- Node.js and Express for the statistics assistant, using Ollama (local) or Gemini

## Getting started

Requires Node.js 20 or later.

```bash
npm install
```

Copy `.env.example` to `.env` and choose the assistant provider. The default is
a local Ollama model, which needs no API key:

```bash
ollama pull qwen2.5:3b
```

To use Gemini instead, set `AI_PROVIDER=gemini` and `GEMINI_API_KEY` in `.env`.
The key is read by the server only; never give it a `VITE_` prefix.

Start the app and the API together:

```bash
npm run dev
```

The app runs at http://localhost:3000 and the API at http://localhost:3004.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Starts the API server and the Vite dev server |
| `npm run build` | Builds the client into `dist/` |
| `npm start` | Serves the built client and the API from one server |
| `npm run lint` | Type-checks the project |
| `npm run clean` | Removes `dist/` |

## Project structure

```
server.js                  Express server: statistics assistant API and static hosting
scripts/dev.js             Runs the server and Vite together
firestore.rules            Firestore security rules
src/
  App.tsx                  Screen routing
  components/
    auth/                  Sign-in and registration
    dashboard/             The handover screen
    modals/                Start shift, add update, review and sign
    admin/                 Admin console
    analytics/             Statistics, SUS survey, assistant
    layout/, common/       Header and icons
  context/
    HandoverContext.tsx    Combines the modules below into one provider
    useAuth.ts             Staff accounts and the current session
    useFacility.ts         Zones, categories and incidents
    useShift.ts            Open handover, tasks, signatures, approval, archive
    storage.ts             Browser storage keys and helpers
  lib/
    shiftRules.ts          Shift windows, codes, durations, effectiveness index
    firebase.ts            Firebase set-up
    firestoreService.ts    Reading and writing Firestore records
    statisticsSnapshot.ts  Aggregate figures sent to the assistant
  data/seedData.ts         Starting data
  types/                   Shared types
```

## Prototype limitations

This is an academic prototype. Do not use it with real operational or personal
data until these are addressed:

- Sign-in is checked in the browser only, with PINs kept in browser storage. It
  is a demonstration login, not real authentication.
- `firestore.rules` currently allows public read and write.
- The statistics API does not verify who is calling it.
- Staff accounts are stored per browser and are not shared between devices.
