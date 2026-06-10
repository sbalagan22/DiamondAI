"use client";

/* DiamondAI — shared UI primitives (ported from design/components.jsx) */
import Image from "next/image";
import { motion } from "motion/react";
import { cx, pct } from "@/lib/ui";
import type { ViewTeam, Zone } from "@/lib/view";
import { GlassPanel } from "./GlassPanel";

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

// Team monogram — the team logo on an accent-tinted tile (abbr as fallback).
const MONOGRAM_PX = { sm: 28, md: 36, lg: 44 } as const;

export function Monogram({
  team,
  size = "md",
}: {
  team: ViewTeam;
  size?: "sm" | "md" | "lg";
}) {
  const px = MONOGRAM_PX[size];
  const inner = Math.round(px * 0.74);
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[var(--r-chip)]"
      style={{
        width: px,
        height: px,
        background: `${team.primaryColor}14`,
        boxShadow: `inset 0 0 0 1px ${team.primaryColor}40`,
      }}
    >
      {team.logoPath ? (
        <Image
          src={team.logoPath}
          alt={`${team.name} logo`}
          width={inner}
          height={inner}
          className="h-[74%] w-[74%] object-contain"
          draggable={false}
        />
      ) : (
        <span
          className="font-mono font-semibold tracking-wider"
          style={{ color: team.primaryColor, fontSize: Math.round(px * 0.3) }}
        >
          {team.abbr}
        </span>
      )}
    </span>
  );
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

// 3x3 strike-zone grid — predicted dot (model blue), actual marker (white ×)
export function StrikeZone({
  predictedZone,
  actualZone,
  revealed,
}: {
  predictedZone: Zone;
  actualZone: Zone | null;
  revealed: boolean;
}) {
  const cellAt = (z: Zone) => z.row * 3 + z.col;
  const pIdx = cellAt(predictedZone);
  const aIdx = actualZone ? cellAt(actualZone) : -1;
  return (
    <div className="inline-block">
      <div
        className="grid grid-cols-3 grid-rows-3"
        style={{ width: 96, height: 112, boxShadow: "inset 0 0 0 1px var(--hair-mid)" }}
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
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: revealed ? 0.55 : 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 22 }}
              />
            )}
            {revealed && i === aIdx && (
              <motion.span
                key={`a-${aIdx}`}
                className="absolute left-1/2 top-1/2 font-mono text-[15px] font-bold leading-none text-[var(--ink)]"
                style={{ x: "-50%", y: "-50%" }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 24, delay: 0.05 }}
              >
                ×
              </motion.span>
            )}
          </div>
        ))}
      </div>
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
      <span className="w-11 text-right font-mono text-[15px] font-semibold tabular-nums text-[var(--text)]">
        {pct(value)}%
      </span>
    </div>
  );
}

// Verdict chip — hit (model blue) / miss (live red)
export function Verdict({ hit, label }: { hit: boolean; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-[var(--r-chip)] px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.08em]"
      style={{
        color: hit ? "var(--model)" : "var(--live)",
        background: hit ? "var(--model-soft)" : "var(--live-soft)",
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
        <span className="text-[15px] font-semibold text-[var(--text)]">
          {pct(awayP)}
          <span className="text-[11px] text-[var(--faint)]">%</span>
        </span>
        <span className="text-[9.5px] uppercase tracking-[0.18em] text-[var(--faint)]">
          chance to win
        </span>
        <span className="text-[15px] font-semibold text-[var(--text)]">
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

// Frosted glass panel — the signature surface (liquid-glass primitive)
export function Panel({
  children,
  className = "",
  as = "section",
}: {
  children: React.ReactNode;
  className?: string;
  as?: React.ElementType;
}) {
  return (
    <GlassPanel as={as} className={className}>
      {children}
    </GlassPanel>
  );
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
