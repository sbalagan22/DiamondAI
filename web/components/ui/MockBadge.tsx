/* DiamondAI — persistent "mock data" indicator. Required this phase (no live
   feeds/model yet); kept tiny and out of the way in the bottom-left corner so
   the nav can stay short. */
export function MockBadge() {
  return (
    <div className="pointer-events-none fixed bottom-3 left-3 z-40 sm:bottom-4 sm:left-4">
      <span
        className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em] backdrop-blur-md"
        style={{
          borderColor: "rgba(216,178,74,.40)",
          color: "var(--warn)",
          background: "rgba(216,178,74,.10)",
        }}
        title="This build runs on mock data and a simulated ticker — no live feeds or model calls yet."
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--warn)" }} />
        Mock data
      </span>
    </div>
  );
}
