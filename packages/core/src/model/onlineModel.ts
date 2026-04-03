import { ComparisonEvent, ItemId, ItemState, RunConfig } from '../types.js';
import { eventWeight } from '../utils/decay.js';
import { cdf, pdf } from '../utils/statistics.js';

const DEFAULT_MU = 25;
const DEFAULT_SIGMA = 8.333;
const MIN_SIGMA = 0.001; // Avoid divide by zero, but allow getting confident

export class OnlineModel {
  private readonly states = new Map<ItemId, ItemState>();

  constructor(private readonly config: RunConfig) { }

  ensureItem(itemId: ItemId): void {
    if (this.states.has(itemId)) return;
    this.states.set(itemId, {
      mu: DEFAULT_MU,
      sigma: DEFAULT_SIGMA,
      games: 0,
      wins: 0,
      lastUpdatedAt: Date.now(),
      uniqueOpponents: new Set(),
    });
  }

  restoreItem(itemId: ItemId, state: ItemState): void {
    this.states.set(itemId, state);
  }

  ingest(event: ComparisonEvent, now = event.t): void {
    this.ensureItem(event.a);
    this.ensureItem(event.b);

    if (event.result === 'skip' || event.result === 'tie') return; // Tie support TODO if needed

    const itemA = this.get(event.a, now);
    const itemB = this.get(event.b, now);

    // Apply time decay weight
    const weight = eventWeight(event, now, this.config.decay);
    if (weight <= 0) return;

    // Add dynamics factor (increase uncertainty before update)
    // sigma^2 <- sigma^2 + tau^2
    const tau2 = this.config.tau * this.config.tau;
    itemA.sigma = Math.sqrt(itemA.sigma * itemA.sigma + tau2);
    itemB.sigma = Math.sqrt(itemB.sigma * itemB.sigma + tau2);

    // Determine Winner and Loser
    let winner: ItemState;
    let loser: ItemState;
    if (event.result === 'a') {
      winner = itemA;
      loser = itemB;
    } else {
      winner = itemB;
      loser = itemA;
    }

    // TrueSkill Update (Two player, no draw)
    const beta2 = this.config.beta * this.config.beta;
    const c = Math.sqrt(2 * beta2 + winner.sigma * winner.sigma + loser.sigma * loser.sigma);
    const diff = winner.mu - loser.mu;
    const t = diff / c;

    const v = pdf(t) / cdf(t);
    const w = v * (v + t);

    const winnerMeanDelta = (winner.sigma * winner.sigma / c) * v;
    const loserMeanDelta = (loser.sigma * loser.sigma / c) * v;
    const winnerSigmaDelta = (winner.sigma * winner.sigma / (c * c)) * w;
    const loserSigmaDelta = (loser.sigma * loser.sigma / (c * c)) * w;

    // Apply updates weighted by time decay
    winner.mu += winnerMeanDelta * weight;
    loser.mu -= loserMeanDelta * weight;

    // Update variance
    // new_sigma^2 = old_sigma^2 * (1 - coeff * w)
    // We linearly interpolate the variance reduction by weight
    const winnerVar = winner.sigma * winner.sigma;
    const loserVar = loser.sigma * loser.sigma;

    // Standard update: newVar = oldVar * (1 - (oldVar/c^2) * w)
    // With weight: newVar = oldVar - (oldVar * (oldVar/c^2) * w) * weight
    winner.sigma = Math.sqrt(Math.max(MIN_SIGMA, winnerVar * (1 - (winnerVar / (c * c)) * w * weight)));
    loser.sigma = Math.sqrt(Math.max(MIN_SIGMA, loserVar * (1 - (loserVar / (c * c)) * w * weight)));

    // Update Meta
    itemA.games += 1;
    itemB.games += 1;
    if (event.result === 'a') itemA.wins += 1;
    if (event.result === 'b') itemB.wins += 1;
    itemA.lastUpdatedAt = now;
    itemB.lastUpdatedAt = now;
    itemA.uniqueOpponents.add(event.b);
    itemB.uniqueOpponents.add(event.a);
  }

  get(itemId: ItemId, now = Date.now()): ItemState {
    this.ensureItem(itemId);
    const state = this.states.get(itemId)!;
    this.applyDrift(state, now);
    return state;
  }

  private applyDrift(state: ItemState, now: number): void {
    if (!this.config.driftRate || this.config.driftRate <= 0) return;
    const elapsedMs = Math.max(0, now - state.lastUpdatedAt);
    if (elapsedMs === 0) return;

    const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);
    const drift = elapsedDays * this.config.driftRate;

    // Variance growth: sigma^2 = sigma^2 + drift^2
    state.sigma = Math.sqrt(state.sigma * state.sigma + drift * drift);
    state.lastUpdatedAt = now;
  }

  predict(aId: ItemId, bId: ItemId, now = Date.now()): number {
    const a = this.get(aId, now);
    const b = this.get(bId, now);

    const beta2 = this.config.beta * this.config.beta;
    // Prob(A > B) = cdf((muA - muB) / sqrt(2*beta^2 + sigmaA^2 + sigmaB^2))
    const denom = Math.sqrt(2 * beta2 + a.sigma * a.sigma + b.sigma * b.sigma);
    return cdf((a.mu - b.mu) / denom);
  }

  sampleScores(itemIds: ItemId[], rng: () => number, now = Date.now()): Map<ItemId, number> {
    const sampled = new Map<ItemId, number>();
    for (const itemId of itemIds) {
      const s = this.get(itemId, now);
      const n = boxMuller(rng);
      sampled.set(itemId, s.mu + n * s.sigma);
    }
    return sampled;
  }
}

const boxMuller = (rng: () => number): number => {
  const u1 = Math.max(rng(), 1e-8);
  const u2 = Math.max(rng(), 1e-8);
  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
};
