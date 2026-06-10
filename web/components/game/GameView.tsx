"use client";

/* DiamondAI — Live Game view, ported from design/game.jsx and driven by the
   mock game script via a predict -> reveal simulated ticker. Flat surfaces with
   liquid glass on the hero scoreboard, a centered/responsive matchup, model-blue
   accents on key numbers, and a compact Polymarket reference in the win-prob panel. */
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { notFound } from "next/navigation";
import { useEffect, useState } from "react";
import { Reveal, TickNumber } from "@/components/ui/motion";
import {
  Bases,
  Confidence,
  CountPips,
  Eyebrow,
  Monogram,
  Panel,
  PanelHead,
  StatusTag,
  StrikeZone,
  Verdict,
  WinProbBar,
  WinProbChart,
  type CardStatus,
} from "@/components/ui/primitives";
import { getGame } from "@/lib/mock";
import type { Game } from "@/lib/types";
import { cx, pct, teamSplit } from "@/lib/ui";
import { viewPitch, viewTeam, type ViewPitch, type ViewTeam } from "@/lib/view";
import { ResultFlash, StrikeoutStamp } from "./moments";
import { PolymarketTicker } from "./PolymarketTicker";

const PREDICT_MS = 3400;
const REVEAL_MS = 2800;
type Phase = "predicting" | "revealed";

const teamRule = (a: ViewTeam, b: ViewTeam) =>
  `linear-gradient(90deg, ${a.primaryColor}, ${b.primaryColor})`;
const marketHint = (g: Game) => `${g.home.city} ${g.home.name}`;

// Bigger on desktop, comfortable on mobile.
function ScoreLogo({ team }: { team: ViewTeam }) {
  return (
    <>
      <span className="sm:hidden">
        <Monogram team={team} size="md" />
      </span>
      <span className="hidden sm:inline-flex">
        <Monogram team={team} size="lg" />
      </span>
    </>
  );
}

// Team name — full on sm+, abbreviation on mobile (keeps the scoreboard tidy).
function TeamName({ team, align }: { team: ViewTeam; align: "left" | "right" }) {
  return (
    <div className={cx("min-w-0 leading-tight", align === "right" ? "text-right" : "text-left")}>
      <div className="truncate text-[15px] font-semibold tracking-[-0.01em] text-[var(--text)] sm:text-[17px]">
        <span className="sm:hidden">{team.abbr}</span>
        <span className="hidden sm:inline">{team.name}</span>
      </div>
      <div className="hidden font-mono text-[9.5px] uppercase tracking-[0.14em] text-[var(--faint)] sm:block">
        {team.city}
      </div>
    </div>
  );
}

