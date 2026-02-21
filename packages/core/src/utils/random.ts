/**
 * Deterministic Random Number Generator
 * Implementation: Mulberry32
 *
 * Fast, 32-bit state, passing statistical tests suitable for this application.
 */

export type Rng = () => number;

export class Mulberry32 {
  private state: number;

  constructor(seed: number | string) {
    if (typeof seed === 'string') {
      this.state = this.hashString(seed);
    } else {
      this.state = seed >>> 0;
    }
  }

  private hashString(s: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ (t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  nextInt(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min));
  }

  nextFloat(): number {
    return this.next();
  }
}

/**
 * Returns a simple function () => number using Mulberry32
 */
export const seededRng = (seed: number | string = 42): Rng => {
  const gen = new Mulberry32(seed);
  return () => gen.next();
};

export const pickOne = <T>(list: T[], rng: Rng): T => list[Math.floor(rng() * list.length)];
