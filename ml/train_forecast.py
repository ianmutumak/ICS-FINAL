"""Train and evaluate the Zamu-Check workload forecast, then export it for the web app.

For every shift of the next 14 days the model predicts:
    handovers            how many handovers the shift will produce
    tasks_carried_over   how many tasks will be left for the following shift

Method
------
* Direct 14-day-ahead forecasting: every feature is at least 14 days old, so one model
  serves the whole horizon and no prediction is fed back in as an input.
* Three candidates are compared: a seasonal-naive baseline (the same weekday two weeks
  earlier), Poisson regression (a linear model on the log scale, suited to counts), and gradient-boosted
  trees with a Poisson loss.
* Every split is by time, never random. Each test day is predicted only from information
  that existed at least 14 days earlier.
* Model choice uses rolling-origin backtesting: the 24 weeks before the test period are cut
  into 12 two-week folds. For each fold the models are trained on everything before it and
  scored on it, so the comparison rests on 12 separate forecasts rather than one.
* The 80% range comes from the backtest errors, then is checked on the test period.
* The final 8 weeks are an untouched test set, used once, after the model is chosen.
* Diagnostics: which inputs the model relies on (permutation importance), and whether its
  errors are biased or still contain a pattern (by weekday, by shift, autocorrelation).
* The chosen model is refitted on all history before forecasting.

Outputs
-------
    ml/reports/metrics.json               evaluation figures for the report
    ml/reports/forecast_evaluation.png    actual vs predicted on the test weeks
    ml/reports/backtest.png               error of each model on each backtest fold
    src/data/demoData.json                demo statistics and the forecast shown in the app
"""

from __future__ import annotations

import argparse
import json
from datetime import timedelta
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.linear_model import PoissonRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

HERE = Path(__file__).parent
ROOT = HERE.parent
SHIFTS = ("morning", "evening", "night")
TARGETS = {"handovers": "Handovers", "tasks_carried_over": "Tasks carried over"}
HORIZON_DAYS = 14
BACKTEST_FOLDS = 12
IMPORTANCE_REPEATS = 30
# Waves per year used to describe the season; more waves can follow sharper peaks.
YEARLY_HARMONICS = (1, 2, 3, 4)
TEST_DAYS = 56
HISTORY_DAYS_IN_APP = 42
TARGET_MINUTES = 20
SEED = 144861

MODEL_LABELS = {
    "baseline": "Same weekday two weeks earlier (baseline)",
    "linear": "Poisson regression",
    "boosting": "Gradient-boosted trees",
}


# ---------------------------------------------------------------- features

def add_future_rows(history: pd.DataFrame) -> pd.DataFrame:
    """Appends empty rows for the days to be forecast, so they get features like any other day."""
    last_day = history["date"].max()
    future = pd.DataFrame(
        [{"date": last_day + timedelta(days=step), "shift": shift}
         for step in range(1, HORIZON_DAYS + 1) for shift in SHIFTS]
    )
    return pd.concat([history, future], ignore_index=True)


def build_features(frame: pd.DataFrame, target: str) -> tuple[pd.DataFrame, list[str]]:
    frame = frame.sort_values(["shift", "date"]).reset_index(drop=True).copy()
    day_of_year = frame["date"].dt.day_of_year

    # No explicit trend term: recent values already carry the current level, and a trend on top
    # of them double-counts growth, so the forecast drifts upward the further ahead it looks.
    for harmonic in YEARLY_HARMONICS:
        frame[f"year_sin_{harmonic}"] = np.sin(2 * np.pi * harmonic * day_of_year / 365.25)
        frame[f"year_cos_{harmonic}"] = np.cos(2 * np.pi * harmonic * day_of_year / 365.25)
    for weekday in range(7):
        frame[f"weekday_{weekday}"] = (frame["date"].dt.day_of_week == weekday).astype(float)
    for shift in SHIFTS:
        frame[f"shift_{shift}"] = (frame["shift"] == shift).astype(float)

    # Past values of the target, and of handovers as a measure of how busy the shift was.
    sources = [target] if target == "handovers" else [target, "handovers"]
    lag_columns: list[str] = []
    for source in sources:
        by_shift = frame.groupby("shift")[source]
        for lag in (14, 21, 28, 364):
            name = f"{source}_lag_{lag}"
            frame[name] = by_shift.shift(lag)
            lag_columns.append(name)
        name = f"{source}_mean_28_to_14_days_ago"
        frame[name] = by_shift.transform(lambda series: series.shift(HORIZON_DAYS).rolling(28).mean())
        lag_columns.append(name)
        # How busy the same fortnight was a year ago (15 days centred on 364 days earlier).
        # It carries the shape of the season, including short peaks that a few smooth yearly
        # waves cannot follow, without being told when the peaks are.
        name = f"{source}_same_fortnight_last_year"
        frame[name] = by_shift.transform(lambda series: series.shift(364 - 7).rolling(15).mean())
        lag_columns.append(name)
        # Log versions, so the log-scale Poisson model can use them as multipliers.
        for base in (f"{source}_mean_28_to_14_days_ago", f"{source}_same_fortnight_last_year"):
            frame[f"log_{base}"] = np.log1p(frame[base])
            lag_columns.append(f"log_{base}")

    calendar_columns = (
        [f"year_{kind}_{h}" for h in YEARLY_HARMONICS for kind in ("sin", "cos")]
        + [f"weekday_{d}" for d in range(7)]
        + [f"shift_{s}" for s in SHIFTS]
    )
    return frame, calendar_columns + lag_columns


