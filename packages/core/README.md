# @taste-engine/core

High-precision identification of Top-K items from noisy human pairwise preferences.

## Features

- **TrueSkill-inspired**: Uses Gaussian posterior updates to model item skill and uncertainty.
- **Cycle Guardrails**: Detects and reports preference cycles (A > B > C > A).
- **Active Selection**: Prioritizes pairs that provide the most information gain.
- **Scalable**: Handles 5,000+ items with sub-10ms latency.
- **Zero Dependencies**: Pure TypeScript core.

## Quickstart

```bash
npm install @taste-engine/core
```

```ts
import { Engine } from '@taste-engine/core';

// Identify Top 3 items with 90% confidence
const engine = new Engine({ k: 3, q: 0.9 });

engine.addItems(['Pizza', 'Tacos', 'Sushi', 'Burgers']);

// Get the best pair to compare next
const pair = engine.nextPair();

// Record a result
engine.ingest({ 
  a: pair.a, 
  b: pair.b, 
  result: 'a', // 'a' won
  t: Date.now() 
});

// Check status
const status = engine.status();
console.log(status.topKSet); // ['Pizza', 'Sushi', 'Tacos']
console.log(status.canStop); // true
```

## Documentation

Full API documentation is available at [docs/api/index.html](../../docs/api/index.html).
