import { ComparisonEvent, DecayConfig, ItemId, ItemState } from '../types.js';
import { eventWeight } from '../utils/decay.js';

const DEFAULT_MU = 25;
const DEFAULT_SIGMA = 8.333;
const MIN_SIGMA = 1;

export class OnlineModel {
  private readonly states = new Map<ItemId, ItemState>();

  constructor(private readonly decay: DecayConfig) {}

  ensureItem(itemId: ItemId): void {
    if (this.states.has(itemId)) return;
    this.states.set(itemId, {
      mu: DEFAULT_MU,
      sigma: DEFAULT_SIGMA,
      games: 0,
      wins: 0,
      uniqueOpponents: new Set(),
    });
  }

  ingest(event: ComparisonEvent, now = event.t): void {
    this.ensureItem(event.a);
    this.ensureItem(event.b);

    if (event.result === 'skip') return;

    const a = this.states.get(event.a)!;
    const b = this.states.get(event.b)!;
    const w = eventWeight(event, now, this.decay);
    if (w <= 0) return;

    const pA = this.predict(event.a, event.b);
    let sA = 0.5;
    if (event.result === 'a') sA = 1;
    if (event.result === 'b') sA = 0;

    const k = 1.4 * w;
    const delta = k * (sA - pA);

    a.mu += delta * (1 + a.sigma / 20);
    b.mu -= delta * (1 + b.sigma / 20);
    a.sigma = Math.max(MIN_SIGMA, a.sigma * (1 - 0.03 * w));
    b.sigma = Math.max(MIN_SIGMA, b.sigma * (1 - 0.03 * w));

    a.games += 1;
    b.games += 1;
    if (event.result === 'a') a.wins += 1;
    if (event.result === 'b') b.wins += 1;
    a.uniqueOpponents.add(event.b);
    b.uniqueOpponents.add(event.a);
  }

  get(itemId: ItemId): ItemState {
    this.ensureItem(itemId);
    return this.states.get(itemId)!;
  }

  predict(aId: ItemId, bId: ItemId): number {
    this.ensureItem(aId);
    this.ensureItem(bId);
    const a = this.states.get(aId)!;
    const b = this.states.get(bId)!;
    const spread = Math.sqrt(a.sigma * a.sigma + b.sigma * b.sigma);
    const z = (a.mu - b.mu) / Math.max(1e-6, spread);
    return 1 / (1 + Math.exp(-z));
  }

  sampleScores(itemIds: ItemId[], rng: () => number): Map<ItemId, number> {
    const sampled = new Map<ItemId, number>();
    for (const itemId of itemIds) {
      const s = this.get(itemId);
      const n = boxMuller(rng);
      sampled.set(itemId, s.mu + n * s.sigma);
    }
    return sampled;
  }

  itemIds(): ItemId[] {
    return [...this.states.keys()];
  }
}

const boxMuller = (rng: () => number): number => {
  const u1 = Math.max(rng(), 1e-8);
  const u2 = Math.max(rng(), 1e-8);
  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
};
