import { Schedule } from "@/components/schedule/Schedule";
import { PillNav } from "@/components/ui/Nav";
import { LandingAurora } from "@/components/visual/LandingAurora";

export default function SchedulePage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <LandingAurora />
      <div className="relative z-10">
        <PillNav mode="home" />
        <Schedule />
        <footer className="mx-auto max-w-6xl px-4 pb-10 pt-4 sm:px-6">
          <div className="border-t border-[var(--line)] pt-5">
            <p className="max-w-2xl font-mono text-[10.5px] uppercase leading-relaxed tracking-[0.1em] text-[var(--faint)]">
              DiamondAI · games and scores are live from the MLB Stats API. Predictions, win
              probability and accuracy are a placeholder model stub — not a live model.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
