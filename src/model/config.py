"""Frozen model config for the MLB pitch predictor.

Vocab sizes are the single source of truth in `data/tokenized/vocab.json` (built by
the tokenizer from the frozen `FIELD_SIZES`). They are READ at construction here and
never re-hardcoded, so a tokenizer change can never silently drift from the model.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from types import MappingProxyType
from typing import Any, Mapping

# Categorical input fields summed into the per-position embedding. Each gets its own
# [field_size, d_model] table; index 0 is PAD for every field (masked out downstream).
INPUT_FIELDS: tuple[str, ...] = (
    "pitch_type_id", "outcome_id", "zone_id", "balls", "strikes", "outs",
    "base_state", "inning", "inning_topbot", "score_diff", "stand", "p_throws",
    "pitch_num_in_pa", "pitcher_idx", "batter_idx",
)

# Prediction heads -> output class count.
HEAD_SIZES: Mapping[str, int] = MappingProxyType({
    "next_pitch_type": 7,
    "next_pitch_outcome": 6,
    "ab_outcome": 9,
    "home_win": 2,
})

DEFAULT_VOCAB_PATH: str = "data/tokenized/vocab.json"


@dataclass(frozen=True)
class ModelConfig:
    """Backbone hyperparameters + vocab-derived embedding-table sizes (frozen)."""

    field_sizes: Mapping[str, int]
    player_vocab_size: int
    d_model: int = 256
    n_layers: int = 6
    n_heads: int = 8
    mlp_ratio: int = 4
    dropout: float = 0.1
    max_len: int = 256
    dtype: Any = field(default=None)  # None -> jnp.float32 chosen in the module

    @property
    def d_ff(self) -> int:
        return self.d_model * self.mlp_ratio

    @classmethod
    def from_vocab(cls, vocab_path: str | Path = DEFAULT_VOCAB_PATH, **overrides: Any) -> "ModelConfig":
        """Build a config, reading `field_sizes` and `player_vocab_size` from vocab.json."""
        vocab = json.loads(Path(vocab_path).read_text())
        field_sizes = vocab["field_sizes"]
        player_vocab_size = int(vocab["player_vocab_size"])
        missing = [f for f in INPUT_FIELDS if f not in field_sizes and f not in ("pitcher_idx", "batter_idx")]
        if missing:
            raise ValueError(f"vocab.json field_sizes missing input fields: {missing}")
        return cls(
            field_sizes=MappingProxyType(dict(field_sizes)),
            player_vocab_size=player_vocab_size,
            **overrides,
        )

    def input_size(self, name: str) -> int:
        """Embedding-table size for an input field (players sized by player_vocab_size)."""
        if name in ("pitcher_idx", "batter_idx"):
            return self.player_vocab_size
        return self.field_sizes[name]
