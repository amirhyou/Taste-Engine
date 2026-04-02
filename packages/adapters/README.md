# @taste-engine/adapters

Validation schemas, JSON codecs, and framework middleware for Taste Engine types.

## Schemas & Codecs

```typescript
import { ComparisonEventCodec, EngineSnapshotCodec } from '@taste-engine/adapters';

// Parse JSON from network
const event = ComparisonEventCodec.parse(jsonString);

// Serialize for storage
const serialized = EngineSnapshotCodec.stringify(snapshot);

// Safe parse (no throw)
const result = ComparisonEventCodec.safeParse(jsonString);
if (!result.success) console.error(result.error);
```

## Hono Middleware

Requires `@hono/zod-validator` peer dependency.

```typescript
import { honoValidateComparisonEvent } from '@taste-engine/adapters';

app.post('/vote', honoValidateComparisonEvent(), (c) => {
    const event = c.req.valid('json'); // fully typed ComparisonEvent
    // ...
});
```

## Express Middleware

```typescript
import { expressValidateComparisonEvent } from '@taste-engine/adapters';

router.post('/vote', expressValidateComparisonEvent(), (req, res) => {
    const event = req.body; // validated ComparisonEvent
    // ...
});
```

## Schemas

All schemas are Zod objects and can be used directly:

```typescript
import { ComparisonEventSchema, EngineSnapshotSchema } from '@taste-engine/adapters';

// Validate unknown input
const result = ComparisonEventSchema.safeParse(unknownData);
```
