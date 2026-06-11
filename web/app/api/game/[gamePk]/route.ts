import { mapFeed, type GameResponse, type GumboFeed } from "@/lib/mlbAdapter";
import { GAME_REVALIDATE, MLB_BASE } from "@/lib/mlbConfig";

// Server-side proxy for one game's live GUMBO feed (avoids CORS, caches ~10s).
// Returns the mapped Game + the pending (next, not-yet-thrown) pitch. Failures
// return { game: null } at HTTP 200 so the client keeps its last good state.
export async function GET(_req: Request, ctx: { params: Promise<{ gamePk: string }> }) {
  const { gamePk } = await ctx.params;
  const url = `${MLB_BASE}/api/v1.1/game/${encodeURIComponent(gamePk)}/feed/live`;
  try {
    const res = await fetch(url, { next: { revalidate: GAME_REVALIDATE } });
    if (!res.ok) throw new Error(`game ${res.status}`);
    const feed = (await res.json()) as GumboFeed;
    return Response.json(mapFeed(feed));
  } catch {
    const fallback: GameResponse = { game: null, pending: null, error: "unavailable" };
    return Response.json(fallback);
  }
}
