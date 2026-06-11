/* DiamondAI — standalone game page root: reads ?id, renders pill nav + game */

function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-6xl flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--faint)]">No live game found</div>
      <p className="max-w-sm text-[15px] leading-relaxed text-[var(--muted)]">
        That game isn't on today's slate, or it isn't live yet.
      </p>
      <a
        href={HOME_URL}
        className="rounded-full border border-[var(--glass-border)] bg-[var(--fill)] px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text)] transition-[background-color] hover:bg-[var(--fill-hi)]"
      >
        ← Back to schedule
      </a>
    </main>
  );
}

function GameApp() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  const games = window.GAMES || [];
  const game = games.find((g) => g.id === id && g.status === 'live')
    || games.find((g) => g.status === 'live');

  return (
    <div className="min-h-screen">
      <PillNav mode="game" />
      {game ? <GameView game={game} /> : <NotFound />}
      <footer className="mx-auto max-w-6xl px-4 pb-10 pt-2 sm:px-6">
        <div className="border-t border-[var(--line)] pt-5">
          <p className="max-w-2xl font-mono text-[10.5px] uppercase leading-relaxed tracking-[0.1em] text-[var(--faint)]">
            DiamondAI · visual prototype. The pitch stream, predictions and win probability are a
            simulated ticker on mock data — not a live model.
          </p>
        </div>
      </footer>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<GameApp />);
