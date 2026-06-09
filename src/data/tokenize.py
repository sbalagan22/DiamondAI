"""Tokenizer / sequence builder: cached season parquet -> per-game token sequences.

Reads data/statcast_<year>.parquet, sorts each game into true chronological order,
maps raw Statcast fields to the frozen vocabulary in vocab.py, and writes per-game
list-typed rows to data/tokenized/sequences.parquet plus vocab.json and players.json.

Run as: python -m src.data.tokenize [--years 2022 2023 2024]
"""

from __future__ import annotations

import argparse
import glob
import json
import re
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

from . import vocab

DATA_DIR: Path = Path("data")
OUT_DIR: Path = DATA_DIR / "tokenized"
MIN_PITCHES: int = 10
# Pitch-timer violations: NO pitch thrown (null pitch_type, no zone/release). Source of
# truth is `description`, never downstream nullness. These are dropped before encoding.
TIMER_DESCRIPTIONS: frozenset[str] = frozenset({"automatic_ball", "automatic_strike"})

NEEDED_COLS: list[str] = [
    "game_pk", "game_date", "at_bat_number", "pitch_number",
    "pitch_type", "description", "zone", "events",
    "balls", "strikes", "outs_when_up", "on_1b", "on_2b", "on_3b",
    "inning", "inning_topbot", "bat_score", "fld_score", "stand", "p_throws",
    "pitcher", "batter", "post_home_score", "post_away_score",
]

# Per-position fields collected as one list per game.
SEQ_FIELDS: list[str] = [
    "pitch_type_id", "outcome_id", "zone_id", "balls", "strikes", "outs",
    "base_state", "inning", "inning_topbot", "score_diff", "stand", "p_throws",
    "pitch_num_in_pa", "pitcher_idx", "batter_idx",
    "next_pitch_type", "next_pitch_outcome", "ab_outcome", "target_mask",
]


def _discover_years(years: list[int] | None) -> list[Path]:
    """Resolve season parquet paths, optionally filtered to specific years."""
    if years:
        paths = [DATA_DIR / f"statcast_{y}.parquet" for y in years]
        missing = [p for p in paths if not p.exists()]
        if missing:
            raise FileNotFoundError(f"missing season parquet(s): {missing}")
        return paths
    found = sorted(glob.glob(str(DATA_DIR / "statcast_*.parquet")))
    if not found:
        raise FileNotFoundError(f"no statcast_<year>.parquet found in {DATA_DIR}")
    return [Path(p) for p in found]


def _load(paths: list[Path]) -> pd.DataFrame:
    frames = [pd.read_parquet(p, columns=NEEDED_COLS) for p in paths]
    return pd.concat(frames, ignore_index=True)


def _diag_timer(df: pd.DataFrame, label: str) -> int:
    """Count pitch-timer positions and report the pitch_type_id they fold to (stderr).

    A single repeated folded id (OTHER) on a pre-drop df confirms null pitch_type was
    silently bucketed rather than dropped. Post-build this must report 0.
    """
    desc = df["description"].astype("string").str.strip().str.lower()
    mask = desc.isin(TIMER_DESCRIPTIONS).to_numpy()
    folded = (
        df.loc[mask, "pitch_type"]
        .map(vocab._PITCH_TYPE_TO_ID).fillna(vocab.PITCH_TYPE_OTHER).astype("int64")
    )
    print(f"[diag {label}] timer-call positions: {int(mask.sum())}; "
          f"would-fold pitch_type_id -> {sorted(folded.unique().tolist())}", file=sys.stderr)
    return int(mask.sum())


def _diag_ab_fa(df: pd.DataFrame) -> int:
    """PART 1 diagnostic for AB/FA + PART 3 AB-drop decision (stderr).

    Prints per-code row counts and per-description counts. AB rows are dropped only if
    EVERY AB row carries a no-pitch timer-style description (same class as the already-
    dropped timer calls) — those are removed by the existing description-keyed drop, so
    real AB rows (swing/contact/in-play) survive and fold to OTHER. Returns AB-dropped count.
    """
    pt = df["pitch_type"].astype("string").str.strip().str.upper()
    desc = df["description"].astype("string").str.strip().str.lower()
    for code in ("AB", "FA"):
        m = (pt == code).to_numpy(dtype=bool, na_value=False)
        counts = desc[m].value_counts(dropna=False).to_dict()
        print(f"[diag {code}] {int(m.sum())} row(s); descriptions: {counts}", file=sys.stderr)
    is_ab = (pt == "AB").to_numpy(dtype=bool, na_value=False)
    ab_timer = is_ab & desc.isin(TIMER_DESCRIPTIONS).to_numpy(dtype=bool, na_value=False)
    n_ab, n_drop = int(is_ab.sum()), int(ab_timer.sum())
    all_timer = n_ab > 0 and n_drop == n_ab
    verdict = "no-pitch timer artifacts dropped" if n_drop else "real pitches kept -> OTHER"
    print(f"[AB] all-timer={all_timer}; AB rows dropped by description-keyed timer rule: "
          f"{n_drop} ({verdict})", file=sys.stderr)
    return n_drop


