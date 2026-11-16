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
- **Measure:** statistics and charts on handovers, with a machine learning
  forecast of the workload for the next 14 days.

## Tech stack

- React 19, TypeScript, Vite and Tailwind CSS 4
- Firebase Firestore for shared records, with a browser-storage cache
- Python (pandas, scikit-learn) for the workload forecast
- Node.js and Express to serve the built app

## Getting started

Requires Node.js 20 or later.

```bash
npm install
```

```bash
npm run dev
```

The app runs at http://localhost:3000.

## Statistics and demo data

The Statistics screen shows headline figures and charts, and each section can be
switched on or off. A **Live data / Demo data** switch replaces every figure
with a generated year of handovers for testing and presentations. Demo data is
labelled on screen and is never written to the database.

## Workload forecast

No real operational records exist for this project, so the forecast is trained
on a synthetic history. The code is in `ml/`.

| File | What it does |
|---|---|
| `ml/generate_data.py` | Simulates three years of daily records per shift from a documented model: a trend, a weekly rhythm, two seasonal cargo peaks, occasional spike days and Poisson noise. A fixed seed makes it repeatable. |
| `ml/train_forecast.py` | Builds features, compares a baseline, ridge regression and gradient-boosted trees, evaluates on eight held-back weeks, then exports the forecast. |
| `ml/data/shift_history.csv` | The generated history. |
| `ml/reports/` | Evaluation figures (`metrics.json`) and an actual-versus-predicted chart. |
| `src/data/demoData.json` | What the app displays: the demo statistics and the 14-day forecast. |

The model predicts, for each shift of the next 14 days, the number of handovers
and the number of tasks carried over. Every input is at least 14 days old, so
one model covers the whole horizon. The split is by time: the last eight weeks
are never used for training or for choosing the model.

To regenerate the data and retrain (Python 3.10 or later):

```bash
python -m venv ml/.venv
```

```bash
ml/.venv/Scripts/python -m pip install -r ml/requirements.txt
```

```bash
ml/.venv/Scripts/python ml/generate_data.py
```

```bash
ml/.venv/Scripts/python ml/train_forecast.py
```

On macOS or Linux the interpreter is `ml/.venv/bin/python`.

**What the results mean.** The model learns the patterns that the generator put
into the data. Its accuracy shows that the pipeline works; it is not evidence of
how well it would predict a real operation. With real records, the same scripts
can be retrained on them.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Starts the Vite dev server |
| `npm run build` | Builds the client into `dist/` |
| `npm start` | Serves the built client |
| `npm run lint` | Type-checks the project |
| `npm run clean` | Removes `dist/` |

## Project structure

```
server.js                  Express server that hosts the built app
firestore.rules            Firestore security rules
ml/                        Synthetic data generator and forecast model (Python)
src/
  App.tsx                  Screen routing
  components/
    auth/                  Sign-in and registration
    dashboard/             The handover screen
    modals/                Start shift, add update, review and sign
    admin/                 Admin console
    analytics/             Statistics, charts, forecast
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
    statisticsSnapshot.ts  Aggregate figures for the Statistics screen
    forecast.ts            Types and loader for the exported forecast
  data/
    seedData.ts            Starting data
    demoData.json          Demo statistics and forecast, written by ml/
  types/                   Shared types
```

## Prototype limitations

This is an academic prototype. Do not use it with real operational or personal
data until these are addressed:

- Sign-in is checked in the browser only, with PINs kept in browser storage. It
  is a demonstration login, not real authentication.
- `firestore.rules` currently allows public read and write.
- Staff accounts are stored per browser and are not shared between devices.
- The forecast is trained on synthetic data and has not been validated against
  real records.
