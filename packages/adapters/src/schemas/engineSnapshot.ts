import { z } from 'zod';
import { ComparisonEventSchema } from './comparisonEvent';
import { RunConfigSerializedSchema } from './runConfig';

const ItemStateSerializedSchema = z.object({
    mu: z.number(),
    sigma: z.number(),
    games: z.number().int().nonnegative(),
    wins: z.number().int().nonnegative(),
    lastUpdatedAt: z.number(),
    uniqueOpponents: z.array(z.string()),
});

export const EngineSnapshotSchema = z.object({
    config: RunConfigSerializedSchema,
    items: z.array(z.string()),
    states: z.record(ItemStateSerializedSchema),
    pairCounts: z.record(z.number()),
    events: z.array(ComparisonEventSchema),
});

export type EngineSnapshot = z.infer<typeof EngineSnapshotSchema>;
