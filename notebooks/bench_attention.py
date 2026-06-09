"""Benchmark: reference vs Pallas fused attention forward pass across sequence lengths.

Runnable as a Kaggle TPU cell (`%run notebooks/bench_attention.py`) or `python -m
notebooks.bench_attention`. On TPU it reports real timings; on CPU it auto-switches the
kernel to interpret mode and prints a warning that the numbers are NOT timing claims
(the CPU interpreter is orders of magnitude slower than a compiled TPU kernel).

The printed table (length | ref ms | pallas ms | speedup) is the README artifact.
"""

from __future__ import annotations

import statistics
import time

import jax
import jax.numpy as jnp

from src.model.attention_ref import attention_ref
from src.model.attention_pallas import pallas_attention

# Fixed dims; sweep T. Mirrors model scale (H=8, D=64 -> d_model 512-ish per the config).
B, H, D = 4, 8, 64
SEQ_LENS = (128, 256, 512, 1024)
WARMUP = 3
ITERS = 20


def _time_fn(fn, *args, iters: int = ITERS, warmup: int = WARMUP) -> float:
    """Median wall-clock ms over `iters` runs, after `warmup`, with block_until_ready."""
    for _ in range(warmup):
        jax.block_until_ready(fn(*args))
    samples = []
    for _ in range(iters):
        t0 = time.perf_counter()
        jax.block_until_ready(fn(*args))
        samples.append((time.perf_counter() - t0) * 1e3)
    return statistics.median(samples)


def _peak_mem_mb() -> float | None:
    """Device peak-bytes proxy in MB, if the backend exposes memory_stats."""
    try:
        stats = jax.devices()[0].memory_stats()
    except (AttributeError, RuntimeError, NotImplementedError):
        return None
    if not stats:
        return None
    peak = stats.get("peak_bytes_in_use") or stats.get("bytes_in_use")
    return peak / 1e6 if peak else None


def main() -> None:
    platform = jax.devices()[0].platform
    on_tpu = platform == "tpu"
    interpret = not on_tpu

    print(f"device platform: {platform} | B={B} H={H} D={D} | iters={ITERS} warmup={WARMUP}")
    if not on_tpu:
        print("WARNING: not on TPU -> Pallas runs in interpret mode. Timings below are "
              "NOT valid speedup claims; this run only confirms the bench executes.")

    key = jax.random.PRNGKey(0)

    @jax.jit
    def ref_fn(q, k, v, m):
        return attention_ref(q, k, v, m)

    def pallas_fn(q, k, v, m):
        return pallas_attention(q, k, v, m, interpret=interpret)

    print(f"\n{'length':>7} | {'ref ms':>10} | {'pallas ms':>10} | {'speedup':>8}")
    print("-" * 46)
    rows = []
    for t in SEQ_LENS:
        shape = (B, H, t, D)
        k1, k2, k3 = jax.random.split(key, 3)
        q = jax.random.normal(k1, shape, dtype=jnp.float32)
        k = jax.random.normal(k2, shape, dtype=jnp.float32)
        v = jax.random.normal(k3, shape, dtype=jnp.float32)
        mask = jnp.ones((B, t), dtype=bool)

        ref_ms = _time_fn(ref_fn, q, k, v, mask)
        pal_ms = _time_fn(pallas_fn, q, k, v, mask)
        speedup = ref_ms / pal_ms if pal_ms > 0 else float("nan")
        rows.append((t, ref_ms, pal_ms, speedup))
        print(f"{t:>7} | {ref_ms:>10.3f} | {pal_ms:>10.3f} | {speedup:>7.2f}x")

    mem = _peak_mem_mb()
    if mem is not None:
        print(f"\npeak device memory in use: {mem:.1f} MB")
    if not on_tpu:
        print("\n(interpret-mode run — see warning above; rerun on Kaggle TPU for real numbers)")


if __name__ == "__main__":
    main()
