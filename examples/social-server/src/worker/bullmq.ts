import { Queue, Worker } from 'bullmq';
import { handleJob } from './VotePersister';
import { withBindings } from '../observability/logger';

// BullMQ bundles its own ioredis, so we pass a plain connection config rather
// than the shared Redis instance to avoid a type mismatch between the two copies.
const connection = {
  host: process.env.REDIS_HOST ?? '127.0.0.1',
  port: Number(process.env.REDIS_PORT ?? 6379),
  maxRetriesPerRequest: null as unknown as undefined,
};

export const eventQueue = new Queue('ContestEventsQueue', {
  connection,
  defaultJobOptions: {
    // Conservative retries to surface persistent failures quickly while handling transient Redis/network faults.
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1_000,
    },
    removeOnComplete: {
      age: 86_400,
      count: 5_000,
    },
    removeOnFail: {
      age: 604_800,
      count: 10_000,
    },
  },
});

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
    withBindings({
      jobId: job?.id,
      attemptsMade: job?.attemptsMade,
      failedReason: job?.failedReason ?? err.message,
    }).error({ err }, 'worker.job_failed');
  });

  worker.on('error', (err) => {
    withBindings({
      failedReason: err.message,
    }).error({ err }, 'worker.error');
  });

  return worker;
};
