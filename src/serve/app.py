"""FastAPI inference server for the MLB pitch predictor.

Loads the trained step-6000 checkpoint once (reusing the CPU SingleDeviceSharding
restore from src/eval/evaluate.py), fetches a game's live GUMBO feed, tokenizes each
pitch via `gumbo_features` (identical encoding to training), runs ONE causal forward
pass, and returns next-pitch predictions aligned to the pitch sequence.

Run:
    .venv/bin/uvicorn src.serve.app:app --host 0.0.0.0 --port 8000
    # or: .venv/bin/python -m src.serve.app --ckpt 6000 --port 8000

The model side is now REAL; this replaces the sim.ts mock stub in the frontend.
"""

from __future__ import annotations

import argparse
import json
import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

import jax
import numpy as np
import requests
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ..data.dataset import _pad_game
from ..eval.evaluate import build_model, restore_params
from ..model.config import INPUT_FIELDS
from ..model.transformer import DecoderLM
from .gumbo_features import extract_features, load_player_index

DEFAULT_CKPT: str = os.environ.get("INFERENCE_CKPT", "6000")
DATA_DIR: Path = Path("data/tokenized")
MAX_LEN: int = 256
CACHE_TTL_S: float = 5.0
FEED_URL: str = "https://statsapi.mlb.com/api/v1.1/game/{gamePk}/feed/live"
FEED_TIMEOUT_S: float = 10.0

# Target fields _pad_game expects but the model never reads at inference.
_TARGET_FIELDS: tuple[str, ...] = ("next_pitch_type", "next_pitch_outcome", "ab_outcome", "target_mask")

# Model ab_outcome bucket -> the frontend's coarse OutcomeClass.
_AB_TO_COARSE: dict[str, str] = {
    "K": "strikeout",
    "BB": "walk",
    "HBP": "walk",
    "SINGLE": "hit",
    "DOUBLE": "hit",
    "TRIPLE": "hit",
    "HR": "hit",
    "OUT": "out",
    "OTHER": "out",
}


@dataclass
class State:
    """Loaded model runtime, built once at startup and reused per request."""

    forward: Callable[[Any, dict[str, np.ndarray]], dict[str, Any]]
    params: Any
    player_index: dict[str, int]
    pitch_type_names: dict[str, str]
    ab_outcome_names: dict[str, str]
    step: int


def _softmax(logits: np.ndarray) -> np.ndarray:
    z = logits - logits.max(axis=-1, keepdims=True)
    e = np.exp(z)
    return e / e.sum(axis=-1, keepdims=True)


def load_state(ckpt: str = DEFAULT_CKPT, data_dir: Path = DATA_DIR) -> State:
    """Build the model from vocab.json and restore params (reusing eval's restore)."""
    model: DecoderLM
    model, cfg = build_model(data_dir, MAX_LEN, dropout=0.1)

    # Minimal sample batch to materialize param shapes, then restore by ShapeDtypeStruct.
    sample = {f: np.zeros((1, MAX_LEN), dtype=np.int64) for f in INPUT_FIELDS}
    sample["attention_mask"] = np.zeros((1, MAX_LEN), dtype=np.int64)
    sample["attention_mask"][0, 0] = 1
    params0 = model.init(jax.random.PRNGKey(0), sample, deterministic=True)["params"]
    target = jax.tree_util.tree_map(lambda x: jax.ShapeDtypeStruct(x.shape, x.dtype), params0)
    params = restore_params(ckpt, target)

    @jax.jit
    def forward(p: Any, batch: dict[str, np.ndarray]) -> dict[str, Any]:
        return model.apply({"params": p}, batch, deterministic=True)

    vocab = json.loads((data_dir / "vocab.json").read_text())
    step = int(Path(ckpt).resolve().name)
    return State(
        forward=forward,
        params=params,
        player_index=load_player_index(data_dir / "players.json"),
        pitch_type_names=vocab["pitch_type_names"],
        ab_outcome_names=vocab["ab_outcome_names"],
        step=step,
    )


def _build_batch(features: list[dict[str, int]]) -> tuple[dict[str, np.ndarray], int]:
    """Front-truncate to the most recent MAX_LEN pitches and pad — byte-identical to eval.

    Returns the model batch (each field [1, MAX_LEN]) and `keep` (real pitch count kept).
    """
    n = len(features)
    keep = min(n, MAX_LEN)
    game: dict[str, Any] = {f: [feat[f] for feat in features] for f in INPUT_FIELDS}
    for f in _TARGET_FIELDS:
        game[f] = [0] * n
    game["seq_len"] = n
    game["home_win"] = 0
    padded = _pad_game(game, MAX_LEN)  # most-recent MAX_LEN, right-padded + attention_mask
    batch = {f: padded[f][None, :] for f in INPUT_FIELDS}
    batch["attention_mask"] = padded["attention_mask"][None, :]
    return batch, keep


