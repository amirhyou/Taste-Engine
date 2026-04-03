import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Context, MiddlewareHandler } from 'hono';
import { z } from 'zod';
import { ContestCoordinator } from '../coordinator/ContestCoordinator';
import { RedisDispatcher, HttpError } from '../dispatch/RedisDispatcher';
import { adminApp } from './admin';
import {
  createContestMeta,
  getContestMeta,
  listPublishedContests,
  listContestsByDevice,
  publishContest,
  lockContest,
  unpublishContest,
  resolveInvite,
} from '../redis/contestMeta';
import { isDeviceBanned } from '../redis/moderation';
import { storeTrackMeta, getTrackMeta } from '../redis/trackMeta';
import { bodyLimit } from './middleware/bodyLimit';
import { rateLimit } from './middleware/rateLimit';
import { requestLogger } from './middleware/requestLogger';
import { redis } from '../redis/client';
import { logger, withBindings } from '../observability/logger';
import { createReport } from '../redis/reports';

export const app = new Hono();
app.use('*', cors());
app.use('*', requestLogger);
export const coordinator = new ContestCoordinator();
const dispatcher = new RedisDispatcher(coordinator);

app.onError((err, c) => {
  logger.error({
    err,
    method: c.req.method,
    path: new URL(c.req.url).pathname,
  }, 'request.error');
  return c.json({ error: 'Internal Server Error' }, 500);
});

const TrackMetaSchema = z.object({
  name: z.string(),
  artist: z.string().optional(),
  album: z.string().optional(),
  imageUrl: z.string().optional(),
  previewUrl: z.string().optional(),
});

const CreateContestSchema = z.object({
  id: z.string().optional(),
  items: z.array(z.string()),
  itemMeta: z.record(TrackMetaSchema).optional(),
  title: z.string().optional(),
  description: z.string().optional(),
});

const VoteSchema = z.object({
  userId: z.string(),
  pair: z.tuple([z.string(), z.string()]),
  choice: z.number(),
});

const NextQuerySchema = z.object({
  userId: z.string(),
});

const DiscoverQuerySchema = z.object({
  limit: z.coerce.number().optional(),
  offset: z.coerce.number().optional(),
});

const ReportReasonSchema = z.enum(['spam', 'abuse', 'harassment', 'copyright', 'other']);

const ReportSchema = z.object({
  reason: ReportReasonSchema,
  details: z.string().min(1).max(1000).optional(),
  reporterUserId: z.string().min(1),
});

function getClientIp(c: Context) {
  return (
    // Fly.io injects fly-client-ip from its edge — cannot be spoofed by clients
    c.req.header('fly-client-ip') ??
    // Cloudflare sets cf-connecting-ip — trusted when behind CF proxy
    c.req.header('cf-connecting-ip') ??
    // x-forwarded-for is only trusted when behind a known reverse proxy
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    c.req.header('x-real-ip') ??
    undefined
  );
}

async function rateLimitHit(
  scope: string,
  limit: number,
  windowSec: number,
  key: string,
): Promise<number | undefined | null> {
  const redisKey = `rl:${scope}:${key}`;
  const count = await redis.incr(redisKey);
  if (count === 1) {
    await redis.expire(redisKey, windowSec);
  }
  if (count <= limit) {
    return null;
  }
  const ttl = await redis.ttl(redisKey);
  return ttl >= 0 ? ttl : undefined;
}

async function parseJsonOrRespond<T extends z.ZodTypeAny>(
  c: Context,
  schema: T,
): Promise<{ ok: true; data: z.infer<T> } | { ok: false; response: Response }> {
  const raw = await c.req.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: c.json({ error: 'Invalid request body', issues: parsed.error.issues }, 400),
    };
  }
  return { ok: true, data: parsed.data };
}

function parseQueryOrRespond<T extends z.ZodTypeAny>(
  c: Context,
  schema: T,
): { ok: true; data: z.infer<T> } | { ok: false; response: Response } {
  const parsed = schema.safeParse(c.req.query());
  if (!parsed.success) {
    return {
      ok: false,
      response: c.json({ error: 'Invalid query params', issues: parsed.error.issues }, 400),
    };
  }
  return { ok: true, data: parsed.data };
}

/** Prefer device id for per-device caps; fall back to IP if missing (prefixes avoid key collisions). */
function getDeviceOrIpKey(c: Context) {
  const deviceId = c.req.header('x-device-id')?.trim();
  if (deviceId) return `device:${deviceId}`;
  const ip = getClientIp(c);
  if (ip) return `ip:${ip}`;
  return undefined;
}

