# CLAUDE.md — DiamondAI Frontend (`web/`)

Behavioral guidelines to reduce common LLM coding mistakes, merged with project-specific rules.
**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.
Scope: this file governs the `web/` Next.js frontend. The ML/Python code has its own CLAUDE.md at the repo root.

## 1. Think Before Coding
**Don't assume. Don't hide confusion. Surface tradeoffs.**
- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First
**Minimum code that solves the problem. Nothing speculative.**
- No features, components, abstractions, or configurability beyond what was asked.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

## 3. Surgical Changes
**Touch only what you must. Clean up only your own mess.**
- Don't "improve" adjacent code, comments, or formatting. Don't refactor what isn't broken.
- Match the existing component and styling conventions, even if you'd do it differently.
- Remove only the imports/vars/components YOUR change orphaned; leave pre-existing dead code (mention it).
- Every changed line should trace directly to the request.

## 4. Goal-Driven Execution
**Define success criteria. Loop until verified.**
- "Add the win-prob bar" → "renders with mock data, animates on state change, builds clean."
- For multi-step tasks, state a brief plan with a verify check per step.
- Treat design polish as a goal too: improve hierarchy/spacing/restraint, then re-check it reads clearly.

---

# Project
DiamondAI's live MLB game frontend: a schedule of games and a live game view that, per pitch, shows what's actually happening alongside the AI model's prediction (pitch type, outcome, win probability), plus a feed comparing predictions to reality. The GAME/SCHEDULE data is now REAL (live MLB Stats API, server-side, polled). The AI PREDICTION side is still a mock stub (`web/lib/sim.ts`) — the real model inference server is wired in a later phase.

# Critical Rules
- NEVER change the chosen typeface. It is already set; exploit its weights/sizes, do not swap it.
- REAL feeds allowed this phase: the server-side MLB Stats API proxy (`web/app/api/schedule`, `web/app/api/game/[gamePk]`), mapped GUMBO→types ONLY in `web/lib/mlbAdapter.ts`, plus the Polymarket proxy (`web/app/api/polymarket/*`). All MLB calls stay server-side (CORS) and degrade gracefully (no key/secrets). NEVER add OTHER real feeds, and NEVER make the AI PREDICTION / win-prob / accuracy real — those MUST stay the `sim.ts` mock stub; never present mock predictions as live model output.
- NEVER change the mock-data TypeScript interfaces casually — they are the contract the real MLB feed + inference server will fulfill. Changing them breaks the later swap.
- ALWAYS keep the visible "mock data" indicator on screen this phase.
- NEVER introduce the templated, vibe-coded look: no generic dashboard cards, gratuitous gradients/glows, filler animations, or decorative icon soup.

# Commands
- `npm run dev` — dev server (run inside `web/`)
- `npm run build` — production build; must pass with no type errors before a task is done
- `npm run lint` — lint
- (Run all commands from the `web/` directory.)

# Architecture
- `web/app/` — App Router pages/layouts (schedule, live game view)
- `web/components/` — UI components (one concern each, typed props)
- `web/lib/` — types (the data contract), `mlbAdapter.ts` (real MLB GUMBO→types), `mlbConfig.ts` (URLs/poll cadence), `sim.ts` (mock prediction stub), pure helpers
- `web/components/useLiveGame.ts` — client data layer: `useSchedule`/`useGameFeed`/`useLiveGame` fetch the route handlers and poll live games (same shapes the components already consume)
- `web/lib/types.ts` — the domain interfaces = the data contract the real feed fulfills; treat as load-bearing

**Stack:** Next.js (App Router) · TypeScript · Tailwind · the chosen font · mock data only

# Design Ethos
The bar is Apple Sports / Nike restraint, not features. Hold to this:
- Dark slate-grey base (not pure black); generous whitespace; let the layout breathe.
- Typography carries the design — confident scoreboard-style numerals for scores/counts/win-prob, strong hierarchy over body text.
- Near-flat surfaces: hairline 1px dividers and subtle tonal steps over heavy shadows/card chrome.
- Functional color only: red/white/blue MLB accents used sparingly — live state, ACTUAL vs AI PREDICTION, meaningful results. Content is the focal point.
- Quiet, purposeful motion only (a score ticking, a pitch resolving). Nothing decorative.

# Code Style
- ALWAYS type component props and the mock-data shapes; no `any`.
- Functional components with hooks only. Keep components small and single-purpose.
- Tailwind utilities for styling; centralize theme tokens (colors, spacing) rather than scattering magic values.
- ACTUAL vs AI PREDICTION is a consistent visual language — keep the color/treatment for each stable across every component.
- f-strings/template literals; no leftover console logs; no unused imports.

# Workflow
- For a polish/refinement request: improve hierarchy, spacing, weight, and restraint in place. Do NOT add features, new dependencies, or a new layout system unless something is clearly broken.
- Keep mobile responsive (~380px+), keyboard accessible, with sensible loading/empty states.
- Verify `npm run build` passes (no type errors) before considering a task done.
- Git: `git add . && git commit -m "short summary" && git push origin main` unless told otherwise.

# Available Skills
Design-focused skills are available; reach for them deliberately and in service of the restraint ethos above (don't let a skill push the UI toward over-animation or generic kits):
- `ui-ux-pro-max` — UX/UI best practices, layout and hierarchy decisions. Primary reference for this project.
- `design` / `design-system` — visual design direction; building/maintaining tokens and a consistent component system. Use to keep theme + components coherent.
- `ui-styling` — styling patterns and polish.
- `brand` — brand/identity coherence (DiamondAI wordmark, MLB-flavored palette).
- `motion-framer` — Framer Motion for the quiet, purposeful transitions (score ticks, pitch resolving). Preferred motion tool here.
- `gsap-scrolltrigger` — GSAP scroll-driven animation. Use only if a screen genuinely needs scroll choreography; default to restraint.
- `animated-component-libraries` — prebuilt animated components. Use sparingly; verify anything pulled in matches the flat, non-vibe-coded ethos before adopting.
- `lottie-animations` — Lottie playback. Likely overkill for this UI; use only with a clear purpose.
- `banner-design` / `slides` — banners and presentation decks. Not core to this app; only if a marketing banner or deck is explicitly requested.

## META — Maintaining This Document
1. Use NEVER or ALWAYS — not "try to" or "prefer".
2. Only add a rule after a real violation caused a real problem.
3. Be concrete — include the actual command, path, or token.
4. Update Critical Rules at the top when adding a hard rule below.
5. Keep under 200 lines — delete stale rules ruthlessly.