import { describe, expect, it } from 'vitest';
import { Engine } from '../../src/engine/engine.js';

/**
 * Ingest a consistent directed cycle a[0]>a[1]>...>a[n-1]>a[0], each edge voted `votes` times.
 * Uses large timestamps near Date.now() by default so that model drift (if enabled) is minimal.
 */
function ingestCycle(engine: Engine, cycle: string[], votes: number, startT = Date.now()): void {
  let t = startT;
  for (let i = 0; i < cycle.length; i++) {
    const a = cycle[i];
    const b = cycle[(i + 1) % cycle.length];
    for (let v = 0; v < votes; v++) {
      engine.ingest({ a, b, result: 'a', t: t++ });
    }
  }
}

describe('Engine - Cycle Guard Response', () => {
  it('alarmThreshold:1 triggers cluster-internal queue for any detected cycle', () => {
    const depth = 4;
    const engine = new Engine({
      k: 3,
      seed: 1,
      driftRate: 0,
      cycleGuard: { enabled: true, alarmThreshold: 1, cycleResponseDepth: depth },
    });
    engine.addItems(['A', 'B', 'C', 'D', 'E', 'F']);

    // A>B>C>D>A creates a 4-node SCC (6 undirected pairs → depth=4 fits cleanly)
    ingestCycle(engine, ['A', 'B', 'C', 'D'], 2);

    // Confirm cycle is detected via status()
    const status = engine.status();
    const scc = status.cycles.find((c) => c.length > 1);
    expect(scc).toBeDefined();
    expect(scc!.length).toBe(4);

    // alarmThreshold:1 → |p - boundaryP| < 1 is true for all bounded probabilities
    // so the first `depth` nextPair() calls must be SCC-internal
    const cluster = new Set(scc!);
    for (let i = 0; i < depth; i++) {
      const pair = engine.nextPair();
      expect(cluster.has(pair.a) && cluster.has(pair.b)).toBe(true);
    }
  });

  it('alarmThreshold:0 never triggers — nextPair() behaves identically to guard-disabled engine', () => {
    // driftRate:0 eliminates model.get() mutations so both engines stay bit-identical
    const makeEngine = (threshold: number, guardEnabled: boolean) => {
      const e = new Engine({
        k: 3,
        seed: 1,
        driftRate: 0,
        cycleGuard: { enabled: guardEnabled, alarmThreshold: threshold, cycleResponseDepth: 4 },
      });
      e.addItems(['A', 'B', 'C', 'D', 'E', 'F']);
      ingestCycle(e, ['A', 'B', 'C', 'D'], 2);
      return e;
    };

    const withThreshold0 = makeEngine(0, true);
    const withGuardOff = makeEngine(0, false);

    // Cycle must be detected with threshold:0
    expect(withThreshold0.status().cycles.length).toBeGreaterThan(0);

    // threshold:0 means Math.abs(p - boundaryP) < 0 is always false → no trigger ever
    // Both engines run selector with identical selectorRng state → identical output
    expect(withThreshold0.nextPair()).toEqual(withGuardOff.nextPair());
    expect(withThreshold0.nextPair()).toEqual(withGuardOff.nextPair());
  });

  it('queue drains then normal selector resumes after no new votes', () => {
    const depth = 3;
    const engine = new Engine({
      k: 3,
      seed: 1,
      driftRate: 0,
      cycleGuard: { enabled: true, alarmThreshold: 1, cycleResponseDepth: depth },
    });
    engine.addItems(['A', 'B', 'C', 'D', 'E', 'F']);
    ingestCycle(engine, ['A', 'B', 'C', 'D'], 2);

    const cluster = new Set(['A', 'B', 'C', 'D']);

    // First `depth` calls drain the cluster queue
    for (let i = 0; i < depth; i++) {
      const pair = engine.nextPair();
      expect(cluster.has(pair.a) && cluster.has(pair.b)).toBe(true);
    }

    // After queue is empty and no new votes, lastCycleResponseAt prevents re-trigger.
    // The next call goes to normal selector — must not crash and returns a valid pair.
    const afterDrain = engine.nextPair();
    expect(afterDrain).toBeDefined();
    expect(typeof afterDrain.a).toBe('string');
    expect(typeof afterDrain.b).toBe('string');
    expect(afterDrain.a).not.toBe(afterDrain.b);

    // A new ingest resets the gate; cycle is still present → trigger fires again
    engine.ingest({ a: 'E', b: 'F', result: 'a', t: Date.now() });
    const reTriggered = engine.nextPair();
    expect(cluster.has(reTriggered.a) && cluster.has(reTriggered.b)).toBe(true);
  });

  it('cycle far outside active pool does not trigger response queue', () => {
    // Restrict pool to top-4 items so G/H/I (ranked 5-7) are never selected by the selector.
    // With alarmThreshold:0.2 and G/H/I having pInTopK≈0 vs boundaryP≈0.5, no trigger fires.
    const now = Date.now();
    const engine = new Engine({
      k: 2,
      seed: 42,
      driftRate: 0,
      pool: { start: (_k: number, _n: number) => 4, tight: (_k: number, _n: number) => 4 },
      cycleGuard: { enabled: true, alarmThreshold: 0.2, cycleResponseDepth: 4 },
    });
    engine.addItems(['A', 'B', 'X', 'Y', 'G', 'H', 'I']);

    // Give A, B, X, Y many wins over G, H, I to push them clearly into top-4
    let t = now;
    for (let i = 0; i < 8; i++) {
      for (const winner of ['A', 'B', 'X', 'Y']) {
        for (const loser of ['G', 'H', 'I']) {
          engine.ingest({ a: winner, b: loser, result: 'a', t: t++ });
        }
      }
    }

    // Create G>H>I>G cycle (all far below k=2 boundary)
    ingestCycle(engine, ['G', 'H', 'I'], 2, t);

    // Verify G, H, I are ranked outside pool (rank >= 4)
    const ranked = engine.status().fullRanking;
    expect(['G', 'H', 'I'].every((id) => ranked.indexOf(id) >= 4)).toBe(true);

    // Verify cycle is detected in the full ranked list
    const hasCycle = engine.status().cycles.some((c) => c.some((id) => ['G', 'H', 'I'].includes(id)));
    expect(hasCycle).toBe(true);

    // nextPair() must never return G/H/I cluster pairs:
    // - Selector only picks from pool {A,B,X,Y} (restricted by pool config)
    // - alarmThreshold:0.2 doesn't trigger for far-outside items (|pInTopK≈0 - boundaryP≈0.5| > 0.2)
    const cycleItems = new Set(['G', 'H', 'I']);
    for (let i = 0; i < 6; i++) {
      const pair = engine.nextPair();
      expect(cycleItems.has(pair.a) && cycleItems.has(pair.b)).toBe(false);
    }
  });
});
