import type { Metadata } from "next";
import { GameView } from "@/components/game/GameView";
import { PillNav } from "@/components/ui/Nav";

export const metadata: Metadata = {
  title: "Live Game — DiamondAI",
};

export default async function GamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="min-h-screen">
      <PillNav mode="game" />
      <GameView id={id} />
      <footer className="mx-auto max-w-6xl px-4 pb-10 pt-2 sm:px-6">
        <div className="border-t border-[var(--line)] pt-5">
          <p className="max-w-2xl font-mono text-[10.5px] uppercase leading-relaxed tracking-[0.1em] text-[var(--faint)]">
            DiamondAI · game data is live from the MLB Stats API. Pitch predictions and win
            probability come from the trained DiamondAI model; if the model server is offline they
            fall back to a stub (flagged by the badge).
          </p>
        </div>
      </footer>
    </div>
  );
}
