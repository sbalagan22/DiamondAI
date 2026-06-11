"use client";

/**
 * Client data layer for the REAL MLB feed.
 *
 * `useSchedule` and `useGameFeed`/`useLiveGame` fetch the server-side route
 * handlers (which proxy + map the public MLB Stats API) and return the existing
 * domain types, so the components render unchanged. Live games poll on the
 * cadence in `mlbConfig`; polling stops once a game is Final and the last good
 * state is retained on a failed fetch.
 */

import { useEffect, useMemo, useState } from "react";
import type { GameResponse, ScheduleResponse } from "@/lib/mlbAdapter";
import { LIVE_GAME_POLL_MS, SCHEDULE_POLL_MS } from "@/lib/mlbConfig";
import type { Game, GameSnapshot, GameStatus, PitchEvent } from "@/lib/types";

export interface LiveGameState {
  /** Number of pitches consumed so far. */
  cursor: number;
  consumed: PitchEvent[];
  last: PitchEvent | null;
  next: PitchEvent | null;
  snap: GameSnapshot | null;
  /** Effective status — a live game that has ended reads as final. */
  status: GameStatus;
  finished: boolean;
}

/** Assemble the view-facing live state from a mapped Game + its pending pitch. */
function deriveLiveState(game: Game, pending: PitchEvent | null): LiveGameState {
  const consumed = game.events;
  const last = consumed.length ? consumed[consumed.length - 1] : null;
  const next = game.status === "live" ? pending : null;
  const snap = next ? next.pre : last ? last.post : (consumed[0]?.pre ?? null);
  return {
    cursor: consumed.length,
    consumed,
    last,
    next,
    snap,
    status: game.status,
    finished: game.status === "final",
  };
}

async function fetchGameFeed(id: string): Promise<GameResponse | null> {
  try {
    const res = await fetch(`/api/game/${id}`);
    if (!res.ok) return null;
    return (await res.json()) as GameResponse;
  } catch {
    return null;
  }
}

/**
 * Schedule-card live state. Same signature as before so the cards are
 * untouched: for a live game it polls the game feed for the rich current state;
 * otherwise it derives directly from the passed Game.
 */
export function useLiveGame(game: Game): LiveGameState {
  const [feed, setFeed] = useState<GameResponse | null>(null);

  useEffect(() => {
    if (game.status !== "live") return;
    let alive = true;
    let timer: ReturnType<typeof setInterval> | null = null;
    const poll = async () => {
      const r = await fetchGameFeed(game.id);
      if (!alive || !r?.game) return; // keep last good state on failure
      setFeed(r);
      if (r.game.status === "final" && timer) {
        clearInterval(timer);
        timer = null;
      }
    };
    poll();
    timer = setInterval(poll, LIVE_GAME_POLL_MS);
    return () => {
      alive = false;
      if (timer) clearInterval(timer);
    };
  }, [game.id, game.status]);

  return useMemo(
    () =>
      game.status === "live" && feed?.game
        ? deriveLiveState(feed.game, feed.pending)
        : deriveLiveState(game, null),
    [feed, game],
  );
}

export interface ScheduleState {
  games: Game[];
  date: string;
  loading: boolean;
  error: boolean;
}

/** Today's real slate, lightly polled so games move Upcoming -> Live -> Final. */
export function useSchedule(): ScheduleState {
  const [state, setState] = useState<ScheduleState>({
    games: [],
    date: "",
    loading: true,
    error: false,
  });

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const res = await fetch("/api/schedule");
        if (!res.ok) throw new Error(`schedule ${res.status}`);
        const data = (await res.json()) as ScheduleResponse;
        if (alive) setState({ games: data.games, date: data.date, loading: false, error: false });
      } catch {
        // Keep the last good slate; only surface an error before any load.
        if (alive) setState((s) => ({ ...s, loading: false, error: s.games.length === 0 }));
      }
    };
    poll();
    const t = setInterval(poll, SCHEDULE_POLL_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  return state;
}

export interface GameFeedState {
  game: Game | null;
  live: LiveGameState | null;
  loading: boolean;
  error: boolean;
}

/** Full game feed for the game page: the mapped Game + derived live state. */
export function useGameFeed(id: string): GameFeedState {
  const [feed, setFeed] = useState<GameResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setInterval> | null = null;
    let gotData = false;
    const poll = async () => {
      const r = await fetchGameFeed(id);
      if (!alive) return;
      if (r?.game) {
        gotData = true;
        setFeed(r);
        setLoading(false);
        setError(false);
        if (r.game.status === "final" && timer) {
          clearInterval(timer);
          timer = null;
        }
      } else {
        setLoading(false);
        if (!gotData) setError(true); // keep last good state once we have one
      }
    };
    poll();
    timer = setInterval(poll, LIVE_GAME_POLL_MS);
    return () => {
      alive = false;
      if (timer) clearInterval(timer);
    };
  }, [id]);

  const live = useMemo(
    () => (feed?.game ? deriveLiveState(feed.game, feed.pending) : null),
    [feed],
  );

  return { game: feed?.game ?? null, live, loading, error };
}
