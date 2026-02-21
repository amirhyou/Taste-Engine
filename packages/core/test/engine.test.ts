import { describe, expect, it } from 'vitest';
import { Engine } from '../src/engine/engine.js';

describe('Engine', () => {
  it('touches all items in seed schedule', () => {
    const engine = new Engine({ minComparisonsPerItemSeed: 2 });
    engine.addItems(['a', 'b', 'c', 'd']);
    const schedule = engine.seedSchedule();
    const exposure = new Map<string, number>();
    for (const pair of schedule) {
      exposure.set(pair.a, (exposure.get(pair.a) ?? 0) + 1);
      exposure.set(pair.b, (exposure.get(pair.b) ?? 0) + 1);
    }

    for (const id of ['a', 'b', 'c', 'd']) {
      expect((exposure.get(id) ?? 0) >= 2).toBe(true);
    }
  });

  it('respects repeat cap via selector', () => {
    const engine = new Engine({ repeatCapPerPair: 1 });
    engine.addItems(['a', 'b', 'c', 'd', 'e']);

    const first = engine.nextPair();
    engine.ingest({ a: first.a, b: first.b, result: 'a', t: Date.now() });

    for (let i = 0; i < 5; i += 1) {
      const next = engine.nextPair();
      const samePair = [next.a, next.b].sort().join('::') === [first.a, first.b].sort().join('::');
      expect(samePair).toBe(false);
      engine.ingest({ a: next.a, b: next.b, result: 'a', t: Date.now() + i + 1 });
    }
  });

  it('returns onboarding pairs for new items', () => {
    const engine = new Engine({ k: 2, onboarding: { anchorsPerNewItem: 3, anchorStrategy: 'boundary+mid' } });
    engine.addItems(['a', 'b', 'c', 'd']);
    const pairs = engine.addItems(['new-1']);
    expect(pairs.length).toBe(3);
    expect(pairs.every((p) => p.a === 'new-1' || p.b === 'new-1')).toBe(true);
  });

  it('supports snapshot and restore', () => {
    const engine = new Engine({ k: 2 });
    engine.addItems(['a', 'b', 'c']);
    engine.ingest({ a: 'a', b: 'b', result: 'a', t: Date.now() });

    const snap = engine.snapshot();
    const restored = new Engine();
    restored.loadSnapshot(snap);

    expect(restored.status().topKSet.length).toBe(2);
  });
});
