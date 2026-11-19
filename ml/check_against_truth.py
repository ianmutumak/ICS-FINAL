"""Compare the forecast with the generator's true expected values on the test weeks.

Because the history is synthetic, the expected number of handovers for every shift is known
exactly. That separates two things a normal evaluation cannot tell apart:

    actual - truth       noise in the data (how far the weeks happened to land from normal)
    truth  - prediction  the model's own error

Run after generate_data.py, with the same settings:
    ml/.venv/Scripts/python ml/check_against_truth.py
"""

from __future__ import annotations

import sys
from datetime import timedelta
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))
import generate_data as generator  # noqa: E402
import train_forecast as training  # noqa: E402

TARGET = "handovers"
WEEKDAYS = ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")


def expected_handovers(day, shift: str, first_day) -> float:
    """The generator's expected count, with spike days averaged in."""
    trend = 1.0 + generator.ANNUAL_GROWTH * ((day - first_day).days / 365.0)
    spike = 1.0 + generator.SPIKE_PROBABILITY * (generator.SPIKE_FACTOR - 1.0)
    return (generator.BASE_HANDOVERS[shift] * trend * generator.WEEKLY[day.weekday()]
            * generator.seasonal_factor(day) * spike)


def main() -> None:
    history = pd.read_csv(HERE / "data" / "shift_history.csv", parse_dates=["date"])
    first_day = history["date"].min().date()
    last_day = history["date"].max()

    frame, features = training.build_features(training.add_future_rows(history), TARGET)
    known = frame[frame[TARGET].notna()].dropna(subset=features)
    test_start = last_day - timedelta(days=training.TEST_DAYS - 1)
    development = known[known["date"] < test_start]
    test = known[known["date"] >= test_start].sort_values(["date", "shift"]).copy()
    test["truth"] = [expected_handovers(d.date(), s, first_day) for d, s in zip(test["date"], test["shift"])]

    # Use the same tuned settings as the real training run.
    training.HISTORY = history
    training.ACTIVE_PARAMS.clear()
    tuned = training.tune_models(known, features, TARGET, test_start)
    print("Tuned settings:", {name: info["settings"] for name, info in tuned.items()})

    print(f"Test weeks {test_start.date()} to {last_day.date()}, {len(test)} shifts")
    print(f"Noise in the data (actual - truth), mean: {(test[TARGET] - test['truth']).mean():+.3f}\n")
    print(f"{'Model':<45} {'mean error vs truth':>20} {'MAE vs truth':>13} {'MAE vs actual':>14}")
    for name in ("baseline", "linear", "boosting"):
        _, predicted = training.fit_and_predict(name, development, test, features, TARGET)
        test[name] = predicted
        print(f"{training.MODEL_LABELS[name]:<45} {(test['truth'] - predicted).mean():>+20.3f}"
              f" {np.abs(test['truth'] - predicted).mean():>13.3f} {np.abs(test[TARGET] - predicted).mean():>14.3f}")

    weekday = test["date"].dt.day_of_week
    standard_error = np.sqrt(test["truth"].mean() / (len(test) / 7))
    print(f"\nBy weekday, chosen-model candidate (Poisson regression); one standard error of the noise is about {standard_error:.2f}")
    print(f"{'Day':<5} {'actual - prediction':>20} {'truth - prediction':>19} {'actual - truth':>15}")
    for index, name in enumerate(WEEKDAYS):
        rows = test[weekday == index]
        print(f"{name:<5} {(rows[TARGET] - rows['linear']).mean():>+20.2f} {(rows['truth'] - rows['linear']).mean():>+19.2f}"
              f" {(rows[TARGET] - rows['truth']).mean():>+15.2f}")


if __name__ == "__main__":
    main()
