import { ItemId } from '../types.js';

/**
 * Finds Strongly Connected Components (SCCs) in a graph using Tarjan's algorithm.
 * A component with more than one item represents a cycle (or multiple cycles) where
 * every item is reachable from every other item in the component.
 *
 * @param graph Adjacency list where graph.get(A) = [B, C] means A dominates B and C.
 * @returns Array of SCCs. Each SCC is an array of ItemIds.
 */
export const findSCCs = (graph: Map<ItemId, ItemId[]>): ItemId[][] => {
    const ids = new Map<ItemId, number>();
    const low = new Map<ItemId, number>();
    const onStack = new Set<ItemId>();
    const stack: ItemId[] = [];
    let idCounter = 0;
    const sccs: ItemId[][] = [];

    const visit = (at: ItemId) => {
        stack.push(at);
        onStack.add(at);
        ids.set(at, idCounter);
        low.set(at, idCounter);
        idCounter++;

        const neighbors = graph.get(at) || [];
        for (const to of neighbors) {
            if (!ids.has(to)) {
                // Node not visited yet
                visit(to);
                low.set(at, Math.min(low.get(at)!, low.get(to)!));
            } else if (onStack.has(to)) {
                // Node is on stack, so it's a back edge (part of SCC)
                low.set(at, Math.min(low.get(at)!, ids.get(to)!));
            }
        }

        // After visiting all neighbors, check if 'at' is the root of an SCC
        if (ids.get(at) === low.get(at)) {
            const component: ItemId[] = [];
            let node: ItemId;
            do {
                node = stack.pop()!;
                onStack.delete(node);
                component.push(node);
            } while (node !== at);

            // We only care about components with size > 1 (cycles)
            // OR components of size 1 that point to themselves (self-loops)
            // But in our case, A beats A is impossible, so size > 1 is sufficient condition for "cycle"
            // However, the function returns ALL SCCs requested by strict definition?
            // Usually strict definition includes size 1.
            // Let's return all, and let caller filter for size > 1 (actual cycles).
            sccs.push(component);
        }
    };

    for (const node of graph.keys()) {
        if (!ids.has(node)) {
            visit(node);
        }
    }

    return sccs;
};