// ---- Scoreboard — liquid glass, centered, symmetric, responsive ------------
function Scoreboard({
  away,
  home,
  awayScore,
  homeScore,
  status,
  half,
  inning,
  venue,
  pitch,
  phase,
  paused,
  onTogglePause,
}: {
  away: ViewTeam;
  home: ViewTeam;
  awayScore: number;
  homeScore: number;
  status: CardStatus;
  half: string;
  inning: number;
  venue: string;
  pitch: ViewPitch;
  phase: Phase;
  paused: boolean;
  onTogglePause?: () => void;
}) {
  const reduce = useReducedMotion();
  const count = phase === "revealed" ? pitch.countAfter : pitch.countBefore;
  const inningLabel = status === "final" ? "Final" : `${half} ${inning}`;
  const scoreCls =
    "font-mono text-[30px] font-semibold leading-none tabular-nums tracking-[-0.03em] text-[var(--text)] sm:text-[40px]";
  return (
    <section className="liquid-glass relative overflow-hidden rounded-[var(--r-card)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: teamSplit(away.primaryColor, home.primaryColor, "40") }}
      />
      <div className="relative">
        <div className="h-[3px] w-full" style={{ background: teamRule(away, home) }} />

        {/* centered status + inning */}
        <div className="flex items-center justify-center gap-3 px-5 pt-4 sm:px-6">
          <StatusTag status={status} startLabel="" />
          <span className="relative inline-flex h-4 items-center overflow-hidden whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={inningLabel}
                initial={reduce ? false : { y: "110%", opacity: 0 }}
                animate={{ y: "0%", opacity: 1 }}
                exit={reduce ? undefined : { y: "-110%", opacity: 0 }}
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              >
                {inningLabel}
              </motion.span>
            </AnimatePresence>
          </span>
        </div>

        {/* centered matchup: away · score – score · home */}
        <div className="flex items-center justify-center gap-2.5 px-3 py-4 sm:gap-6 sm:px-6">
          <div className="flex min-w-0 items-center justify-end gap-2 sm:gap-2.5">
            <TeamName team={away} align="right" />
            <ScoreLogo team={away} />
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3.5">
            <TickNumber value={awayScore} className={scoreCls} />
            <span className="font-mono text-[18px] text-[var(--faint)] sm:text-[20px]">–</span>
            <TickNumber value={homeScore} className={scoreCls} />
          </div>

          <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
            <ScoreLogo team={home} />
            <TeamName team={home} align="left" />
          </div>
        </div>

        {/* situational band */}
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-[var(--line)] px-5 py-3.5 sm:px-6">
          <div className="flex items-center gap-5 sm:gap-8">
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-[24px] font-semibold leading-none tabular-nums tracking-[-0.02em] text-[var(--text)]">
                {count.balls}
              </span>
              <span className="text-[var(--faint)]">–</span>
              <span className="font-mono text-[24px] font-semibold leading-none tabular-nums tracking-[-0.02em] text-[var(--text)]">
                {count.strikes}
              </span>
              <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--faint)]">
                count
              </span>
            </div>
            <CountPips count={count} outs={pitch.outs} />
            <Bases bases={pitch.bases} />
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--faint)] sm:inline">
              {venue}
            </span>
            {onTogglePause && (
              <button
                type="button"
                onClick={onTogglePause}
                className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--line-2)] bg-[var(--fill)] px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)] transition-colors hover:text-[var(--text)] focus:outline-none focus-visible:border-[var(--line-2)]"
                aria-pressed={paused}
              >
                {paused ? "▶ Resume" : "❚❚ Pause"}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function CallColumn({
  label,
  tone,
  children,
  className = "",
}: {
  label: string;
  tone: "model" | "text" | "faint";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col gap-2", className)}>
      <Eyebrow tone={tone}>{label}</Eyebrow>
      {children}
    </div>
  );
}

