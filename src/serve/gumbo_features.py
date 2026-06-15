"""GUMBO live-feed -> model feature sequence (the serving twin of tokenize.py).

Reads the MLB Stats API `feed/live` GUMBO JSON and produces the ordered list of
per-pitch feature dicts the model expects — one per REAL pitch — encoded
IDENTICALLY to how `src/data/tokenize.py` encoded Statcast. The mapping functions
and buckets are reused verbatim from `src/data/vocab.py`; nothing is re-defined here.

The two field-level traps this module exists to get right:
  * `outcome_id`: GUMBO `details.description` is human text ("Called Strike"), NOT
    the Statcast snake_case the frozen vocab keys on. We translate the GUMBO
    `details.call.code` into the canonical Statcast `description` string, then call
    `vocab.map_outcome` so the bucket logic stays frozen in vocab.py.
  * `balls`/`strikes`: GUMBO per-pitch `count` is POST-pitch; training used the
    PRE-pitch count. We reconstruct pre = the running count within the plate
    appearance (first pitch 0-0; pitch j's pre = pitch j-1's post).

GUMBO uses the same pitch-type codes, the same 1-14 zone scheme, and the same MLBAM
player ids as Statcast, so those map near-directly via vocab.py + players.json.
"""

from __future__ import annotations

import json
from pathlib import Path

from ..data import vocab

# Pitch-timer pseudo-pitches: no pitch thrown. Training drops these by description
# before encoding; we drop the GUMBO equivalents so the sequence matches.
_TIMER_DESCRIPTIONS: frozenset[str] = frozenset({"automatic_ball", "automatic_strike"})

# GUMBO pitch-call code -> a canonical Statcast `description` string in the SAME
# bucket vocab.map_outcome expects. We only need each code to land in the right
# OUTCOME_GROUP; the representative string is chosen from that group.
_CALL_CODE_TO_DESCRIPTION: dict[str, str] = {
    # --- ball bucket ---
    "B": "ball",
    "*B": "blocked_ball",
    "I": "intent_ball",
    "P": "pitchout",
    "V": "automatic_ball",  # pitch-timer -> dropped upstream
    # --- called strike bucket ---
    "C": "called_strike",
    "A": "automatic_strike",  # pitch-timer -> dropped upstream
    # --- swinging strike bucket ---
    "S": "swinging_strike",
    "W": "swinging_strike_blocked",
    "Q": "swinging_pitchout",
    "M": "missed_bunt",
    # --- foul bucket ---
    "F": "foul",
    "T": "foul_tip",
    "L": "foul_bunt",
    "R": "foul_pitchout",
    # --- in play bucket ---
    "X": "hit_into_play",
    "D": "hit_into_play_no_out",
    "E": "hit_into_play_score",
    # --- hit by pitch ---
    "H": "hit_by_pitch",
}


def load_player_index(path: str | Path = "data/tokenized/players.json") -> dict[str, int]:
    """Load the frozen MLBAM-id -> contiguous-index map (verbatim from tokenize.py)."""
    return json.loads(Path(path).read_text())


def _gumbo_description(details: dict) -> str:
    """GUMBO pitch `details` -> the Statcast description string vocab.map_outcome keys on.

    In-play is decided by the `isInPlay` flag (robust across X/D/E); otherwise the
    single-letter call code is translated. Raises on an unknown code so feed drift
    surfaces loudly (mirroring tokenize.py's raise on unmapped descriptions).
    """
    if details.get("isInPlay"):
        return "hit_into_play"
    code = (details.get("call") or {}).get("code")
    if code in _CALL_CODE_TO_DESCRIPTION:
        return _CALL_CODE_TO_DESCRIPTION[code]
    raise ValueError(f"unmapped GUMBO pitch call code: {code!r} (details={details!r})")


def _pitch_type_id(details: dict) -> int:
    """`details.type.code` -> bucket id; null/empty -> OTHER (matches tokenize._encode)."""
    code = (details.get("type") or {}).get("code")
    if code is None or str(code).strip() == "":
        return vocab.PITCH_TYPE_OTHER
    return vocab.map_pitch_type(code)


def _score_diff(bat_score: int, fld_score: int) -> int:
    """(bat - fld) clipped to [-10, 10] then shifted to 0..20 — exactly as training."""
    diff = max(-10, min(10, bat_score - fld_score))
    return diff + 10


