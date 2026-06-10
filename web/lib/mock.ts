/**
 * Mock data source. The only entry points the UI uses are `getGames()` and
 * `getGame(id)` — swap this module for a real feed + model service later.
 *
 * Everything is generated from fixed seeds at module load, so server and
 * client always agree on the exact same script.
 */

import { buildRoster, generateGame, mulberry32 } from "./sim";
import { TEAMS, VENUES } from "./teams";
import type { Game, GameStatus } from "./types";

interface ScheduleDef {
  id: string;
  awayId: string;
  homeId: string;
  status: GameStatus;
  startTime: string;
  seed: number;
  /** Roughly how far through the script a live game is at page load. */
  liveFraction?: number;
}

/** The mock slate, set around ~9:50 PM ET on a June evening. */
const SCHEDULE: ScheduleDef[] = [
  {
    id: "bos-nyy",
    awayId: "bos",
    homeId: "nyy",
    status: "live",
    startTime: "7:05 PM ET",
    // Chosen so the page opens on a tie game in the 7th with a late winner.
    seed: 0x5eed7d,
    liveFraction: 0.66,
  },
  {
    id: "lad-sf",
    awayId: "lad",
    homeId: "sf",
    status: "live",
    startTime: "9:05 PM ET",
    seed: 0x5eed02,
    liveFraction: 0.16,
  },
  {
    id: "sd-sea",
    awayId: "sd",
    homeId: "sea",
    status: "upcoming",
    startTime: "10:10 PM ET",
    seed: 0x5eed03,
  },
  {
    id: "hou-laa",
    awayId: "hou",
    homeId: "laa",
    status: "upcoming",
    startTime: "10:07 PM ET",
    seed: 0x5eed04,
  },
  {
    id: "chc-stl",
    awayId: "chc",
    homeId: "stl",
    status: "final",
    startTime: "2:15 PM ET",
    seed: 0x5eed05,
  },
  {
    id: "bal-tor",
    awayId: "bal",
    homeId: "tor",
    status: "final",
    startTime: "7:07 PM ET",
    seed: 0x5eed06,
  },
];

function buildGame(def: ScheduleDef): Game {
  const rosterRng = mulberry32(def.seed ^ 0xa11ce);
  const away = buildRoster(rosterRng);
  const home = buildRoster(rosterRng);
  const { events, pregameHomeWinProb } = generateGame(def.seed, away, home);

  let liveIndex = 0;
  if (def.status === "live" && def.liveFraction) {
    liveIndex = Math.floor(events.length * def.liveFraction);
    // Snap forward to the start of an at-bat so the page opens cleanly.
    while (
      liveIndex < events.length - 1 &&
      !(events[liveIndex].pre.balls === 0 && events[liveIndex].pre.strikes === 0)
    ) {
      liveIndex += 1;
    }
  }

  return {
    id: def.id,
    status: def.status,
    away: TEAMS[def.awayId],
    home: TEAMS[def.homeId],
    venue: VENUES[def.homeId],
    startTime: def.startTime,
    probables: { away: away.pitcher, home: home.pitcher },
    lineups: { away: away.lineup, home: home.lineup },
    pregameHomeWinProb,
    events,
    liveIndex,
  };
}

const GAMES: Game[] = SCHEDULE.map(buildGame);

export function getGames(): Game[] {
  return GAMES;
}

export function getGame(id: string): Game | undefined {
  return GAMES.find((g) => g.id === id);
}

/** Display date for the mock slate. */
export const SCHEDULE_DATE = "Tuesday · June 9";
