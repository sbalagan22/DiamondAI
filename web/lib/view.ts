/**
 * View adapter — maps the mock-data contract (`Game` / `PitchEvent` in
 * `types.ts`, untouched) into the shapes the ported design components expect.
 *
 * The design needs a per-pitch strike-zone location and a pitch-level
 * "likely outcome" that the underlying model doesn't store. Both are derived
 * here, deterministically (no Date/Math.random), so server and client agree.
 */

import { CALL_LABELS } from "./format";
import { TEAM_META } from "./teams";
import {
  PITCH_NAMES,
  type AtBatOutcome,
  type GameSnapshot,
  type PitchCall,
  type PitchEvent,
  type PitchTypeCode,
  type Team,
} from "./types";

// ---- teams: enrich the contract `Team` with brand color + logo paths -------
export interface ViewTeam extends Team {
  primaryColor: string;
  /** white logo for dark backgrounds */
  logoDark: string;
  /** colored logo for light backgrounds */
  logoLight: string;
  hasLogo: boolean;
}

export function viewTeam(t: Team): ViewTeam {
  const meta = TEAM_META[t.id];
  const has = !!meta;
  return {
    ...t,
    primaryColor: meta?.primaryColor ?? "#8a8a8f",
    logoDark: has ? `/logos/mlb/dark/${t.id}.svg` : "",
    logoLight: has ? `/logos/mlb/light/${t.id}.svg` : "",
    hasLogo: has,
  };
}

// ---- strike zone (catcher's view: col 0 = inside to RHB, row 0 = top) ------
export interface Zone {
  col: number;
  row: number;
  label: string;
}

const ZONE_LABELS: string[][] = [
  ["Up & in", "High", "Up & away"],
  ["Inside", "Heart", "Away"],
  ["Low & in", "Low", "Low & away"],
];

const TYPE_IDX: Record<PitchTypeCode, number> = {
  FF: 0,
  SI: 1,
  FC: 2,
  SL: 3,
  SW: 4,
  CU: 5,
  CH: 6,
};

/** Deterministic 0..1 from an integer seed. */
function rand01(seed: number): number {
  let t = (seed * 2654435761) >>> 0;
  t ^= t >>> 15;
  t = Math.imul(t, 2246822507) >>> 0;
  t ^= t >>> 13;
  return (t >>> 0) / 4294967296;
}

function zoneFromSeed(a: number, b: number): Zone {
  const col = Math.min(2, Math.floor(rand01(a * 131 + b) * 3));
  const row = Math.min(2, Math.floor(rand01(a * 977 + b * 31 + 9) * 3));
  return { col, row, label: ZONE_LABELS[row][col] };
}

// ---- pitch-level "likely outcome" (a deterministic mock model read) --------
function predictedCall(e: PitchEvent): PitchCall {
  const s = e.pre;
  const table: [PitchCall, number][] = [
    ["ball", 26 + 3 * s.balls - 3 * s.strikes],
    ["called_strike", 14 + (s.strikes < 2 ? 4 : 0)],
    ["swinging_strike", 12 + 4 * s.strikes],
    ["foul", 16 + 2 * s.strikes],
    ["in_play", 18 + s.strikes],
  ];
  const total = table.reduce((sum, [, w]) => sum + Math.max(0, w), 0);
  let x = rand01(e.index * 7919 + 13) * total;
  for (const [call, w] of table) {
    x -= Math.max(0, w);
    if (x <= 0) return call;
  }
  return "in_play";
}

/** Coarse bucket so "called strike" vs "swinging strike" both count as a hit. */
export function callBucket(call: PitchCall): string {
  if (call === "called_strike" || call === "swinging_strike") return "strike";
  return call;
}

const OUTCOME_SHORT: Record<AtBatOutcome, string> = {
  strikeout: "strikeout",
  walk: "walk",
  field_out: "out",
  single: "single",
  double: "double",
  triple: "triple",
  home_run: "home run",
};

