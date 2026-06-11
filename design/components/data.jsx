/*
 * DiamondAI — mock data layer (prototype)
 * Shapes here mirror the TypeScript interfaces used in the Next.js port,
 * so a real data source can replace these objects without touching the UI.
 *
 * @typedef {Object} Team
 * @property {string} id            // 'NYY'
 * @property {string} city          // 'New York'
 * @property {string} name          // 'Yankees'
 * @property {string} abbr          // 'NYY'
 * @property {string} accent        // hex used for the monogram chip
 *
 * @typedef {'pre'|'live'|'final'} GameStatus
 *
 * @typedef {Object} Game
 * @property {string} id
 * @property {GameStatus} status
 * @property {Team} away
 * @property {Team} home
 * @property {number} awayScore
 * @property {number} homeScore
 * @property {string} startLabel    // '7:05 PM' (pre) — local label
 * @property {number} [inning]      // 1..9 (live/final)
 * @property {'top'|'bot'} [half]   // (live)
 * @property {number} [homeWinProb] // 0..1 model's current home win prob (live)
 * @property {string} [venue]
 * @property {string} [headline]    // short status note for finals/pre
 *
 * @typedef {Object} Zone
 * @property {number} col           // 0,1,2 (catcher's view: 0=left/inside-to-RHB)
 * @property {number} row           // 0,1,2 (0=up)
 * @property {string} label         // 'Low & away'
 *
 * @typedef {Object} Prediction
 * @property {string} pitchType     // 'Slider'
 * @property {Zone} zone
 * @property {string} outcome       // 'Swinging strike'
 * @property {number} confidence    // 0..1
 *
 * @typedef {Object} ActualPitch
 * @property {string} pitchType     // 'Slider'
 * @property {number} velo          // mph
 * @property {Zone} zone
 * @property {string} outcome       // 'Ball'
 * @property {'ball'|'called'|'swinging'|'foul'|'inplay'|'hbp'} result
 *
 * @typedef {Object} Pitch
 * @property {number} seq           // 1-based across the at-bats shown
 * @property {{balls:number,strikes:number}} countBefore
 * @property {{balls:number,strikes:number}} countAfter
 * @property {number} outs
 * @property {{first:boolean,second:boolean,third:boolean}} bases
 * @property {Prediction} predicted
 * @property {ActualPitch} actual
 * @property {number} homeWinProbAfter   // 0..1
 * @property {string} [abEnd]            // text if this pitch ended the at-bat
 */

// ---- Teams (real names are factual; no logos/branded marks used) -----------
const TEAMS = {
  NYY: { id: 'NYY', city: 'New York',   name: 'Yankees',   abbr: 'NYY', accent: '#6c8db5' },
  BOS: { id: 'BOS', city: 'Boston',     name: 'Red Sox',   abbr: 'BOS', accent: '#c8434f' },
  LAD: { id: 'LAD', city: 'Los Angeles',name: 'Dodgers',   abbr: 'LAD', accent: '#4f7fc4' },
  SF:  { id: 'SF',  city: 'San Francisco',name:'Giants',   abbr: 'SF',  accent: '#c98b4a' },
  HOU: { id: 'HOU', city: 'Houston',    name: 'Astros',    abbr: 'HOU', accent: '#c97a4a' },
  SEA: { id: 'SEA', city: 'Seattle',    name: 'Mariners',  abbr: 'SEA', accent: '#3f8f8a' },
  ATL: { id: 'ATL', city: 'Atlanta',    name: 'Braves',    abbr: 'ATL', accent: '#b8454f' },
  NYM: { id: 'NYM', city: 'New York',   name: 'Mets',      abbr: 'NYM', accent: '#c97a3f' },
  CHC: { id: 'CHC', city: 'Chicago',    name: 'Cubs',      abbr: 'CHC', accent: '#5277b8' },
  STL: { id: 'STL', city: 'St. Louis',  name: 'Cardinals', abbr: 'STL', accent: '#c54a55' },
  SD:  { id: 'SD',  city: 'San Diego',  name: 'Padres',    abbr: 'SD',  accent: '#9a8456' },
  PHI: { id: 'PHI', city: 'Philadelphia',name:'Phillies',  abbr: 'PHI', accent: '#c4545c' },
};

