/* DiamondAI — Live Game view (instrument/editorial language) */

const PREDICT_MS = 3400;
const REVEAL_MS = 2800;

const outcomeBucket = (s) => {
  const t = s.toLowerCase();
  if (t.includes('in play')) return 'inplay';
  if (t.includes('foul')) return 'foul';
  if (t.includes('ball')) return 'ball';
  if (t.includes('strike')) return 'strike';
  return t;
};

// ---- Scoreboard (frosted panel, flush at top of the game) ------------------
function Scoreboard({ game, pitch, phase, paused, onTogglePause }) {
  const count = phase === 'revealed' ? pitch.countAfter : pitch.countBefore;
  return (
    <Panel className="overflow-hidden">
      <div className="accent-rule" />
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-6">
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-2.5">
            <Monogram team={game.away} size="md" />
            <span className="font-mono text-[32px] font-semibold leading-none tabular-nums tracking-[-0.03em] text-[var(--text)]">{game.awayScore}</span>
          </div>
          <span className="text-[var(--faint)]">–</span>
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-[32px] font-semibold leading-none tabular-nums tracking-[-0.03em] text-[var(--text)]">{game.homeScore}</span>
            <Monogram team={game.home} size="md" />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2.5 sm:gap-3">
          <StatusTag game={game} />
          <span className="whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
            {game.half === 'top' ? 'Top' : 'Bot'} {game.inning}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--line)] px-5 py-4 sm:px-6">
        <div className="flex items-center gap-6 sm:gap-8">
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-[26px] font-semibold leading-none tabular-nums tracking-[-0.02em] text-[var(--text)]">{count.balls}</span>
            <span className="text-[var(--faint)]">–</span>
            <span className="font-mono text-[26px] font-semibold leading-none tabular-nums tracking-[-0.02em] text-[var(--text)]">{count.strikes}</span>
            <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--faint)]">count</span>
          </div>
          <CountPips count={count} outs={pitch.outs} />
          <Bases bases={pitch.bases} />
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--faint)] sm:inline">{game.venue}</span>
          <button
            type="button"
            onClick={onTogglePause}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--glass-border)] bg-[var(--fill)] px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)] transition-colors hover:border-[var(--glass-border-hi)] hover:text-[var(--text)] focus:outline-none focus-visible:border-[var(--glass-border-hi)]"
            aria-pressed={paused}
          >
            {paused ? '▶ Resume' : '❚❚ Pause'}
          </button>
        </div>
      </div>
    </Panel>
  );
}

function CallColumn({ label, tone, children, className = '' }) {
  return (
    <div className={cx('flex flex-col gap-2', className)}>
      <Eyebrow tone={tone}>{label}</Eyebrow>
      {children}
    </div>
  );
}

