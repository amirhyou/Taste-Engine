import { Hono } from 'hono';
import { z } from 'zod';
import type { Context } from 'hono';
import { jwt } from 'hono/jwt';
import type { JwtVariables } from 'hono/jwt';
import { hideContest, lockContest } from '../redis/contestMeta';
import { banDevice } from '../redis/moderation';
import { writeAuditRecord } from '../redis/audit';
import { getReport, listPendingReports, REPORT_STATUS, updateReportStatus } from '../redis/reports';

type Variables = JwtVariables;

const secret = process.env.AUTH_JWT_SECRET;
if (!secret) {
  throw new Error('AUTH_JWT_SECRET is required');
}

const adminApp = new Hono<{ Variables: Variables }>();

const ListReportsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

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

function getAdminId(c: Context): string {
  const payload = c.get('jwtPayload') as Record<string, unknown> | undefined;
  const candidate = payload?.sub ?? payload?.userId ?? payload?.id;
  return typeof candidate === 'string' && candidate.length > 0 ? candidate : 'unknown-admin';
}

adminApp.use('/admin/*', jwt({ secret, alg: 'HS256' }));
adminApp.use('/admin/*', async (c, next) => {
  const payload = c.get('jwtPayload');
  if (!payload || payload.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403);
  }
  await next();
});

adminApp.post('/admin/contests/:id/hide', async (c) => {
  const { id } = c.req.param();
  const adminId = getAdminId(c);
  await hideContest(id);
  await writeAuditRecord({
    actorAdminId: adminId,
    action: 'contest.hide',
    contestId: id,
    targetType: 'contest',
    targetId: id,
  });
  return c.json({ status: 'hidden' });
});

adminApp.post('/admin/contests/:id/lock', async (c) => {
  const { id } = c.req.param();
  const adminId = getAdminId(c);
  await lockContest(id);
  await writeAuditRecord({
    actorAdminId: adminId,
    action: 'contest.lock',
    contestId: id,
    targetType: 'contest',
    targetId: id,
  });
  return c.json({ status: 'locked' });
});

const BanDeviceSchema = z.object({
  deviceId: z.string(),
  ttlSec: z.number().int().positive().optional(),
});

adminApp.post('/admin/devices/ban', async (c) => {
  const parsed = await parseJsonOrRespond(c, BanDeviceSchema);
  if (!parsed.ok) return parsed.response;
  const { deviceId, ttlSec } = parsed.data;
  const adminId = getAdminId(c);
  await banDevice(deviceId, ttlSec);
  await writeAuditRecord({
    actorAdminId: adminId,
    action: 'device.ban',
    targetType: 'device',
    targetId: deviceId,
  });
  return c.json({ status: 'banned' });
});

adminApp.get('/admin/reports', async (c) => {
  const parsed = parseQueryOrRespond(c, ListReportsQuerySchema);
  if (!parsed.ok) return parsed.response;
  const { limit, offset } = parsed.data;
  const items = await listPendingReports(limit ?? 50, offset ?? 0);
  return c.json({ items, total: items.length });
});

adminApp.post('/admin/reports/:id/dismiss', async (c) => {
  const { id } = c.req.param();
  const adminId = getAdminId(c);
  const updated = await updateReportStatus(id, {
    status: REPORT_STATUS.dismissed,
    actionByAdminId: adminId,
    actionType: 'dismiss',
  });

  if (!updated) {
    return c.json({ error: 'Report not found' }, 404);
  }

  await writeAuditRecord({
    actorAdminId: adminId,
    action: 'report.dismiss',
    contestId: updated.contestId,
    targetType: 'report',
    targetId: updated.reportId,
    reportId: updated.reportId,
  });

  return c.json({
    status: 'dismissed',
    reportId: updated.reportId,
    contestId: updated.contestId,
  });
});

adminApp.post('/admin/reports/:id/hide', async (c) => {
  const { id } = c.req.param();
  const adminId = getAdminId(c);
  const report = await getReport(id);

  if (!report) {
    return c.json({ error: 'Report not found' }, 404);
  }

  await hideContest(report.contestId);

  const updated = await updateReportStatus(id, {
    status: REPORT_STATUS.hidden,
    actionByAdminId: adminId,
    actionType: 'hide',
  });

  if (!updated) {
    return c.json({ error: 'Report not found' }, 404);
  }

  await writeAuditRecord({
    actorAdminId: adminId,
    action: 'report.hide',
    contestId: updated.contestId,
    targetType: 'report',
    targetId: updated.reportId,
    reportId: updated.reportId,
  });

  return c.json({
    status: 'hidden',
    reportId: updated.reportId,
    contestId: updated.contestId,
  });
});

export { adminApp };
