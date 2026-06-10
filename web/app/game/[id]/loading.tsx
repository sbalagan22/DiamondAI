export default function GameLoading() {
  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-5 sm:px-6 sm:pt-6">
      <div className="motion-safe:animate-pulse">
        <div className="glass-panel h-32" />
        <div className="mt-5 grid gap-5 lg:grid-cols-[1.55fr_1fr]">
          <div className="flex flex-col gap-5">
            <div className="glass-panel h-80" />
            <div className="glass-panel h-36" />
          </div>
          <div className="flex flex-col gap-5">
            <div className="glass-panel h-64" />
            <div className="glass-panel h-56" />
          </div>
        </div>
        <div className="glass-panel mt-5 h-64" />
      </div>
      <p className="sr-only">Loading game…</p>
    </main>
  );
}
