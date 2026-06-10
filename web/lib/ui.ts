/** Tiny presentation helpers shared by the ported design components. */

export const cx = (...a: (string | false | null | undefined)[]): string =>
  a.filter(Boolean).join(" ");

/** 0..1 -> integer percent (matches the design's `pct`). */
export const pct = (x: number): number => Math.round(x * 100);
