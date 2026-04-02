import { z } from 'zod';

export const ComparisonResultSchema = z.enum(['a', 'b', 'tie', 'skip']);

export const ComparisonEventSchema = z.object({
    a: z.string(),
    b: z.string(),
    result: ComparisonResultSchema,
    t: z.number(),
    userId: z.string().optional(),
    strength: z.number().optional(),
    context: z.union([z.string(), z.record(z.string())]).optional(),
});

export type ComparisonEvent = z.infer<typeof ComparisonEventSchema>;