const deviceBanGuard: MiddlewareHandler = async (c, next) => {
  const deviceId = c.req.header('x-device-id');
  if (!deviceId) return next();
  if (await isDeviceBanned(deviceId)) {
    return c.json({ error: 'Device banned' }, 403);
  }
  return next();
};

app.use('/contests/*', deviceBanGuard);
app.use('/contests', deviceBanGuard);
app.use('/discover', deviceBanGuard);
app.use('/invites/*', deviceBanGuard);

app.get('/health', async (c) => {
  const startedAt = Date.now();
  try {
    const redisResponse = await redis.ping();
    const durationMs = Date.now() - startedAt;
    return c.json({
      status: 'ok',
      redis: {
        status: redisResponse === 'PONG' ? 'up' : 'degraded',
        response: redisResponse,
      },
      durationMs,
      timestamp: Date.now(),
    }, redisResponse === 'PONG' ? 200 : 503);
  } catch (err) {
    logger.error({ err }, 'health.redis_unavailable');
    return c.json({
      status: 'unavailable',
      redis: {
        status: 'down',
      },
      timestamp: Date.now(),
    }, 503);
  }
});

app.post(
  '/contests/:id/report',
  bodyLimit(),
  async (c) => {
    const { id: contestId } = c.req.param();
    const meta = await getContestMeta(contestId);
    const reportParsed = await parseJsonOrRespond(c, ReportSchema);
    if (!reportParsed.ok) return reportParsed.response;
    const reportBody = reportParsed.data;
    const reportLog = withBindings({ contestId, reporterUserId: reportBody.reporterUserId });
    const reporterKey = reportBody.reporterUserId || getClientIp(c) || 'unknown';

    const burstTtl = await rateLimitHit('report-burst', 3, 60, reporterKey);
    if (burstTtl != null) {
      reportLog.warn('report.throttled');
      return c.json({
        error: 'Too many reports submitted recently',
        code: 'REPORT_THROTTLED',
        retryAfterSec: burstTtl,
      }, 429);
    }

    const windowTtl = await rateLimitHit('report-window', 20, 3_600, reporterKey);
    if (windowTtl != null) {
      reportLog.warn('report.throttled');
      return c.json({
        error: 'Too many reports submitted recently',
        code: 'REPORT_THROTTLED',
        retryAfterSec: windowTtl,
      }, 429);
    }

    if (!meta || meta.status === 'hidden') {
      reportLog.warn('report.rejected');
      return c.json({
        status: 'rejected',
        code: 'CONTEST_NOT_REPORTABLE',
      }, 404);
    }

    const result = await createReport({
      contestId,
      reporterUserId: reportBody.reporterUserId,
      reason: reportBody.reason,
      details: reportBody.details,
    });

    if (result.outcome === 'duplicate') {
      reportLog.info('report.deduped');
      return c.json({
        status: 'duplicate',
        code: 'REPORT_DUPLICATE',
      }, 200);
    }

    withBindings({
      contestId,
      reportId: result.report.reportId,
      reporterUserId: result.report.reporterUserId,
    }).info('report.accepted');

    return c.json({
      status: 'created',
      reportId: result.report.reportId,
    }, 201);
  },
);

