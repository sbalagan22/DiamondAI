/**
 * MLB Stats API -> domain-types adapter (the ONLY file that reads GUMBO shapes).
 *
 * Game facts are REAL (teams, score, count, outs, bases, the pitch actually
 * thrown, its velocity, the play result, batter/pitcher). The model side stays
 * MOCK this phase: each pitch's `prediction` and `homeWinProb` are filled by
 * reusing the deterministic generator in `sim.ts`, bound to the real pre-pitch
 * state — clearly a placeholder, not live model output.
 *
 * Keep all upstream field-reading here so a feed change is a one-file fix.
 */

import { mulberry32, predictOutcome, predictPitch, winProb } from "./sim";
import { REPERTOIRES, TEAMS, VENUES } from "./teams";
import type {
  AtBatOutcome,
  Game,
  GameSnapshot,
  GameStatus,
  PitchCall,
  PitchEvent,
  PitchPrediction,
  PitchTypeCode,
  PlayerLine,
  Team,
} from "./types";

// ---- response envelopes (shared with the route handlers + client) ----------
export interface ScheduleResponse {
  games: Game[];
  date: string;
}
export interface GameResponse {
  game: Game | null;
  /** The next, not-yet-thrown pitch: real current state + a MOCK prediction. */
  pending: PitchEvent | null;
  error?: string;
}

// ---- loose typings for the GUMBO subset we read -----------------------------
interface MlbTeamRef {
  id?: number;
  name?: string;
  abbreviation?: string;
  teamName?: string;
  locationName?: string;
}
interface MlbCount {
  balls?: number;
  strikes?: number;
  outs?: number;
}
interface MlbPlayEvent {
  isPitch?: boolean;
  pitchNumber?: number;
  details?: {
    description?: string;
    call?: { code?: string; description?: string };
    isInPlay?: boolean;
    isStrike?: boolean;
    isBall?: boolean;
    type?: { code?: string; description?: string };
  };
  count?: MlbCount;
  pitchData?: { startSpeed?: number; zone?: number; coordinates?: { pX?: number; pZ?: number } };
}
interface MlbRunner {
  movement?: { start?: string | null; end?: string | null; outBase?: string | null; isOut?: boolean };
}
interface MlbPlay {
  about?: { inning?: number; halfInning?: string; isComplete?: boolean };
  matchup?: {
    batter?: { id?: number; fullName?: string };
    pitcher?: { id?: number; fullName?: string };
  };
  result?: { eventType?: string; event?: string; rbi?: number; awayScore?: number; homeScore?: number; description?: string };
  count?: MlbCount;
  playEvents?: MlbPlayEvent[];
  runners?: MlbRunner[];
}
interface MlbBoxTeam {
  battingOrder?: number[];
  players?: Record<
    string,
    {
      person?: { fullName?: string };
      seasonStats?: {
        batting?: { avg?: string; homeRuns?: number };
        pitching?: { era?: string; strikeOuts?: number };
      };
    }
  >;
}
interface MlbLinescore {
  currentInning?: number;
  inningState?: string;
  balls?: number;
  strikes?: number;
  outs?: number;
  teams?: { home?: { runs?: number }; away?: { runs?: number } };
  offense?: { batter?: { fullName?: string }; first?: unknown; second?: unknown; third?: unknown };
  defense?: { pitcher?: { id?: number; fullName?: string } };
}
export interface GumboFeed {
  gamePk?: number;
  gameData?: {
    game?: { pk?: number };
    status?: { abstractGameState?: string };
    teams?: { home?: MlbTeamRef; away?: MlbTeamRef };
    venue?: { name?: string };
    datetime?: { dateTime?: string };
    probablePitchers?: { home?: { id?: number; fullName?: string }; away?: { id?: number; fullName?: string } };
  };
  liveData?: {
    linescore?: MlbLinescore;
    plays?: { allPlays?: MlbPlay[] };
    boxscore?: { teams?: { home?: MlbBoxTeam; away?: MlbBoxTeam } };
  };
}
interface MlbScheduleGame {
  gamePk?: number;
  gameDate?: string;
  status?: { abstractGameState?: string };
  teams?: {
    home?: { team?: MlbTeamRef; score?: number; probablePitcher?: { fullName?: string } };
    away?: { team?: MlbTeamRef; score?: number; probablePitcher?: { fullName?: string } };
  };
  linescore?: { currentInning?: number; inningState?: string };
  venue?: { name?: string };
}
export interface ScheduleFeed {
  dates?: { date?: string; games?: MlbScheduleGame[] }[];
}

// ---- small mapping tables ---------------------------------------------------
import { MLB_TEAM_ID } from "./mlbConfig";

