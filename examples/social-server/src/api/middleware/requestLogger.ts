import { randomUUID } from 'node:crypto';
import type { MiddlewareHandler } from 'hono';
import { withBindings } from '../../observability/logger';

function extractContestId(path: string): string | undefined {
  const match = path.match(/^\/contests\/([^/]+)/);
  return match?.[1];
}

function extractUserId(url: URL): string | undefined {
  return url.searchParams.get('userId') ?? undefined;
}

export const requestLogger: MiddlewareHandler = async (c, next) => {
  const requestId = c.req.header('x-request-id')?.trim() || randomUUID();
  const startedAt = Date.now();

  c.header('x-request-id', requestId);

  try {
    await next();
  } finally {
    const durationMs = Date.now() - startedAt;
    const url = new URL(c.req.url);
    const path = url.pathname;
    const requestLog = withBindings({
      requestId,
      method: c.req.method,
      path,
      status: c.res.status,
      durationMs,
      contestId: extractContestId(path),
      userId: extractUserId(url) ?? c.req.header('x-user-id')?.trim(),
    });
    requestLog.info('request.complete');
  }
};