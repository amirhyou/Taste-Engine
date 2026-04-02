import { Engine } from "@taste-engine/core";
import { eventQueue } from "../worker/bullmq";
import { storeContestItems, getContestItems, getEngineSnapshot, listAllContestIds } from "../redis/engineState";

type ContestEntry = {
  engine: Engine;
  lastActive: number;
};

export class ContestCoordinator {
  private map: Map<string, ContestEntry> = new Map();

  createContest(id: string, items: string[]) {
    const engine = new Engine();
    engine.addItems(items);
    this.map.set(id, { engine, lastActive: Date.now() });
    // Persist items so engine can be restored after server restart
    void storeContestItems(id, items).catch((err) => {
      console.error('Failed to store contest items', id, err);
    });
    return id;
  }

  async restoreAll(): Promise<void> {
    const ids = await listAllContestIds();
    let restored = 0;
    for (const id of ids) {
      if (this.map.has(id)) continue;
      const snapshot = await getEngineSnapshot(id);
      if (snapshot) {
        const engine = new Engine();
        engine.loadSnapshot(snapshot);
        this.map.set(id, { engine, lastActive: Date.now() });
        restored++;
        continue;
      }
      const items = await getContestItems(id);
      if (items) {
        const engine = new Engine();
        engine.addItems(items);
        this.map.set(id, { engine, lastActive: Date.now() });
        restored++;
      }
    }
    if (restored > 0) {
      console.log(`[ContestCoordinator] Restored ${restored} contest engine(s) from Redis`);
    }
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

  getRanking(id: string): string[] {
    const entry = this.map.get(id);
    if (!entry) return [];
    const status = entry.engine.status();
    return status?.fullRanking ?? [];
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
