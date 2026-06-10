"use client";

/* DiamondAI — Schedule (home) screen, ported from design/schedule.jsx and
   bound to the mock slate + the simulated live ticker. */
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
import { useLiveGame } from "@/components/useLiveGame";
import { getGames, SCHEDULE_DATE } from "@/lib/mock";
import type { Game } from "@/lib/types";
import { cx, pct } from "@/lib/ui";
import { viewPitch, viewTeam, type ViewPitch, type ViewTeam } from "@/lib/view";

const gameUrl = (id: string) => `/game/${id}`;

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

/** Normalize a game's live cursor into the fields the design's cards read. */
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

function TeamRow({
  team,
  score,
  show,
  lead,
  dim,
}: {
  team: ViewTeam;
  score: number;
  show: boolean;
  lead?: boolean;
  dim?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Monogram team={team} size="md" />
        <div className="min-w-0 flex-1 leading-tight">
          <div
            className={cx(
              "truncate text-[16px] font-semibold tracking-[-0.01em]",
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
              "shrink-0 font-mono text-[30px] font-semibold leading-none tabular-nums tracking-[-0.03em]",
              dim ? "text-[var(--faint)]" : "text-[var(--text)]",
            )}
          />
        </div>
      )}
    </div>
  );
}

function GameCard({ game }: { game: Game }) {
  const d = useDisplay(game);
  const away = viewTeam(game.away);
  const home = viewTeam(game.home);
  const live = d.status === "live";
  const final = d.status === "final";
  const showScore = live || final;
  const leadAway = showScore && d.awayScore > d.homeScore;
  const leadHome = showScore && d.homeScore > d.awayScore;
  const homePctn = pct(d.homeWinProb);

  const inner = (
    <>
      <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-5 py-3.5">
        <div className="flex shrink-0 items-center gap-2.5">
          <StatusTag status={d.status} startLabel={game.startTime} />
          {live && (
            <span className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
              {d.half} {d.inning}
            </span>
          )}
        </div>
        <span className="min-w-0 truncate font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--faint)]">
          {game.venue}
        </span>
      </div>

      <div className="flex flex-col gap-4 px-5 py-5">
        <TeamRow team={away} score={d.awayScore} show={showScore} lead={leadAway} dim={final && leadHome} />
        <TeamRow team={home} score={d.homeScore} show={showScore} lead={leadHome} dim={final && leadAway} />
      </div>

      {live && (
        <div className="border-t border-[var(--line)] px-5 py-4">
          <div className="mb-2.5 flex items-center justify-between">
            <Eyebrow>Win probability</Eyebrow>
            <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--model)] opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              Watch live →
            </span>
          </div>
          <LeanBar homeWinProb={d.homeWinProb} away={away} home={home} />
        </div>
      )}
      {d.status === "upcoming" && (
        <div className="flex items-center justify-between border-t border-[var(--line)] px-5 py-4">
          <div className="flex flex-col gap-0.5">
            <Eyebrow>First pitch</Eyebrow>
            <span className="font-mono text-[13px] tabular-nums text-[var(--text)]">
              {game.startTime}
            </span>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <Eyebrow>Model lean</Eyebrow>
            <span className="whitespace-nowrap font-mono text-[13px] tabular-nums text-[var(--muted)]">
              {homePctn >= 50 ? home.abbr : away.abbr} {Math.max(homePctn, 100 - homePctn)}%
            </span>
          </div>
        </div>
      )}
      {final && (
        <div className="flex items-center justify-between border-t border-[var(--line)] px-5 py-4">
          <Eyebrow>Result</Eyebrow>
          <span className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
            {(d.homeScore > d.awayScore ? home : away).abbr} win ·{" "}
            {Math.max(d.homeScore, d.awayScore)}–{Math.min(d.homeScore, d.awayScore)}
          </span>
        </div>
      )}
    </>
  );

  if (live) {
    return (
      <Link
        href={gameUrl(game.id)}
        aria-label={`Open live game: ${away.name} at ${home.name}`}
        className="group glass-panel glass-hover flex h-full flex-col overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--model)]"
      >
        {inner}
      </Link>
    );
  }
  return (
    <div className="glass-panel flex h-full flex-col overflow-hidden opacity-[0.92]">{inner}</div>
  );
}

