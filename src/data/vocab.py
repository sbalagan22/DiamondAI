"""Frozen token vocabulary and category mappings for the MLB pitch predictor.

These are LOCKED design decisions. Bucket orders and ids must not change once
data is tokenized, or every cached sequence and trained checkpoint is invalidated.

PAD convention
--------------
PAD id is 0 for ALL fields. Critically, 0 is *also* a legitimate category id
for several fields (FOUR_SEAM pitch type, BALL outcome, zone bucket "1",
base state "empty", stand/throws "L", etc.). Padding is therefore NOT
distinguished by value.

Padding is distinguished STRUCTURALLY by the masks produced in the loader:
  - `attention_mask`: 1 at real pitch positions, 0 at pad positions.
  - `target_mask`:    1 where a next-pitch target is valid, 0 at the game's
                      final pitch (no next pitch) and at pad positions.

Consumers MUST consult these masks. Never infer "this is padding" from id == 0.
For the categorical input fields that are also prediction targets
(`pitch_type_id` -> `next_pitch_type`, `outcome_id` -> `next_pitch_outcome`),
a value of 0 at a real position (attention_mask == 1) means FOUR_SEAM / BALL,
while a value of 0 at a pad position (attention_mask == 0) means PAD.
"""

from __future__ import annotations

import pandas as pd

PAD_ID: int = 0

# --- PITCH_TYPE: raw Statcast `pitch_type` code -> bucket id 0..6 ------------
PITCH_TYPE_GROUPS: list[tuple[str, list[str]]] = [
    ("FOUR_SEAM", ["FF", "FA"]),  # FA = generic/legacy fastball code -> existing FF id 0
    ("SINKER", ["SI", "FT"]),
    ("CUTTER", ["FC"]),
    ("SLIDER", ["SL", "ST", "SV"]),
    ("CURVE", ["CU", "KC", "CS"]),
    ("OFFSPEED", ["CH", "FS", "FO"]),
    ("OTHER", ["KN", "EP", "SC", "PO", "IN"]),  # also absorbs null/unknown
]
PITCH_TYPE_OTHER: int = 6
PITCH_TYPE_NAMES: dict[int, str] = {i: name for i, (name, _) in enumerate(PITCH_TYPE_GROUPS)}
_PITCH_TYPE_TO_ID: dict[str, int] = {
    code: i for i, (_, codes) in enumerate(PITCH_TYPE_GROUPS) for code in codes
}
PITCH_TYPE_SIZE: int = len(PITCH_TYPE_GROUPS)

# --- PITCH_OUTCOME: raw `description` -> bucket id 0..5 ----------------------
# Pitch-timer calls (`automatic_ball`/`automatic_strike`, `bunt_foul_tip`) postdate
# the spec; `intent_ball`/`swinging_pitchout` are legacy (pre-2017) codes. All folded
# into existing buckets — no id reordering.
OUTCOME_GROUPS: list[tuple[str, list[str]]] = [
    ("BALL", ["ball", "blocked_ball", "pitchout", "automatic_ball", "intent_ball"]),
    ("CALLED_STRIKE", ["called_strike", "automatic_strike"]),
    ("SWINGING_STRIKE", ["swinging_strike", "swinging_strike_blocked", "missed_bunt", "swinging_pitchout"]),
    ("FOUL", ["foul", "foul_tip", "foul_bunt", "foul_pitchout", "bunt_foul_tip"]),
    ("IN_PLAY", ["hit_into_play", "hit_into_play_no_out", "hit_into_play_score"]),
    ("HBP", ["hit_by_pitch"]),
]
OUTCOME_NAMES: dict[int, str] = {i: name for i, (name, _) in enumerate(OUTCOME_GROUPS)}
_OUTCOME_TO_ID: dict[str, int] = {
    desc: i for i, (_, descs) in enumerate(OUTCOME_GROUPS) for desc in descs
}
OUTCOME_SIZE: int = len(OUTCOME_GROUPS)

# --- AB_OUTCOME: raw `events` -> bucket id 0..8 -----------------------------
AB_OUTCOME_GROUPS: list[tuple[str, list[str]]] = [
    ("K", ["strikeout", "strikeout_double_play"]),
    ("BB", ["walk"]),
    ("HBP", ["hit_by_pitch"]),
    ("SINGLE", ["single"]),
    ("DOUBLE", ["double"]),
    ("TRIPLE", ["triple"]),
    ("HR", ["home_run"]),
    ("OUT", [
        "field_out", "grounded_into_double_play", "double_play", "triple_play",
        "force_out", "fielders_choice", "fielders_choice_out", "sac_fly",
        "sac_fly_double_play", "sac_bunt", "field_error",
    ]),
    ("OTHER", []),  # catch-all for any other non-null event
]
AB_OUTCOME_OTHER: int = 8
AB_OUTCOME_NAMES: dict[int, str] = {i: name for i, (name, _) in enumerate(AB_OUTCOME_GROUPS)}
_AB_OUTCOME_TO_ID: dict[str, int] = {
    event: i for i, (_, events) in enumerate(AB_OUTCOME_GROUPS) for event in events
}
AB_OUTCOME_SIZE: int = len(AB_OUTCOME_GROUPS)

