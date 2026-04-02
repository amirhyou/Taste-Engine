import { z } from 'zod';

const DecayConfigSchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('none') }),
    z.object({ type: z.literal('window'), windowDays: z.number() }),
    z.object({ type: z.literal('exp'), halfLifeDays: z.number() }),
]);

const PoolConfigSerializedSchema = z.object({
    startScale: z.number(),
    startMin: z.number(),
    tightScale: z.number(),
    tightMin: z.number(),
});

const BoundaryBandSerializedSchema = z.object({
    floorMin: z.number(),
    floorMax: z.number(),
    ratioN: z.number(),
    ratioK: z.number(),
});

export const RunConfigSerializedSchema = z.object({
    k: z.number().int().positive(),
    q: z.number(),
    tau: z.number(),
    beta: z.number(),
    decay: DecayConfigSchema,
    pool: PoolConfigSerializedSchema,
    boundaryBand: BoundaryBandSerializedSchema,
    explorationRate: z.number(),
    driftRate: z.number(),
    repeatCapPerPair: z.number().int(),
    minComparisonsPerItemSeed: z.number().int(),
    minUniqueOpponentsInPool: z.number().int(),
    onboarding: z.object({
        anchorsPerNewItem: z.number().int(),
        anchorStrategy: z.enum(['boundary+mid', 'midOnly']),
    }),
    confidence: z.object({
        samples: z.number().int(),
        challengerBandMultiplier: z.number(),
    }),
    cycleGuard: z.object({
        enabled: z.boolean(),
        alarmThreshold: z.number(),
    }),
});

export type RunConfigSerialized = z.infer<typeof RunConfigSerializedSchema>;
