"""FlashAttention-style fused attention kernel in Pallas (TPU; CPU via interpret=True).

Standalone artifact — NOT wired into `transformer.py` or the training path. Matches the
reference semantics in `attention_ref.py`: causal multi-head self-attention with an
optional key-padding mask and fp32 softmax statistics.

The kernel tiles queries over a grid of (batch, head, q_block) and streams key/value
blocks with an online softmax (running max + running sum), so the full [T, T] score
matrix is never materialized. Causal block-skipping bounds the key loop to blocks that
contain at least one allowed key.

Masking, split two ways:
- Causal masking is computed IN-KERNEL from block indices (no input needed).
- Key-padding is supplied as a per-key additive bias [B, 1, T] (0.0 = keep,
  `_NEG` = pad), folded into the scores before the online softmax. It is passed as a
  full-T (un-blocked along the sequence) input so its block shape `(1, T)` equals the
  array's last two dims and satisfies Mosaic's (8, 128) TPU tiling rule — a blocked
  per-row [B, T] mask does NOT lower on TPU. The bias must vary the softmax denominator
  per query row (pad-query rows attend only to valid keys), which a wrapper-level
  "zero the padded V/output" trick cannot reproduce; hence it lives inside the kernel.

Tested locally with `interpret=True` (CPU). Real timing requires a TPU (Pallas TPU).
"""

from __future__ import annotations

import math
from functools import partial

import jax
import jax.numpy as jnp
from jax.experimental import pallas as pl

# Finite fill for disallowed positions; matches `attention_ref._NEG` so fully-masked
# rows degrade identically (uniform over the processed keys) instead of producing NaN.
_NEG = -1e30


def _flash_kernel(
    q_ref,  # [block_q, D]
    k_ref,  # [T, D]
    v_ref,  # [T, D]
    bias_ref,  # [1, T]  (key-padding additive bias: 0.0 keep, _NEG pad)
    o_ref,  # [block_q, D]  (output)
    *,
    block_k: int,
    scale: float,
) -> None:
    """One program: attention for a single q-block of one (batch, head)."""
    q_idx_block = pl.program_id(2)
    block_q = q_ref.shape[0]
    d = q_ref.shape[1]

    q = q_ref[...].astype(jnp.float32) * scale  # [block_q, D]
    q_pos = q_idx_block * block_q + jax.lax.broadcasted_iota(jnp.int32, (block_q,), 0)

    # Online-softmax running statistics (fp32).
    m_init = jnp.full((block_q,), _NEG, dtype=jnp.float32)
    l_init = jnp.zeros((block_q,), dtype=jnp.float32)
    acc_init = jnp.zeros((block_q, d), dtype=jnp.float32)

    # Causal: the highest query position in this block is (q_idx_block+1)*block_q - 1,
    # so only key blocks up to that index can contain an allowed key.
    max_q_pos = (q_idx_block + 1) * block_q - 1
    num_k_blocks = pl.cdiv(max_q_pos + 1, block_k)

    def body(j: int, carry):
        m_prev, l_prev, acc_prev = carry
        k_start = j * block_k
        kj = k_ref[pl.ds(k_start, block_k), :].astype(jnp.float32)   # [block_k, D]
        vj = v_ref[pl.ds(k_start, block_k), :].astype(jnp.float32)   # [block_k, D]
        bj = bias_ref[0, pl.ds(k_start, block_k)].astype(jnp.float32)  # [block_k]
        k_pos = k_start + jax.lax.broadcasted_iota(jnp.int32, (block_k,), 0)

        s = jax.lax.dot_general(
            q, kj, (((1,), (1,)), ((), ())),
            preferred_element_type=jnp.float32,
        )  # [block_q, block_k]

        # Add key-padding bias (0 keep / _NEG pad), then enforce causality.
        causal = q_pos[:, None] >= k_pos[None, :]
        s = jnp.where(causal, s + bj[None, :], _NEG)

        m_cur = jnp.max(s, axis=-1)               # [block_q]
        m_new = jnp.maximum(m_prev, m_cur)
        correction = jnp.exp(m_prev - m_new)      # rescale prior stats
        p = jnp.exp(s - m_new[:, None])           # [block_q, block_k]
        l_new = l_prev * correction + jnp.sum(p, axis=-1)
        acc_new = acc_prev * correction[:, None] + jax.lax.dot_general(
            p, vj, (((1,), (0,)), ((), ())),
            preferred_element_type=jnp.float32,
        )
        return m_new, l_new, acc_new

    _, l, acc = jax.lax.fori_loop(0, num_k_blocks, body, (m_init, l_init, acc_init))

    # l > 0 always (each query block has >=1 processed key at the diagonal), so no
    # divide-by-zero guard is needed for the causal+right-padding usage this targets.
    out = acc / l[:, None]
    o_ref[...] = out.astype(o_ref.dtype)


@partial(jax.jit, static_argnames=("block_q", "block_k", "interpret"))
def pallas_attention(
    q: jnp.ndarray,
    k: jnp.ndarray,
    v: jnp.ndarray,
    kv_mask: jnp.ndarray | None = None,
    *,
    block_q: int = 128,
    block_k: int = 128,
    interpret: bool = False,
) -> jnp.ndarray:
    """Fused causal multi-head attention. Same signature/semantics as `attention_ref`.

    Args:
        q, k, v: [B, H, T, D].
        kv_mask: optional [B, T] boolean key-padding mask (True = keep). None -> all kept.
        block_q, block_k: sequence tile sizes (clamped to T; must divide T).
        interpret: run the Pallas CPU interpreter (for local correctness tests).

    Returns:
        [B, H, T, D] attention output (same dtype as `q`).
    """
    b, h, t, d = q.shape
    bq = min(block_q, t)
    bk = min(block_k, t)
    if t % bq != 0 or t % bk != 0:
        raise ValueError(f"block sizes (bq={bq}, bk={bk}) must divide T={t}")

    # Key-padding -> additive score bias [B, 1, T] (0.0 keep, _NEG pad). Passed un-blocked
    # along T so its block (1, T) equals the array's last two dims (TPU-legal tiling).
    if kv_mask is None:
        bias = jnp.zeros((b, 1, t), dtype=jnp.float32)
    else:
        keep = kv_mask.astype(bool)
        bias = jnp.where(keep, 0.0, _NEG).astype(jnp.float32).reshape(b, 1, t)

    scale = 1.0 / math.sqrt(d)
    grid = (b, h, t // bq)

    out = pl.pallas_call(
        partial(_flash_kernel, block_k=bk, scale=scale),
        grid=grid,
        in_specs=[
            pl.BlockSpec((None, None, bq, d), lambda i, j, qb: (i, j, qb, 0)),  # q block
            pl.BlockSpec((None, None, t, d), lambda i, j, qb: (i, j, 0, 0)),    # full k
            pl.BlockSpec((None, None, t, d), lambda i, j, qb: (i, j, 0, 0)),    # full v
            pl.BlockSpec((None, 1, t), lambda i, j, qb: (i, 0, 0)),             # bias row
        ],
        out_specs=pl.BlockSpec((None, None, bq, d), lambda i, j, qb: (i, j, qb, 0)),
        out_shape=jax.ShapeDtypeStruct((b, h, t, d), q.dtype),
        interpret=interpret,
    )(q, k, v, bias)
    return out
