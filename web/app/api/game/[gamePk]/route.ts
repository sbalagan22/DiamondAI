import { mapFeed, type GameResponse, type GumboFeed, type ModelPredictions } from "@/lib/mlbAdapter";
import { GAME_REVALIDATE, INFERENCE_URL, MLB_BASE } from "@/lib/mlbConfig";

// Ask the inference server for the real model predictions. Times out fast and
// returns null on any failure so a slow/offline model never blocks the game.
async function fetchPredictions(gamePk: string): Promise<ModelPredictions | null> {
  try {
    const res = await fetch(`${INFERENCE_URL}/predict/${encodeURIComponent(gamePk)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as ModelPredictions & { error?: string };
    return data && !data.error && Array.isArray(data.perPitch) ? data : null;
  } catch {
    return null;
  }
}

// Server-side proxy for one game's live GUMBO feed (avoids CORS, caches ~10s) +
// the real model predictions. Returns the mapped Game + pending pitch. On GUMBO
// failure returns { game: null } at HTTP 200 so the client keeps last good state;
// on inference failure the predictions fall back to the sim.ts stub.
export async function GET(_req: Request, ctx: { params: Promise<{ gamePk: string }> }) {
  const { gamePk } = await ctx.params;
  const url = `${MLB_BASE}/api/v1.1/game/${encodeURIComponent(gamePk)}/feed/live`;
  try {
    const [res, predictions] = await Promise.all([
      fetch(url, { next: { revalidate: GAME_REVALIDATE } }),
      fetchPredictions(gamePk),
    ]);
    if (!res.ok) throw new Error(`game ${res.status}`);
    const feed = (await res.json()) as GumboFeed;
    return Response.json(mapFeed(feed, predictions));
  } catch {
    const fallback: GameResponse = {
      game: null,
      pending: null,
      predictionsReal: false,
      error: "unavailable",
    };
    return Response.json(fallback);
  }
}