const EMPTY_BASES: [boolean, boolean, boolean] = [false, false, false];

function mapStatus(abstract?: string): GameStatus {
  if (abstract === "Live") return "live";
  if (abstract === "Final") return "final";
  return "upcoming";
}

/** MLB Statcast pitch code -> our 7-code repertoire. Unknown -> four-seam. */
const PITCH_CODE: Record<string, PitchTypeCode> = {
  FF: "FF", FA: "FF",
  SI: "SI", FT: "SI",
  FC: "FC",
  SL: "SL",
  ST: "SW", SW: "SW", SV: "SW",
  CU: "CU", KC: "CU", CS: "CU", SC: "CU",
  CH: "CH", FS: "CH", FO: "CH", EP: "CH", KN: "CH",
};
function mapPitchType(code?: string): PitchTypeCode {
  return (code && PITCH_CODE[code]) || "FF";
}

function mapCall(e: MlbPlayEvent): PitchCall {
  if (e.details?.isInPlay) return "in_play";
  switch (e.details?.call?.code) {
    case "C":
      return "called_strike";
    case "S":
    case "W":
    case "Q":
    case "M":
      return "swinging_strike";
    case "F":
    case "T":
    case "L":
    case "O":
    case "R":
      return "foul";
    case "X":
    case "D":
    case "E":
      return "in_play";
    default:
      if (e.details?.isStrike) return "called_strike";
      return "ball";
  }
}

function mapOutcome(eventType?: string): AtBatOutcome {
  switch (eventType) {
    case "strikeout":
    case "strikeout_double_play":
      return "strikeout";
    case "walk":
    case "intent_walk":
    case "hit_by_pitch":
      return "walk";
    case "single":
      return "single";
    case "double":
      return "double";
    case "triple":
      return "triple";
    case "home_run":
      return "home_run";
    default:
      return "field_out";
  }
}

/** Resolve a real team into our canonical `Team` (so logos/colors resolve by id). */
function teamFromMlb(t?: MlbTeamRef): Team {
  const internal = t?.id != null ? MLB_TEAM_ID[t.id] : undefined;
  if (internal && TEAMS[internal]) return TEAMS[internal];
  return {
    id: internal ?? String(t?.id ?? "unk"),
    abbr: t?.abbreviation ?? "",
    city: t?.locationName ?? "",
    name: t?.teamName ?? t?.name ?? "",
  };
}

/** Deterministic mock repertoire for a real pitcher (by id). */
function repertoireFor(pitcherId?: number): [PitchTypeCode, number][] {
  return REPERTOIRES[(pitcherId ?? 0) % REPERTOIRES.length];
}

function clampWp(x: number): number {
  return Math.min(0.99, Math.max(0.01, x));
}

function formatStartTime(iso?: string): string {
  if (!iso) return "";
  try {
    const s = new Date(iso).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/New_York",
    });
    return `${s} ET`;
  } catch {
    return "";
  }
}

const INITIAL_SNAP: GameSnapshot = {
  inning: 1,
  half: "top",
  outs: 0,
  balls: 0,
  strikes: 0,
  bases: EMPTY_BASES,
  awayScore: 0,
  homeScore: 0,
  batter: "",
  pitcher: "",
};

/** A mock `PitchPrediction` for a real pre-pitch state. */
function mockPrediction(rng: () => number, pitcherId: number | undefined, pre: GameSnapshot): PitchPrediction {
  return {
    pitches: predictPitch(rng, repertoireFor(pitcherId), pre),
    outcome: predictOutcome(pre),
  };
}

// ---- baserunner reconstruction ---------------------------------------------
/** Apply a play's runner movements onto the carried base state. */
function applyRunners(start: [boolean, boolean, boolean], play: MlbPlay): [boolean, boolean, boolean] {
  const occ: Record<string, boolean> = { "1B": start[0], "2B": start[1], "3B": start[2] };
  for (const r of play.runners ?? []) {
    const from = r.movement?.start;
    const to = r.movement?.end;
    if (from && from in occ) occ[from] = false;
    if (r.movement?.isOut) {
      if (to && to in occ) occ[to] = false;
      continue;
    }
    if (to === "1B" || to === "2B" || to === "3B") occ[to] = true;
  }
  return [occ["1B"], occ["2B"], occ["3B"]];
}

// ---- lineups / probables ----------------------------------------------------
function buildLineup(box?: MlbBoxTeam): PlayerLine[] {
  if (!box?.battingOrder) return [];
  return box.battingOrder.map((pid) => {
    const p = box.players?.[`ID${pid}`];
    const b = p?.seasonStats?.batting;
    return {
      name: p?.person?.fullName ?? "—",
      line: b ? `${b.avg ?? "—"} AVG · ${b.homeRuns ?? 0} HR` : "—",
    };
  });
}

