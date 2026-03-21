import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { ContestCoordinator } from '../coordinator/ContestCoordinator';
import { RedisDispatcher, HttpError } from '../dispatch/RedisDispatcher';
import {
  createContestMeta,
  getContestMeta,
  listPublishedContests,
  publishContest,
  resolveInvite,
} from '../redis/contestMeta';

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

app.post('/contests', zValidator('json', CreateContestSchema), async (c) => {
  const body = c.req.valid('json');
  const id = body.id ?? `contest-${Date.now()}`;
  coordinator.createContest(id, body.items);
  const { inviteCode } = await createContestMeta({
    id,
    title: body.title,
    description: body.description,
  });
  return c.json({ contestId: id, inviteCode });
});

app.post('/contests/:id/vote', zValidator('json', VoteSchema), async (c) => {
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
});

app.get('/contests/:id/next', zValidator('query', NextQuerySchema), async (c) => {
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
});

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

app.get('/discover', zValidator('query', DiscoverQuerySchema), async (c) => {
  const { limit, offset } = c.req.valid('query');
  const ids = await listPublishedContests(limit ?? 20, offset ?? 0);
  const items = (await Promise.all(ids.map((id) => getContestMeta(id)))).filter(
    (meta): meta is NonNullable<typeof meta> => Boolean(meta),
  );
  return c.json({ items });
});

app.get('/invites/:code', async (c) => {
  const { code } = c.req.param();
  const contestId = await resolveInvite(code);
  if (!contestId) return c.json({ error: 'Invite not found' }, 404);
  const meta = await getContestMeta(contestId);
  if (!meta) return c.json({ error: 'Contest not found' }, 404);
  return c.json(meta);
});

export default app;
