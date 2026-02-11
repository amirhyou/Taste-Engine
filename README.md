# Taste Engine

TypeScript library for top-k identification from noisy pairwise preferences.

## Packages

- `@taste-engine/core`: stateful engine with pair selection, confidence, and stopping.
- `@taste-engine/adapters`: placeholder for storage/runtime adapters.

## Quickstart

```ts
import { Engine } from '@taste-engine/core';

const engine = new Engine({ k: 10, q: 0.8 });
engine.addItems(['item-1', 'item-2', 'item-3']);

const next = engine.nextPair();
engine.ingest({ a: next.a, b: next.b, result: 'a', t: Date.now() });

const status = engine.status();
console.log(status.topKSet, status.canStop);
```

## API

- `new Engine(config)`
- `addItems(itemIds, now?)`
- `ingest(event, now?)`
- `nextPair()`
- `status()`
- `setK(k)` / `setQ(q)`
- `seedSchedule()`
- `snapshot()` / `loadSnapshot(snapshot)`
