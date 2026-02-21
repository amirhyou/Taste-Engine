

import { computeConfidence } from '../confidence/confidence.js';
import { defaultRunConfig, serializableDefaults } from '../defaults.js';
import { OnlineModel } from '../model/onlineModel.js';
import { findSCCs } from '../utils/graph.js';
import { BoundarySelector, pairKey } from '../selector/selector.js';
import { shouldStop } from '../stopping/stopping.js';
import {
  ComparisonEvent,
  EngineSnapshot,
  EngineStatus,
  ItemId,
  PairRecommendation,
  RunConfig,
} from '../types.js';
import { seededRng } from '../utils/random.js';

export class Engine {
  private config: RunConfig;
  private model: OnlineModel;
  private selector: BoundarySelector;
  private readonly itemIds = new Set<ItemId>();
  private readonly pairCounts = new Map<string, number>();
  private readonly eventLog: ComparisonEvent[] = [];
  private readonly rng = seededRng(1337);

  constructor(config: Partial<RunConfig> = {}) {
    this.config = mergeConfig(config);
    this.model = new OnlineModel(this.config);
    this.selector = new BoundarySelector(this.config);
  }

  addItems(ids: ItemId[], now = Date.now()): PairRecommendation[] {
    const added: ItemId[] = [];
    for (const id of ids) {
      if (this.itemIds.has(id)) continue;
      this.itemIds.add(id);
      this.model.ensureItem(id);
      added.push(id);
    }

    if (added.length === 0) return [];

    const ranked = this.rankByMu();
    const boundary = this.config.boundaryBand(this.config.k);
    const boundaryAnchors = ranked.slice(Math.max(0, this.config.k - boundary), this.config.k + boundary);
    const midStart = Math.max(0, Math.floor(ranked.length / 2) - boundary);
    const midAnchors = ranked.slice(midStart, midStart + Math.max(boundary, 1));

    const onboardingPairs: PairRecommendation[] = [];
    for (const newItem of added) {
      const anchors = this.pickAnchors(boundaryAnchors, midAnchors, newItem);
      for (const anchor of anchors.slice(0, this.config.onboarding.anchorsPerNewItem)) {
        onboardingPairs.push({
          a: newItem,
          b: anchor,
          meta: {
            boundaryCross: false,
            expectedInfoGain: 0.5,
            sigmaA: this.model.get(newItem).sigma,
            sigmaB: this.model.get(anchor).sigma,
            repeatCount: this.pairCounts.get(pairKey(newItem, anchor)) ?? 0,
          },
        });
      }
    }

    if (onboardingPairs.length === 0) {
      return this.seedSchedule(now).slice(0, this.config.onboarding.anchorsPerNewItem * added.length);
    }
    return onboardingPairs;
  }

  ingest(event: ComparisonEvent, now = event.t): void {
    this.itemIds.add(event.a);
    this.itemIds.add(event.b);
    this.model.ingest(event, now);
    this.eventLog.push(event);
    const key = pairKey(event.a, event.b);
    this.pairCounts.set(key, (this.pairCounts.get(key) ?? 0) + 1);
  }

  nextPair(): PairRecommendation {
    const pool = this.activePool();
    return this.selector.nextPair({
      model: this.model,
      itemIds: [...this.itemIds],
      pool,
      k: this.config.k,
      pairCounts: this.pairCounts,
      rng: this.rng,
      explorationRate: this.config.explorationRate,
    });
  }

  status(): EngineStatus {
    const ranked = this.rankByMu();
    const confidence = computeConfidence(this.model, ranked, this.config, this.rng);
    const stopDecision = shouldStop(ranked, confidence.pInTopK, this.config);
    const cycles = this.config.cycleGuard.enabled ? this.findCycles(ranked) : [];

    return {
      topKSet: ranked.slice(0, Math.min(this.config.k, ranked.length)),
      stability: confidence.stability,
      pInTopK: confidence.pInTopK,
      contested: confidence.contested,
      cycles,
      canStop: stopDecision.canStop,
      reason: stopDecision.reason,
      nextSuggestions: [this.nextPair(), this.nextPair()],
    };
  }

  isConverged(): boolean {
    return this.status().canStop;
  }

  findCycles(items: ItemId[]): ItemId[][] {
    const wins = new Map<string, number>();
    const graph = new Map<ItemId, ItemId[]>();
    for (const id of items) graph.set(id, []);

    for (const event of this.eventLog) {
      if (event.result === 'tie' || event.result === 'skip') continue;
      const winner = event.result === 'a' ? event.a : event.b;
      const loser = event.result === 'a' ? event.b : event.a;
      const key = `${winner}::${loser}`;
      wins.set(key, (wins.get(key) ?? 0) + 1);
    }

    for (const [key, count] of wins) {
      const [winner, loser] = key.split('::');
      const reverseKey = `${loser}::${winner}`;
      const reverseCount = wins.get(reverseKey) ?? 0;
      if (count > reverseCount) {
        graph.get(winner)?.push(loser);
      }
    }

    return findSCCs(graph).filter((c) => c.length > 1);
  }