function actualOutcomeLabel(e: PitchEvent): string {
  if (e.call === "in_play") {
    return e.atBat ? `In play — ${OUTCOME_SHORT[e.atBat.outcome]}` : "In play";
  }
  return CALL_LABELS[e.call];
}

function countAfter(e: PitchEvent): { balls: number; strikes: number } {
  const after = { balls: e.pre.balls, strikes: e.pre.strikes };
  if (e.atBat) return after; // at-bat resolved — count doesn't advance visually
  if (e.call === "ball") after.balls += 1;
  else if (e.call === "called_strike" || e.call === "swinging_strike")
    after.strikes += 1;
  else if (e.call === "foul" && e.pre.strikes < 2) after.strikes += 1;
  return after;
}

// ---- the per-pitch view model ----------------------------------------------
export interface ViewPitch {
  index: number;
  inning: number;
  half: "top" | "bottom";
  awayScore: number;
  homeScore: number;
  awayScoreAfter: number;
  homeScoreAfter: number;
  countBefore: { balls: number; strikes: number };
  countAfter: { balls: number; strikes: number };
  outs: number;
  bases: { first: boolean; second: boolean; third: boolean };
  batter: string;
  pitcher: string;
  predicted: {
    pitchType: string;
    zone: Zone;
    outcome: string;
    confidence: number;
  };
  actual: {
    pitchType: string;
    velo: number;
    zone: Zone;
    outcome: string;
    call: PitchCall;
  };
  typeHit: boolean;
  outcomeHit: boolean;
  homeWinProbAfter: number;
  abEnd?: string;
}

export function viewPitch(e: PitchEvent): ViewPitch {
  const topType = e.prediction.pitches[0].type;
  const predCall = predictedCall(e);
  const typeHit = topType === e.pitchType;
  const outcomeHit = callBucket(predCall) === callBucket(e.call);

  let abEnd: string | undefined;
  if (e.atBat) {
    const runs = e.atBat.runs;
    abEnd =
      `${e.atBat.description}.` +
      (runs > 0 ? ` ${runs} run${runs > 1 ? "s" : ""} in.` : "");
  }

  return {
    index: e.index,
    inning: e.pre.inning,
    half: e.pre.half,
    awayScore: e.pre.awayScore,
    homeScore: e.pre.homeScore,
    awayScoreAfter: e.post.awayScore,
    homeScoreAfter: e.post.homeScore,
    countBefore: { balls: e.pre.balls, strikes: e.pre.strikes },
    countAfter: countAfter(e),
    outs: e.pre.outs,
    bases: { first: e.pre.bases[0], second: e.pre.bases[1], third: e.pre.bases[2] },
    batter: e.pre.batter,
    pitcher: e.pre.pitcher,
    predicted: {
      pitchType: PITCH_NAMES[topType],
      zone: zoneFromSeed(e.index + 1, TYPE_IDX[topType]),
      outcome: CALL_LABELS[predCall],
      confidence: e.prediction.pitches[0].prob,
    },
    actual: {
      pitchType: PITCH_NAMES[e.pitchType],
      velo: e.mph,
      zone: zoneFromSeed(e.index + 101, TYPE_IDX[e.pitchType] * 7 + e.mph),
      outcome: actualOutcomeLabel(e),
      call: e.call,
    },
    typeHit,
    outcomeHit,
    homeWinProbAfter: e.homeWinProb,
    abEnd,
  };
}

/** First/last name -> "F. Last" for compact display. */
export function shortName(full: string): string {
  const parts = full.trim().split(" ");
  return parts.length > 1 ? `${parts[0][0]}. ${parts.slice(1).join(" ")}` : full;
}

/** A live snapshot for a schedule card: score/inning/half/winprob at a cursor. */
export interface LiveSnap {
  awayScore: number;
  homeScore: number;
  inning: number;
  half: "top" | "bot";
  homeWinProb: number;
}

export function snapAt(e: GameSnapshot, homeWinProb: number): LiveSnap {
  return {
    awayScore: e.awayScore,
    homeScore: e.homeScore,
    inning: e.inning,
    half: e.half === "bottom" ? "bot" : "top",
    homeWinProb,
  };
}
