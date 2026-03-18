import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { ContestCoordinator } from '../coordinator/ContestCoordinator';

const app = new Hono();
const coordinator = new ContestCoordinator();

const CreateContestSchema = z.object({
  id: z.string().optional(),
  items: z.array(z.string()),
});

const VoteSchema = z.object({
  userId: z.string().optional(),
  pair: z.tuple([z.string(), z.string()]),
  choice: z.number(),
});

app.post('/contests', zValidator(CreateContestSchema), (c) => {
  const body = c.req.valid('json');
  const id = body.id ?? `contest-${Date.now()}`;
  coordinator.createContest(id, body.items);
  return c.json({ contestId: id });
});

app.post('/contests/:id/vote', zValidator(VoteSchema), (c) => {
  const { id } = c.req.param();
  const body = c.req.valid('json');
  const next = coordinator.submitVote(id, body);
  return c.json({ nextPair: next });
});

app.get('/contests/:id/next', (c) => {
  const { id } = c.req.param();
  const next = coordinator.getNextPair(id);
  return c.json({ nextPair: next });
});

export default app;
