import { fetchHistory } from "@/lib/polymarket";

// Server-side proxy: CLOB price-history timeseries for one outcome token.
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return Response.json({ points: [], error: "missing token" }, { status: 400 });
  try {
    const points = await fetchHistory(token);
    return Response.json({ points });
  } catch {
    return Response.json({ points: [], error: "unavailable" });
  }
}