// ---- The next-pitch prediction hero ----------------------------------------
function PredictionHero({
  pitch,
  phase,
  batterName,
}: {
  pitch: ViewPitch;
  phase: Phase;
  batterName: string;
}) {
  const revealed = phase === "revealed";
  const p = pitch.predicted;
  const a = pitch.actual;
  const strikeout = revealed && /strikeout/i.test(pitch.abEnd ?? "");

  return (
    <Panel className="overflow-hidden">
      <PanelHead
        label="The next pitch"
        tone="text"
        right={
          revealed ? (
            <span className="text-[var(--muted)]">Resolved</span>
          ) : (
            <span className="flex items-center gap-1.5 text-[var(--model)]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--model)]" />
              Predicting
            </span>
          )
        }
      />
      <div className="border-b border-[var(--line)] px-5 py-2.5 text-[13px] text-[var(--muted)]">
        Now facing <span className="font-semibold text-[var(--text)]">{batterName}</span>
      </div>

      <div className="grid gap-6 px-5 py-7 sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-0">
        {/* PREDICTED */}
        <CallColumn label="Model predicts" tone="model" className="sm:pr-8">
          <div className="font-display text-[2.2rem] font-bold leading-none tracking-tight text-[var(--text)] sm:text-[2.7rem]">
            {p.pitchType}
          </div>
          <div className="mt-1 text-sm text-[var(--muted)]">{p.zone.label}</div>
          <div className="mt-2.5 text-sm text-[var(--muted)]">
            Likely <span className="font-semibold text-[var(--text)]">{p.outcome}</span>
          </div>
          <div className="mt-5 max-w-[16rem]">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--faint)]">
              Confidence
            </div>
            <Confidence value={p.confidence} />
          </div>
        </CallColumn>

        {/* STRIKE ZONE */}
        <div className="relative flex flex-col items-center gap-3 justify-self-center sm:border-x sm:border-[var(--line)] sm:px-9">
          <StrikeoutStamp key={pitch.index} show={strikeout} />
          <StrikeZone predictedZone={p.zone} actualZone={a.zone} revealed={revealed} />
          <div className="flex items-center gap-3.5 font-mono text-[9.5px] uppercase tracking-[0.16em]">
            <span className="flex items-center gap-1.5 text-[var(--model)]">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ boxShadow: "0 0 0 1.5px var(--model)", background: "var(--model-soft)" }}
              />{" "}
              Pred
            </span>
            {revealed && (
              <span className="flex items-center gap-1.5 text-[var(--muted)]">
                <span className="font-bold text-[var(--ink)]">×</span> Actual
              </span>
            )}
          </div>
        </div>

        {/* ACTUAL */}
        <CallColumn label="What happened" tone={revealed ? "text" : "faint"} className="sm:pl-8">
          {!revealed ? (
            <div className="flex min-h-[8rem] flex-col justify-center gap-3">
              <div className="h-8 w-2/3 animate-pulse rounded-[var(--r-chip)] bg-[var(--fill)]" />
              <div className="h-3.5 w-1/2 animate-pulse rounded-[var(--r-chip)] bg-[var(--fill)]" />
              <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--faint)]">
                Awaiting the pitch…
              </div>
            </div>
          ) : (
            <ResultFlash key={pitch.index} hit={pitch.outcomeHit}>
              <div className="min-h-[8rem]">
                <div className="flex items-baseline gap-2.5">
                  <span className="font-display text-[2.2rem] font-bold leading-none tracking-tight text-[var(--text)] sm:text-[2.7rem]">
                    {a.pitchType}
                  </span>
                  <span className="font-mono text-sm font-semibold tabular-nums text-[var(--muted)]">
                    {a.velo.toFixed(1)}
                  </span>
                </div>
                <div className="mt-1 text-sm text-[var(--muted)]">{a.zone.label}</div>
                <div className="mt-2.5 text-sm text-[var(--muted)]">
                  Result <span className="font-semibold text-[var(--text)]">{a.outcome}</span>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Verdict hit={pitch.typeHit} label="Type" />
                  <Verdict hit={pitch.outcomeHit} label="Outcome" />
                </div>
              </div>
            </ResultFlash>
          )}
        </CallColumn>
      </div>

      {revealed && pitch.abEnd && (
        <div className="border-t border-[var(--line)] bg-[var(--fill)] px-5 py-3 text-sm text-[var(--muted)]">
          <span className="font-semibold text-[var(--text)]">At-bat over.</span> {pitch.abEnd}
        </div>
      )}
    </Panel>
  );
}

// ---- Matchup ---------------------------------------------------------------
function PersonCard({
  role,
  name,
  teamAbbr,
  line,
  align = "left",
}: {
  role: string;
  name: string;
  teamAbbr: string;
  line: string;
  align?: "left" | "right";
}) {
  return (
    <div className={cx("flex flex-col gap-1", align === "right" && "items-end text-right")}>
      <Eyebrow>{role}</Eyebrow>
      <div className="text-[15px] font-semibold text-[var(--text)]">{name}</div>
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--faint)]">
        {teamAbbr}
      </div>
      <div className="mt-0.5 font-mono text-[11px] tabular-nums text-[var(--muted)]">{line}</div>
    </div>
  );
}

function Matchup({ game, pitch }: { game: Game; pitch: ViewPitch }) {
  const battingHome = pitch.half === "bottom";
  const battingSide = battingHome ? game.home : game.away;
  const fieldingSide = battingHome ? game.away : game.home;
  const pitcherLine = (battingHome ? game.probables.away : game.probables.home).line;
  const batterLine =
    (battingHome ? game.lineups.home : game.lineups.away).find((p) => p.name === pitch.batter)
      ?.line ?? "—";
  return (
    <Panel>
      <PanelHead label="Matchup" />
      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3 px-5 py-4 sm:gap-4">
        <PersonCard role="Pitching" name={pitch.pitcher} teamAbbr={fieldingSide.abbr} line={pitcherLine} />
        <span className="self-center font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--faint)]">
          vs
        </span>
        <PersonCard
          role="At bat"
          name={pitch.batter}
          teamAbbr={battingSide.abbr}
          line={batterLine}
          align="right"
        />
      </div>
    </Panel>
  );
}

