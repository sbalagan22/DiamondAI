"""Masked multi-task loss for the decoder-only pitch model — pure JAX.

Masks come straight from the batch, never recomputed:
  - next_pitch_type / next_pitch_outcome: `target_mask` (valid non-final, non-pad).
  - ab_outcome: `attention_mask` (valid at every real pitch).
  - home_win: `attention_mask`; the per-game label is broadcast over time by the loader.
Every head normalizes by its own mask sum (epsilon-guarded against empty masks).
"""

from __future__ import annotations

from dataclasses import dataclass

import jax.numpy as jnp
import optax

_EPS: float = 1e-8


@dataclass(frozen=True)
class LossWeights:
    """Per-head weights for the total loss."""

    next_pitch_type: float = 1.0
    next_pitch_outcome: float = 1.0
    ab_outcome: float = 0.5
    home_win: float = 0.3


def _masked_mean(values: jnp.ndarray, mask: jnp.ndarray) -> jnp.ndarray:
    """Mean of `values` over `mask`==1 positions; ~0 when the mask is empty."""
    mask = mask.astype(values.dtype)
    return (values * mask).sum() / (mask.sum() + _EPS)


def _ce(logits: jnp.ndarray, labels: jnp.ndarray) -> jnp.ndarray:
    return optax.softmax_cross_entropy_with_integer_labels(logits, labels.astype(jnp.int32))


def _acc(logits: jnp.ndarray, labels: jnp.ndarray, mask: jnp.ndarray) -> jnp.ndarray:
    correct = (jnp.argmax(logits, axis=-1) == labels.astype(jnp.int32)).astype(jnp.float32)
    return _masked_mean(correct, mask)


def multitask_loss(
    logits: dict[str, jnp.ndarray],
    batch: dict[str, jnp.ndarray],
    weights: LossWeights = LossWeights(),
) -> tuple[jnp.ndarray, dict[str, jnp.ndarray]]:
    """Return (total_loss, metrics) with per-head loss and accuracy in metrics."""
    target_mask = batch["target_mask"]      # [B, T] valid next-pitch positions
    attn_mask = batch["attention_mask"]      # [B, T] real pitch positions

    npt_label = batch["next_pitch_type"]
    npo_label = batch["next_pitch_outcome"]
    ab_label = batch["ab_outcome"]
    hw_label = batch["home_win"]

    l_npt = _masked_mean(_ce(logits["next_pitch_type"], npt_label), target_mask)
    l_npo = _masked_mean(_ce(logits["next_pitch_outcome"], npo_label), target_mask)
    l_ab = _masked_mean(_ce(logits["ab_outcome"], ab_label), attn_mask)
    l_hw = _masked_mean(_ce(logits["home_win"], hw_label), attn_mask)

    total = (
        weights.next_pitch_type * l_npt
        + weights.next_pitch_outcome * l_npo
        + weights.ab_outcome * l_ab
        + weights.home_win * l_hw
    )

    metrics = {
        "loss": total,
        "loss_next_pitch_type": l_npt,
        "loss_next_pitch_outcome": l_npo,
        "loss_ab_outcome": l_ab,
        "loss_home_win": l_hw,
        "acc_next_pitch_type": _acc(logits["next_pitch_type"], npt_label, target_mask),
        "acc_next_pitch_outcome": _acc(logits["next_pitch_outcome"], npo_label, target_mask),
        "acc_ab_outcome": _acc(logits["ab_outcome"], ab_label, attn_mask),
        "acc_home_win": _acc(logits["home_win"], hw_label, attn_mask),
    }
    return total, metrics
