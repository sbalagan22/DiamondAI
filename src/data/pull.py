"""Bulk Statcast pitch-level pull, cached per season to data/statcast_<year>.parquet.

Idempotent: a season whose parquet already exists is skipped with no network calls.
Run as: python -m src.data.pull
"""

from __future__ import annotations

import argparse
import calendar
import time
from pathlib import Path

import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
import requests
from pybaseball import cache, statcast

cache.enable()

DATA_DIR: Path = Path("data")
RETRIES: int = 3
# Regular season spans roughly March through October; empty months return nothing.
SEASON_MONTHS: range = range(3, 11)


def _month_ranges(year: int) -> list[tuple[str, str]]:
    """Return (start_dt, end_dt) ISO date strings, one per regular-season month."""
    ranges: list[tuple[str, str]] = []
    for month in SEASON_MONTHS:
        last_day = calendar.monthrange(year, month)[1]
        start = f"{year}-{month:02d}-01"
        end = f"{year}-{month:02d}-{last_day:02d}"
        ranges.append((start, end))
    return ranges


def _pull_chunk(start_dt: str, end_dt: str, retries: int = RETRIES) -> pd.DataFrame:
    """Pull one date range with exponential backoff on transient network errors."""
    for attempt in range(retries):
        try:
            return statcast(start_dt, end_dt)
        except (
            requests.exceptions.RequestException,
            ConnectionError,
            pd.errors.ParserError,
            pd.errors.EmptyDataError,
        ) as exc:
            if attempt == retries - 1:
                raise
            sleep_s = 2 ** attempt
            print(f"  chunk {start_dt}..{end_dt} failed ({exc}); retry in {sleep_s}s")
            time.sleep(sleep_s)
    return pd.DataFrame()  # unreachable; satisfies type checker


def pull_season(year: int) -> None:
    """Pull a full season in monthly chunks and cache to parquet. Skips if cached."""
    out_path = DATA_DIR / f"statcast_{year}.parquet"
    if out_path.exists():
        print(f"{year}: skip (cached at {out_path})")
        return

    frames: list[pd.DataFrame] = []
    for start_dt, end_dt in _month_ranges(year):
        chunk = _pull_chunk(start_dt, end_dt)
        if chunk is not None and not chunk.empty:
            frames.append(chunk)

    season = pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    pq.write_table(pa.Table.from_pandas(season), out_path)
    print(f"{year}: {len(season)} rows -> {out_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--start-year", type=int, default=2015)
    parser.add_argument("--end-year", type=int, default=2024)
    args = parser.parse_args()
    for year in range(args.start_year, args.end_year + 1):
        pull_season(year)


if __name__ == "__main__":
    main()
