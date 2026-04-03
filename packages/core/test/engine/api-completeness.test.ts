import { describe, expect, it } from 'vitest';
import { Engine } from '../../src/engine/engine.js';

describe('Engine API completeness', () => {
  it('surfaces per-user vote counts and context summary in status()', () => {
    const engine = new Engine({ k: 2, seed: 101 });
    engine.addItems(['a', 'b', 'c']);

    engine.ingest({ a: 'a', b: 'b', result: 'a', t: 1, userId: 'u1', context: 'playlist' });
    engine.ingest({ a: 'a', b: 'c', result: 'a', t: 2, userId: 'u1', context: { contest: 'daily', mood: 'happy' } });
    engine.ingest({ a: 'b', b: 'c', result: 'b', t: 3, userId: 'u2', context: { contest: 'daily' } });

    const status = engine.status(10);

    expect(status.perUserVoteCounts.get('u1')).toBe(2);
    expect(status.perUserVoteCounts.get('u2')).toBe(1);
    expect(status.contextSummary.labels.get('playlist')).toBe(1);
    expect(status.contextSummary.keys.get('contest')).toBe(2);
    expect(status.contextSummary.keys.get('mood')).toBe(1);
    expect(status.contextSummary.keyValues.get('contest=daily')).toBe(2);
    expect(status.contextSummary.keyValues.get('mood=happy')).toBe(1);
  });

  it('supports nextPair({ now }) and uses now in pair metadata', () => {
    const dayMs = 24 * 60 * 60 * 1000;
    const engine = new Engine({
      k: 1,
      seed: 11,
      driftRate: 0.25,
      cycleGuard: { enabled: false, alarmThreshold: 0.1, cycleResponseDepth: 4 },
    });
    engine.addItems(['a', 'b']);
    engine.ingest({ a: 'a', b: 'b', result: 'a', t: 0, userId: 'u1' });

    const nearNow = engine.nextPair({ now: 1 });
    const futureNow = engine.nextPair({ now: dayMs * 20 });

    expect(nearNow.a === 'a' || nearNow.a === 'b').toBe(true);
    expect(futureNow.a === 'a' || futureNow.a === 'b').toBe(true);
    expect(futureNow.meta.sigmaA).toBeGreaterThanOrEqual(nearNow.meta.sigmaA);
    expect(futureNow.meta.sigmaB).toBeGreaterThanOrEqual(nearNow.meta.sigmaB);
  });

  it('creates read-only derived context views via filterByContext()', () => {
    const engine = new Engine({ k: 2, seed: 303 });
    engine.addItems(['a', 'b', 'c']);

    engine.ingest({ a: 'a', b: 'b', result: 'a', t: 1, context: 'playlist' });
    engine.ingest({ a: 'a', b: 'c', result: 'a', t: 2, context: { contest: 'daily', round: '1' } });
    engine.ingest({ a: 'b', b: 'c', result: 'b', t: 3, context: { contest: 'daily', round: '2' } });

    const labelView = engine.filterByContext('playlist');
    expect(labelView.eventCount).toBe(1);
    expect(labelView.events).toHaveLength(1);

    const keyView = engine.filterByContext('contest');
    expect(keyView.eventCount).toBe(2);
    expect(keyView.events).toHaveLength(2);

    const derivedStatus = keyView.status(10);
    expect(derivedStatus.perUserVoteCounts.size).toBe(0);
    expect(derivedStatus.contextSummary.keys.get('contest')).toBe(2);
  });
});
