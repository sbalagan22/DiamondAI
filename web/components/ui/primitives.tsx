"use client";

/* DiamondAI — shared UI primitives (ported from design/components.jsx).
   Surfaces are flat & solid here; the only frosted glass is the nav pill. */
import { motion, useReducedMotion } from "motion/react";
import { cx, pct } from "@/lib/ui";
import type { ViewTeam, Zone } from "@/lib/view";

type Tone = "muted" | "model" | "live" | "text" | "faint";

// Mono micro-label, e.g.  NEXT PITCH
export function Eyebrow({
  children,
  tone = "muted",
  className = "",
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  const tones: Record<Tone, string> = {
    muted: "text-[var(--muted)]",
    model: "text-[var(--model)]",
    live: "text-[var(--live)]",
    text: "text-[var(--text)]",
    faint: "text-[var(--faint)]",
  };
  return (
    <div
      className={cx(
        "whitespace-nowrap font-mono text-[10.5px] font-medium uppercase tracking-[0.2em]",
        tones[tone],
        className,
      )}
    >
      {children}
    </div>
  );
}

// Team logo — transparent monochrome SVG with dark/light variants; CSS toggles
// which shows (see .logo-dark / .logo-light in globals.css). Falls back to the
// abbreviation on a tinted tile for unknown teams.
const LOGO_PX = { sm: 26, md: 44, lg: 66, xl: 104 } as const;

export function TeamLogo({
  team,
  px,
  className = "",
}: {
  team: ViewTeam;
  px: number;
  className?: string;
}) {
  if (!team.hasLogo) {
    return (
      <span
        className={cx("inline-flex shrink-0 items-center justify-center rounded-[var(--r-chip)]", className)}
        style={{
          width: px,
          height: px,
          background: `${team.primaryColor}1f`,
          boxShadow: `inset 0 0 0 1px ${team.primaryColor}40`,
        }}
      >
        <span
          className="font-mono font-semibold tracking-wider"
          style={{ color: team.primaryColor, fontSize: Math.round(px * 0.3) }}
        >
          {team.abbr}
        </span>
      </span>
    );
  }
  return (
    <span
      className={cx("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: px, height: px }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={team.logoDark}
        alt=""
        aria-hidden
        draggable={false}
        className="logo-dark absolute inset-0 h-full w-full object-contain"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={team.logoLight}
        alt=""
        aria-hidden
        draggable={false}
        className="logo-light absolute inset-0 h-full w-full object-contain"
      />
    </span>
  );
}

export function Monogram({
  team,
  size = "md",
}: {
  team: ViewTeam;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  return <TeamLogo team={team} px={LOGO_PX[size]} />;
}

export function LiveDot({ className = "" }: { className?: string }) {
  return (
    <span className={cx("relative inline-flex h-1.5 w-1.5", className)}>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--live)] opacity-70" />
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--live)]" />
    </span>
  );
}

export type CardStatus = "live" | "upcoming" | "final";

export function StatusTag({
  status,
  startLabel,
}: {
  status: CardStatus;
  startLabel: string;
}) {
  if (status === "live")
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-mono text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[var(--live)]">
        <LiveDot /> Live
      </span>
    );
  if (status === "final")
    return (
      <span className="whitespace-nowrap font-mono text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[var(--faint)]">
        Final
      </span>
    );
  return (
    <span className="whitespace-nowrap font-mono text-[10.5px] font-semibold uppercase tracking-[0.18em] tabular-nums text-[var(--muted)]">
      {startLabel}
    </span>
  );
}