  setK(k: number): void {
    this.config.k = Math.max(1, Math.floor(k));
  }

  setQ(q: number): void {
    this.config.q = Math.min(1, Math.max(0.5, q));
  }

  seedSchedule(now = Date.now()): PairRecommendation[] {
    const items = [...this.itemIds];
    const out: PairRecommendation[] = [];
    if (items.length < 2) return out;

    const needed = this.config.minComparisonsPerItemSeed;
    const exposure = new Map<ItemId, number>(items.map((id) => [id, this.model.get(id).games]));

    for (const a of items) {
      while ((exposure.get(a) ?? 0) < needed) {
        const b = items.find((cand) => cand !== a && (this.pairCounts.get(pairKey(a, cand)) ?? 0) < this.config.repeatCapPerPair);
        if (!b) break;
        out.push({
          a,
          b,
          meta: {
            boundaryCross: false,
            expectedInfoGain: 0.5,
            sigmaA: this.model.get(a).sigma,
            sigmaB: this.model.get(b).sigma,
            repeatCount: this.pairCounts.get(pairKey(a, b)) ?? 0,
          },
        });
        exposure.set(a, (exposure.get(a) ?? 0) + 1);
        exposure.set(b, (exposure.get(b) ?? 0) + 1);
        this.pairCounts.set(pairKey(a, b), (this.pairCounts.get(pairKey(a, b)) ?? 0) + 1);
      }
    }

    return out;
  }

  snapshot(): EngineSnapshot {
    const states = [...this.itemIds].reduce<EngineSnapshot['states']>((acc, itemId) => {
      const s = this.model.get(itemId);
      acc[itemId] = {
        mu: s.mu,
        sigma: s.sigma,
        games: s.games,
        wins: s.wins,
        uniqueOpponents: [...s.uniqueOpponents],
      };
      return acc;
    }, {});

    return {
      config: {
        ...this.config,
        pool: serializableDefaults.pool,
        boundaryBand: serializableDefaults.boundaryBand,
      },
      items: [...this.itemIds],
      states,
      pairCounts: Object.fromEntries(this.pairCounts.entries()),
      events: [...this.eventLog],
    };
  }

  loadSnapshot(snapshot: EngineSnapshot): void {
    this.itemIds.clear();
    this.pairCounts.clear();
    this.eventLog.length = 0;

    Object.assign(
      this.config,
      mergeConfig({
        ...snapshot.config,
        pool: {
          start: (k) => Math.max(Math.round(snapshot.config.pool.startScale * k), snapshot.config.pool.startMin),
          tight: (k) => Math.max(Math.round(snapshot.config.pool.tightScale * k), snapshot.config.pool.tightMin),
        },
        boundaryBand: (k) => Math.max(snapshot.config.boundaryBand.floor, Math.round(snapshot.config.boundaryBand.ratio * k)),
      }),
    );

    this.model = new OnlineModel(this.config);
    this.selector = new BoundarySelector(this.config);

    for (const item of snapshot.items) {
      this.itemIds.add(item);
      this.model.ensureItem(item);
    }

    for (const [k, v] of Object.entries(snapshot.pairCounts)) {
      this.pairCounts.set(k, v);
    }

    for (const event of snapshot.events) {
      this.model.ingest(event, event.t);
      this.eventLog.push(event);
    }
  }

  private rankByMu(): ItemId[] {
    return [...this.itemIds].sort((a, b) => this.model.get(b).mu - this.model.get(a).mu);
  }

  private activePool(): ItemId[] {
    const ranked = this.rankByMu();
    const n = ranked.length;
    const startSize = this.config.pool.start(this.config.k, n);
    const tightSize = this.config.pool.tight(this.config.k, n);
    const size = this.eventLog.length < n * 2 ? startSize : tightSize;
    return ranked.slice(0, Math.min(n, Math.max(size, this.config.k + 1)));
  }

  private pickAnchors(boundaryAnchors: ItemId[], midAnchors: ItemId[], excluded: ItemId): ItemId[] {
    const pool = this.config.onboarding.anchorStrategy === 'midOnly' ? midAnchors : [...boundaryAnchors, ...midAnchors];
    const unique = [...new Set(pool)].filter((id) => id !== excluded);
    return unique.length > 0 ? unique : [...this.itemIds].filter((id) => id !== excluded).slice(0, 1);
  }
}

const mergeConfig = (partial: Partial<RunConfig>): RunConfig => ({
  ...defaultRunConfig,
  ...partial,
  pool: partial.pool ?? defaultRunConfig.pool,
  boundaryBand: partial.boundaryBand ?? defaultRunConfig.boundaryBand,
  onboarding: { ...defaultRunConfig.onboarding, ...(partial.onboarding ?? {}) },
  confidence: { ...defaultRunConfig.confidence, ...(partial.confidence ?? {}) },
  cycleGuard: { ...defaultRunConfig.cycleGuard, ...(partial.cycleGuard ?? {}) },
});
