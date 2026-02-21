import { describe, expect, test } from 'vitest';
import { Engine } from '../../src/engine/engine.js';

describe('Convergence', () => {
    test('converges for a simple case', () => {
        // Converge quickly: Small K, small pool, high K (relative to pool? no small K).
        // K=1. Items=3.
        // A wins against everyone.
        const engine = new Engine({
            k: 1,
            confidence: { samples: 100, challengerBandMultiplier: 1 },
            repeatCapPerPair: 10 // Allow enough repeats to converge
        });

        engine.addItems(['A', 'B', 'C']);

        // Run matches: A beats B, A beats C. B beats C.
        // A should be clear winner.
        // We need enough matches for stability.

        let converged = false;
        for (let i = 0; i < 50; i++) {
            const pair = engine.nextPair();
            if (!pair) break; // Should not happen with repeatCap 10

            // Simulate oracle: A > B > C
            let result: 'a' | 'b' = 'a';
            const { a, b } = pair;
            if (a === 'A') result = 'a';
            else if (b === 'A') result = 'b';
            else if (a === 'B') result = 'a'; // B > C
            else result = 'b';

            engine.ingest({ a, b, result, t: Date.now() + i });

            // Check every 5 matches
            if (i % 5 === 0 && i > 10) {
                if (engine.isConverged()) {
                    converged = true;
                    break;
                }
            }
        }

        expect(converged).toBe(true);
        const status = engine.status();
        expect(status.topKSet).toContain('A');
    });
});
