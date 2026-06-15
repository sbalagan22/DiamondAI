"use client";

/* DiamondAI — model-status badge. Game data is always real (MLB Stats API); the
   AI predictions are real when the inference server is up. This badge appears
   ONLY when the model server is offline and predictions have fallen back to the
   sim.ts stub — a visible "not the real model" indicator shows exactly when
   that's true, and nothing shows when predictions are real. */
import { useEffect, useState } from "react";

export function MockBadge() {
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const res = await fetch("/api/model-status");
        const data = (await res.json()) as { online?: boolean };
        if (alive) setOnline(!!data.online);
      } catch {
        if (alive) setOnline(false);
      }
    };
    check();
    const timer = setInterval(check, 20_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  // Hidden while loading and whenever the real model is serving.
  if (online !== false) return null;

  return (
    <div className="pointer-events-none fixed bottom-3 left-3 z-40 sm:bottom-4 sm:left-4">
      <span
        className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em] backdrop-blur-md"
        style={{
          borderColor: "rgba(216,178,74,.40)",
          color: "var(--warn)",
          background: "rgba(216,178,74,.10)",
        }}
        title="The inference model server is offline — predictions are a sim.ts fallback stub, not the trained model."
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--warn)" }} />
        Mock predictions · model offline
      </span>
    </div>
  );
}
