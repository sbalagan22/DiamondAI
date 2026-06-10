# DiamondAI v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elevate the v1 frontend into a more-frosted liquid-glass UI over a vibrant theme-aware backdrop, with green/red result semantics, a premium animated live feed, cinematic event animations, all-live-games-as-big-cards, a polished navbar, and a real proxied Polymarket live-odds reference.

**Architecture:** Keep all game data mock (`lib/mock.ts`, `lib/sim.ts`, simulated ticker). Add a single real integration — a server-side Polymarket proxy (`app/api/polymarket/*`) consumed by a client panel. Glass becomes a single primitive (`GlassPanel`, package + CSS fallback). Motion stays reduced-motion-aware via `ui/motion.tsx` + `game/moments.tsx`.

**Tech Stack:** Next.js 16 (App Router, Turbopack) · React 19 · Tailwind v4 · Motion 12 · `@creativoma/liquid-glass` · hand-rolled SVG charts.

**Verification model:** No unit-test runner in `web/` (visual frontend). Each task verifies via `npm run build` (no type errors), `npm run lint` (clean), dev render at `localhost:3000`, and for Polymarket `curl` of the proxy route. Commit after each task. Run all commands from `web/`.

**Spec:** `docs/superpowers/specs/2026-06-10-diamondai-v2-polish-polymarket-design.md`

---

## Phase 1 — Foundation: tokens, vibrant background, glass primitive

### Task 1.1: Color + background tokens

**Files:**
- Modify: `web/app/globals.css`

- [ ] **Step 1: Add result + vibrant-bg tokens** to `:root` (dark) and `:root[data-theme="light"]`.
  - Dark: `--hit:#3fb950; --hit-soft:rgba(63,185,80,0.18); --miss:#ff5b61; --miss-soft:rgba(255,91,97,0.18);`
  - Light: `--hit:#1f883d; --hit-soft:rgba(31,136,61,0.14); --miss:#e23a40; --miss-soft:rgba(226,58,64,0.12);`
  - (Keep `--model` blue and `--live` red as-is.)
- [ ] **Step 2: Replace the faint `body::before` wash** with a richer multi-stop red↔blue mesh + soft white core for dark, and the saturated-on-near-white variant under `:root[data-theme="light"] body::before`. Add a `@keyframes bg-drift` (slow, ~30s, transform/opacity only) applied to a new `body::after` aurora layer; disable under the existing `prefers-reduced-motion` block.
- [ ] **Step 3: Verify** `npm run build` clean; `npm run dev` → home shows a clearly more vibrant backdrop in dark + light (toggle).
- [ ] **Step 4: Commit** `git add web/app/globals.css && git commit -m "feat(theme): vibrant backdrop + hit/miss color tokens"`

### Task 1.2: Install glass package + GlassPanel primitive

**Files:**
- Modify: `web/package.json` (via npm)
- Create: `web/components/ui/GlassPanel.tsx`

- [ ] **Step 1: Install** `npm install @creativoma/liquid-glass` (from `web/`).
- [ ] **Step 2: Create `GlassPanel.tsx`** ("use client") exporting `GlassPanel` and `GlassPill`. Wrap the package's `LiquidGlass` with more-frosted, theme-aware defaults; if the package import/SSR fails, fall back to the existing `.glass-panel`/`.glass-pill` CSS classes. Interface: `{ children, className?, as?, pill? }`. Keep the existing CSS classes in `globals.css` (do not delete) as the fallback + tuned look.

```tsx
"use client";
import { LiquidGlass } from "@creativoma/liquid-glass";
import { cx } from "@/lib/ui";

// More-frosted tuned defaults; CSS classes remain the visual fallback.
export function GlassPanel({ children, className = "", as = "section" }: {
  children: React.ReactNode; className?: string; as?: React.ElementType;
}) {
  return (
    <LiquidGlass as={as} backdropBlur={5} displacementScale={120}
      tintColor="var(--glass-tint)"
      className={cx("glass-panel", className)}>
      {children}
    </LiquidGlass>
  );
}
export function GlassPill({ children, className = "" }: {
  children: React.ReactNode; className?: string;
}) {
  return (
    <LiquidGlass backdropBlur={6} displacementScale={140}
      tintColor="var(--glass-tint)"
      className={cx("glass-pill rounded-full", className)}>
      {children}
    </LiquidGlass>
  );
}
```

