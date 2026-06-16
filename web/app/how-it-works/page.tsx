import type { Metadata } from "next";
import { HowItWorks } from "@/components/how/HowItWorks";
import { PillNav } from "@/components/ui/Nav";

export const metadata: Metadata = {
  title: "The Model — How DiamondAI works",
  description:
    "How DiamondAI works: a decoder-only transformer reads a game pitch by pitch and predicts the next pitch, the at-bat outcome, and live win probability — trained on a decade of Statcast on a TPU.",
};

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen">
      <PillNav mode="home" />
      <HowItWorks />
      <footer className="mx-auto max-w-6xl px-4 pb-10 pt-2 sm:px-6">
        <div className="border-t border-[var(--line)] pt-5">
          <p className="max-w-2xl font-mono text-[10.5px] uppercase leading-relaxed tracking-[0.1em] text-[var(--faint)]">
            DiamondAI · every number on this page is a real held-out metric from the trained model
            (see eval_out/). The model predicts game dynamics; it is not an attempt to beat betting
            markets.
          </p>
        </div>
      </footer>
    </div>
  );
}
