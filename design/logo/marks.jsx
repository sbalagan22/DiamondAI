/* DiamondAI — logo mark explorations.
   All marks are built from simple geometry (diamonds, lines, dots) only.
   Neutral lines use currentColor so they invert on light vs dark grounds;
   brand red (#ff4b51) and blue (#4d8bff) are explicit. */

const BLUE = '#4d8bff';
const RED = '#ff4b51';

// A — INFIELD: the baseball diamond. Outline + red home plate + blue pitch node.
function MarkInfield({ size = 96, stroke = 3 }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} fill="none" aria-label="DiamondAI infield mark">
      <polygon points="50,11 89,50 50,89 11,50" stroke="currentColor" strokeWidth={stroke} strokeLinejoin="round" opacity="0.95" />
      {/* home plate */}
      <polygon points="50,80 56,86 50,93 44,86" fill={RED} />
      {/* pitch node */}
      <circle cx="50" cy="50" r="9.5" fill="none" stroke="currentColor" strokeWidth="1.6" opacity="0.55" />
      <circle cx="50" cy="50" r="5" fill={BLUE} />
    </svg>
  );
}

// B — BRILLIANT: faceted gemstone. White table, blue + red pavilion facets.
function MarkBrilliant({ size = 96, stroke = 2.4 }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} fill="none" aria-label="DiamondAI gem mark">
      {/* facets */}
      <polygon points="30,27 70,27 60,49 40,49" fill="currentColor" opacity="0.92" />
      <polygon points="30,27 40,49 14,49" fill="currentColor" opacity="0.32" />
      <polygon points="70,27 86,49 60,49" fill="currentColor" opacity="0.46" />
      <polygon points="14,49 40,49 50,90" fill={BLUE} />
      <polygon points="40,49 60,49 50,90" fill="currentColor" opacity="0.65" />
      <polygon points="60,49 86,49 50,90" fill={RED} />
      {/* outline + girdle */}
      <polygon points="30,27 70,27 86,49 50,90 14,49" stroke="currentColor" strokeWidth={stroke} strokeLinejoin="round" opacity="0.9" />
      <line x1="14" y1="49" x2="86" y2="49" stroke="currentColor" strokeWidth={stroke * 0.7} opacity="0.55" />
    </svg>
  );
}

// C — TRACKER: concentric diamonds (radar), red center + blue predicted point.
function MarkTracker({ size = 96 }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} fill="none" aria-label="DiamondAI tracker mark">
      <polygon points="50,7 93,50 50,93 7,50" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" opacity="0.35" />
      <polygon points="50,24 76,50 50,76 24,50" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" opacity="0.8" />
      <circle cx="50" cy="50" r="5.5" fill={RED} />
      {/* predicted point on the radar */}
      <circle cx="68" cy="36" r="4" fill={BLUE} />
      <line x1="50" y1="50" x2="68" y2="36" stroke={BLUE} strokeWidth="1.6" opacity="0.6" />
    </svg>
  );
}

// D — CHIP: app-icon. Rounded frosted tile holding the diamond glyph.
function MarkChip({ size = 96, ground = 'dark' }) {
  const tile = ground === 'dark'
    ? 'linear-gradient(145deg, rgba(255,255,255,0.14), rgba(255,255,255,0.04)), #2c2c2e'
    : 'linear-gradient(145deg, #ffffff, #ededee)';
  const line = ground === 'dark' ? '#f6f6f7' : '#1c1c1e';
  return (
    <div
      style={{
        width: size, height: size, borderRadius: size * 0.24,
        background: tile,
        boxShadow: ground === 'dark'
          ? 'inset 0 1px 0 rgba(255,255,255,0.28), inset 0 -1px 1px rgba(0,0,0,0.5), 0 10px 24px -10px rgba(0,0,0,0.7)'
          : 'inset 0 1px 0 rgba(255,255,255,0.9), 0 8px 20px -10px rgba(0,0,0,0.35)',
        display: 'grid', placeItems: 'center',
      }}
    >
      <svg viewBox="0 0 100 100" width={size * 0.56} height={size * 0.56} fill="none" style={{ color: line }} aria-label="DiamondAI chip mark">
        <polygon points="50,12 88,50 50,88 12,50" stroke="currentColor" strokeWidth="6" strokeLinejoin="round" />
        <polygon points="50,33 67,50 50,67 33,50" fill={RED} />
      </svg>
    </div>
  );
}

const MARKS = { infield: MarkInfield, brilliant: MarkBrilliant, tracker: MarkTracker };

// Horizontal wordmark lockup: mark + "Diamond" + "AI" (AI in model blue).
function Lockup({ which = 'infield', scale = 1, ground = 'dark' }) {
  const Mark = MARKS[which];
  const textColor = ground === 'dark' ? '#f6f6f7' : '#1c1c1e';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 * scale, color: textColor }}>
      <Mark size={42 * scale} />
      <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 30 * scale, letterSpacing: '-0.02em', lineHeight: 1 }}>
        Diamond<span style={{ color: BLUE }}>AI</span>
      </span>
    </div>
  );
}

Object.assign(window, { MarkInfield, MarkBrilliant, MarkTracker, MarkChip, Lockup, MARKS, BLUE, RED });
