import { OnlineModel } from '../model/onlineModel.js';
import { ItemId, RunConfig } from '../types.js';
import { Rng } from '../utils/random.js';

export type ConfidenceResult = {
  pInTopK: Map<ItemId, number>;
  stability: number;
  contested: ItemId[];
};

export const computeConfidence = (
  model: OnlineModel,
  rankedItems: ItemId[],
  config: RunConfig,
  rng: Rng,
): ConfidenceResult => {
  const boundary = config.boundaryBand(config.k, rankedItems.length);
  const challengerDepth = Math.max(boundary * config.confidence.challengerBandMultiplier, boundary);
  const scope = rankedItems.slice(0, Math.min(rankedItems.length, config.k + challengerDepth));
  const counts = new Map<ItemId, number>(scope.map((id) => [id, 0]));

  for (let i = 0; i < config.confidence.samples; i += 1) {
    const sample = [...model.sampleScores(scope, rng).entries()].sort((a, b) => b[1] - a[1]);
    for (const [id] of sample.slice(0, Math.min(config.k, sample.length))) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }

  const pInTopK = new Map<ItemId, number>();
  for (const id of scope) {
    pInTopK.set(id, (counts.get(id) ?? 0) / config.confidence.samples);
  }

  const topK = rankedItems.slice(0, Math.min(config.k, rankedItems.length));
  const stability = topK.length === 0 ? 0 : topK.reduce((acc, id) => acc + (pInTopK.get(id) ?? 0), 0) / topK.length;
  const contested = scope.filter((id) => {
    const p = pInTopK.get(id) ?? 0;
    return p >= 0.3 && p <= 0.8;
  });

  return { pInTopK, stability, contested };
};
