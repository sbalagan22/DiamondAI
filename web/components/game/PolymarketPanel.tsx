"use client";

/* DiamondAI — live Polymarket MLB reference (the one real data source).
   Polls the server proxy for a live MLB moneyline market + its price history,
   shown beside the model's win-prob so users can compare model vs market.
   Our games are fictional, so this is an honest live *reference*, not 1:1. */
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Eyebrow, Panel, WinProbChart } from "@/components/ui/primitives";
import { pct } from "@/lib/ui";
import type { PolymarketMarket, PricePoint } from "@/lib/polymarket";

const REFRESH_MS = 40_000;
type Status = "loading" | "ready" | "empty" | "error";

export function PolymarketPanel({ teamHint }: { teamHint?: string }) {
  const [status, setStatus] = useState<Status>("loading");
  const [market, setMarket] = useState<PolymarketMarket | null>(null);
  const [points, setPoints] = useState<PricePoint[]>([]);
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
        if (!m) {
          setStatus(data.error ? "error" : "empty");
          setMarket(null);
          return;
        }
        setMarket(m);
        setStatus("ready");
        const hres = await fetch(`/api/polymarket/history?token=${encodeURIComponent(m.tokenA)}`);
        const hdata = (await hres.json()) as { points: PricePoint[] };
        if (!alive.current) return;
        setPoints(hdata.points ?? []);
      } catch {
        if (alive.current) setStatus("error");
      }
    };
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      alive.current = false;
      clearInterval(id);
    };
  }, [teamHint]);

  return (
    <Panel>
      <header className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3 sm:px-5">
        <span className="flex items-center gap-2">
          <Image
            src="/logos/polymarket.png"
            alt="Polymarket"
            width={16}
            height={16}
            className="h-4 w-4 rounded-[3px] object-contain"
          />
          <Eyebrow tone="text">Polymarket</Eyebrow>
        </span>
        <span className="flex items-center gap-1.5 whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--faint)]">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--live)]" />
          live · reference
        </span>
      </header>

      <div className="px-5 py-5">
        {status === "loading" && (
          <div className="motion-safe:animate-pulse">
            <div className="h-3 w-2/3 rounded-[var(--r-chip)] bg-[var(--fill)]" />
            <div className="mt-4 h-[26px] w-full rounded-full bg-[var(--fill)]" />
            <div className="mt-5 h-12 w-full rounded-[var(--r-chip)] bg-[var(--fill)]" />
          </div>
        )}

        {status === "empty" && (
          <p className="py-6 text-center font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">
            No live MLB markets right now
          </p>
        )}

        {status === "error" && (
          <p className="py-6 text-center font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">
            Polymarket unavailable
          </p>
        )}

        {status === "ready" && market && (
          <>
            <div className="mb-3 truncate text-[13px] font-semibold text-[var(--text)]" title={market.question}>
              {market.question}
            </div>

            <div
              className="flex items-stretch overflow-hidden rounded-full"
              style={{ height: 26, boxShadow: "inset 0 0 0 1px var(--hair-mid)" }}
            >
              <div
                className="flex items-center pl-3 transition-[width] duration-700 ease-out"
                style={{
                  width: `${Math.max(8, Math.round(market.priceA * 100))}%`,
                  background: "linear-gradient(90deg, var(--model), color-mix(in srgb, var(--model) 70%, transparent))",
                }}
              >
                <span className="truncate font-mono text-[10px] font-bold tracking-wide text-white drop-shadow-sm">
                  {abbrev(market.teamA)}
                </span>
              </div>
              <div
                className="flex items-center justify-end pr-3 transition-[width] duration-700 ease-out"
                style={{ width: `${Math.max(8, Math.round(market.priceB * 100))}%`, background: "var(--fill-hi)" }}
              >
                <span className="truncate font-mono text-[10px] font-bold tracking-wide text-[var(--muted)]">
                  {abbrev(market.teamB)}
                </span>
              </div>
            </div>
            <div className="mt-2 flex items-baseline justify-between font-mono tabular-nums">
              <span className="text-[14px] font-semibold text-[var(--text)]">
                {pct(market.priceA)}
                <span className="text-[10px] text-[var(--faint)]">%</span>
              </span>
              <span className="text-[9.5px] uppercase tracking-[0.16em] text-[var(--faint)]">market odds</span>
              <span className="text-[14px] font-semibold text-[var(--text)]">
                {pct(market.priceB)}
                <span className="text-[10px] text-[var(--faint)]">%</span>
              </span>
            </div>

            {points.length > 1 && (
              <div className="mt-5 h-12">
                <WinProbChart series={points.map((p) => p.p)} />
              </div>
            )}
            <p className="mt-3 text-[11px] leading-relaxed text-[var(--faint)]">
              A live Polymarket market — compare its odds against the model&rsquo;s call.
            </p>
          </>
        )}
      </div>
    </Panel>
  );
}

// "Boston Red Sox" -> "BOS RED SOX"-ish short label for the bar.
function abbrev(name: string): string {
  return name.length > 14 ? name.split(" ").slice(-2).join(" ") : name;
}
