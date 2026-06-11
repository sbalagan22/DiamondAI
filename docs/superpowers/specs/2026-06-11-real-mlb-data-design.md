# Real MLB data behind an identical UI — Design

**Date:** 2026-06-11
**Scope:** `web/` Next.js frontend. Replace the mock GAME + schedule data with real data
from the public MLB Stats API, **without changing the UI**. The AI PREDICTION side stays a
mock stub this phase (the trained model is served later).

## Goal & success criteria

- Schedule page shows today's **real** MLB games (correct teams, logos, colors, scores,
  inning/half for live games, start time for upcoming).
- A live game view updates **pitch-by-pitch from the real feed** (count, outs, baserunners,
  score, pitch type, velocity, result, batter/pitcher).
- The AI prediction panels/feed keep running on the **existing mock generator**, bound to the
  real current pitch context, and stay visibly labeled "not a live model".
- No change to `types.ts`, the design/CSS, or the rendered output of any component.
- `npm run build` passes with no type errors; `npm run lint` clean.

## Core principle: real game facts, mock model output

Every `PitchEvent` is split down the existing contract:

| Field | Source |
| --- | --- |
| `pre` / `post` (`GameSnapshot`), `pitchType`, `mph`, `call`, `atBat` | **REAL** — GUMBO `playEvents` / `linescore` |
| `prediction` (`PitchPrediction`), `homeWinProb` | **MOCK** — reuse `sim.ts` `predictPitch` / `predictOutcome` / `winProb` against the reconstructed `pre` state (seeded, deterministic) |

`pregameHomeWinProb` is likewise mock (`winProb` of the initial state). The on-screen
`MockBadge` and the "not a live model" footers stay.

## Architecture

```
statsapi.mlb.com
   │  (server-side fetch, cached via { next: { revalidate } })
   ▼
Route Handlers  →  JSON in existing Game / Game[] types  →  client hooks  →  UNCHANGED components
   │
   └─ ALL GUMBO→types mapping isolated in lib/mlbAdapter.ts (a feed change = one-file fix)
```

Route handlers are **dynamic** (Next 16 does not cache them by default), so each client poll
gets a fresh response; upstream etiquette comes from `fetch(url, { next: { revalidate } })`
caching the MLB response for ~10–15s across requests (the same pattern `lib/polymarket.ts`
already uses). No API key, no secrets.

## New files

### `lib/mlbConfig.ts`
- `MLB_BASE = "https://statsapi.mlb.com"`.
- Poll intervals: `LIVE_GAME_POLL_MS = 12000`, `SCHEDULE_POLL_MS = 15000`.
- Server revalidate seconds: `SCHEDULE_REVALIDATE = 15`, `GAME_REVALIDATE = 10`.
- `abbrToTeamId` / `teamIdToAbbr` derived from `teams.ts` (the adapter resolves MLB numeric
  team ids → our short ids for logos/colors). Single place to tune cadence/URLs.

### `lib/mlbAdapter.ts` (the thin adapter — the only file that reads GUMBO shapes)
- `mapSchedule(json): { games: Game[]; date: string }` — maps `dates[].games[]`:
  gamePk→id, `status.abstractGameState` (Preview/Live/Final)→`upcoming|live|final`,
  home/away `{id,name,abbreviation}` + `score`, `linescore.currentInning` +
  `inningState`. For final games synthesizes a single terminal `PitchEvent` carrying the
  final score (so the card reads `snap`); upcoming → `events: []`; live list entries carry
  score/inning only (the live card enriches via the game feed).
- `mapFeed(gumbo): Game` — maps `/v1.1/game/{pk}/feed/live`:
  teams from `gameData.teams`, status from `gameData.status`, score/inning from
  `liveData.linescore`, and flattens `liveData.plays.allPlays[].playEvents[]` where
  `isPitch === true` into real `PitchEvent[]`. Reconstructs `pre`/`post` snapshots from each
  pitch's `count` + running score/bases, fills the mock `prediction` + `homeWinProb` per
  event via `sim.ts`, resolves probables/lineups where available, and resolves logos/colors
  via `teams.ts`.
