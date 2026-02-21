import { describe, expect, test } from 'vitest';
import { Mulberry32, seededRng } from '../../src/utils/random';

describe('RNG', () => {
    test('Mulberry32 is deterministic', () => {
        const rng1 = new Mulberry32(12345);
        const rng2 = new Mulberry32(12345);

        for (let i = 0; i < 100; i++) {
            expect(rng1.next()).toEqual(rng2.next());
        }
    });

    test('Different seeds produce different sequences', () => {
        const rng1 = new Mulberry32(12345);
        const rng2 = new Mulberry32(67890);

        // It's technically possible but extremely unlikely they match immediately
        expect(rng1.next()).not.toEqual(rng2.next());
    });

    test('seededRng wrapper works', () => {
        const fn = seededRng(123);
        expect(typeof fn()).toBe('number');
        expect(fn()).toBeGreaterThanOrEqual(0);
        expect(fn()).toBeLessThan(1);
    });

    test('String seeds work', () => {
        const rng1 = new Mulberry32('hello');
        const rng2 = new Mulberry32('hello');
        expect(rng1.next()).toEqual(rng2.next());

        const rng3 = new Mulberry32('world');
        expect(rng3.next()).not.toEqual(rng1.next()); // Next call on rng1
    });
});
