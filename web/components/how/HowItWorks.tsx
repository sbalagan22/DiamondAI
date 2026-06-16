"use client";

/* DiamondAI — "The Model" explainer. The full ML story for a smart non-expert,
   built entirely from the existing design system: flat graphite surfaces,
   hairline dividers, mono eyebrows + scoreboard numerals, red/white/blue accents,
   and quiet section reveals. Every number here is a real held-out metric. */
import Image from "next/image";
import { Eyebrow } from "@/components/ui/primitives";
import { CountUp, Reveal, StaggerGroup, StaggerItem } from "@/components/ui/motion";
import { cx } from "@/lib/ui";

/* ---- small building blocks (local to this page) -------------------------- */

// Section shell: an indexed mono eyebrow, a display heading, then content.
function Section({
  index,
  eyebrow,
  title,
  children,
  className = "",
}: {
  index: string;
  eyebrow: string;
  title: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Reveal className={cx("scroll-mt-24", className)}>
      <section>
        <div className="mb-4 flex items-center gap-3">
          <span className="font-mono text-[11px] font-semibold tabular-nums text-[var(--faint)]">
            {index}
          </span>
          <span className="h-px w-6 bg-[var(--line-2)]" />
          <Eyebrow tone="muted">{eyebrow}</Eyebrow>
        </div>
        <h2 className="max-w-3xl font-display text-[clamp(1.45rem,4vw,2.15rem)] font-bold leading-[1.08] tracking-tight text-[var(--text)]">
          {title}
        </h2>
        <div className="mt-6">{children}</div>
      </section>
    </Reveal>
  );
}

// A flat surface card.
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={cx("surface p-5 sm:p-6", className)}>{children}</div>;
}

// Body paragraph in the reading measure.
function P({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cx("max-w-2xl text-[15px] leading-relaxed text-[var(--muted)]", className)}>
      {children}
    </p>
  );
}

// Scoreboard stat: a big mono numeral over a mono caption.
function Stat({
  value,
  unit,
  label,
  tone = "text",
}: {
  value: React.ReactNode;
  unit?: string;
  label: string;
  tone?: "text" | "model" | "live" | "win";
}) {
  const color =
    tone === "model"
      ? "text-[var(--model)]"
      : tone === "live"
        ? "text-[var(--live)]"
        : tone === "win"
          ? "text-[var(--win)]"
          : "text-[var(--text)]";
  return (
    <div>
      <div className={cx("font-mono text-[clamp(1.7rem,5vw,2.4rem)] font-semibold leading-none tabular-nums", color)}>
        {value}
        {unit && <span className="ml-0.5 text-[0.5em] font-medium text-[var(--faint)]">{unit}</span>}
      </div>
      <div className="mt-2 font-mono text-[10px] uppercase leading-snug tracking-[0.16em] text-[var(--faint)]">
        {label}
      </div>
    </div>
  );
}

// Key / value spec row with a hairline divider.
function SpecRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[var(--line)] py-2.5 last:border-0">
      <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">{k}</span>
      <span className="text-right font-mono text-[13px] font-semibold tabular-nums text-[var(--text)]">{v}</span>
    </div>
  );
}

/* ---- content data -------------------------------------------------------- */

const HEADS = [
  { n: "7", title: "Next pitch type", desc: "Four-seam, sinker, cutter, slider, curve, off-speed, other." },
  { n: "6", title: "Next pitch outcome", desc: "Ball, called / swinging strike, foul, in-play, or HBP." },
  { n: "9", title: "At-bat outcome", desc: "How the plate appearance ends — K, BB, single … HR, out." },
  { n: "P", title: "Home win probability", desc: "A calibrated win chance, re-read after every single pitch." },
];

const RESULTS = [
  { head: "Next pitch type", model: 50.6, baseline: 33.6, delta: "+17 pts", strong: true },
  { head: "At-bat outcome", model: 53.3, baseline: 40.1, delta: "+13 pts", strong: true },
  { head: "Next pitch outcome", model: 37.3, baseline: 35.4, delta: "+1.9 pts", strong: false },
];

