"use client";

/* DiamondAI — Schedule (home). Flat solid cards over an MLB-red/white aurora,
   liquid-glass on the hero stat strip, per-team gradient accents, hover sheen,
   and a compact Polymarket reference on upcoming/live games. The whole card is
   a stretched primary link; the Polymarket "Open" link sits above it. */
import Link from "next/link";
import {
  Bases,
  CountPips,
  Eyebrow,
  LeanBar,
  Monogram,
  StatusTag,
  type CardStatus,
} from "@/components/ui/primitives";
import { Reveal, StaggerGroup, StaggerItem, TickNumber } from "@/components/ui/motion";
import { PolymarketTicker } from "@/components/game/PolymarketTicker";
import { useLiveGame } from "@/components/useLiveGame";
import { getGames, SCHEDULE_DATE } from "@/lib/mock";
import type { Game } from "@/lib/types";
import { cx, pct, teamSplit } from "@/lib/ui";
import { viewPitch, viewTeam, type ViewPitch, type ViewTeam } from "@/lib/view";

const gameUrl = (id: string) => `/game/${id}`;
const teamHint = (g: Game) => `${g.home.city} ${g.home.name}`;
const teamRule = (a: ViewTeam, b: ViewTeam) =>
  `linear-gradient(90deg, ${a.primaryColor}, ${b.primaryColor})`;

interface Display {
  status: CardStatus;
  awayScore: number;
  homeScore: number;
  inning: number;
  half: "Top" | "Bot";
  homeWinProb: number;
  recent: ViewPitch[];
  count: { balls: number; strikes: number };
  outs: number;
  bases: { first: boolean; second: boolean; third: boolean };
}

/** Normalize a game's live cursor into the fields the cards read. */
function useDisplay(game: Game): Display {
  const ls = useLiveGame(game);
  const status = ls.status;
  const snap = ls.snap;
  const cur = ls.next ?? null;
  const homeWinProb =
    status === "upcoming"
      ? game.pregameHomeWinProb
      : (ls.last?.homeWinProb ?? game.pregameHomeWinProb);
  return {
    status,
    awayScore: snap?.awayScore ?? 0,
    homeScore: snap?.homeScore ?? 0,
    inning: snap?.inning ?? 1,
    half: snap?.half === "bottom" ? "Bot" : "Top",
    homeWinProb,
    recent: ls.consumed.slice(-3).reverse().map(viewPitch),
    count: { balls: cur?.pre.balls ?? 0, strikes: cur?.pre.strikes ?? 0 },
    outs: cur?.pre.outs ?? 0,
    bases: {
      first: cur?.pre.bases[0] ?? false,
      second: cur?.pre.bases[1] ?? false,
      third: cur?.pre.bases[2] ?? false,
    },
  };
}

// Logo that gently scales when its card is hovered.
function HoverLogo({ team, size }: { team: ViewTeam; size: "sm" | "md" | "lg" }) {
  return (
    <span className="inline-flex transition-transform duration-300 ease-out group-hover:scale-[1.07]">
      <Monogram team={team} size={size} />
    </span>
  );
}

function TeamRow({
  team,
  score,
  show,
  lead,
  dim,
  size = "md",
}: {
  team: ViewTeam;
  score: number;
  show: boolean;
  lead?: boolean;
  dim?: boolean;
  size?: "md" | "lg";
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <HoverLogo team={team} size={size} />
        <div className="min-w-0 flex-1 leading-tight">
          <div
            className={cx(
              "truncate font-semibold tracking-[-0.01em]",
              size === "lg" ? "text-[18px] sm:text-[19px]" : "text-[16px]",
              dim ? "text-[var(--muted)]" : "text-[var(--text)]",
            )}
          >
            {team.name}
          </div>
          <div className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--faint)]">
            {team.city}
          </div>
        </div>
      </div>
      {show && (
        <div className="flex items-center gap-2.5">
          {lead && (
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--text)]" aria-label="leading" />
          )}
          <TickNumber
            value={score}
            className={cx(
              "shrink-0 font-mono font-semibold leading-none tabular-nums tracking-[-0.03em]",
              size === "lg" ? "text-[32px] sm:text-[34px]" : "text-[28px] sm:text-[30px]",
              dim ? "text-[var(--faint)]" : "text-[var(--text)]",
            )}
          />
        </div>
      )}
    </div>
  );
}

