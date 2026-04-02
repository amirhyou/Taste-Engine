import type { Job } from 'bullmq';
import { storeEngineSnapshot } from '../redis/engineState';

export async function handleJob(job: Job) {
  const { name, data } = job;
  if (name === 'VOTE_EVENT') {
    // Vote events are handled in real-time by ContestCoordinator; nothing to do here yet.
  } else if (name === 'SNAPSHOT') {
    if (data.contestId && data.snapshot) {
      await storeEngineSnapshot(data.contestId, data.snapshot);
    }
  } else {
    // eslint-disable-next-line no-console
    console.warn('[VotePersister] Unknown job type', name);
  }
}