def make_model(name: str):
    if name == "linear":
        # Counts with multiplicative effects (shift x weekday x season x trend): a log-link
        # Poisson model fits that shape; plain linear regression adds the effects instead.
        return make_pipeline(StandardScaler(), PoissonRegressor(alpha=1e-4, max_iter=1000))
    if name == "boosting":
        return HistGradientBoostingRegressor(
            loss="poisson", learning_rate=0.05, max_iter=300, max_depth=3,
            min_samples_leaf=20, l2_regularization=1.0, random_state=SEED,
        )
    raise ValueError(name)


def predict(name: str, model, rows: pd.DataFrame, features: list[str], target: str) -> np.ndarray:
    if name == "baseline":
        return rows[f"{target}_lag_14"].to_numpy(dtype=float)
    return np.clip(model.predict(rows[features]), 0, None)


def errors(actual: np.ndarray, predicted: np.ndarray) -> dict[str, float]:
    return {
        "mae": round(float(mean_absolute_error(actual, predicted)), 3),
        "rmse": round(float(np.sqrt(mean_squared_error(actual, predicted))), 3),
    }


# ---------------------------------------------------------------- one target

# Inputs that carry the same information are scrambled together; scrambling one of two
# overlapping inputs understates how much the model relies on what they share.
FEATURE_GROUPS = {
    "Past values (2 weeks to 1 year earlier)": lambda name: "_lag_" in name or "_mean_" in name or "_last_year" in name,
    "Calendar (weekday, time of year)": lambda name: name.startswith(("weekday_", "year_")),
    "Shift": lambda name: name.startswith("shift_"),
}


def fit_and_predict(name: str, train: pd.DataFrame, rows: pd.DataFrame, features: list[str], target: str):
    model = None if name == "baseline" else make_model(name).fit(train[features], train[target])
    return model, predict(name, model, rows, features, target)


def daily_totals(rows: pd.DataFrame, target: str, predicted: np.ndarray) -> pd.DataFrame:
    return rows[["date", target]].assign(predicted=predicted).groupby("date").sum(numeric_only=True)


def backtest(known: pd.DataFrame, features: list[str], target: str, test_start: pd.Timestamp) -> dict:
    """Rolling-origin evaluation over the weeks before the test period."""
    folds = []
    residuals = {name: {"shift": [], "day": []} for name in ("baseline", "linear", "boosting")}
    for fold in range(BACKTEST_FOLDS, 0, -1):
        fold_start = test_start - timedelta(days=fold * HORIZON_DAYS)
        fold_end = fold_start + timedelta(days=HORIZON_DAYS)
        train = known[known["date"] < fold_start]
        rows = known[(known["date"] >= fold_start) & (known["date"] < fold_end)].sort_values(["date", "shift"])
        scores = {"from": fold_start.date().isoformat()}
        for name in residuals:
            _, predicted = fit_and_predict(name, train, rows, features, target)
            scores[name] = round(float(mean_absolute_error(rows[target], predicted)), 3)
            residuals[name]["shift"].extend(rows[target].to_numpy() - predicted)
            daily = daily_totals(rows, target, predicted)
            residuals[name]["day"].extend((daily[target] - daily["predicted"]).to_numpy())
        folds.append(scores)

    summary = {}
    for name in residuals:
        values = np.array([fold[name] for fold in folds])
        summary[name] = {"meanMae": round(float(values.mean()), 3), "stdMae": round(float(values.std(ddof=1)), 3)}
    wins = {name: sum(1 for fold in folds if fold[name] == min(fold[n] for n in residuals)) for name in residuals}
    return {"folds": folds, "summary": summary, "wins": wins, "residuals": residuals}


