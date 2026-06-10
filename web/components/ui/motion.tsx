"use client";

/* DiamondAI — small, reduced-motion-aware animation helpers (Motion / Framer).
   Quiet, purposeful motion only — entrances, staggers, and value tick-overs. */
import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";
import { cx } from "@/lib/ui";

const EASE = [0.22, 1, 0.36, 1] as const;

// Fade + rise a block in on mount (page / panel entrances).
export function Reveal({
  children,
  className,
  delay = 0,
  y = 12,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

const containerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
};
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

// A grid/flow container that staggers its <StaggerItem> children in.
export function StaggerGroup({
  children,
  className,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "section";
}) {
  const reduce = useReducedMotion();
  const Comp = as === "section" ? motion.section : motion.div;
  return (
    <Comp
      className={className}
      variants={reduce ? undefined : containerVariants}
      initial={reduce ? false : "hidden"}
      animate="show"
    >
      {children}
    </Comp>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div className={className} variants={reduce ? undefined : itemVariants}>
      {children}
    </motion.div>
  );
}

// Number that pops when its value changes (scores, win-prob, accuracy).
export function TickNumber({
  value,
  className,
}: {
  value: string | number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <span className={className}>{value}</span>;
  return (
    <span className={cx("relative inline-flex overflow-hidden", className)}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ y: "55%", opacity: 0 }}
          animate={{ y: "0%", opacity: 1 }}
          exit={{ y: "-55%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 32 }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