function findPitcherStats(
  boxTeams: { home?: MlbBoxTeam; away?: MlbBoxTeam } | undefined,
  id?: number,
): { era?: string; strikeOuts?: number } | undefined {
  if (id == null) return undefined;
  const key = `ID${id}`;
  return (boxTeams?.home?.players?.[key] ?? boxTeams?.away?.players?.[key])?.seasonStats?.pitching;
}

function buildProbable(
  prob: { id?: number; fullName?: string } | undefined,
  boxTeams: { home?: MlbBoxTeam; away?: MlbBoxTeam } | undefined,
): PlayerLine {
  if (!prob?.fullName) return { name: "TBD", line: "—" };
  const pit = findPitcherStats(boxTeams, prob.id);
  return {
    name: prob.fullName,
    line: pit ? `${pit.era ?? "—"} ERA · ${pit.strikeOuts ?? 0} K` : "—",
  };
}

// ---- schedule ---------------------------------------------------------------
/** Minimal event carrying a score/inning snapshot (schedule list cards read
 *  this before the live feed enriches them; final cards read final score). */
function summaryEvent(snap: GameSnapshot, final: boolean): PitchEvent {
  return {
    index: 0,
    pre: snap,
    prediction: { pitches: [{ type: "FF", prob: 1 }], outcome: { strikeout: 0.25, walk: 0.25, out: 0.25, hit: 0.25 } },
    pitchType: "FF",
    mph: 0,
    call: "ball",
    post: snap,
    homeWinProb: winProb(snap, final),
  };
}

function mapHalf(inningState?: string): "top" | "bottom" {
  return inningState === "Bottom" || inningState === "End" ? "bottom" : "top";
}

function mapScheduleGame(g: MlbScheduleGame): Game {
  const status = mapStatus(g.status?.abstractGameState);
  const away = teamFromMlb(g.teams?.away?.team);
  const home = teamFromMlb(g.teams?.home?.team);
  const awayScore = g.teams?.away?.score ?? 0;
  const homeScore = g.teams?.home?.score ?? 0;

  let events: PitchEvent[] = [];
  if (status !== "upcoming") {
    const snap: GameSnapshot = {
      ...INITIAL_SNAP,
      inning: g.linescore?.currentInning ?? 9,
      half: mapHalf(g.linescore?.inningState),
      awayScore,
      homeScore,
    };
    events = [summaryEvent(snap, status === "final")];
  }

  return {
    id: String(g.gamePk ?? ""),
    status,
    away,
    home,
    venue: g.venue?.name ?? VENUES[home.id] ?? "",
    startTime: formatStartTime(g.gameDate),
    probables: {
      away: { name: g.teams?.away?.probablePitcher?.fullName ?? "TBD", line: "—" },
      home: { name: g.teams?.home?.probablePitcher?.fullName ?? "TBD", line: "—" },
    },
    lineups: { away: [], home: [] },
    pregameHomeWinProb: winProb(INITIAL_SNAP),
    events,
    liveIndex: events.length,
  };
}

export function mapSchedule(feed: ScheduleFeed): ScheduleResponse {
  const date = feed.dates?.[0]?.date ?? "";
  const games = (feed.dates?.[0]?.games ?? []).map(mapScheduleGame);
  return { games, date };
}