// ---- Win probability (model) + compact Polymarket (market) reference -------
function WinProbPanel({
  away,
  home,
  series,
  marketHintText,
  showMarket,
}: {
  away: ViewTeam;
  home: ViewTeam;
  series: number[];
  marketHintText: string;
  showMarket: boolean;
}) {
  const homeP = series[series.length - 1];
  const prev = series.length > 1 ? series[series.length - 2] : homeP;
  const delta = homeP - prev;
  const fav = homeP >= 0.5 ? home : away;
  const favP = homeP >= 0.5 ? homeP : 1 - homeP;
  const dUp = delta > 0.005;
  const dDown = delta < -0.005;
  const reduce = useReducedMotion();
  const big = Math.abs(delta) >= 0.08;

  return (
    <Panel>
      <PanelHead label="Win probability" right="Live model" tone="model" />
      <div className="px-5 py-4">
        <WinProbBar away={away} home={home} homeP={homeP} />

        <div className="mt-4 flex items-end justify-between border-t border-[var(--line)] pt-4">
          <div className="flex items-center gap-2.5">
            <Monogram team={fav} size="sm" />
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--faint)]">
                {fav.name} favored
              </div>
              <div className="text-[13px] text-[var(--muted)]">
                <span className="font-semibold text-[var(--model)]">{pct(favP)}%</span> to win it
              </div>
            </div>
          </div>
          <div
            className="flex items-center gap-1 font-mono text-xs font-semibold tabular-nums"
            style={{ color: dUp ? "var(--model)" : dDown ? "var(--live)" : "var(--faint)" }}
          >
            <motion.span
              key={Math.round(homeP * 1000)}
              className="inline-flex items-center gap-1"
              initial={reduce ? false : { scale: big ? 1.55 : 1.18, opacity: 0.5 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 360, damping: big ? 14 : 20 }}
            >
              {dUp ? "▲" : dDown ? "▼" : "—"} {Math.abs(pct(delta))}
            </motion.span>
            <span className="font-normal text-[var(--faint)]">pts {home.abbr}</span>
          </div>
        </div>
        <div className="mt-4 h-12">
          <WinProbChart series={series} />
        </div>
        <div className="mt-2 flex justify-between font-mono text-[9.5px] uppercase tracking-[0.16em] text-[var(--faint)]">
          <span>1st pitch</span>
          <span>now</span>
        </div>

        {showMarket && (
          <div className="mt-4 border-t border-[var(--line)] pt-3.5">
            <PolymarketTicker teamHint={marketHintText} poll />
          </div>
        )}
      </div>
    </Panel>
  );
}

// ---- Model accuracy --------------------------------------------------------
function StatBlock({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="font-mono text-[24px] font-semibold leading-none tabular-nums tracking-[-0.01em] text-[var(--text)]">
        {value}
      </div>
      <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--faint)]">
        {label}
        {sub && <span className="text-[var(--muted)]"> · {sub}</span>}
      </div>
    </div>
  );
}

function AccuracyPanel({ history }: { history: ViewPitch[] }) {
  const n = history.length;
  const typeHits = history.filter((h) => h.typeHit).length;
  const outcomeHits = history.filter((h) => h.outcomeHit).length;
  const acc = n ? Math.round((outcomeHits / n) * 100) : 0;
  return (
    <Panel>
      <PanelHead label="Model accuracy" right={`${String(n).padStart(2, "0")} tracked`} tone="model" />
      <div className="px-5 py-4">
        <div className="flex items-end gap-3">
          <span className="font-mono text-[3.4rem] font-semibold leading-[0.8] tabular-nums tracking-[-0.03em] text-[var(--model)]">
            {n ? acc : "–"}
            {n ? <span className="text-2xl text-[var(--muted)]">%</span> : null}
          </span>
          <span className="mb-1.5 font-mono text-[10px] uppercase leading-snug tracking-[0.16em] text-[var(--faint)]">
            outcome calls
            <br />
            correct
          </span>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-[var(--line)] pt-4">
          <StatBlock label="Pitch type" value={n ? `${Math.round((typeHits / n) * 100)}%` : "—"} sub={`${typeHits}/${n}`} />
          <StatBlock label="Outcome" value={n ? `${acc}%` : "—"} sub={`${outcomeHits}/${n}`} />
        </div>
      </div>
    </Panel>
  );
}

