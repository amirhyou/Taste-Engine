import { Hono } from 'hono';
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
  publishContest,
  resolveInvite,
} from '../redis/contestMeta';
import { isDeviceBanned } from '../redis/moderation';
import { bodyLimit } from './middleware/bodyLimit';
import { rateLimit } from './middleware/rateLimit';

export const app = new Hono();
export const coordinator = new ContestCoordinator();
const dispatcher = new RedisDispatcher(coordinator);

const CreateContestSchema = z.object({
  id: z.string().optional(),
  items: z.array(z.string()),
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
    scope: 'create',
    limit: 10,
    windowSec: 60,
    keyFromRequest: (c) => getClientIp(c),
  }),
  zValidator('json', CreateContestSchema),
  async (c) => {
  const body = c.req.valid('json');
  const id = body.id ?? `contest-${Date.now()}`;
  coordinator.createContest(id, body.items);
  const { inviteCode } = await createContestMeta({
    id,
    title: body.title,
    description: body.description,
  });
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
    keyFromRequest: (c) => getClientIp(c) ?? c.req.valid('json').userId,
  }),
  async (c) => {
  const { id } = c.req.param();
  const body = c.req.valid('json');
  try {
    const next = await dispatcher.submitVote(id, body.userId, {
      pair: body.pair,
      choice: body.choice,
    });
    return c.json({ nextPair: next });
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
    keyFromRequest: (c) => getClientIp(c) ?? c.req.valid('query').userId,
  }),
  async (c) => {
  const { id } = c.req.param();
  const { userId } = c.req.valid('query');
  try {
    const next = await dispatcher.getNextPair(id, userId);
    return c.json({ nextPair: next });
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

app.get('/contests/:id', async (c) => {
  const { id } = c.req.param();
  const meta = await getContestMeta(id);
  if (!meta) return c.json({ error: 'Contest not found' }, 404);
  return c.json(meta);
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
