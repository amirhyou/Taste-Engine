import { zValidator } from '@hono/zod-validator';
import { ComparisonEventSchema } from '../../schemas/comparisonEvent';
import { EngineSnapshotSchema } from '../../schemas/engineSnapshot';

export const validateComparisonEvent = () =>
    zValidator('json', ComparisonEventSchema);

export const validateEngineSnapshot = () =>
    zValidator('json', EngineSnapshotSchema);
