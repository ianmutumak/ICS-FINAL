"""Train and evaluate the Zamu-Check workload forecast, then export it for the web app.

For every shift of the next 14 days the model predicts:
    handovers            how many handovers the shift will produce
    tasks_carried_over   how many tasks will be left for the following shift

Method
------
* Direct 14-day-ahead forecasting: every feature is at least 14 days old, so one model
  serves the whole horizon and no prediction is fed back in as an input.
* Three candidates are compared: a seasonal-naive baseline (the same weekday two weeks
  earlier), ridge regression, and gradient-boosted trees with a Poisson loss.
* The split is by time, never random: train, then 8 weeks for choosing the model, then the
  final 8 weeks as an untouched test set. Reported errors come from the test set only.
* The chosen model is refitted on all history before forecasting.

Outputs
-------
    ml/reports/metrics.json               evaluation figures for the report
    ml/reports/forecast_evaluation.png    actual vs predicted on the test weeks
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
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

HERE = Path(__file__).parent
ROOT = HERE.parent
SHIFTS = ("morning", "evening", "night")
TARGETS = {"handovers": "Handovers", "tasks_carried_over": "Tasks carried over"}
HORIZON_DAYS = 14
VALIDATION_DAYS = 56
TEST_DAYS = 56
HISTORY_DAYS_IN_APP = 42
TARGET_MINUTES = 20
SEED = 144861

MODEL_LABELS = {
    "baseline": "Same weekday two weeks earlier (baseline)",
    "ridge": "Ridge regression",
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
    first_day = frame["date"].min()
    day_of_year = frame["date"].dt.day_of_year

    frame["years_elapsed"] = (frame["date"] - first_day).dt.days / 365.0
    for harmonic in (1, 2):
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

    calendar_columns = (
        ["years_elapsed"]
        + [f"year_{kind}_{h}" for h in (1, 2) for kind in ("sin", "cos")]
        + [f"weekday_{d}" for d in range(7)]
        + [f"shift_{s}" for s in SHIFTS]
    )
    return frame, calendar_columns + lag_columns


def make_model(name: str):
    if name == "ridge":
        return make_pipeline(StandardScaler(), Ridge(alpha=1.0))
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

def forecast_target(history: pd.DataFrame, target: str) -> dict:
    last_day = history["date"].max()
    frame, features = build_features(add_future_rows(history), target)

    known = frame[frame[target].notna()].dropna(subset=features)
    future = frame[frame[target].isna()].sort_values(["date", "shift"])
    test_start = last_day - timedelta(days=TEST_DAYS - 1)
    validation_start = test_start - timedelta(days=VALIDATION_DAYS)

    train = known[known["date"] < validation_start]
    validation = known[(known["date"] >= validation_start) & (known["date"] < test_start)]
    development = known[known["date"] < test_start]
    test = known[known["date"] >= test_start].sort_values(["date", "shift"])

    # 1. Choose between the learned models on the validation weeks.
    validation_mae = {}
    for name in ("ridge", "boosting"):
        model = make_model(name).fit(train[features], train[target])
        validation_mae[name] = errors(validation[target].to_numpy(), predict(name, model, validation, features, target))["mae"]
    chosen = min(validation_mae, key=validation_mae.get)

    # 2. Report every candidate on the untouched test weeks.
    test_results = {}
    test_predictions = {}
    for name in ("baseline", "ridge", "boosting"):
        model = None if name == "baseline" else make_model(name).fit(development[features], development[target])
        test_predictions[name] = predict(name, model, test, features, target)
        test_results[name] = errors(test[target].to_numpy(), test_predictions[name])

    daily = test[["date", target]].assign(predicted=test_predictions[chosen], baseline=test_predictions["baseline"])
    daily = daily.groupby("date").sum(numeric_only=True)
    daily_results = {
        "model": errors(daily[target].to_numpy(), daily["predicted"].to_numpy()),
        "baseline": errors(daily[target].to_numpy(), daily["baseline"].to_numpy()),
    }
    improvement = 1 - test_results[chosen]["mae"] / test_results["baseline"]["mae"]

    # 3. An 80% range from how far off the chosen model was on the test weeks.
    shift_residuals = test[target].to_numpy() - test_predictions[chosen]
    daily_residuals = (daily[target] - daily["predicted"]).to_numpy()
    shift_low, shift_high = np.quantile(shift_residuals, [0.10, 0.90])
    daily_low, daily_high = np.quantile(daily_residuals, [0.10, 0.90])

    # 4. Refit on everything and forecast the next 14 days.
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
        "trainingRows": int(len(known)),
        "evaluation": {
            "testDays": TEST_DAYS,
            "testFrom": test_start.date().isoformat(),
            "testTo": last_day.date().isoformat(),
            "perShift": {MODEL_LABELS[name]: result for name, result in test_results.items()},
            "perDay": daily_results,
            "validationMae": {MODEL_LABELS[name]: value for name, value in validation_mae.items()},
            "maeModel": test_results[chosen]["mae"],
            "maeBaseline": test_results["baseline"]["mae"],
            "improvementPercent": round(100 * improvement, 1),
            "shiftRange80": [round(float(shift_low), 2), round(float(shift_high), 2)],
        },
        "history": [{"date": day.date().isoformat(), "value": int(value)} for day, value in recent_daily.items()],
        "forecast": by_day,
        "_test_daily": daily,
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
    for result in results.values():
        del result["_test_daily"]

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
            "handovers": results["handovers"],
            "carriedOver": results["tasks_carried_over"],
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
    print(f"\nWrote {reports / 'metrics.json'}, {reports / 'forecast_evaluation.png'} and {app_path}")


if __name__ == "__main__":
    main()
