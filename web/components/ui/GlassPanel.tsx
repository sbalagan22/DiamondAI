"use client";

/* DiamondAI — canonical frosted-glass primitive.
   Wraps @creativoma/liquid-glass (the blur/displacement/tint live on its inner
   layers); we supply the edge — border, radius, specular shadow, sheen — via
   the `.glass-edge` class. Tuned more frosted than v1. */
import { LiquidGlass } from "@creativoma/liquid-glass";
import { cx } from "@/lib/ui";

export function GlassPanel({
  children,
  className = "",
  as = "section",
}: {
  children: React.ReactNode;
  className?: string;
  as?: React.ElementType;
}) {
  return (
    <LiquidGlass
      as={as}
      backdropBlur={6}
      displacementScale={72}
      tintColor="var(--glass-tint)"
      className={cx("glass-edge rounded-[var(--r-card)]", className)}
    >
      {children}
    </LiquidGlass>
  );
}

export function GlassPill({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <LiquidGlass
      backdropBlur={7}
      displacementScale={84}
      tintColor="var(--glass-tint-strong)"
      className={cx("glass-edge glass-edge--pill rounded-full", className)}
    >
      {children}
    </LiquidGlass>
  );
}
