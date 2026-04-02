import { randomUUID } from 'node:crypto';
import { redis } from './client';

export const REPORT_STATUS = {
  pending: 'pending',
  dismissed: 'dismissed',
  hidden: 'hidden',
} as const;

export type ReportStatus = (typeof REPORT_STATUS)[keyof typeof REPORT_STATUS];

export type ReportReason = 'spam' | 'abuse' | 'harassment' | 'copyright' | 'other';

export type ReportRecord = {
  reportId: string;
  contestId: string;
  reporterUserId: string;
  reason: ReportReason;
  details?: string;
  createdAt: number;
  status: ReportStatus;
  actionByAdminId?: string;
  actionAt?: number;
  actionType?: 'dismiss' | 'hide';
};

export type CreateReportInput = {
  contestId: string;
  reporterUserId: string;
  reason: ReportReason;
  details?: string;
};

const reportKey = (reportId: string) => `report:${reportId}`;
const pendingKey = () => 'reports:pending';
const contestIndexKey = (contestId: string) => `reports:contest:${contestId}`;
const reporterIndexKey = (reporterUserId: string) => `reports:by-reporter:${reporterUserId}`;
export const dedupeKey = (contestId: string, reporterUserId: string) =>
  `report:dedupe:${contestId}:${reporterUserId}`;

function toOptionalString(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.length > 0 ? value : undefined;
}

function toOptionalNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toRecord(value: Record<string, string>): ReportRecord {
  return {
    reportId: value.reportId,
    contestId: value.contestId,
    reporterUserId: value.reporterUserId,
    reason: value.reason as ReportReason,
    details: toOptionalString(value.details),
    createdAt: Number(value.createdAt ?? 0),
    status: (value.status as ReportStatus) ?? REPORT_STATUS.pending,
    actionByAdminId: toOptionalString(value.actionByAdminId),
    actionAt: toOptionalNumber(value.actionAt),
    actionType: toOptionalString(value.actionType) as ReportRecord['actionType'],
  };
}

export async function createReport(
  input: CreateReportInput,
  options?: { dedupeTtlSec?: number },
): Promise<{ outcome: 'created'; report: ReportRecord } | { outcome: 'duplicate' }> {
  const dedupeTtlSec = Math.max(1, options?.dedupeTtlSec ?? 3_600);
  const dedupeSet = await redis.set(
    dedupeKey(input.contestId, input.reporterUserId),
    '1',
    'EX',
    dedupeTtlSec,
    'NX',
  );

  if (dedupeSet !== 'OK') {
    return { outcome: 'duplicate' };
  }

  const now = Date.now();
  const reportId = randomUUID();
  const report: ReportRecord = {
    reportId,
    contestId: input.contestId,
    reporterUserId: input.reporterUserId,
    reason: input.reason,
    details: input.details,
    createdAt: now,
    status: REPORT_STATUS.pending,
  };

  await redis.multi()
    .hset(reportKey(reportId), {
      reportId,
      contestId: input.contestId,
      reporterUserId: input.reporterUserId,
      reason: input.reason,
      details: input.details ?? '',
      createdAt: String(now),
      status: REPORT_STATUS.pending,
      actionByAdminId: '',
      actionAt: '',
      actionType: '',
    })
    .zadd(pendingKey(), now, reportId)
    .zadd(contestIndexKey(input.contestId), now, reportId)
    .zadd(reporterIndexKey(input.reporterUserId), now, reportId)
    .exec();

  return { outcome: 'created', report };
}

export async function getReport(reportId: string): Promise<ReportRecord | null> {
  const data = await redis.hgetall(reportKey(reportId));
  if (!data || Object.keys(data).length === 0) {
    return null;
  }
  return toRecord(data);
}

export async function listPendingReports(limit: number, offset: number): Promise<ReportRecord[]> {
  const safeLimit = Math.max(1, Math.min(limit, 100));
  const safeOffset = Math.max(0, offset);
  const reportIds = await redis.zrange(
    pendingKey(),
    safeOffset,
    safeOffset + safeLimit - 1,
  );
  const reports = await Promise.all(reportIds.map((reportId) => getReport(reportId)));
  return reports.filter((report): report is ReportRecord => report != null);
}

export async function updateReportStatus(
  reportId: string,
  input: {
    status: Exclude<ReportStatus, 'pending'>;
    actionByAdminId: string;
    actionType: 'dismiss' | 'hide';
    actionAt?: number;
  },
): Promise<ReportRecord | null> {
  const existing = await getReport(reportId);
  if (!existing) {
    return null;
  }

  const actionAt = input.actionAt ?? Date.now();

  await redis.multi()
    .hset(reportKey(reportId), {
      status: input.status,
      actionByAdminId: input.actionByAdminId,
      actionType: input.actionType,
      actionAt: String(actionAt),
    })
    .zrem(pendingKey(), reportId)
    .exec();

  return {
    ...existing,
    status: input.status,
    actionByAdminId: input.actionByAdminId,
    actionType: input.actionType,
    actionAt,
  };
}