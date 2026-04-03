import IORedis from 'ioredis';

const redisUrl = process.env.REDIS_URL;
if (!redisUrl && process.env.NODE_ENV === 'production') {
  throw new Error('REDIS_URL is required in production');
}

export const redis = new IORedis(redisUrl ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null, // required by BullMQ
});
