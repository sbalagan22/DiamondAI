"""Data-parallel training loop for the decoder-only pitch model.

The per-step gradient computation is written with `jax.shard_map`: the batch is sharded
along axis 0 over the ('data',) mesh, params are replicated, and per-shard grads are
averaged with `jax.lax.pmean`. This runs unchanged on 1 device (local CPU overfit) or 8
(Kaggle TPU v5e-8).

CLI:
    python -m src.train.train --overfit          # wiring gate (CPU): combined loss < 0.1
    python -m src.train.train --steps 50000 ...   # full run (TPU)
"""

from __future__ import annotations

import argparse
import functools
import hashlib
import sys
from pathlib import Path
from typing import Callable, Iterator

import jax
import jax.numpy as jnp
import optax
from flax.training import train_state
from jax.experimental import mesh_utils
from jax.sharding import Mesh, PartitionSpec as P

from ..data.dataset import load_sequences, make_batches
from ..model.config import ModelConfig
from ..model.transformer import DecoderLM
from .loss import LossWeights, multitask_loss

_HEADS: tuple[str, ...] = ("next_pitch_type", "next_pitch_outcome", "ab_outcome", "home_win")


# --- data ----------------------------------------------------------------------

def _is_val(game_pk: int) -> bool:
    """Deterministic ~5% validation split by hashing game_pk."""
    h = int(hashlib.md5(str(int(game_pk)).encode()).hexdigest(), 16)
    return (h % 100) < 5


def split_games(games: list[dict]) -> tuple[list[dict], list[dict]]:
    train = [g for g in games if not _is_val(g["game_pk"])]
    val = [g for g in games if _is_val(g["game_pk"])]
    return train, val


def device_batches(
    games: list[dict], batch_size: int, max_len: int, seed: int, drop_last: bool
) -> Iterator[dict[str, jnp.ndarray]]:
    """Yield jnp dict batches (game_pk stripped); optionally drop a short final batch."""
    for b in make_batches(games, batch_size, max_len, shuffle=True, seed=seed):
        if drop_last and b["pitch_type_id"].shape[0] != batch_size:
            continue
        yield {k: jnp.asarray(v) for k, v in b.items() if k != "game_pk"}


# --- optimizer -----------------------------------------------------------------

def make_optimizer(lr: float, total_steps: int, warmup_steps: int) -> optax.GradientTransformation:
    schedule = optax.warmup_cosine_decay_schedule(
        init_value=0.0,
        peak_value=lr,
        warmup_steps=warmup_steps,
        decay_steps=max(total_steps, warmup_steps + 1),
        end_value=lr * 0.1,
    )
    return optax.chain(
        optax.clip_by_global_norm(1.0),
        optax.adamw(learning_rate=schedule, weight_decay=0.01),
    )


# --- steps (shard_map data-parallel) -------------------------------------------

def build_train_step(
    model: DecoderLM, mesh: Mesh, weights: LossWeights, deterministic: bool
) -> Callable:
    repl, data = P(), P("data")

    def loss_fn(params, batch, dropout_key):
        logits = model.apply(
            {"params": params}, batch, deterministic=deterministic,
            rngs={"dropout": dropout_key},
        )
        return multitask_loss(logits, batch, weights)

    @functools.partial(
        jax.shard_map, mesh=mesh,
        in_specs=(repl, data, repl), out_specs=(repl, repl), check_vma=False,
    )
    def sharded_grads(params, batch, dropout_key):
        (_, metrics), grads = jax.value_and_grad(loss_fn, has_aux=True)(params, batch, dropout_key)
        grads = jax.lax.pmean(grads, "data")
        metrics = jax.lax.pmean(metrics, "data")
        return grads, metrics

    @jax.jit
    def train_step(state, batch, dropout_key):
        grads, metrics = sharded_grads(state.params, batch, dropout_key)
        return state.apply_gradients(grads=grads), metrics

    return train_step


def build_eval_step(model: DecoderLM, weights: LossWeights) -> Callable:
    @jax.jit
    def eval_step(params, batch):
        logits = model.apply({"params": params}, batch, deterministic=True)
        _, metrics = multitask_loss(logits, batch, weights)
        return metrics

    return eval_step


def evaluate(eval_step: Callable, params, batches: list[dict]) -> dict[str, float]:
    if not batches:
        return {}
    acc: dict[str, float] = {}
    for batch in batches:
        m = eval_step(params, batch)
        for k, v in m.items():
            acc[k] = acc.get(k, 0.0) + float(v)
    return {k: v / len(batches) for k, v in acc.items()}


def _fmt(metrics: dict[str, float]) -> str:
    if not metrics:
        return "n/a"
    parts = [f"loss={metrics['loss']:.4f}"]
    for h in _HEADS:
        parts.append(f"{h}[L={metrics[f'loss_{h}']:.3f},A={metrics[f'acc_{h}']:.3f}]")
    return "  ".join(parts)


# --- checkpointing -------------------------------------------------------------

def make_checkpointers(out_dir: Path):
    import orbax.checkpoint as ocp

    out_dir = out_dir.resolve()
    best = ocp.CheckpointManager(
        out_dir / "best",
        options=ocp.CheckpointManagerOptions(
            max_to_keep=1, best_fn=lambda m: m["val_loss"], best_mode="min"
        ),
    )
    last = ocp.CheckpointManager(out_dir / "last", options=ocp.CheckpointManagerOptions(max_to_keep=1))
    return ocp, best, last


# --- training ------------------------------------------------------------------

