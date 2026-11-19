# Zamu-Check

A web-based shift handover system for cargo and warehouse teams. Staff record
updates for the next shift in the SBAR structure (Situation, Background,
Assessment, Recommendation), the outgoing and incoming staff each sign, and an
administrator approves the handover.

Built as an Informatics and Computer Science capstone project at Strathmore
University.

## What it does

- **Record:** staff start a shift and log SBAR updates as things happen, with an
  optional safety warning shown at the top of an update. Equipment in custody is
  listed and checked during the handover.
- **Sign:** the outgoing staff member signs first, then the incoming staff
  member signs with a different account. The incoming staff member must
  acknowledge every safety warning before they can sign. Updates and equipment
  cannot change once the outgoing staff member has signed.
- **Seal:** each signed handover gets a SHA-256 seal; a record that changes after
  signing is reported.
- **Approve:** an administrator approves the signed handover. It is archived and
  the next shift opens with open items carried over; safety warnings must be
  acknowledged again.
- **Watch:** a live Handover Effectiveness Index (0 to 100) shows how complete the
  handover is, and a banner flags a shift left unsigned for 9.5 hours or a signed
  handover left unapproved for 4 hours.
- **Administer:** manage users, facility zones, incidents, the override log and a
  read-only audit trail of who did what and when.
- **Measure:** statistics and charts on handovers, with a machine learning
  forecast of the workload for the next 14 days. The administrator can plan for or
  dismiss each forecast warning, and the decision is recorded in the audit trail.
- **Print:** a handover can be printed from the handover screen.

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
- **Candidates:** a baseline (the same weekday two weeks earlier), Holt-Winters
  exponential smoothing (a classic statistical method), Poisson regression (a
  linear model on the log scale, suited to counts) and gradient-boosted trees.
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
| Backtest error per shift, baseline (12 folds) | 2.72 ± 0.32 | 1.24 ± 0.17 |
| Backtest error per shift, Holt-Winters | 1.97 ± 0.17 | 0.91 ± 0.14 |
| Backtest error per shift, Poisson regression | 1.95 ± 0.20 | 0.90 ± 0.14 |
| Backtest error per shift, gradient-boosted trees | 1.94 ± 0.18 | 0.90 ± 0.15 |
| Folds each method was best (baseline, Holt-Winters, Poisson, trees) | 0, 4, 4, 4 | 0, 4, 5, 3 |
| Model used in the app | Poisson regression | Poisson regression |
| Test error per shift: baseline, Poisson regression | 2.53, 1.97 (22% lower) | 1.12, 0.96 (15% lower) |
| Test error per shift: Holt-Winters, trees | 1.96, 1.95 | 0.96, 0.97 |
| Test days inside the 80% range | 71% | 79% |

Errors are mean absolute errors. **The three methods that look at the seasonal
pattern are statistically tied**: Holt-Winters smoothing, Poisson regression and
boosted trees differ by far less than the fold-to-fold variation, and every one
of them beats the baseline on every fold. This is an honest result: on three
years of daily counts with a regular pattern, a classic statistical method does
as well as the machine learning models. Poisson regression is used in the app
because the simpler learned model is kept unless the trees are clearly better,
and because it is quick to retrain and easy to explain.

### Tuning

Settings were tuned on six past forecasts that come before the twelve used to
compare models, so the comparison is not flattered by settings chosen on the same
weeks. Poisson regression: regularisation 1.0 (handovers) and
1.0 (tasks). Trees: {'learning_rate': 0.03, 'max_depth': 2} and {'learning_rate': 0.03, 'max_depth': 2}.

### Diagnostics

- **Bias:** on the test weeks the model over-predicts by 0.26 handovers per
  shift and is nearly unbiased for tasks carried over (+0.01). Day-to-day correlation
  in its errors is inside the 95% bound, so no pattern is left over in time.
- **Error analysis:** the worst test days for handovers were 2026-11-02 (Mon, actual 34, forecast 19.9), 2026-09-28 (Mon, actual 9, forecast 19.3), 2026-11-10 (Tue, actual 28, forecast 17.8).
  Misses like these come from random variation and occasional spike days in the
  generated data, which no method can predict; they are not a failure to follow
  the pattern.
