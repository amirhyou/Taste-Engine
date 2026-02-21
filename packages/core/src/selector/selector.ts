import { OnlineModel } from '../model/onlineModel.js';
import { ItemId, PairRecommendation, RunConfig } from '../types.js';
import { pickOne, Rng } from '../utils/random.js';

export type SelectorContext = {
  model: OnlineModel;
  itemIds: ItemId[];
  pool: ItemId[];
  k: number;
  pairCounts: Map<string, number>;
  rng: Rng;
  explorationRate: number;
};

export const pairKey = (a: ItemId, b: ItemId): string => (a < b ? `${a}::${b}` : `${b}::${a}`);

export class BoundarySelector {
  constructor(private readonly config: RunConfig) { }

  nextPair(ctx: SelectorContext): PairRecommendation {
    const ranked = [...ctx.pool].sort((a, b) => ctx.model.get(b).mu - ctx.model.get(a).mu);
    const b = this.config.boundaryBand(ctx.k, ctx.itemIds.length);
    let boundaryStart = Math.max(0, ctx.k - b);
    let boundaryEnd = Math.min(ranked.length - 1, ctx.k + b);

    // If K is beyond existing items, focus on the bottom of the list
    if (boundaryStart >= ranked.length) {
      boundaryStart = Math.max(0, ranked.length - b);
      boundaryEnd = ranked.length - 1;
    }

    const boundary = ranked.slice(boundaryStart, boundaryEnd + 1);

    const inBoundaryOnly = ctx.rng() < 0.7;
    const inExploration = ctx.rng() < this.config.explorationRate;

    const aPool = inExploration ? ctx.pool : inBoundaryOnly ? boundary : ranked.slice(0, Math.max(ctx.k * 2, 2));
    const a = pickOne(aPool, ctx.rng);

    const candidateB = sampleCandidates(a, ctx.pool, ctx.rng, 50)
      .filter((item) => item !== a)
      .filter((item) => (ctx.pairCounts.get(pairKey(a, item)) ?? 0) < this.config.repeatCapPerPair);

    if (candidateB.length === 0) {
      // Smart Fallback: Pick opponent with lowest pair count
      let minCount = Infinity;
      let candidates: ItemId[] = [];

      for (const item of ctx.pool) {
        if (item === a) continue;
        const count = ctx.pairCounts.get(pairKey(a, item)) ?? 0;
        if (count < minCount) {
          minCount = count;
          candidates = [item];
        } else if (count === minCount) {
          candidates.push(item);
        }
      }

      const bestFallback = candidates.length > 0 ? pickOne(candidates, ctx.rng) : (ctx.pool.find((item) => item !== a) ?? a);
      return buildMeta(a, bestFallback, ranked, ctx.model, ctx.pairCounts, ctx.k);
    }

    const bestB = candidateB
      .map((id) => ({ id, score: pairScore(a, id, ranked, ctx.model, ctx.pairCounts, ctx.k, b) }))
      .sort((x, y) => y.score - x.score)[0].id;

    return buildMeta(a, bestB, ranked, ctx.model, ctx.pairCounts, ctx.k);
  }
}

const sampleCandidates = (origin: ItemId, pool: ItemId[], rng: Rng, limit: number): ItemId[] => {
  const out: ItemId[] = [];
  const seen = new Set<ItemId>([origin]);
  const max = Math.min(limit, pool.length - 1);
  while (out.length < max && seen.size < pool.length) {
    const candidate = pickOne(pool, rng);
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    out.push(candidate);
  }
  return out;
};

const pairScore = (
  a: ItemId,
  b: ItemId,
  ranked: ItemId[],
  model: OnlineModel,
  pairCounts: Map<string, number>,
  k: number,
  boundaryBand: number,
): number => {
  const p = model.predict(a, b);
  const uncertainMatch = p * (1 - p);
  const sigma = model.get(a).sigma + model.get(b).sigma;
  const repeatPenalty = (pairCounts.get(pairKey(a, b)) ?? 0) * 0.4;

  const aRank = ranked.indexOf(a);
  const bRank = ranked.indexOf(b);
  const boundaryCross =
    (aRank < k && bRank >= k) ||
    (bRank < k && aRank >= k) ||
    Math.abs(aRank - k) <= boundaryBand ||
    Math.abs(bRank - k) <= boundaryBand;

  const coverage = 1 / Math.max(1, model.get(a).games + model.get(b).games);
  return (boundaryCross ? 1.2 : 0) + uncertainMatch * 2 + sigma * 0.03 + coverage - repeatPenalty;
};

const buildMeta = (
  a: ItemId,
  b: ItemId,
  ranked: ItemId[],
  model: OnlineModel,
  pairCounts: Map<string, number>,
  k: number,
): PairRecommendation => {
  const aRank = ranked.indexOf(a);
  const bRank = ranked.indexOf(b);
  const boundaryCross = (aRank < k && bRank >= k) || (bRank < k && aRank >= k);
  const p = model.predict(a, b);
  return {
    a,
    b,
    meta: {
      boundaryCross,
      expectedInfoGain: p * (1 - p),
      sigmaA: model.get(a).sigma,
      sigmaB: model.get(b).sigma,
      repeatCount: pairCounts.get(pairKey(a, b)) ?? 0,
    },
  };
};