// Stretched primary link covering a card; secondary links (ticker) sit above.
function CardLink({ id, label }: { id: string; label: string }) {
  return (
    <Link
      href={gameUrl(id)}
      aria-label={label}
      className="absolute inset-0 z-[1] rounded-[inherit] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--model)]"
    />
  );
}

function GameCard({ game }: { game: Game }) {
  const d = useDisplay(game);
  const away = viewTeam(game.away);
  const home = viewTeam(game.home);
  const final = d.status === "final";
  const upcoming = d.status === "upcoming";
  const showScore = final;
  const leadAway = showScore && d.awayScore > d.homeScore;
  const leadHome = showScore && d.homeScore > d.awayScore;
  const homePctn = pct(d.homeWinProb);
  const leanTeam = homePctn >= 50 ? home.abbr : away.abbr;
  const leanPct = Math.max(homePctn, 100 - homePctn);

  return (
    <div
      className="surface surface-hover group relative isolate flex h-full flex-col overflow-hidden"
      style={{ backgroundImage: teamSplit(away.primaryColor, home.primaryColor, "14") }}
    >
      <div
        className="h-[2px] w-full opacity-80 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: teamRule(away, home) }}
      />
      <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-5 py-3">
        <StatusTag status={d.status} startLabel={game.startTime} />
        <span className="min-w-0 truncate font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--faint)]">
          {game.venue}
        </span>
      </div>

      <div className="flex flex-col gap-3.5 px-5 py-4">
        <TeamRow team={away} score={d.awayScore} show={showScore} lead={leadAway} dim={final && leadHome} />
        <TeamRow team={home} score={d.homeScore} show={showScore} lead={leadHome} dim={final && leadAway} />
      </div>

      {upcoming && (
        <div className="flex items-center justify-between border-t border-[var(--line)] px-5 py-3.5">
          <div className="flex flex-col gap-0.5">
            <Eyebrow>First pitch</Eyebrow>
            <span className="font-mono text-[13px] tabular-nums text-[var(--text)]">
              {game.startTime}
            </span>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <Eyebrow tone="model">Model lean</Eyebrow>
            <span className="whitespace-nowrap font-mono text-[14px] font-semibold tabular-nums text-[var(--model)]">
              {leanTeam} {leanPct}%
            </span>
          </div>
        </div>
      )}
      {final && (
        <div className="flex items-center justify-between border-t border-[var(--line)] px-5 py-3.5">
          <Eyebrow>Result</Eyebrow>
          <span className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
            {(d.homeScore > d.awayScore ? home : away).abbr} win ·{" "}
            {Math.max(d.homeScore, d.awayScore)}–{Math.min(d.homeScore, d.awayScore)}
          </span>
        </div>
      )}

      {upcoming && (
        <div className="mt-auto border-t border-[var(--line)] px-5 py-3.5">
          <PolymarketTicker teamHint={teamHint(game)} />
        </div>
      )}

      <span aria-hidden className="sheen" />
      <CardLink id={game.id} label={`Open ${away.name} at ${home.name}`} />
    </div>
  );
}

function MiniCall({ p }: { p: ViewPitch }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="w-6 shrink-0 font-mono text-[11px] tabular-nums text-[var(--faint)]">
        {String(p.index + 1).padStart(2, "0")}
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--muted)]">
        <span className="text-[var(--faint)]">pred</span> {p.predicted.pitchType}
        <span className="px-1.5 text-[var(--faint)]">→</span>
        <span className="font-medium text-[var(--text)]">{p.actual.pitchType}</span>
      </span>
      <span className="flex shrink-0 gap-1.5">
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: p.typeHit ? "var(--hit)" : "var(--miss)" }}
          title={`Pitch type — ${p.typeHit ? "hit" : "miss"}`}
        />
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: p.outcomeHit ? "var(--hit)" : "var(--miss)" }}
          title={`Outcome — ${p.outcomeHit ? "hit" : "miss"}`}
        />
      </span>
    </div>
  );
}

