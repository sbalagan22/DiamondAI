"use client";

/* DiamondAI — floating frosted pill nav + theme toggle + mock-data pill */
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getGames } from "@/lib/mock";
import { ChevronLeft, LiveDot, Wordmark } from "./primitives";

// Dark / light theme toggle — half-filled disc; persists to localStorage.
// Initial state is read from the DOM (set pre-paint in layout.tsx), so the
// apply effect never clobbers the persisted theme on mount.
function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">(() =>
    typeof document !== "undefined"
      ? ((document.documentElement.getAttribute("data-theme") as "dark" | "light") || "dark")
      : "dark",
  );
  const mounted = useRef(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("diamondai-theme", theme);
    } catch {
      /* ignore */
    }
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    // Chromium stale-paint workaround: custom-property colors inside
    // backdrop-filter panels don't always re-resolve on a theme swap until a
    // forced repaint. Toggling visibility invalidates paint without layout.
    const b = document.body;
    b.style.visibility = "hidden";
    void b.offsetHeight;
    b.style.visibility = "";
  }, [theme]);

  return (
    <button
      type="button"
      onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
      aria-label="Toggle light or dark mode"
      suppressHydrationWarning
      title={theme === "dark" ? "Switch to light" : "Switch to dark"}
      className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--glass-border)] text-[var(--muted)] transition-colors hover:bg-[var(--fill-hi)] hover:text-[var(--text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--model)]"
    >
      <svg viewBox="0 0 24 24" className="h-[15px] w-[15px]" aria-hidden="true">
        <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M12 4 A8 8 0 0 0 12 20 Z" fill="currentColor" />
      </svg>
    </button>
  );
}

function MockPill() {
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em]"
      style={{
        borderColor: "rgba(216,178,74,.4)",
        color: "var(--warn)",
        background: "rgba(216,178,74,.08)",
      }}
      title="This build runs on mock data and a simulated ticker — no live feeds or model calls yet."
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--warn)" }} />
      <span className="hidden xs:inline sm:inline">Mock data</span>
      <span className="sm:hidden">Mock</span>
    </span>
  );
}

export function PillNav({ mode = "home" }: { mode?: "home" | "game" }) {
  const reduce = useReducedMotion();
  const liveCount = getGames().filter((g) => g.status === "live").length;
  return (
    <div className="sticky top-0 z-30 pt-3 sm:pt-4">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <motion.nav
          initial={reduce ? false : { opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="glass-pill flex h-[52px] items-center justify-between gap-3 rounded-full pl-3 pr-3 sm:pl-5"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            {mode === "game" && (
              <Link
                href="/"
                aria-label="Back to schedule"
                className="group flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted)] transition-colors hover:bg-[var(--fill-hi)] hover:text-[var(--text)] focus:outline-none focus-visible:bg-[var(--fill-hi)]"
              >
                <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
              </Link>
            )}
            <Link
              href="/"
              className="flex items-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--model)]"
              aria-label="DiamondAI home"
            >
              <Wordmark />
            </Link>
            {liveCount > 0 && (
              <span
                className="hidden items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--glass-border)] bg-[var(--fill)] px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--live)] xs:inline-flex"
                title={`${liveCount} live game${liveCount > 1 ? "s" : ""} right now`}
              >
                <LiveDot /> {liveCount} live
              </span>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            {mode === "game" && (
              <Link
                href="/"
                className="hidden font-mono text-[10.5px] uppercase tracking-[0.16em] text-[var(--muted)] transition-colors hover:text-[var(--text)] sm:inline"
              >
                Schedule
              </Link>
            )}
            <ThemeToggle />
            <MockPill />
          </div>
        </motion.nav>
      </div>
    </div>
  );
}
