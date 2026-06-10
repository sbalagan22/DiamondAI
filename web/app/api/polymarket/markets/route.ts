import { fetchMlbMarkets } from "@/lib/polymarket";

// Server-side proxy: live MLB moneyline markets from Polymarket's public Gamma
// API (avoids browser CORS, caches ~30s). Failures degrade to an empty list —
// never a 5xx to the client.
export async function GET(request: Request) {
  const team = new URL(request.url).searchParams.get("team") ?? undefined;
  try {
    const markets = await fetchMlbMarkets(team);
    return Response.json({ markets });
  } catch {
    return Response.json({ markets: [], error: "unavailable" });
  }
}