function Spotlight({ game }: { game: Game }) {
  const d = useDisplay(game);
  const away = viewTeam(game.away);
  const home = viewTeam(game.home);
  const homeFav = d.homeWinProb >= 0.5;
  const fav = homeFav ? home : away;
  const favP = pct(homeFav ? d.homeWinProb : 1 - d.homeWinProb);

  return (
    <div
      className="surface surface-hover group relative isolate overflow-hidden"
      style={{ backgroundImage: teamSplit(away.primaryColor, home.primaryColor, "1c") }}
    >
      <div className="h-[2px] w-full" style={{ background: teamRule(away, home) }} />
      <div className="flex items-center justify-between gap-2 px-5 py-3 sm:px-7">
        <div className="flex items-center gap-2.5">
          <StatusTag status={d.status} startLabel={game.startTime} />
          <span className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
            {d.half} {d.inning}
          </span>
        </div>
        <span className="hidden whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--faint)] sm:inline">
          {game.venue}
        </span>
      </div>

      <div className="grid gap-px bg-[var(--line)] lg:grid-cols-[1.15fr_1fr]">
        {/* left — the game */}
        <div className="bg-[var(--surface)] px-5 py-6 sm:px-7">
          <div className="flex flex-col gap-5">
            <TeamRow team={away} score={d.awayScore} show lead={d.awayScore > d.homeScore} size="lg" />
            <TeamRow team={home} score={d.homeScore} show lead={d.homeScore > d.awayScore} size="lg" />
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-4 border-t border-[var(--line)] pt-5 sm:gap-7">
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-[24px] font-semibold leading-none tabular-nums tracking-[-0.02em] text-[var(--text)]">
                {d.count.balls}
              </span>
              <span className="text-[var(--faint)]">–</span>
              <span className="font-mono text-[24px] font-semibold leading-none tabular-nums tracking-[-0.02em] text-[var(--text)]">
                {d.count.strikes}
              </span>
              <span className="ml-1.5 font-mono text-[9.5px] uppercase tracking-[0.16em] text-[var(--faint)]">
                count
              </span>
            </div>
            <CountPips count={d.count} outs={d.outs} />
            <Bases bases={d.bases} />
          </div>
        </div>

        {/* right — the model */}
        <div className="bg-[var(--surface)] px-5 py-6 sm:px-7">
          <div className="flex items-end justify-between">
            <div>
              <Eyebrow tone="model" className="mb-2">
                Model · win prob
              </Eyebrow>
              <div className="flex items-center gap-2.5">
                <Monogram team={fav} size="sm" />
                <span className="font-mono text-[2.6rem] font-semibold leading-[0.85] tabular-nums tracking-[-0.03em] text-[var(--model)]">
                  {favP}
                  <span className="text-xl text-[var(--muted)]">%</span>
                </span>
              </div>
            </div>
            <span className="mb-1 whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--faint)]">
              {fav.abbr} favored
            </span>
          </div>
          <div className="mt-4">
            <LeanBar homeWinProb={d.homeWinProb} away={away} home={home} />
          </div>

          <div className="mt-4 border-t border-[var(--line)] pt-3">
            <PolymarketTicker teamHint={teamHint(game)} poll />
          </div>

          <div className="mt-4 border-t border-[var(--line)] pt-3">
            <div className="mb-1 flex items-center justify-between">
              <Eyebrow>Latest calls</Eyebrow>
              <span className="flex items-center gap-2.5 font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--faint)]">
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--hit)" }} />
                  hit
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--miss)" }} />
                  miss
                </span>
              </span>
            </div>
            <div className="divide-y divide-[var(--line)]">
              {d.recent.length > 0 ? (
                d.recent.map((p) => <MiniCall key={p.index} p={p} />)
              ) : (
                <div className="py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--faint)]">
                  Awaiting first pitch…
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-center gap-2 whitespace-nowrap rounded-full border border-[var(--line-2)] bg-[var(--fill)] py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text)] transition-colors group-hover:bg-[var(--fill-hi)]">
            Open live game{" "}
            <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
          </div>
        </div>
      </div>

      <span aria-hidden className="sheen" />
      <CardLink id={game.id} label={`Open live game: ${away.name} at ${home.name}`} />
    </div>
  );
}

