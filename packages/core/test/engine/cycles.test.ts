import { describe, expect, it } from 'vitest';
import { Engine } from '../../src/engine/engine.js';
import { ItemId } from '../../src/types.js';

describe('Engine - Cycle Guard', () => {
    it('detects a simple cycle (A > B > C > A)', () => {
        const engine = new Engine({
            k: 5,
            cycleGuard: { enabled: true, alarmThreshold: 0.1 }
        });

        engine.addItems(['A', 'B', 'C', 'D']);

        // A > B
        engine.ingest({ a: 'A', b: 'B', result: 'a', t: Date.now() });
        engine.ingest({ a: 'A', b: 'B', result: 'a', t: Date.now() });

        // B > C
        engine.ingest({ a: 'B', b: 'C', result: 'a', t: Date.now() });
        engine.ingest({ a: 'B', b: 'C', result: 'a', t: Date.now() });

        // C > A (Cycle!)
        engine.ingest({ a: 'C', b: 'A', result: 'a', t: Date.now() });
        engine.ingest({ a: 'C', b: 'A', result: 'a', t: Date.now() });

        const status = engine.status();
        // Should detect the cycle
        const cycle = status.cycles.find(c => c.length > 1);
        expect(cycle).toBeDefined();
        expect(cycle).toHaveLength(3);
        expect(cycle).toEqual(expect.arrayContaining(['A', 'B', 'C']));
    });

    it('respects majority rule', () => {
        // A > B (2 wins) vs B > A (1 win) -> A dominates B
        const engine = new Engine({ k: 5 });
        engine.addItems(['A', 'B']);

        engine.ingest({ a: 'A', b: 'B', result: 'a', t: Date.now() });
        engine.ingest({ a: 'A', b: 'B', result: 'a', t: Date.now() });
        engine.ingest({ a: 'A', b: 'B', result: 'b', t: Date.now() }); // B wins once

        // This creates A->B edge only.
        // If B had 3 wins, it would be B->A.
        // If A>B, B>C, C>A, we have a cycle.

        // Let's create a cycle that is broken by majority
        // A > B (2-0)
        // B > C (2-0)
        // C > A (1-2) -> A > C wins! So A->B, B->C, A->C. Transitive. No cycle.

        engine.addItems(['C']);
        // A > B
        // already 2-1 for A

        // B > C
        engine.ingest({ a: 'B', b: 'C', result: 'a', t: Date.now() });
        engine.ingest({ a: 'B', b: 'C', result: 'a', t: Date.now() });

        // C vs A
        // A wins 2, C wins 1
        engine.ingest({ a: 'C', b: 'A', result: 'b', t: Date.now() }); // A wins
        engine.ingest({ a: 'C', b: 'A', result: 'b', t: Date.now() }); // A wins
        engine.ingest({ a: 'C', b: 'A', result: 'a', t: Date.now() }); // C wins

        const status = engine.status();
        // Should be no cycles
        expect(status.cycles).toHaveLength(0);
    });
});
