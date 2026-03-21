import type { MiddlewareHandler } from 'hono';

const DEFAULT_MAX_BYTES = 50 * 1024;

export function bodyLimit(maxBytes: number = DEFAULT_MAX_BYTES): MiddlewareHandler {
  return async (c, next) => {
    const contentLength = c.req.header('content-length');
    if (contentLength) {
      const size = Number(contentLength);
      if (Number.isFinite(size) && size > maxBytes) {
        return c.json({ error: 'Payload too large' }, 413);
      }
    } else {
      const cloned = c.req.raw.clone();
      const text = await cloned.text();
      const size = new TextEncoder().encode(text).length;
      if (size > maxBytes) {
        return c.json({ error: 'Payload too large' }, 413);
      }
    }

    await next();
  };
}
