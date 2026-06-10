"use client";

/* DiamondAI — lazy, client-only mount for the FluidGlass lens. Three.js is a
   heavy, WebGL-dependent dependency, so this:
     · dynamic-imports it (ssr:false) — never runs on the server,
     · guards it in an error boundary — a WebGL/runtime failure degrades to the
       aurora + DOM hero rather than crashing the page.
   It renders as a full-bleed, non-interactive layer behind the hero content. */
import dynamic from "next/dynamic";
import { Component, type ReactNode } from "react";

const FluidGlass = dynamic(() => import("./FluidGlass"), { ssr: false });

const TINT: { color: string; pos: [number, number]; scale: number; speed: number }[] = [
  { color: "#ff4b51", pos: [-1.5, 0.55], scale: 3.7, speed: 0.18 },
  { color: "#4d8bff", pos: [1.55, -0.45], scale: 3.9, speed: 0.15 },
  { color: "#ffffff", pos: [0.25, 0.05], scale: 2.4, speed: 0.22 },
];

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function FluidGlassHero() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <Boundary>
        <FluidGlass tint={TINT} />
      </Boundary>
    </div>
  );
}
