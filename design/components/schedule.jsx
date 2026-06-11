/* DiamondAI — Schedule (home) screen */

const bucketOutcome = (s) => {
  const t = s.toLowerCase();
  if (t.includes('in play')) return 'inplay';
  if (t.includes('foul')) return 'foul';
  if (t.includes('ball')) return 'ball';
  if (t.includes('strike')) return 'strike';
  return t;
};

// Win-probability "tug of war" — favored side white, underdog faint
function LeanBar({ homeWinProb, away, home }) {
  const homeP = pct(homeWinProb);
  const awayP = 100 - homeP;
  const homeFav = homeP >= awayP;
  return (
    <div className="flex items-center gap-3">
      <span className="w-11 whitespace-nowrap font-mono text-[11px] tabular-nums text-[var(--muted)]">
        <span className="text-[var(--faint)]">{away.abbr}</span> {awayP}
      </span>
      <div className="relative flex h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--track)]">
        <div className="h-full" style={{ width: `${awayP}%`, background: homeFav ? 'var(--hair-mid)' : 'var(--model)' }} />
        <div className="h-full" style={{ width: `${homeP}%`, background: homeFav ? 'var(--model)' : 'var(--hair-mid)' }} />
        <span className="absolute left-1/2 top-1/2 h-[9px] w-px -translate-x-1/2 -translate-y-1/2 bg-[var(--hair-strong)]" />
      </div>
      <span className="w-11 whitespace-nowrap text-right font-mono text-[11px] tabular-nums text-[var(--muted)]">
        {homeP} <span className="text-[var(--faint)]">{home.abbr}</span>
      </span>
    </div>
  );
}

function TeamRow({ team, score, show, lead, dim }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Monogram team={team} size="md" />
        <div className="min-w-0 flex-1 leading-tight">
          <div className={cx('truncate text-[16px] font-semibold tracking-[-0.01em]', dim ? 'text-[var(--muted)]' : 'text-[var(--text)]')}>{team.name}</div>
          <div className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--faint)]">{team.city}</div>
        </div>
      </div>
      {show && (
        <div className="flex items-center gap-2.5">
          {lead && <span className="h-1.5 w-1.5 rounded-full bg-[var(--text)]" aria-label="leading" />}
          <span className={cx('shrink-0 font-mono text-[30px] font-semibold leading-none tabular-nums tracking-[-0.03em]', dim ? 'text-[var(--faint)]' : 'text-[var(--text)]')}>{score}</span>
        </div>
      )}
    </div>
  );
}

function GameCard({ game }) {
  const live = game.status === 'live';
  const final = game.status === 'final';
  const showScore = live || final;
  const leadAway = showScore && game.awayScore > game.homeScore;
  const leadHome = showScore && game.homeScore > game.awayScore;

  const inner = (
    <>
      {/* top band */}
      <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-5 py-3.5">
        <div className="flex shrink-0 items-center gap-2.5">
          <StatusTag game={game} />
          {live && <span className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">{game.half === 'top' ? 'Top' : 'Bot'} {game.inning}</span>}
        </div>
        <span className="min-w-0 truncate font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--faint)]">{game.venue}</span>
      </div>

      {/* teams */}
      <div className="flex flex-col gap-4 px-5 py-5">
        <TeamRow team={game.away} score={game.awayScore} show={showScore} lead={leadAway} dim={final && leadHome} />
        <TeamRow team={game.home} score={game.homeScore} show={showScore} lead={leadHome} dim={final && leadAway} />
      </div>

      {/* footer */}
      {live && (
        <div className="border-t border-[var(--line)] px-5 py-4">
          <div className="mb-2.5 flex items-center justify-between">
            <Eyebrow>Win probability</Eyebrow>
            <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--model)] opacity-0 transition-opacity duration-200 group-hover:opacity-100">Watch live →</span>
          </div>
          <LeanBar homeWinProb={game.homeWinProb} away={game.away} home={game.home} />
        </div>
      )}
      {game.status === 'pre' && (
        <div className="flex items-center justify-between border-t border-[var(--line)] px-5 py-4">
          <div className="flex flex-col gap-0.5">
            <Eyebrow>First pitch</Eyebrow>
            <span className="font-mono text-[13px] tabular-nums text-[var(--text)]">{game.startLabel}</span>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <Eyebrow>Model lean</Eyebrow>
            <span className="whitespace-nowrap font-mono text-[13px] tabular-nums text-[var(--muted)]">
              {pct(game.homeWinProb) >= 50 ? game.home.abbr : game.away.abbr} {Math.max(pct(game.homeWinProb), 100 - pct(game.homeWinProb))}%
            </span>
          </div>
        </div>
      )}
      {final && (
        <div className="flex items-center justify-between border-t border-[var(--line)] px-5 py-4">
          <Eyebrow>Result</Eyebrow>
          <span className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
            {(game.homeScore > game.awayScore ? game.home : game.away).abbr} win · {Math.max(game.homeScore, game.awayScore)}–{Math.min(game.homeScore, game.awayScore)}
          </span>
        </div>
      )}
    </>
  );

  if (live) {
    return (
      <a
        href={gameUrl(game.id)}
        aria-label={`Open live game: ${game.away.name} at ${game.home.name}`}
        className="group glass-panel glass-hover flex flex-col overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--model)]"
      >
        {inner}
      </a>
    );
  }
  return <div className="glass-panel flex flex-col overflow-hidden opacity-[0.92]">{inner}</div>;
}

