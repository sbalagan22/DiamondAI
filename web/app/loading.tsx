export default function ScheduleLoading() {
  return (
    <main className="mx-auto max-w-6xl px-4 pb-20 pt-7 sm:px-6 sm:pt-9">
      <div className="motion-safe:animate-pulse">
        <div className="mb-10">
          <div className="h-3 w-40 rounded-[var(--r-chip)] bg-[var(--fill)]" />
          <div className="mt-4 h-12 w-72 rounded-[var(--r-chip)] bg-[var(--fill)]" />
        </div>
        <div className="glass-panel mb-12 h-64" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="glass-panel h-56" />
          ))}
        </div>
      </div>
      <p className="sr-only">Loading schedule…</p>
    </main>
  );
}
