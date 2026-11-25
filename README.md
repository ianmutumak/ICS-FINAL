# Zamu-Check

A web-based shift handover system for cargo and warehouse teams. Staff record
updates for the next shift in the SBAR structure (Situation, Background,
Assessment, Recommendation), the outgoing and incoming staff each sign, and an
administrator approves the handover.

Built as an Informatics and Computer Science capstone project at Strathmore
University.

## What it does

- **Record:** staff start a shift and log SBAR updates as things happen. Each of Situation,
  Background, Assessment and Recommendation is picked from a list of ready-made cargo and
  warehouse wording (or filled at once from a common case), and the person adds only what is
  unusual. An optional safety warning, also picked from a list, is shown at the top of the
  update. Equipment in custody is listed and checked during the handover.
- **Sign:** the outgoing staff member signs first, then the incoming staff
  member signs with a different account. The incoming staff member must
  acknowledge every safety warning before they can sign. Updates and equipment
  cannot change once the outgoing staff member has signed.
- **Seal:** each signed handover gets a SHA-256 seal, computed by the server; a record
  that changes after signing is reported.
- **Approve:** an administrator approves the signed handover. It is archived and
  the next shift opens with open items carried over; safety warnings must be
  acknowledged again.
- **Watch:** a live Handover Effectiveness Index (0 to 100) shows how complete the
  handover is, and a banner flags a shift left unsigned for 9.5 hours or a signed
  handover left unapproved for 4 hours.
- **Start on time:** starting a shift records who started it and when, against the shift's
  scheduled start (07:00, 15:00 and 23:00). A start more than 15 minutes late is shown on the
  handover and flagged to administrators, apart from the workload forecast. The work area is
  chosen from the zones an administrator added, or from standard warehouse areas until then.
- **Administer:** manage users, facility zones and incidents, see shift start times and
  lateness, and read an audit trail of who did what and when.
- **Measure:** statistics and charts on handovers, with a machine learning
  forecast of the workload for the next 14 days. The administrator can plan for or
  dismiss each forecast warning, and the decision is recorded in the audit trail.
- **Profile and theme:** each person can add a profile picture and change their own PIN, and
  switch between light and dark mode. The choice is remembered on that device.

## Tech stack

- React 19, TypeScript, Vite and Tailwind CSS 4 for the browser app
- Node.js and Express for the API, which enforces every rule and role
- MongoDB (MongoDB Atlas when deployed) for all records
- Python (pandas, scikit-learn, statsmodels) for the workload forecast

The browser never talks to the database. It signs in through the API and receives a
session cookie that scripts on the page cannot read. PINs are kept only as salted
scrypt hashes.

## Getting started

Requires Node.js 20.12 or later.

```bash
npm install
```

To try the app with a MongoDB that runs on this computer, with no account needed:

```bash
npm run dev
```

The first run downloads a MongoDB program (about 100 MB). The terminal prints the
address to open (usually http://localhost:3000, or the next free port) and a
development administrator badge ID and PIN. Data is kept in `.devdata/`.

To use your own MongoDB, such as Atlas, copy `.env.example` to `.env`, fill it in,
and run:

```bash
npm run dev:atlas
```

Settings (all in `.env`, never committed):

| Setting | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB connection string |
| `SESSION_SECRET` | At least 32 random characters; signs session cookies |
| `INITIAL_ADMIN_BADGE`, `INITIAL_ADMIN_PIN` | Creates the first administrator when the database has none. Remove the PIN afterwards |
| `ALLOW_SELF_REGISTRATION` | `false` by default: administrators create accounts |

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
| `npm run dev` | API and app together, on a local MongoDB |
| `npm run dev:atlas` | API and app together, on the MongoDB in `.env` |
| `npm run build` | Builds the app into `dist/` |
| `npm start` | Runs the API and serves the built app (what a host runs) |
| `npm test` | Runs the unit tests and the server tests (these start a throwaway MongoDB) |
| `npm run lint` | Type-checks the project |
| `npm run backup` | Saves the whole database to `backups/` |
| `npm run restore -- <file>` | Restores a backup into an empty database (`--replace` to overwrite) |
| `npm run demo:seed` | Fills a local system with invented demo handovers (see `scripts/seed-demo.js`) |

## Project structure

```
server/                    The API (Express and MongoDB)
  app.js                   Security headers, origin check, routes, static hosting
  auth.js                  PIN hashing, sessions, roles, sign-in limiter
  rules.js                 The handover rules and the SHA-256 seal
  routes/                  auth, users, shifts, and the other records
  backup.js                Database export and import
  *.test.js                Server tests against a real MongoDB
scripts/                   dev launcher, backup, restore and demo data
render.yaml                Deployment blueprint for Render
ml/                        Synthetic data generator and forecast model (Python)
src/
  App.tsx                  Screen routing
  components/
    auth/                  Sign-in
    dashboard/             The handover screen
    modals/                Start shift, add update, review and sign, edit profile
    admin/                 Admin console: users, zones, shift starts, audit trail
    analytics/             Statistics, charts, forecast
    layout/, common/       Header and icons
  context/                 Auth, shift, facility and forecast-review hooks
  lib/                     API client, shift rules, audit trail, statistics, theme
  data/                    SBAR templates, work areas, demo statistics and forecast (written by ml/)
  types/                   Shared types
```

Automated tests sit beside the code they test (`*.test.ts`, `*.test.js`).

## Deployment

The app runs as one Node service with MongoDB Atlas behind it:

1. Create an Atlas cluster (the free M0 tier is enough), a database user, and a
   network rule. Copy the connection string.
2. In Render choose New, then Blueprint, and select this repository. `render.yaml`
   sets everything except the values you are asked for: the connection string and the
   first administrator's badge ID and PIN.
3. When the service is live, open `/healthz`; it reports whether the database is
   reachable. Sign in as the administrator, create staff accounts, then remove
   `INITIAL_ADMIN_PIN` from the service's environment.
4. Take a backup with `npm run backup` (Atlas's free tier has no automatic backups)
   and keep the file private, because it contains PIN hashes.

## Security model

- Every action is checked on the server: who may sign, in what order, which
  warnings must be acknowledged, what is locked, and who may approve. The browser
  only displays what is allowed.
- PINs are stored as salted scrypt hashes; failed sign-ins are limited per badge
  and per address.
- The session cookie is `HttpOnly`, `SameSite=Lax` and `Secure` in production.
- Each tab tells the server which account it is showing. If another account has
  signed in on the same browser, the old tab is signed out instead of acting as
  the wrong person.
- Requests from another website are refused; in production the page is served with a
  strict content security policy.

## Prototype limitations

This is an academic prototype. Do not use it with real operational or personal
data until these are addressed:

- A PIN of 4 to 6 digits is easy to guess if someone obtains the database and
  hashes; the sign-in limiter protects only against guessing through the app.
  Longer passphrases or a second factor would be needed in real use.
- The sign-in limiter and session secret are per server process. Running several
  servers would need a shared store for the limiter.
- A signed handover's SHA-256 seal shows whether the record changed, but someone
  who can edit the database can edit the seal too.
- Forecast decisions, timing runs and the audit trail are stored on the server,
  but the audit trail is derived from the records and not an independent log.
- Accounts are not tied to a department, so any signed-in staff member can see and
  add updates to the open shift.
- The forecast is trained on synthetic data and has not been validated against
  real records.