def choose_model(folds: dict) -> tuple[str, str]:
    """One-standard-error rule: keep the simpler linear model unless the trees are clearly better.

    "Clearly" means the trees' average backtest error is lower by more than one standard error
    of the per-fold difference. A gap smaller than that could be luck in which weeks were tested.
    """
    differences = np.array([fold["linear"] - fold["boosting"] for fold in folds["folds"]])
    standard_error = differences.std(ddof=1) / np.sqrt(len(differences))
    gap = differences.mean()
    if gap > standard_error:
        return "boosting", f"Trees beat the linear model by {gap:.3f} per shift, more than one standard error ({standard_error:.3f})."
    return "linear", f"Trees were not better by more than one standard error ({gap:+.3f} vs {standard_error:.3f}), so the simpler model is kept."


def group_importance(model_name: str, model, rows: pd.DataFrame, features: list[str], target: str) -> list[dict]:
    """Share of the forecast error added when a group of inputs is scrambled (permutation importance).

    Measured as the rise in mean squared error, relative to the unscrambled error. Absolute error
    is a poor yardstick here: with noisy counts it barely moves even when predictions shift a lot.
    """
    rng = np.random.default_rng(SEED)
    actual = rows[target].to_numpy()
    base_mse = mean_squared_error(actual, predict(model_name, model, rows, features, target))
    results = []
    for group, belongs in FEATURE_GROUPS.items():
        columns = [name for name in features if belongs(name)]
        if not columns:
            continue
        increases = []
        for _ in range(IMPORTANCE_REPEATS):
            shuffled = rows.copy()
            order = rng.permutation(len(rows))
            shuffled[columns] = rows[columns].to_numpy()[order]
            increases.append(mean_squared_error(actual, predict(model_name, model, shuffled, features, target)) / base_mse - 1)
        results.append({"group": group, "errorIncreasePercent": round(100 * float(np.mean(increases)), 1)})
    return sorted(results, key=lambda item: item["errorIncreasePercent"], reverse=True)


def residual_checks(rows: pd.DataFrame, target: str, predicted: np.ndarray) -> dict:
    residual = rows[target].to_numpy() - predicted
    frame = rows[["date", "shift"]].assign(residual=residual)
    daily = frame.groupby("date")["residual"].sum()

    def autocorrelation(series: pd.Series, lag: int) -> float:
        return round(float(series.autocorr(lag)), 3)

    return {
        "meanError": round(float(residual.mean()), 3),
        "meanErrorByShift": {shift: round(float(value), 3) for shift, value in frame.groupby("shift")["residual"].mean().items()},
        "meanErrorByWeekday": {
            day: round(float(frame.loc[frame["date"].dt.day_of_week == index, "residual"].mean()), 3)
            for index, day in enumerate(("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"))
        },
        "dailyErrorAutocorrelation": {
            "lag1": autocorrelation(daily, 1),
            "lag7": autocorrelation(daily, 7),
            # Approximate 95% bound for "no autocorrelation" with this many days.
            "bound95": round(2 / np.sqrt(len(daily)), 3),
        },
        "note": "Errors near 0 with no pattern by shift or weekday, and autocorrelations inside the bound, mean the model has picked up the structure in the data.",
    }


