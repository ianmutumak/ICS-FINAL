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
| `ml/train_forecast.py` | Builds features, compares three models with rolling-origin backtesting, scores the chosen model once on eight held-back weeks, runs diagnostics, then exports the forecast. |
| `ml/check_against_truth.py` | Compares forecasts with the generator's true expected values, separating noise in the data from the model's own error. |
| `ml/data/shift_history.csv` | The generated history. |
| `ml/reports/` | `metrics.json` (every figure below and more), `backtest.png` (error per model per fold) and `forecast_evaluation.png` (actual versus predicted on the test weeks). |
| `src/data/demoData.json` | What the app displays: the demo statistics and the 14-day forecast. |

### Method

- **What is predicted:** for each shift of the next 14 days, the number of
  handovers and the number of tasks carried over.
- **Inputs:** the shift, the day of the week, the time of year, and past values
  from 2 to 4 weeks earlier and from the same fortnight a year earlier. Every
  input is at least 14 days old, so one model covers the whole 14-day horizon.
- **Candidates:** a baseline (the same weekday two weeks earlier), Poisson
  regression (a linear model on the log scale, suited to counts) and
  gradient-boosted trees.
- **Choosing a model:** rolling-origin backtesting over the 24 weeks before the
  test period, in 12 two-week folds. For each fold the models are trained on
  everything before it. The simpler Poisson regression is kept unless the trees
  are better by more than one standard error.
- **Testing:** the last eight weeks are used once, after the model is chosen.
  Each test day is predicted only from information at least 14 days older.
- **Likely range:** the 80% range shown in the app comes from the backtest errors,
  not from the test weeks, and is then checked on the test weeks.

### Results

| | Handovers | Tasks carried over |
|---|---|---|
| Model chosen | Poisson regression | Poisson regression |
| Backtest error per shift, model (12 folds) | 1.95 ± 0.20 | 0.90 ± 0.14 |
| Backtest error per shift, baseline | 2.72 ± 0.32 | 1.24 ± 0.17 |
| Folds where the model was best | 9 of 12 | 9 of 12 |
| Test error per shift, model vs baseline | 2.01 vs 2.53 (21% lower) | 0.98 vs 1.13 (13% lower) |
| Test days inside the 80% range | 71% | 70% |

Errors are mean absolute errors. The two learned models are within one
standard error of each other on both targets; both beat the baseline on every
fold.

### Diagnostics

- **Bias:** on the test weeks the model over-predicts by 0.27 handovers per
  shift and is unbiased for tasks carried over (0.01). Day-to-day correlation in
  its errors is inside the 95% bound, so no pattern is left over in time.
- **Weekdays:** the test errors look large on Thursdays, Fridays and Saturdays
  (1 to 1.5 handovers per shift). Comparing with the generator's true values shows
  that those days happened to fall well away from their expected level in those
  eight weeks; the model's own gap to the true values is under 0.4 on every weekday.
- **What the model relies on:** scrambling the shift or the calendar inputs raises
  the error by 4 to 11%; scrambling past values raises it by under 2%. The model
  has mostly learned the regular calendar pattern, which is how the data was made.
- **A problem the diagnostics caught:** an earlier version included an explicit
  trend term. Comparing its forecasts with the generator's true values showed it
  over-predicting more each week it looked ahead, because recent values already
  carry the current level and the trend added growth on top. Removing it halved
  the gap to the true values.
- **The 80% range is a little narrow:** it held on 70 to 71% of test days rather
  than 80%. With 56 test days that is within sampling error, but it was not
  adjusted on the test weeks, since that would make the check meaningless.

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

```bash
ml/.venv/Scripts/python ml/check_against_truth.py
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