function MiniCall({ p }: { p: ViewPitch }) {
  return (
    <div className="flex items-center gap-3 py-2">
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
    <Link
      href={gameUrl(game.id)}
      aria-label={`Open featured live game: ${away.name} at ${home.name}`}
      className="group glass-panel glass-hover block overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--model)]"
    >
      <div className="accent-rule" />
      <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-5 py-3.5 sm:px-7">
        <div className="flex items-center gap-2.5">
          <StatusTag status={d.status} startLabel={game.startTime} />
          <span className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
            Featured · {d.half} {d.inning}
          </span>
        </div>
        <span className="hidden whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--faint)] sm:inline">
          {game.venue}
        </span>
      </div>

      <div className="grid gap-px bg-[var(--line)] lg:grid-cols-[1.15fr_1fr]">
        {/* left — the game */}
        <div className="bg-transparent px-5 py-6 sm:px-7">
          <div className="flex flex-col gap-5">
            <TeamRow team={away} score={d.awayScore} show lead={d.awayScore > d.homeScore} />
            <TeamRow team={home} score={d.homeScore} show lead={d.homeScore > d.awayScore} />
          </div>
          <div className="mt-6 flex items-center gap-7 border-t border-[var(--line)] pt-5">
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
        <div className="bg-transparent px-5 py-6 sm:px-7">
          <div className="flex items-end justify-between">
            <div>
              <Eyebrow tone="model" className="mb-2">
                Model · win prob
              </Eyebrow>
              <div className="flex items-center gap-2.5">
                <Monogram team={fav} size="sm" />
                <span className="font-mono text-[2.6rem] font-semibold leading-[0.85] tabular-nums tracking-[-0.03em] text-[var(--text)]">
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

          <div className="mt-5 border-t border-[var(--line)] pt-3">
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
                <div className="py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--faint)]">
                  Awaiting first pitch…
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 flex items-center justify-center gap-2 whitespace-nowrap rounded-full border border-[var(--glass-border)] bg-[var(--fill)] py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text)] transition-[background-color,border-color] group-hover:border-[var(--glass-border-hi)] group-hover:bg-[var(--fill-hi)]">
            Open live game{" "}
            <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function StatCell({ label, value, accent }: { label: string; value: React.ReactNode; accent?: string }) {
  return (
    <div className="flex-1 px-5 py-3.5">
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

function ScheduleSection({
  label,
  count,
  children,
}: {
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-11">
      <div className="mb-4 flex items-center gap-3">
        <Eyebrow tone="text">{label}</Eyebrow>
        <span className="font-mono text-[11px] tabular-nums text-[var(--faint)]">
          {String(count).padStart(2, "0")}
        </span>
        <div className="h-px flex-1 bg-[var(--line)]" />
      </div>
      <StaggerGroup className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{children}</StaggerGroup>
    </section>
  );
}

export function Schedule() {
  const games = getGames();
  const live = games.filter((g) => g.status === "live");
  const pre = games.filter((g) => g.status === "upcoming");
  const finals = games.filter((g) => g.status === "final");

  return (
    <main className="mx-auto max-w-6xl px-4 pb-20 pt-7 sm:px-6 sm:pt-9">
      <header className="mb-10 flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
        <Reveal>
          <Eyebrow tone="muted" className="mb-3">
            {SCHEDULE_DATE} · 2026
          </Eyebrow>
          <h1 className="font-display text-[2.6rem] font-bold leading-[0.95] tracking-tight text-[var(--text)] sm:text-[3.4rem]">
            Today&rsquo;s slate
          </h1>
          <div className="accent-rule mt-5 w-20" />
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[var(--muted)]">
            The model reads every pitch in real time. Open a live game to watch its call
            land — or miss — against what actually happens.
          </p>
        </Reveal>
        <Reveal delay={0.12} className="w-full lg:w-auto">
          <div className="glass-panel flex w-full divide-x divide-[var(--line)] lg:w-auto">
            <StatCell label="Live now" value={live.length} accent="var(--live)" />
            <StatCell label="Model acc · today" value="73%" accent="var(--model)" />
            <StatCell label="Pitches scored" value="2,481" />
          </div>
        </Reveal>
      </header>

      {live.length > 0 && (
        <section className="mb-11">
          <div className="mb-4 flex items-center gap-3">
            <Eyebrow tone="text">Live now</Eyebrow>
            <span className="font-mono text-[11px] tabular-nums text-[var(--faint)]">
              {String(live.length).padStart(2, "0")}
            </span>
            <div className="h-px flex-1 bg-[var(--line)]" />
          </div>
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
        <ScheduleSection label="Upcoming" count={pre.length}>
          {pre.map((g) => (
            <StaggerItem key={g.id} className="h-full">
              <GameCard game={g} />
            </StaggerItem>
          ))}
        </ScheduleSection>
      )}
      {finals.length > 0 && (
        <ScheduleSection label="Final" count={finals.length}>
          {finals.map((g) => (
            <StaggerItem key={g.id} className="h-full">
              <GameCard game={g} />
            </StaggerItem>
          ))}
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
