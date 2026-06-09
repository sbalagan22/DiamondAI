"""Benchmark + autotune: reference (XLA) vs Pallas fused attention, across sequence lengths.

Runnable as a Kaggle TPU cell (`%run notebooks/bench_attention.py`) or `python -m
notebooks.bench_attention`. On TPU it reports real timings; on CPU it auto-switches the
kernel to interpret mode, runs a SMALL smoke subset, and warns that the numbers are NOT
timing claims (the CPU interpreter is orders of magnitude slower than a compiled TPU
kernel — the full heavy sweep is a TPU artifact).

For each length it times the XLA reference and autotunes the Pallas kernel over
(block_q, block_k) in {128, 256, 512} — smaller/capped {64, 128, 256} for long T where
the larger working set overflows scoped VMEM — skipping configs that don't divide T,
reporting the best Pallas config. A config whose compile/run exceeds scoped VMEM is
skipped ([vmem-oom]) and the sweep continues. Every surviving config is correctness-
checked against an oracle (the reference output, or the test-verified default 128x128
config when the dense reference OOMs) BEFORE its time is reported — an unverified config
is never timed.

The printed table (length | ref ms | best pallas ms | speedup | best cfg) is the artifact.
"""

from __future__ import annotations

import statistics
import time

import jax
import jax.numpy as jnp

from src.model.attention_ref import attention_ref
from src.model.attention_pallas import pallas_attention

# Heavier workload than the smoke shape: more arithmetic per block to amortize Pallas
# per-block overhead and give the kernel a fair shot against XLA's own fusion.
B, H, D = 4, 8, 64
SEQ_LENS = (128, 256, 512, 1024, 2048, 4096, 8192)
BLOCK_CANDIDATES = (128, 256, 512)
# At long T the 512x512 working set overflows the kernel's scoped VMEM (16 MB on v5e).
# Add a smaller tile (64) and cap below 512 so at least one config fits.
LONG_T = 8192
LONG_BLOCK_CANDIDATES = (64, 128, 256)
WARMUP, ITERS = 3, 20

# Interpret mode (CPU) is for a correctness/harness smoke test only; keep it small and
# fast since the timings are meaningless there anyway.
SMOKE_SEQ_LENS = (128, 256, 512)
SMOKE_WARMUP, SMOKE_ITERS = 1, 3

# Reject a Pallas config whose output drifts past this from the oracle (gross-error guard;
# the unit tests enforce the tight 1e-2 bound on the default config).
_VERIFY_ATOL = 2e-2


def _time_fn(fn, *args, iters: int, warmup: int) -> float:
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


def _configs_for(t: int) -> list[tuple[int, int]]:
    """(block_q, block_k) candidates that evenly divide T, ascending (smallest first).

    Long T uses smaller, capped tiles so the scoped VMEM working set fits.
    """
    cands = LONG_BLOCK_CANDIDATES if t >= LONG_T else BLOCK_CANDIDATES
    divs = [c for c in cands if t % c == 0]
    return [(bq, bk) for bq in divs for bk in divs]


def _is_oom(exc: BaseException) -> bool:
    """True if a JAX runtime error is a device/VMEM resource-exhaustion (not some other RT error)."""
    msg = str(exc).lower()
    return "resource_exhausted" in msg or "vmem" in msg or "out of memory" in msg


def _max_abs_err(a: jnp.ndarray, b: jnp.ndarray) -> float:
    """Max absolute element difference (fp32, reduced on-device to one scalar)."""
    return float(jnp.max(jnp.abs(a.astype(jnp.float32) - b.astype(jnp.float32))))