app.post(
  '/contests',
  bodyLimit(),
  rateLimit({
    scope: 'create-daily',
    limit: 10,
    windowSec: 86_400,
    keyFromRequest: getDeviceOrIpKey,
  }),
  rateLimit({
    scope: 'create',
    limit: 10,
    windowSec: 60,
    keyFromRequest: (c) => getClientIp(c),
  }),
  async (c) => {
  const parsed = await parseJsonOrRespond(c, CreateContestSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const deviceId = c.req.header('x-device-id');
  const id = body.id ?? `contest-${Date.now()}`;
  coordinator.createContest(id, body.items);
  const { inviteCode } = await createContestMeta({
    id,
    title: body.title,
    description: body.description,
    creatorDeviceId: deviceId,
  });
  if (body.itemMeta) {
    await storeTrackMeta(id, body.itemMeta);
  }
  return c.json({ contestId: id, inviteCode });
  },
);

app.post(
  '/contests/:id/vote',
  bodyLimit(),
  rateLimit({
    scope: 'vote',
    limit: 60,
    windowSec: 60,
    keyFromRequest: (c) => getClientIp(c) ?? (c.req.valid as any)('json')?.userId ?? 'unknown',
  }),
  async (c) => {
  const { id } = c.req.param();
  const parsed = await parseJsonOrRespond(c, VoteSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  try {
    const next = await dispatcher.submitVote(id, body.userId, {
      pair: body.pair,
      choice: body.choice,
    });
    const pairMeta = next
      ? {
          a: await getTrackMeta(id, next.a),
          b: await getTrackMeta(id, next.b),
        }
      : undefined;
    return c.json({ nextPair: next, pairMeta });
  } catch (err) {
    if (err instanceof HttpError) {
      return c.json({ error: err.message }, err.status as 409 | 429);
    }
    throw err;
  }
  },
);

app.get(
  '/contests/:id/next',
  rateLimit({
    scope: 'next',
    limit: 60,
    windowSec: 60,
    keyFromRequest: (c) => getClientIp(c) ?? (c.req.valid as any)('query')?.userId ?? 'unknown',
  }),
  async (c) => {
  const { id } = c.req.param();
  const parsed = parseQueryOrRespond(c, NextQuerySchema);
  if (!parsed.ok) return parsed.response;
  const { userId } = parsed.data;
  try {
    const next = await dispatcher.getNextPair(id, userId);
    const pairMeta = next
      ? {
          a: await getTrackMeta(id, next.a),
          b: await getTrackMeta(id, next.b),
        }
      : undefined;
    return c.json({ nextPair: next, pairMeta });
  } catch (err) {
    if (err instanceof HttpError) {
      return c.json({ error: err.message }, err.status as 429);
    }
    throw err;
  }
  },
);

app.post('/contests/:id/publish', async (c) => {
  const { id } = c.req.param();
  await publishContest(id);
  return c.json({ status: 'published' });
});

app.post('/contests/:id/unpublish', async (c) => {
  const { id } = c.req.param();
  const meta = await getContestMeta(id);
  if (!meta) return c.json({ error: 'Contest not found' }, 404);
  await unpublishContest(id);
  return c.json({ status: 'draft' });
});

app.post('/contests/:id/close', async (c) => {
  const { id } = c.req.param();
  const meta = await getContestMeta(id);
  if (!meta) return c.json({ error: 'Contest not found' }, 404);
  await lockContest(id);
  return c.json({ status: 'locked' });
});

app.get('/contests/:id/results', async (c) => {
  const { id } = c.req.param();
  const meta = await getContestMeta(id);
  if (!meta) return c.json({ error: 'Contest not found' }, 404);
  if (meta.status === 'hidden') return c.json({ error: 'Contest not found' }, 404);
  const ranking = coordinator.getRanking(id);
  const ranked = await Promise.all(
    ranking.map(async (trackId, index) => {
      const track = await getTrackMeta(id, trackId);
      return { rank: index + 1, id: trackId, ...(track ?? { name: trackId }) };
    })
  );
  return c.json({ ranking: ranked, total: ranked.length });
});

app.get('/contests/:id', async (c) => {
  const { id } = c.req.param();
  const meta = await getContestMeta(id);
  if (!meta) return c.json({ error: 'Contest not found' }, 404);
  const deviceId = c.req.header('x-device-id');
  const isOwner = Boolean(deviceId && meta.creatorDeviceId && deviceId === meta.creatorDeviceId);
  return c.json({ ...meta, isOwner });
});

app.get('/my-contests', async (c) => {
  const deviceId = c.req.header('x-device-id');
  if (!deviceId) return c.json({ items: [] });
  const ids = await listContestsByDevice(deviceId);
  const items = (await Promise.all(ids.map((id) => getContestMeta(id)))).filter(
    (meta): meta is NonNullable<Awaited<ReturnType<typeof getContestMeta>>> =>
      meta != null && meta.status !== 'hidden',
  );
  // Sort newest first
  items.sort((a, b) => b.createdAt - a.createdAt);
  return c.json({ items });
});

app.get(
  '/discover',
  rateLimit({
    scope: 'discover',
    limit: 120,
    windowSec: 60,
    keyFromRequest: (c) => getClientIp(c),
  }),
  async (c) => {
    const parsed = parseQueryOrRespond(c, DiscoverQuerySchema);
    if (!parsed.ok) return parsed.response;
    const { limit, offset } = parsed.data;
    const ids = await listPublishedContests(limit ?? 20, offset ?? 0);
    const items = (await Promise.all(ids.map((id) => getContestMeta(id)))).filter(
      (meta): meta is NonNullable<typeof meta> => Boolean(meta),
    );
    return c.json({ items });
  },
);

app.get('/invites/:code', async (c) => {
  const { code } = c.req.param();
  const contestId = await resolveInvite(code);
  if (!contestId) return c.json({ error: 'Invite not found' }, 404);
  const meta = await getContestMeta(contestId);
  if (!meta) return c.json({ error: 'Contest not found' }, 404);
  return c.json(meta);
});

app.route('/', adminApp);

export default app;
