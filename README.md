# Taste Engine

TypeScript library for **high-precision identification of Top-K items** from noisy, pairwise human preferences. Built for scenarios where gathering a full ranking is too expensive or inconsistent (e.g., voting on 5,000 photos, judging recipe variants, or picking winners in a tournament).

## Key Features

-   **TrueSkill-inspired Modeling**: Every item is modeled as a Gaussian distribution ($\mu$, $\sigma$). We don't just track wins; we track *certainty*.
-   **Active Learning (Active Selection)**: The engine doesn't pick pairs randomly. It intelligently chooses pairs that are likely to provide the most information gain based on current uncertainty.
-   **Confidence-based Stopping**: Uses Monte Carlo simulations to estimate the probability of the current Top-K set being stable. It tells you exactly when you can stop asking for more comparisons.
-   **Cycle Guardrails**: Automatically detects and reports preference cycles (e.g., $A > B > C > A$) that indicate inconsistent judge behavior or contested items.
-   **Time Dynamics (Decay & Drift)**: Keep your rankings alive. Support for weighting recent votes more heavily (Decay) and natural uncertainty growth during inactivity (Drift).
-   **Deterministic Support**: Predictable results for same history, built with zero external dependencies.
-   **Built for Scale**: Optimized to handle 5,000+ items entirely in-memory with sub-10ms selection latency.

## Documentation & Examples

-   **[API Reference](docs/api/index.html)**: Full technical documentation.
-   **[Node CLI Example](examples/node-cli)**: Interactive terminal-based voting.
-   **[React Web Example](examples/react-web)**: Modern UI featuring preference sliders and real-time rankings.

---

## Configuration (`RunConfig`)

When initializing the `Engine`, you can tune various policy knobs:

| Parameter    | Type          | Default                           | Description                                                        |
| :----------- | :------------ | :-------------------------------- | :----------------------------------------------------------------- |
| `k`          | `number`      | `10`                              | The number of top items you want to identify.                      |
| `q`          | `number`      | `0.9`                             | Target confidence/stability threshold (0 to 1).                    |
| `tau`        | `number`      | `0.1`                             | "Dynamics" factor; how fast skills drift over time.                |
| `beta`       | `number`      | `4.16`                            | Performance noise; how much a "lesser" item can beat a better one. |
| `decay`      | `DecayConfig` | `{type: 'exp', halfLifeDays: 30}` | Weighting old data (`window`, `exp`, or `none`).                   |
| `driftRate`  | `number`      | `0.05`                            | "Entropy" factor; σ growth per day of item inactivity.             |
| `cycleGuard` | `object`      | `{enabled: true}`                 | Enable detection of circular preferences.                          |

---

## API & Usage

### 1. Ingesting Data
The engine consumes pairwise comparison events.

```ts
engine.ingest({
  a: 'Pizza',
  b: 'Burger',
  result: 'a',      // 'a' won, 'b' won, 'tie', or 'skip'
  strength: 1.0,    // (Optional) 0.0 to 1.0 for "how much" they prefer it
  t: Date.now()     // Timestamp
});
```

### 2. Getting Recommendations
Ask the engine which pair should be compared next to reach convergence fastest.

```ts
const { a, b } = engine.nextPair();
```

### 3. Checking Status
Returns the current state of the leaderboard and convergence metrics.

```ts
const status = engine.status();
```

**Output (`EngineStatus`):**
- `topKSet`: `string[]` — The current estimated Top-K items, sorted by rank.
- `stability`: `number` — (0.0 - 1.0) Probability that the current `topKSet` will remain in the Top K.
- `canStop`: `boolean` — True if `stability >= q`.
- `cycles`: `string[][]` — Lists of items involved in loops (e.g. `[['A', 'B', 'C']]`).
- `contested`: `string[]` — Items with high uncertainty near the K-boundary.

### 4. Persistence
Save and load the engine state easily.

```ts
const backup = engine.snapshot();
const newEngine = new Engine(config);
newEngine.loadSnapshot(backup);
```

---

## Time Dynamics (Making rankings "Alive")

Taste Engine models preferences as a living system. We use two mechanisms to handle time:

### 1. Reactive Decay (Vote Weighting)
When you cast a new vote, the engine "forgets" old history based on your `decay` config.
- **Goal**: Ensure a new preference flips the ranking faster.
- **Example**: If you hated Broccoli in 2020 but love it in 2024, the 2024 vote will have 10x more power than the stale 2020 data.

### 2. Proactive Drift (Memory Entropy)
Even if you *don't* vote, the engine's confidence in your preferences naturally "relaxes" over time via `driftRate`.
- **Goal**: Recognize that "No news is bad news." Stale data is less certain than fresh data.
- **Example**: If you haven't voted in 6 months, the engine's **Stability** score will drop from 95% to 70%. It stays open-minded to change, ready for your next check-in.

---

## License

MIT © Taste Engine
