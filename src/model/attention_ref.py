"""Plain-JAX reference for causal multi-head self-attention with a key-padding mask.

This is the correctness oracle and benchmark baseline for the Pallas fused kernel
(`attention_pallas.py`). It mirrors the semantics used by the model's attention in
`transformer.py`: scaled dot-product, causal masking, an optional key-padding mask,
and fp32 softmax accumulation. Standalone — nothing here touches the training path.

Shapes: q, k, v are [B, H, T, D]; kv_mask is [B, T] (True = real key, False = pad).
"""

from __future__ import annotations

import jax
import jax.numpy as jnp

# Additive mask fill for disallowed positions; large negative so softmax -> 0.
_NEG = -1e30


def attention_ref(
    q: jnp.ndarray,
    k: jnp.ndarray,
    v: jnp.ndarray,
    kv_mask: jnp.ndarray | None = None,
) -> jnp.ndarray:
    """Causal multi-head self-attention.

    Args:
        q, k, v: [B, H, T, D] query/key/value tensors.
        kv_mask: optional [B, T] boolean key-padding mask (True = keep). When None,
            only the causal mask is applied.

    Returns:
        [B, H, T, D] attention output (same dtype as `q`).
    """
    b, h, t, d = q.shape
    scale = 1.0 / jnp.sqrt(jnp.asarray(d, dtype=jnp.float32))

    # fp32 scores regardless of input dtype.
    scores = jnp.einsum("bhqd,bhkd->bhqk", q, k, preferred_element_type=jnp.float32)
    scores = scores * scale

    # Causal mask: query position i may attend to key position j <= i.
    causal = jnp.tril(jnp.ones((t, t), dtype=bool))  # [T, T]
    allowed = causal[None, None, :, :]

    if kv_mask is not None:
        keep = kv_mask.astype(bool)[:, None, None, :]  # [B, 1, 1, T]
        allowed = jnp.logical_and(allowed, keep)

    scores = jnp.where(allowed, scores, _NEG)
    weights = jax.nn.softmax(scores, axis=-1)  # fp32

    out = jnp.einsum("bhqk,bhkd->bhqd", weights, v.astype(jnp.float32),
                     preferred_element_type=jnp.float32)
    return out.astype(q.dtype)