- Defensive parsing throughout (upstream is undocumented). Specific try/catch, never bare.

### `app/api/schedule/route.ts`
- `GET` — optional `?date=YYYY-MM-DD` (default today). Fetches
  `/v1/schedule?sportId=1&hydrate=team,linescore` with `{ next: { revalidate: 15 } }`.
  Returns `{ games, date }`. On fetch/parse error returns `{ games: [], date }` — never 5xx.

### `app/api/game/[gamePk]/route.ts`
- `GET(_req, ctx)` with `await ctx.params`. Fetches `/v1.1/game/{pk}/feed/live` with
  `{ next: { revalidate: 10 } }`, returns `{ game: Game }`. On fetch/parse error returns
  `{ game: null, error: "unavailable" }` with HTTP 200 — never 5xx. The client hook keeps
  its last good state when `game` is null.

## Reconciling append-only real data with the playback UI

The current live UI is a **playback engine**: `GameView`'s `LiveGameView` runs its own
`predict→reveal` timer over a fully pre-scripted `game.events` (future included), and
`useLiveGame` is timer-driven cursor playback. Real data is append-only — there is no future.
Approved approach (poll-driven):

- **`useLiveGame(game)` is rewritten into the poll-driven hook**, keeping the exact
  `LiveGameState` return shape. Live → polls `/api/game/{id}` every 12s, stops at Final,
  retains last-good-state on error.
  - `consumed` = real thrown pitches (each real actual + mock prediction).
  - `next` = a **synthetic pending pitch**: `pre` = current live state, mock `prediction`
    for that state, no actual yet (the "Predicting / Awaiting the pitch…" state).
  - `snap` = current state; `status` reflects Live/Final.
  - Non-live → derives `LiveGameState` from the passed `Game` (no polling).
- **`Schedule.tsx`** — swap `getGames()` for `useSchedule()` (fetch `/api/schedule`, light
  ~15s poll). The real date is exposed by the hook and shown in `DateChip` (the
  `SCHEDULE_DATE` export remains a fallback). JSX unchanged; first-load loading + existing
  empty state intact. Live spotlight cards enrich via `useLiveGame` (which polls the feed).
- **`GameView.tsx`** — swap the synchronous `getGame(id)` + internal replay timer for the
  poll hook. `LiveGameView` renders off `useLiveGame`'s state: the pending pitch shows
  "Predicting → Awaiting the pitch…"; when a poll reveals a newly-thrown pitch it animates
  resolved, then advances to the next pending pitch. `PreGameView` (pregame read) and
  `FinalGameView` (recap over real pitches) map straight from the fetched `Game`. Every
  sub-component (`Scoreboard`, `PredictionHero`, `Matchup`, `WinProbPanel`, `AccuracyPanel`,
  `PitchFeed`, moments) and their markup are unchanged — only the state source.

## Untouched

`types.ts`, `view.ts`, `format.ts`, `ui.ts`, `teams.ts`, all `components/ui/*` and visual
primitives, the design tokens / `globals.css`, the Polymarket integration, `MockBadge`.
`sim.ts` is **kept and reused** for the mock prediction stub. `mock.ts` becomes unused once
the swap lands; left in place and noted (not deleted) unless removal is requested.

## Error / empty / loading states

- Schedule: first-load skeleton/loading; empty slate → existing "No games scheduled".
- Game: loading on first fetch; "game not live yet" (pregame) and "game final" handled by the
  existing `PreGameView` / `FinalGameView` branches; fetch failure → keep last good state,
  never crash.
- Mobile responsive (~380px+), keyboard accessible — unchanged from current components.

## Verification

1. `cd web && npm run build` → no type errors. `npm run lint` → clean.
2. `GET /api/schedule` → today's real games, correctly typed; logos/colors resolve.
3. `GET /api/game/{pk}` for a live game → real current state + real pitch sequence in the
   existing types; for non-live → sensible final/preview without erroring.
4. Home page renders real games; a live game streams pitch-by-pitch; AI panel still mock +
   labeled.

## Out of scope (later phases)

Real model inference for predictions / win probability. This phase only makes the
game/schedule/pitch data real.
