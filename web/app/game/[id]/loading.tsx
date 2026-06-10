export default function GameLoading() {
  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-4 sm:px-6">
      <div className="motion-safe:animate-pulse">
        <div className="surface h-32" />
        <div className="mt-4 grid gap-4 lg:grid-cols-[1.55fr_1fr]">
          <div className="flex flex-col gap-4">
            <div className="surface h-80" />
            <div className="surface h-36" />
          </div>
          <div className="flex flex-col gap-4">
            <div className="surface h-64" />
            <div className="surface h-56" />
          </div>
        </div>
        <div className="surface mt-4 h-64" />
      </div>
      <p className="sr-only">Loading game…</p>
    </main>
  );
}
