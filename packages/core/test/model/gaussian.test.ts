import { describe, expect, test } from 'vitest';
import { defaultRunConfig } from '../../src/defaults';
import { OnlineModel } from '../../src/model/onlineModel';

describe('OnlineModel (Gaussian)', () => {
    const config = defaultRunConfig;

    test('initializes items with default values', () => {
        const model = new OnlineModel(config);
        const item = model.get('item1');
        expect(item.mu).toBe(25);
        expect(item.sigma).toBe(8.333);
    });

    test('updates ratings correctly (Winner gains, Loser loses)', () => {
        const model = new OnlineModel(config);

        // A wins against B
        model.ingest({
            a: 'A',
            b: 'B',
            result: 'a',
            t: Date.now(),
        });

        const a = model.get('A');
        const b = model.get('B');

        // Winner should increase mu
        expect(a.mu).toBeGreaterThan(25);
        // Loser should decrease mu
        expect(b.mu).toBeLessThan(25);

        // Uncertainty should decrease
        expect(a.sigma).toBeLessThan(8.333);
        expect(b.sigma).toBeLessThan(8.333);
    });

    test('stronger surprise causes larger updates', () => {
        const model = new OnlineModel(config);

        // Setup: Strong A, Weak B
        // Update manually to simulated state
        // We can't easily set state without exposing internals or running many matches.
        // Instead, let's compare two scenarios:
        // 1. A vs B (Equal) -> A wins
        // 2. C vs D (C is weak, D is strong) -> C wins (Upset)

        const m1 = new OnlineModel(config);
        m1.ingest({ a: 'A', b: 'B', result: 'a', t: Date.now() });
        const delta1 = m1.get('A').mu - 25;

        // Simulate C being weak and D being strong is hard without "setting" state.
        // Let's just run multiple matches.
        const m2 = new OnlineModel(config);
        // Make D strong
        m2.ingest({ a: 'D', b: 'E', result: 'a', t: Date.now() }); // D beats E
        m2.ingest({ a: 'D', b: 'F', result: 'a', t: Date.now() }); // D beats F
        // D is now > 25.

        // Match C vs D. C is 25. D is > 25.
        // If C wins, it's an upset. C should gain MORE than A did in the equal match?
        // A (25) beats B (25).
        // C (25) beats D (>25).
        const dPre = m2.get('D');
        const cPreMu = 25;

        m2.ingest({ a: 'C', b: 'D', result: 'a', t: Date.now() });
        const cPost = m2.get('C');
        const delta2 = cPost.mu - 25;

        // Expect delta2 (upset) > delta1 (equal match)
        // Note: D's sigma might verify this comparison, as lower sigma D means D's rating is more confident, 
        // so beating D is consistent?
        // Actually, beating a high rated player yields more points.
        expect(delta2).toBeGreaterThan(delta1);
    });

    test('predicts probabilities', () => {
        const model = new OnlineModel(config);
        const p = model.predict('A', 'B');
        expect(p).toBeCloseTo(0.5, 2); // Equal skills

        model.ingest({ a: 'A', b: 'B', result: 'a', t: Date.now() });
        const p2 = model.predict('A', 'B');
        expect(p2).toBeGreaterThan(0.5); // A should be favored now
    });
});
