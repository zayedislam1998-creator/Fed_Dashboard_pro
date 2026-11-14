import { queueAdminSubmission, queueWorkspaceMail } from '../mail/workspaceMailAutomation';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { Express } from 'express';
import { requireAuth, type AuthenticatedUserContext } from '../auth/sessionAuth';
import { hasActionCapability, recordAuditEvent } from '../auth/policy';
import { isStagingMemoryMode, prisma } from '../db/prisma';
import { asyncHandler } from '../realtime';

const shareTypes: Record<string, string> = { docs: 'DOC', forms: 'FORM', slides: 'SLIDE', files: 'FILE' };
const states = ['ACTIVE', 'DRAFT', 'PAST'];
const tabs = ['ALL', ...states];
const memberSources: Record<string, string> = {
  cmh_tasks: 'cmh_tasks', cmh_projects: 'cmh_projects', docs: 'docs', slides: 'slides',
  forms: 'forms', posts: 'posts', files: 'files', folders: 'files', chat: 'chat',
  members: 'teams', team_groups: 'teams', resume: 'profile', corporate: 'profile',
};

function assignment(userId: Prisma.Sql) {
  return Prisma.sql`(
    EXISTS (SELECT 1 FROM cmh_tasks t WHERE f.source_type = 'cmh_tasks' AND t.id = f.source_id AND (
      EXISTS (SELECT 1 FROM task_assignments a WHERE a.task_id = t.id AND a.user_id = ${userId})
      OR EXISTS (SELECT 1 FROM workspace_users u JOIN workspace_members m
        ON m.id = u.member_id OR (u.member_id IS NULL AND lower(m.email) = lower(u.email))
        WHERE u.id = ${userId} AND (
          t.assigned_member_ids_json ? m.id OR t.assigned_team_ids_json ? m.team_id
        ))
      OR EXISTS (SELECT 1 FROM project_permission_grants g
        WHERE g.project_id = t.project_id AND g.user_id = ${userId} AND g.actions_json ? 'project.manage_tasks')
    ))
    OR EXISTS (SELECT 1 FROM cmh_projects p WHERE f.source_type = 'cmh_projects' AND p.id = f.source_id AND (
      EXISTS (SELECT 1 FROM project_permission_grants g WHERE g.project_id = p.id AND g.user_id = ${userId})
      OR EXISTS (SELECT 1 FROM workspace_users u JOIN workspace_members m
        ON m.id = u.member_id OR (u.member_id IS NULL AND lower(m.email) = lower(u.email))
        WHERE u.id = ${userId} AND (
          p.assigned_member_ids_json ? m.id OR p.assigned_team_ids_json ? m.team_id
        ))
    ))
  )`;
}

function scope(auth: AuthenticatedUserContext) {
  const id = auth.user.id;
  const owned = Prisma.sql`f.owner_user_id = ${id}`;
  if (auth.capabilities.isAdmin) {
    return Prisma.sql`(${owned} OR f.lifecycle <> 'DRAFT' OR ${auth.user.role === 'OWNER'})`;
  }
  const types = Object.entries(memberSources)
    .filter(([, module]) => auth.capabilities.allowedModules.includes(module))
    .map(([type]) => type);
  if (!types.length) return Prisma.sql`FALSE`;
  return Prisma.sql`f.source_type IN (${Prisma.join(types)}) AND
    (${owned} OR (f.lifecycle <> 'DRAFT' AND f.removed_at IS NULL AND (
      ${assignment(Prisma.sql`${id}`)}
      OR EXISTS (SELECT 1 FROM resource_shares s WHERE s.target_user_id = ${id}
        AND s.resource_id = f.source_id AND s.resource_type = CASE f.source_type
          WHEN 'docs' THEN 'DOC' WHEN 'forms' THEN 'FORM' WHEN 'slides' THEN 'SLIDE' WHEN 'files' THEN 'FILE' END)
      OR EXISTS (SELECT 1 FROM workspace_files x WHERE f.source_type = 'files' AND x.id = f.source_id
        AND x.deleted_at IS NULL AND x.visibility = 'WORKSPACE')
      OR EXISTS (SELECT 1 FROM workspace_posts_notices p WHERE f.source_type = 'posts' AND p.id = f.source_id
        AND p.status = 'PUBLISHED')
      OR EXISTS (SELECT 1 FROM workspace_chat_channels ch
        JOIN channel_memberships c ON c.channel_id = ch.id
        WHERE f.source_type = 'chat' AND ch.id = f.source_id AND NOT ch.is_workspace_wide
          AND c.user_id = ${id})
    )))`;
}