def _drop_timer_pitches(df: pd.DataFrame) -> pd.DataFrame:
    """Drop pitch-timer pseudo-pitches by `description` (no pitch thrown), before encoding."""
    desc = df["description"].astype("string").str.strip().str.lower()
    mask = desc.isin(TIMER_DESCRIPTIONS).to_numpy()
    print(f"dropped {int(mask.sum())} pitch-timer pseudo-pitch row(s) "
          f"({sorted(TIMER_DESCRIPTIONS)})", file=sys.stderr)
    return df.loc[~mask].reset_index(drop=True)


def _build_player_index(df: pd.DataFrame) -> dict[int, int]:
    """Contiguous index over all pitchers+batters, starting at 1 (0 = UNKNOWN)."""
    ids = pd.to_numeric(pd.concat([df["pitcher"], df["batter"]], ignore_index=True),
                        errors="coerce").dropna().astype("int64")
    return {pid: i + 1 for i, pid in enumerate(sorted(ids.unique().tolist()))}


def _encode(df: pd.DataFrame, player_index: dict[int, int]) -> pd.DataFrame:
    """Vectorized raw -> id encoding for every per-position field."""
    # Categorical maps (vectorized via the frozen vocab dicts).
    # Timer pseudo-pitches are dropped upstream. Any remaining null pitch_type is a real
    # pitch lacking a classification -> OTHER per the frozen spec (logged, never silent).
    pt = df["pitch_type"].astype("string").str.strip().str.upper()
    null_pt = pt.isna() | (pt == "")
    pitch_type_id = pt.map(vocab._PITCH_TYPE_TO_ID).fillna(vocab.PITCH_TYPE_OTHER).astype("int64")
    other_mask = pitch_type_id == vocab.PITCH_TYPE_OTHER
    # Drift tripwire: surface the DISTINCT non-null codes folded to OTHER, so a NEW
    # Statcast label on a future pull shows up here instead of landing silently in OTHER.
    nonnull_other = other_mask & ~null_pt
    other_codes = sorted(pt[nonnull_other].dropna().unique().tolist())
    if other_mask.any():
        print(f"[encode] folded {int(nonnull_other.sum())} non-null pitches to OTHER: "
              f"{{{', '.join(other_codes)}}}; plus {int(null_pt.sum())} null pitch_type -> OTHER",
              file=sys.stderr)
    df["pitch_type_id"] = pitch_type_id
    desc = df["description"].astype("string").str.strip().str.lower()
    outcome = desc.map(vocab._OUTCOME_TO_ID)
    if outcome.isna().any():
        bad = sorted(df["description"][outcome.isna()].astype("string").unique().tolist())
        raise ValueError(f"unmapped pitch description(s) — schema drift: {bad}")
    df["outcome_id"] = outcome.astype("int64")

    zv = pd.to_numeric(df["zone"], errors="coerce").to_numpy(dtype="float64")
    zone_id = np.full(len(df), vocab.ZONE_UNKNOWN, dtype="int64")
    m1 = (zv >= 1) & (zv <= 9)
    m2 = (zv >= 11) & (zv <= 14)
    zone_id[m1] = (zv[m1] - 1).astype("int64")
    zone_id[m2] = (zv[m2] - 2).astype("int64")
    df["zone_id"] = zone_id

    # Context fields.
    df["balls"] = df["balls"].fillna(0).clip(0, 3).astype("int64")
    df["strikes"] = df["strikes"].fillna(0).clip(0, 2).astype("int64")
    df["outs"] = df["outs_when_up"].fillna(0).clip(0, 2).astype("int64")
    df["base_state"] = (
        df["on_1b"].notna().astype("int64")
        + 2 * df["on_2b"].notna().astype("int64")
        + 4 * df["on_3b"].notna().astype("int64")
    )
    df["inning"] = df["inning"].fillna(1).clip(1, 10).astype("int64")
    df["inning_topbot"] = (
        df["inning_topbot"].astype("string").str.strip().str.lower() == "bot"
    ).astype("int64")
    df["score_diff"] = (
        (df["bat_score"].fillna(0) - df["fld_score"].fillna(0)).clip(-10, 10) + 10
    ).astype("int64")
    df["stand"] = (df["stand"].astype("string").str.strip().str.upper() == "R").astype("int64")
    df["p_throws"] = (df["p_throws"].astype("string").str.strip().str.upper() == "R").astype("int64")
    df["pitch_num_in_pa"] = df["pitch_number"].fillna(1).clip(1, 15).astype("int64")

    pit = pd.to_numeric(df["pitcher"], errors="coerce").astype("Int64")
    bat = pd.to_numeric(df["batter"], errors="coerce").astype("Int64")
    df["pitcher_idx"] = pit.map(player_index).fillna(0).astype("int64")
    df["batter_idx"] = bat.map(player_index).fillna(0).astype("int64")
    return df