function StatCell({ label, value, accent }: { label: string; value: React.ReactNode; accent?: string }) {
  return (
    <div className="flex-1 px-4 py-3.5 text-center sm:px-5">
      <div
        className="font-mono text-[22px] font-semibold leading-none tabular-nums tracking-[-0.02em]"
        style={{ color: accent || "var(--text)" }}
      >
        {value}
      </div>
      <div className="mt-1.5 whitespace-nowrap font-mono text-[9.5px] uppercase tracking-[0.14em] text-[var(--faint)]">
        {label}
      </div>
    </div>
  );
}

function SectionHead({ label, count }: { label: string; count: number }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <Eyebrow tone="text">{label}</Eyebrow>
      <span className="font-mono text-[11px] tabular-nums text-[var(--faint)]">
        {String(count).padStart(2, "0")}
      </span>
      <div className="h-px flex-1 bg-[var(--line)]" />
    </div>
  );
}

export function Schedule() {
  const games = getGames();
  const live = games.filter((g) => g.status === "live");
  const pre = games.filter((g) => g.status === "upcoming");
  const finals = games.filter((g) => g.status === "final");

  return (
    <main className="mx-auto max-w-6xl px-4 pb-20 pt-4 sm:px-6">
      {/* centered hero — the aurora glows behind it (mounted at the page top) */}
      <header className="mb-12 flex flex-col items-center pt-6 text-center sm:pt-10">
        <Reveal className="flex flex-col items-center">
          <Eyebrow tone="muted" className="mb-4">
            {SCHEDULE_DATE} · 2026
          </Eyebrow>
          <h1 className="font-display text-[2.5rem] font-bold leading-[0.95] tracking-tight text-[var(--text)] sm:text-[3.6rem]">
            Every pitch, predicted.
          </h1>
          <div className="accent-rule mt-5 w-16" />
          <p className="mt-5 max-w-md text-[14px] leading-relaxed text-[var(--muted)] sm:text-[15px]">
            Live win probability and the model&rsquo;s call on the next pitch, side by side with what
            actually happens.
          </p>
        </Reveal>
        <Reveal delay={0.12} className="mt-8 w-full max-w-md sm:w-auto">
          <div className="liquid-glass flex divide-x divide-[var(--line)] overflow-hidden rounded-[var(--r-card)]">
            <StatCell label="Live now" value={live.length} accent="var(--live)" />
            <StatCell label="Model acc" value="73%" accent="var(--model)" />
            <StatCell label="Pitches scored" value="2,481" />
          </div>
        </Reveal>
      </header>

      {live.length > 0 && (
        <section className="mb-12">
          <SectionHead label="Live now" count={live.length} />
          <div className="flex flex-col gap-6">
            {live.map((g, i) => (
              <Reveal key={g.id} delay={i * 0.06}>
                <Spotlight game={g} />
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {pre.length > 0 && (
        <section className="mb-12">
          <SectionHead label="Upcoming" count={pre.length} />
          <StaggerGroup className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {pre.map((g) => (
              <StaggerItem key={g.id} className="h-full">
                <GameCard game={g} />
              </StaggerItem>
            ))}
          </StaggerGroup>
        </section>
      )}
      {finals.length > 0 && (
        <section className="mb-12">
          <SectionHead label="Final" count={finals.length} />
          <StaggerGroup className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {finals.map((g) => (
              <StaggerItem key={g.id} className="h-full">
                <GameCard game={g} />
              </StaggerItem>
            ))}
          </StaggerGroup>
        </section>
      )}

      {games.length === 0 && (
        <div className="surface py-16 text-center font-mono text-sm uppercase tracking-[0.16em] text-[var(--faint)]">
          No games scheduled
        </div>
      )}
    </main>
  );
}
