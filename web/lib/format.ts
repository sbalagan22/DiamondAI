import type {
  AtBatOutcome,
  GameSnapshot,
  OutcomeClass,
  PitchCall,
  PitchEvent,
} from "./types";

export function pct(p: number): string {
  return `${Math.round(p * 100)}%`;
}

export const CALL_LABELS: Record<PitchCall, string> = {
  ball: "Ball",
  called_strike: "Called strike",
  swinging_strike: "Swinging strike",
  foul: "Foul",
  in_play: "In play",
};

export function inningLabel(s: GameSnapshot): string {
  return `${s.half === "top" ? "Top" : "Bot"} ${s.inning}`;
}

export function shortName(full: string): string {
  const parts = full.split(" ");
  return parts.length > 1 ? `${parts[0][0]}. ${parts.slice(1).join(" ")}` : full;
}

export function outcomeClassOf(outcome: AtBatOutcome): OutcomeClass {
  if (outcome === "strikeout") return "strikeout";
  if (outcome === "walk") return "walk";
  if (outcome === "field_out") return "out";
  return "hit";
}

export interface AccuracyStat {
  correct: number;
  total: number;
}

export interface ModelAccuracy {
  pitch: AccuracyStat;
  outcome: AccuracyStat;
}

/** Model accuracy over the pitches thrown so far. */
export function computeAccuracy(events: PitchEvent[]): ModelAccuracy {
  const pitch: AccuracyStat = { correct: 0, total: 0 };
  const outcome: AccuracyStat = { correct: 0, total: 0 };
  for (const e of events) {
    pitch.total += 1;
    if (e.prediction.pitches[0].type === e.pitchType) pitch.correct += 1;
    if (e.atBat) {
      outcome.total += 1;
      const classes = Object.entries(e.prediction.outcome) as [
        OutcomeClass,
        number,
      ][];
      classes.sort((a, b) => b[1] - a[1]);
      if (classes[0][0] === outcomeClassOf(e.atBat.outcome)) {
        outcome.correct += 1;
      }
    }
  }
  return { pitch, outcome };
}

export function accuracyPct(stat: AccuracyStat): string {
  if (stat.total === 0) return "—";
  return pct(stat.correct / stat.total);
}