function normalizedDate(value: unknown) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value ? value : null;
}

type FeedRow = {
  id: string; sourceType: string; sourceId: string; title: string; createdAt: Date;
  cursorTime: string; day: string; lifecycle: string; dueDate: string | null;
  ownerUserId: string | null; creator: string | null; removed: boolean;
  status: string | null; progress: number | null; seenAt: Date | null; reason: string | null;
  assigned: boolean;
};

let cachedFeedTimezone = 'Asia/Dhaka';
let cachedFeedTimezoneExpires = 0;

async function getWorkspaceFeedTimezone(): Promise<string> {
  const now = Date.now();
  if (now < cachedFeedTimezoneExpires) {
    return cachedFeedTimezone;
  }
  try {
    const settings = await prisma.workspaceSystemSetting.findUnique({
      where: { id: 'default' },
      select: { timezone: true },
    });
    if (settings?.timezone) {
      try {
        new Intl.DateTimeFormat('en', { timeZone: settings.timezone });
        cachedFeedTimezone = settings.timezone;
      } catch {
        cachedFeedTimezone = 'Asia/Dhaka';
      }
    }
  } catch {
    // fallback
  }
  cachedFeedTimezoneExpires = now + 60_000;
  return cachedFeedTimezone;
}

export function registerWorkspaceFeedRoutes(app: Express) {
  app.use('/api/main-feed', requireAuth, (_req, res, next) => {
    if (isStagingMemoryMode()) {
      res.status(503).json({ error: 'Main Feed requires PostgreSQL with the feed migration installed.' });
      return;
    }
    next();
  });

  app.get('/api/main-feed', asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const userId = auth.user.id;
    const limit = req.query.limit === '6' ? 6 : 8;
    const tab = String(req.query.tab || 'ACTIVE');
    const query = String(req.query.q || '').trim().slice(0, 150);
    const date = normalizedDate(req.query.date);
    const timezone = await getWorkspaceFeedTimezone();
    const localDay = Prisma.sql`(f.created_at AT TIME ZONE ${timezone})::date`;
    const effectiveState = Prisma.sql`(CASE WHEN NOT ${auth.capabilities.isAdmin} AND progress.status = 'APPROVED'
      AND f.lifecycle = 'ACTIVE' THEN 'PAST' ELSE f.lifecycle END)`;
    const conditions = [scope(auth)];
    if (states.includes(tab)) conditions.push(Prisma.sql`${effectiveState} = ${tab}`);
    if (date) conditions.push(Prisma.sql`${localDay} = ${date}::date`);
    if (query) conditions.push(Prisma.sql`(strpos(lower(f.title), lower(${query})) > 0
      OR strpos(lower(COALESCE(u.name, '')), lower(${query})) > 0
      OR strpos(lower(f.source_id), lower(${query})) > 0)`);
    if (req.query.mine === '1') conditions.push(Prisma.sql`f.owner_user_id = ${userId}`);
    if (req.query.assigned === '1') conditions.push(assignment(Prisma.sql`${userId}`));
    if (req.query.overdue === '1') conditions.push(Prisma.sql`${effectiveState} = 'ACTIVE'
      AND f.due_date ~ '^\d{4}-\d{2}-\d{2}$'
      AND f.due_date < to_char(CURRENT_TIMESTAMP AT TIME ZONE ${timezone}, 'YYYY-MM-DD')`);
    const cursor = String(req.query.cursor || '');
    if (cursor) {
      const [day, time, id] = cursor.split('|');
      if (!normalizedDate(day) || !time || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(time)
        || Number.isNaN(Date.parse(time)) || !id || !/^[0-9a-f-]{36}$/.test(id)) {
        res.status(400).json({ error: 'Invalid feed cursor.' });
        return;
      }
      conditions.push(Prisma.sql`(${localDay} < ${day}::date OR
        (${localDay} = ${day}::date AND (f.created_at, f.id) > (${time}::timestamptz, ${id})))`);
    }
    const rows = await prisma.$queryRaw<FeedRow[]>(Prisma.sql`
      SELECT f.id, f.title, f.source_type AS "sourceType", f.source_id AS "sourceId",
        f.created_at AS "createdAt", to_char(f.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "cursorTime",
        ${localDay}::text AS day, ${effectiveState} AS lifecycle, f.due_date AS "dueDate",
        f.owner_user_id AS "ownerUserId", u.name AS creator, f.removed_at IS NOT NULL AS removed,
        progress.status, progress.progress, progress.seen_at AS "seenAt", progress.reason,
        ${assignment(Prisma.sql`${userId}`)} AS assigned
      FROM workspace_feed_items f
      LEFT JOIN workspace_users u ON u.id = f.owner_user_id
      LEFT JOIN workspace_feed_progress progress ON progress.item_id = f.id AND progress.user_id = ${userId}
      WHERE ${Prisma.join(conditions, ' AND ')}
      ORDER BY ${localDay} DESC, f.created_at ASC, f.id ASC LIMIT ${limit + 1}
    `);
    const items = rows.slice(0, limit);
    const last = items.at(-1);
    res.json({ items, timezone, today: new Intl.DateTimeFormat('sv-SE', { timeZone: timezone }).format(new Date()),
      nextCursor: rows.length > limit && last ? [last.day, last.cursorTime, last.id].join('|') : null });
  }));

  app.get('/api/main-feed/preferences', asyncHandler(async (req, res) => {
    const [workspace, personal] = await Promise.all([
      prisma.workspaceFeedPreference.findUnique({ where: { id: 'workspace' } }),
      prisma.workspaceFeedPreference.findUnique({ where: { id: 'user:' + req.auth!.user.id } }),
    ]);
    res.json({ workspace: workspace?.defaultTab || 'ACTIVE', personal: personal?.defaultTab || '' });
  }));

  app.put('/api/main-feed/preferences', asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const { scope: preferenceScope, tab } = req.body || {};
    if (!['workspace', 'personal'].includes(preferenceScope) ||
      !(tabs.includes(tab) || (preferenceScope === 'personal' && tab === ''))) {
      res.status(400).json({ error: 'Invalid feed preference.' });
      return;
    }
    if (preferenceScope === 'workspace' && !auth.capabilities.isAdmin) {
      res.status(403).json({ error: 'Workspace settings require administrator access.' });
      return;
    }
    const id = preferenceScope === 'workspace' ? 'workspace' : 'user:' + auth.user.id;
    await prisma.$transaction(async (tx) => {
      await tx.workspaceFeedPreference.upsert({ where: { id }, create: { id, defaultTab: tab }, update: { defaultTab: tab } });
      if (preferenceScope === 'workspace') await recordAuditEvent({
        actorUserId: auth.user.id, actorEmail: auth.user.email,
        action: 'feed.preferences', summary: 'Changed the workspace feed default tab', details: { tab },
      }, tx);
    });
    res.json({ ok: true });
  }));

  app.get('/api/main-feed/:id', asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const [item] = await prisma.$queryRaw<Array<{ title: string; id: string; lifecycle: string; ownerUserId: string | null; removed: boolean }>>(
      Prisma.sql`SELECT f.id, f.title, f.lifecycle, f.owner_user_id AS "ownerUserId", f.removed_at IS NOT NULL AS removed
        FROM workspace_feed_items f WHERE f.id = ${req.params.id} AND ${scope(auth)}`);
    if (!item) { res.status(404).json({ error: 'Feed item not found.' }); return; }
    const canManage = auth.capabilities.isAdmin || item.ownerUserId === auth.user.id;
    const members = canManage && !item.removed ? await prisma.$queryRaw(Prisma.sql`
      SELECT u.id, u.name, p.seen_at AS "seenAt", COALESCE(p.status, 'PENDING') AS status,
        COALESCE(p.progress, 0) AS progress, p.reason
      FROM workspace_feed_items f JOIN workspace_users u ON u.is_active
      LEFT JOIN workspace_feed_progress p ON p.item_id = f.id AND p.user_id = u.id
      WHERE f.id = ${item.id} AND ${assignment(Prisma.sql`u.id`)}
      ORDER BY u.name, u.id`) : [];
    res.json({ item, canManage, members });
  }));

  app.patch('/api/main-feed/:id', asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const [item] = await prisma.$queryRaw<Array<{ id: string; owner: string | null; assigned: boolean; sourceType: string; sourceId: string; lifecycle: string; title: string }>>(Prisma.sql`
      SELECT f.id, f.owner_user_id AS owner, f.source_type AS "sourceType", f.source_id AS "sourceId", f.lifecycle, f.title, ${assignment(Prisma.sql`${auth.user.id}`)} AS assigned
      FROM workspace_feed_items f WHERE f.id = ${req.params.id} AND f.removed_at IS NULL AND ${scope(auth)}`);
    if (!item) { res.status(404).json({ error: 'Feed item not found.' }); return; }
    const { action, lifecycle, userId, progress, reason } = req.body || {};
    const canManage = auth.capabilities.isAdmin || item.owner === auth.user.id;
    const canSubmit = item.assigned && (item.sourceType !== 'cmh_tasks' ||
      hasActionCapability(auth.capabilities, 'task.submit_own'));
    if (action === 'share' && canManage) {
      const resourceType = shareTypes[item.sourceType];
      const email = typeof req.body.email === 'string' ? req.body.email.trim().slice(0, 254) : '';
      if ((!resourceType && item.sourceType !== 'cmh_tasks' && item.sourceType !== 'cmh_projects') || !email) {
        res.status(400).json({ error: 'Enter a workspace member email for a shareable item.' }); return;
      }
      const target = await prisma.workspaceUser.findFirst({
        where: { isActive: true, email: { equals: email, mode: 'insensitive' } }, select: { id: true, email: true },
      });
      if (!target || target.id === auth.user.id) {
        res.status(404).json({ error: 'An eligible workspace member was not found.' }); return;
      }
      const createdAt = new Date().toISOString();
      await prisma.$transaction(async (tx) => {
        if (resourceType) {
          await tx.resourceShare.upsert({
            where: { resourceType_resourceId_targetUserId: { resourceType, resourceId: item.sourceId, targetUserId: target.id } },
            create: { id: randomUUID(), resourceType, resourceId: item.sourceId, targetUserId: target.id,
              sharedById: auth.user.id, accessLevel: 'VIEW', createdAt },
            update: {},
          });
        } else if (item.sourceType === 'cmh_tasks') {
          await tx.taskAssignment.upsert({
            where: { taskId_userId: { taskId: item.sourceId, userId: target.id } },
            create: { id: randomUUID(), taskId: item.sourceId, userId: target.id, createdAt }, update: {},
          });
        } else {
          await tx.projectPermissionGrant.upsert({
            where: { projectId_userId: { projectId: item.sourceId, userId: target.id } },
            create: { id: randomUUID(), projectId: item.sourceId, userId: target.id,
              projectRole: 'PARTICIPANT', actionsJson: ['project.read_assigned'], grantedById: auth.user.id, createdAt, updatedAt: createdAt }, update: {},
          });
        }
        await queueWorkspaceMail('feed-share:' + item.id, [target.email],
          'Workspace item shared: ' + item.title, 'Sign in to Workspace Pro to open the item in Main Feed.', tx);
        await recordAuditEvent({ actorUserId: auth.user.id, actorEmail: auth.user.email,
          action: 'feed.share', targetType: 'feed', targetId: item.id,
          summary: 'Granted item access from Main Feed', details: { userId: target.id } }, tx);
      });
      res.json({ ok: true }); return;
    }
    if (action === 'lifecycle' && canManage && states.includes(lifecycle)) {
      await prisma.$transaction(async (tx) => {
        await tx.workspaceFeedItem.update({ where: { id: item.id }, data: { lifecycle } });
        await recordAuditEvent({ actorUserId: auth.user.id, actorEmail: auth.user.email,
          action: 'feed.lifecycle', targetType: 'feed', targetId: item.id,
          summary: 'Changed feed lifecycle', details: { lifecycle } }, tx);
      });
      res.json({ ok: true }); return;
    }
    if (action === 'seen' && item.assigned) {
      await prisma.$executeRaw`INSERT INTO workspace_feed_progress (item_id, user_id, seen_at)
        VALUES (${item.id}, ${auth.user.id}, CURRENT_TIMESTAMP) ON CONFLICT (item_id, user_id)
        DO UPDATE SET seen_at = COALESCE(workspace_feed_progress.seen_at, EXCLUDED.seen_at)`;
      res.json({ ok: true }); return;
    }
    if ((action === 'progress' || action === 'submit') && canSubmit && item.lifecycle === 'ACTIVE' && Number.isInteger(progress) && progress >= 0 && progress <= 100) {
      const status = action === 'submit' ? 'SUBMITTED' : 'IN_PROGRESS';
      const value = action === 'submit' ? 100 : progress;
      const changed = await prisma.$transaction(async (tx) => {
        const count = await tx.$executeRaw`INSERT INTO workspace_feed_progress (item_id, user_id, status, progress, seen_at)
        VALUES (${item.id}, ${auth.user.id}, ${status}, ${value}, CURRENT_TIMESTAMP) ON CONFLICT (item_id, user_id)
        DO UPDATE SET status = EXCLUDED.status, progress = EXCLUDED.progress, updated_at = CURRENT_TIMESTAMP
        WHERE workspace_feed_progress.status NOT IN ('APPROVED', 'SUBMITTED')`;
        if (count && action === 'submit') await queueAdminSubmission(
          item.sourceType === 'cmh_projects' ? 'project' : 'task', item.id + ':' + auth.user.id + ':' + randomUUID(), item.title, tx);
        return count;
      });
      if (!changed) { res.status(409).json({ error: 'This work is already submitted or approved.' }); return; }
      res.json({ ok: true }); return;
    }
    if ((action === 'approve' || action === 'request-changes') && canManage && typeof userId === 'string') {
      const cleanReason = typeof reason === 'string' ? reason.trim().slice(0, 1000) : '';
      if (action === 'request-changes' && !cleanReason) { res.status(400).json({ error: 'Enter the changes required.' }); return; }
      const status = action === 'approve' ? 'APPROVED' : 'CHANGES_REQUESTED';
      const changed = await prisma.$transaction(async (tx) => {
        const count = await tx.$executeRaw(Prisma.sql`UPDATE workspace_feed_progress p SET status = ${status},
          reason = ${cleanReason || null}, updated_at = CURRENT_TIMESTAMP FROM workspace_feed_items f
          WHERE f.id = ${item.id} AND p.item_id = f.id AND p.user_id = ${userId}
          AND p.status = 'SUBMITTED' AND ${assignment(Prisma.sql`${userId}`)}`);
        if (count) {
          const recipient = await tx.workspaceUser.findUnique({ where: { id: userId }, select: { email: true } });
          await queueWorkspaceMail('feed-review:' + item.id + ':' + randomUUID(), [recipient?.email],
            (status === 'APPROVED' ? 'Approved: ' : 'Changes requested: ') + item.title,
            'Sign in to Workspace Pro to view the review in Main Feed.', tx);
        }
        if (count) await recordAuditEvent({ actorUserId: auth.user.id, actorEmail: auth.user.email,
          action: 'feed.review', targetType: 'feed', targetId: item.id,
          summary: 'Reviewed assigned work', details: { userId, status } }, tx);
        return count;
      });
      if (!changed) { res.status(409).json({ error: 'No pending submission for that member.' }); return; }
      res.json({ ok: true }); return;
    }
    res.status(403).json({ error: 'This action is unavailable for your access or the current item.' });
  }));
}
