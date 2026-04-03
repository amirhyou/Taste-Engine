import { StorageService } from './storage';
import { VotePayload } from './socialApi';
import { VoteQueueSchema } from '../schemas';

const QUEUE_KEY = 'vote-queue';

function generateId(): string {
    return Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
}

export interface PendingVote {
    id: string;
    contestId: string;
    payload: VotePayload;
    enqueuedAt: number;
    retryCount: number;
}

function readQueue(): PendingVote[] {
    return StorageService.getValidatedJSON(QUEUE_KEY, VoteQueueSchema) ?? [];
}

function writeQueue(queue: PendingVote[]): void {
    StorageService.setJSON(QUEUE_KEY, queue);
}

export const voteQueue = {
    enqueue(contestId: string, payload: VotePayload): string {
        const id = generateId();
        const queue = readQueue();
        queue.push({ id, contestId, payload, enqueuedAt: Date.now(), retryCount: 0 });
        writeQueue(queue);
        return id;
    },

    getQueue(): PendingVote[] {
        return readQueue();
    },

    remove(id: string): void {
        const queue = readQueue().filter(v => v.id !== id);
        writeQueue(queue);
    },

    incrementRetry(id: string): void {
        const queue = readQueue();
        const item = queue.find(v => v.id === id);
        if (item) {
            item.retryCount += 1;
            writeQueue(queue);
        }
    },

    getPendingCount(): number {
        return readQueue().length;
    },
};
