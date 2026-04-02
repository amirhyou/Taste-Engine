import type { Job } from 'bullmq';
import { storeEngineSnapshot } from '../redis/engineState';
import { logger } from '../observability/logger';

function asError(err: unknown): Error {
  if (err instanceof Error) return err;
  return new Error(typeof err === 'string' ? err : 'Unknown error');
}

export async function handleJob(job: Job) {
  try {
    const { name, data } = job;
    if (name === 'VOTE_EVENT') {
      // Vote events are handled in real-time by ContestCoordinator; nothing to do here yet.
      return;
    }

    if (name === 'SNAPSHOT') {
      if (!data?.contestId || !data?.snapshot) {
        throw new Error('SNAPSHOT job requires contestId and snapshot');
      }
      await storeEngineSnapshot(data.contestId, data.snapshot);
      return;
    }

    throw new Error(`Unknown job type: ${name}`);
  } catch (err) {
    const failure = asError(err);
    logger.error({
      err: failure,
      jobId: job.id,
      name: job.name,
    }, 'worker.handleJob_failed');
    throw failure;
  }
}
