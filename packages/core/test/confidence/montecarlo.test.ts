import { describe, expect, test } from 'vitest';
import { computeConfidence } from '../../src/confidence/confidence.js';
import { defaultRunConfig } from '../../src/defaults.js';
import { OnlineModel } from '../../src/model/onlineModel.js';
import { seededRng } from '../../src/utils/random.js';

describe('Monte Carlo Confidence', () => {
    const rng = seededRng(12345);
    const config = defaultRunConfig;

    test('computes stability correctly for separated Gaussians', () => {
        const model = new OnlineModel(config);
        // Setup items with clear separation
        // Top K=3.
        // A, B, C: mu=30, sigma=1
        // D, E, F: mu=20, sigma=1
        model.ensureItem('A'); model.get('A').mu = 30; model.get('A').sigma = 1;
        model.ensureItem('B'); model.get('B').mu = 30; model.get('B').sigma = 1;
        model.ensureItem('C'); model.get('C').mu = 30; model.get('C').sigma = 1;
        model.ensureItem('D'); model.get('D').mu = 20; model.get('D').sigma = 1;
        model.ensureItem('E'); model.get('E').mu = 20; model.get('E').sigma = 1;
        model.ensureItem('F'); model.get('F').mu = 20; model.get('F').sigma = 1;

        const result = computeConfidence(model, ['A', 'B', 'C', 'D', 'E', 'F'], { ...config, k: 3 }, rng);

        // Items A, B, C should be in Top 3 almost 100% of time.
        expect(result.pInTopK.get('A')).toBeGreaterThan(0.9);
        expect(result.pInTopK.get('B')).toBeGreaterThan(0.9);
        expect(result.pInTopK.get('C')).toBeGreaterThan(0.9);

        expect(result.pInTopK.get('D')).toBeLessThan(0.1);

        expect(result.stability).toBeGreaterThan(0.9);
    });

    test('computes stability correctly for overlapping Gaussians', () => {
        const model = new OnlineModel(config);
        // Overlapping items around border K=1
        // A: mu=25, sigma=5
        // B: mu=25, sigma=5
        model.ensureItem('A'); model.get('A').mu = 25; model.get('A').sigma = 5;
        model.ensureItem('B'); model.get('B').mu = 25; model.get('B').sigma = 5;

        // If K=1. A and B are identical. Each should have ~50% chance.
        const result = computeConfidence(model, ['A', 'B'], { ...config, k: 1 }, rng);

        const pA = result.pInTopK.get('A') ?? 0;
        const pB = result.pInTopK.get('B') ?? 0;

        expect(pA).toBeGreaterThan(0.4);
        expect(pA).toBeLessThan(0.6);
        expect(pB).toBeGreaterThan(0.4);
        expect(pB).toBeLessThan(0.6);

        // Stability should be around 0.5 (since top K set changes often)
        expect(result.stability).toBeCloseTo(0.5, 1);
    });
});
