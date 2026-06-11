/* DiamondAI — logo studio canvas */

const darkScene = {
  width: '100%', height: '100%', boxSizing: 'border-box',
  background:
    'radial-gradient(62% 52% at 82% -6%, rgba(77,139,255,0.18), transparent 60%),' +
    'radial-gradient(56% 46% at 8% 106%, rgba(255,75,81,0.14), transparent 62%),' +
    '#1c1c1e',
  color: '#f6f6f7',
  display: 'flex', flexDirection: 'column',
};

const Eyebrow = ({ children, color = 'rgba(255,255,255,0.4)' }) => (
  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color }}>{children}</div>
);

function Concept({ id, name, blurb, mark }) {
  return (
    <div style={darkScene}>
      <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: '34px 0 26px' }}>
        <div style={{ color: '#f6f6f7' }}>{mark}</div>
      </div>
      <div style={{ padding: '20px 26px 24px', borderTop: '1px solid rgba(255,255,255,0.09)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 19, letterSpacing: '-0.01em' }}>{name}</span>
          <Eyebrow>{id}</Eyebrow>
        </div>
        <p style={{ margin: '8px 0 18px', fontSize: 12.5, lineHeight: 1.5, color: 'rgba(255,255,255,0.62)', fontFamily: "'Archivo', sans-serif" }}>{blurb}</p>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.09)', paddingTop: 16 }}>
          <Lockup which={id} scale={0.92} />
        </div>
      </div>
    </div>
  );
}

function FaviconStrip({ ground = 'dark' }) {
  const sizes = [56, 40, 28, 18];
  const bg = ground === 'dark' ? darkScene.background : '#ffffff';
  const line = ground === 'dark' ? '#f6f6f7' : '#1c1c1e';
  return (
    <div style={{ width: '100%', height: '100%', boxSizing: 'border-box', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 26 }}>
      {sizes.map((s) => (
        <div key={s} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <svg viewBox="0 0 100 100" width={s} height={s} fill="none" style={{ color: line }}>
            <polygon points="50,12 88,50 50,88 12,50" stroke="currentColor" strokeWidth="6" strokeLinejoin="round" />
            <polygon points="50,33 67,50 50,67 33,50" fill={RED} />
          </svg>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, letterSpacing: '0.1em', color: ground === 'dark' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' }}>{s}px</span>
        </div>
      ))}
    </div>
  );
}

function LightLockups() {
  return (
    <div style={{ width: '100%', height: '100%', boxSizing: 'border-box', background: '#ffffff', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 30, padding: '36px 40px' }}>
      <Lockup which="infield" ground="light" scale={1.05} />
      <div style={{ height: 1, background: 'rgba(0,0,0,0.08)' }} />
      <Lockup which="brilliant" ground="light" scale={1.05} />
      <div style={{ height: 1, background: 'rgba(0,0,0,0.08)' }} />
      <Lockup which="tracker" ground="light" scale={1.05} />
    </div>
  );
}

function ChipBoard() {
  return (
    <div style={darkScene}>
      <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: '30px 0 22px' }}>
        <MarkChip size={132} ground="dark" />
      </div>
      <div style={{ padding: '18px 26px 22px', borderTop: '1px solid rgba(255,255,255,0.09)' }}>
        <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 19, letterSpacing: '-0.01em' }}>Chip</span>
        <p style={{ margin: '8px 0 16px', fontSize: 12.5, lineHeight: 1.5, color: 'rgba(255,255,255,0.62)', fontFamily: "'Archivo', sans-serif" }}>
          Frosted-glass tile holding the diamond glyph — the home-screen / favicon form of any mark.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, borderTop: '1px solid rgba(255,255,255,0.09)', paddingTop: 16 }}>
          <MarkChip size={40} ground="dark" />
          <MarkChip size={28} ground="dark" />
          <MarkChip size={40} ground="light" />
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <DesignCanvas>
      <DCSection id="marks" title="DiamondAI · logo concepts" subtitle="Four directions — all built from the diamond. Open any one fullscreen.">
        <DCArtboard id="infield" label="A · Infield" width={360} height={432}>
          <Concept id="infield" name="Infield"
            blurb="The baseball diamond, literally — home plate picked out in red, the predicted pitch tracked as a blue node at the mound."
            mark={<MarkInfield size={132} />} />
        </DCArtboard>
        <DCArtboard id="brilliant" label="B · Brilliant" width={360} height={432}>
          <Concept id="brilliant" name="Brilliant"
            blurb="A brilliant-cut gemstone. Premium and clean; red and blue pavilion facets carry the brand without a literal ballfield."
            mark={<MarkBrilliant size={132} />} />
        </DCArtboard>
        <DCArtboard id="tracker" label="C · Tracker" width={360} height={432}>
          <Concept id="tracker" name="Tracker"
            blurb="Concentric diamonds read as radar. Red center, blue predicted point on the ring — the most ‘AI / prediction’ of the set."
            mark={<MarkTracker size={132} />} />
        </DCArtboard>
        <DCArtboard id="chip" label="App icon · chip" width={360} height={432}>
          <ChipBoard />
        </DCArtboard>
      </DCSection>

      <DCSection id="ground" title="On light + sizes" subtitle="Wordmark on white, and the glyph down to favicon scale.">
        <DCArtboard id="light" label="Wordmark · light ground" width={420} height={300}>
          <LightLockups />
        </DCArtboard>
        <DCArtboard id="fav-dark" label="Favicon · dark" width={360} height={200}>
          <FaviconStrip ground="dark" />
        </DCArtboard>
        <DCArtboard id="fav-light" label="Favicon · light" width={360} height={200}>
          <FaviconStrip ground="light" />
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
