"""Held-out validation eval for the MLB pitch predictor — READ-ONLY analysis.

Restores trained params from an Orbax checkpoint, runs `DecoderLM` over the SAME
deterministic ~5% held-out games as train.py (reusing `split_games`, never re-deriving the
hash), and reports per head: top-1 accuracy and pooled cross-entropy, each against a naive
baseline (see report.py). Also builds a home-win reliability diagram + ECE. Nothing here
touches the model, loss, vocab, or tokenizer.

    python -m src.eval.evaluate --ckpt checkpoints/best/6000

Inference only; runs on CPU or TPU (the device used is printed). Writes eval_out/{metrics.json,
summary.md, calibration.png, calibration.csv}.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Callable, Iterator

import jax
import jax.numpy as jnp
import numpy as np

from ..data.dataset import load_sequences, make_batches
from ..model.config import HEAD_SIZES, ModelConfig
from ..model.transformer import DecoderLM
from ..train.train import split_games
from . import report

_EXPECTED_VAL_GAMES: int = 1225  # what train.py reported for the 24k (2015-2024) corpus


# --- model + checkpoint ---------------------------------------------------------

def build_model(data_dir: Path, max_len: int, dropout: float) -> tuple[DecoderLM, ModelConfig]:
    """Build the config from vocab.json exactly as training does (dropout is cosmetic at eval)."""
    cfg = ModelConfig.from_vocab(data_dir / "vocab.json", max_len=max_len, dropout=dropout)
    return DecoderLM(cfg), cfg


def restore_params(ckpt: str, target: Any) -> Any:
    """Restore params from an Orbax `CheckpointManager` step dir (e.g. checkpoints/best/6000).

    Training saves params replicated across the 8 TPU devices, so the checkpoint records an
    8-device sharding. Eval may run on a different topology (1 CPU device), so we override the
    saved sharding: every array is restored fully replicated onto the CURRENT default device.
    Without this Orbax fails with "sharding ... Got None" / "available devices are different".
    """
    import orbax.checkpoint as ocp

    path = Path(ckpt).resolve()
    if not path.name.isdigit():
        raise ValueError(
            f"--ckpt must end in a numeric step dir like checkpoints/best/6000; got {ckpt!r}"
        )
    step = int(path.name)
    mgr = ocp.CheckpointManager(path.parent)
    steps = mgr.all_steps()
    if step not in steps:
        raise FileNotFoundError(
            f"step {step} not found under {path.parent} (available steps: {sorted(steps)}). "
            "Training writes the best checkpoint on Kaggle TPU — copy it here or point --ckpt at it."
        )

    sharding = jax.sharding.SingleDeviceSharding(jax.devices()[0])
    restore_args = jax.tree_util.tree_map(lambda _: ocp.ArrayRestoreArgs(sharding=sharding), target)
    return mgr.restore(step, args=ocp.args.PyTreeRestore(item=target, restore_args=restore_args))


def eval_batches(games: list[dict], batch_size: int, max_len: int) -> Iterator[dict[str, jnp.ndarray]]:
    """All val batches, no shuffle and no dropped final batch — every val position is scored."""
    for b in make_batches(games, batch_size, max_len, shuffle=False):
        yield {k: jnp.asarray(v) for k, v in b.items() if k != "game_pk"}


def make_forward(model: DecoderLM) -> Callable:
    @jax.jit
    def forward(params: Any, batch: dict[str, jnp.ndarray]) -> dict[str, jnp.ndarray]:
        return model.apply({"params": params}, batch, deterministic=True)

    return forward


def collect(forward: Callable, params: Any, batches: list[dict]) -> dict[str, dict[str, np.ndarray]]:
    """Gather per-head pred/label/CE over the correct mask; plus home-win probs and count fields."""
    acc: dict[str, dict[str, list]] = {h: {"pred": [], "label": [], "ce": []} for h in report.HEADS}
    acc["next_pitch_type"].update({"balls": [], "strikes": []})
    acc["home_win"]["prob1"] = []

    for batch in batches:
        logits = forward(params, batch)
        for h in report.HEADS:
            mask = np.asarray(batch[report.mask_name(h)]).astype(bool).reshape(-1)
            lg = np.asarray(logits[h]).reshape(-1, HEAD_SIZES[h])[mask]
            lbl = np.asarray(batch[h]).reshape(-1)[mask].astype(np.int64)
            acc[h]["pred"].append(lg.argmax(axis=-1))
            acc[h]["label"].append(lbl)
            acc[h]["ce"].append(report.ce_at(lg, lbl))
            if h == "home_win":
                acc[h]["prob1"].append(report.softmax(lg)[:, 1])
            if h == "next_pitch_type":
                acc[h]["balls"].append(np.asarray(batch["balls"]).reshape(-1)[mask].astype(np.int64))
                acc[h]["strikes"].append(np.asarray(batch["strikes"]).reshape(-1)[mask].astype(np.int64))

    return {h: {k: np.concatenate(v) for k, v in d.items()} for h, d in acc.items()}


# --- main -----------------------------------------------------------------------

def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Evaluate the MLB pitch predictor on the held-out val split.")
    p.add_argument("--ckpt", default="checkpoints/best/6000", help="Orbax CheckpointManager step dir")
    p.add_argument("--data-dir", default="data/tokenized")
    p.add_argument("--out-dir", default="eval_out")
    p.add_argument("--batch-size", type=int, default=64)
    p.add_argument("--max-len", type=int, default=256)
    p.add_argument("--dropout", type=float, default=0.3, help="cosmetic at eval (deterministic=True)")
    p.add_argument("--bins", type=int, default=10, help="calibration bins")
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    args = parse_args(argv)
    data_dir = Path(args.data_dir)

    devices = jax.devices()
    device = f"{devices[0].platform} ({len(devices)}x {devices[0].device_kind})"
    print(f"device: {device}", file=sys.stderr)

    games = load_sequences(data_dir / "sequences.parquet")
    _, val_games = split_games(games)
    frac = len(val_games) / max(len(games), 1)
    print(f"val split: {len(val_games)} of {len(games)} games ({frac:.1%})", file=sys.stderr)
    if not 0.04 <= frac <= 0.06:
        print(f"WARNING: val fraction {frac:.1%} is not ~5% — split may not match train.py", file=sys.stderr)
    if len(val_games) != _EXPECTED_VAL_GAMES:
        print(
            f"NOTE: val count {len(val_games)} != {_EXPECTED_VAL_GAMES} that training reported "
            "for the 24k corpus (expected only if the corpus changed).",
            file=sys.stderr,
        )

    model, cfg = build_model(data_dir, args.max_len, args.dropout)
    print(
        f"config: d_model={cfg.d_model} layers={cfg.n_layers} heads={cfg.n_heads} "
        f"max_len={cfg.max_len} dropout={cfg.dropout}",
        file=sys.stderr,
    )

    sample = next(eval_batches(val_games, min(args.batch_size, len(val_games)), args.max_len))
    params0 = model.init(jax.random.PRNGKey(0), sample, deterministic=True)["params"]
    target = jax.tree_util.tree_map(lambda x: jax.ShapeDtypeStruct(x.shape, x.dtype), params0)
    params = restore_params(args.ckpt, target)
    print(f"restored params from {args.ckpt}", file=sys.stderr)

    forward = make_forward(model)
    batches = list(eval_batches(val_games, args.batch_size, args.max_len))
    acc = collect(forward, params, batches)

    model_m = report.model_metrics(acc)
    base_m = report.baselines(acc)
    rows, ece = report.calibration(acc["home_win"]["prob1"], acc["home_win"]["label"], args.bins)

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    report.save_reliability(rows, out_dir / "calibration.png")
    report.write_calibration_csv(rows, out_dir / "calibration.csv")
    metrics = report.assemble_metrics(model_m, base_m, ece, rows, len(val_games), device, args.ckpt)
    (out_dir / "metrics.json").write_text(json.dumps(metrics, indent=2))
    report.write_summary_md(out_dir / "summary.md", model_m, base_m, ece, len(val_games), device)

    report.print_report(model_m, base_m, rows, ece)
    print(f"\nwrote {out_dir}/{{metrics.json, summary.md, calibration.png, calibration.csv}}", file=sys.stderr)

    for h in ("next_pitch_type", "ab_outcome"):
        if model_m[h]["acc"] < base_m[h]["baseline_acc"]:
            print(
                f"\n*** SANITY FAIL: {h} model acc {model_m[h]['acc']:.4f} < "
                f"baseline {base_m[h]['baseline_acc']:.4f} — model does NOT beat most-frequent-class ***",
                file=sys.stderr,
            )


if __name__ == "__main__":
    main()
