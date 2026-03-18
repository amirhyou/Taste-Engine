import { Engine } from "@taste-engine/core";

type ContestEntry = {
  engine: Engine;
  lastActive: number;
};

export class ContestCoordinator {
  private map: Map<string, ContestEntry> = new Map();

  createContest(id: string, items: string[]) {
    const engine = new Engine(items);
    this.map.set(id, { engine, lastActive: Date.now() });
    return id;
  }

  getNextPair(id: string) {
    const entry = this.map.get(id);
    if (!entry) throw new Error("Contest not found");
    entry.lastActive = Date.now();
    return entry.engine.nextPair();
  }

  submitVote(id: string, vote: any) {
    const entry = this.map.get(id);
    if (!entry) throw new Error("Contest not found");
    entry.lastActive = Date.now();
    entry.engine.ingest(vote);
    return entry.engine.nextPair();
  }

  listActive() {
    return Array.from(this.map.keys());
  }
}
