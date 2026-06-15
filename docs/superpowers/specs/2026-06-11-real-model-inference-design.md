# Real model inference server + frontend swap — Design

**Date:** 2026-06-11
**Scope:** Replace the mock prediction stub (`web/lib/sim.ts`) with the REAL trained
step-6000 model. Build a Python (FastAPI) inference server that serves the checkpoint,
fetches the live GUMBO feed, tokenizes each pitch EXACTLY as training did, runs the model,
and returns predictions; wire the Next.js frontend to call it instead of `sim.ts`. Game and
schedule data are already real.

## The one critical correctness rule

The GUMBO → model-token mapping MUST produce IDENTICAL feature encodings to what
`src/data/tokenize.py` produced from Statcast. Reuse `src/data/vocab.py` mapping functions
and `data/tokenized/players.json` verbatim — never redefine buckets or player indices. The
PART 4 accuracy gate (~50%, not ~14%) is the objective proof the mapping is right.

### Tokenization-match details (mirror tokenize.py `_encode`)

Per real pitch (`liveData.plays.allPlays[].playEvents[]` where `isPitch === true`, in order):

| field | source | mapping |
| --- | --- | --- |
| `pitch_type_id` | `details.type.code` | `vocab.map_pitch_type`; null/unknown → OTHER (don't raise — match `_encode`, not the scalar `map_pitch_type` tripwire) |
| `outcome_id` | `details.call.code` → Statcast description string → `vocab.map_outcome` | **trap:** GUMBO `description` is human text, not Statcast snake_case. Translate call code: `B/*B/I/P`→ball-bucket strings, `C`→`called_strike`, `S/W/Q/M`→swinging-strike strings, `F/T/L/R`→foul strings, `X/D/E`→`hit_into_play`, `H`→`hit_by_pitch`. Drop `automatic_ball`/`automatic_strike` (timer) like training. |
| `zone_id` | `pitchData.zone` | `vocab.map_zone` (1-14 scheme identical; null → 13) |
| `balls` / `strikes` | **pre-pitch** count | **trap:** GUMBO `playEvent.count` is POST-pitch; reconstruct pre = running within PA (first 0-0; pitch j pre = pitch j-1 post). Clip 0-3 / 0-2 |
| `outs` | outs at PA start | constant across the PA (not post-pitch `count.outs`) |
| `base_state` | `play.runners` carried occupancy at PA start | `vocab.base_state(on1 or None, …)` |
| `inning` | `play.about.inning` | clip 1-10 |
| `inning_topbot` | `play.about.halfInning` | `"bottom"`→1 else 0 (tokenizer checks `=="bot"`) |
| `score_diff` | pre-pitch bat/fld score | `(bat − fld).clip(-10,10)+10`; bat = away if top else home |
| `stand` / `p_throws` | `matchup.batSide.code` / `matchup.pitchHand.code` | `vocab.map_hand` |
| `pitch_num_in_pa` | `playEvent.pitchNumber` | clip 1-15 |
| `pitcher_idx` / `batter_idx` | `matchup.pitcher.id` / `matchup.batter.id` | `players.json[str(id)]`, unseen → 0 |

Score/base/count tracking reuses the same play-walk already proven in `web/lib/mlbAdapter.ts`.

**Long games:** call `dataset._pad_game` (front-truncate to most recent `max_len=256`,
right-pad, build `attention_mask`) with zero-filled target fields, so padding/truncation is
byte-identical to eval. Predictions therefore cover the most recent ≤256 pitches; earlier
events fall back to `sim.ts` (invisible — far back in the feed).

## PART 1 — `src/serve/gumbo_features.py`

Pure function: GUMBO feed JSON → ordered `list[dict]` of the 15 `INPUT_FIELDS` per pitch,
plus the running `pitch_type_id` sequence (used as PART 4 ground truth). Reuses `vocab.py`.
No model, no I/O. Verify: every feature id is within the `vocab.json` ranges; a reconstructed
PA decodes to coherent pitches.

## PART 2 — `src/serve/app.py` (FastAPI + uvicorn)

Startup (reusing `src/eval/evaluate.py` restore path):
1. `ModelConfig.from_vocab(data/tokenized/vocab.json)`; `DecoderLM(cfg)`.
2. init with a sample batch → `params0`; `target = tree_map(ShapeDtypeStruct)`;
   `restore_params(ckpt, target)` with `SingleDeviceSharding(jax.devices()[0])`.
3. Hold params in memory; `jax.jit` forward (`deterministic=True`). CPU is fine.
4. `--ckpt`/env, **default `6000`** (the actual orbax step dir at repo root; NOT
   `checkpoints/best/6000`, which does not exist).

`GET /predict/{gamePk}`:
1. Fetch `https://statsapi.mlb.com/api/v1.1/game/{gamePk}/feed/live` (server-side, `requests`).
2. Build features → pad/truncate → `[1, max_len]` batch.
3. ONE forward pass.
4. Align heads to the pitch sequence:
   - per-pitch prediction for pitch at global index *g* = `next_pitch_type`/`ab_outcome`
     head at the PRIOR position; `home_win` head (softmax`[1]`) at *g*'s own position →
     `homeWinProb` after pitch *g*.
   - `pending` = heads at the last position (next, not-yet-thrown pitch).
5. Response (self-describing via `vocab.json` name maps):
   ```
   { step, pitchCount, windowStart,
     perPitch: [ { index, homeWinProb,                       // index in [windowStart .. n-1]
                   prediction: { pitchType:[{type,prob}×7 (model bucket names)],
                                 outcome:{strikeout,walk,out,hit} } | null } ],  // null only at index==windowStart (prior truncated)
     pending: { pitchType:[…], outcome:{…}, homeWinProb } | null,
     homeWinProb }  // current = last position
   ```
   Pitch-type distribution carries model bucket names (FOUR_SEAM…OTHER); `ab_outcome`
   9-class is collapsed to the frontend's 4 `OutcomeClass` values
   (K→strikeout, BB/HBP→walk, hits→hit, OUT/OTHER→out).

`GET /health` → `{ ok, step }`. Per-gamePk in-memory cache ~5s. CORS allows the Next origin.

Verify: `/health` shows step 6000; `/predict/{live pk}` returns distributions summing ~1.0,
`homeWinProb ∈ [0,1]`, per-pitch + pending present.

## PART 3 — frontend swap (types + markup unchanged)

- `web/lib/mlbConfig.ts`: add `INFERENCE_URL` (default `http://localhost:8000`).
- `web/lib/mlbAdapter.ts`: game route fetches `GET {INFERENCE_URL}/predict/{gamePk}`
  server-side; `mapFeed(gumbo, predictions | null)` fills each event's `prediction` +
  `homeWinProb` and the pending prediction from the model response, mapping model buckets →
  `PitchTypeCode` (FOUR_SEAM→FF, SINKER→SI, CUTTER→FC, SLIDER→SL, CURVE→CU, OFFSPEED→CH,
  OTHER→SW). On any fetch/parse error → existing `sim.ts` path (graceful fallback). The route
  response carries `predictionsReal: boolean`.
- `web/app/api/model-status/route.ts`: proxies inference `/health` → `{ online, step }`.
- `web/components/ui/MockBadge.tsx`: becomes a client status badge polling `/api/model-status`;
  renders the "Predictions: mock fallback — model offline" warning ONLY when offline; hidden
  when the model is live. Footers (`app/page.tsx`, `app/game/[id]/page.tsx`) become honest
  static text valid in both states.
- Delete `web/lib/mock.ts` (confirmed no importers); keep `sim.ts` as the fallback.

Verify: with the server up, a live game's AI panel/feed/win-prob show REAL model output and no
mock badge; with it stopped, it falls back to `sim.ts` and the badge reappears.

## PART 4 — `src/serve/check_live.py`

Run the model over a FINISHED game's GUMBO; compute next-pitch-type top-1 accuracy across the
game's pitches (the front-truncated window, masking the final pitch). Expect ~45-55%
(eval = 50.6%). Near ~14% ⇒ a field is mis-mapped → print loudly and FAIL.

## Global constraints / non-goals

- Tokenization REUSES `vocab.py` + `players.json` verbatim; never redefine buckets/indices.
- Do NOT change the model, training code, vocab, tokenizer, or the frontend types/design.
  This phase adds the server and swaps the prediction data source + label logic only.
- Type hints; no bare except; reuse the eval CPU-restore.
- Deps to add to `.venv`: `fastapi`, `uvicorn` (jax/jaxlib/flax/orbax/numpy/pandas/pyarrow/
  requests already present). Document `uvicorn` run command.
- `web/ npm run build` passes; the Python server starts and serves; PART 4 accuracy passes.

## Run commands (to document)

- Server: `.venv/bin/uvicorn src.serve.app:app --host 0.0.0.0 --port 8000` (or `python -m src.serve.app`).
- Accuracy gate: `.venv/bin/python -m src.serve.check_live <finished_gamePk>`.