// ---- The next-pitch prediction hero ----------------------------------------
function PredictionHero({ pitch, phase, batter }) {
  const revealed = phase === 'revealed';
  const p = pitch.predicted;
  const a = pitch.actual;
  const typeHit = p.pitchType === a.pitchType;
  const outcomeHit = outcomeBucket(p.outcome) === outcomeBucket(a.outcome);

  return (
    <Panel className="overflow-hidden">
      <PanelHead
        label="The next pitch"
        tone="text"
        right={revealed
          ? <span className="text-[var(--muted)]">Resolved</span>
          : <span className="flex items-center gap-1.5 text-[var(--model)]"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--model)]" />Predicting</span>}
      />
      <div className="border-b border-[var(--line)] px-5 py-3 text-[13px] text-[var(--muted)]">
        Now facing <span className="font-semibold text-[var(--text)]">{batter.name}</span> · bats {batter.hand === 'R' ? 'right' : 'left'}
      </div>

      <div className="grid gap-6 px-5 py-8 sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-0">
        {/* PREDICTED */}
        <CallColumn label="Model predicts" tone="model" className="sm:pr-8">
          <div className="font-display text-[2.3rem] font-bold leading-none tracking-tight text-[var(--text)] sm:text-[2.8rem]">{p.pitchType}</div>
          <div className="mt-1 text-sm text-[var(--muted)]">{p.zone.label}</div>
          <div className="mt-2.5 text-sm text-[var(--muted)]">
            Likely <span className="font-semibold text-[var(--text)]">{p.outcome}</span>
          </div>
          <div className="mt-5 max-w-[16rem]">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--faint)]">Confidence</div>
            <Confidence value={p.confidence} />
          </div>
        </CallColumn>

        {/* STRIKE ZONE */}
        <div className="flex flex-col items-center gap-3 justify-self-center sm:border-x sm:border-[var(--line)] sm:px-9">
          <StrikeZone predictedZone={p.zone} actualZone={a.zone} revealed={revealed} />
          <div className="flex items-center gap-3.5 font-mono text-[9.5px] uppercase tracking-[0.16em]">
            <span className="flex items-center gap-1.5 text-[var(--model)]">
              <span className="inline-block h-2 w-2 rounded-full" style={{ boxShadow: '0 0 0 1.5px var(--model)', background: 'var(--model-soft)' }} /> Pred
            </span>
            {revealed && <span className="flex items-center gap-1.5 text-[var(--muted)]"><span className="font-bold text-[var(--ink)]">×</span> Actual</span>}
          </div>
        </div>

        {/* ACTUAL */}
        <CallColumn label="What happened" tone={revealed ? 'text' : 'faint'} className="sm:pl-8">
          {!revealed ? (
            <div className="flex min-h-[8rem] flex-col justify-center gap-3">
              <div className="h-8 w-2/3 animate-pulse rounded-[var(--r-chip)] bg-[var(--fill)]" />
              <div className="h-3.5 w-1/2 animate-pulse rounded-[var(--r-chip)] bg-[var(--fill)]" />
              <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--faint)]">Awaiting the pitch…</div>
            </div>
          ) : (
            <div className="animate-[fadeUp_.45s_ease-out] min-h-[8rem]">
              <div className="flex items-baseline gap-2.5">
                <span className="font-display text-[2.3rem] font-bold leading-none tracking-tight text-[var(--text)] sm:text-[2.8rem]">{a.pitchType}</span>
                <span className="font-mono text-sm font-semibold tabular-nums text-[var(--muted)]">{a.velo.toFixed(1)}</span>
              </div>
              <div className="mt-1 text-sm text-[var(--muted)]">{a.zone.label}</div>
              <div className="mt-2.5 text-sm text-[var(--muted)]">
                Result <span className="font-semibold text-[var(--text)]">{a.outcome}</span>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <Verdict hit={typeHit} label="Type" />
                <Verdict hit={outcomeHit} label="Outcome" />
              </div>
            </div>
          )}
        </CallColumn>
      </div>

      {revealed && pitch.abEnd && (
        <div className="border-t border-[var(--line)] bg-[var(--fill)] px-5 py-3.5 text-sm text-[var(--muted)]">
          <span className="font-semibold text-[var(--text)]">At-bat over.</span> {pitch.abEnd}
        </div>
      )}
    </Panel>
  );
}

// ---- Matchup ---------------------------------------------------------------
function PersonCard({ person, role, align = 'left' }) {
  const handVerb = /P$/.test(person.role) ? 'Throws' : 'Bats';
  return (
    <div className={cx('flex flex-col gap-1', align === 'right' && 'items-end text-right')}>
      <Eyebrow>{role}</Eyebrow>
      <div className="whitespace-nowrap text-[15px] font-semibold text-[var(--text)]">{person.name}</div>
      <div className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--faint)]">{person.team} · {person.role} · {handVerb} {person.hand}</div>
      <div className="mt-0.5 whitespace-nowrap font-mono text-[11px] tabular-nums text-[var(--muted)]">{person.line}</div>
    </div>
  );
}

function Matchup({ batter, game }) {
  const { pitcher } = window.MATCHUP;
  const pitcherT = { ...pitcher, team: game.home.abbr };
  const batterT = { ...batter, team: game.away.abbr };
  return (
    <Panel>
      <PanelHead label="Matchup" />
      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-4 px-5 py-5">
        <PersonCard person={pitcherT} role="Pitching" />
        <span className="self-center font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--faint)]">vs</span>
        <PersonCard person={batterT} role="At bat" align="right" />
      </div>
    </Panel>
  );
}