// ---- Schedule --------------------------------------------------------------
/** @type {Game[]} */
const GAMES = [
  {
    id: 'nyy-bos', status: 'live', away: TEAMS.NYY, home: TEAMS.BOS,
    awayScore: 3, homeScore: 4, inning: 7, half: 'top', homeWinProb: 0.62,
    startLabel: '7:05 PM', venue: 'Fenway Park', headline: 'Bot 7 · tied late',
  },
  {
    id: 'lad-sf', status: 'live', away: TEAMS.LAD, home: TEAMS.SF,
    awayScore: 5, homeScore: 2, inning: 5, half: 'bot', homeWinProb: 0.27,
    startLabel: '9:45 PM', venue: 'Oracle Park',
  },
  {
    id: 'hou-sea', status: 'live', away: TEAMS.HOU, home: TEAMS.SEA,
    awayScore: 1, homeScore: 1, inning: 8, half: 'top', homeWinProb: 0.55,
    startLabel: '9:40 PM', venue: 'T-Mobile Park',
  },
  {
    id: 'atl-nym', status: 'pre', away: TEAMS.ATL, home: TEAMS.NYM,
    awayScore: 0, homeScore: 0, startLabel: '7:10 PM', venue: 'Citi Field',
    homeWinProb: 0.48,
  },
  {
    id: 'chc-stl', status: 'pre', away: TEAMS.CHC, home: TEAMS.STL,
    awayScore: 0, homeScore: 0, startLabel: '7:45 PM', venue: 'Busch Stadium',
    homeWinProb: 0.53,
  },
  {
    id: 'sd-phi', status: 'final', away: TEAMS.SD, home: TEAMS.PHI,
    awayScore: 2, homeScore: 6, inning: 9, startLabel: '1:05 PM',
    venue: 'Citizens Bank Park', headline: 'Final',
  },
];

// ---- The live game's people ------------------------------------------------
const MATCHUP = {
  pitcher: { name: 'Garrett Whitlock', team: 'BOS', hand: 'R', line: '6.1 IP · 5 K · 88 pitches', role: 'RHP' },
  batter:  { name: 'Aaron Judge',      team: 'NYY', hand: 'R', line: '1-for-3 · BB · today', role: 'RF' },
};

