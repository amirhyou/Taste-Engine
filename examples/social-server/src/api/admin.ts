import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { jwt } from 'hono/jwt';
import type { JwtVariables } from 'hono/jwt';
import { hideContest, lockContest } from '../redis/contestMeta';
import { banDevice } from '../redis/moderation';

type Variables = JwtVariables;

const secret = process.env.AUTH_JWT_SECRET;
if (!secret) {
  throw new Error('AUTH_JWT_SECRET is required');
}

const adminApp = new Hono<{ Variables: Variables }>();

adminApp.use('/admin/*', jwt({ secret }));
adminApp.use('/admin/*', async (c, next) => {
  const payload = c.get('jwtPayload');
  if (!payload || payload.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403);
  }
  await next();
});

adminApp.post('/admin/contests/:id/hide', async (c) => {
  const { id } = c.req.param();
  await hideContest(id);
  return c.json({ status: 'hidden' });
});

adminApp.post('/admin/contests/:id/lock', async (c) => {
  const { id } = c.req.param();
  await lockContest(id);
  return c.json({ status: 'locked' });
});

const BanDeviceSchema = z.object({
  deviceId: z.string(),
  ttlSec: z.number().int().positive().optional(),
});

adminApp.post('/admin/devices/ban', zValidator('json', BanDeviceSchema), async (c) => {
  const { deviceId, ttlSec } = c.req.valid('json');
  await banDevice(deviceId, ttlSec);
  return c.json({ status: 'banned' });
});

export { adminApp };
