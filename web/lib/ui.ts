/** Tiny presentation helpers shared by the ported design components. */

export const cx = (...a: (string | false | null | undefined)[]): string =>
  a.filter(Boolean).join(" ");

/** 0..1 -> integer percent (matches the design's `pct`). */
export const pct = (x: number): number => Math.round(x * 100);

/** Append a 2-digit hex alpha to a `#rrggbb` color (e.g. hexA(c,"26") ≈ 15%). */
export const hexA = (hex: string, aa: string): string => `${hex}${aa}`;

/** A faint identity wash for a head-to-head card: away color bleeds from the
 *  left, home color from the right, transparent through the middle. */
export const teamSplit = (away: string, home: string, aa = "24"): string =>
  `linear-gradient(100deg, ${away}${aa} 0%, transparent 40%, transparent 60%, ${home}${aa} 100%)`;
