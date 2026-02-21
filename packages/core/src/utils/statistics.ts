/**
 * Statistical functions for the Taste Engine.
 *
 * Implements standard normal distribution functions (PDF, CDF, PPF)
 * using high-precision approximations.
 */

const SQRT_2 = Math.sqrt(2);
const SQRT_2PI = Math.sqrt(2 * Math.PI);

export const pdf = (x: number): number => {
    return Math.exp(-0.5 * x * x) / SQRT_2PI;
};

export const cdf = (x: number): number => {
    return 0.5 * (1 + erf(x / SQRT_2));
};

export const ppf = (p: number): number => {
    if (p <= 0) return -Infinity;
    if (p >= 1) return Infinity;
    return acklam_ppf(p);
};

export const erfinv = (x: number): number => {
    if (x >= 1) return Infinity;
    if (x <= -1) return -Infinity;
    // erfinv(x) = ppf((x + 1) / 2) / sqrt(2)
    return acklam_ppf((x + 1) / 2) / SQRT_2;
};

/**
 * Error Function
 * (Abramowitz & Stegun 7.1.26)
 */
export const erf = (x: number): number => {
    const sign = x >= 0 ? 1 : -1;
    const absX = Math.abs(x);

    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const t = 1.0 / (1.0 + p * absX);
    const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);

    return sign * y;
};

/**
 * Inverse Cumulative Distribution Function (Probit)
 * Acklam's Algorithm (Peter J. Acklam)
 * Input p in (0, 1)
 */
const acklam_ppf = (p: number): number => {
    const a1 = -3.969683028665376e1;
    const a2 = 2.209460984245205e2;
    const a3 = -2.759285104469687e2;
    const a4 = 1.38357751867269e2;
    const a5 = -3.066479806614716e1;
    const a6 = 2.506628277459239;

    const b1 = -5.447609879822406e1;
    const b2 = 1.615858368580409e2;
    const b3 = -1.556989798598866e2;
    const b4 = 6.680131188771972e1;
    const b5 = -1.328068155288572e1;

    const c1 = -7.784894002430293e-3;
    const c2 = -3.223964580411365e-1;
    const c3 = -2.400758277161838;
    const c4 = -2.549732539343734;
    const c5 = 4.374664141464968;
    const c6 = 2.938163982698783;

    const d1 = 7.784695709041462e-3;
    const d2 = 3.224671290700398e-1;
    const d3 = 2.445134137142996;
    const d4 = 3.754408661907416;

    const p_low = 0.02425;
    const p_high = 1 - p_low;

    let z: number;

    if (p < p_low) {
        // Left tail
        const t = Math.sqrt(-2 * Math.log(p));
        z = (((((c1 * t + c2) * t + c3) * t + c4) * t + c5) * t + c6) /
            ((((d1 * t + d2) * t + d3) * t + d4) * t + 1);
    } else if (p <= p_high) {
        // Central region
        const q = p - 0.5;
        const r = q * q;
        z = q * (((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) /
            (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1);
    } else {
        // Right tail
        const t = Math.sqrt(-2 * Math.log(1 - p));
        z = -(((((c1 * t + c2) * t + c3) * t + c4) * t + c5) * t + c6) /
            ((((d1 * t + d2) * t + d3) * t + d4) * t + 1);
    }

    return z;
};