def _bases_after(start: list[bool], play: dict) -> list[bool]:
    """Apply a play's runner movements onto the carried base occupancy [1B, 2B, 3B]."""
    occ = {"1B": start[0], "2B": start[1], "3B": start[2]}
    for r in play.get("runners") or []:
        mv = r.get("movement") or {}
        frm, to = mv.get("start"), mv.get("end")
        if frm in occ:
            occ[frm] = False
        if mv.get("isOut"):
            if to in occ:
                occ[to] = False
            continue
        if to in ("1B", "2B", "3B"):
            occ[to] = True
    return [occ["1B"], occ["2B"], occ["3B"]]


def extract_features(feed: dict, player_index: dict[str, int]) -> list[dict[str, int]]:
    """GUMBO feed/live JSON -> ordered list of per-pitch feature dicts.

    Each dict carries the 15 model INPUT_FIELDS as ints, encoded identically to
    tokenize.py. Order is true chronological (allPlays order, playEvents order).
    """
    plays = (((feed.get("liveData") or {}).get("plays") or {}).get("allPlays")) or []

    features: list[dict[str, int]] = []
    bases = [False, False, False]
    away_score = 0
    home_score = 0
    outs_before = 0
    prev_half_key = ""

    for play in plays:
        about = play.get("about") or {}
        inning = int(about.get("inning") or 1)
        half_raw = str(about.get("halfInning") or "top").strip().lower()
        is_bottom = half_raw.startswith("bot")
        half_key = f"{inning}-{half_raw}"
        if half_key != prev_half_key:
            bases = [False, False, False]
            outs_before = 0
            prev_half_key = half_key

        pa_start_bases = list(bases)
        matchup = play.get("matchup") or {}
        pitcher_id = (matchup.get("pitcher") or {}).get("id")
        batter_id = (matchup.get("batter") or {}).get("id")
        stand_code = (matchup.get("batSide") or {}).get("code")
        throws_code = (matchup.get("pitchHand") or {}).get("code")

        # Batting team's score is the away score in the top half, home in the bottom.
        bat_score = away_score if not is_bottom else home_score
        fld_score = home_score if not is_bottom else away_score

        inning_id = max(1, min(10, inning))
        base_state = vocab.base_state(
            1 if pa_start_bases[0] else None,
            1 if pa_start_bases[1] else None,
            1 if pa_start_bases[2] else None,
        )
        score_diff = _score_diff(bat_score, fld_score)
        stand = vocab.map_hand(stand_code)
        p_throws = vocab.map_hand(throws_code)
        pitcher_idx = player_index.get(str(pitcher_id), 0) if pitcher_id is not None else 0
        batter_idx = player_index.get(str(batter_id), 0) if batter_id is not None else 0

        prev_balls, prev_strikes = 0, 0
        for ev in play.get("playEvents") or []:
            if not ev.get("isPitch"):
                continue
            details = ev.get("details") or {}
            description = _gumbo_description(details)
            if description in _TIMER_DESCRIPTIONS:
                continue  # pitch-timer pseudo-pitch — dropped, like training

            pre_balls = max(0, min(3, prev_balls))
            pre_strikes = max(0, min(2, prev_strikes))
            count = ev.get("count") or {}

            features.append({
                "pitch_type_id": _pitch_type_id(details),
                "outcome_id": vocab.map_outcome(description),
                "zone_id": vocab.map_zone((ev.get("pitchData") or {}).get("zone")),
                "balls": pre_balls,
                "strikes": pre_strikes,
                "outs": max(0, min(2, outs_before)),
                "base_state": base_state,
                "inning": inning_id,
                "inning_topbot": 1 if is_bottom else 0,
                "score_diff": score_diff,
                "stand": stand,
                "p_throws": p_throws,
                "pitch_num_in_pa": max(1, min(15, int(ev.get("pitchNumber") or 1))),
                "pitcher_idx": pitcher_idx,
                "batter_idx": batter_idx,
            })

            prev_balls = int(count.get("balls", prev_balls))
            prev_strikes = int(count.get("strikes", prev_strikes))

        # Carry score/outs/bases to the next play in the same half-inning.
        result = play.get("result") or {}
        away_score = int(result.get("awayScore", away_score))
        home_score = int(result.get("homeScore", home_score))
        bases = _bases_after(pa_start_bases, play)
        outs_before = max(0, min(3, int((play.get("count") or {}).get("outs", outs_before))))

    return features
