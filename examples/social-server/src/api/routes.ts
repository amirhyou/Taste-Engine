import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { ContestCoordinator } from '../coordinator/ContestCoordinator';
import { RedisDispatcher, HttpError } from '../dispatch/RedisDispatcher';

export const app = new Hono();
export const coordinator = new ContestCoordinator();
const dispatcher = new RedisDispatcher(coordinator);

const CreateContestSchema = z.object({
  id: z.string().optional(),
  items: z.array(z.string()),
});

const VoteSchema = z.object({
  userId: z.string(),
  pair: z.tuple([z.string(), z.string()]),
  choice: z.number(),
});

const NextQuerySchema = z.object({
  userId: z.string(),
});

app.post('/contests', zValidator('json', CreateContestSchema), (c) => {
  const body = c.req.valid('json');
  const id = body.id ?? `contest-${Date.now()}`;
  coordinator.createContest(id, body.items);
  return c.json({ contestId: id });
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

export default app;