// ---- Win probability -------------------------------------------------------
function WinProbPanel({ game, series }) {
  const homeP = series[series.length - 1];
  const prev = series.length > 1 ? series[series.length - 2] : homeP;
  const delta = homeP - prev;
  const fav = homeP >= 0.5 ? game.home : game.away;
  const favP = homeP >= 0.5 ? homeP : 1 - homeP;
  const dUp = delta > 0.005, dDown = delta < -0.005;

  return (
    <Panel>
      <PanelHead label="Win probability" right="Live model" />
      <div className="px-5 py-5">
        <WinProbBar away={game.away} home={game.home} homeP={homeP} />

        <div className="mt-5 flex items-end justify-between border-t border-[var(--line)] pt-5">
          <div className="flex items-center gap-2.5">
            <Monogram team={fav} size="sm" />
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--faint)]">{fav.name} favored</div>
              <div className="text-[13px] text-[var(--muted)]"><span className="font-semibold text-[var(--text)]">{pct(favP)}%</span> to win it</div>
            </div>
          </div>
          <div
            className="flex items-center gap-1 font-mono text-xs font-semibold tabular-nums"
            style={{ color: dUp ? 'var(--model)' : dDown ? 'var(--live)' : 'var(--faint)' }}
          >
            {dUp ? '▲' : dDown ? '▼' : '—'} {Math.abs(pct(delta))}
            <span className="font-normal text-[var(--faint)]">pts {game.home.abbr}</span>
          </div>
        </div>
        <div className="mt-5 h-12">
          <WinProbChart series={series} />
        </div>
        <div className="mt-2 flex justify-between font-mono text-[9.5px] uppercase tracking-[0.16em] text-[var(--faint)]">
          <span>1st pitch</span><span>now</span>
        </div>
      </div>
    </Panel>
  );
}

// ---- Model accuracy --------------------------------------------------------
function StatBlock({ label, value, sub }) {
  return (
    <div>
      <div className="font-mono text-[26px] font-semibold leading-none tabular-nums tracking-[-0.01em] text-[var(--text)]">{value}</div>
      <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--faint)]">{label}{sub && <span className="text-[var(--muted)]"> · {sub}</span>}</div>
    </div>
  );
}

function AccuracyPanel({ history }) {
  const n = history.length;
  const typeHits = history.filter((h) => h.typeHit).length;
  const outcomeHits = history.filter((h) => h.outcomeHit).length;
  const acc = n ? Math.round((outcomeHits / n) * 100) : 0;
  return (
    <Panel>
      <PanelHead label="Model accuracy" right={`${String(n).padStart(2, '0')} tracked`} />
      <div className="px-5 py-5">
        <div className="flex items-end gap-3">
          <span className="font-mono text-[3.6rem] font-semibold leading-[0.8] tabular-nums tracking-[-0.03em] text-[var(--text)]">{n ? acc : '–'}{n ? <span className="text-2xl text-[var(--muted)]">%</span> : null}</span>
          <span className="mb-1.5 font-mono text-[10px] uppercase leading-snug tracking-[0.16em] text-[var(--faint)]">outcome calls<br />correct</span>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-[var(--line)] pt-5">
          <StatBlock label="Pitch type" value={n ? `${Math.round((typeHits / n) * 100)}%` : '—'} sub={`${typeHits}/${n}`} />
          <StatBlock label="Outcome" value={n ? `${acc}%` : '—'} sub={`${outcomeHits}/${n}`} />
        </div>
      </div>
    </Panel>
  );
}

// ---- Pitch feed ------------------------------------------------------------
function FeedRow({ item }) {
  const { predicted: p, actual: a, typeHit, outcomeHit, seq } = item;
  return (
    <div className="grid grid-cols-[2rem_1fr_1fr_2.2rem] items-center gap-3 px-4 py-3 sm:px-5">
      <span className="font-mono text-[11px] tabular-nums text-[var(--faint)]">{String(seq).padStart(2, '0')}</span>
      <div className="min-w-0">
        <div className="truncate text-[13px] font-medium text-[var(--muted)]">{p.pitchType}</div>
        <div className="truncate font-mono text-[11px] text-[var(--faint)]">{p.outcome}</div>
      </div>
      <div className="min-w-0">
        <div className="truncate text-[13px] font-medium text-[var(--text)]">{a.pitchType} <span className="font-mono text-[11px] tabular-nums text-[var(--faint)]">{a.velo.toFixed(0)}</span></div>
        <div className="truncate font-mono text-[11px] text-[var(--muted)]">{a.outcome}</div>
      </div>
      <div className="flex justify-end gap-1.5">
        <span className="h-2 w-2 rounded-full" style={{ background: typeHit ? 'var(--model)' : 'var(--live)' }} title={`Pitch type — ${typeHit ? 'hit' : 'miss'}`} />
        <span className="h-2 w-2 rounded-full" style={{ background: outcomeHit ? 'var(--model)' : 'var(--live)' }} title={`Outcome — ${outcomeHit ? 'hit' : 'miss'}`} />
      </div>
    </div>
  );
}