const SPEEDUPS = [
  { len: "≤ 512", x: null as number | null, note: "XLA wins / ties" },
  { len: "1024", x: 1.54, note: null },
  { len: "2048", x: 2.34, note: null },
  { len: "4096", x: 3.32, note: null },
];

const TECH = [
  "JAX", "Flax", "Optax", "Orbax", "Pallas", "Kaggle TPU v5e-8",
  "pybaseball / Statcast", "FastAPI", "Hugging Face Spaces", "Next.js", "TypeScript", "Tailwind",
];

/* ---- page ---------------------------------------------------------------- */

export function HowItWorks() {
  return (
    <main className="mx-auto max-w-5xl px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
      {/* ---- hero ---- */}
      <Reveal>
        <div className="flex items-center gap-3">
          <Eyebrow tone="live">The Model</Eyebrow>
          <span className="h-px flex-1 bg-[var(--line)]" />
          <Eyebrow tone="faint">DiamondAI</Eyebrow>
        </div>
        <h1 className="mt-6 max-w-3xl font-display text-[clamp(2.1rem,6.5vw,3.6rem)] font-bold leading-[1.02] tracking-tight text-[var(--text)]">
          A transformer that reads a baseball game{" "}
          <span className="text-[var(--model)]">one pitch at a time</span>.
        </h1>
        <P className="mt-6 text-[16px]">
          DiamondAI treats a game like a language. It reads the sequence of pitches and the
          surrounding context — count, base state, the pitcher–batter matchup, the score — and at
          every pitch outputs probabilities for what happens next: the pitch type, how the at-bat
          ends, and a live win probability. Below is exactly how it&rsquo;s built, trained, and served
          — with honest, held-out numbers.
        </P>
      </Reveal>

      <Reveal delay={0.12}>
        <div className="accent-rule mt-10" />
        <StaggerGroup className="mt-7 grid grid-cols-2 gap-y-7 sm:grid-cols-4">
          <StaggerItem>
            <Stat value="7.0" unit="M" label="Pitches trained on" />
          </StaggerItem>
          <StaggerItem>
            <Stat value={<CountUp to={24077} comma />} label="MLB games, 2015–2024" />
          </StaggerItem>
          <StaggerItem>
            <Stat value="7.5" unit="M" label="Model parameters" tone="model" />
          </StaggerItem>
          <StaggerItem>
            <Stat value="50.6" unit="%" label="Next-pitch accuracy" tone="model" />
          </StaggerItem>
        </StaggerGroup>
        <div className="accent-rule mt-7 opacity-40" />
      </Reveal>

      <div className="mt-20 space-y-20 sm:mt-24 sm:space-y-24">
        {/* ---- 01 what it predicts ---- */}
        <Section index="01" eyebrow="What it predicts" title="Four questions, one forward pass">
          <P>
            From a single read of the game so far, four small prediction &ldquo;heads&rdquo; branch off
            the same shared representation. They share everything the model has learned, then each
            answers its own question as a probability distribution.
          </P>
          <StaggerGroup className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {HEADS.map((h) => (
              <StaggerItem key={h.title}>
                <Card className="flex h-full items-start gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--r-chip)] bg-[var(--surface-2)] font-mono text-[18px] font-semibold tabular-nums text-[var(--model)]">
                    {h.n}
                  </span>
                  <div>
                    <h3 className="font-display text-[16px] font-semibold text-[var(--text)]">
                      {h.title}
                    </h3>
                    <p className="mt-1 text-[13.5px] leading-relaxed text-[var(--muted)]">{h.desc}</p>
                  </div>
                </Card>
              </StaggerItem>
            ))}
          </StaggerGroup>
          <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--faint)]">
            The number on each head is how many buckets it chooses between · &ldquo;P&rdquo; = a single probability
          </p>
        </Section>

        {/* ---- 02 architecture ---- */}
        <Section index="02" eyebrow="Architecture" title="Inside the model">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <P>
                It&rsquo;s a <strong className="font-semibold text-[var(--text)]">decoder-only causal
                Transformer</strong> — the same family as a language model, but the &ldquo;words&rdquo; are
                pitches. Causal masking means each position can only see the pitches that came before
                it, so prediction is always honest about what was actually known at the time.
              </P>
              <P className="mt-4">
                Every pitch becomes one vector: the model sums a learned embedding for each
                categorical field, adds a{" "}
                <strong className="font-semibold text-[var(--text)]">learned embedding for the
                specific pitcher and batter</strong> (6,208 players), and a positional embedding so it
                knows where in the game it is. Pre-LayerNorm blocks of attention + MLP refine that
                sequence; four linear heads read off the result.
              </P>
            </div>
            <Card>
              <Eyebrow tone="muted" className="mb-2">
                Specification
              </Eyebrow>
              <SpecRow k="Type" v="Decoder-only" />
              <SpecRow k="Parameters" v="~7.5 M" />
              <SpecRow k="Model dim" v="256" />
              <SpecRow k="Layers" v="6" />
              <SpecRow k="Attention heads" v="8" />
              <SpecRow k="Context length" v="256" />
              <SpecRow k="Dropout" v="0.30" />
              <SpecRow k="Player embeddings" v="6,208" />
            </Card>
          </div>
        </Section>

        {/* ---- 03 data + tokenization ---- */}
        <Section index="03" eyebrow="Data & tokenization" title="From Statcast to tokens">
          <P>
            The training data is a decade of MLB Statcast — pulled via{" "}
            <code className="font-mono text-[13px] text-[var(--text)]">pybaseball</code>, seasons
            2015–2024. Each game is sorted into true chronological order and every pitch is mapped onto
            a <strong className="font-semibold text-[var(--text)]">frozen vocabulary</strong>: once the
            buckets are locked, their ids never change, so cached sequences and checkpoints stay valid.
          </P>
          <StaggerGroup className="mt-7 grid grid-cols-2 gap-y-7 sm:grid-cols-4">
            <StaggerItem><Stat value="10" label="Seasons (2015–2024)" /></StaggerItem>
            <StaggerItem><Stat value={<CountUp to={24077} comma />} label="Games tokenized" /></StaggerItem>
            <StaggerItem><Stat value={<CountUp to={22852} comma />} label="Train games (95%)" /></StaggerItem>
            <StaggerItem><Stat value={<CountUp to={1225} comma />} label="Held-out val (5%)" /></StaggerItem>
          </StaggerGroup>
          <P className="mt-7">
            A pitch token is built from the things that actually shape the next one — the count, outs,
            base runners, strike-zone location, handedness, score difference, inning, and the two
            player ids. The train/validation split is deterministic by hashed{" "}
            <code className="font-mono text-[13px] text-[var(--text)]">game_pk</code>, and the exact
            same function is reused at eval time, so the held-out set is precisely the games training
            never saw.
          </P>
          <div className="mt-6 flex flex-wrap gap-2">
            {["count", "outs", "base state", "zone", "handedness", "score diff", "inning", "pitcher id", "batter id"].map(
              (f) => (
                <span
                  key={f}
                  className="rounded-[var(--r-chip)] bg-[var(--surface-2)] px-2.5 py-1 font-mono text-[11px] lowercase tracking-[0.04em] text-[var(--muted)]"
                >
                  {f}
                </span>
              ),
            )}
          </div>
        </Section>

        {/* ---- 04 training + overfit→fix ---- */}
        <Section index="04" eyebrow="Training" title="Trained on a TPU — and the overfit we fixed">
          <P>
            Training runs on a free Kaggle <strong className="font-semibold text-[var(--text)]">TPU
            v5e-8</strong>, data-parallel across all 8 cores: the batch is sharded, params are
            replicated, and gradients are averaged each step. AdamW with a warmup-then-cosine schedule,
            gradient clipping, Orbax checkpoints, and early stopping on validation loss.
          </P>
          <P className="mt-4">
            The first serious run overfit — and that&rsquo;s worth telling honestly, because the fix is
            why the model generalizes.
          </P>
          <StaggerGroup className="mt-7 grid grid-cols-1 gap-3 md:grid-cols-2">
            <StaggerItem>
              <Card className="h-full border-[color-mix(in_srgb,var(--miss)_40%,transparent)]">
                <div className="flex items-center justify-between">
                  <Eyebrow tone="muted">First run</Eyebrow>
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--miss)]">
                    Overfit
                  </span>
                </div>
                <div className="mt-4 font-mono text-[28px] font-semibold tabular-nums text-[var(--text)]">
                  3.39 <span className="text-[var(--faint)]">→</span>{" "}
                  <span className="text-[var(--miss)]">5.0</span>
                </div>
                <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--muted)]">
                  On 3 seasons with light dropout, validation loss <em>diverged</em> upward while
                  training loss kept falling — too little data for the capacity, and a win-prob head
                  easy to memorize game-by-game.
                </p>
              </Card>
            </StaggerItem>
            <StaggerItem>
              <Card className="h-full border-[color-mix(in_srgb,var(--hit)_40%,transparent)]">
                <div className="flex items-center justify-between">
                  <Eyebrow tone="muted">Corrected run</Eyebrow>
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--hit)]">
                    Generalizes
                  </span>
                </div>
                <div className="mt-4 font-mono text-[28px] font-semibold tabular-nums text-[var(--win)]">
                  3.247
                </div>
                <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--muted)]">
                  Validation tracked training with no divergence and auto-stopped at its minimum —
                  best step 6000. That checkpoint produces every number on this page.
                </p>
              </Card>
            </StaggerItem>
          </StaggerGroup>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { k: "3× the data", v: "3 → 10 seasons" },
              { k: "More dropout", v: "0.1 → 0.3" },
              { k: "Down-weighted win head", v: "0.3 → 0.1" },
            ].map((f) => (
              <div key={f.k} className="surface px-4 py-3">
                <div className="font-display text-[14px] font-semibold text-[var(--text)]">{f.k}</div>
                <div className="mt-0.5 font-mono text-[12px] tabular-nums text-[var(--muted)]">{f.v}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--faint)]">
            Plus early stopping (patience 5) on validation loss
          </p>
        </Section>

        {/* ---- 05 pallas kernel ---- */}
        <Section index="05" eyebrow="Systems" title="A hand-written TPU attention kernel">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <P>
                As a systems-ML piece, attention is also written from scratch as a{" "}
                <strong className="font-semibold text-[var(--text)]">FlashAttention-style fused kernel
                in Pallas</strong>, JAX&rsquo;s low-level TPU language. It streams keys and values in
                blocks with an online softmax, so the full pitch-by-pitch score matrix is never
                materialized. It&rsquo;s checked for numerical correctness against a plain-JAX reference
                across 16 shapes, then its block sizes are autotuned.
              </P>
              <P className="mt-4">
                Benchmarked against XLA&rsquo;s own compiled attention on the TPU, it wins exactly where
                FlashAttention is supposed to — long context — and the lead grows with sequence length.
              </P>
              <Card className="mt-4 border-[var(--line-2)]">
                <p className="text-[13px] leading-relaxed text-[var(--muted)]">
                  <strong className="font-semibold text-[var(--text)]">Honest caveat:</strong> the
                  kernel is a standalone artifact — it isn&rsquo;t wired into this model&rsquo;s training,
                  whose 256-pitch context is the short regime where XLA already wins. It&rsquo;s shown as
                  a TPU-kernel capability, validated and benchmarked honestly, not a speedup this model
                  enjoys.
                </p>
              </Card>
            </div>
            <Card>
              <Eyebrow tone="muted" className="mb-4">
                Speedup vs XLA · TPU v5e-8
              </Eyebrow>
              <div className="space-y-4">
                {SPEEDUPS.map((s) => {
                  const w = s.x ? Math.min(100, ((s.x - 1) / (3.32 - 1)) * 92 + 8) : 0;
                  return (
                    <div key={s.len}>
                      <div className="flex items-baseline justify-between">
                        <span className="font-mono text-[12px] tabular-nums text-[var(--muted)]">
                          T = {s.len}
                        </span>
                        {s.x ? (
                          <span className="font-mono text-[16px] font-semibold tabular-nums text-[var(--model)]">
                            {s.x.toFixed(2)}×
                          </span>
                        ) : (
                          <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--faint)]">
                            {s.note}
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--track)]">
                        <div
                          className="h-full rounded-full bg-[var(--model)] transition-[width] duration-700"
                          style={{ width: `${w}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-4 border-t border-[var(--line)] pt-3 font-mono text-[10.5px] uppercase leading-relaxed tracking-[0.1em] text-[var(--faint)]">
                B = 4 · H = 8 · D = 64 · autotuned block sizes
              </p>
            </Card>
          </div>
        </Section>

        {/* ---- 06 results ---- */}
        <Section
          index="06"
          eyebrow="Evaluation"
          title="How well it does — and how to read it honestly"
        >
          <P>
            Measured on the 1,225 held-out games training never saw, against a most-frequent-class
            baseline for each head. Where the model gains accuracy, its cross-entropy beats the
            baseline too.
          </P>
          <Card className="mt-7">
            <div className="mb-4 flex items-center justify-between">
              <Eyebrow tone="model">Model</Eyebrow>
              <Eyebrow tone="faint">Baseline</Eyebrow>
            </div>
            <div className="space-y-6">
              {RESULTS.map((r) => (
                <div key={r.head}>
                  <div className="mb-2 flex items-baseline justify-between gap-3">
                    <span className="text-[14px] font-medium text-[var(--text)]">{r.head}</span>
                    <span
                      className={cx(
                        "rounded-[var(--r-chip)] px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums",
                        r.strong ? "bg-[var(--hit-soft)] text-[var(--hit)]" : "bg-[var(--surface-2)] text-[var(--muted)]",
                      )}
                    >
                      {r.delta}
                    </span>
                  </div>
                  {/* model bar (bright) over a thin baseline bar (dim) */}
                  <div className="h-6 overflow-hidden rounded-[var(--r-chip)] bg-[var(--track)]">
                    <div
                      className="flex h-full items-center bg-[var(--model)] transition-[width] duration-700"
                      style={{ width: `${(r.model / 60) * 100}%` }}
                    >
                      <span className="pl-2.5 font-mono text-[12px] font-bold tabular-nums text-[var(--bg)]">
                        {r.model.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2.5">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--track)]">
                      <div
                        className="h-full rounded-full bg-[var(--hair-mid)]"
                        style={{ width: `${(r.baseline / 60) * 100}%` }}
                      />
                    </div>
                    <span className="w-24 shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] tabular-nums text-[var(--faint)]">
                      base {r.baseline.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-5 border-t border-[var(--line)] pt-4 text-[13px] leading-relaxed text-[var(--muted)]">
              <strong className="font-semibold text-[var(--text)]">Next-pitch type is the clearest
              signal</strong> — and the count alone doesn&rsquo;t explain it: a count-aware baseline
              still sits at 33.6%, so the 17-point gain comes from the pitch sequence, the specific
              players, and zone history. <strong className="font-semibold text-[var(--text)]">Next-pitch
              outcome is intentionally modest</strong> — whether a pitch is a ball, strike, or foul is
              close to irreducible, and a ~2-point edge is about all that&rsquo;s really there.
            </p>
          </Card>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <Card>
              <div className="mb-3 whitespace-nowrap font-mono text-[10.5px] font-medium uppercase tracking-[0.2em] text-[var(--win)]">
                Win probability · the honest measure
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[40px] font-semibold leading-none tabular-nums text-[var(--win)]">
                  0.072
                </span>
                <span className="font-mono text-[12px] uppercase tracking-[0.12em] text-[var(--faint)]">
                  ECE
                </span>
              </div>
              <p className="mt-4 text-[13.5px] leading-relaxed text-[var(--muted)]">
                The win head&rsquo;s raw 77.7% accuracy is flattering — it&rsquo;s scored every pitch, so
                late-game positions where the result is nearly settled inflate it. The honest signal is{" "}
                <strong className="font-semibold text-[var(--text)]">calibration</strong>: across the
                whole probability range, an Expected Calibration Error of 0.072 means a predicted 70%
                really does win about 70% of the time.
              </p>
            </Card>
            <figure className="surface overflow-hidden p-3">
              <Image
                src="/calibration.png"
                alt="Reliability diagram: mean predicted P(home win) versus the empirical home-win rate per bin, tracking close to the y = x line."
                width={640}
                height={480}
                className="h-auto w-full rounded-[10px] bg-white"
              />
              <figcaption className="px-1.5 pb-1 pt-3 font-mono text-[10.5px] uppercase leading-relaxed tracking-[0.1em] text-[var(--faint)]">
                Reliability diagram — predicted win probability vs. the actual rate, against the
                diagonal. Closer to the line is better-calibrated.
              </figcaption>
            </figure>
          </div>
        </Section>

        {/* ---- 07 live serving ---- */}
        <Section index="07" eyebrow="Live serving" title="Live, pitch by pitch">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <P>
                On this site the model is real, not a stub. A FastAPI server loads the step-6000
                checkpoint, pulls a game&rsquo;s live feed from the MLB Stats API, and encodes each live
                pitch through the <em>same</em> frozen vocabulary used in training. One causal forward
                pass returns the next-pitch and win-probability predictions you see, cached briefly per
                game.
              </P>
              <P className="mt-4">
                Live next-pitch-type accuracy runs around{" "}
                <strong className="font-semibold text-[var(--text)]">48–56%</strong> — a touch under the
                50.6% held-out figure, exactly as expected: 2026 rosters drift from the 2015–2024
                training window, so more current players fall back to a generic &ldquo;unknown
                player&rdquo; embedding.
              </P>
            </div>
            <Card className="flex flex-col justify-center">
              <Eyebrow tone="muted" className="mb-3">
                When the model is offline
              </Eyebrow>
              <p className="text-[13.5px] leading-relaxed text-[var(--muted)]">
                The free inference host sleeps when idle. During a cold start, the site cleanly falls
                back to a <strong className="font-semibold text-[var(--text)]">clearly labeled mock
                predictor</strong> — never a broken screen — and a badge appears bottom-left so you
                always know whether you&rsquo;re seeing the trained model or the stub.
              </p>
              <div className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em]"
                style={{ borderColor: "rgba(216,178,74,.40)", color: "var(--warn)", background: "rgba(216,178,74,.10)" }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--warn)" }} />
                Mock predictions · model offline
              </div>
            </Card>
          </div>
        </Section>

        {/* ---- 08 framing + stack ---- */}
        <Reveal>
          <section className="surface overflow-hidden">
            <div className="accent-rule" />
            <div className="p-6 sm:p-9">
              <Eyebrow tone="live" className="mb-4">
                The framing
              </Eyebrow>
              <h2 className="max-w-3xl font-display text-[clamp(1.4rem,4vw,2rem)] font-bold leading-[1.1] tracking-tight text-[var(--text)]">
                It models the dynamics of a game — not the betting market.
              </h2>
              <P className="mt-5">
                DiamondAI is built to capture the conditional structure of baseball: given everything
                that&rsquo;s happened, what tends to happen next. It is deliberately{" "}
                <strong className="font-semibold text-[var(--text)]">not</strong> trying to beat
                sportsbooks — it never sees injuries, lineups, weather, or line movement. The
                win-probability head is here as a clean calibration target and a natural game-state
                readout, not as a market price.
              </P>
              <div className="mt-8 border-t border-[var(--line)] pt-6">
                <Eyebrow tone="faint" className="mb-3">
                  Built with
                </Eyebrow>
                <div className="flex flex-wrap gap-2">
                  {TECH.map((t) => (
                    <span
                      key={t}
                      className="rounded-[var(--r-chip)] bg-[var(--surface-2)] px-2.5 py-1 font-mono text-[11px] tracking-[0.02em] text-[var(--muted)]"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </Reveal>
      </div>
    </main>
  );
}