// ---- Pitch feed ------------------------------------------------------------
function FeedRow({ item, prevWp }: { item: ViewPitch; prevWp?: number }) {
  const reduce = useReducedMotion();
  const { predicted: p, actual: a, typeHit, outcomeHit } = item;
  const dwp = prevWp != null ? Math.round((item.homeWinProbAfter - prevWp) * 100) : 0;
  const pulse = outcomeHit ? "rgba(63,185,80,0.20)" : "rgba(255,91,97,0.20)";
  return (
    <motion.div
      layout
      initial={reduce ? false : { opacity: 0, y: -12, backgroundColor: pulse }}
      animate={{ opacity: 1, y: 0, backgroundColor: "rgba(0,0,0,0)" }}
      exit={{ opacity: 0 }}
      transition={{
        default: { duration: 0.32, ease: [0.22, 1, 0.36, 1] },
        backgroundColor: { duration: 1.2, ease: "easeOut" },
      }}
      className="grid grid-cols-[1.9rem_1fr_1fr_auto] items-center gap-3 px-4 py-3 sm:px-5"
    >
      <span className="font-mono text-[11px] tabular-nums text-[var(--faint)]">
        {String(item.index + 1).padStart(2, "0")}
      </span>
      <div className="min-w-0">
        <div className="truncate text-[13px] font-medium text-[var(--muted)]">{p.pitchType}</div>
        <div className="truncate font-mono text-[10.5px] text-[var(--faint)]">{p.outcome}</div>
      </div>
      <div className="min-w-0">
        <div className="truncate text-[13px] font-medium text-[var(--text)]">
          {a.pitchType}{" "}
          <span className="font-mono text-[11px] tabular-nums text-[var(--faint)]">
            {a.velo.toFixed(0)}
          </span>
        </div>
        <div className="truncate font-mono text-[10.5px] text-[var(--muted)]">{a.outcome}</div>
      </div>
      <div className="flex items-center gap-2.5">
        {dwp !== 0 && (
          <span className="hidden w-8 text-right font-mono text-[10px] tabular-nums text-[var(--faint)] sm:inline">
            {dwp > 0 ? "▲" : "▼"}
            {Math.abs(dwp)}
          </span>
        )}
        <div className="flex gap-1.5">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: typeHit ? "var(--hit)" : "var(--miss)" }}
            title={`Pitch type — ${typeHit ? "hit" : "miss"}`}
          />
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: outcomeHit ? "var(--hit)" : "var(--miss)" }}
            title={`Outcome — ${outcomeHit ? "hit" : "miss"}`}
          />
        </div>
      </div>
    </motion.div>
  );
}

function PitchFeed({ history }: { history: ViewPitch[] }) {
  return (
    <Panel className="overflow-hidden">
      <PanelHead
        label="Pitch-by-pitch"
        right={
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: "var(--hit)" }} /> hit
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: "var(--miss)" }} /> miss
            </span>
          </span>
        }
      />
      {history.length === 0 ? (
        <div className="px-5 py-12 text-center font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">
          Waiting for the first pitch to resolve…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-[1.9rem_1fr_1fr_auto] items-center gap-3 border-b border-[var(--line)] px-4 py-2 font-mono text-[9.5px] uppercase tracking-[0.16em] sm:px-5">
            <span className="text-[var(--faint)]">#</span>
            <span className="text-[var(--model)]">Predicted</span>
            <span className="text-[var(--text)]">Actual</span>
            <span className="text-right text-[var(--faint)]">Δwp · T O</span>
          </div>
          <div className="divide-y divide-[var(--line)]">
            <AnimatePresence initial={false}>
              {history.map((item, i) => (
                <FeedRow key={item.index} item={item} prevWp={history[i + 1]?.homeWinProbAfter} />
              ))}
            </AnimatePresence>
          </div>
        </>
      )}
    </Panel>
  );
}

