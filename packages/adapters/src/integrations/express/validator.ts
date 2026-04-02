import { z } from 'zod';
import { ComparisonEventSchema } from '../../schemas/comparisonEvent';
import { EngineSnapshotSchema } from '../../schemas/engineSnapshot';

export function zodBodyValidator<T extends z.ZodTypeAny>(schema: T) {
    return (req: any, res: any, next: any) => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            return res.status(400).json({ error: 'Validation failed', issues: result.error.issues });
        }
        req.body = result.data;
        next();
    };
}

export const validateComparisonEvent = () => zodBodyValidator(ComparisonEventSchema);
export const validateEngineSnapshot = () => zodBodyValidator(EngineSnapshotSchema);
