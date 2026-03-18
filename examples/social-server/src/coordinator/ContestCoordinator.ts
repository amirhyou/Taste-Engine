import { Engine } from "@taste-engine/core";
import { eventQueue } from "../worker/bullmq";

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
    const next = entry.engine.nextPair();

    // enqueue persistence job asynchronously (do not await)
    void eventQueue.add('VOTE_EVENT', { contestId: id, event: vote, timestamp: Date.now() }).catch((err) => {
      // best-effort logging — don't block request path
      // eslint-disable-next-line no-console
      console.error('Failed to enqueue VOTE_EVENT', err);
    });

    return next;
  }

  listActive() {
    return Array.from(this.map.keys());
  }

  async snapshotAll() {
    for (const [contestId, entry] of this.map.entries()) {
      try {
        const snapshot = entry.engine.snapshot();
        await eventQueue.add('SNAPSHOT', { contestId, snapshot, timestamp: Date.now() });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to enqueue snapshot for', contestId, err);
      }
    }
  }
}
