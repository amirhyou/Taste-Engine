import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { handleJob } from './VotePersister';

const connection = new IORedis();

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
