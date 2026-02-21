# @taste-engine/core

High-precision identification of Top-K items from noisy human pairwise preferences.

## Features

-   **TrueSkill-inspired Modeling**: Every item is modeled as a Gaussian distribution ($\mu$, $\sigma$). We don't just track wins; we track *certainty*.
-   **Active Learning (Active Selection)**: The engine intelligently chooses pairs that are likely to provide the most information gain.
-   **Confidence-based Stopping**: Uses Monte Carlo simulations to estimate Top-K stability.
-   **Cycle Guardrails**: Automatically detects and reports circular preferences (e.g., $A > B > C > A$).
-   **Time Decay**: Support for skills that change over time using configurable half-life or window-based decay.
-   **Zero Dependencies**: Pure TypeScript core, optimized for performance (N=5000+).

## Configuration (`RunConfig`)

When initializing the `Engine`, you can tune various policy knobs:

| Parameter    | Type          | Default           | Description                                         |
| :----------- | :------------ | :---------------- | :-------------------------------------------------- |
| `k`          | `number`      | `10`              | The number of top items you want to identify.       |
| `q`          | `number`      | `0.9`             | Target confidence/stability threshold (0 to 1).     |
| `tau`        | `number`      | `0.1`             | "Dynamics" factor; how fast skills drift over time. |
| `beta`       | `number`      | `4.16`            | Performance noise.                                  |
| `decay`      | `DecayConfig` | `none`            | Weighting old data.                                 |
| `cycleGuard` | `object`      | `{enabled: true}` | Enable cycle detection.                             |

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