def forecast_target(history: pd.DataFrame, target: str) -> dict:
    last_day = history["date"].max()
    frame, features = build_features(add_future_rows(history), target)

    known = frame[frame[target].notna()].dropna(subset=features)
    future = frame[frame[target].isna()].sort_values(["date", "shift"])
    test_start = last_day - timedelta(days=TEST_DAYS - 1)
    development = known[known["date"] < test_start]
    test = known[known["date"] >= test_start].sort_values(["date", "shift"])

    # 1. Choose the model by rolling-origin backtesting on the weeks before the test period.
    folds = backtest(known, features, target, test_start)
    chosen, choice_reason = choose_model(folds)

    # 2. An 80% range from the chosen model's backtest errors (the test period is not used for this).
    shift_low, shift_high = np.quantile(folds["residuals"][chosen]["shift"], [0.10, 0.90])
    daily_low, daily_high = np.quantile(folds["residuals"][chosen]["day"], [0.10, 0.90])

    # 3. Score every candidate once on the untouched test weeks.
    test_results = {}
    test_predictions = {}
    chosen_model = None
    for name in ("baseline", "linear", "boosting"):
        model, test_predictions[name] = fit_and_predict(name, development, test, features, target)
        test_results[name] = errors(test[target].to_numpy(), test_predictions[name])
        if name == chosen:
            chosen_model = model

    daily = daily_totals(test, target, test_predictions[chosen])
    daily["baseline"] = daily_totals(test, target, test_predictions["baseline"])["predicted"]
    daily_results = {
        "model": errors(daily[target].to_numpy(), daily["predicted"].to_numpy()),
        "baseline": errors(daily[target].to_numpy(), daily["baseline"].to_numpy()),
    }
    improvement = 1 - test_results[chosen]["mae"] / test_results["baseline"]["mae"]
    inside = (daily[target] >= daily["predicted"] + daily_low) & (daily[target] <= daily["predicted"] + daily_high)

    # 4. Diagnostics on the test weeks.
    importance = group_importance(chosen, chosen_model, test, features, target)
    checks = residual_checks(test, target, test_predictions[chosen])

    # 5. Refit on everything and forecast the next 14 days.
    final_model = make_model(chosen).fit(known[features], known[target])
    future = future.assign(predicted=predict(chosen, final_model, future, features, target))

    by_day = []
    for day, rows in future.groupby("date"):
        total = float(rows["predicted"].sum())
        entry = {
            "date": day.date().isoformat(),
            "value": round(total, 1),
            "low": round(max(total + daily_low, 0.0), 1),
            "high": round(max(total + daily_high, 0.0), 1),
        }
        for _, row in rows.iterrows():
            entry[row["shift"]] = round(float(row["predicted"]), 1)
        by_day.append(entry)

    recent = history[history["date"] > last_day - timedelta(days=HISTORY_DAYS_IN_APP)]
    recent_daily = recent.groupby("date")[target].sum()

    return {
        "label": TARGETS[target],
        "model": MODEL_LABELS[chosen],
        "chosen": chosen,
        "choiceReason": choice_reason,
        "trainingRows": int(len(known)),
        "evaluation": {
            "testDays": TEST_DAYS,
            "testFrom": test_start.date().isoformat(),
            "testTo": last_day.date().isoformat(),
            "perShift": {MODEL_LABELS[name]: result for name, result in test_results.items()},
            "perDay": daily_results,
            "maeModel": test_results[chosen]["mae"],
            "maeBaseline": test_results["baseline"]["mae"],
            "improvementPercent": round(100 * improvement, 1),
            "range80": {
                "perShift": [round(float(shift_low), 2), round(float(shift_high), 2)],
                "perDay": [round(float(daily_low), 2), round(float(daily_high), 2)],
                "testCoveragePercent": round(100 * float(inside.mean()), 1),
            },
        },
        "backtest": {
            "folds": BACKTEST_FOLDS,
            "foldDays": HORIZON_DAYS,
            "perFoldMae": [
                {"from": fold["from"], **{MODEL_LABELS[name]: fold[name] for name in ("baseline", "linear", "boosting")}}
                for fold in folds["folds"]
            ],
            "summary": {MODEL_LABELS[name]: value for name, value in folds["summary"].items()},
            "foldsWon": {MODEL_LABELS[name]: value for name, value in folds["wins"].items()},
        },
        "featureImportance": importance,
        "residualChecks": checks,
        "history": [{"date": day.date().isoformat(), "value": int(value)} for day, value in recent_daily.items()],
        "forecast": by_day,
        "_test_daily": daily,
        "_folds": folds["folds"],
    }


# ---------------------------------------------------------------- demo statistics

