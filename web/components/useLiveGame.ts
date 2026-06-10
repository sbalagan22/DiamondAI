"use client";

import { useEffect, useMemo, useState } from "react";
import type { Game, GameSnapshot, GameStatus, PitchEvent } from "@/lib/types";

/** Simulated broadcast cadence: one pitch every few seconds. */
export const PITCH_MS = 3200;

/**
 * One clock per browser session so the schedule page and game pages agree on
 * how far every live game has advanced, even across navigations.
 */
let sessionStart: number | null = null;

export interface LiveGameState {
  /** Number of pitches consumed so far. */
  cursor: number;
  consumed: PitchEvent[];
  last: PitchEvent | null;
  next: PitchEvent | null;
  snap: GameSnapshot | null;
  /** Effective status — a live game that exhausts its script reads as final. */
  status: GameStatus;
  finished: boolean;
}

export function useLiveGame(game: Game): LiveGameState {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (game.status !== "live") return;
    if (sessionStart === null) sessionStart = Date.now();
    const started = sessionStart;
    const update = () => setTick(Math.floor((Date.now() - started) / PITCH_MS));
    update();
    const timer = setInterval(update, 800);
    return () => clearInterval(timer);
  }, [game.status]);

  const cursor =
    game.status === "final"
      ? game.events.length
      : game.status === "upcoming"
        ? 0
        : Math.min(game.liveIndex + tick, game.events.length);

  return useMemo(() => {
    const consumed = game.events.slice(0, cursor);
    const last = cursor > 0 ? game.events[cursor - 1] : null;
    const next = cursor < game.events.length ? game.events[cursor] : null;
    const snap = last ? last.post : (game.events[0]?.pre ?? null);
    const finished =
      game.status === "final" || (game.status === "live" && next === null);
    return {
      cursor,
      consumed,
      last,
      next,
      snap,
      status: finished ? "final" : game.status,
      finished,
    };
  }, [game, cursor]);
}
