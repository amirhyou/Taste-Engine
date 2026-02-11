import { ComparisonEvent, DecayConfig } from '../types.js';

const DAY_MS = 86_400_000;

export const eventWeight = (event: ComparisonEvent, now: number, decay: DecayConfig): number => {
  if (decay.type === 'none') return 1;

  const ageDays = Math.max(0, (now - event.t) / DAY_MS);
  if (decay.type === 'window') {
    return ageDays <= decay.windowDays ? 1 : 0;
  }

  if (decay.halfLifeDays <= 0) return 1;
  return Math.pow(0.5, ageDays / decay.halfLifeDays);
};
