"use client";

/* DiamondAI — site-wide aurora backdrop. Mounts the WebGL `Aurora` fixed behind
   all content, reading the MLB red/blue `--aurora-*` tokens and re-keying it on
   a theme switch so the colors track dark/light. Sits above the CSS fallback
   wash (body::before, z -2) and below page content.

   Theme colors are read via useSyncExternalStore (client-only, subscribed to
   the <html data-theme> attribute) — no SSR canvas, no setState-in-effect. */
import { useSyncExternalStore } from "react";
import { Aurora } from "./Aurora";

function readStops(): [string, string, string] {
  const s = getComputedStyle(document.documentElement);
  const g = (n: string, f: string) => s.getPropertyValue(n).trim() || f;
  return [g("--aurora-1", "#ff4b51"), g("--aurora-2", "#4d8bff"), g("--aurora-3", "#ff3b62")];
}

// Cache the snapshot, keyed by theme, so useSyncExternalStore gets a stable
// reference between unrelated renders (a fresh array each call would loop).
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

export function Backdrop() {
  const stops = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 overflow-hidden"
      style={{ zIndex: -1 }}
    >
      {stops && (
        <div className="absolute inset-x-0 -top-[10%] h-[90%] opacity-90">
          <Aurora key={stops.join("|")} colorStops={stops} amplitude={1.05} blend={0.6} speed={0.4} />
        </div>
      )}
    </div>
  );
}
