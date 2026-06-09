"""Correctness: Pallas fused attention == plain-JAX reference, within tolerance.

Runs the Pallas kernel in CPU interpret mode (`interpret=True`) so it passes locally
without a TPU. Covers several B/H/T/D shapes, both causal-only and causal+padding,
in fp32 and bf16. Must pass before any benchmark numbers are trusted.

Run: `python -m pytest tests/test_attention.py -q` (or execute this file directly).
"""

from __future__ import annotations

import itertools

import jax
import jax.numpy as jnp
import numpy as np
import pytest

from src.model.attention_ref import attention_ref
from src.model.attention_pallas import pallas_attention

# (B, H, T, D) shapes; T in {64,128,256,512}, D in {32,64}.
_SHAPES = [
    (2, 4, 64, 32),
    (2, 8, 128, 64),
    (1, 8, 256, 32),
    (2, 4, 512, 64),
]
_DTYPES = [jnp.float32, jnp.bfloat16]
_USE_MASK = [False, True]


def _rand_qkv(shape: tuple[int, int, int, int], dtype, seed: int):
    """Random q,k,v of `shape` in `dtype`."""
    keys = jax.random.split(jax.random.PRNGKey(seed), 3)
    return tuple(jax.random.normal(kk, shape, dtype=dtype) for kk in keys)


def _right_pad_mask(b: int, t: int, seed: int) -> jnp.ndarray:
    """[B, T] mask with a random valid prefix length per row (right-padding).

    Right-padding (real tokens first, pad at the end) mirrors the model's
    `attention_mask` and guarantees every query position keeps >=1 valid causal key,
    so no query row is fully masked — the one case where the reference's finite-fill
    softmax and the kernel's causal-bounded softmax would diverge.
    """
    rng = np.random.default_rng(seed)
    lengths = rng.integers(low=max(1, t // 2), high=t + 1, size=b)
    idx = np.arange(t)[None, :]
    mask = idx < lengths[:, None]
    return jnp.asarray(mask)


@pytest.mark.parametrize("shape,dtype,use_mask",
                         list(itertools.product(_SHAPES, _DTYPES, _USE_MASK)))
def test_pallas_matches_reference(shape, dtype, use_mask) -> None:
    b, h, t, d = shape
    q, k, v = _rand_qkv(shape, dtype, seed=hash((shape, str(dtype), use_mask)) % (2**31))
    kv_mask = _right_pad_mask(b, t, seed=t + h) if use_mask else None

    ref = attention_ref(q, k, v, kv_mask)
    out = pallas_attention(q, k, v, kv_mask, interpret=True)

    assert out.shape == ref.shape
    assert out.dtype == ref.dtype

    # Compare in fp32; bf16 inputs accumulate more error -> looser tolerance.
    ref32 = ref.astype(jnp.float32)
    out32 = out.astype(jnp.float32)
    atol = 1e-2 if dtype == jnp.float32 else 2e-1
    rtol = 1e-2 if dtype == jnp.float32 else 1e-1

    np.testing.assert_allclose(np.asarray(out32), np.asarray(ref32),
                               atol=atol, rtol=rtol,
                               err_msg=f"mismatch shape={shape} dtype={dtype} mask={use_mask}")


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-q"]))
