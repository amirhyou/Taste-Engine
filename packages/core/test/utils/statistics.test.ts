import { describe, expect, test } from 'vitest';
import { cdf, erf, erfinv, pdf, ppf } from '../../src/utils/statistics';

describe('Statistical Utils', () => {
    describe('pdf (Standard Normal)', () => {
        test('standard values', () => {
            expect(pdf(0)).toBeCloseTo(0.39894, 5);
            expect(pdf(1)).toBeCloseTo(0.24197, 5);
            expect(pdf(-1)).toBeCloseTo(0.24197, 5);
            expect(pdf(2)).toBeCloseTo(0.05399, 5);
        });
    });

    describe('erf', () => {
        test('standard values', () => {
            expect(erf(0)).toBeCloseTo(0, 7);
            expect(erf(1)).toBeCloseTo(0.84270079, 5); // A&S is ~1.5e-7 precision
            expect(erf(-1)).toBeCloseTo(-0.84270079, 5);
            expect(erf(0.5)).toBeCloseTo(0.52049987, 5);
            expect(erf(2)).toBeCloseTo(0.99532226, 5);
        });
    });

    describe('erfinv', () => {
        test('reverses erf (approximate)', () => {
            const inputs = [0, 0.5, -0.5, 0.9, -0.9];
            for (const x of inputs) {
                expect(erfinv(erf(x))).toBeCloseTo(x, 3);
            }
        });

        test('tails', () => {
            expect(erfinv(0.99)).toBeGreaterThan(1.8);
            expect(erfinv(-0.99)).toBeLessThan(-1.8);
        })
    });

    describe('cdf', () => {
        test('standard values', () => {
            expect(cdf(0)).toBeCloseTo(0.5, 7);
            expect(cdf(1.96)).toBeCloseTo(0.975, 3); // 95% interval
            expect(cdf(-1.96)).toBeCloseTo(0.025, 3);
            expect(cdf(1)).toBeCloseTo(0.84134, 4);
        });
    });

    describe('ppf (Inverse CDF)', () => {
        test('reverses cdf', () => {
            const inputs = [0, 1, -1, 1.96, -1.96];
            for (const x of inputs) {
                const p = cdf(x);
                expect(ppf(p)).toBeCloseTo(x, 3);
            }
        });

        test('extremes', () => {
            expect(ppf(0)).toBe(-Infinity);
            expect(ppf(1)).toBe(Infinity);
            expect(ppf(0.5)).toBeCloseTo(0);
        });
    });
});
