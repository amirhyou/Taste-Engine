## Research Questions

1. **Memory Scalability for N=5000**
   - A fully connected graph of 5,000 items has ~12.5 million edges.
   - Can `Map<string, number>` store 12.5M keys + counts in standard Node.js heap?
   - If not, what is the mitigation? (Key hashing? Int32 arrays? LRU pruning?)

2. **Cycle Detection**
   - How to efficiently detect "Rock-Paper-Scissors" (A>B>C>A) cycles?
   - efficiently: O(V+E) is too slow if E is large. Can we detect locally?
   - What should the "Guardrail" do? (Warn? Deprioritize? Reject?)

3. **Performance of `rankByMu`**
   - `rankByMu` sorts `this.itemIds` (Array) every time `nextPair` or `status` is called.
   - For N=5000, `Array.sort` is fast (~1-2ms), but is it called too frequently?
   - Can we cache the ranking?

4. **Exploration Strategies**
   - Current: Random + Uncertainty.
   - New: ? (e.g., "Maximize distinct opponents"?)
