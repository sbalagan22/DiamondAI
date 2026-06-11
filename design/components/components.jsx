/* DiamondAI — shared UI primitives (instrument/editorial language) */
const { useState, useEffect, useRef, useMemo } = React;

const cx = (...a) => a.filter(Boolean).join(' ');
const pct = (x) => Math.round(x * 100);

// Mono micro-label, e.g.  NEXT PITCH
function Eyebrow({ children, tone = 'muted', className = '' }) {
  const tones = {
    muted: 'text-[var(--muted)]',
    model: 'text-[var(--model)]',
    live: 'text-[var(--live)]',
    text: 'text-[var(--text)]',
    faint: 'text-[var(--faint)]',
  };
  return (
    <div className={cx('whitespace-nowrap font-mono text-[10.5px] font-medium uppercase tracking-[0.2em]', tones[tone], className)}>
      {children}
    </div>
  );
}

// Team monogram — quiet bordered tile in the team's accent (editorial, not a logo)
function Monogram({ team, size = 'md' }) {
  const sizes = { sm: 'h-7 w-7 text-[10px]', md: 'h-9 w-9 text-[11px]', lg: 'h-11 w-11 text-xs' };
  return (
    <span
      className={cx('inline-flex items-center justify-center rounded-[var(--r-chip)] font-mono font-semibold tracking-wider', sizes[size])}
      style={{ color: team.accent, background: `${team.accent}14`, boxShadow: `inset 0 0 0 1px ${team.accent}40` }}
    >
      {team.abbr}
    </span>
  );
}

function LiveDot({ className = '' }) {
  return (
    <span className={cx('relative inline-flex h-1.5 w-1.5', className)}>
      <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--live)] opacity-70 animate-ping" />
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--live)]" />
    </span>
  );
}

function StatusTag({ game }) {
  if (game.status === 'live')
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-mono text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[var(--live)]">
        <LiveDot /> Live
      </span>
    );
  if (game.status === 'final')
    return <span className="whitespace-nowrap font-mono text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[var(--faint)]">Final</span>;
  return <span className="whitespace-nowrap font-mono text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)] tabular-nums">{game.startLabel}</span>;
}

// Bases — three rotated squares
function Bases({ bases, size = 12 }) {
  const cell = (on) => (
    <span
      className="block rotate-45 transition-colors"
      style={{
        width: size, height: size,
        background: on ? 'var(--text)' : 'transparent',
        boxShadow: on ? 'none' : 'inset 0 0 0 1.5px var(--hair-strong)',
      }}
    />
  );
  return (
    <div className="relative" style={{ width: size * 2.5, height: size * 2.5 }}>
      <div className="absolute left-1/2 top-0 -translate-x-1/2">{cell(bases.second)}</div>
      <div className="absolute right-0 top-1/2 -translate-y-1/2">{cell(bases.first)}</div>
      <div className="absolute left-0 top-1/2 -translate-y-1/2">{cell(bases.third)}</div>
    </div>
  );
}

// Balls / strikes / outs pips — circular, neutral + red, no blue
function CountPips({ count, outs }) {
  const Row = ({ label, filled, total, tone }) => (
    <div className="flex items-center gap-2.5">
      <span className="w-3 font-mono text-[10px] font-semibold uppercase text-[var(--faint)]">{label}</span>
      <div className="flex gap-1.5">
        {Array.from({ length: total }).map((_, i) => (
          <span key={i} className="h-[7px] w-[7px] rounded-full transition-colors duration-300" style={{ background: i < filled ? tone : 'transparent', boxShadow: i < filled ? 'none' : 'inset 0 0 0 1.5px var(--hair-mid)' }} />
        ))}
      </div>
    </div>
  );
  return (
    <div className="flex flex-col gap-1.5">
      <Row label="B" filled={count.balls} total={3} tone="var(--muted)" />
      <Row label="S" filled={count.strikes} total={2} tone="var(--text)" />
      <Row label="O" filled={outs} total={2} tone="var(--live)" />
    </div>
  );
}

