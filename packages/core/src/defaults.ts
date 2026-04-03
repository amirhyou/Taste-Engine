import { RunConfig } from './types.js';

const poolFn = (scale: number, min: number) => (k: number, _n: number) => Math.max(Math.round(scale * k), min);
const boundaryFn = (fMin: number, fMax: number, rN: number, rK: number) => (k: number, n: number) => {
  const floor = Math.max(fMin, Math.min(fMax, Math.floor(n * rN)));
  return Math.max(floor, Math.round(rK * k));
};

export const defaultRunConfig: RunConfig = {
  k: 10,
  q: 0.8,
  tau: 0.083, // 8.333 / 100
  beta: 4.167, // 8.333 / 2
  seed: 42,
  decay: { type: 'exp', halfLifeDays: 30 },
  pool: {
    start: poolFn(8, 80),
    tight: poolFn(4, 40),
  },
  boundaryBand: boundaryFn(2, 10, 0.1, 0.2),
  explorationRate: 0.05,
  driftRate: 0.05,
  repeatCapPerPair: 3,
  minComparisonsPerItemSeed: 2,
  minUniqueOpponentsInPool: 2,
  onboarding: {
    anchorsPerNewItem: 4,
    anchorStrategy: 'boundary+mid',
  },
  confidence: {
    samples: 2000,
    challengerBandMultiplier: 2,
  },
  cycleGuard: {
    enabled: true,
    alarmThreshold: 0.2,
    cycleResponseDepth: 4,
  },
};

export const serializableDefaults = {
  pool: { startScale: 8, startMin: 80, tightScale: 4, tightMin: 40 },
  boundaryBand: { floor: 10, ratio: 0.2 },
};
