import type { Job } from 'bullmq';

export async function handleJob(job: Job) {
  const { name, data } = job;
  // Mock persistence: just log payload for now
  if (name === 'VOTE_EVENT') {
    // eslint-disable-next-line no-console
    console.log(`[VotePersister] Persisting VOTE_EVENT for ${data.contestId}`, data.event, data.timestamp);
    // Here you would insert into DB, update lastPersistedSeq, etc.
  } else if (name === 'SNAPSHOT') {
    // eslint-disable-next-line no-console
    console.log(`[VotePersister] Saving SNAPSHOT for ${data.contestId}`, { size: JSON.stringify(data.snapshot).length });
    // Save snapshot to durable store (Redis/Object Storage/Postgres)
  } else {
    // eslint-disable-next-line no-console
    console.warn('[VotePersister] Unknown job type', name);
  }
}
