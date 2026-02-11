import { ItemId, RunConfig } from '../types.js';

export type StopDecision = {
  canStop: boolean;
  reason: string;
  needsMoreEvidence: ItemId[];
};

export const shouldStop = (rankedItems: ItemId[], pInTopK: Map<ItemId, number>, config: RunConfig): StopDecision => {
  const topK = rankedItems.slice(0, Math.min(config.k, rankedItems.length));
  const boundary = config.boundaryBand(config.k);
  const challengerDepth = Math.max(1, Math.round(boundary * config.confidence.challengerBandMultiplier));
  const challengers = rankedItems.slice(config.k, Math.min(rankedItems.length, config.k + challengerDepth));

  const unstableTop = topK.filter((id) => (pInTopK.get(id) ?? 0) < config.q);
  const riskyChallengers = challengers.filter((id) => (pInTopK.get(id) ?? 0) > 1 - config.q);

  if (unstableTop.length === 0 && riskyChallengers.length === 0) {
    return { canStop: true, reason: 'top-k confidence threshold met', needsMoreEvidence: [] };
  }

  return {
    canStop: false,
    reason: 'boundary still contested',
    needsMoreEvidence: [...unstableTop, ...riskyChallengers],
  };
};
