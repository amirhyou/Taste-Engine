import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Context, MiddlewareHandler } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
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

export const app = new Hono();
app.use('*', cors());
export const coordinator = new ContestCoordinator();
const dispatcher = new RedisDispatcher(coordinator);

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

function getClientIp(c: Context) {
  return (
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    c.req.header('x-real-ip') ??
    c.req.raw.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    c.req.raw.headers.get('cf-connecting-ip') ??
    undefined
  );
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
  zValidator('json', CreateContestSchema),
  async (c) => {
  const body = c.req.valid('json');
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
  zValidator('json', VoteSchema),
  rateLimit({
    scope: 'vote',
    limit: 60,
    windowSec: 60,
    keyFromRequest: (c) => getClientIp(c) ?? (c.req.valid as any)('json')?.userId ?? 'unknown',
  }),
  async (c) => {
  const { id } = c.req.param();
  const body = c.req.valid('json');
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
  zValidator('query', NextQuerySchema),
  rateLimit({
    scope: 'next',
    limit: 60,
    windowSec: 60,
    keyFromRequest: (c) => getClientIp(c) ?? (c.req.valid as any)('query')?.userId ?? 'unknown',
  }),
  async (c) => {
  const { id } = c.req.param();
  const { userId } = c.req.valid('query');
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
  zValidator('query', DiscoverQuerySchema),
  rateLimit({
    scope: 'discover',
    limit: 120,
    windowSec: 60,
    keyFromRequest: (c) => getClientIp(c),
  }),
  async (c) => {
    const { limit, offset } = c.req.valid('query');
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
