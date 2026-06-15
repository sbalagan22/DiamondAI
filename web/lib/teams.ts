import type { PitchTypeCode, Team } from "./types";

export const TEAMS: Record<string, Team> = {
  // AL East
  bal: { id: "bal", abbr: "BAL", city: "Baltimore", name: "Orioles" },
  bos: { id: "bos", abbr: "BOS", city: "Boston", name: "Red Sox" },
  nyy: { id: "nyy", abbr: "NYY", city: "New York", name: "Yankees" },
  tb: { id: "tb", abbr: "TB", city: "Tampa Bay", name: "Rays" },
  tor: { id: "tor", abbr: "TOR", city: "Toronto", name: "Blue Jays" },
  // AL Central
  cws: { id: "cws", abbr: "CWS", city: "Chicago", name: "White Sox" },
  cle: { id: "cle", abbr: "CLE", city: "Cleveland", name: "Guardians" },
  det: { id: "det", abbr: "DET", city: "Detroit", name: "Tigers" },
  kc: { id: "kc", abbr: "KC", city: "Kansas City", name: "Royals" },
  min: { id: "min", abbr: "MIN", city: "Minnesota", name: "Twins" },
  // AL West
  hou: { id: "hou", abbr: "HOU", city: "Houston", name: "Astros" },
  laa: { id: "laa", abbr: "LAA", city: "Anaheim", name: "Angels" },
  oak: { id: "oak", abbr: "ATH", city: "Athletics", name: "Athletics" },
  sea: { id: "sea", abbr: "SEA", city: "Seattle", name: "Mariners" },
  tex: { id: "tex", abbr: "TEX", city: "Texas", name: "Rangers" },
  // NL East
  atl: { id: "atl", abbr: "ATL", city: "Atlanta", name: "Braves" },
  mia: { id: "mia", abbr: "MIA", city: "Miami", name: "Marlins" },
  nym: { id: "nym", abbr: "NYM", city: "New York", name: "Mets" },
  phi: { id: "phi", abbr: "PHI", city: "Philadelphia", name: "Phillies" },
  wsh: { id: "wsh", abbr: "WSH", city: "Washington", name: "Nationals" },
  // NL Central
  chc: { id: "chc", abbr: "CHC", city: "Chicago", name: "Cubs" },
  cin: { id: "cin", abbr: "CIN", city: "Cincinnati", name: "Reds" },
  mil: { id: "mil", abbr: "MIL", city: "Milwaukee", name: "Brewers" },
  pit: { id: "pit", abbr: "PIT", city: "Pittsburgh", name: "Pirates" },
  stl: { id: "stl", abbr: "STL", city: "St. Louis", name: "Cardinals" },
  // NL West
  ari: { id: "ari", abbr: "ARI", city: "Arizona", name: "Diamondbacks" },
  col: { id: "col", abbr: "COL", city: "Colorado", name: "Rockies" },
  lad: { id: "lad", abbr: "LAD", city: "Los Angeles", name: "Dodgers" },
  sd: { id: "sd", abbr: "SD", city: "San Diego", name: "Padres" },
  sf: { id: "sf", abbr: "SF", city: "San Francisco", name: "Giants" },
};

/**
 * Team identity metadata: official primary color. Kept separate from the `Team`
 * contract so the real feed can fulfill the core shape without owning brand
 * assets. Logo SVGs (transparent, dark/light variants) live under
 * `public/logos/mlb/{dark,light}/<id>.svg` and are resolved by id in `view.ts`.
 */
export interface TeamMeta {
  primaryColor: string;
}