// 3x3 strike-zone grid — predicted dot (model blue), actual marker (white ×)
function StrikeZone({ predictedZone, actualZone, revealed }) {
  const cellAt = (z) => z.row * 3 + z.col;
  const pIdx = cellAt(predictedZone);
  const aIdx = actualZone ? cellAt(actualZone) : -1;
  return (
    <div className="inline-block">
      <div
        className="grid grid-cols-3 grid-rows-3"
        style={{ width: 96, height: 112, boxShadow: 'inset 0 0 0 1px var(--hair-mid)' }}
      >
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="relative" style={{ boxShadow: 'inset 0 0 0 0.5px var(--hair)' }}>
            {i === pIdx && (
              <span
                className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full transition-opacity"
                style={{ background: 'var(--model-soft)', boxShadow: '0 0 0 1.5px var(--model)', opacity: revealed ? 0.55 : 1 }}
              />
            )}
            {revealed && i === aIdx && (
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-mono text-[15px] font-bold leading-none text-[var(--ink)]">×</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Confidence meter — segmented, model blue
function Confidence({ value }) {
  const segs = 24;
  const on = Math.round(value * segs);
  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-1 gap-[2px]">
        {Array.from({ length: segs }).map((_, i) => (
          <span key={i} className="h-2.5 flex-1 transition-colors duration-500" style={{ background: i < on ? 'var(--model)' : 'var(--track)' }} />
        ))}
      </div>
      <span className="w-11 text-right font-mono text-[15px] font-semibold tabular-nums text-[var(--text)]">{pct(value)}%</span>
    </div>
  );
}

// Verdict chip — hit (model blue) / miss (live red)
function Verdict({ hit, label }) {
  return (
    <span
      className={cx('inline-flex items-center gap-1.5 rounded-[var(--r-chip)] px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.08em]')}
      style={{
        color: hit ? 'var(--model)' : 'var(--live)',
        background: hit ? 'var(--model-soft)' : 'var(--live-soft)',
      }}
    >
      <span className="text-[11px] leading-none">{hit ? '✓' : '✕'}</span>
      {label}
    </span>
  );
}

// Win-probability step area chart (data viz) — neutral white line
function WinProbChart({ series }) {
  const w = 100, h = 40;
  const pts = series.map((v, i) => [(i / Math.max(series.length - 1, 1)) * w, h - v * h]);
  // step path for a "telemetry" read
  let line = '';
  pts.forEach((p, i) => {
    if (i === 0) line += `M${p[0].toFixed(2)},${p[1].toFixed(2)}`;
    else line += ` L${pts[i][0].toFixed(2)},${pts[i - 1][1].toFixed(2)} L${p[0].toFixed(2)},${p[1].toFixed(2)}`;
  });
  const area = `${line} L${w},${h} L0,${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-full w-full">
      <defs>
        <linearGradient id="wpFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--text)" stopOpacity="0.16" />
          <stop offset="100%" stopColor="var(--text)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1="0" y1={h / 2} x2={w} y2={h / 2} stroke="var(--hair-mid)" strokeWidth="0.5" strokeDasharray="2 2" />
      <path d={area} fill="url(#wpFill)" />
      <path d={line} fill="none" stroke="var(--text)" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {pts.length > 0 && (
        <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2" fill="var(--text)" vectorEffect="non-scaling-stroke" />
      )}
    </svg>
  );
}

// Head-to-head win-probability bar — the sportsbook live read
function WinProbBar({ away, home, homeP }) {
  const awayP = 1 - homeP;
  const pad = (v) => Math.max(7, Math.round(v * 100)); // keep a sliver always visible
  return (
    <div>
      <div className="flex items-stretch overflow-hidden rounded-full" style={{ height: 30, boxShadow: 'inset 0 0 0 1px var(--hair-mid)' }}>
        <div
          className="flex items-center pl-3 transition-[width] duration-700 ease-out"
          style={{ width: `${pad(awayP)}%`, background: `linear-gradient(90deg, ${away.accent}, ${away.accent}cc)` }}
        >
          <span className="font-mono text-[11px] font-bold tracking-wide text-white drop-shadow-sm">{away.abbr}</span>
        </div>
        <div
          className="flex items-center justify-end pr-3 transition-[width] duration-700 ease-out"
          style={{ width: `${pad(homeP)}%`, background: `linear-gradient(90deg, ${home.accent}cc, ${home.accent})` }}
        >
          <span className="font-mono text-[11px] font-bold tracking-wide text-white drop-shadow-sm">{home.abbr}</span>
        </div>
      </div>
      <div className="mt-2 flex items-baseline justify-between font-mono tabular-nums">
        <span className="text-[15px] font-semibold text-[var(--text)]">{pct(awayP)}<span className="text-[11px] text-[var(--faint)]">%</span></span>
        <span className="text-[9.5px] uppercase tracking-[0.18em] text-[var(--faint)]">chance to win</span>
        <span className="text-[15px] font-semibold text-[var(--text)]">{pct(homeP)}<span className="text-[11px] text-[var(--faint)]">%</span></span>
      </div>
    </div>
  );
}

// Frosted glass panel — the signature surface
function Panel({ children, className = '', as: Tag = 'section' }) {
  return (
    <Tag className={cx('glass-panel', className)}>
      {children}
    </Tag>
  );
}

// ---- navigation chrome (shared across home + game pages) ----
const HOME_URL = 'DiamondAI%20Prototype.html';
const gameUrl = (id) => `Game.html?id=${encodeURIComponent(id)}`;

function BrilliantMark({ size = 22 }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} fill="none" style={{ color: 'var(--text)', display: 'block' }} aria-hidden="true">
      <polygon points="30,27 70,27 60,49 40,49" fill="currentColor" opacity="0.92" />
      <polygon points="30,27 40,49 14,49" fill="currentColor" opacity="0.32" />
      <polygon points="70,27 86,49 60,49" fill="currentColor" opacity="0.46" />
      <polygon points="14,49 40,49 50,90" fill="var(--model)" />
      <polygon points="40,49 60,49 50,90" fill="currentColor" opacity="0.62" />
      <polygon points="60,49 86,49 50,90" fill="var(--live)" />
      <polygon points="30,27 70,27 86,49 50,90 14,49" stroke="currentColor" strokeWidth="2.6" strokeLinejoin="round" opacity="0.9" />
      <line x1="14" y1="49" x2="86" y2="49" stroke="currentColor" strokeWidth="1.8" opacity="0.5" />
    </svg>
  );
}

function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <BrilliantMark size={22} />
      <span className="font-display text-[16px] font-bold tracking-tight text-[var(--text)]">Diamond<span style={{ color: 'var(--model)' }}>AI</span></span>
    </span>
  );
}

// Dark / light theme toggle — half-filled disc; persists to localStorage
function ThemeToggle() {
  const [theme, setTheme] = useState(() =>
    (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme')) || 'dark');
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('diamondai-theme', theme); } catch (e) {}
    // Chromium stale-paint workaround: custom-property colors inside
    // backdrop-filter panels don't always re-resolve on a theme swap (or on
    // initial light-mode load) until a forced repaint. Toggling visibility
    // invalidates paint without touching layout or scroll position.
    const b = document.body;
    if (b) {
      b.style.visibility = 'hidden';
      void b.offsetHeight;
      b.style.visibility = '';
    }
  }, [theme]);
  return (
    <button
      type="button"
      onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      aria-label="Toggle light or dark mode"
      title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
      className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--glass-border)] text-[var(--muted)] transition-colors hover:bg-[var(--fill-hi)] hover:text-[var(--text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--model)]"
    >
      <svg viewBox="0 0 24 24" className="h-[15px] w-[15px]" aria-hidden="true">
        <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M12 4 A8 8 0 0 0 12 20 Z" fill="currentColor" />
      </svg>
    </button>
  );
}

function MockPill() {
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em]"
      style={{ borderColor: 'rgba(216,178,74,.4)', color: 'var(--warn)', background: 'rgba(216,178,74,.08)' }}
      title="This build runs on mock data and a simulated ticker — no live feeds or model calls yet."
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--warn)' }} />
      <span className="hidden xs:inline sm:inline">Mock data</span>
      <span className="sm:hidden">Mock</span>
    </span>
  );
}

// Floating frosted pill navbar — mode 'home' | 'game'
function PillNav({ mode = 'home' }) {
  return (
    <div className="sticky top-0 z-30 pt-3 sm:pt-4">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <nav className="glass-pill flex h-[52px] items-center justify-between gap-3 rounded-full pl-3 pr-3 sm:pl-5">
          <div className="flex min-w-0 items-center gap-2.5">
            {mode === 'game' && (
              <a
                href={HOME_URL}
                aria-label="Back to schedule"
                className="group flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted)] transition-colors hover:bg-[var(--fill-hi)] hover:text-[var(--text)] focus:outline-none focus-visible:bg-[var(--fill-hi)]"
              >
                <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
              </a>
            )}
            <a href={HOME_URL} className="flex items-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--model)]" aria-label="DiamondAI home">
              <Wordmark />
            </a>
          </div>
          <div className="flex items-center gap-2.5">
            {mode === 'game' && (
              <a href={HOME_URL} className="hidden font-mono text-[10.5px] uppercase tracking-[0.16em] text-[var(--muted)] transition-colors hover:text-[var(--text)] sm:inline">Schedule</a>
            )}
            <ThemeToggle />
            <MockPill />
          </div>
        </nav>
      </div>
    </div>
  );
}

// Panel header band: mono label, optional right meta
function PanelHead({ label, right, tone = 'muted', className = '' }) {
  return (
    <header className={cx('flex items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3 sm:px-5', className)}>
      <Eyebrow tone={tone}>{label}</Eyebrow>
      {right && <div className="whitespace-nowrap font-mono text-[10.5px] uppercase tracking-[0.16em] text-[var(--faint)]">{right}</div>}
    </header>
  );
}

function ChevronLeft({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

Object.assign(window, {
  cx, pct, Eyebrow, Monogram, LiveDot, StatusTag, Bases, CountPips,
  StrikeZone, Confidence, Verdict, WinProbChart, WinProbBar, Panel, PanelHead, ChevronLeft,
  Wordmark, BrilliantMark, ThemeToggle, MockPill, PillNav, HOME_URL, gameUrl,
});
