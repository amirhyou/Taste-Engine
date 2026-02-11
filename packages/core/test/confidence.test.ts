import { describe, expect, it } from 'vitest';
import { Engine } from '../src/engine/engine.js';

describe('confidence', () => {
  it('probabilities approximately sum to k over scoped items', () => {
    const engine = new Engine({ k: 3, confidence: { samples: 500, challengerBandMultiplier: 2 } });
    engine.addItems(['a', 'b', 'c', 'd', 'e']);

    for (let i = 0; i < 25; i += 1) {
      const pair = engine.nextPair();
      engine.ingest({ a: pair.a, b: pair.b, result: i % 2 === 0 ? 'a' : 'b', t: Date.now() + i });
    }

    const status = engine.status();
    const sum = [...status.pInTopK.values()].reduce((acc, p) => acc + p, 0);
    expect(sum).toBeGreaterThan(2.2);
    expect(sum).toBeLessThan(3.8);
  });
});
