"""PART 4 — end-to-end correctness gate for live tokenization.

Runs the trained model over a FINISHED game's GUMBO feed and reports the model's
next-pitch-type top-1 accuracy across that game. If the GUMBO -> features mapping
matches training, accuracy lands near the held-out eval result (~50.6%), NOT near
random (1/7 ~= 14%). A near-random result means a field is mis-mapped — this script
exists to surface that loudly before declaring the server correct.

    .venv/bin/python -m src.serve.check_live 823619
"""

from __future__ import annotations

import argparse
import sys
from collections import Counter

import numpy as np

from .app import _build_batch, fetch_feed, load_state
from .gumbo_features import extract_features

EVAL_ACC: float = 0.506  # held-out next-pitch-type top-1 from src/eval
BROKEN_THRESHOLD: float = 0.30  # below this, the mapping is almost certainly wrong


def next_pitch_type_accuracy(game_pk: str) -> tuple[float, float, int]:
    """Return (model_top1_acc, most-frequent-class baseline, n_scored) for one game."""
    state = load_state()
    feed = fetch_feed(game_pk)
    features = extract_features(feed, state.player_index)
    n = len(features)
    if n < 2:
        raise ValueError(f"game {game_pk} has too few pitches ({n}) to score")

    batch, keep = _build_batch(features)
    out = state.forward(state.params, batch)
    pt_logits = np.asarray(out["next_pitch_type"])[0]  # [MAX_LEN, 7]
    window_start = n - keep

    preds: list[int] = []
    actuals: list[int] = []
    for p in range(keep - 1):  # position p predicts local pitch p+1; last has no next
        preds.append(int(pt_logits[p].argmax()))
        actuals.append(features[window_start + p + 1]["pitch_type_id"])

    preds_arr = np.asarray(preds)
    actuals_arr = np.asarray(actuals)
    acc = float((preds_arr == actuals_arr).mean())
    most_common = Counter(actuals).most_common(1)[0][1]
    baseline = most_common / len(actuals)
    return acc, baseline, len(actuals)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Next-pitch-type accuracy on a finished game's GUMBO.")
    parser.add_argument("game_pk", help="a finished/recent gamePk")
    args = parser.parse_args(argv)

    acc, baseline, n = next_pitch_type_accuracy(args.game_pk)
    print(f"game {args.game_pk}: scored {n} next-pitch positions")
    print(f"  model next-pitch-type top-1 accuracy: {acc:.4f}")
    print(f"  most-frequent-class baseline:         {baseline:.4f}")
    print(f"  held-out eval reference:              {EVAL_ACC:.4f}  (random ~= {1/7:.4f})")

    if acc < BROKEN_THRESHOLD:
        print(
            f"\n*** MAPPING BROKEN: accuracy {acc:.4f} is near random — a GUMBO->features "
            f"field is mis-mapped. Fix before declaring done. ***",
            file=sys.stderr,
        )
        return 1
    if acc < baseline:
        print(
            f"\n*** WARNING: model {acc:.4f} < most-frequent baseline {baseline:.4f} ***",
            file=sys.stderr,
        )
    print(f"\nOK: accuracy is in the trained-model regime (>= {BROKEN_THRESHOLD:.2f}).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
