export type ItemId = string;
export type RunId = string;
export type UserId = string;

export type ComparisonResult = 'a' | 'b' | 'tie' | 'skip';

export type ComparisonEvent = {
  a: ItemId;
  b: ItemId;
  result: ComparisonResult;
  t: number;
  userId?: UserId;
  strength?: number;
  context?: string | Record<string, string>;
};

export type DecayConfig =
  | { type: 'none' }
  | { type: 'window'; windowDays: number }
  | { type: 'exp'; halfLifeDays: number };

export type PoolConfig = {
  start: (k: number, n: number) => number;
  tight: (k: number, n: number) => number;
};

export type OnboardingConfig = {
  anchorsPerNewItem: number;
  anchorStrategy: 'boundary+mid' | 'midOnly';
};

export type ConfidenceConfig = {
  samples: number;
  challengerBandMultiplier: number;
};

export type CycleGuardConfig = {
  enabled: boolean;
  alarmThreshold: number;
  cycleResponseDepth: number;
};

export type RunConfig = {
  k: number;
  q: number;
  tau: number;
  beta: number;
  seed: number;
  decay: DecayConfig;
  pool: PoolConfig;
  boundaryBand: (k: number, n: number) => number;
  explorationRate: number;
  driftRate: number;
  repeatCapPerPair: number;
  minComparisonsPerItemSeed: number;
  minUniqueOpponentsInPool: number;
  onboarding: OnboardingConfig;
  confidence: ConfidenceConfig;
  cycleGuard: CycleGuardConfig;
};

export type ItemState = {
  mu: number;
  sigma: number;
  games: number;
  wins: number;
  lastUpdatedAt: number;
  uniqueOpponents: Set<ItemId>;
};

export type PairMeta = {
  boundaryCross: boolean;
  expectedInfoGain: number;
  sigmaA: number;
  sigmaB: number;
  repeatCount: number;
};

export type PairRecommendation = {
  a: ItemId;
  b: ItemId;
  meta: PairMeta;
};

export type ContextSummary = {
  labels: ReadonlyMap<string, number>;
  keys: ReadonlyMap<string, number>;
  keyValues: ReadonlyMap<string, number>;
};

export type EngineStatus = {
  topKSet: ItemId[];
  fullRanking: ItemId[];
  stability: number;
  pInTopK: Map<ItemId, number>;
  contested: ItemId[];
  cycles: ItemId[][];
  canStop: boolean;
  reason: string;
  nextSuggestions: PairRecommendation[];
  perUserVoteCounts: ReadonlyMap<UserId, number>;
  contextSummary: ContextSummary;
};

export type EngineContextView = {
  key: string;
  eventCount: number;
  events: ReadonlyArray<ComparisonEvent>;
  status: (now?: number) => EngineStatus;
};

export type EngineSnapshot = {
  config: Omit<RunConfig, 'pool' | 'boundaryBand'> & {
    pool: { startScale: number; startMin: number; tightScale: number; tightMin: number };
    boundaryBand: { floorMin: number; floorMax: number; ratioN: number; ratioK: number };
    driftRate: number;
  };
  items: ItemId[];
  states: Record<ItemId, { mu: number; sigma: number; games: number; wins: number; lastUpdatedAt: number; uniqueOpponents: ItemId[] }>;
  pairCounts: Record<string, number>;
  events: ComparisonEvent[];
};