def main() -> None:
    platform = jax.devices()[0].platform
    on_tpu = platform == "tpu"
    interpret = not on_tpu

    seq_lens = SEQ_LENS if on_tpu else SMOKE_SEQ_LENS
    warmup = WARMUP if on_tpu else SMOKE_WARMUP
    iters = ITERS if on_tpu else SMOKE_ITERS

    print(f"device platform: {platform} | B={B} H={H} D={D} | iters={iters} warmup={warmup}")
    print(f"autotune block_q x block_k over {BLOCK_CANDIDATES} "
          f"({LONG_BLOCK_CANDIDATES} for T>={LONG_T}); configs that divide T")
    if not on_tpu:
        print("WARNING: not on TPU -> Pallas runs in interpret mode on a SMOKE subset. "
              "Timings below are NOT speedup claims; this only verifies the harness + "
              "per-config correctness. Run on Kaggle TPU for the real autotune table.")

    key = jax.random.PRNGKey(0)

    @jax.jit
    def ref_fn(q, k, v, m):
        return attention_ref(q, k, v, m)

    def pallas_cfg(q, k, v, m, bq, bk):
        return pallas_attention(q, k, v, m, block_q=bq, block_k=bk, interpret=interpret)

    print(f"\n{'length':>7} | {'ref ms':>10} | {'pallas ms':>10} | {'speedup':>8} | {'best cfg':>9}")
    print("-" * 58)
    best_overall: list[tuple[int, float]] = []  # (length, best speedup) where ref timed
    for t in seq_lens:
        shape = (B, H, t, D)
        k1, k2, k3 = jax.random.split(key, 3)
        q = jax.random.normal(k1, shape, dtype=jnp.float32)
        k = jax.random.normal(k2, shape, dtype=jnp.float32)
        v = jax.random.normal(k3, shape, dtype=jnp.float32)
        mask = jnp.ones((B, t), dtype=bool)

        # Reference (XLA) path only: the dense [B,H,T,T] matrix may exhaust device memory
        # at long T. Catch that and still autotune Pallas — the kernel running where dense
        # attention OOMs is itself the result.
        ref_ms: float | None
        ref_out = None
        try:
            ref_out = jax.block_until_ready(ref_fn(q, k, v, mask))
            ref_ms = _time_fn(ref_fn, q, k, v, mask, iters=iters, warmup=warmup)
        except jax.errors.JaxRuntimeError as exc:
            if not _is_oom(exc):
                raise
            ref_ms = None

        # Oracle for correctness checks: the reference if it ran, else the default 128x128
        # Pallas config (the one the unit tests prove equals the reference). If even that
        # OOMs, fall back to the first config that survives the sweep below.
        oracle = ref_out
        if oracle is None:
            try:
                oracle = jax.block_until_ready(pallas_cfg(q, k, v, mask, 128, 128))
            except jax.errors.JaxRuntimeError as exc:
                if not _is_oom(exc):
                    raise
                oracle = None

        best_ms: float | None = None
        best_cfg: tuple[int, int] | None = None
        for bq, bk in _configs_for(t):
            # Compile+run; the swept block's working set may exceed scoped VMEM at long T.
            try:
                out = jax.block_until_ready(pallas_cfg(q, k, v, mask, bq, bk))
            except jax.errors.JaxRuntimeError as exc:
                if not _is_oom(exc):
                    raise
                print(f"  [vmem-oom] cfg {bq}x{bk} @ T={t}: scoped VMEM exceeded, skipped")
                continue

            if oracle is None:  # ref + default both OOMed: adopt first surviving config
                oracle = out
            err = _max_abs_err(out, oracle)
            if err > _VERIFY_ATOL:
                print(f"  [skip] cfg {bq}x{bk} @ T={t}: max_abs_err={err:.3e} > {_VERIFY_ATOL}")
                continue
            ms = _time_fn(pallas_cfg, q, k, v, mask, bq, bk, iters=iters, warmup=warmup)
            if best_ms is None or ms < best_ms:
                best_ms, best_cfg = ms, (bq, bk)

        cfg_str = f"{best_cfg[0]}x{best_cfg[1]}" if best_cfg else "none"
        if best_ms is None:
            print(f"{t:>7} | {'-':>10} | {'-':>10} | {'-':>8} | {cfg_str:>9}")
            continue
        if ref_ms is None:
            print(f"{t:>7} | {'ref OOM':>10} | {best_ms:>10.3f} | {'n/a':>8} | {cfg_str:>9}")
        else:
            speedup = ref_ms / best_ms if best_ms > 0 else float("nan")
            best_overall.append((t, speedup))
            print(f"{t:>7} | {ref_ms:>10.3f} | {best_ms:>10.3f} | {speedup:>7.2f}x | {cfg_str:>9}")

    mem = _peak_mem_mb()
    if mem is not None:
        print(f"\npeak device memory in use: {mem:.1f} MB")

    # Plain conclusion from this run's data.
    if best_overall:
        wins = [(t, s) for t, s in best_overall if s > 1.0]
        best_t, best_s = max(best_overall, key=lambda r: r[1])
        print(f"\nbest Pallas speedup vs XLA (timed lengths): {best_s:.2f}x at T={best_t}")
        if wins:
            print("configs beating XLA (>1.0x): " + ", ".join(f"T={t} {s:.2f}x" for t, s in wins))
        else:
            print("no config beats XLA (>1.0x) at any timed length — XLA's own flash-style "
                  "fusion wins at these scales.")
    if not on_tpu:
        print("\n(interpret SMOKE run — correctness verified per config; rerun on Kaggle TPU "
              "for the real autotune speedup table)")


if __name__ == "__main__":
    main()
