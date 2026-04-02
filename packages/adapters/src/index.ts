// Schemas
export { ComparisonEventSchema, ComparisonResultSchema } from './schemas/comparisonEvent';
export type { ComparisonEvent } from './schemas/comparisonEvent';
export { RunConfigSerializedSchema } from './schemas/runConfig';
export type { RunConfigSerialized } from './schemas/runConfig';
export { EngineSnapshotSchema } from './schemas/engineSnapshot';
export type { EngineSnapshot } from './schemas/engineSnapshot';

// Codecs
export { ComparisonEventCodec, RunConfigCodec, EngineSnapshotCodec } from './codecs/json';

// Hono integration (requires @hono/zod-validator peer dependency)
export { validateComparisonEvent as honoValidateComparisonEvent, validateEngineSnapshot as honoValidateEngineSnapshot } from './integrations/hono/validator';

// Express integration (no additional peer dependency required)
export { zodBodyValidator, validateComparisonEvent as expressValidateComparisonEvent, validateEngineSnapshot as expressValidateEngineSnapshot } from './integrations/express/validator';
