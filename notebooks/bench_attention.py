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

# Long-sequence sweep to find the Pallas-vs-XLA crossover. B=1, H=4 keeps it runnable at
# T=8192, where the reference materializes a [B,H,T,T] score matrix (1*4*8192*8192*4B ~=
# 1 GB) — the memory-heavy case the fused kernel is meant to survive.
B, H, D = 1, 4, 64
SEQ_LENS = (128, 256, 512, 1024, 2048, 4096, 8192)
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

        # Reference path only: the dense [B,H,T,T] matrix may exhaust device memory at
        # long T. Catch that specific failure and still report Pallas — the kernel
        # running where dense attention OOMs is itself the result.
        ref_ms: float | None
        try:
            ref_ms = _time_fn(ref_fn, q, k, v, mask)
        except jax.errors.JaxRuntimeError as exc:
            if "RESOURCE_EXHAUSTED" not in str(exc) and "out of memory" not in str(exc):
                raise
            ref_ms = None

        pal_ms = _time_fn(pallas_fn, q, k, v, mask)
        rows.append((t, ref_ms, pal_ms))
        if ref_ms is None:
            print(f"{t:>7} | {'ref OOM':>10} | {pal_ms:>10.3f} | {'n/a':>8}")
        else:
            speedup = ref_ms / pal_ms if pal_ms > 0 else float("nan")
            print(f"{t:>7} | {ref_ms:>10.3f} | {pal_ms:>10.3f} | {speedup:>7.2f}x")

    mem = _peak_mem_mb()
    if mem is not None:
        print(f"\npeak device memory in use: {mem:.1f} MB")
    if not on_tpu:
        print("\n(interpret-mode run — see warning above; rerun on Kaggle TPU for real numbers)")


if __name__ == "__main__":
    main()
