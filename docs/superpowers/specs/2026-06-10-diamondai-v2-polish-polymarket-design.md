# DiamondAI v2 — Glass polish, cinematic motion & live Polymarket reference

**Date:** 2026-06-10
**Scope:** `web/` (Next.js 16 · React 19 · Tailwind v4 · Motion). One cohesive enhancement pass over the v1 frontend built earlier this session.
**Status:** Approved design → implementation plan next.

## Goal

Elevate the live MLB frontend from "faithful port" to "extraordinary": a more frosted liquid-glass system over a vibrant theme-aware backdrop, a broadened color language (green/red results), a premium live pitch feed, cinematic-but-restrained event animations, every live game in the big-card treatment, a polished navbar, and a **real, proxied Polymarket live-odds reference** to compare against the model.

## Non-goals

- Replacing the mock game engine. All game data stays mock (`lib/mock.ts`, `lib/sim.ts`, the simulated ticker). Only Polymarket is real.
- 1:1 mapping of our fictional games to real Polymarket markets (impossible — our matchups are fake). Polymarket is an honest, clearly-labeled **live reference board**.
- Heavy charting dependencies. Graphs are hand-rolled SVG to match the design.

## Rule change (must do)

`web/CLAUDE.md` currently says *"NEVER add real network calls this phase."* Amend it to carve out a single exception: **the server-side Polymarket proxy** (`app/api/polymarket/*`) may make real network calls; the rest of the app remains mock. Keep the visible "mock data" indicator (everything but the Polymarket panel is still mock); the Polymarket panel is labeled "live."

---

## 1. Liquid glass — adopt `@creativoma/liquid-glass`, more frosted

- Install `@creativoma/liquid-glass`. Create `components/ui/GlassPanel.tsx` exporting `GlassPanel` and `GlassPill` wrappers with **more-frosted, theme-aware tuned defaults** (blur ~34px, saturate/brightness lens, refined tint per theme, stronger `displacementScale`).
- Keep the existing `.glass-panel`/`.glass-pill` CSS as the **fallback** (and for SSR), so behavior degrades cleanly if the package has React 19 / SSR issues. The wrapper picks the package when safe, CSS otherwise — a single seam, not a scattered choice.
- Migrate the signature surfaces (scoreboard, panels, spotlight, pill nav) to the wrapper so frost is uniform.
- **Interface:** `<GlassPanel as? className? frost?>` / `<GlassPill>`. Consumers don't know which backend renders.
- **Risk/fallback:** if the package breaks SSR or React 19, the wrapper falls back to the enhanced CSS glass (which we keep tuned to the same, more-frosted look). Either way the visual target is "noticeably more frosted than v1."

## 2. Vibrant theme-aware background

- New `components/ui/Background.tsx` (fixed, `z-index:-1`, `pointer-events:none`, `aria-hidden`) rendering a layered **red↔blue gradient mesh / aurora** with a soft white core + subtle grain + a very slow drift (CSS keyframes, disabled under reduced-motion).
- Two palettes: **dark** — saturated red & blue blooms on graphite; **light** — lighter but still-saturated blooms on near-white. Tuned so glass surfaces clearly refract/sit "over" something.
- Replaces the current faint `body::before` wash (keep a CSS fallback wash for no-JS).
- **Test:** glass panels read as floating over depth in both themes; background never competes with content (opacity/scale tuned); no scroll jank.

## 3. Color system — green/red results, blue stays the model

- Add tokens (light + dark) to `globals.css`: `--hit` (green, e.g. dark `#3fb950` / light `#1f883d`), `--hit-soft`, `--miss` (red, reuse/realign with `--live`), `--miss-soft`.
- `--model` (blue) = the model's identity (predictions, confidence, "Predicting"). Team primary colors = team identity. `--live` (red) = live state. Results now use `--hit`/`--miss`.
- Update every result surface: `StrikeZone` actual marker, `Verdict` chips, feed hit/miss dots, `MiniCall` dots, spotlight "hit/miss" legend, accuracy framing.
- **De-vibe audit:** while touching these, remove/upgrade any cheap-feeling elements (flagged: the plain feed rows, any flat dot soup). Keep the restraint ethos.

## 4. Live feed redesign + stronger "now" moment

- Rebuild the pitch feed (`PitchFeed`/`FeedRow`) as a premium live feed: refined typographic rows, smooth enter/settle (Motion `layout` + spring), **result pulse (green/red)** on arrival, per-pitch velocity and ▲▼ win-prob delta, clearer predicted-vs-actual columns.
- Strengthen the hero "current pitch" presentation: a real live pulse while predicting, animated count transitions, clearer resolve.
- **Interface:** same `ViewPitch[]` history input; no data-contract change.

## 5. Cinematic-but-restrained animations (event-keyed)

Driven by the existing predict→reveal ticker phase + pitch/at-bat fields. New `components/game/moments.tsx` (or extend `ui/motion.tsx`) with composable pieces, all `prefers-reduced-motion` gated:

- **Pitch thrown:** ball travels from release toward its zone cell; predicted dot already placed, actual marker snaps in on reveal.
- **Strike (called/swinging):** zone cell flare + crisp snap.
- **Hit (model correct):** green pulse on verdict. **Miss:** brief red shake/flash.
- **Strikeout:** restrained "K" stamp moment near the zone.
- **End of inning:** a sweep / inning-flip transition on the scoreboard.
- **Win-prob swing:** meter eases (existing) + delta arrow animates; large swings get a subtle emphasis.
- **Test:** 60fps (transform/opacity only); nothing fires under reduced-motion; moments read as designed, not gratuitous.

## 6. Polymarket — real, proxied live reference

**Data flow:** client → Next route handler (server) → Polymarket public APIs → normalized JSON → client polling → panel.

- **Server proxy** `app/api/polymarket/markets/route.ts` and `app/api/polymarket/history/route.ts`:
  - Markets/odds: `GET https://gamma-api.polymarket.com/markets?tag=MLB&active=true` (and/or `/events`), reading outcome odds + `clobTokenIds`.
  - Current price: `GET https://clob.polymarket.com/prices/midpoint?token_id=...`.
  - History: `GET https://clob.polymarket.com/prices-history?market=<token_id>&interval=1d&fidelity=...`.
  - Server-side `fetch` with `next: { revalidate: 30 }` (or a 30s in-memory cache); normalize to a small `PolymarketMarket` / `PricePoint[]` shape in `lib/polymarket.ts`. Handle upstream failure → return a typed error payload, never throw to the client.
- **Client** `components/game/PolymarketPanel.tsx`: shows a chosen live MLB market's two-way odds + a **live price-history graph** (hand-rolled SVG, same visual language as `WinProbChart`), the Polymarket logo (`public/logos/polymarket.png`), label **"Polymarket · live MLB — reference,"** refreshing every ~30–45s (`setInterval`, paused when tab hidden). Loading skeleton, empty ("no live MLB markets"), and error ("Polymarket unavailable") states. Sits beside the model win-prob for visual comparison.
- **Asset:** copy `design/polymarketlogo.png` → `web/public/logos/polymarket.png`.
- **Test:** route returns real data when upstream is up; panel degrades gracefully when down; page never blocked; no secrets needed (public endpoints).

## 7. Navbar + asset touch-ups

- Refine `PillNav`: spacing, a small live-games count chip, crisper theme toggle, subtle active/hover states; refine the wordmark lockup. Polish shared chips/tags. No new layout system.

## 8. All live games → big-card treatment

- `Schedule`: render **every** live game with the big `Spotlight` card (stacked), not just `live[0]`. Small `GameCard` remains for upcoming/final. The featured concept collapses into "all live games are featured."
- Each big card still drives off its own `useLiveGame` cursor (independent tickers).

## 9. Scoreboard — team names beside logos

- `Scoreboard` shows team **name** (and city as secondary) next to each logo+score. Schedule cards already show names → unchanged.

---

## Architecture summary (units)

| Unit | Purpose | Depends on |
|---|---|---|
| `ui/GlassPanel.tsx` | Canonical frosted-glass primitive (pkg + CSS fallback) | `@creativoma/liquid-glass`, globals.css |
| `ui/Background.tsx` | Vibrant theme-aware backdrop | globals.css tokens |
| `globals.css` | Adds `--hit/--miss` + vibrant bg tokens (light+dark) | — |
| `ui/motion.tsx` + `game/moments.tsx` | Reveal/stagger/tick + event moments | Motion |
| `lib/polymarket.ts` | Types + fetch/normalize helpers | — |
| `app/api/polymarket/*` | Server proxy (CORS, cache, normalize) | `lib/polymarket.ts` |
| `game/PolymarketPanel.tsx` | Live odds + graph reference | proxy route |
| `schedule/Schedule.tsx` | All live games as big cards | Spotlight, useLiveGame |
| `game/GameView.tsx` | Premium feed, moments, team names, Polymarket panel | above |

## Error handling

- Polymarket: all failures contained server-side → typed error payload → panel shows a quiet "unavailable" state. Never blocks render. Mock data path untouched.
- Glass: package failure → CSS fallback.
- Motion: reduced-motion disables all of it.

## Verification / success criteria

- `npm run build` clean (no type errors); `npm run lint` clean.
- Home + game routes 200; all live games show big cards.
- Glass visibly more frosted; background vibrant in both themes; glass reads as floating.
- Results are green/red; model stays blue; team colors intact.
- Pitch/strike/miss/strikeout/inning animations fire correctly, 60fps, reduced-motion-safe.
- Polymarket panel shows real live odds + a live graph (or degrades gracefully); refreshes over time.
- Mock indicator still present; CLAUDE.md network rule amended.

## Open implementation risks

- `@creativoma/liquid-glass` React 19 / Next 16 SSR compatibility → mitigated by CSS fallback in the wrapper.
- Polymarket schema drift / rate limits → server cache + defensive normalization + graceful failure.
- Polymarket may have **no active MLB markets** at a given time (off-season/no live games) → panel shows an honest empty state; consider falling back to "MLB" event markets (futures) so there's always something to show.