- [ ] **Step 3: Add `--glass-tint`** to globals.css (dark + light) and bump the existing `.glass-panel`/`.glass-pill` blur to the more-frosted target (e.g. `blur(34px)`), so both package and fallback look "more frosted."
- [ ] **Step 4: Verify** `npm run build` clean. If the package breaks SSR/build, make `GlassPanel` render a plain `<Tag className="glass-panel">` (CSS-only) and note it; proceed.
- [ ] **Step 5: Commit** `git add -A && git commit -m "feat(ui): GlassPanel primitive (more frosted) + glass tint token"`

---

## Phase 2 — Color system: green/red results

### Task 2.1: Apply hit/miss colors across result surfaces

**Files:**
- Modify: `web/components/ui/primitives.tsx` (StrikeZone marker, Verdict, any result dots)
- Modify: `web/components/game/GameView.tsx` (FeedRow dots, PanelHead legends, accuracy)
- Modify: `web/components/schedule/Schedule.tsx` (MiniCall dots, spotlight hit/miss legend)

- [ ] **Step 1:** In `Verdict`, switch `hit ? var(--model) : var(--live)` → `hit ? var(--hit)/var(--hit-soft) : var(--miss)/var(--miss-soft)`.
- [ ] **Step 2:** Replace every result dot using `typeHit/outcomeHit ? "var(--model)" : "var(--live)"` with `"var(--hit)" : "var(--miss)"` (FeedRow, MiniCall, Spotlight legend, PitchFeed/PanelHead "hit/miss" legend). Keep the StrikeZone **predicted** dot blue (`--model`); the actual `×` stays ink/white.
- [ ] **Step 3: De-vibe pass:** remove any flat "dot soup"/cheap element encountered; keep restraint. (Primary cheap element = feed rows, redesigned in Phase 5.)
- [ ] **Step 4: Verify** build + lint clean; dev → verdicts/dots are green (hit) / red (miss); model predictions still blue.
- [ ] **Step 5: Commit** `git commit -am "feat(color): green=hit / red=miss across result surfaces"`

---

## Phase 3 — Glass migration, navbar polish, scoreboard team names

### Task 3.1: Migrate signature surfaces to GlassPanel + add Background

**Files:**
- Create: `web/components/ui/Background.tsx` (renders the aurora layers as a fixed div; or rely on globals.css `body::before/after` — choose CSS-only and skip this file if globals.css covers it)
- Modify: `web/components/game/GameView.tsx`, `web/components/schedule/Schedule.tsx`, `web/components/ui/primitives.tsx` (`Panel`) to use `GlassPanel`.

- [ ] **Step 1:** Point the shared `Panel` primitive at `GlassPanel`; spot-check spotlight/scoreboard still render. (Single seam — most surfaces use `Panel`.)
- [ ] **Step 2: Verify** build + dev → all panels noticeably more frosted, content legible.
- [ ] **Step 3: Commit** `git commit -am "feat(ui): migrate panels to GlassPanel"`

### Task 3.2: Navbar polish + scoreboard team names

**Files:**
- Modify: `web/components/ui/Nav.tsx` (spacing, live-count chip, theme toggle, active states)
- Modify: `web/components/game/GameView.tsx` (`Scoreboard`: team name + city beside each logo)

- [ ] **Step 1:** In `Scoreboard`, render team `name` (and `city` secondary) next to each `Monogram`+score (away left, home right). Keep numerals dominant.
- [ ] **Step 2:** Polish `PillNav`: refine spacing, add a small live-games count chip (reads `getGames().filter live`), crisper toggle. No new layout system.
- [ ] **Step 3: Verify** build + lint clean; dev → game scoreboard shows names; nav refined.
- [ ] **Step 4: Commit** `git commit -am "feat(ui): scoreboard team names + navbar polish"`

---

## Phase 4 — All live games as big cards

### Task 4.1: Schedule renders every live game as Spotlight

**Files:**
- Modify: `web/components/schedule/Schedule.tsx`

- [ ] **Step 1:** Change the "Live now" rendering: map **all** live games through `Spotlight` (stacked, `gap-6`), wrapped in the existing `Reveal`. Remove the `featured`/`restLive` split. Keep `GameCard` for upcoming/final.
- [ ] **Step 2:** Ensure each `Spotlight` runs its own `useDisplay(game)` (independent ticker) — already does.
- [ ] **Step 3: Verify** build clean; dev → every live game is a big card; upcoming/final still small.
- [ ] **Step 4: Commit** `git commit -am "feat(schedule): all live games get the big-card treatment"`