# --- ZONE: raw Statcast `zone` -> contiguous 0..13 --------------------------
ZONE_UNKNOWN: int = 13
ZONE_SIZE: int = 14
ZONE_NAMES: dict[int, str] = {
    **{i: str(i + 1) for i in range(9)},        # 0..8 -> "1".."9"
    **{i: str(i + 2) for i in range(9, 13)},    # 9..12 -> "11".."14"
    ZONE_UNKNOWN: "UNKNOWN_ZONE",
}

# --- BASE_STATE / hands ------------------------------------------------------
BASE_STATE_SIZE: int = 8  # 3-bit: bit0=1B, bit1=2B, bit2=3B
HAND_MAP: dict[str, int] = {"L": 0, "R": 1}  # other -> 0
HAND_SIZE: int = 2

# --- Context field vocab sizes (clipping ranges live in the tokenizer) ------
BALLS_SIZE: int = 4        # 0..3
STRIKES_SIZE: int = 3      # 0..2
OUTS_SIZE: int = 3         # 0..2
INNING_SIZE: int = 11      # ids 1..10 (clip extras->10); 0 reserved for PAD
TOPBOT_SIZE: int = 2       # Top=0, Bot=1
SCORE_DIFF_SIZE: int = 21  # diff clipped [-10,10] then shifted to 0..20
PITCH_NUM_SIZE: int = 16   # ids 1..15 (clip); 0 reserved for PAD
HOME_WIN_SIZE: int = 2

# Static field -> embedding size. Player-index fields are sized by the tokenizer.
FIELD_SIZES: dict[str, int] = {
    "pitch_type_id": PITCH_TYPE_SIZE,
    "outcome_id": OUTCOME_SIZE,
    "zone_id": ZONE_SIZE,
    "balls": BALLS_SIZE,
    "strikes": STRIKES_SIZE,
    "outs": OUTS_SIZE,
    "base_state": BASE_STATE_SIZE,
    "inning": INNING_SIZE,
    "inning_topbot": TOPBOT_SIZE,
    "score_diff": SCORE_DIFF_SIZE,
    "stand": HAND_SIZE,
    "p_throws": HAND_SIZE,
    "pitch_num_in_pa": PITCH_NUM_SIZE,
    "next_pitch_type": PITCH_TYPE_SIZE,
    "next_pitch_outcome": OUTCOME_SIZE,
    "ab_outcome": AB_OUTCOME_SIZE,
    "home_win": HOME_WIN_SIZE,
}


def _is_null(value: object) -> bool:
    """True for None, NaN/NA, or empty/whitespace strings."""
    try:
        if pd.isna(value):
            return True
    except (TypeError, ValueError):
        pass
    return isinstance(value, str) and value.strip() == ""


def map_pitch_type(code: object) -> int:
    """Raw `pitch_type` code -> bucket id. Unknown non-null -> OTHER; null/empty RAISES.

    Tripwire: a null pitch_type must never reach here in clean per-pitch reconstruction.
    Feature-less pitch-timer pseudo-pitches are dropped upstream; real pitches that merely
    lack a classification are folded to OTHER by the bulk encoder (tokenize._encode), not
    routed through this scalar map. A null arriving here means that contract was broken.
    """
    if _is_null(code):
        raise ValueError(f"null/empty pitch_type reached map_pitch_type: {code!r}")
    return _PITCH_TYPE_TO_ID.get(str(code).strip().upper(), PITCH_TYPE_OTHER)


def map_outcome(desc: object) -> int:
    """Raw `description` -> bucket id. Raises on schema drift (never silently buckets)."""
    if _is_null(desc):
        raise ValueError("null pitch description (schema drift)")
    key = str(desc).strip().lower()
    try:
        return _OUTCOME_TO_ID[key]
    except KeyError:
        raise ValueError(f"unmapped pitch description: {desc!r}") from None


def map_ab_outcome(event: object) -> int:
    """Raw `events` -> at-bat bucket id. Any non-null unknown -> OTHER; null -> OTHER."""
    if _is_null(event):
        return AB_OUTCOME_OTHER
    return _AB_OUTCOME_TO_ID.get(str(event).strip().lower(), AB_OUTCOME_OTHER)


def map_zone(z: object) -> int:
    """Raw `zone` -> contiguous id. 1-9 -> 0-8, 11-14 -> 9-12, null/other -> 13."""
    if _is_null(z):
        return ZONE_UNKNOWN
    try:
        zi = int(z)
    except (TypeError, ValueError):
        return ZONE_UNKNOWN
    if 1 <= zi <= 9:
        return zi - 1
    if 11 <= zi <= 14:
        return zi - 2
    return ZONE_UNKNOWN


def map_hand(hand: object) -> int:
    """`stand` / `p_throws` -> 0 (L) or 1 (R); anything else -> 0."""
    if _is_null(hand):
        return 0
    return HAND_MAP.get(str(hand).strip().upper(), 0)


def base_state(on_1b: object, on_2b: object, on_3b: object) -> int:
    """3-bit base-occupancy id from non-null runner columns (bit0=1B, bit1=2B, bit2=3B)."""
    b0 = 0 if _is_null(on_1b) else 1
    b1 = 0 if _is_null(on_2b) else 1
    b2 = 0 if _is_null(on_3b) else 1
    return b0 | (b1 << 1) | (b2 << 2)
