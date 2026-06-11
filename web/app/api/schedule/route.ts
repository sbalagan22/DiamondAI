import { mapSchedule, type ScheduleFeed } from "@/lib/mlbAdapter";
import { MLB_BASE, SCHEDULE_REVALIDATE } from "@/lib/mlbConfig";

// Server-side proxy for the public MLB Stats API schedule (avoids browser CORS,
// caches ~15s). Optional ?date=YYYY-MM-DD (defaults to today). Failures degrade
// to an empty slate — never a 5xx to the client.
export async function GET(request: Request) {
  const date = new URL(request.url).searchParams.get("date") ?? undefined;
  const url =
    `${MLB_BASE}/api/v1/schedule?sportId=1&hydrate=team,linescore` +
    (date ? `&date=${encodeURIComponent(date)}` : "");
  try {
    const res = await fetch(url, { next: { revalidate: SCHEDULE_REVALIDATE } });
    if (!res.ok) throw new Error(`schedule ${res.status}`);
    const feed = (await res.json()) as ScheduleFeed;
    return Response.json(mapSchedule(feed));
  } catch {
    return Response.json({ games: [], date: date ?? "" });
  }
}