// ---- Featured live spotlight ----------------------------------------------
function MiniCall({ p }) {
  const typeHit = p.predicted.pitchType === p.actual.pitchType;
  const outcomeHit = bucketOutcome(p.predicted.outcome) === bucketOutcome(p.actual.outcome);
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="w-6 shrink-0 font-mono text-[11px] tabular-nums text-[var(--faint)]">{String(p.seq).padStart(2, '0')}</span>
      <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--muted)]">
        <span className="text-[var(--faint)]">pred</span> {p.predicted.pitchType}
        <span className="px-1.5 text-[var(--faint)]">→</span>
        <span className="font-medium text-[var(--text)]">{p.actual.pitchType}</span>
      </span>
      <span className="flex shrink-0 gap-1.5">
        <span className="h-2 w-2 rounded-full" style={{ background: typeHit ? 'var(--model)' : 'var(--live)' }} title={`Pitch type — ${typeHit ? 'hit' : 'miss'}`} />
        <span className="h-2 w-2 rounded-full" style={{ background: outcomeHit ? 'var(--model)' : 'var(--live)' }} title={`Outcome — ${outcomeHit ? 'hit' : 'miss'}`} />
      </span>
    </div>
  );
}

function Spotlight({ game }) {
  const calls = [...window.PITCHES].slice(-3).reverse();
  const snap = { count: { balls: 2, strikes: 2 }, outs: 1, bases: { first: true, second: false, third: false } };
  const homeFav = game.homeWinProb >= 0.5;
  const fav = homeFav ? game.home : game.away;
  const favP = pct(homeFav ? game.homeWinProb : 1 - game.homeWinProb);

  return (
    <a
      href={gameUrl(game.id)}
      aria-label={`Open featured live game: ${game.away.name} at ${game.home.name}`}
      className="group glass-panel glass-hover mb-12 block overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--model)]"
    >
      <div className="accent-rule" />
      <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-5 py-3.5 sm:px-7">
        <div className="flex items-center gap-2.5">
          <StatusTag game={game} />
          <span className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">Featured · {game.half === 'top' ? 'Top' : 'Bot'} {game.inning}</span>
        </div>
        <span className="hidden whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--faint)] sm:inline">{game.venue}</span>
      </div>

      <div className="grid gap-px bg-[var(--line)] lg:grid-cols-[1.15fr_1fr]">
        {/* left — the game */}
        <div className="bg-transparent px-5 py-6 sm:px-7">
          <div className="flex flex-col gap-5">
            <TeamRow team={game.away} score={game.awayScore} show lead={game.awayScore > game.homeScore} />
            <TeamRow team={game.home} score={game.homeScore} show lead={game.homeScore > game.awayScore} />
          </div>
          <div className="mt-6 flex items-center gap-7 border-t border-[var(--line)] pt-5">
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-[24px] font-semibold leading-none tabular-nums tracking-[-0.02em] text-[var(--text)]">{snap.count.balls}</span>
              <span className="text-[var(--faint)]">–</span>
              <span className="font-mono text-[24px] font-semibold leading-none tabular-nums tracking-[-0.02em] text-[var(--text)]">{snap.count.strikes}</span>
              <span className="ml-1.5 font-mono text-[9.5px] uppercase tracking-[0.16em] text-[var(--faint)]">count</span>
            </div>
            <CountPips count={snap.count} outs={snap.outs} />
            <Bases bases={snap.bases} />
          </div>
        </div>

        {/* right — the model */}
        <div className="bg-transparent px-5 py-6 sm:px-7">
          <div className="flex items-end justify-between">
            <div>
              <Eyebrow tone="model" className="mb-2">Model · win prob</Eyebrow>
              <div className="flex items-center gap-2.5">
                <Monogram team={fav} size="sm" />
                <span className="font-mono text-[2.6rem] font-semibold leading-[0.85] tabular-nums tracking-[-0.03em] text-[var(--text)]">{favP}<span className="text-xl text-[var(--muted)]">%</span></span>
              </div>
            </div>
            <span className="mb-1 whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--faint)]">{fav.abbr} favored</span>
          </div>
          <div className="mt-4">
            <LeanBar homeWinProb={game.homeWinProb} away={game.away} home={game.home} />
          </div>

          <div className="mt-5 border-t border-[var(--line)] pt-3">
            <div className="mb-1 flex items-center justify-between">
              <Eyebrow>Latest calls</Eyebrow>
              <span className="flex items-center gap-2.5 font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--faint)]">
                <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--model)' }} />hit</span>
                <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--live)' }} />miss</span>
              </span>
            </div>
            <div className="divide-y divide-[var(--line)]">
              {calls.map((p) => <MiniCall key={p.seq} p={p} />)}
            </div>
          </div>

          <div className="mt-5 flex items-center justify-center gap-2 whitespace-nowrap rounded-full border border-[var(--glass-border)] bg-[var(--fill)] py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text)] transition-[background-color,border-color] group-hover:border-[var(--glass-border-hi)] group-hover:bg-[var(--fill-hi)]">
            Open live game <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </div>
        </div>
      </div>
    </a>
  );
}