def init_state(model: DecoderLM, sample: dict, optimizer, seed: int) -> train_state.TrainState:
    params = model.init(jax.random.PRNGKey(seed), sample, deterministic=True)["params"]
    return train_state.TrainState.create(apply_fn=model.apply, params=params, tx=optimizer)


def run_full(args: argparse.Namespace, mesh: Mesh) -> None:
    n = mesh.size
    assert args.batch_size % n == 0, (
        f"--batch-size {args.batch_size} not divisible by device count {n}"
    )

    games = load_sequences(Path(args.data_dir) / "sequences.parquet")
    train_games, val_games = split_games(games)
    print(f"games: {len(games)} total -> {len(train_games)} train / {len(val_games)} val", file=sys.stderr)

    cfg = ModelConfig.from_vocab(
        Path(args.data_dir) / "vocab.json", max_len=args.max_len, dropout=0.1
    )
    model = DecoderLM(cfg)
    weights = LossWeights()
    optimizer = make_optimizer(args.lr, args.steps, warmup_steps=max(1, args.steps // 20))
    train_step = build_train_step(model, mesh, weights, deterministic=False)
    eval_step = build_eval_step(model, weights)

    sample = next(device_batches(train_games, args.batch_size, args.max_len, 0, drop_last=True))
    state = init_state(model, sample, optimizer, args.seed)

    val_batches = list(device_batches(val_games, args.batch_size, args.max_len, 0, drop_last=True))
    ocp, best_mgr, last_mgr = make_checkpointers(Path(args.out_dir))

    key = jax.random.PRNGKey(args.seed)
    epoch = 0
    train_iter = device_batches(train_games, args.batch_size, args.max_len, epoch, drop_last=True)
    metrics: dict[str, float] = {}
    for step in range(args.steps):
        try:
            batch = next(train_iter)
        except StopIteration:
            epoch += 1
            train_iter = device_batches(train_games, args.batch_size, args.max_len, epoch, drop_last=True)
            batch = next(train_iter)
        key, sub = jax.random.split(key)
        state, m = train_step(state, batch, sub)
        metrics = {k: float(v) for k, v in m.items()}

        if step % args.eval_interval == 0 or step == args.steps - 1:
            val = evaluate(eval_step, state.params, val_batches)
            print(f"step {step:6d} | train {_fmt(metrics)} | val {_fmt(val)}", file=sys.stderr)
            last_mgr.save(step, args=ocp.args.PyTreeSave(state.params))
            if val:
                best_mgr.save(step, args=ocp.args.PyTreeSave(state.params), metrics={"val_loss": val["loss"]})

    best_mgr.wait_until_finished()
    last_mgr.wait_until_finished()
    print("done", file=sys.stderr)


def run_overfit(args: argparse.Namespace, mesh: Mesh) -> None:
    max_len = min(args.max_len, 128)  # cap for CPU speed; still exercises the full architecture
    games = load_sequences(Path(args.data_dir) / "sequences.parquet")[:5]
    batch = next(device_batches(games, batch_size=len(games), max_len=max_len, seed=0, drop_last=False))

    cfg = ModelConfig.from_vocab(Path(args.data_dir) / "vocab.json", max_len=max_len, dropout=0.0)
    model = DecoderLM(cfg)
    weights = LossWeights()
    steps = min(args.steps, 400) if args.steps else 400
    lr = max(args.lr, 1e-3)
    optimizer = make_optimizer(lr, steps, warmup_steps=10)
    train_step = build_train_step(model, mesh, weights, deterministic=True)
    state = init_state(model, batch, optimizer, args.seed)

    key = jax.random.PRNGKey(args.seed)
    loss = float("inf")
    metrics: dict[str, float] = {}
    for step in range(steps):
        key, sub = jax.random.split(key)
        state, m = train_step(state, batch, sub)
        metrics = {k: float(v) for k, v in m.items()}
        loss = metrics["loss"]
        if step % 50 == 0 or step == steps - 1:
            print(f"overfit step {step:4d} | {_fmt(metrics)}", file=sys.stderr)
        if loss < 0.1:
            print(f"overfit step {step:4d} | {_fmt(metrics)}  (< 0.1, early stop)", file=sys.stderr)
            break

    if loss >= 0.1:
        print(f"\nOVERFIT FAILED: combined loss {loss:.4f} >= 0.1 after {steps} steps", file=sys.stderr)
        sys.exit(1)
    print(f"\nOVERFIT OK: combined loss {loss:.4f} < 0.1", file=sys.stderr)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Train the MLB pitch predictor (shard_map data-parallel).")
    p.add_argument("--data-dir", default="data/tokenized")
    p.add_argument("--out-dir", default="checkpoints")
    p.add_argument("--batch-size", type=int, default=64)
    p.add_argument("--steps", type=int, default=50000)
    p.add_argument("--lr", type=float, default=3e-4)
    p.add_argument("--max-len", type=int, default=256)
    p.add_argument("--eval-interval", type=int, default=500)
    p.add_argument("--seed", type=int, default=0)
    p.add_argument("--overfit", action="store_true", help="tiny-slice wiring gate (assert loss < 0.1)")
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    args = parse_args(argv)
    n = jax.device_count()
    mesh = Mesh(mesh_utils.create_device_mesh((n,)), ("data",))
    print(f"devices: {n} {jax.devices()}", file=sys.stderr)
    if args.overfit:
        run_overfit(args, mesh)
    else:
        run_full(args, mesh)


if __name__ == "__main__":
    main()
