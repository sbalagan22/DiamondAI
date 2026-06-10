"use client";

/* DiamondAI — slim floating frosted nav: wordmark + an animated light/dark
   switch. The "mock data" indicator now lives in a corner badge (MockBadge),
   keeping the bar short. */
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Wordmark } from "./primitives";

// Animated dark/light switch — a sliding knob with a sun/moon morph.
// Initial state is read from the DOM (set pre-paint in layout.tsx) so the apply
// effect never clobbers the persisted theme on mount.
function ThemeSwitch() {
  const reduce = useReducedMotion();
  const [theme, setTheme] = useState<"dark" | "light">(() =>
    typeof document !== "undefined"
      ? ((document.documentElement.getAttribute("data-theme") as "dark" | "light") || "dark")
      : "dark",
  );
  const mounted = useRef(false);
  const isDark = theme === "dark";

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
    // Chromium stale-paint workaround: custom-property colors inside the
    // backdrop-filter nav don't always re-resolve on a theme swap until a
    // forced repaint. Toggling visibility invalidates paint without layout.
    const b = document.body;
    b.style.visibility = "hidden";
    void b.offsetHeight;
    b.style.visibility = "";
  }, [theme]);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={!isDark}
      aria-label="Toggle light or dark mode"
      suppressHydrationWarning
      title={isDark ? "Switch to light" : "Switch to dark"}
      onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
      className="relative flex h-7 w-[52px] items-center rounded-full border border-[var(--glass-border)] bg-[var(--fill-hi)] px-0.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--model)]"
    >
      <motion.span
        layout
        transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 34 }}
        className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[var(--surface)] shadow-[0_1px_3px_rgba(0,0,0,0.35)]"
        style={{ marginLeft: isDark ? 0 : "auto" }}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={theme}
            initial={reduce ? false : { rotate: -80, opacity: 0, scale: 0.4 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={reduce ? undefined : { rotate: 80, opacity: 0, scale: 0.4 }}
            transition={{ type: "spring", stiffness: 380, damping: 24 }}
            className="text-[var(--text)]"
          >
            {isDark ? (
              <svg viewBox="0 0 24 24" className="h-[13px] w-[13px]" fill="currentColor" aria-hidden="true">
                <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                className="h-[14px] w-[14px]"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
                <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
              </svg>
            )}
          </motion.span>
        </AnimatePresence>
      </motion.span>
    </button>
  );
}

export function PillNav({ mode = "home" }: { mode?: "home" | "game" }) {
  const reduce = useReducedMotion();
  return (
    <div className="sticky top-0 z-30 pt-3 sm:pt-4">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <motion.nav
          initial={reduce ? false : { opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="liquid-glass flex h-[52px] items-center justify-between gap-3 rounded-full pl-2 pr-2 sm:pl-4 sm:pr-3"
        >
          <div className="flex min-w-0 items-center gap-1.5">
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
              className="flex items-center rounded-full px-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--model)]"
              aria-label="DiamondAI home"
            >
              <Wordmark />
            </Link>
          </div>
          <div className="flex items-center gap-3">
            {mode === "game" && (
              <Link
                href="/"
                className="hidden font-mono text-[10.5px] uppercase tracking-[0.16em] text-[var(--muted)] transition-colors hover:text-[var(--text)] sm:inline"
              >
                Schedule
              </Link>
            )}
            <ThemeSwitch />
          </div>
        </motion.nav>
      </div>
    </div>
  );
}
