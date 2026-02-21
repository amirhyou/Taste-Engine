import { useState, useCallback, useEffect } from 'react';
import { Engine } from '@taste-engine/core';
import './App.css';

const ITEMS = [
  'Space Coffee',
  'Deep Sea Tea',
  'Mars Wine',
  'Moon Beer',
  'Jupiter Juice',
  'Saturn Soda',
  'Pluto Punch',
  'Venus Vodka',
  'Neptune Nectar',
  'Uranus Upside-down Cake'
];

function App() {
  const [k, setK] = useState(3);
  const [engine] = useState(() => {
    const e = new Engine({ k: 3 });
    e.addItems(ITEMS);
    return e;
  });

  const [nextPair, setNextPair] = useState(() => engine.nextPair());
  const [status, setStatus] = useState(() => engine.status());
  const [voteCount, setVoteCount] = useState(0);
  const [sliderValue, setSliderValue] = useState(0);

  // Update engine K when the state changes
  useEffect(() => {
    engine.setK(k);
    setStatus(engine.status());
  }, [k, engine]);

  const handleVote = useCallback(() => {
    // Map slider -1..1 to 'a' vs 'b' with strength
    // strength is magnitude 
    const result = sliderValue < 0 ? 'a' : sliderValue > 0 ? 'b' : 'tie';
    const strength = Math.abs(sliderValue);

    engine.ingest({
      a: nextPair.a,
      b: nextPair.b,
      result,
      strength,
      t: Date.now()
    });

    setNextPair(engine.nextPair());
    setStatus(engine.status());
    setVoteCount(v => v + 1);
    setSliderValue(0); // Reset slider
  }, [nextPair, sliderValue, engine]);

  return (
    <div className="container">
      <header>
        <h1>Taste Engine</h1>
        <p className="subtitle">High-fidelity preference modeling</p>
      </header>

      <main>
        <div className="left-panel">
          <section className="voter-advanced">
            <div className="comparison-display">
              <div className={`choice-card ${sliderValue < 0 ? 'active' : ''}`}>
                <span className="label">Option A</span>
                <span className="name">{nextPair.a}</span>
              </div>
              <div className="vs-circle">VS</div>
              <div className={`choice-card ${sliderValue > 0 ? 'active' : ''}`}>
                <span className="label">Option B</span>
                <span className="name">{nextPair.b}</span>
              </div>
            </div>

            <div className="slider-container">
              <div className="slider-labels">
                <span>Strongly Prefer A</span>
                <span>Neutral</span>
                <span>Strongly Prefer B</span>
              </div>
              <input
                type="range"
                min="-1"
                max="1"
                step="0.1"
                value={sliderValue}
                onChange={(e) => setSliderValue(parseFloat(e.target.value))}
                className="preference-slider"
              />
              <button className="confirm-btn" onClick={handleVote}>
                Confirm Preference
              </button>
            </div>
          </section>

          <section className="settings">
            <div className="setting-item">
              <label>Target Top K</label>
              <input
                type="number"
                min="1"
                max={ITEMS.length}
                value={k}
                onChange={(e) => setK(parseInt(e.target.value) || 1)}
              />
              <span className="hint">The engine focuses uncertainty reduction on finding the best {k} items.</span>
            </div>
          </section>
        </div>

        <section className="dashboard">
          <div className="status-banner">
            <h2>Real-time Ranking</h2>
            <div className={`pills ${status.canStop ? 'success' : 'waiting'}`}>
              {status.canStop ? '✨ Converged' : '⚖️ Calibrating...'}
            </div>
          </div>

          <div className="ranking-list">
            {status.topKSet.map((item, idx) => (
              <div key={item} className={`rank-card ${idx < k ? 'in-top-k' : 'outside-k'}`}>
                <span className="idx">#{idx + 1}</span>
                <span className="name">{item}</span>
                {idx < k && <span className="k-badge">Top {k}</span>}
              </div>
            ))}
          </div>

          <div className="metrics-grid">
            <div className="metric">
              <label>Stability (K={k})</label>
              <div className="bar-container">
                <div className="bar" style={{ width: `${status.stability * 100}%` }}></div>
              </div>
              <span className="value">{(status.stability * 100).toFixed(1)}%</span>
            </div>
            <div className="metric">
              <label>Total Votes</label>
              <span className="value">{voteCount}</span>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="footer-links">
          <span>Gaussian Modeling</span> • <span>Active Learning</span> • <span>Cycle Detection</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
