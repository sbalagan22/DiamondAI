import Link from "next/link";
import { PillNav } from "@/components/ui/Nav";

export default function NotFound() {
  return (
    <div className="min-h-screen">
      <PillNav mode="game" />
      <main className="mx-auto flex min-h-[60vh] max-w-6xl flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--faint)]">
          No live game found
        </div>
        <p className="max-w-sm text-[15px] leading-relaxed text-[var(--muted)]">
          That game isn&rsquo;t on today&rsquo;s slate, or it isn&rsquo;t live yet.
        </p>
        <Link
          href="/"
          className="rounded-full border border-[var(--glass-border)] bg-[var(--fill)] px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text)] transition-[background-color] hover:bg-[var(--fill-hi)]"
        >
          ← Back to schedule
        </Link>
      </main>
    </div>
  );
}
