import { RunConfig } from './types.js';

const poolFn = (scale: number, min: number) => (k: number, _n: number) => Math.max(Math.round(scale * k), min);
const boundaryFn = (floor: number, ratio: number) => (k: number) => Math.max(floor, Math.round(ratio * k));

export const defaultRunConfig: RunConfig = {
  k: 10,
  q: 0.8,
  decay: { type: 'exp', halfLifeDays: 30 },
  pool: {
    start: poolFn(8, 80),
    tight: poolFn(4, 40),
  },
  boundaryBand: boundaryFn(10, 0.2),
  explorationRate: 0.1,
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
  },
};

export const serializableDefaults = {
  pool: { startScale: 8, startMin: 80, tightScale: 4, tightMin: 40 },
  boundaryBand: { floor: 10, ratio: 0.2 },
};