// ---- Pitch sequence for the live game (drives the simulated ticker) --------
// Catcher's-view zone: col 0 = inside to a RHB, row 0 = top of zone.
/** @type {Pitch[]} */
const PITCHES = [
  {
    seq: 1, countBefore: { balls: 0, strikes: 0 }, countAfter: { balls: 0, strikes: 1 },
    outs: 1, bases: { first: true, second: false, third: false },
    predicted: { pitchType: 'Sinker', zone: { col: 0, row: 1, label: 'Inside' }, outcome: 'Called strike', confidence: 0.58 },
    actual:    { pitchType: 'Sinker', velo: 94.6, zone: { col: 0, row: 1, label: 'Inside' }, outcome: 'Called strike', result: 'called' },
    homeWinProbAfter: 0.63,
  },
  {
    seq: 2, countBefore: { balls: 0, strikes: 1 }, countAfter: { balls: 0, strikes: 2 },
    outs: 1, bases: { first: true, second: false, third: false },
    predicted: { pitchType: 'Slider', zone: { col: 2, row: 2, label: 'Low & away' }, outcome: 'Swinging strike', confidence: 0.66 },
    actual:    { pitchType: 'Slider', velo: 87.2, zone: { col: 2, row: 2, label: 'Low & away' }, outcome: 'Foul', result: 'foul' },
    homeWinProbAfter: 0.65,
  },
  {
    seq: 3, countBefore: { balls: 0, strikes: 2 }, countAfter: { balls: 1, strikes: 2 },
    outs: 1, bases: { first: true, second: false, third: false },
    predicted: { pitchType: 'Slider', zone: { col: 2, row: 2, label: 'Chase, low-away' }, outcome: 'Swinging strike', confidence: 0.61 },
    actual:    { pitchType: 'Changeup', velo: 86.1, zone: { col: 2, row: 2, label: 'Low & away' }, outcome: 'Ball', result: 'ball' },
    homeWinProbAfter: 0.62,
  },
  {
    seq: 4, countBefore: { balls: 1, strikes: 2 }, countAfter: { balls: 1, strikes: 2 },
    outs: 1, bases: { first: true, second: false, third: false },
    predicted: { pitchType: 'Four-seam', zone: { col: 1, row: 0, label: 'High' }, outcome: 'Foul', confidence: 0.54 },
    actual:    { pitchType: 'Four-seam', velo: 95.8, zone: { col: 1, row: 0, label: 'High' }, outcome: 'Foul', result: 'foul' },
    homeWinProbAfter: 0.63,
  },
  {
    seq: 5, countBefore: { balls: 1, strikes: 2 }, countAfter: { balls: 2, strikes: 2 },
    outs: 1, bases: { first: true, second: false, third: false },
    predicted: { pitchType: 'Slider', zone: { col: 2, row: 2, label: 'Low & away' }, outcome: 'Swinging strike', confidence: 0.63 },
    actual:    { pitchType: 'Slider', velo: 86.9, zone: { col: 2, row: 1, label: 'Away' }, outcome: 'Ball', result: 'ball' },
    homeWinProbAfter: 0.60,
  },
  {
    seq: 6, countBefore: { balls: 2, strikes: 2 }, countAfter: { balls: 2, strikes: 2 },
    outs: 1, bases: { first: true, second: false, third: false },
    predicted: { pitchType: 'Four-seam', zone: { col: 0, row: 0, label: 'Up & in' }, outcome: 'Foul', confidence: 0.49 },
    actual:    { pitchType: 'Four-seam', velo: 96.1, zone: { col: 0, row: 0, label: 'Up & in' }, outcome: 'Foul', result: 'foul' },
    homeWinProbAfter: 0.61,
  },
  {
    seq: 7, countBefore: { balls: 2, strikes: 2 }, countAfter: { balls: 3, strikes: 2 },
    outs: 1, bases: { first: true, second: false, third: false },
    predicted: { pitchType: 'Slider', zone: { col: 2, row: 2, label: 'Low & away' }, outcome: 'Swinging strike', confidence: 0.57 },
    actual:    { pitchType: 'Sinker', velo: 94.2, zone: { col: 0, row: 2, label: 'Low & in' }, outcome: 'Ball', result: 'ball' },
    homeWinProbAfter: 0.57,
  },
  {
    seq: 8, countBefore: { balls: 3, strikes: 2 }, countAfter: { balls: 3, strikes: 2 },
    outs: 1, bases: { first: true, second: false, third: false },
    predicted: { pitchType: 'Four-seam', zone: { col: 1, row: 1, label: 'Heart' }, outcome: 'In play', confidence: 0.52 },
    actual:    { pitchType: 'Four-seam', velo: 96.4, zone: { col: 1, row: 1, label: 'Heart, middle' }, outcome: 'In play — flyout', result: 'inplay' },
    homeWinProbAfter: 0.71, abEnd: 'Judge flies out to deep center. 2 outs.',
  },
];

// New batter after the at-bat resolves (used when the loop wraps).
const NEXT_BATTER = { name: 'Juan Soto', team: 'NYY', hand: 'L', line: '2-for-3 · 2B · today', role: 'DH' };

// Pre-game model read for the live game (shown if user opens before first pitch).
const PREGAME = {
  homeWinProb: 0.58,
  note: 'Model favors Boston at home behind Whitlock; Yankees bats trending warm vs RHP.',
};

Object.assign(window, { TEAMS, GAMES, MATCHUP, PITCHES, NEXT_BATTER, PREGAME });
