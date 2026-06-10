/**
 * Polymarket — the one REAL data source in the app (everything else is mock).
 * Public Gamma + CLOB endpoints, called server-side from `app/api/polymarket/*`
 * to avoid CORS and to cache. Defensive parsing: upstream shape can drift.
 */

const GAMMA = "https://gamma-api.polymarket.com";
const CLOB = "https://clob.polymarket.com";
const MLB_TAG_ID = "100381"; // gamma tag id for MLB

export interface PolymarketMarket {
  id: string;
  question: string;
  /** outcome[0] — listed first ("A vs. B" -> A, the away side). */
  teamA: string;
  teamB: string;
  priceA: number; // 0..1
  priceB: number; // 0..1
  tokenA: string;
  tokenB: string;
  endDate: string | null;
  /** Public polymarket.com page for this market/event. */
  url: string;
}

export interface PricePoint {
  t: number; // unix seconds
  p: number; // 0..1
}

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

const NON_TEAM = new Set(["over", "under", "yes", "no", "tie", "draw"]);

/** Map a raw Gamma market to our shape; returns null if it isn't a 2-way
 *  team moneyline (we skip O/U totals, props, and Yes/No futures). */
export function normalizeMarket(raw: Record<string, unknown>): PolymarketMarket | null {
  const outcomes = parseJsonArray(raw.outcomes);
  const prices = parseJsonArray(raw.outcomePrices).map(Number);
  const tokens = parseJsonArray(raw.clobTokenIds);
  const question = String(raw.question ?? "");
  if (outcomes.length !== 2 || prices.length !== 2 || tokens.length !== 2) return null;
  if (NON_TEAM.has(outcomes[0].toLowerCase()) || NON_TEAM.has(outcomes[1].toLowerCase())) return null;
  if (/\bO\/U\b|over\/under|total runs/i.test(question)) return null;
  if (!Number.isFinite(prices[0]) || !Number.isFinite(prices[1])) return null;

  // Build the public page URL — prefer the parent event slug, fall back to the
  // market slug, then a safe default.
  const marketSlug = String(raw.slug ?? "");
  let eventSlug = "";
  const events = raw.events;
  if (Array.isArray(events) && events.length && typeof events[0] === "object" && events[0] !== null) {
    eventSlug = String((events[0] as Record<string, unknown>).slug ?? "");
  }
  const slug = eventSlug || marketSlug;
  const url = slug ? `https://polymarket.com/event/${slug}` : "https://polymarket.com/markets";

  return {
    id: String(raw.id ?? raw.conditionId ?? question),
    question,
    teamA: outcomes[0],
    teamB: outcomes[1],
    priceA: prices[0],
    priceB: prices[1],
    tokenA: tokens[0],
    tokenB: tokens[1],
    endDate: (raw.endDateIso as string) ?? (raw.endDate as string) ?? null,
    url,
  };
}

/** Live MLB moneyline markets, newest/most-liquid first. If `team` is given,
 *  markets featuring that team name are floated to the top. */
export async function fetchMlbMarkets(team?: string): Promise<PolymarketMarket[]> {
  const url =
    `${GAMMA}/markets?tag_id=${MLB_TAG_ID}&active=true&closed=false` +
    `&limit=40&order=volume24hr&ascending=false`;
  const res = await fetch(url, { next: { revalidate: 30 } });
  if (!res.ok) throw new Error(`gamma ${res.status}`);
  const raw = (await res.json()) as Record<string, unknown>[];
  const markets = raw
    .map(normalizeMarket)
    .filter((m): m is PolymarketMarket => m !== null);
  if (team) {
    const t = team.toLowerCase();
    markets.sort((a, b) => {
      const am = a.teamA.toLowerCase().includes(t) || a.teamB.toLowerCase().includes(t) ? 0 : 1;
      const bm = b.teamA.toLowerCase().includes(t) || b.teamB.toLowerCase().includes(t) ? 0 : 1;
      return am - bm;
    });
  }
  return markets;
}

/** Price history (0..1) for a CLOB outcome token. */
export async function fetchHistory(token: string): Promise<PricePoint[]> {
  const url = `${CLOB}/prices-history?market=${encodeURIComponent(token)}&interval=1w&fidelity=60`;
  const res = await fetch(url, { next: { revalidate: 30 } });
  if (!res.ok) throw new Error(`clob ${res.status}`);
  const data = (await res.json()) as { history?: { t: number; p: number }[] };
  const history = Array.isArray(data.history) ? data.history : [];
  return history
    .filter((pt) => Number.isFinite(pt.t) && Number.isFinite(pt.p))
    .map((pt) => ({ t: pt.t, p: pt.p }));
}
