/**
 * Central config for the real MLB Stats API integration.
 *
 * The MLB Stats API is public, key-less, and pull-based (refreshes ~every 12s).
 * All cadence/URL knobs live here so etiquette is tuned in one place; the
 * GUMBO -> types mapping lives in `mlbAdapter.ts`.
 */

export const MLB_BASE = "https://statsapi.mlb.com";

/**
 * DiamondAI inference server (the real trained model). Called SERVER-SIDE from the
 * game route / adapter; falls back to the sim.ts stub when unreachable.
 */
export const INFERENCE_URL = process.env.INFERENCE_URL ?? "http://localhost:8000";

/** Server-side cache windows (seconds) for the upstream MLB fetches. */
export const SCHEDULE_REVALIDATE = 15;
export const GAME_REVALIDATE = 10;

/** Client poll cadence (ms). Never poll faster than ~10s; live games only. */
export const SCHEDULE_POLL_MS = 15_000;
export const LIVE_GAME_POLL_MS = 12_000;

/**
 * MLB numeric team id -> our internal short id (the keys of `TEAMS` in
 * `teams.ts`). Mapping by id is stable across the API's abbreviation quirks
 * (e.g. AZ vs our `ari`, ATH vs our `oak`).
 */
export const MLB_TEAM_ID: Record<number, string> = {
  108: "laa",
  109: "ari",
  110: "bal",
  111: "bos",
  112: "chc",
  113: "cin",
  114: "cle",
  115: "col",
  116: "det",
  117: "hou",
  118: "kc",
  119: "lad",
  120: "wsh",
  121: "nym",
  133: "oak",
  134: "pit",
  135: "sd",
  136: "sea",
  137: "sf",
  138: "stl",
  139: "tb",
  140: "tex",
  141: "tor",
  142: "min",
  143: "phi",
  144: "atl",
  145: "cws",
  146: "mia",
  147: "nyy",
  158: "mil",
};