function StatCell({ label, value, accent }) {
  return (
    <div className="flex-1 px-5 py-3.5">
      <div className="font-mono text-[22px] font-semibold leading-none tabular-nums tracking-[-0.02em]" style={{ color: accent || 'var(--text)' }}>{value}</div>
      <div className="mt-1.5 whitespace-nowrap font-mono text-[9.5px] uppercase tracking-[0.14em] text-[var(--faint)]">{label}</div>
    </div>
  );
}

function ScheduleSection({ label, count, children }) {
  return (
    <section className="mb-11">
      <div className="mb-4 flex items-center gap-3">
        <Eyebrow tone="text">{label}</Eyebrow>
        <span className="font-mono text-[11px] tabular-nums text-[var(--faint)]">{String(count).padStart(2, '0')}</span>
        <div className="h-px flex-1 bg-[var(--line)]" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}

function Schedule() {
  const games = window.GAMES;
  const live = games.filter((g) => g.status === 'live');
  const pre = games.filter((g) => g.status === 'pre');
  const finals = games.filter((g) => g.status === 'final');
  const featured = live[0];
  const restLive = featured ? live.slice(1) : live;

  return (
    <main className="mx-auto max-w-6xl px-4 pb-20 pt-7 sm:px-6 sm:pt-9">
      <header className="mb-10 flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Eyebrow tone="muted" className="mb-3">Mon · June 9 · 2026</Eyebrow>
          <h1 className="font-display text-[2.6rem] font-bold leading-[0.95] tracking-tight text-[var(--text)] sm:text-[3.4rem]">
            Today's slate
          </h1>
          <div className="accent-rule mt-5 w-20" />
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[var(--muted)]">
            The model reads every pitch in real time. Open a live game to watch its call
            land — or miss — against what actually happens.
          </p>
        </div>
        <div className="glass-panel flex w-full divide-x divide-[var(--line)] lg:w-auto">
          <StatCell label="Live now" value={live.length} accent="var(--live)" />
          <StatCell label="Model acc · today" value="73%" accent="var(--model)" />
          <StatCell label="Pitches scored" value="2,481" />
        </div>
      </header>

      {featured && <Spotlight game={featured} />}

      {restLive.length > 0 && (
        <ScheduleSection label="More live" count={restLive.length}>
          {restLive.map((g) => <GameCard key={g.id} game={g} />)}
        </ScheduleSection>
      )}
      {pre.length > 0 && (
        <ScheduleSection label="Upcoming" count={pre.length}>
          {pre.map((g) => <GameCard key={g.id} game={g} />)}
        </ScheduleSection>
      )}
      {finals.length > 0 && (
        <ScheduleSection label="Final" count={finals.length}>
          {finals.map((g) => <GameCard key={g.id} game={g} />)}
        </ScheduleSection>
      )}

      {games.length === 0 && (
        <div className="glass-panel py-16 text-center font-mono text-sm uppercase tracking-[0.16em] text-[var(--faint)]">
          No games scheduled
        </div>
      )}
    </main>
  );
}

Object.assign(window, { Schedule, GameCard });
