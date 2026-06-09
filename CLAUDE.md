# CLAUDE.md — MLB Live Pitch Predictor

Behavioral guidelines to reduce common LLM coding mistakes, merged with project-specific rules.
**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding
**Don't assume. Don't hide confusion. Surface tradeoffs.**
- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First
**Minimum code that solves the problem. Nothing speculative.**
- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

## 3. Surgical Changes
**Touch only what you must. Clean up only your own mess.**
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken. Match existing style.
- Remove imports/vars/functions YOUR changes orphaned; leave pre-existing dead code (mention it).
- Every changed line should trace directly to the request.

## 4. Goal-Driven Execution
**Define success criteria. Loop until verified.**
- "Add the tokenizer" → "Tokenize one game, assert at-bats reconstruct, then scale."
- "Fix training" → "Overfit a tiny slice to ~0 loss, then run full."
- For multi-step tasks, state a brief plan with a verify check per step.

---

# Project
A live, pitch-by-pitch MLB prediction system. An autoregressive transformer (JAX/Flax) trains on decades of Statcast pitch data and serves live predictions (next pitch, at-bat outcome, win probability) against real games via the MLB Stats API.

# Critical Rules
- NEVER re-pull Statcast if cached parquet exists — the pull is slow and rate-limited.
- NEVER hammer `statsapi.mlb.com` — poll ≥5s, cache, back off on errors. Undocumented, no SLA.
- NEVER write a jitted JAX function with side effects or Python-level mutation — pure only.
- ALWAYS overfit a tiny slice before any full TPU run.
- ALWAYS verify array shapes/dtypes on a small slice before scaling.

# Commands

## Data
- `pip install -r requirements.txt` — deps (pybaseball, MLB-StatsAPI, jax, flax)
- `python -m src.data.pull` — bulk Statcast pull to `data/` parquet (SLOW, run once)
- `python -m src.data.tokenize` — build token sequences from cached parquet

## Train / Eval
- Full training runs in a Kaggle TPU notebook (`notebooks/train.ipynb`), not locally
- `python -m src.eval.run` — hold-out metrics + win-prob calibration plots
- Overfit/kernel work runs on Colab GPU (`notebooks/`)

## Serve
- `uvicorn src.serve.app:app --reload` — local serving endpoint
- `python -m src.serve.poller --game <gamePk>` — live MLB feed poller
- `cd frontend && npm run dev` — live UI on :5173

# Architecture
- `data/` — cached Statcast parquet (gitignored, multi-GB)
- `src/data/` — pull, tokenizer, sharded input pipeline
- `src/model/` — JAX/Flax decoder-only transformer + multi-task heads
- `src/kernel/` — fused attention kernel (Triton or Pallas)
- `src/train/` — training loop, `shard_map` sharding
- `src/eval/` — metrics, calibration
- `src/serve/` — FastAPI endpoint + MLB Stats API poller
- `frontend/` — Vite + React + Tailwind live UI
- `notebooks/` — Kaggle (TPU) + Colab (GPU) notebooks

**Stack:** Python · JAX + Flax · pybaseball (Statcast) · MLB-StatsAPI · Triton/Pallas · FastAPI · Vite + React + Tailwind · trained on Kaggle TPU / TRC

# Code Style
- ALWAYS type-hint function signatures.
- NEVER use bare `except:` — catch specific exceptions.
- JAX: jitted functions are PURE — no I/O, no global mutation, no print inside.
- NEVER write Python for-loops over batch/sequence in the hot path — vectorize or `jax.lax.scan`.
- PRNG: thread explicit keys, split with `jax.random.split`, NEVER reuse a key.
- NEVER silently mix `numpy` and `jnp` in model code — pick `jnp` on-device.
- Keep tokenization host-side and OUT of the training step.
- f-strings only. Max ~300 lines per module — split if larger.

# Workflow
- For complex tasks: write a brief plan (steps + verify check each), then implement.
- Keep changes minimal — no scope creep beyond the stated task.
- ALWAYS run the overfit sanity check before a full training run (ASK before launching a long TPU run).
- NEVER commit `data/` or model checkpoints — they're gitignored.
- Git: `git add . && git commit -m "short summary" && git push origin staging` unless told otherwise.

# Context
- Training data: `pybaseball` Statcast (2015→, pitch-level). Live data: `MLB-StatsAPI` GUMBO feed.
- The live API is the community-used official MLB endpoint — wrap it in a thin adapter in `src/serve/` so a feed change is a one-file fix.
- TPU access via TPU Research Cloud (applied separately) or Kaggle free TPU; Colab GPU for kernel + overfit.

## META — Maintaining This Document
When adding new rules:
1. Use NEVER or ALWAYS — not "try to" or "prefer".
2. Only add after a real violation caused a real problem.
3. Be concrete — include the actual command or code snippet.
4. Update Critical Rules at top when adding below.
5. Keep under 200 lines — delete stale rules ruthlessly.