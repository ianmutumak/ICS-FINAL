"""Generate synthetic shift-handover history for Zamu-Check.

No real operational records exist for this project, so the history is simulated from a
documented statistical model. One row is written per calendar day per shift.

Model
-----
The expected number of handovers in a shift is a multiplicative decomposition:

    rate(day, shift) = base[shift] x trend(day) x weekly[weekday] x yearly(day) x spike(day)

    base      typical handovers per shift (morning 5.0, evening 4.6, night 3.8)
    trend     linear growth of 12% per year
    weekly    busier Mondays and Fridays, quieter weekends
    yearly    two seasonal cargo peaks: the run-up to Valentine's Day (flower exports)
              and December, on top of a mild annual wave
    spike     about 2% of days carry 50% more work (diverted flights, backlogs)

The observed count is drawn from a Poisson distribution with that rate. The other columns
depend on how busy the shift was, which is what makes carried-over tasks forecastable.

The same seed and end date always produce the same file.
"""

from __future__ import annotations

import argparse
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

SHIFTS = ("morning", "evening", "night")
BASE_HANDOVERS = {"morning": 5.0, "evening": 4.6, "night": 3.8}
# Monday .. Sunday
WEEKLY = (1.06, 1.00, 0.99, 1.02, 1.10, 0.86, 0.76)
ANNUAL_GROWTH = 0.12
SPIKE_PROBABILITY = 0.02
SPIKE_FACTOR = 1.5
TARGET_MINUTES = 20
DEFAULT_SEED = 144861
DEFAULT_YEARS = 3


def seasonal_factor(day: date) -> float:
    """Yearly pattern: a mild wave plus two cargo peaks."""
    day_of_year = day.timetuple().tm_yday
    wave = 1.0 + 0.04 * np.sin(2 * np.pi * (day_of_year - 80) / 365.25)

    def bump(centre: int, width: float, height: float) -> float:
        distance = min(abs(day_of_year - centre), 365 - abs(day_of_year - centre))
        return height * np.exp(-0.5 * (distance / width) ** 2)

    valentines = bump(centre=38, width=9, height=0.35)   # peaks about 7 February
    december = bump(centre=349, width=11, height=0.25)   # peaks about 15 December
    return float(wave + valentines + december)


def generate(end_date: date, years: int = DEFAULT_YEARS, seed: int = DEFAULT_SEED) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    days = years * 365
    start_date = end_date - timedelta(days=days - 1)
    rows = []

    for offset in range(days):
        day = start_date + timedelta(days=offset)
        trend = 1.0 + ANNUAL_GROWTH * (offset / 365.0)
        spike = SPIKE_FACTOR if rng.random() < SPIKE_PROBABILITY else 1.0
        day_factor = trend * WEEKLY[day.weekday()] * seasonal_factor(day) * spike

        for shift in SHIFTS:
            rate = BASE_HANDOVERS[shift] * day_factor
            handovers = int(rng.poisson(rate))
            # How busy this shift is compared with a normal one for that shift.
            load = rate / BASE_HANDOVERS[shift]
            is_night = shift == "night"

            tasks_total = int(rng.poisson(2.5 * handovers)) if handovers else 0
            carry_probability = float(np.clip(0.05 + 0.06 * (load - 1.0) + (0.03 if is_night else 0.0), 0.01, 0.40))
            tasks_carried_over = int(rng.binomial(tasks_total, carry_probability)) if tasks_total else 0

            sbar_updates = int(rng.poisson(3.0 * handovers)) if handovers else 0
            sbar_complete = int(rng.binomial(sbar_updates, 0.84)) if sbar_updates else 0

            mean_minutes = 16.0 + (4.0 if is_night else 0.0) + 5.0 * (load - 1.0)
            avg_minutes = float(np.clip(rng.normal(mean_minutes, 2.5), 5.0, 60.0)) if handovers else 0.0
            # Share of this shift's handovers finished inside the target, given the shift's average.
            within_probability = float(1.0 / (1.0 + np.exp((avg_minutes - TARGET_MINUTES) / 3.0)))
            within_target = int(rng.binomial(handovers, within_probability)) if handovers else 0

            staff_checkins = int(rng.poisson(6.0))
            staff_punctual = int(rng.binomial(staff_checkins, 0.88)) if staff_checkins else 0

            rows.append({
                "date": day.isoformat(),
                "shift": shift,
                "handovers": handovers,
                "tasks_total": tasks_total,
                "tasks_carried_over": tasks_carried_over,
                "sbar_updates": sbar_updates,
                "sbar_complete": sbar_complete,
                "avg_handover_minutes": round(avg_minutes, 1),
                "within_target": within_target,
                "staff_checkins": staff_checkins,
                "staff_punctual": staff_punctual,
            })

    return pd.DataFrame(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--end-date", default=(date.today() - timedelta(days=1)).isoformat(), help="last full day of history (YYYY-MM-DD); default yesterday")
    parser.add_argument("--years", type=int, default=DEFAULT_YEARS)
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED)
    parser.add_argument("--out", default=str(Path(__file__).parent / "data" / "shift_history.csv"))
    args = parser.parse_args()

    frame = generate(date.fromisoformat(args.end_date), args.years, args.seed)
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(out_path, index=False, lineterminator="\n")
    print(f"Wrote {len(frame):,} rows ({frame['date'].min()} to {frame['date'].max()}) to {out_path}")
    print(f"Total handovers: {int(frame['handovers'].sum()):,}; seed {args.seed}")


if __name__ == "__main__":
    main()
