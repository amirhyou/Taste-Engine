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

## Documentation

- **[API Reference](docs/api/index.html)**: Comprehensive technical documentation for all packages.
- **[Spec](.gsd/SPEC.md)**: Original project vision and requirements.

## Examples

Check out the `examples/` directory for reference implementations:
- **[Node CLI](examples/node-cli)**: Interactive terminal-based voting loop.
- **[React Web](examples/react-web)**: Modern web interface with real-time rankings.

## API Usage

```ts
import { Engine } from '@taste-engine/core';

const engine = new Engine({ k: 10, q: 0.8 });
engine.addItems(['item-1', 'item-2', 'item-3']);

const next = engine.nextPair();
engine.ingest({ a: next.a, b: next.b, result: 'a', t: Date.now() });

const status = engine.status();
console.log(status.topKSet, status.canStop);
```

## License

MIT © Taste Engine