- **Weekdays:** the test errors look large on Thursdays, Fridays and Saturdays
  (about 1 handover per shift). Comparing with the generator's true values shows
  that those days happened to fall well away from their expected level in those
  eight weeks; the model's own gap to the true values is under 0.3 on every weekday.
- **What the model relies on:** scrambling the shift, calendar or past-value inputs
  raises the error by only 2.5 to 3.9% for handovers
  (shift 3.9%, calendar 3.1%, past values 2.5%). The inputs overlap, so none is
  critical alone. The model has learned the regular pattern, which is how the data was made.
- **A problem the diagnostics caught:** an earlier version included an explicit
  trend term. Comparing its forecasts with the generator's true values showed it
  over-predicting more each week it looked ahead, because recent values already
  carry the current level and the trend added growth on top. Removing it halved
  the gap to the true values.
- **The 80% range:** it is calibrated on 26 past forecasts and widens with the
  size of the forecast, because counts vary more when they are higher. It held on
  71% (handovers) and 79% (tasks carried over) of the 56 test days. The shortfall
  for handovers comes from the test weeks, not from the range. The range was not
  adjusted on the test weeks, since that would make the check meaningless.
- **Drift check:** the error over the last 28 days (2.051 for handovers) is compared with the usual backtest
  error plus two standard deviations (2.355); it reads "stable". A deployment would run this each time new
  records arrive and retrain when it reads "review".

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
| `npm start` | Serves the built client; `/healthz` reports whether a build is present |
| `npm run lint` | Type-checks the project |
| `npm test` | Runs the automated unit tests |
| `npm run clean` | Removes `dist/` |

## Project structure

```
server.js                  Express server that hosts the built app, with a /healthz check
firebase.json              Firebase Hosting and Firestore configuration
firestore.rules            Firestore security rules
ml/                        Synthetic data generator and forecast model (Python)
src/
  App.tsx                  Screen routing
  components/
    auth/                  Sign-in and registration
    dashboard/             The handover screen
    modals/                Start shift, add update, review and sign
    admin/                 Admin console and audit trail
    analytics/             Statistics, charts, forecast
    layout/, common/       Header and icons
  context/
    HandoverContext.tsx    Combines the modules below into one provider
    useAuth.ts             Staff accounts and the current session
    useFacility.ts         Zones, categories and incidents
    useShift.ts            Open handover, tasks, signatures, approval, archive
    useForecastReview.ts   Administrator decisions about forecast warnings
    storage.ts             Browser storage keys and helpers
  lib/
    shiftRules.ts          Shift windows, SHA-256 seal, effectiveness index, overdue alerts
    auditTrail.ts          Builds the audit trail from handovers, overrides and decisions
    firebase.ts            Firebase set-up
    firestoreService.ts    Reading and writing Firestore records
    statisticsSnapshot.ts  Aggregate figures for the Statistics screen
    forecast.ts            Types and loader for the exported forecast
  data/
    seedData.ts            Starting data
    demoData.json          Demo statistics and forecast, written by ml/
  types/                   Shared types
```

Automated tests sit beside the code they test (`*.test.ts`). The helpers they
share are in `src/lib/testHelpers.ts`.

## Hosting

The application is a browser client that talks to Firestore, so Firebase Hosting
is the natural home for it: `npm run build`, then `firebase deploy --only hosting`
(configuration in `firebase.json`). Do not deploy with the open database rules.

## Prototype limitations

This is an academic prototype. Do not use it with real operational or personal
data until these are addressed:

- Each signed handover carries a SHA-256 seal of its updates, signers and signing
  times, computed in the browser. It shows whether a record changed after signing,
  but it is not tamper-proof against someone who can edit the database.
- Writes made while offline are queued by the Firestore local cache and sent when
  the connection returns; conflicts are resolved as last write wins.
- Sign-in is checked in the browser only, with PINs kept in browser storage. It
  is a demonstration login, not real authentication. The locks on signed handovers
  and the acknowledgement rule are enforced by the application, not by the
  database.
- `firestore.rules` currently allows public read and write.
- Staff accounts are stored per browser and are not shared between devices.
- The forecast is trained on synthetic data and has not been validated against
  real records.