export const TEAM_META: Record<string, TeamMeta> = {
  bal: { primaryColor: "#DF4601" },
  bos: { primaryColor: "#BD3039" },
  nyy: { primaryColor: "#132448" },
  tb: { primaryColor: "#092C5C" },
  tor: { primaryColor: "#134A8E" },
  cws: { primaryColor: "#17171A" },
  cle: { primaryColor: "#00385D" },
  det: { primaryColor: "#182D55" },
  kc: { primaryColor: "#174885" },
  min: { primaryColor: "#002B5C" },
  hou: { primaryColor: "#002D62" },
  laa: { primaryColor: "#BA0021" },
  oak: { primaryColor: "#003831" },
  sea: { primaryColor: "#0C2C56" },
  tex: { primaryColor: "#003278" },
  atl: { primaryColor: "#13274F" },
  mia: { primaryColor: "#17171A" },
  nym: { primaryColor: "#FF5910" },
  phi: { primaryColor: "#E81828" },
  wsh: { primaryColor: "#AB0003" },
  chc: { primaryColor: "#0E3386" },
  cin: { primaryColor: "#C6011F" },
  mil: { primaryColor: "#0A2351" },
  pit: { primaryColor: "#FDB827" },
  stl: { primaryColor: "#C41E3A" },
  ari: { primaryColor: "#A71930" },
  col: { primaryColor: "#33006F" },
  lad: { primaryColor: "#005A9C" },
  sd: { primaryColor: "#2F241D" },
  sf: { primaryColor: "#FD5A1E" },
};

export const VENUES: Record<string, string> = {
  bal: "Camden Yards",
  bos: "Fenway Park",
  nyy: "Yankee Stadium",
  tb: "Tropicana Field",
  tor: "Rogers Centre",
  cws: "Rate Field",
  cle: "Progressive Field",
  det: "Comerica Park",
  kc: "Kauffman Stadium",
  min: "Target Field",
  hou: "Daikin Park",
  laa: "Angel Stadium",
  oak: "Sutter Health Park",
  sea: "T-Mobile Park",
  tex: "Globe Life Field",
  atl: "Truist Park",
  mia: "loanDepot park",
  nym: "Citi Field",
  phi: "Citizens Bank Park",
  wsh: "Nationals Park",
  chc: "Wrigley Field",
  cin: "Great American Ball Park",
  mil: "American Family Field",
  pit: "PNC Park",
  stl: "Busch Stadium",
  ari: "Chase Field",
  col: "Coors Field",
  lad: "Dodger Stadium",
  sd: "Petco Park",
  sf: "Oracle Park",
};

/** Name pools for seeded fictional rosters. */
export const FIRST_NAMES = [
  "Mateo", "Cole", "Dario", "Jalen", "Tomás", "Reese", "Kazuo", "Bryce",
  "Elias", "Marcus", "Theo", "Iker", "Dante", "Owen", "Luis", "Avery",
  "Shin", "Caleb", "Rafael", "Drew", "Nico", "Jordan", "Emil", "Trey",
  "Andrés", "Logan", "Sota", "Miles", "Victor", "Grant",
];

export const LAST_NAMES = [
  "Vargas", "Whitaker", "Okada", "Reyes", "Calloway", "Brennan", "Ishida",
  "Mercer", "Delgado", "Hawkins", "Romero", "Stanton", "Iwasaki", "Beck",
  "Fuentes", "Carmichael", "Ortega", "Lindqvist", "Maddox", "Serrano",
  "Holt", "Navarro", "Ellsworth", "Tanaka", "Quinn", "Barrera", "Sloane",
  "Medina", "Pruitt", "Castillo",
];

/** Pitcher repertoire archetypes: [pitch, weight]. */
export const REPERTOIRES: [PitchTypeCode, number][][] = [
  [["FF", 46], ["SL", 27], ["CH", 14], ["CU", 13]],
  [["SI", 42], ["SL", 24], ["FC", 18], ["CH", 16]],
  [["FC", 34], ["FF", 28], ["SW", 22], ["CU", 16]],
  [["FF", 30], ["CH", 28], ["CU", 24], ["SL", 18]],
  [["FF", 38], ["SW", 32], ["SI", 16], ["CH", 14]],
];

/** Velocity bands per pitch type: [min, max] mph. */
export const MPH_RANGE: Record<PitchTypeCode, [number, number]> = {
  FF: [93.5, 98],
  SI: [91, 95.5],
  FC: [86.5, 91],
  SL: [83, 88],
  SW: [78.5, 83.5],
  CU: [75.5, 81],
  CH: [82, 87],
};