def _targets(df: pd.DataFrame) -> pd.DataFrame:
    """Within-game next-pitch targets, per-PA at-bat outcome, per-game home_win."""
    # ab_outcome: terminal non-null event per PA, broadcast to every pitch.
    ev = df["events"].astype("string").str.strip().str.lower()
    ab = ev.map(vocab._AB_OUTCOME_TO_ID)
    ab = ab.mask(ev.notna() & ab.isna(), vocab.AB_OUTCOME_OTHER)  # non-null unknown -> OTHER
    df["_ab"] = ab
    # Exactly one non-null event per PA (the terminal pitch); max() picks it, skips NaN.
    df["ab_outcome"] = (
        df.groupby(["game_pk", "at_bat_number"], sort=False)["_ab"].transform("max")
        .fillna(vocab.AB_OUTCOME_OTHER).astype("int64")
    )
    df = df.drop(columns="_ab")

    # next-pitch targets within each game (df already chronologically sorted).
    g = df.groupby("game_pk", sort=False)
    nxt_type = g["pitch_type_id"].shift(-1)
    nxt_out = g["outcome_id"].shift(-1)
    df["target_mask"] = nxt_type.notna().astype("int64")
    df["next_pitch_type"] = nxt_type.fillna(vocab.PAD_ID).astype("int64")
    df["next_pitch_outcome"] = nxt_out.fillna(vocab.PAD_ID).astype("int64")

    # home_win: terminal-pitch final score, broadcast to every pitch.
    last_home = g["post_home_score"].transform("last")
    last_away = g["post_away_score"].transform("last")
    df["home_win"] = (last_home > last_away).astype("int64")
    return df


def _assemble(df: pd.DataFrame) -> pd.DataFrame:
    """Group into one row per game with list-typed per-position columns."""
    g = df.groupby("game_pk", sort=True)
    out = g.agg({f: list for f in SEQ_FIELDS})
    out["game_date"] = g["game_date"].first().astype(str)
    out["home_win"] = g["home_win"].first().astype("int64")
    out["seq_len"] = g.size().astype("int64")
    return out.reset_index()


def _write_vocab(player_index: dict[int, int]) -> None:
    player_vocab_size = len(player_index) + 1  # +1 for UNKNOWN id 0
    field_sizes = dict(vocab.FIELD_SIZES)
    field_sizes["pitcher_idx"] = player_vocab_size
    field_sizes["batter_idx"] = player_vocab_size
    payload = {
        "pad_id": vocab.PAD_ID,
        "field_sizes": field_sizes,
        "num_players": len(player_index),
        "player_vocab_size": player_vocab_size,
        "pitch_type_names": vocab.PITCH_TYPE_NAMES,
        "outcome_names": vocab.OUTCOME_NAMES,
        "ab_outcome_names": vocab.AB_OUTCOME_NAMES,
        "zone_names": vocab.ZONE_NAMES,
    }
    (OUT_DIR / "vocab.json").write_text(json.dumps(payload, indent=2))


def tokenize(years: list[int] | None) -> None:
    paths = _discover_years(years)
    print(f"loading {len(paths)} season(s): {[p.name for p in paths]}")
    df = _load(paths)
    _diag_timer(df, "pre-drop")          # confirm the silent fold before changing logic
    _diag_ab_fa(df)                      # PART 1/3: diagnose AB & FA, decide AB drop (kept: real)
    df = _drop_timer_pitches(df)         # drop timer calls (incl. any AB timer-style) before encode
    df = df.sort_values(["game_pk", "at_bat_number", "pitch_number"]).reset_index(drop=True)

    player_index = _build_player_index(df)
    df = _encode(df, player_index)
    df = _targets(df)

    # Drop games shorter than MIN_PITCHES *real* pitches (timer calls already removed).
    gsize = df.groupby("game_pk")["pitch_number"].transform("size")
    df = df[gsize >= MIN_PITCHES].copy()

    assert _diag_timer(df, "post-build") == 0, "timer pseudo-pitch leaked into sequences"

    out = _assemble(df)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    pq.write_table(pa.Table.from_pandas(out, preserve_index=False), OUT_DIR / "sequences.parquet")
    players_json = {str(pid): idx for pid, idx in player_index.items()}
    (OUT_DIR / "players.json").write_text(json.dumps(players_json))
    _write_vocab(player_index)

    print(f"games: {len(out)}  pitches: {int(out['seq_len'].sum())}  players: {len(player_index)}")
    print(f"vocab sizes: {json.loads((OUT_DIR / 'vocab.json').read_text())['field_sizes']}")
    print(f"wrote -> {OUT_DIR}/sequences.parquet, vocab.json, players.json")


def main() -> None:
    parser = argparse.ArgumentParser(description=re.sub(r"\s+", " ", __doc__ or "").strip())
    parser.add_argument("--years", type=int, nargs="+", default=None)
    args = parser.parse_args()
    tokenize(args.years)


if __name__ == "__main__":
    main()
