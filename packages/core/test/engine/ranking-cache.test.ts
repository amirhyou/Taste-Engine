import { describe, expect, it } from 'vitest';
import { Engine } from '../../src/engine/engine.js';

describe('Engine ranking cache behavior', () => {
  it('returns identical ranking across repeated status calls on unchanged state', () => {
    const engine = new Engine({ seed: 9, k: 3 });
    engine.addItems(['a', 'b', 'c', 'd']);
    engine.ingest({ a: 'a', b: 'b', result: 'a', t: 1 });
    engine.ingest({ a: 'c', b: 'd', result: 'b', t: 2 });

    const s1 = engine.status(5).fullRanking;
    const s2 = engine.status(5).fullRanking;
    const s3 = engine.status(5).fullRanking;

    expect(s2).toEqual(s1);
    expect(s3).toEqual(s1);
  });

  it('updates ranking after ingest and addItems mutations', () => {
    const engine = new Engine({ seed: 5, k: 2 });
    engine.addItems(['a', 'b']);

    const before = engine.status(1).fullRanking;
    engine.ingest({ a: 'a', b: 'b', result: 'a', t: 2 });
    const afterIngest = engine.status(3).fullRanking;

    expect(afterIngest).toEqual(['a', 'b']);
    expect(afterIngest).not.toEqual([]);
    expect(before).toHaveLength(2);

    engine.addItems(['c']);
    const afterAdd = engine.status(4).fullRanking;
    expect(afterAdd).toHaveLength(3);
    expect(afterAdd).toEqual(expect.arrayContaining(['a', 'b', 'c']));
  });

  it('keeps ranking stable through snapshot and restore', () => {
    const engine = new Engine({ seed: 42, k: 2 });
    engine.addItems(['a', 'b', 'c']);
    engine.ingest({ a: 'a', b: 'b', result: 'a', t: 1 });
    engine.ingest({ a: 'a', b: 'c', result: 'a', t: 2 });

    const original = engine.status(3).fullRanking;
    const snapshot = engine.snapshot();

    const restored = new Engine();
    restored.loadSnapshot(snapshot);
    const restoredRanking = restored.status(3).fullRanking;

    expect(restoredRanking).toEqual(original);
  });

  it('keeps nextPair deterministic with interleaved status calls', () => {
    const engine = new Engine({ seed: 7, k: 2, cycleGuard: { enabled: false, alarmThreshold: 0.1, cycleResponseDepth: 4 } });
    engine.addItems(['a', 'b', 'c', 'd', 'e']);
    engine.ingest({ a: 'a', b: 'b', result: 'a', t: 1 });

    const snap = engine.snapshot();

    const clean = new Engine();
    clean.loadSnapshot(snap);
    const base = clean.nextPair({ now: 2 });

    const noisy = new Engine();
    noisy.loadSnapshot(snap);
    noisy.status(2);
    noisy.status(2);
    const after = noisy.nextPair({ now: 2 });

    expect(after.a).toBe(base.a);
    expect(after.b).toBe(base.b);
  });
});
