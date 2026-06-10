import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GameView } from "@/components/game/GameView";
import { PillNav } from "@/components/ui/Nav";
import { getGame, getGames } from "@/lib/mock";

export function generateStaticParams() {
  return getGames().map((g) => ({ id: g.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const game = getGame(id);
  return {
    title: game
      ? `${game.away.abbr} @ ${game.home.abbr} — DiamondAI`
      : "Game — DiamondAI",
  };
}

export default async function GamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!getGame(id)) notFound();
  return (
    <div className="min-h-screen">
      <PillNav mode="game" />
      <GameView id={id} />
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
