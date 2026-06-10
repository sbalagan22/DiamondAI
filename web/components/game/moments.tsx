"use client";

/* DiamondAI — cinematic-but-restrained event moments for the game view.
   Each piece is reduced-motion-aware and keyed by the resolving pitch so it
   fires once per event, never gratuitously. */
import { motion, useReducedMotion } from "motion/react";

// Wraps the "what happened" content: green ring-flash on a correct call,
// a brief shake + red flash on a miss. The flash overlay fades out.
export function ResultFlash({
  hit,
  children,
}: {
  hit: boolean;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <>{children}</>;
  const color = hit ? "var(--hit)" : "var(--miss)";
  const soft = hit ? "var(--hit-soft)" : "var(--miss-soft)";
  return (
    <motion.div
      className="relative"
      animate={hit ? undefined : { x: [0, -5, 5, -3, 3, 0] }}
      transition={{ duration: 0.42, ease: "easeOut" }}
    >
      {children}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -inset-2 rounded-[var(--r-chip)]"
        style={{ boxShadow: `inset 0 0 0 1.5px ${color}`, background: soft }}
        initial={{ opacity: 0.7, scale: 0.98 }}
        animate={{ opacity: 0, scale: 1.015 }}
        transition={{ duration: 0.75, ease: "easeOut" }}
      />
    </motion.div>
  );
}

// A scorecard "K" that stamps in over the zone when an at-bat ends in a K.
export function StrikeoutStamp({ show }: { show: boolean }) {
  const reduce = useReducedMotion();
  if (!show || reduce) return null;
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 1, 0] }}
      transition={{ duration: 1.7, times: [0, 0.12, 0.68, 1], ease: "easeOut" }}
    >
      <motion.span
        className="font-display font-extrabold leading-none text-[var(--model)]"
        style={{ fontSize: 104, letterSpacing: "-0.04em", textShadow: "0 6px 34px rgba(0,0,0,0.45)" }}
        initial={{ scale: 1.7, rotate: -9 }}
        animate={{ scale: 1, rotate: -4 }}
        transition={{ type: "spring", stiffness: 260, damping: 17 }}
      >
        K
      </motion.span>
    </motion.div>
  );
}
