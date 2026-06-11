"use client";

/* DiamondAI — compact live Polymarket reference. A slim probability ticker:
   logo + a two-way odds bar + a link out to the game's Polymarket page. Shown
   on upcoming/live schedule cards and the game page (never on finals). The bar
   is tinted with each side's team primary color; the trailing side is dimmed so
   the leader still reads at a glance. */
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { cx, pct } from "@/lib/ui";
import type { PolymarketMarket } from "@/lib/polymarket";
import { TEAMS, TEAM_META } from "@/lib/teams";

const REFRESH_MS = 45_000;
type Status = "loading" | "ready" | "empty" | "error";

export function PolymarketTicker({
  teamHint,
  poll = false,
  className = "",
}: {
  teamHint?: string;
  poll?: boolean;
  className?: string;
}) {
  const [status, setStatus] = useState<Status>("loading");
  const [market, setMarket] = useState<PolymarketMarket | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    const load = async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const q = teamHint ? `?team=${encodeURIComponent(teamHint)}` : "";
        const res = await fetch(`/api/polymarket/markets${q}`);
        const data = (await res.json()) as { markets: PolymarketMarket[]; error?: string };
        if (!alive.current) return;
        const m = data.markets?.[0] ?? null;
        setMarket(m);
        setStatus(m ? "ready" : data.error ? "error" : "empty");
      } catch {
        if (alive.current) setStatus("error");
      }
    };
    load();
    const id = poll ? setInterval(load, REFRESH_MS) : undefined;
    return () => {
      alive.current = false;
      if (id) clearInterval(id);
    };
  }, [teamHint, poll]);

  const header = (
    <span className="flex items-center gap-1.5">
      <Image
        src="/logos/polymarket.png"
        alt="Polymarket"
        width={14}
        height={14}
        className="h-3.5 w-3.5 rounded-[3px] object-contain"
      />
      <span className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
        Polymarket
      </span>
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--live)]" />
    </span>
  );

  if (status === "loading") {
    return (
      <div className={cx("motion-safe:animate-pulse", className)}>
        {header}
        <div className="mt-2 h-2 w-full rounded-full bg-[var(--fill)]" />
      </div>
    );
  }

  if (status !== "ready" || !market) {
    return (
      <div className={cx("flex items-center justify-between gap-2", className)}>
        {header}
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--faint)]">
          {status === "error" ? "unavailable" : "no live market"}
        </span>
      </div>
    );
  }

  const aLead = market.priceA >= market.priceB;
  const colorA = teamColor(market.teamA);
  const colorB = teamColor(market.teamB);
  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-2">
        {header}
        <a
          href={market.url}
          target="_blank"
          rel="noopener noreferrer"
          className="pointer-events-auto relative z-[2] inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)] transition-colors hover:text-[var(--text)]"
        >
          Open <span aria-hidden>↗</span>
        </a>
      </div>

      <div
        className="mt-2 flex items-stretch overflow-hidden rounded-full"
        style={{ height: 8, boxShadow: "inset 0 0 0 1px var(--hair-mid)" }}
      >
        <div
          className="transition-[width,opacity] duration-700 ease-out"
          style={{ width: `${Math.max(6, pct(market.priceA))}%`, background: colorA, opacity: aLead ? 1 : 0.4 }}
        />
        <div
          className="transition-[width,opacity] duration-700 ease-out"
          style={{ width: `${Math.max(6, pct(market.priceB))}%`, background: colorB, opacity: aLead ? 0.4 : 1 }}
        />
      </div>
      <div className="mt-1.5 flex items-baseline justify-between font-mono text-[10.5px] tabular-nums">
        <span className={cx(aLead ? "font-semibold text-[var(--text)]" : "text-[var(--muted)]")}>
          {abbrev(market.teamA)} {pct(market.priceA)}%
        </span>
        <span className={cx(aLead ? "text-[var(--muted)]" : "font-semibold text-[var(--text)]")}>
          {pct(market.priceB)}% {abbrev(market.teamB)}
        </span>
      </div>
    </div>
  );
}

// Resolve a Polymarket outcome name ("Boston Red Sox") to that team's primary
// color. Falls back to the neutral muted token if no team matches.
function teamColor(name: string): string {
  const n = name.toLowerCase();
  for (const t of Object.values(TEAMS)) {
    if (n.includes(t.name.toLowerCase())) return TEAM_META[t.id]?.primaryColor ?? "var(--muted)";
  }
  return "var(--muted)";
}

// "Boston Red Sox" -> "Red Sox" (last word, or last two for Sox/Jays/etc).
function abbrev(name: string): string {
  const parts = name.split(" ");
  if (parts.length <= 1) return name;
  const tail = parts[parts.length - 1];
  const multi = ["Sox", "Jays"];
  return multi.includes(tail) ? parts.slice(-2).join(" ") : tail;
}
