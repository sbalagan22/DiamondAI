"use client";

/* DiamondAI — animated aurora at the top of the landing page. Reads the MLB
   red/white (white|black-by-mode) `--aurora-*` tokens and re-keys on a theme
   switch. Absolutely positioned at the top, full-bleed, fading out downward —
   it scrolls away with the page (no fixed-scroll artifacts). */
import { useSyncExternalStore } from "react";
import { Aurora } from "./Aurora";

function readStops(): [string, string, string] {
  const s = getComputedStyle(document.documentElement);
  const g = (n: string, f: string) => s.getPropertyValue(n).trim() || f;
  return [g("--aurora-1", "#ff4b51"), g("--aurora-2", "#ffffff"), g("--aurora-3", "#ff2d4a")];
}

let cache: [string, string, string] | null = null;
let cacheKey = "";
function getSnapshot(): [string, string, string] {
  const key = document.documentElement.getAttribute("data-theme") || "dark";
  if (!cache || key !== cacheKey) {
    cacheKey = key;
    cache = readStops();
  }
  return cache;
}
function getServerSnapshot(): null {
  return null;
}
function subscribe(onChange: () => void): () => void {
  const obs = new MutationObserver(onChange);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => obs.disconnect();
}

export function LandingAurora() {
  const stops = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[540px] overflow-hidden sm:h-[720px]"
      style={{
        maskImage: "linear-gradient(to bottom, black 0%, black 46%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 46%, transparent 100%)",
      }}
    >
      {stops && (
        <Aurora key={stops.join("|")} colorStops={stops} amplitude={1.1} blend={0.5} speed={0.6} />
      )}
    </div>
  );
}
