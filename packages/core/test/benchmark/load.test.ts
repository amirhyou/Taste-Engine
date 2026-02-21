import { describe, expect, it } from 'vitest';
import { Engine } from '../../src/engine/engine.js';
import { seededRng } from '../../src/utils/random.js';

describe('Performance Benchmarks', () => {
    // Helper to simulate a user providing consistent preferences based on hidden true scores
    const simulateRun = (n: number, maxComparisons: number) => {
        const rng = seededRng(123);
        const engine = new Engine({
            k: 50, // Top 50 items
            cycleGuard: { enabled: true, alarmThreshold: 0.1 }
        });

        // Generate N items with hidden scores
        const items = Array.from({ length: n }, (_, i) => ({
            id: `item_${i}`,
            score: rng() * 100
        }));
        const itemMap = new Map(items.map(i => [i.id, i]));

        const startTime = performance.now();
        engine.addItems(items.map(i => i.id));
        const addTime = performance.now() - startTime;

        let comparisons = 0;
        let ingestTimeTotal = 0;
        let nextPairTimeTotal = 0;
        let converged = false;

        const maxPerItem = maxComparisons / n; // e.g. 50k / 1000 = 50 per item

        while (comparisons < maxComparisons) {
            const t0 = performance.now();
            const pair = engine.nextPair();
            nextPairTimeTotal += (performance.now() - t0);

            if (!pair) break;

            // Oracle decides
            const itemA = itemMap.get(pair.a)!;
            const itemB = itemMap.get(pair.b)!;
            const result = itemA.score > itemB.score ? 'a' : 'b';

            const t1 = performance.now();
            engine.ingest({
                a: pair.a,
                b: pair.b,
                result,
                t: Date.now()
            });
            ingestTimeTotal += (performance.now() - t1);
            comparisons++;

            if (comparisons % 1000 === 0) {
                if (engine.isConverged()) {
                    converged = true;
                    break;
                }
            }
        }

        const endTime = performance.now();
        const memory = process.memoryUsage().heapUsed / 1024 / 1024;

        return {
            n,
            comparisons,
            converged,
            totalTime: endTime - startTime,
            avgIngest: ingestTimeTotal / comparisons,
            avgNextPair: nextPairTimeTotal / comparisons,
            memoryMB: memory
        };
    };

    it('handles N=1000 efficiently', { timeout: 300000 }, () => {
        const result = simulateRun(1000, 30000); // 30 comparisons per item
        console.log(`N=1000 Stats:`, result);

        expect(result.avgIngest).toBeLessThan(1.0); // < 1ms
        expect(result.avgNextPair).toBeLessThan(5.0); // < 5ms
        expect(result.memoryMB).toBeLessThan(500); // < 500MB
    });

    it('handles N=5000 scalability check', { timeout: 300000 }, () => {
        // We might not converge fully in a quick test, but we check speed
        const result = simulateRun(5000, 50000); // 10 comparisons per item (just to test speed)
        console.log(`N=5000 Stats (Partial):`, result);

        expect(result.avgIngest).toBeLessThan(2.0); // Allow slightly more time
        expect(result.avgNextPair).toBeLessThan(10.0); // < 10ms is the goal from PLAN
        expect(result.memoryMB).toBeLessThan(1024); // < 1GB
    });
});
