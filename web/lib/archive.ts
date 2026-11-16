/**
 * Archived games: real MLB game feeds plus real model predictions, captured once
 * after the games ended and served from static JSON (no live feed or model
 * server needed). Shown when there is no current slate (offseason).
 */
import { MODEL_WINDOW } from "@/lib/mlbConfig";
import type { GameResponse } from "@/lib/mlbAdapter";
import type { Game } from "@/lib/types";
import index from "@/data/archive/index.json";
import g849805 from "@/data/archive/849805.json";
import g849802 from "@/data/archive/849802.json";
import g849804 from "@/data/archive/849804.json";
import g849803 from "@/data/archive/849803.json";
import g849799 from "@/data/archive/849799.json";

const FEEDS: Record<string, GameResponse> = {
  "849805": g849805 as unknown as GameResponse,
  "849802": g849802 as unknown as GameResponse,
  "849804": g849804 as unknown as GameResponse,
  "849803": g849803 as unknown as GameResponse,
  "849799": g849799 as unknown as GameResponse,
};

export interface ArchiveEntry {
  /** Schedule-card shape: events trimmed to the final-state summary. */
  game: Game;
  /** ISO slate date, e.g. "2026-10-23". */
  date: string;
  round: string;
  /** 1-based game number within the round. */
  number: number;
}

export interface ArchiveResponse {
  label: string;
  /** Pitches the model predicted, and how many top-picks matched the pitch thrown. */
  stats: { games: number; pitches: number; typeHits: number };
  entries: ArchiveEntry[];
}

export function getArchivedGame(id: string): GameResponse | null {
  return FEEDS[id] ?? null;
}

export function getArchive(): ArchiveResponse {
  let pitches = 0;
  let typeHits = 0;
  const entries: ArchiveEntry[] = index.games.map((g) => {
    const full = FEEDS[g.id].game as Game;
    for (const e of full.events) {
      if (e.index < MODEL_WINDOW) continue;
      pitches += 1;
      if (e.prediction.pitches[0].type === e.pitchType) typeHits += 1;
    }
    const last = full.events[full.events.length - 1];
    return {
      game: { ...full, events: [last], liveIndex: 1 },
      date: g.date,
      round: g.round,
      number: g.number,
    };
  });
  return { label: index.label, stats: { games: entries.length, pitches, typeHits }, entries };
}