def _pitch_distribution(state: State, logits_row: np.ndarray) -> list[dict[str, Any]]:
    """7-way pitch-type softmax -> sorted [{type: model bucket name, prob}]."""
    probs = _softmax(logits_row)
    pairs = [{"type": state.pitch_type_names[str(i)], "prob": float(probs[i])} for i in range(len(probs))]
    pairs.sort(key=lambda d: d["prob"], reverse=True)
    return pairs


def _coarse_outcome(state: State, logits_row: np.ndarray) -> dict[str, float]:
    """9-way ab_outcome softmax -> the frontend's {strikeout, walk, out, hit}."""
    probs = _softmax(logits_row)
    coarse = {"strikeout": 0.0, "walk": 0.0, "out": 0.0, "hit": 0.0}
    for i, p in enumerate(probs):
        coarse[_AB_TO_COARSE[state.ab_outcome_names[str(i)]]] += float(p)
    return coarse


def _prediction(state: State, pt_logits: np.ndarray, ab_logits: np.ndarray) -> dict[str, Any]:
    return {
        "pitchType": _pitch_distribution(state, pt_logits),
        "outcome": _coarse_outcome(state, ab_logits),
    }


def predict_sequence(state: State, features: list[dict[str, int]]) -> dict[str, Any]:
    """Run the model over a pitch sequence and align heads to the pitch indices.

    head[p] predicts the pitch at local p+1; home_win[p] is P(home win) after pitch p.
    Positions map to global indices via windowStart = n - keep (front-truncation).
    """
    n = len(features)
    if n == 0:
        return {"step": state.step, "pitchCount": 0, "windowStart": 0,
                "perPitch": [], "pending": None, "homeWinProb": None}

    batch, keep = _build_batch(features)
    out = state.forward(state.params, batch)
    pt = np.asarray(out["next_pitch_type"])[0]  # [MAX_LEN, 7]
    ab = np.asarray(out["ab_outcome"])[0]        # [MAX_LEN, 9]
    hw = _softmax(np.asarray(out["home_win"])[0])[:, 1]  # [MAX_LEN] P(home win)
    window_start = n - keep

    per_pitch: list[dict[str, Any]] = []
    for p in range(keep):
        g = window_start + p
        pred = _prediction(state, pt[p - 1], ab[p - 1]) if p >= 1 else None
        per_pitch.append({"index": g, "homeWinProb": float(hw[p]), "prediction": pred})

    last = keep - 1
    pending = {**_prediction(state, pt[last], ab[last]), "homeWinProb": float(hw[last])}
    return {
        "step": state.step,
        "pitchCount": n,
        "windowStart": window_start,
        "perPitch": per_pitch,
        "pending": pending,
        "homeWinProb": float(hw[last]),
    }


def fetch_feed(game_pk: str) -> dict[str, Any]:
    """Fetch a game's GUMBO feed/live JSON (server-side)."""
    res = requests.get(FEED_URL.format(gamePk=game_pk), timeout=FEED_TIMEOUT_S)
    res.raise_for_status()
    return res.json()


# --- FastAPI app ---------------------------------------------------------------

app = FastAPI(title="DiamondAI inference")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # calls are server-to-server; permissive is fine for local dev
    allow_methods=["GET"],
    allow_headers=["*"],
)

_state: State | None = None
_cache: dict[str, tuple[float, dict[str, Any]]] = {}


@app.on_event("startup")
def _startup() -> None:
    global _state
    _state = load_state()
    print(f"[serve] loaded checkpoint step {_state.step}", flush=True)


@app.get("/health")
def health() -> dict[str, Any]:
    return {"ok": _state is not None, "step": _state.step if _state else None}


@app.get("/predict/{game_pk}")
def predict(game_pk: str) -> dict[str, Any]:
    if _state is None:  # startup not finished
        return {"error": "model not loaded"}
    now = time.monotonic()
    cached = _cache.get(game_pk)
    if cached and now - cached[0] < CACHE_TTL_S:
        return cached[1]
    try:
        feed = fetch_feed(game_pk)
        features = extract_features(feed, _state.player_index)
        result = predict_sequence(_state, features)
    except (requests.RequestException, ValueError, KeyError) as exc:
        return {"error": f"{type(exc).__name__}: {exc}"}
    _cache[game_pk] = (now, result)
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="DiamondAI inference server")
    parser.add_argument("--ckpt", default=DEFAULT_CKPT, help="Orbax step dir (default: 6000)")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    os.environ["INFERENCE_CKPT"] = args.ckpt
    import uvicorn

    uvicorn.run("src.serve.app:app", host=args.host, port=args.port)


if __name__ == "__main__":
    main()
