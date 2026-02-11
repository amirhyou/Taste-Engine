import { Engine } from '../../../packages/core/dist/index.js';

const engine = new Engine({ k: 3 });
engine.addItems(['a', 'b', 'c', 'd', 'e']);

for (let i = 0; i < 20; i += 1) {
  const pair = engine.nextPair();
  const winner = Math.random() > 0.5 ? 'a' : 'b';
  engine.ingest({ a: pair.a, b: pair.b, result: winner, t: Date.now() });
}

console.log(engine.status());
