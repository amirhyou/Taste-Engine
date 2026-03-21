import type { Context, MiddlewareHandler } from 'hono';
import { redis } from '../../redis/client';

export type RateLimitOptions = {
  scope: string;
  limit: number;
  windowSec: number;
  keyFromRequest: (c: Context) => string | undefined;
};

const rateKey = (scope: string, id: string) => `rl:${scope}:${id}`;

export function rateLimit(options: RateLimitOptions): MiddlewareHandler {
  return async (c, next) => {
    const identifier = options.keyFromRequest(c);
    if (!identifier) return next();

    const key = rateKey(options.scope, identifier);
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, options.windowSec);
    }

    const ttl = await redis.ttl(key);
    const remaining = Math.max(options.limit - count, 0);

    c.header('RateLimit-Limit', String(options.limit));
    c.header('RateLimit-Remaining', String(remaining));
    if (ttl >= 0) {
      c.header('RateLimit-Reset', String(ttl));
    }

    if (count > options.limit) {
      if (ttl >= 0) {
        c.header('Retry-After', String(ttl));
      }
      return c.json({ error: 'Too many requests' }, 429);
    }

    await next();
  };
}
