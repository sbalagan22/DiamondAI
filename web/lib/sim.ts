/**
 * Deterministic mock-game generator.
 *
 * Seeded PRNG + simplified baseball rules produce a full, plausible game
 * script (pitch predictions + outcomes) that is identical on server and
 * client. Pure functions only — no Date, no Math.random.
 */

import {
  FIRST_NAMES,
  LAST_NAMES,
  MPH_RANGE,
  REPERTOIRES,
} from "./teams";
import type {
  AtBatOutcome,
  AtBatResult,
  GameSnapshot,
  OutcomeClass,
  PitchCall,
  PitchEvent,
  PitchPrediction,
  PitchProb,
  PitchTypeCode,
  PlayerLine,
} from "./types";

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function weighted<T>(rng: Rng, entries: [T, number][]): T {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [value, w] of entries) {
    r -= w;
    if (r <= 0) return value;
  }
  return entries[entries.length - 1][0];
}

function pick<T>(rng: Rng, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

export interface Roster {
  lineup: PlayerLine[];
  pitcher: PlayerLine;
  repertoire: [PitchTypeCode, number][];
}

export function buildRoster(rng: Rng): Roster {
  const used = new Set<string>();
  const name = (): string => {
    for (;;) {
      const n = `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`;
      if (!used.has(n)) {
        used.add(n);
        return n;
      }
    }
  };
  const lineup: PlayerLine[] = Array.from({ length: 9 }, () => {
    const avg = (0.232 + rng() * 0.076).toFixed(3).slice(1);
    const hr = 3 + Math.floor(rng() * 25);
    return { name: name(), line: `${avg} AVG · ${hr} HR` };
  });
  const era = (2.6 + rng() * 2.3).toFixed(2);
  const k = 40 + Math.floor(rng() * 120);
  return {
    lineup,
    pitcher: { name: name(), line: `${era} ERA · ${k} K` },
    repertoire: pick(rng, REPERTOIRES),
  };
}

function predictPitch(
  rng: Rng,
  repertoire: [PitchTypeCode, number][],
  s: GameSnapshot,
): PitchProb[] {
  const fastballs: PitchTypeCode[] = ["FF", "SI", "FC"];
  const breaking: PitchTypeCode[] = ["SL", "SW", "CU"];
  const raw = repertoire.map(([type, w]) => {
    let weight = w;
    if (s.balls > s.strikes && fastballs.includes(type)) weight *= 1.35;
    if (s.strikes === 2 && breaking.includes(type)) weight *= 1.3;
    if (s.strikes === 2 && type === "CH") weight *= 1.15;
    weight *= 0.85 + rng() * 0.3;
    return { type, prob: weight };
  });
  const total = raw.reduce((sum, p) => sum + p.prob, 0);
  return raw
    .map((p) => ({ type: p.type, prob: p.prob / total }))
    .sort((a, b) => b.prob - a.prob);
}

function predictOutcome(s: GameSnapshot): Record<OutcomeClass, number> {
  const w = {
    strikeout: 1 + s.strikes * 0.9,
    walk: 0.4 + s.balls * 0.55,
    out: 2.2,
    hit: 1.05 - s.strikes * 0.1,
  };
  const total = w.strikeout + w.walk + w.out + w.hit;
  return {
    strikeout: w.strikeout / total,
    walk: w.walk / total,
    out: w.out / total,
    hit: w.hit / total,
  };
}

/** Sample the actual pitch from a sharpened model distribution. */
function samplePitch(rng: Rng, probs: PitchProb[]): PitchTypeCode {
  return weighted(
    rng,
    probs.map((p) => [p.type, Math.pow(p.prob, 2.1)]),
  );
}

function sampleCall(rng: Rng, s: GameSnapshot): PitchCall {
  return weighted<PitchCall>(rng, [
    ["ball", 36 - 4 * s.strikes + 3 * s.balls],
    ["called_strike", 17 - 5 * s.strikes],
    ["swinging_strike", 10 + 2 * s.strikes],
    ["foul", 17 + 3 * s.strikes],
    ["in_play", 19 + s.strikes],
  ]);
}

const OUT_DESCRIPTIONS = [
  "Ground out to short",
  "Ground out to second",
  "Fly out to center",
  "Fly out to left",
  "Pop out to first",
  "Line out to third",
  "Fly out to deep right",
];
const SINGLE_DESCRIPTIONS = [
  "Single to left",
  "Single up the middle",
  "Single to right",
  "Bloop single to shallow center",
];
const DOUBLE_DESCRIPTIONS = [
  "Double into the left-field corner",
  "Double off the wall in center",
  "Ground-rule double to right",
];
const HR_DESCRIPTIONS = [
  "Home run to left field",
  "Home run to right-center",
  "Home run to deep center",
];

export function winProb(s: GameSnapshot, over = false): number {
  if (over) return s.homeScore > s.awayScore ? 1 : 0;
  const lead = s.homeScore - s.awayScore;
  const halves =
    (s.inning - 1) * 2 + (s.half === "bottom" ? 1 : 0) + s.outs / 3;
  const remaining = Math.max(18 - halves, 0.5);
  const runners =
    (s.bases[0] ? 0.35 : 0) + (s.bases[1] ? 0.55 : 0) + (s.bases[2] ? 0.8 : 0);
  const tilt =
    runners * (1 - s.outs / 3) * (s.half === "bottom" ? 1 : -1) * 0.45;
  const x = (lead + tilt + 0.12) / (0.55 * Math.sqrt(remaining));
  const wp = 1 / (1 + Math.exp(-x));
  return Math.min(0.98, Math.max(0.02, wp));
}

interface SimState {
  inning: number;
  half: "top" | "bottom";
  outs: number;
  balls: number;
  strikes: number;
  bases: [boolean, boolean, boolean];
  awayScore: number;
  homeScore: number;
  awayBatterIdx: number;
  homeBatterIdx: number;
}

function snapshot(st: SimState, away: Roster, home: Roster): GameSnapshot {
  const battingHome = st.half === "bottom";
  const lineup = battingHome ? home.lineup : away.lineup;
  const idx = battingHome ? st.homeBatterIdx : st.awayBatterIdx;
  return {
    inning: st.inning,
    half: st.half,
    outs: st.outs,
    balls: st.balls,
    strikes: st.strikes,
    bases: [...st.bases],
    awayScore: st.awayScore,
    homeScore: st.homeScore,
    batter: lineup[idx % 9].name,
    pitcher: (battingHome ? away : home).pitcher.name,
  };
}

function score(st: SimState, runs: number): void {
  if (st.half === "bottom") st.homeScore += runs;
  else st.awayScore += runs;
}

/** Apply an in-play outcome; returns the at-bat result. */
function resolveInPlay(rng: Rng, st: SimState): AtBatResult {
  const outcome = weighted<AtBatOutcome>(rng, [
    ["field_out", 66],
    ["single", 16],
    ["double", 6.5],
    ["triple", 0.8],
    ["home_run", 4.2],
  ]);
  const b = st.bases;
  let runs = 0;
  let description: string;
  if (outcome === "field_out") {
    const doublePlay = b[0] && st.outs < 2 && rng() < 0.12;
    if (doublePlay) {
      st.outs += 2;
      b[0] = false;
      description = "Grounded into a double play";
    } else {
      st.outs += 1;
      description = pick(rng, OUT_DESCRIPTIONS);
      if (b[2] && st.outs < 3 && rng() < 0.28 && description.startsWith("Fly")) {
        b[2] = false;
        runs += 1;
        description = "Sacrifice fly to center";
      }
    }
  } else if (outcome === "single") {
    // 3B scores; 2B scores 60% of the time, else holds at 3B; 1B to 2B.
    let runnerToThird = false;
    if (b[2]) runs += 1;
    if (b[1]) {
      if (rng() < 0.6) runs += 1;
      else runnerToThird = true;
    }
    st.bases = [true, b[0], runnerToThird];
    description = pick(rng, SINGLE_DESCRIPTIONS);
  } else if (outcome === "double") {
    if (b[2]) runs += 1;
    if (b[1]) runs += 1;
    let firstToThird = false;
    if (b[0]) {
      if (rng() < 0.45) runs += 1;
      else firstToThird = true;
    }
    st.bases = [false, true, firstToThird];
    description = pick(rng, DOUBLE_DESCRIPTIONS);
  } else if (outcome === "triple") {
    runs += (b[0] ? 1 : 0) + (b[1] ? 1 : 0) + (b[2] ? 1 : 0);
    st.bases = [false, false, true];
    description = "Triple into the right-field gap";
  } else {
    runs += 1 + (b[0] ? 1 : 0) + (b[1] ? 1 : 0) + (b[2] ? 1 : 0);
    st.bases = [false, false, false];
    description = pick(rng, HR_DESCRIPTIONS);
  }
  score(st, runs);
  return { outcome, description, runs };
}

function walkBatter(st: SimState): number {
  const b = st.bases;
  let runs = 0;
  if (b[0] && b[1] && b[2]) runs = 1;
  st.bases = [true, b[0], b[2] || (b[0] && b[1])];
  score(st, runs);
  return runs;
}

function nextBatter(st: SimState): void {
  if (st.half === "bottom") st.homeBatterIdx += 1;
  else st.awayBatterIdx += 1;
  st.balls = 0;
  st.strikes = 0;
}

function isGameOver(st: SimState): boolean {
  if (st.half === "bottom" && st.inning >= 9 && st.homeScore > st.awayScore) {
    return true; // walk-off or home already leads when the half ends
  }
  return false;
}

export interface GeneratedGame {
  events: PitchEvent[];
  pregameHomeWinProb: number;
}

export function generateGame(
  seed: number,
  away: Roster,
  home: Roster,
): GeneratedGame {
  const rng = mulberry32(seed);
  const st: SimState = {
    inning: 1,
    half: "top",
    outs: 0,
    balls: 0,
    strikes: 0,
    bases: [false, false, false],
    awayScore: 0,
    homeScore: 0,
    awayBatterIdx: 0,
    homeBatterIdx: 0,
  };
  const events: PitchEvent[] = [];
  const pregameHomeWinProb = winProb(snapshot(st, away, home));

  for (let guard = 0; guard < 2500; guard++) {
    const pre = snapshot(st, away, home);
    const repertoire = (st.half === "bottom" ? away : home).repertoire;
    const prediction: PitchPrediction = {
      pitches: predictPitch(rng, repertoire, pre),
      outcome: predictOutcome(pre),
    };
    const pitchType = samplePitch(rng, prediction.pitches);
    const [lo, hi] = MPH_RANGE[pitchType];
    const mph = Math.round(lo + rng() * (hi - lo));
    const call = sampleCall(rng, pre);

    let atBat: AtBatResult | undefined;
    if (call === "ball") {
      st.balls += 1;
      if (st.balls === 4) {
        const runs = walkBatter(st);
        atBat = { outcome: "walk", description: "Walk", runs };
      }
    } else if (call === "called_strike" || call === "swinging_strike") {
      st.strikes += 1;
      if (st.strikes === 3) {
        st.outs += 1;
        atBat = {
          outcome: "strikeout",
          description:
            call === "swinging_strike"
              ? "Strikeout swinging"
              : "Strikeout looking",
          runs: 0,
        };
      }
    } else if (call === "foul") {
      if (st.strikes < 2) st.strikes += 1;
    } else {
      atBat = resolveInPlay(rng, st);
    }

    let over = false;
    if (atBat) {
      nextBatter(st);
      over = isGameOver(st);
      if (!over && st.outs >= 3) {
        // End of half-inning.
        if (st.half === "bottom" && st.inning >= 9) {
          over = st.homeScore !== st.awayScore;
        } else if (st.half === "top" && st.inning >= 9) {
          // Home team skips its last at-bat if already ahead.
          over = st.homeScore > st.awayScore;
        }
        if (!over) {
          st.outs = 0;
          st.bases = [false, false, false];
          if (st.half === "top") {
            st.half = "bottom";
          } else {
            st.half = "top";
            st.inning += 1;
          }
          // Modern extra-innings rule: runner starts on second base.
          if (st.inning >= 10) st.bases = [false, true, false];
        }
      }
    }

    const post = snapshot(st, away, home);
    const noise = (rng() - 0.5) * 0.02;
    const wp = over
      ? winProb(post, true)
      : Math.min(0.99, Math.max(0.01, winProb(post) + noise));
    events.push({
      index: events.length,
      pre,
      prediction,
      pitchType,
      mph,
      call,
      atBat,
      post,
      homeWinProb: wp,
    });
    if (over) break;
  }
  return { events, pregameHomeWinProb };
}
