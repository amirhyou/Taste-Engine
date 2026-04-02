import { randomUUID } from 'node:crypto';
import { redis } from './client';

export type AuditAction =
  | 'contest.hide'
  | 'contest.lock'
  | 'device.ban'
  | 'report.dismiss'
  | 'report.hide';

export type AuditRecord = {
  auditId: string;
  actorAdminId: string;
  action: AuditAction;
  contestId?: string;
  targetType: 'contest' | 'device' | 'report';
  targetId: string;
  reportId?: string;
  createdAt: number;
};

const auditKey = (auditId: string) => `audit:${auditId}`;
const contestAuditsKey = (contestId: string) => `audits:contest:${contestId}`;
const adminAuditsKey = (adminId: string) => `audits:admin:${adminId}`;

export async function writeAuditRecord(input: {
  actorAdminId: string;
  action: AuditAction;
  contestId?: string;
  targetType: AuditRecord['targetType'];
  targetId: string;
  reportId?: string;
  createdAt?: number;
}): Promise<AuditRecord> {
  const createdAt = input.createdAt ?? Date.now();
  const auditId = randomUUID();

  const record: AuditRecord = {
    auditId,
    actorAdminId: input.actorAdminId,
    action: input.action,
    contestId: input.contestId,
    targetType: input.targetType,
    targetId: input.targetId,
    reportId: input.reportId,
    createdAt,
  };

  const pipeline = redis.multi().hset(auditKey(auditId), {
    auditId,
    actorAdminId: record.actorAdminId,
    action: record.action,
    contestId: record.contestId ?? '',
    targetType: record.targetType,
    targetId: record.targetId,
    reportId: record.reportId ?? '',
    createdAt: String(record.createdAt),
  });

  if (record.contestId) {
    pipeline.zadd(contestAuditsKey(record.contestId), createdAt, auditId);
  }

  pipeline.zadd(adminAuditsKey(record.actorAdminId), createdAt, auditId);
  await pipeline.exec();

  return record;
}