function PitchFeed({ history }) {
  return (
    <Panel className="overflow-hidden">
      <PanelHead
        label="Pitch-by-pitch"
        right={<span className="flex items-center gap-3">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: 'var(--model)' }} /> hit</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: 'var(--live)' }} /> miss</span>
        </span>}
      />
      {history.length === 0 ? (
        <div className="px-5 py-12 text-center font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">Waiting for the first pitch to resolve…</div>
      ) : (
        <>
          <div className="grid grid-cols-[2rem_1fr_1fr_2.2rem] items-center gap-3 border-b border-[var(--line)] px-4 py-2 font-mono text-[9.5px] uppercase tracking-[0.16em] sm:px-5">
            <span className="text-[var(--faint)]">#</span>
            <span className="text-[var(--model)]">Predicted</span>
            <span className="text-[var(--text)]">Actual</span>
            <span className="text-right text-[var(--faint)]">T O</span>
          </div>
          <div className="divide-y divide-[var(--line)]">
            {history.map((item) => <FeedRow key={item.uid} item={item} />)}
          </div>
        </>
      )}
    </Panel>
  );
}

// ---- View + simulated ticker -----------------------------------------------
function GameView({ game }) {
  const PITCHES = window.PITCHES;
  const base = typeof game.homeWinProb === 'number' ? game.homeWinProb : 0.5;
  const clamp = (v) => Math.min(0.97, Math.max(0.03, v));
  const seed = [base - 0.06, base - 0.03, base - 0.04, base - 0.01, base].map(clamp);

  const [idx, setIdx] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [phase, setPhase] = useState('predicting');
  const [paused, setPaused] = useState(false);
  const [history, setHistory] = useState([]);
  const [series, setSeries] = useState(seed);
  const timer = useRef(null);
  const uid = useRef(0);

  const pitch = PITCHES[idx];
  const batter = cycle % 2 === 0 ? window.MATCHUP.batter : window.NEXT_BATTER;

  useEffect(() => {
    if (paused) return;
    if (phase === 'predicting') {
      timer.current = setTimeout(() => {
        const typeHit = pitch.predicted.pitchType === pitch.actual.pitchType;
        const outcomeHit = outcomeBucket(pitch.predicted.outcome) === outcomeBucket(pitch.actual.outcome);
        setHistory((h) => [{ ...pitch, typeHit, outcomeHit, uid: uid.current++ }, ...h].slice(0, 16));
        setSeries((s) => [...s, pitch.homeWinProbAfter].slice(-26));
        setPhase('revealed');
      }, PREDICT_MS);
    } else {
      timer.current = setTimeout(() => {
        const next = (idx + 1) % PITCHES.length;
        if (next === 0) setCycle((c) => c + 1);
        setIdx(next);
        setPhase('predicting');
      }, REVEAL_MS);
    }
    return () => clearTimeout(timer.current);
  }, [phase, paused, idx]);

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-5 sm:px-6 sm:pt-6">
      <Scoreboard
        game={game} pitch={pitch} phase={phase} paused={paused}
        onTogglePause={() => setPaused((p) => !p)}
      />
      <div className="mt-5 grid gap-5 lg:grid-cols-[1.55fr_1fr]">
        <div className="flex flex-col gap-5">
          <PredictionHero pitch={pitch} phase={phase} batter={batter} />
          <Matchup batter={batter} game={game} />
        </div>
        <div className="flex flex-col gap-5">
          <WinProbPanel game={game} series={series} />
          <AccuracyPanel history={history} />
        </div>
      </div>
      <div className="mt-5">
        <PitchFeed history={history} />
      </div>
    </main>
  );
}

Object.assign(window, { GameView });
