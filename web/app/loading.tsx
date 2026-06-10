export default function ScheduleLoading() {
  return (
    <main className="mx-auto max-w-6xl px-4 pb-20 pt-4 sm:px-6">
      <div className="motion-safe:animate-pulse">
        <div className="mb-12 flex flex-col items-center py-10 sm:py-14">
          <div className="h-3 w-40 rounded-[var(--r-chip)] bg-[var(--fill)]" />
          <div className="mt-5 h-12 w-80 rounded-[var(--r-chip)] bg-[var(--fill)]" />
          <div className="mt-5 h-3 w-64 rounded-[var(--r-chip)] bg-[var(--fill)]" />
          <div className="mt-8 h-16 w-72 rounded-[var(--r-card)] bg-[var(--fill)]" />
        </div>
        <div className="surface mb-12 h-64" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="surface h-56" />
          ))}
        </div>
      </div>
      <p className="sr-only">Loading schedule…</p>
    </main>
  );
}