def demo_snapshot(history: pd.DataFrame) -> dict:
    """The figures the Statistics screen shows in demo mode: the most recent 365 days."""
    last_day = history["date"].max()
    year = history[history["date"] > last_day - timedelta(days=365)]
    handovers = int(year["handovers"].sum())

    # The newest handovers are still moving through sign-off; everything older is completed.
    final_day = int(year.loc[year["date"] == last_day, "handovers"].sum())
    previous_day = int(year.loc[year["date"] == last_day - timedelta(days=1), "handovers"].sum())
    in_progress = round(0.25 * final_day)
    awaiting_approval = round(0.35 * final_day + 0.15 * previous_day)
    signed = handovers - in_progress

    def weighted_minutes(rows: pd.DataFrame) -> int:
        weight = rows["handovers"].sum()
        return int(round((rows["avg_handover_minutes"] * rows["handovers"]).sum() / weight)) if weight else 0

    recent_tasks = year[year["date"] >= last_day - timedelta(days=1)]
    open_recent = int((recent_tasks["tasks_total"] - recent_tasks["tasks_carried_over"]).sum())
    carried = int(year["tasks_carried_over"].sum())
    pending = round(0.40 * open_recent)
    active = round(0.25 * open_recent)

    return {
        "datasetKind": "synthetic",
        "handoverCount": handovers,
        "dateRange": {"from": year["date"].min().date().isoformat(), "to": last_day.date().isoformat()},
        "handoversByStatus": {
            "completed": handovers - in_progress - awaiting_approval,
            "pending_signoff": awaiting_approval,
            "in_progress": in_progress,
        },
        "handoversByShift": {shift: int(year.loc[year["shift"] == shift, "handovers"].sum()) for shift in SHIFTS},
        "handoversByMonth": {
            month: int(count) for month, count in year.groupby(year["date"].dt.strftime("%Y-%m"))["handovers"].sum().items()
        },
        "transition": {
            "measured": signed,
            "averageMinutes": weighted_minutes(year),
            "withinTarget": int(round(year["within_target"].sum() * signed / handovers)),
            "targetMinutes": TARGET_MINUTES,
            "averageByShift": {shift: weighted_minutes(year[year["shift"] == shift]) for shift in SHIFTS},
        },
        "sbar": {"total": int(year["sbar_updates"].sum()), "complete": int(year["sbar_complete"].sum())},
        "tasksByStatus": {
            "completed": int(year["tasks_total"].sum()) - carried - pending - active,
            "in_progress": active,
            "pending": pending,
            "carried_over": carried,
        },
        "attendance": {"total": int(year["staff_checkins"].sum()), "punctual": int(year["staff_punctual"].sum())},
        "signoffs": {"total": signed},
    }


# ---------------------------------------------------------------- report chart

def save_chart(results: dict[str, dict], path: Path) -> None:
    figure, axes = plt.subplots(len(results), 1, figsize=(10, 3.6 * len(results)), constrained_layout=True)
    for axis, (target, result) in zip(np.atleast_1d(axes), results.items()):
        daily = result["_test_daily"]
        axis.plot(daily.index, daily[target], color="#1c1b18", linewidth=1.8, label="Actual")
        axis.plot(daily.index, daily["predicted"], color="#1f6b54", linewidth=1.8, linestyle="--", label=result["model"])
        axis.plot(daily.index, daily["baseline"], color="#a09887", linewidth=1.2, linestyle=":", label="Baseline")
        axis.set_title(f"{result['label']} per day: 14-day-ahead forecast on the test weeks", loc="left", fontsize=11)
        axis.set_ylabel(result["label"])
        axis.grid(axis="y", color="#e2ddd1", linewidth=0.6)
        axis.spines[["top", "right"]].set_visible(False)
        axis.legend(frameon=False, ncols=3, fontsize=9)
    figure.savefig(path, dpi=150)
    plt.close(figure)