// ---- live feed --------------------------------------------------------------
export function mapFeed(feed: GumboFeed): GameResponse {
  const gd = feed.gameData;
  const ld = feed.liveData;
  const status = mapStatus(gd?.status?.abstractGameState);
  const away = teamFromMlb(gd?.teams?.away);
  const home = teamFromMlb(gd?.teams?.home);
  const gamePk = gd?.game?.pk ?? feed.gamePk ?? 0;
  const rng = mulberry32(gamePk || 1);
  const boxTeams = ld?.boxscore?.teams;

  const events: PitchEvent[] = [];
  let bases: [boolean, boolean, boolean] = [...EMPTY_BASES];
  let awayScore = 0;
  let homeScore = 0;
  let outsBefore = 0;
  let prevHalfKey = "";

  for (const play of ld?.plays?.allPlays ?? []) {
    const inning = play.about?.inning ?? 1;
    const half: "top" | "bottom" = play.about?.halfInning === "bottom" ? "bottom" : "top";
    const halfKey = `${inning}-${half}`;
    if (halfKey !== prevHalfKey) {
      bases = [...EMPTY_BASES];
      outsBefore = 0;
      prevHalfKey = halfKey;
    }
    const paStartBases: [boolean, boolean, boolean] = [...bases];
    const batter = play.matchup?.batter?.fullName ?? "";
    const pitcher = play.matchup?.pitcher?.fullName ?? "";
    const pitcherId = play.matchup?.pitcher?.id;

    const pitches = (play.playEvents ?? []).filter((e) => e.isPitch);
    let balls = 0;
    let strikes = 0;

    pitches.forEach((e, j) => {
      const isLast = j === pitches.length - 1;
      const ended = isLast && play.about?.isComplete === true;
      const pre: GameSnapshot = {
        inning,
        half,
        outs: outsBefore,
        balls,
        strikes,
        bases: [...paStartBases],
        awayScore,
        homeScore,
        batter,
        pitcher,
      };
      const call = mapCall(e);
      const speed = e.pitchData?.startSpeed;
      const mph = speed != null ? Math.round(speed * 10) / 10 : 0;

      // advance the count (post)
      const postBalls = e.count?.balls ?? balls;
      const postStrikes = e.count?.strikes ?? strikes;

      let atBat: PitchEvent["atBat"];
      let post: GameSnapshot;
      if (ended) {
        const postScoreAway = play.result?.awayScore ?? awayScore;
        const postScoreHome = play.result?.homeScore ?? homeScore;
        atBat = {
          outcome: mapOutcome(play.result?.eventType),
          description: play.result?.description || play.result?.event || "",
          runs: play.result?.rbi ?? 0,
        };
        post = {
          inning,
          half,
          outs: play.count?.outs ?? outsBefore,
          balls: 0,
          strikes: 0,
          bases: applyRunners(paStartBases, play),
          awayScore: postScoreAway,
          homeScore: postScoreHome,
          batter,
          pitcher,
        };
      } else {
        post = {
          ...pre,
          balls: postBalls,
          strikes: postStrikes,
        };
      }

      events.push({
        index: events.length,
        pre,
        prediction: mockPrediction(rng, pitcherId, pre),
        pitchType: mapPitchType(e.details?.type?.code),
        mph,
        call,
        atBat,
        post,
        homeWinProb: clampWp(winProb(post, status === "final" && ended)),
      });

      balls = postBalls;
      strikes = postStrikes;
    });

    // carry state to the next play (within the same half-inning)
    awayScore = play.result?.awayScore ?? awayScore;
    homeScore = play.result?.homeScore ?? homeScore;
    bases = applyRunners(paStartBases, play);
    outsBefore = Math.min(3, play.count?.outs ?? outsBefore);
  }

  const game: Game = {
    id: String(gamePk),
    status,
    away,
    home,
    venue: gd?.venue?.name ?? VENUES[home.id] ?? "",
    startTime: formatStartTime(gd?.datetime?.dateTime),
    probables: {
      away: buildProbable(gd?.probablePitchers?.away, boxTeams),
      home: buildProbable(gd?.probablePitchers?.home, boxTeams),
    },
    lineups: {
      away: buildLineup(boxTeams?.away),
      home: buildLineup(boxTeams?.home),
    },
    pregameHomeWinProb: winProb(INITIAL_SNAP),
    events,
    liveIndex: events.length,
  };

  return { game, pending: buildPending(ld?.linescore, status, events.length, awayScore, homeScore, rng) };
}

/** The next, not-yet-thrown pitch: real current state from the linescore + a
 *  mock prediction. Placeholder actual fields are never shown (the view holds
 *  it in the "predicting" state until a real pitch arrives). */
function buildPending(
  ls: MlbLinescore | undefined,
  status: GameStatus,
  index: number,
  awayScore: number,
  homeScore: number,
  rng: () => number,
): PitchEvent | null {
  if (status !== "live" || !ls) return null;
  const batter = ls.offense?.batter?.fullName;
  const pitcher = ls.defense?.pitcher?.fullName;
  if (!batter || !pitcher) return null; // between innings — no current matchup
  const pre: GameSnapshot = {
    inning: ls.currentInning ?? 1,
    half: mapHalf(ls.inningState),
    outs: ls.outs ?? 0,
    balls: ls.balls ?? 0,
    strikes: ls.strikes ?? 0,
    bases: [!!ls.offense?.first, !!ls.offense?.second, !!ls.offense?.third],
    awayScore: ls.teams?.away?.runs ?? awayScore,
    homeScore: ls.teams?.home?.runs ?? homeScore,
    batter,
    pitcher,
  };
  return {
    index,
    pre,
    prediction: mockPrediction(rng, ls.defense?.pitcher?.id, pre),
    pitchType: "FF",
    mph: 0,
    call: "ball",
    post: pre,
    homeWinProb: clampWp(winProb(pre)),
  };
}