// ---- Shared layout shell ---------------------------------------------------
function GameLayout({
  game,
  current,
  phase,
  status,
  history,
  series,
  paused,
  onTogglePause,
}: {
  game: Game;
  current: ViewPitch;
  phase: Phase;
  status: CardStatus;
  history: ViewPitch[];
  series: number[];
  paused: boolean;
  onTogglePause?: () => void;
}) {
  const away = viewTeam(game.away);
  const home = viewTeam(game.home);
  const half = current.half === "bottom" ? "Bot" : "Top";
  const revealed = phase === "revealed";
  const awayScore = revealed ? current.awayScoreAfter : current.awayScore;
  const homeScore = revealed ? current.homeScoreAfter : current.homeScore;
  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-4 sm:px-6">
      <Reveal>
        <Scoreboard
          away={away}
          home={home}
          awayScore={awayScore}
          homeScore={homeScore}
          status={status}
          half={half}
          inning={current.inning}
          venue={game.venue}
          pitch={current}
          phase={phase}
          paused={paused}
          onTogglePause={onTogglePause}
        />
        <div className="mt-4 grid gap-4 lg:grid-cols-[1.55fr_1fr]">
          <div className="flex flex-col gap-4">
            <PredictionHero pitch={current} phase={phase} batterName={current.batter} />
            <Matchup game={game} pitch={current} />
          </div>
          <div className="flex flex-col gap-4">
            <WinProbPanel
              away={away}
              home={home}
              series={series}
              marketHintText={marketHint(game)}
              showMarket={status !== "final"}
            />
            <AccuracyPanel history={history} />
          </div>
        </div>
        <div className="mt-4">
          <PitchFeed history={history} />
        </div>
      </Reveal>
    </main>
  );
}

// ---- Live: predict -> reveal ticker over the mock event script -------------
function LiveGameView({ game }: { game: Game }) {
  const events = game.events;
  const start = Math.min(game.liveIndex, events.length - 1);
  const initialConsumed = events.slice(0, start);

  const [idx, setIdx] = useState(start);
  const [phase, setPhase] = useState<Phase>("predicting");
  const [paused, setPaused] = useState(false);
  const [history, setHistory] = useState<ViewPitch[]>(() =>
    initialConsumed.map(viewPitch).reverse().slice(0, 16),
  );
  const [series, setSeries] = useState<number[]>(() => {
    const s = initialConsumed.map((e) => e.homeWinProb);
    return s.length ? s.slice(-26) : [game.pregameHomeWinProb];
  });

  const finished = idx >= events.length;
  const clampedIdx = Math.min(idx, events.length - 1);
  const current = viewPitch(events[clampedIdx]);

  useEffect(() => {
    if (paused || finished) return;
    let timer: ReturnType<typeof setTimeout>;
    if (phase === "predicting") {
      timer = setTimeout(() => {
        const vp = viewPitch(events[clampedIdx]);
        setHistory((h) => [vp, ...h].slice(0, 16));
        setSeries((s) => [...s, vp.homeWinProbAfter].slice(-26));
        setPhase("revealed");
      }, PREDICT_MS);
    } else {
      timer = setTimeout(() => {
        setIdx((i) => i + 1);
        setPhase("predicting");
      }, REVEAL_MS);
    }
    return () => clearTimeout(timer);
  }, [phase, paused, finished, clampedIdx, events]);

  return (
    <GameLayout
      game={game}
      current={current}
      phase={finished ? "revealed" : phase}
      status={finished ? "final" : "live"}
      history={history}
      series={series}
      paused={paused}
      onTogglePause={finished ? undefined : () => setPaused((p) => !p)}
    />
  );
}