def save_backtest_chart(results: dict[str, dict], path: Path) -> None:
    styles = {"baseline": ("#a09887", ":"), "linear": ("#1f6b54", "-"), "boosting": ("#c27c0e", "--")}
    figure, axes = plt.subplots(len(results), 1, figsize=(10, 3.4 * len(results)), constrained_layout=True)
    for axis, result in zip(np.atleast_1d(axes), results.values()):
        folds = result["_folds"]
        starts = [pd.Timestamp(fold["from"]) for fold in folds]
        for name, (color, style) in styles.items():
            axis.plot(starts, [fold[name] for fold in folds], color=color, linestyle=style, marker="o",
                      markersize=4, linewidth=1.6, label=MODEL_LABELS[name])
        axis.set_title(f"{result['label']}: error on each two-week backtest fold (lower is better)", loc="left", fontsize=11)
        axis.set_ylabel("Error per shift (MAE)")
        axis.set_ylim(bottom=0)
        axis.grid(axis="y", color="#e2ddd1", linewidth=0.6)
        axis.spines[["top", "right"]].set_visible(False)
        axis.legend(frameon=False, ncols=3, fontsize=9)
    figure.savefig(path, dpi=150)
    plt.close(figure)


def app_series(result: dict) -> dict:
    """What the web app needs; the diagnostics stay in metrics.json."""
    keep = ("label", "model", "chosen", "trainingRows", "history", "forecast")
    evaluation = {key: result["evaluation"][key] for key in ("testDays", "maeModel", "maeBaseline", "improvementPercent")}
    return {**{key: result[key] for key in keep}, "evaluation": evaluation}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--data", default=str(HERE / "data" / "shift_history.csv"))
    parser.add_argument("--app-out", default=str(ROOT / "src" / "data" / "demoData.json"))
    args = parser.parse_args()

    history = pd.read_csv(args.data, parse_dates=["date"])
    results = {target: forecast_target(history, target) for target in TARGETS}

    reports = HERE / "reports"
    reports.mkdir(exist_ok=True)
    save_chart(results, reports / "forecast_evaluation.png")
    save_backtest_chart(results, reports / "backtest.png")
    for result in results.values():
        del result["_test_daily"], result["_folds"]

    meta = {
        "source": "Synthetic history generated by ml/generate_data.py. Not real operational data.",
        "seed": SEED,
        "historyFrom": history["date"].min().date().isoformat(),
        "historyTo": history["date"].max().date().isoformat(),
        "historyRows": int(len(history)),
        "horizonDays": HORIZON_DAYS,
    }
    metrics = {"meta": meta, "targets": {name: {k: v for k, v in r.items() if k not in ("history", "forecast")} for name, r in results.items()}}
    (reports / "metrics.json").write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf-8")

    app_data = {
        "meta": meta,
        "snapshot": demo_snapshot(history),
        "forecast": {
            "handovers": app_series(results["handovers"]),
            "carriedOver": app_series(results["tasks_carried_over"]),
        },
    }
    app_path = Path(args.app_out)
    app_path.write_text(json.dumps(app_data, indent=1) + "\n", encoding="utf-8")

    for name, result in results.items():
        evaluation = result["evaluation"]
        print(f"\n{result['label']}: chose {result['model']} (trained on {result['trainingRows']:,} rows)")
        for model, figures in evaluation["perShift"].items():
            print(f"   per shift  {model:<45} MAE {figures['mae']:.3f}  RMSE {figures['rmse']:.3f}")
        print(f"   per day    model MAE {evaluation['perDay']['model']['mae']:.3f}  baseline MAE {evaluation['perDay']['baseline']['mae']:.3f}")
        print(f"   improvement over baseline (per shift MAE): {evaluation['improvementPercent']}%")
        print(f"   80% range covered {evaluation['range80']['testCoveragePercent']}% of test days")
        for model, figures in result["backtest"]["summary"].items():
            won = result["backtest"]["foldsWon"][model]
            print(f"   backtest   {model:<45} MAE {figures['meanMae']:.3f} +/- {figures['stdMae']:.3f}  best on {won}/{BACKTEST_FOLDS} folds")
        print("   importance " + "; ".join(f"{item['group']} +{item['errorIncreasePercent']}%" for item in result["featureImportance"]))
        checks = result["residualChecks"]
        lags = checks["dailyErrorAutocorrelation"]
        print(f"   residuals  mean {checks['meanError']:+.3f}  autocorrelation lag1 {lags['lag1']}  lag7 {lags['lag7']}  (95% bound {lags['bound95']})")
        print(f"   choice     {result['choiceReason']}")
    print(f"\nWrote {reports / 'metrics.json'}, the charts in {reports} and {app_path}")


if __name__ == "__main__":
    main()
