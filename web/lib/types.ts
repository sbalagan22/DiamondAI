/**
 * Domain types for DiamondAI.
 *
 * The UI consumes only these shapes plus the accessors in `lib/mock.ts`.
 * A real data source (live feed + model server) can replace the mock layer
 * by implementing `getGames()` / `getGame(id)` with the same types.
 */

export type GameStatus = "live" | "upcoming" | "final";

export interface Team {
  id: string;
  abbr: string;
  city: string;
  name: string;
}

export type PitchTypeCode = "FF" | "SI" | "FC" | "SL" | "SW" | "CU" | "CH";

export const PITCH_NAMES: Record<PitchTypeCode, string> = {
  FF: "Four-Seam",
  SI: "Sinker",
  FC: "Cutter",
  SL: "Slider",
  SW: "Sweeper",
  CU: "Curveball",
  CH: "Changeup",
};

export type PitchCall =
  | "ball"
  | "called_strike"
  | "swinging_strike"
  | "foul"
  | "in_play";

export type AtBatOutcome =
  | "strikeout"
  | "walk"
  | "field_out"
  | "single"
  | "double"
  | "triple"
  | "home_run";

/** Coarse at-bat outcome classes the model predicts over. */
export type OutcomeClass = "strikeout" | "walk" | "out" | "hit";

export interface PitchProb {
  type: PitchTypeCode;
  prob: number;
}

/** The model's view of the upcoming pitch, made before it is thrown. */
export interface PitchPrediction {
  /** Sorted descending; sums to ~1. */
  pitches: PitchProb[];
  outcome: Record<OutcomeClass, number>;
}

/** Full game state at a moment in time. */
export interface GameSnapshot {
  inning: number;
  half: "top" | "bottom";
  outs: number;
  balls: number;
  strikes: number;
  /** Runners on [first, second, third]. */
  bases: [boolean, boolean, boolean];
  awayScore: number;
  homeScore: number;
  batter: string;
  pitcher: string;
}

export interface AtBatResult {
  outcome: AtBatOutcome;
  /** e.g. "Ground out to short", "Strikeout swinging". */
  description: string;
  runs: number;
}

/** One pitch: the prediction made before it, and what actually happened. */
export interface PitchEvent {
  /** 0-based pitch number within the game. */
  index: number;
  /** State when the prediction was made. */
  pre: GameSnapshot;
  prediction: PitchPrediction;
  pitchType: PitchTypeCode;
  mph: number;
  call: PitchCall;
  /** Present when this pitch ends the at-bat. */
  atBat?: AtBatResult;
  /** State after the pitch resolved. */
  post: GameSnapshot;
  /** Model estimate after this pitch, 0..1 (home team). */
  homeWinProb: number;
}

/** A player with a display-ready stat line, e.g. ".287 AVG · 16 HR". */
export interface PlayerLine {
  name: string;
  line: string;
}

export interface Game {
  id: string;
  status: GameStatus;
  away: Team;
  home: Team;
  venue: string;
  /** Display string, e.g. "7:05 PM ET". */
  startTime: string;
  probables: { away: PlayerLine; home: PlayerLine };
  lineups: { away: PlayerLine[]; home: PlayerLine[] };
  /** Model's pregame estimate, 0..1 (home team). */
  pregameHomeWinProb: number;
  /** The full scripted game, first pitch to last. */
  events: PitchEvent[];
  /** Pitches already thrown when a live game page loads. */
  liveIndex: number;
}
