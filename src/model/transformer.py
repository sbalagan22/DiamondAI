"""Decoder-only Flax transformer for the MLB pitch predictor.

Input embedding = sum of one table per categorical input field (`INPUT_FIELDS`) plus a
learned positional embedding. PAD id 0 is embedded like any value but contributes nothing
because attention masks it out (causal AND padding) and downstream losses mask pad
positions. N pre-LayerNorm decoder blocks feed four independent linear heads.

Pure `flax.linen` — no I/O, no global mutation; dropout gated by `deterministic`.
"""

from __future__ import annotations

import flax.linen as nn
import jax.numpy as jnp

from .config import HEAD_SIZES, INPUT_FIELDS, ModelConfig


def _dtype(cfg: ModelConfig) -> jnp.dtype:
    return jnp.float32 if cfg.dtype is None else cfg.dtype


class DecoderBlock(nn.Module):
    """Pre-norm block: norm -> causal MHA -> residual; norm -> MLP(GELU) -> residual."""

    config: ModelConfig

    @nn.compact
    def __call__(self, x: jnp.ndarray, mask: jnp.ndarray, *, deterministic: bool) -> jnp.ndarray:
        cfg = self.config
        dt = _dtype(cfg)

        h = nn.LayerNorm(dtype=dt, name="ln_attn")(x)
        h = nn.MultiHeadDotProductAttention(
            num_heads=cfg.n_heads,
            dtype=dt,
            dropout_rate=cfg.dropout,
            deterministic=deterministic,
            name="attn",
        )(h, h, mask=mask)
        x = x + h

        h = nn.LayerNorm(dtype=dt, name="ln_mlp")(x)
        h = nn.Dense(cfg.d_ff, dtype=dt, name="mlp_in")(h)
        h = nn.gelu(h)
        h = nn.Dense(cfg.d_model, dtype=dt, name="mlp_out")(h)
        h = nn.Dropout(cfg.dropout, deterministic=deterministic)(h)
        return x + h


class DecoderLM(nn.Module):
    """Decoder-only transformer with four prediction heads off the final hidden states."""

    config: ModelConfig

    @nn.compact
    def __call__(
        self, batch: dict[str, jnp.ndarray], *, deterministic: bool
    ) -> dict[str, jnp.ndarray]:
        cfg = self.config
        dt = _dtype(cfg)
        b, t = batch["pitch_type_id"].shape

        # Input embedding = sum of per-field lookups (each table is [size, d_model]).
        x = jnp.zeros((b, t, cfg.d_model), dtype=dt)
        for name in INPUT_FIELDS:
            emb = nn.Embed(cfg.input_size(name), cfg.d_model, dtype=dt, name=f"embed_{name}")
            x = x + emb(batch[name].astype(jnp.int32))

        # Learned positional embedding, sliced to the actual sequence length.
        pos = nn.Embed(cfg.max_len, cfg.d_model, dtype=dt, name="embed_pos")
        x = x + pos(jnp.arange(t, dtype=jnp.int32))[None, :, :]
        x = nn.Dropout(cfg.dropout, deterministic=deterministic)(x)

        # Combined causal + padding mask: no position attends to a pad position.
        attn = batch["attention_mask"].astype(bool)
        mask = nn.combine_masks(
            nn.make_causal_mask(attn, dtype=bool),
            nn.make_attention_mask(attn, attn, dtype=bool),
        )

        for i in range(cfg.n_layers):
            x = DecoderBlock(cfg, name=f"block_{i}")(x, mask, deterministic=deterministic)
        x = nn.LayerNorm(dtype=dt, name="ln_final")(x)

        return {
            head: nn.Dense(size, dtype=dt, name=f"head_{head}")(x)
            for head, size in HEAD_SIZES.items()
        }