// Bases — three rotated squares
export function Bases({
  bases,
  size = 12,
}: {
  bases: { first: boolean; second: boolean; third: boolean };
  size?: number;
}) {
  const cell = (on: boolean) => (
    <span
      className="block rotate-45 transition-colors"
      style={{
        width: size,
        height: size,
        background: on ? "var(--text)" : "transparent",
        boxShadow: on ? "none" : "inset 0 0 0 1.5px var(--hair-strong)",
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

// Balls / strikes / outs pips
function PipRow({
  label,
  filled,
  total,
  tone,
}: {
  label: string;
  filled: number;
  total: number;
  tone: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-3 font-mono text-[10px] font-semibold uppercase text-[var(--faint)]">
        {label}
      </span>
      <div className="flex gap-1.5">
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className="h-[7px] w-[7px] rounded-full transition-colors duration-300"
            style={{
              background: i < filled ? tone : "transparent",
              boxShadow: i < filled ? "none" : "inset 0 0 0 1.5px var(--hair-mid)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function CountPips({
  count,
  outs,
}: {
  count: { balls: number; strikes: number };
  outs: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <PipRow label="B" filled={count.balls} total={3} tone="var(--muted)" />
      <PipRow label="S" filled={count.strikes} total={2} tone="var(--text)" />
      <PipRow label="O" filled={outs} total={2} tone="var(--live)" />
    </div>
  );
}

// 3x3 strike-zone grid — predicted dot (model blue), then the pitch flies in
// on reveal: a ball travels to the landing cell, which flares, and the × snaps.
const ZONE_W = 96;
const ZONE_H = 112;

export function StrikeZone({
  predictedZone,
  actualZone,
  revealed,
}: {
  predictedZone: Zone;
  actualZone: Zone | null;
  revealed: boolean;
}) {
  const reduce = useReducedMotion();
  const cellAt = (z: Zone) => z.row * 3 + z.col;
  const pIdx = cellAt(predictedZone);
  const aIdx = actualZone ? cellAt(actualZone) : -1;
  const ballX = actualZone ? ((actualZone.col + 0.5) / 3) * ZONE_W : ZONE_W / 2;
  const ballY = actualZone ? ((actualZone.row + 0.5) / 3) * ZONE_H : ZONE_H / 2;
  const xDelay = reduce ? 0 : 0.42;

  return (
    <div className="relative inline-block" style={{ width: ZONE_W, height: ZONE_H }}>
      <div
        className="grid h-full w-full grid-cols-3 grid-rows-3"
        style={{ boxShadow: "inset 0 0 0 1px var(--hair-mid)" }}
      >
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="relative" style={{ boxShadow: "inset 0 0 0 0.5px var(--hair)" }}>
            {i === pIdx && (
              <motion.span
                key={`p-${pIdx}`}
                className="absolute left-1/2 top-1/2 h-4 w-4 rounded-full"
                style={{
                  x: "-50%",
                  y: "-50%",
                  background: "var(--model-soft)",
                  boxShadow: "0 0 0 1.5px var(--model)",
                }}
                initial={reduce ? false : { scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: revealed ? 0.55 : 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 22 }}
              />
            )}
            {revealed && i === aIdx && (
              <>
                {!reduce && (
                  <motion.span
                    key={`flare-${aIdx}`}
                    aria-hidden
                    className="absolute inset-0"
                    style={{ background: "var(--chalk-soft)" }}
                    initial={{ opacity: 0.85 }}
                    animate={{ opacity: 0 }}
                    transition={{ duration: 0.7, delay: 0.4, ease: "easeOut" }}
                  />
                )}
                <motion.span
                  key={`a-${aIdx}`}
                  className="absolute left-1/2 top-1/2 font-mono text-[15px] font-bold leading-none text-[var(--ink)]"
                  style={{ x: "-50%", y: "-50%" }}
                  initial={reduce ? false : { scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 24, delay: xDelay }}
                >
                  ×
                </motion.span>
              </>
            )}
          </div>
        ))}
      </div>
      {revealed && actualZone && !reduce && (
        <motion.span
          key={`ball-${aIdx}`}
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 h-2.5 w-2.5 rounded-full"
          style={{ background: "var(--ink)", boxShadow: "0 0 10px var(--chalk-soft)" }}
          initial={{ x: ZONE_W / 2 - 5, y: -34, opacity: 0, scale: 0.6 }}
          animate={{ x: ballX - 5, y: ballY - 5, opacity: [0, 1, 1, 0], scale: 1 }}
          transition={{
            duration: 0.44,
            ease: [0.4, 0, 0.2, 1],
            opacity: { duration: 0.5, times: [0, 0.15, 0.82, 1] },
          }}
        />
      )}
    </div>
  );
}

// Confidence meter — segmented, model blue
export function Confidence({ value }: { value: number }) {
  const segs = 24;
  const on = Math.round(value * segs);
  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-1 gap-[2px]">
        {Array.from({ length: segs }).map((_, i) => (
          <span
            key={i}
            className="h-2.5 flex-1 transition-colors duration-500"
            style={{ background: i < on ? "var(--model)" : "var(--track)" }}
          />
        ))}
      </div>
      <span className="w-11 text-right font-mono text-[15px] font-semibold tabular-nums text-[var(--model)]">
        {pct(value)}%
      </span>
    </div>
  );
}

// Verdict chip — hit (green) / miss (red)
export function Verdict({ hit, label }: { hit: boolean; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-[var(--r-chip)] px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.08em]"
      style={{
        color: hit ? "var(--hit)" : "var(--miss)",
        background: hit ? "var(--hit-soft)" : "var(--miss-soft)",
      }}
    >
      <span className="text-[11px] leading-none">{hit ? "✓" : "✕"}</span>
      {label}
    </span>
  );
}

// Win-probability step area chart — neutral white line
export function WinProbChart({ series }: { series: number[] }) {
  const w = 100;
  const h = 40;
  const pts = series.map(
    (v, i) => [(i / Math.max(series.length - 1, 1)) * w, h - v * h] as const,
  );
  let line = "";
  pts.forEach((p, i) => {
    if (i === 0) line += `M${p[0].toFixed(2)},${p[1].toFixed(2)}`;
    else
      line += ` L${pts[i][0].toFixed(2)},${pts[i - 1][1].toFixed(2)} L${p[0].toFixed(2)},${p[1].toFixed(2)}`;
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
      <line
        x1="0"
        y1={h / 2}
        x2={w}
        y2={h / 2}
        stroke="var(--hair-mid)"
        strokeWidth="0.5"
        strokeDasharray="2 2"
      />
      <path d={area} fill="url(#wpFill)" />
      <path
        d={line}
        fill="none"
        stroke="var(--text)"
        strokeWidth="1.3"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {pts.length > 0 && (
        <circle
          cx={pts[pts.length - 1][0]}
          cy={pts[pts.length - 1][1]}
          r="2"
          fill="var(--text)"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}

// Head-to-head win-probability bar — split by each team's primary color
export function WinProbBar({
  away,
  home,
  homeP,
}: {
  away: ViewTeam;
  home: ViewTeam;
  homeP: number;
}) {
  const awayP = 1 - homeP;
  const pad = (v: number) => Math.max(7, Math.round(v * 100));
  return (
    <div>
      <div
        className="flex items-stretch overflow-hidden rounded-full"
        style={{ height: 30, boxShadow: "inset 0 0 0 1px var(--hair-mid)" }}
      >
        <div
          className="flex items-center pl-3 transition-[width] duration-700 ease-out"
          style={{
            width: `${pad(awayP)}%`,
            background: `linear-gradient(90deg, ${away.primaryColor}, ${away.primaryColor}cc)`,
          }}
        >
          <span className="font-mono text-[11px] font-bold tracking-wide text-white drop-shadow-sm">
            {away.abbr}
          </span>
        </div>
        <div
          className="flex items-center justify-end pr-3 transition-[width] duration-700 ease-out"
          style={{
            width: `${pad(homeP)}%`,
            background: `linear-gradient(90deg, ${home.primaryColor}cc, ${home.primaryColor})`,
          }}
        >
          <span className="font-mono text-[11px] font-bold tracking-wide text-white drop-shadow-sm">
            {home.abbr}
          </span>
        </div>
      </div>
      <div className="mt-2 flex items-baseline justify-between font-mono tabular-nums">
        <span className="text-[15px] font-semibold text-[var(--win)]">
          {pct(awayP)}
          <span className="text-[11px] text-[var(--faint)]">%</span>
        </span>
        <span className="text-[9.5px] uppercase tracking-[0.18em] text-[var(--faint)]">
          chance to win
        </span>
        <span className="text-[15px] font-semibold text-[var(--win)]">
          {pct(homeP)}
          <span className="text-[11px] text-[var(--faint)]">%</span>
        </span>
      </div>
    </div>
  );
}

// Win-probability "tug of war" lean bar — favored side blue, underdog faint
export function LeanBar({
  homeWinProb,
  away,
  home,
}: {
  homeWinProb: number;
  away: ViewTeam;
  home: ViewTeam;
}) {
  const homeP = pct(homeWinProb);
  const awayP = 100 - homeP;
  const homeFav = homeP >= awayP;
  return (
    <div className="flex items-center gap-3">
      <span className="w-11 whitespace-nowrap font-mono text-[11px] tabular-nums text-[var(--muted)]">
        <span className="text-[var(--faint)]">{away.abbr}</span> {awayP}
      </span>
      <div className="relative flex h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--track)]">
        <div
          className="h-full"
          style={{ width: `${awayP}%`, background: homeFav ? "var(--hair-mid)" : "var(--model)" }}
        />
        <div
          className="h-full"
          style={{ width: `${homeP}%`, background: homeFav ? "var(--model)" : "var(--hair-mid)" }}
        />
        <span className="absolute left-1/2 top-1/2 h-[9px] w-px -translate-x-1/2 -translate-y-1/2 bg-[var(--hair-strong)]" />
      </div>
      <span className="w-11 whitespace-nowrap text-right font-mono text-[11px] tabular-nums text-[var(--muted)]">
        {homeP} <span className="text-[var(--faint)]">{home.abbr}</span>
      </span>
    </div>
  );
}

// Flat solid panel — the workhorse surface (no glass).
export function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <section className={cx("surface", className)}>{children}</section>;
}

// Panel header band: mono label, optional right meta
export function PanelHead({
  label,
  right,
  tone = "muted",
  className = "",
}: {
  label: React.ReactNode;
  right?: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <header
      className={cx(
        "flex items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3 sm:px-5",
        className,
      )}
    >
      <Eyebrow tone={tone}>{label}</Eyebrow>
      {right && (
        <div className="whitespace-nowrap font-mono text-[10.5px] uppercase tracking-[0.16em] text-[var(--faint)]">
          {right}
        </div>
      )}
    </header>
  );
}

export function ChevronLeft({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

// The faceted diamond mark — theme-adaptive (uses CSS vars)
export function BrilliantMark({ size = 22 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="none"
      style={{ color: "var(--text)", display: "block" }}
      aria-hidden="true"
    >
      <polygon points="30,27 70,27 60,49 40,49" fill="currentColor" opacity="0.92" />
      <polygon points="30,27 40,49 14,49" fill="currentColor" opacity="0.32" />
      <polygon points="70,27 86,49 60,49" fill="currentColor" opacity="0.46" />
      <polygon points="14,49 40,49 50,90" fill="var(--model)" />
      <polygon points="40,49 60,49 50,90" fill="currentColor" opacity="0.62" />
      <polygon points="60,49 86,49 50,90" fill="var(--live)" />
      <polygon
        points="30,27 70,27 86,49 50,90 14,49"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinejoin="round"
        opacity="0.9"
      />
      <line x1="14" y1="49" x2="86" y2="49" stroke="currentColor" strokeWidth="1.8" opacity="0.5" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <BrilliantMark size={22} />
      <span className="font-display text-[16px] font-bold tracking-tight text-[var(--text)]">
        Diamond<span style={{ color: "var(--model)" }}>AI</span>
      </span>
    </span>
  );
}