// ---- Final: static recap of a completed game -------------------------------
function FinalGameView({ game }: { game: Game }) {
  const all = game.events.map(viewPitch);
  const last = all[all.length - 1];
  const history = all.slice().reverse().slice(0, 16);
  const series = game.events.map((e) => e.homeWinProb).slice(-26);
  return (
    <GameLayout
      game={game}
      current={last}
      phase="revealed"
      status="final"
      history={history}
      series={series.length ? series : [game.pregameHomeWinProb]}
      paused={false}
    />
  );
}

// ---- Pregame: model read before first pitch --------------------------------
function PreGameView({ game }: { game: Game }) {
  const away = viewTeam(game.away);
  const home = viewTeam(game.home);
  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-4 sm:px-6">
      <section className="liquid-glass relative overflow-hidden rounded-[var(--r-card)]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: teamSplit(away.primaryColor, home.primaryColor, "40") }}
        />
        <div className="relative">
          <div className="h-[3px] w-full" style={{ background: teamRule(away, home) }} />
          <div className="flex items-center justify-center gap-3 px-5 py-5 sm:gap-6 sm:px-6">
            <div className="flex items-center gap-2.5">
              <Monogram team={away} size="md" />
              <span className="text-[15px] font-semibold text-[var(--text)] sm:text-[17px]">
                <span className="sm:hidden">{away.abbr}</span>
                <span className="hidden sm:inline">{away.name}</span>
              </span>
            </div>
            <span className="font-mono text-[12px] uppercase tracking-[0.16em] text-[var(--faint)]">
              at
            </span>
            <div className="flex items-center gap-2.5">
              <span className="text-[15px] font-semibold text-[var(--text)] sm:text-[17px]">
                <span className="sm:hidden">{home.abbr}</span>
                <span className="hidden sm:inline">{home.name}</span>
              </span>
              <Monogram team={home} size="md" />
            </div>
          </div>
          <div className="flex items-center justify-center border-t border-[var(--line)] px-5 py-2.5">
            <StatusTag status="upcoming" startLabel={game.startTime} />
          </div>
        </div>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.55fr_1fr]">
        <Panel className="overflow-hidden">
          <PanelHead label="Pregame model read" tone="model" />
          <div className="px-5 py-5">
            <WinProbBar away={away} home={home} homeP={game.pregameHomeWinProb} />
            <div className="mt-5 grid gap-4 border-t border-[var(--line)] pt-5 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <Eyebrow>Probable · {away.abbr}</Eyebrow>
                <div className="text-[15px] font-semibold text-[var(--text)]">
                  {game.probables.away.name}
                </div>
                <div className="font-mono text-[11px] tabular-nums text-[var(--muted)]">
                  {game.probables.away.line}
                </div>
              </div>
              <div className="flex flex-col gap-1 sm:items-end sm:text-right">
                <Eyebrow>Probable · {home.abbr}</Eyebrow>
                <div className="text-[15px] font-semibold text-[var(--text)]">
                  {game.probables.home.name}
                </div>
                <div className="font-mono text-[11px] tabular-nums text-[var(--muted)]">
                  {game.probables.home.line}
                </div>
              </div>
            </div>
            <p className="mt-5 max-w-md text-[13px] leading-relaxed text-[var(--muted)]">
              First pitch at {game.startTime}. The pitch-by-pitch read begins once the game goes live.
            </p>
          </div>
        </Panel>

        <Panel>
          <PanelHead label="Market reference" right="Polymarket" />
          <div className="px-5 py-5">
            <PolymarketTicker teamHint={marketHint(game)} poll />
            <p className="mt-4 text-[12px] leading-relaxed text-[var(--faint)]">
              Live Polymarket odds for a current MLB game — a reference to compare against the
              model&rsquo;s read.
            </p>
          </div>
        </Panel>
      </div>
    </main>
  );
}

export function GameView({ id }: { id: string }) {
  const game = getGame(id);
  if (!game) notFound();
  if (game.status === "upcoming") return <PreGameView game={game} />;
  if (game.status === "final") return <FinalGameView game={game} />;
  return <LiveGameView game={game} />;
}
