"""Framework-agnostic numpy loader for tokenized sequences.

Used by the CPU overfit test; wrapped for TPU sharding later (no JAX here).
Pads/truncates each game to a fixed window and emits dict-of-arrays batches.
"""

from __future__ import annotations

from pathlib import Path
from typing import Iterator

import numpy as np
import pandas as pd

# Per-position fields stored as lists in sequences.parquet.
SEQ_FIELDS: list[str] = [
    "pitch_type_id", "outcome_id", "zone_id", "balls", "strikes", "outs",
    "base_state", "inning", "inning_topbot", "score_diff", "stand", "p_throws",
    "pitch_num_in_pa", "pitcher_idx", "batter_idx",
    "next_pitch_type", "next_pitch_outcome", "ab_outcome", "target_mask",
]
PAD_VALUE: int = 0


def load_sequences(path: str | Path) -> list[dict]:
    """Read sequences.parquet into a list of per-game dicts."""
    df = pd.read_parquet(path)
    return df.to_dict("records")


def _pad_game(game: dict, max_len: int) -> dict[str, np.ndarray]:
    """Front-truncate to the most recent max_len pitches, right-pad to max_len."""
    seq_len = int(game["seq_len"])
    keep = min(seq_len, max_len)
    out: dict[str, np.ndarray] = {}
    for field in SEQ_FIELDS:
        values = np.asarray(game[field], dtype=np.int64)[-keep:]  # keep most recent
        row = np.full(max_len, PAD_VALUE, dtype=np.int64)
        row[:keep] = values
        out[field] = row

    attention_mask = np.zeros(max_len, dtype=np.int64)
    attention_mask[:keep] = 1
    out["attention_mask"] = attention_mask
    # target_mask already 0 at the final pitch; also zero it on pad positions.
    out["target_mask"] = out["target_mask"] * attention_mask
    # home_win is a per-game scalar broadcast across real positions.
    out["home_win"] = np.full(max_len, int(game["home_win"]), dtype=np.int64) * attention_mask
    return out


def make_batches(
    games: list[dict],
    batch_size: int,
    max_len: int = 256,
    shuffle: bool = True,
    seed: int = 0,
) -> Iterator[dict[str, np.ndarray]]:
    """Yield dict-of-arrays batches, each field shaped [batch, max_len]. Deterministic."""
    order = np.arange(len(games))
    if shuffle:
        np.random.default_rng(seed).shuffle(order)

    for start in range(0, len(games), batch_size):
        idx = order[start:start + batch_size]
        padded = [_pad_game(games[i], max_len) for i in idx]
        batch = {
            key: np.stack([p[key] for p in padded], axis=0)
            for key in padded[0]
        }
        batch["game_pk"] = np.asarray([int(games[i]["game_pk"]) for i in idx], dtype=np.int64)
        yield batch
