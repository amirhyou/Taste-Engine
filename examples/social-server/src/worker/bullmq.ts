import { Queue, Worker } from 'bullmq';
import { handleJob } from './VotePersister';

// BullMQ bundles its own ioredis, so we pass a plain connection config rather
// than the shared Redis instance to avoid a type mismatch between the two copies.
const connection = {
  host: process.env.REDIS_HOST ?? '127.0.0.1',
  port: Number(process.env.REDIS_PORT ?? 6379),
  maxRetriesPerRequest: null as unknown as undefined,
};

export const eventQueue = new Queue('ContestEventsQueue', { connection });

// Worker is optional to run in the same process for development/testing.
export const startWorker = () => {
  const worker = new Worker(
    'ContestEventsQueue',
    async (job) => {
      await handleJob(job);
    },
    { connection }
  );

  worker.on('failed', (job, err) => {
    // eslint-disable-next-line no-console
    console.error('Job failed', job?.id, err);
  });

  return worker;
};