---

## Phase 5 — Premium live feed + "now" moment

### Task 5.1: Redesign PitchFeed/FeedRow

**Files:**
- Modify: `web/components/game/GameView.tsx` (FeedRow, PitchFeed)

- [ ] **Step 1:** Rebuild `FeedRow`: cleaner 4-col grid, predicted (muted) vs actual (ink) with velocity, a per-row ▲▼ win-prob delta (compute from `homeWinProbAfter` vs previous), and a result **pulse** on enter — a brief `--hit-soft`/`--miss-soft` background flash via Motion `animate` keyframes, then settle. Keep `layout` + `AnimatePresence`.
- [ ] **Step 2:** Strengthen the hero "current pitch": animate count transitions (TickNumber on balls/strikes), a live `--model` pulse ring while predicting.
- [ ] **Step 3: Verify** build + lint clean; dev /game → feed feels premium; new rows pulse green/red and settle smoothly; reduced-motion disables pulses.
- [ ] **Step 4: Commit** `git commit -am "feat(game): premium animated pitch feed + live now moment"`

---

## Phase 6 — Cinematic event animations

### Task 6.1: Moments module + zone ball-flight / strike / miss / strikeout

**Files:**
- Create: `web/components/game/moments.tsx`
- Modify: `web/components/ui/primitives.tsx` (`StrikeZone` — ball flight + cell flare)
- Modify: `web/components/game/GameView.tsx` (wire moments to phase/at-bat)

- [ ] **Step 1:** In `StrikeZone`, on reveal animate a "ball" traveling toward the actual cell, then the `×` snaps in (spring) + the target cell flares (`--hit`/`--miss` tinted box that fades). Predicted dot eases (existing).
- [ ] **Step 2:** `moments.tsx` exports small, reduced-motion-aware pieces: `MissShake` (wraps the verdict area, x-shake + red flash on miss), `HitPulse` (green pulse on hit), `StrikeoutStamp` (a restrained "K" that stamps + fades near the zone when `abEnd` is a strikeout).
- [ ] **Step 3:** Wire in `PredictionHero`: on `revealed`, apply HitPulse/MissShake per `outcomeHit`; show `StrikeoutStamp` when the at-bat ended in a strikeout.
- [ ] **Step 4: Verify** build + lint; dev → pitch resolves with ball-flight + snap; misses shake red, hits pulse green; strikeout stamps; 60fps; reduced-motion safe.
- [ ] **Step 5: Commit** `git commit -am "feat(game): cinematic pitch/strike/miss/strikeout moments"`

### Task 6.2: End-of-inning transition + win-prob swing emphasis

**Files:**
- Modify: `web/components/game/GameView.tsx` (detect inning change between consecutive `current` pitches; Scoreboard inning-flip)

- [ ] **Step 1:** Detect inning/half change (compare current vs previous `ViewPitch.inning/half`); on change play a brief scoreboard "sweep"/inning-flip (Motion key on `${half}${inning}`).
- [ ] **Step 2:** On large win-prob delta (|Δ|≥~8 pts), add a subtle emphasis to the meter/delta (scale/flash), restrained.
- [ ] **Step 3: Verify** build; dev → inning rollovers animate; big swings emphasized; reduced-motion safe.
- [ ] **Step 4: Commit** `git commit -am "feat(game): end-of-inning transition + win-prob swing emphasis"`

---

## Phase 7 — Polymarket live reference

### Task 7.1: Logo asset + types + normalize helpers

**Files:**
- Create: `web/public/logos/polymarket.png` (copy from `design/polymarketlogo.png`)
- Create: `web/lib/polymarket.ts`

- [ ] **Step 1:** `cp design/polymarketlogo.png web/public/logos/polymarket.png` (resize ≤256px with `sips` if large).
- [ ] **Step 2:** `lib/polymarket.ts`: define `PolymarketMarket { id, question, awayLabel, homeLabel, yesPrice, noPrice, tokenIdYes, tokenIdNo, endDate }`, `PricePoint { t:number, p:number }`, and pure normalizers `normalizeMarket(raw)` / `normalizeHistory(raw)` mapping Gamma/CLOB JSON → these shapes (defensive: tolerate missing fields, parse `outcomePrices`/`clobTokenIds` JSON-string arrays).
- [ ] **Step 3: Verify** `npm run build` clean (types only).
- [ ] **Step 4: Commit** `git add -A && git commit -m "feat(polymarket): logo asset + types + normalizers"`

