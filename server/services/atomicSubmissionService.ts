import { queueAdminSubmission } from '../mail/workspaceMailAutomation';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { isStagingMemoryMode, prisma } from '../db/prisma';

type Submission = Record<string, unknown> & { id: string };

export function createSubmissionId(requestId?: string): string {
  return `cmh-sub-${requestId || randomUUID()}`;
}

function isSerializationConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
}

const stagingLocks = new Map<string, Promise<void>>();

async function withStagingLock<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const previous = stagingLocks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  const queued = previous.then(() => current);
  stagingLocks.set(key, queued);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (stagingLocks.get(key) === queued) stagingLocks.delete(key);
  }
}

async function appendSubmission<T extends { submissionsJson: Prisma.JsonValue }>(
  kind: 'form' | 'task' | 'project',
  targetId: string,
  submission: Submission,
  read: (tx: Prisma.TransactionClient) => Promise<T | null>,
  write: (tx: Prisma.TransactionClient, submissions: Prisma.InputJsonValue) => Promise<T>
) {
  async function append(tx: Prisma.TransactionClient) {
    const row = await read(tx);
    if (!row) throw new Error('Submission target not found.');
    const previous = (Array.isArray(row.submissionsJson) ? row.submissionsJson : []) as unknown as Submission[];
    const existing = previous.find((item) => item?.id === submission.id);
    if (existing) return { updated: row, submission: existing, duplicate: true };

    const updated = await write(tx, [submission, ...previous] as Prisma.InputJsonValue);
    await queueAdminSubmission(kind, submission.id, String(submission.targetTitle || targetId), tx);
    return { updated, submission, duplicate: false };
  }

  if (isStagingMemoryMode()) return withStagingLock(kind + ":" + targetId, () => append(prisma));

  for (let attempt = 1; ; attempt++) {
    try {
      return await prisma.$transaction(append, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (!isSerializationConflict(error) || attempt === 5) throw error;
      await new Promise((resolve) => setTimeout(resolve, 10 * attempt + Math.random() * 10));
    }
  }
}

export function appendFormSubmissionAtomic(id: string, submission: Submission) {
  return appendSubmission(
    'form', id, submission,
    (tx) => tx.cmhFormTemplate.findUnique({ where: { id } }),
    (tx, submissionsJson) => tx.cmhFormTemplate.update({ where: { id }, data: { submissionsJson } })
  );
}

export function appendTaskSubmissionAtomic(id: string, submission: Submission, status?: string) {
  return appendSubmission(
    'task', id, submission,
    (tx) => tx.cmhTask.findUnique({ where: { id } }),
    (tx, submissionsJson) => tx.cmhTask.update({
      where: { id },
      data: { submissionsJson, status, updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
    })
  );
}

export function appendProjectSubmissionAtomic(id: string, submission: Submission, status?: string) {
  return appendSubmission(
    'project', id, submission,
    (tx) => tx.cmhProject.findUnique({ where: { id } }),
    (tx, submissionsJson) => tx.cmhProject.update({
      where: { id },
      data: { submissionsJson, status, updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
    })
  );
}
