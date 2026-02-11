export type Rng = () => number;

export const seededRng = (seed = 42): Rng => {
  let x = seed | 0;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return ((x >>> 0) % 10000) / 10000;
  };
};

export const pickOne = <T>(list: T[], rng: Rng): T => list[Math.floor(rng() * list.length)];