### Task 7.2: Server proxy routes

**Files:**
- Create: `web/app/api/polymarket/markets/route.ts`
- Create: `web/app/api/polymarket/history/route.ts`

- [ ] **Step 1: `markets/route.ts`** — `export async function GET()`: server-`fetch` `https://gamma-api.polymarket.com/markets?tag=MLB&active=true&closed=false&limit=20` with `{ next: { revalidate: 30 } }`; normalize to `PolymarketMarket[]`; pick live/near-live MLB game markets, else fall back to MLB event/futures markets so the panel always has content; return `Response.json({ markets })`. On upstream failure return `Response.json({ markets: [], error: "unavailable" }, { status: 200 })` (never 5xx to the client).
- [ ] **Step 2: `history/route.ts`** — `GET(req)` reads `?token=`; fetch `https://clob.polymarket.com/prices-history?market=<token>&interval=1d&fidelity=10` (`revalidate: 30`); normalize to `PricePoint[]`; return `{ points }` (or `{ points: [], error }` on failure).
- [ ] **Step 3: Verify** `npm run dev`, then `curl -s localhost:3000/api/polymarket/markets | head` returns JSON with `markets` (real or `[]`+error); `curl` history with a token returns `points`.
- [ ] **Step 4: Commit** `git add -A && git commit -m "feat(polymarket): server proxy routes (markets + history)"`

### Task 7.3: PolymarketPanel (odds + live graph) in the game view

**Files:**
- Create: `web/components/game/PolymarketPanel.tsx`
- Modify: `web/components/game/GameView.tsx` (place panel beside WinProbPanel)

- [ ] **Step 1:** `PolymarketPanel` ("use client"): on mount + every 40s (skip when `document.hidden`) fetch `/api/polymarket/markets`, pick the first market, fetch `/api/polymarket/history?token=<yes>`. Render: Polymarket logo + "Polymarket · live MLB — reference" label, the market question, a two-way odds bar (reuse `WinProbBar` visual language, neutral colors — not team), and a live price-history graph (reuse `WinProbChart`-style SVG over `PricePoint[]`). States: loading skeleton, empty ("No live MLB markets right now"), error ("Polymarket unavailable").
- [ ] **Step 2:** Mount in `GameView` right column under `WinProbPanel` (live + final views) so model vs market sit together. Do not block render; panel is self-contained.
- [ ] **Step 3: Verify** build + lint clean; dev /game → panel shows real odds + a graph that updates over time, or a graceful empty/error state; page unaffected if offline.
- [ ] **Step 4: Commit** `git add -A && git commit -m "feat(game): Polymarket live odds + price-history reference panel"`

---

## Phase 8 — Rule amendment + final verification

### Task 8.1: Amend CLAUDE.md + full verify + push

**Files:**
- Modify: `web/CLAUDE.md`

- [ ] **Step 1:** Amend the "NEVER add real network calls this phase" Critical Rule to: "NEVER add real network calls this phase EXCEPT the server-side Polymarket proxy (`app/api/polymarket/*`); all game data stays mock." Keep the "mock data indicator" rule.
- [ ] **Step 2: Full verify:** `npm run build` (clean), `npm run lint` (clean), `npm run dev` → home (all live = big cards, vibrant bg, frosted glass), /game (team names, green/red, cinematic moments, premium feed, Polymarket panel). Toggle light/dark. Check reduced-motion (OS setting) disables motion.
- [ ] **Step 3: Commit + push** `git add -A && git commit -m "docs: amend CLAUDE.md network rule for Polymarket proxy" && git push origin main`

---

## Self-review notes

- **Spec coverage:** glass (1.2/3.1) · vibrant bg (1.1) · colors (2.1) · feed (5.1) · animations (6.1/6.2) · Polymarket (7.1–7.3) · navbar (3.2) · all-live-big-cards (4.1) · team names (3.2) · rule change (8.1). All covered.
- **No data-contract change:** `lib/types.ts` untouched; Polymarket types live in `lib/polymarket.ts`.
- **Risk:** `@creativoma/liquid-glass` SSR/React19 — Task 1.2 Step 4 fallback to CSS-only `GlassPanel`. Polymarket empty/offline — handled in 7.2/7.3 with empty+error states and futures fallback.
