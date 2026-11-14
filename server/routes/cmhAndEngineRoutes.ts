import { queueAdminMail, queueDirectoryAssignments } from '../mail/workspaceMailAutomation';
import express from 'express';
import { prisma } from '../db/prisma';
import { ensureWorkspaceBootstrap, getPrimaryAdminIdentity } from '../db/initEngine';
import {
  toCmhFormDto,
  toCmhProjectDto,
  toCmhRulesDto,
  toCmhTaskDto,
  toMailMessageDto,
  toWorkspaceMemberDto,
  toWorkspaceTeamGroupDto,
} from '../db/mappers';
import {
  deleteEngineRecordInDb,
  isEngineCollection,
  listEngineRecords,
  saveEngineRecordInDb,
} from '../db/enginesRepo';
import { requireAdmin, requireAuth } from '../auth/sessionAuth';
import {
  asyncHandler,
  broadcastRealtimeEvent,
  recordAndBroadcastNotification,
} from '../realtime';
import {
  appendFormSubmissionAtomic,
  appendProjectSubmissionAtomic,
  appendTaskSubmissionAtomic,
  createSubmissionId,
} from '../services/atomicSubmissionService';

async function triggerCmhActivityAndAdminMail(params: {
  activityType: 'FORM_SUBMIT' | 'TASK_ACTIVITY' | 'PROJECT_ACTIVITY' | 'MEMBER_ACTIVITY';
  module: 'cmh_tasks' | 'cmh_projects' | 'cmh_forms';
  targetId: string;
  isSubmission?: boolean;
  title: string;
  description: string;
  actorName: string;
  actorEmail: string;
  shareUrl?: string;
  detailsMap?: Record<string, any>;
}) {
  await ensureWorkspaceBootstrap();
  const [rules, primaryServerAcc, adminIdentity, workspaceSettings] = await Promise.all([
    prisma.cmhNotificationRule.findUnique({ where: { id: 'cmh-rules-default' } }),
    prisma.workspaceMailAutomation.findUnique({ where: { id: 'default' } }).then((config) =>
      config?.accountId ? prisma.serverMailAccount.findUnique({ where: { id: config.accountId } }) : null),
    getPrimaryAdminIdentity(),
    prisma.workspaceSystemSetting.findUnique({ where: { id: 'default' } }),
  ]);

  if (!rules) return;

  const shouldNotify =
    (params.activityType === 'FORM_SUBMIT' && rules.notifyOnFormSubmit) ||
    (params.activityType === 'TASK_ACTIVITY' && rules.notifyOnTaskActivity) ||
    (params.activityType === 'PROJECT_ACTIVITY' && rules.notifyOnProjectActivity) ||
    (params.activityType === 'MEMBER_ACTIVITY' && rules.notifyOnMemberActivity);

  if (!shouldNotify) return;

  await recordAndBroadcastNotification({
    type: 'cmh_activity',
    title: params.title,
    description: params.description,
    module: params.module,
    targetId: params.targetId,
  });

  const adminRecipientEmail =
    workspaceSettings?.adminEmail?.trim() || adminIdentity.email;

  const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
  const detailsRowsHtml = Object.entries(params.detailsMap || {})
    .map(
      ([k, v]) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;font-weight:600;color:#475569;width:38%;">${escape(k)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#0f172a;">${
          escape(Array.isArray(v) ? v.join(', ') : String(v ?? '—'))
        }</td>
      </tr>`
    )
    .join('');

  const detailsLinesText = Object.entries(params.detailsMap || {})
    .map(([k, v]) => `• ${escape(k)}: ${Array.isArray(v) ? v.join(', ') : String(v ?? '—')}`)
    .join('\n');

  const emailSubject = `[CMH Real-Time Alert] ${escape(params.title)}`;
  const emailHtml = `
    <div style="font-family:'Plus Jakarta Sans',sans-serif;max-width:620px;margin:0 auto;padding:20px;border:1px solid #e2e8f0;border-radius:14px;background:#ffffff;">
      <div style="font-size:11px;font-weight:700;color:#0B57D0;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">
        CMH App · Real-Time Admin Notification & Mail
      </div>
      <h2 style="margin:0 0 8px 0;font-size:18px;color:#0f172a;">${escape(params.title)}</h2>
      <p style="margin:0 0 16px 0;font-size:13px;color:#475569;line-height:1.6;">
        ${escape(params.description)}
      </p>
      <div style="margin-bottom:14px;padding:10px 14px;background:#f8fafc;border-radius:10px;font-size:12px;color:#334155;">
        <strong>Submitted / Updated By:</strong> ${escape(params.actorName)} (${escape(params.actorEmail)})<br/>
        <strong>Time:</strong> ${new Date().toLocaleString()}
      </div>
      ${
        detailsRowsHtml
          ? `<table style="width:100%;border-collapse:collapse;margin-bottom:16px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
              <tbody>${detailsRowsHtml}</tbody>
            </table>`
          : ''
      }
      ${
        params.shareUrl
          ? `<div style="margin-top:16px;">
              <a href="${escape(params.shareUrl)}" target="_blank" style="display:inline-block;padding:10px 18px;background:#0B57D0;color:#ffffff;text-decoration:none;border-radius:8px;font-size:12px;font-weight:600;">
                Open Item Link →
              </a>
            </div>`
          : ''
      }
    </div>
  `;
  const emailText = `${params.title}\n\n${params.description}\n\nBy: ${params.actorName} (${params.actorEmail})\n\n${detailsLinesText}${
    params.shareUrl ? `\n\nLink: ${params.shareUrl}` : ''
  }`;

  if (rules.injectIntoPrimaryInbox) {
    const nowMs = Date.now();
    const inboxRow = await prisma.mailMessage.create({
      data: {
        id: `cmh-mail-${nowMs}-${Math.random().toString(36).slice(2, 6)}`,
        accountId: primaryServerAcc ? primaryServerAcc.id : 'admin-primary',
        folder: 'inbox',
        threadId: `thread-cmh-${nowMs}`,
        subject: emailSubject,
        fromName: `${params.actorName} (via CMH App)`,
        fromEmail: params.actorEmail || adminIdentity.email,
        toEmail: adminRecipientEmail,
        dateStr: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestampMs: BigInt(nowMs),
        snippet: `${params.description} — ${detailsLinesText.slice(0, 120)}`,
        bodyHtml: emailHtml,
        bodyText: emailText,
        isUnread: true,
        isStarred: true,
      },
    });

    const inboxDto = toMailMessageDto(inboxRow);
    const admins = await prisma.workspaceUser.findMany({
      where: { isActive: true, role: { in: ['OWNER', 'ADMIN'] } }, select: { id: true },
    });
    const recipients = admins.map((admin) => admin.id);
    if (recipients.length && primaryServerAcc) {
      broadcastRealtimeEvent('mail:arrived', { accountId: primaryServerAcc.id, message: inboxDto }, recipients);
    }
    if (recipients.length) broadcastRealtimeEvent('cmh:admin_mail', { message: inboxDto }, recipients);
  }

  if (rules.autoSendAdminEmail && !params.isSubmission) {
    await queueAdminMail('cmh-created:' + params.module + ':' + params.targetId,
      params.title, 'A workspace item was created or updated. Sign in to Workspace Pro to review it.');
  }
}

export function registerCmhAndEngineRoutes(app: express.Express) {
  app.use('/api/cmh/bootstrap', requireAuth, requireAdmin);
  app.use('/api/cmh/forms', requireAuth, requireAdmin);
  app.use('/api/cmh/tasks', requireAuth, requireAdmin);
  app.use('/api/cmh/projects', requireAuth, requireAdmin);
  app.use('/api/cmh/rules', requireAuth, requireAdmin);
  app.use('/api/cmh/invite', requireAuth, requireAdmin);
  app.use('/api/engines', requireAuth, requireAdmin);

  // ============================================================================
  // CMH SUITE ROUTES (/api/cmh/*)
  // ============================================================================

  app.get(
    '/api/cmh/bootstrap',
    asyncHandler(async (_req, res) => {
      await ensureWorkspaceBootstrap();
      const [forms, tasks, projects, rules, members, teamGroups, adminMails] = await Promise.all([
        prisma.cmhFormTemplate.findMany({ orderBy: { timestampMs: 'desc' } }),
        prisma.cmhTask.findMany({ orderBy: { timestampMs: 'desc' } }),
        prisma.cmhProject.findMany({ orderBy: { timestampMs: 'desc' } }),
        prisma.cmhNotificationRule.findUnique({ where: { id: 'cmh-rules-default' } }),
        prisma.workspaceMember.findMany({ orderBy: { timestampMs: 'desc' } }),
        prisma.workspaceTeamGroup.findMany({ orderBy: { timestampMs: 'asc' } }),
        prisma.mailMessage.findMany({
          where: { id: { startsWith: 'cmh-mail-' } },
          orderBy: { timestampMs: 'desc' },
          take: 30,
        }),
      ]);

      res.json({
        forms: forms.map(toCmhFormDto),
        tasks: tasks.map(toCmhTaskDto),
        projects: projects.map(toCmhProjectDto),
        rules: rules ? toCmhRulesDto(rules) : undefined,
        members: members.map(toWorkspaceMemberDto),
        teamGroups: teamGroups.map(toWorkspaceTeamGroupDto),
        adminInboxMessages: adminMails.map(toMailMessageDto),
      });
    })
  );

  app.post(
    '/api/cmh/forms',
    asyncHandler(async (req, res) => {
      const {
        id,
        title,
        description,
        formCategory,
        accessMode,
        invitedMemberIds,
        invitedTeamIds,
        submitButtonLabel,
        confirmationMessage,
        fields,
      } = req.body || {};

      if (!title || !String(title).trim()) {
        res.status(400).json({ error: 'Form title is required.' });
        return;
      }

      const existing = id
        ? await prisma.cmhFormTemplate.findUnique({ where: { id: String(id) } })
        : null;
      const formId =
        existing?.id || `cmh-form-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;

      const sanitizedFields = Array.isArray(fields)
        ? fields.map((fld: any, idx: number) => ({
            id: fld.id || `cmh-fld-${Date.now()}-${idx}`,
            label: String(fld.label || `Field ${idx + 1}`).trim(),
            type: fld.type || 'SHORT_TEXT',
            placeholder: fld.placeholder ? String(fld.placeholder) : undefined,
            helpText: fld.helpText ? String(fld.helpText) : undefined,
            required: Boolean(fld.required),
            width: fld.width === 'half' ? 'half' : 'full',
            options: Array.isArray(fld.options)
              ? fld.options.map((o: any) => String(o).trim()).filter(Boolean)
              : undefined,
            defaultCountryCode: fld.defaultCountryCode || '+880',
            defaultCountry: fld.defaultCountry || 'Bangladesh',
          }))
        : [];

      const nowDate = new Date().toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const savedRow = await prisma.cmhFormTemplate.upsert({
        where: { id: formId },
        update: {
          title: String(title).trim(),
          description: String(description || '').trim(),
          formCategory: formCategory || existing?.formCategory || 'GENERAL',
          accessMode: accessMode === 'PRIVATE' ? 'PRIVATE' : 'PUBLIC',
          invitedMemberIdsJson: Array.isArray(invitedMemberIds)
            ? invitedMemberIds
            : (existing?.invitedMemberIdsJson ?? []),
          invitedTeamIdsJson: Array.isArray(invitedTeamIds)
            ? invitedTeamIds
            : (existing?.invitedTeamIdsJson ?? []),
          submitButtonLabel: String(submitButtonLabel || 'Submit').trim(),
          confirmationMessage: String(
            confirmationMessage || 'Thank you! Your response has been recorded.'
          ).trim(),
          fieldsJson: sanitizedFields,
          updatedAt: nowTime,
          timestampMs: BigInt(Date.now()),
        },
        create: {
          id: formId,
          title: String(title).trim(),
          description: String(description || '').trim(),
          formCategory: formCategory || 'GENERAL',
          accessMode: accessMode === 'PRIVATE' ? 'PRIVATE' : 'PUBLIC',
          invitedMemberIdsJson: Array.isArray(invitedMemberIds) ? invitedMemberIds : [],
          invitedTeamIdsJson: Array.isArray(invitedTeamIds) ? invitedTeamIds : [],
          submitButtonLabel: String(submitButtonLabel || 'Submit').trim(),
          confirmationMessage: String(
            confirmationMessage || 'Thank you! Your response has been recorded.'
          ).trim(),
          fieldsJson: sanitizedFields,
          submissionsJson: [],
          createdAt: nowDate,
          updatedAt: 'Just now',
          timestampMs: BigInt(Date.now()),
        },
      });

      const savedDto = toCmhFormDto(savedRow);
      broadcastRealtimeEvent('cmh:updated', { type: 'form', item: savedDto });
      const allForms = await prisma.cmhFormTemplate.findMany({ orderBy: { timestampMs: 'desc' } });
      res.json({ form: savedDto, forms: allForms.map(toCmhFormDto) });
    })
  );

  app.delete(
    '/api/cmh/forms/:id',
    asyncHandler(async (req, res) => {
      await prisma.cmhFormTemplate.deleteMany({ where: { id: req.params.id } });
      const allForms = await prisma.cmhFormTemplate.findMany({ orderBy: { timestampMs: 'desc' } });
      res.json({ forms: allForms.map(toCmhFormDto) });
    })
  );

  app.post(
    '/api/cmh/tasks',
    asyncHandler(async (req, res) => {
      await ensureWorkspaceBootstrap();
      const {
        id,
        title,
        description,
        formTemplateId,
        status,
        priority,
        dueDate,
        accessMode,
        assignedMemberIds,
        assignedTeamIds,
        customFieldValues,
        originUrl,
      } = req.body || {};

      if (!title || !String(title).trim()) {
        res.status(400).json({ error: 'Task title is required.' });
        return;
      }

      const [matchedTemplate, existing, adminIdentity, rules] = await Promise.all([
        formTemplateId
          ? prisma.cmhFormTemplate.findUnique({ where: { id: String(formTemplateId) } })
          : prisma.cmhFormTemplate.findFirst({ orderBy: { timestampMs: 'desc' } }),
        id ? prisma.cmhTask.findUnique({ where: { id: String(id) } }) : null,
        getPrimaryAdminIdentity(),
        prisma.cmhNotificationRule.findUnique({ where: { id: 'cmh-rules-default' } }),
      ]);

      const isNew = !existing;
      const taskId =
        existing?.id || `cmh-task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
      const nowDate = new Date().toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const savedRow = await prisma.$transaction(async (tx) => {
        const saved = await tx.cmhTask.upsert({
          where: { id: taskId },
          update: {
            title: String(title).trim(),
            description: String(description || '').trim(),
            formTemplateId: matchedTemplate?.id || 'cmh-form-task-standard',
            formTemplateTitle: matchedTemplate?.title || 'Standard Task Form',
            status: status || existing?.status || 'To Do',
            priority: priority || existing?.priority || 'Medium',
            dueDate: String(dueDate ?? existing?.dueDate ?? ''),
            accessMode: accessMode === 'PRIVATE' ? 'PRIVATE' : 'PUBLIC',
            assignedMemberIdsJson: Array.isArray(assignedMemberIds)
              ? assignedMemberIds
              : (existing?.assignedMemberIdsJson ?? []),
            assignedTeamIdsJson: Array.isArray(assignedTeamIds)
              ? assignedTeamIds
              : (existing?.assignedTeamIdsJson ?? []),
            customFieldValuesJson: customFieldValues ?? existing?.customFieldValuesJson ?? {},
            updatedAt: nowTime,
            timestampMs: BigInt(Date.now()),
          },
          create: {
            id: taskId,
            title: String(title).trim(),
            description: String(description || '').trim(),
            formTemplateId: matchedTemplate?.id || 'cmh-form-task-standard',
            formTemplateTitle: matchedTemplate?.title || 'Standard Task Form',
            status: status || 'To Do',
            priority: priority || 'Medium',
            dueDate: String(dueDate || 'Upcoming'),
            accessMode: accessMode === 'PRIVATE' ? 'PRIVATE' : 'PUBLIC',
            assignedMemberIdsJson: Array.isArray(assignedMemberIds) ? assignedMemberIds : [],
            assignedTeamIdsJson: Array.isArray(assignedTeamIds) ? assignedTeamIds : [],
            customFieldValuesJson: customFieldValues || {},
            submissionsJson: [],
            createdAt: nowDate,
            updatedAt: 'Just now',
            timestampMs: BigInt(Date.now()),
          },
        });
        await queueDirectoryAssignments('task', saved.id, saved.title, saved.assignedMemberIdsJson, saved.assignedTeamIdsJson, tx,
          existing ? { members: existing.assignedMemberIdsJson, teams: existing.assignedTeamIdsJson } : undefined);
        return saved;
      });

      const savedDto = toCmhTaskDto(savedRow);
      broadcastRealtimeEvent('cmh:updated', { type: 'task', item: savedDto });

      if (isNew) {
        const shareUrl = `${originUrl || 'http://localhost:3000'}/?cmh=task:${savedDto.id}`;
        await triggerCmhActivityAndAdminMail({
          activityType: 'TASK_ACTIVITY',
          module: 'cmh_tasks',
          targetId: savedDto.id,
          title: `New Task Created: ${savedDto.title}`,
          description: `Task created using form template "${savedDto.formTemplateTitle}" (${savedDto.priority} priority · ${savedDto.status}).`,
          actorName: adminIdentity.name,
          actorEmail: rules?.adminEmail || adminIdentity.email,
          shareUrl,
          detailsMap: {
            'Task Title': savedDto.title,
            'Form Template': savedDto.formTemplateTitle,
            Status: savedDto.status,
            Priority: savedDto.priority,
            'Due Date': savedDto.dueDate,
            'Access Mode': savedDto.accessMode,
          },
        });
      }

      const allTasks = await prisma.cmhTask.findMany({ orderBy: { timestampMs: 'desc' } });
      res.json({ task: savedDto, tasks: allTasks.map(toCmhTaskDto) });
    })
  );

  app.delete(
    '/api/cmh/tasks/:id',
    asyncHandler(async (req, res) => {
      await prisma.cmhTask.deleteMany({ where: { id: req.params.id } });
      const allTasks = await prisma.cmhTask.findMany({ orderBy: { timestampMs: 'desc' } });
      res.json({ tasks: allTasks.map(toCmhTaskDto) });
    })
  );

  app.post(
    '/api/cmh/projects',
    asyncHandler(async (req, res) => {
      await ensureWorkspaceBootstrap();
      const {
        id,
        title,
        description,
        formTemplateId,
        status,
        priority,
        deadline,
        budget,
        accessMode,
        assignedMemberIds,
        assignedTeamIds,
        customFieldValues,
        originUrl,
      } = req.body || {};

      if (!title || !String(title).trim()) {
        res.status(400).json({ error: 'Project title is required.' });
        return;
      }

      const [matchedTemplate, existing, adminIdentity, rules] = await Promise.all([
        formTemplateId
          ? prisma.cmhFormTemplate.findUnique({ where: { id: String(formTemplateId) } })
          : prisma.cmhFormTemplate.findFirst({ orderBy: { timestampMs: 'desc' } }),
        id ? prisma.cmhProject.findUnique({ where: { id: String(id) } }) : null,
        getPrimaryAdminIdentity(),
        prisma.cmhNotificationRule.findUnique({ where: { id: 'cmh-rules-default' } }),
      ]);

      const isNew = !existing;
      const projectId =
        existing?.id || `cmh-proj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
      const nowDate = new Date().toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const savedRow = await prisma.$transaction(async (tx) => {
        const saved = await tx.cmhProject.upsert({
          where: { id: projectId },
          update: {
            title: String(title).trim(),
            description: String(description || '').trim(),
            formTemplateId: matchedTemplate?.id || 'cmh-form-project-blueprint',
            formTemplateTitle: matchedTemplate?.title || 'Enterprise Project Blueprint',
            status: status || existing?.status || 'Active',
            priority: priority || existing?.priority || 'High',
            deadline: String(deadline ?? existing?.deadline ?? ''),
            budget: String(budget ?? existing?.budget ?? ''),
            accessMode: accessMode === 'PRIVATE' ? 'PRIVATE' : 'PUBLIC',
            assignedMemberIdsJson: Array.isArray(assignedMemberIds)
              ? assignedMemberIds
              : (existing?.assignedMemberIdsJson ?? []),
            assignedTeamIdsJson: Array.isArray(assignedTeamIds)
              ? assignedTeamIds
              : (existing?.assignedTeamIdsJson ?? []),
            customFieldValuesJson: customFieldValues ?? existing?.customFieldValuesJson ?? {},
            updatedAt: nowTime,
            timestampMs: BigInt(Date.now()),
          },
          create: {
            id: projectId,
            title: String(title).trim(),
            description: String(description || '').trim(),
            formTemplateId: matchedTemplate?.id || 'cmh-form-project-blueprint',
            formTemplateTitle: matchedTemplate?.title || 'Enterprise Project Blueprint',
            status: status || 'Active',
            priority: priority || 'High',
            deadline: String(deadline || 'Q4 2026'),
            budget: String(budget || 'TBD'),
            accessMode: accessMode === 'PRIVATE' ? 'PRIVATE' : 'PUBLIC',
            assignedMemberIdsJson: Array.isArray(assignedMemberIds) ? assignedMemberIds : [],
            assignedTeamIdsJson: Array.isArray(assignedTeamIds) ? assignedTeamIds : [],
            customFieldValuesJson: customFieldValues || {},
            submissionsJson: [],
            createdAt: nowDate,
            updatedAt: 'Just now',
            timestampMs: BigInt(Date.now()),
          },
        });
        await queueDirectoryAssignments('project', saved.id, saved.title, saved.assignedMemberIdsJson, saved.assignedTeamIdsJson, tx,
          existing ? { members: existing.assignedMemberIdsJson, teams: existing.assignedTeamIdsJson } : undefined);
        return saved;
      });

      const savedDto = toCmhProjectDto(savedRow);
      broadcastRealtimeEvent('cmh:updated', { type: 'project', item: savedDto });

      if (isNew) {
        const shareUrl = `${originUrl || 'http://localhost:3000'}/?cmh=project:${savedDto.id}`;
        await triggerCmhActivityAndAdminMail({
          activityType: 'PROJECT_ACTIVITY',
          module: 'cmh_projects',
          targetId: savedDto.id,
          title: `New Project Created: ${savedDto.title}`,
          description: `Project created using form template "${savedDto.formTemplateTitle}" (${savedDto.priority} priority · ${savedDto.status}).`,
          actorName: adminIdentity.name,
          actorEmail: rules?.adminEmail || adminIdentity.email,
          shareUrl,
          detailsMap: {
            'Project Title': savedDto.title,
            'Form Template': savedDto.formTemplateTitle,
            Status: savedDto.status,
            Priority: savedDto.priority,
            Deadline: savedDto.deadline,
            Budget: savedDto.budget,
            'Access Mode': savedDto.accessMode,
          },
        });
      }

      const allProjects = await prisma.cmhProject.findMany({ orderBy: { timestampMs: 'desc' } });
      res.json({ project: savedDto, projects: allProjects.map(toCmhProjectDto) });
    })
  );

  app.delete(
    '/api/cmh/projects/:id',
    asyncHandler(async (req, res) => {
      await prisma.cmhProject.deleteMany({ where: { id: req.params.id } });
      const allProjects = await prisma.cmhProject.findMany({ orderBy: { timestampMs: 'desc' } });
      res.json({ projects: allProjects.map(toCmhProjectDto) });
    })
  );

  app.post(
    '/api/cmh/rules',
    asyncHandler(async (req, res) => {
      await ensureWorkspaceBootstrap();
      const patch = req.body || {};
      const updated = await prisma.cmhNotificationRule.update({
        where: { id: 'cmh-rules-default' },
        data: {
          ...(patch.adminEmail !== undefined ? { adminEmail: String(patch.adminEmail).trim() } : {}),
          ...(patch.notifyOnFormSubmit !== undefined
            ? { notifyOnFormSubmit: Boolean(patch.notifyOnFormSubmit) }
            : {}),
          ...(patch.notifyOnTaskActivity !== undefined
            ? { notifyOnTaskActivity: Boolean(patch.notifyOnTaskActivity) }
            : {}),
          ...(patch.notifyOnProjectActivity !== undefined
            ? { notifyOnProjectActivity: Boolean(patch.notifyOnProjectActivity) }
            : {}),
          ...(patch.notifyOnMemberActivity !== undefined
            ? { notifyOnMemberActivity: Boolean(patch.notifyOnMemberActivity) }
            : {}),
          ...(patch.autoSendAdminEmail !== undefined
            ? { autoSendAdminEmail: Boolean(patch.autoSendAdminEmail) }
            : {}),
          ...(patch.injectIntoPrimaryInbox !== undefined
            ? { injectIntoPrimaryInbox: Boolean(patch.injectIntoPrimaryInbox) }
            : {}),
          updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      });
      res.json({ rules: toCmhRulesDto(updated) });
    })
  );

  app.post(
    '/api/cmh/invite',
    asyncHandler(async (req, res) => {
      const { targetType, targetId, memberIds, teamIds, customMessage, originUrl } = req.body || {};
      const selectedMemberIds = Array.isArray(memberIds) ? memberIds.map(String) : [];
      const selectedTeamIds = Array.isArray(teamIds) ? teamIds.map(String) : [];

      const recipientMembers = await prisma.workspaceMember.findMany({
        where: {
          OR: [
            ...(selectedMemberIds.length > 0 ? [{ id: { in: selectedMemberIds } }] : []),
            ...(selectedTeamIds.length > 0 ? [{ teamId: { in: selectedTeamIds } }] : []),
          ],
        },
      });

      const result = await prisma.$transaction(async (tx) => {
        const selection = { members: selectedMemberIds, teams: selectedTeamIds };
        let current;
        let previous;
        if (targetType === 'form') {
          const form = await tx.cmhFormTemplate.findUnique({ where: { id: String(targetId) } });
          if (!form) return null;
          previous = { members: form.invitedMemberIdsJson, teams: form.invitedTeamIdsJson };
          current = await tx.cmhFormTemplate.update({ where: { id: form.id },
            data: { invitedMemberIdsJson: selectedMemberIds, invitedTeamIdsJson: selectedTeamIds } });
        } else if (targetType === 'task' || targetType === 'project') {
          const where = { id: String(targetId) };
          const item = targetType === 'task'
            ? await tx.cmhTask.findUnique({ where })
            : await tx.cmhProject.findUnique({ where });
          if (!item) return null;
          previous = { members: item.assignedMemberIdsJson, teams: item.assignedTeamIdsJson };
          const data = { assignedMemberIdsJson: selectedMemberIds, assignedTeamIdsJson: selectedTeamIds };
          current = targetType === 'task'
            ? await tx.cmhTask.update({ where: { id: item.id }, data })
            : await tx.cmhProject.update({ where: { id: item.id }, data });
        } else return null;
        const queued = await queueDirectoryAssignments(targetType, current.id, current.title,
          selection.members, selection.teams, tx, previous,
          typeof customMessage === 'string' ? customMessage : undefined);
        return { title: current.title, queued };
      });
      if (!result) { res.status(404).json({ error: 'Workspace item not found.' }); return; }
      const itemTitle = result.title;
      const shareUrl = (originUrl || 'http://localhost:3000') + '/?cmh=' + targetType + ':' + targetId;

      await recordAndBroadcastNotification({
        type: 'cmh_activity',
        title: `Queued ${result.queued} email(s) for "${itemTitle}"`,
        description: `Invited ${
          recipientMembers.map((m) => m.fullName).join(', ') || 'selected members'
        } with link ${shareUrl}`,
        module:
          targetType === 'task'
            ? 'cmh_tasks'
            : targetType === 'project'
            ? 'cmh_projects'
            : 'cmh_forms',
        targetId,
      });

      const [forms, tasks, projects] = await Promise.all([
        prisma.cmhFormTemplate.findMany({ orderBy: { timestampMs: 'desc' } }),
        prisma.cmhTask.findMany({ orderBy: { timestampMs: 'desc' } }),
        prisma.cmhProject.findMany({ orderBy: { timestampMs: 'desc' } }),
      ]);

      res.json({
        ok: true,
        invitedCount: recipientMembers.length,
        shareUrl,
        forms: forms.map(toCmhFormDto),
        tasks: tasks.map(toCmhTaskDto),
        projects: projects.map(toCmhProjectDto),
      });
    })
  );

  app.get(
    '/api/cmh/public/:targetType/:id',
    asyncHandler(async (req, res) => {
      const { targetType, id } = req.params;
      const members = await prisma.workspaceMember.findMany({ orderBy: { timestampMs: 'desc' } });

      if (targetType === 'form') {
        const form = await prisma.cmhFormTemplate.findUnique({ where: { id } });
        if (!form) {
          res.status(404).json({ error: 'Form not found.' });
          return;
        }
        const dto = { ...toCmhFormDto(form), submissions: [] };
        res.json({
          targetType: 'form',
          item: dto,
          template: dto,
          members: members.map(toWorkspaceMemberDto),
        });
        return;
      }

      if (targetType === 'task') {
        const task = await prisma.cmhTask.findUnique({ where: { id } });
        if (!task) {
          res.status(404).json({ error: 'Task not found.' });
          return;
        }
        const template =
          (await prisma.cmhFormTemplate.findUnique({ where: { id: task.formTemplateId } })) ||
          (await prisma.cmhFormTemplate.findFirst({ orderBy: { timestampMs: 'desc' } }));
        res.json({
          targetType: 'task',
          item: { ...toCmhTaskDto(task), submissions: [] },
          template: template ? { ...toCmhFormDto(template), submissions: [] } : undefined,
          members: members.map(toWorkspaceMemberDto),
        });
        return;
      }

      if (targetType === 'project') {
        const project = await prisma.cmhProject.findUnique({ where: { id } });
        if (!project) {
          res.status(404).json({ error: 'Project not found.' });
          return;
        }
        const template =
          (await prisma.cmhFormTemplate.findUnique({ where: { id: project.formTemplateId } })) ||
          (await prisma.cmhFormTemplate.findFirst({ orderBy: { timestampMs: 'desc' } }));
        res.json({
          targetType: 'project',
          item: { ...toCmhProjectDto(project), submissions: [] },
          template: template ? { ...toCmhFormDto(template), submissions: [] } : undefined,
          members: members.map(toWorkspaceMemberDto),
        });
        return;
      }

      res.status(400).json({ error: 'Invalid CMH target type.' });
    })
  );

  app.post(
    '/api/cmh/public/:targetType/:id/submit',
    asyncHandler(async (req, res) => {
      const { targetType, id } = req.params;
      const { submitterName, submitterEmail, values, statusUpdate, originUrl } = req.body || {};

      if (!submitterEmail || !String(submitterEmail).trim()) {
        res.status(400).json({ error: 'Please provide your email address to submit.' });
        return;
      }

      const requestId = req.get('Idempotency-Key');
      if (requestId && !/^[a-zA-Z0-9_-]{16,100}$/.test(requestId)) {
        res.status(400).json({ error: 'Invalid submission request ID.' });
        return;
      }
      const submissionId = createSubmissionId(requestId);
      const cleanEmail = String(submitterEmail).trim();
      const cleanName = String(submitterName || cleanEmail.split('@')[0]).trim();
      const nowStr = new Date().toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      const shareUrl = `${originUrl || 'http://localhost:3000'}/?cmh=${targetType}:${id}`;

      if (targetType === 'form') {
        const form = await prisma.cmhFormTemplate.findUnique({ where: { id } });
        if (!form) {
          res.status(404).json({ error: 'Form not found.' });
          return;
        }
        const submission = {
          id: submissionId,
          targetType: 'FORM',
          targetId: form.id,
          targetTitle: form.title,
          submitterName: cleanName,
          submitterEmail: cleanEmail,
          submittedAt: nowStr,
          timestamp: Date.now(),
          values: values || {},
        };
        const { updated: updatedForm, submission: savedSubmission, duplicate } = await appendFormSubmissionAtomic(id, submission);
        const formDto = toCmhFormDto(updatedForm);
        if (!duplicate) {
          const labeledDetails: Record<string, any> = {};
          for (const fld of formDto.fields) {
            if (values && values[fld.id] !== undefined) {
              labeledDetails[fld.label] =
                fld.type === 'PASSWORD' ? '•••••••• (Encrypted)' : values[fld.id];
            }
          }
          broadcastRealtimeEvent('cmh:updated', { type: 'form', item: formDto });
          await triggerCmhActivityAndAdminMail({
            activityType: 'FORM_SUBMIT',
            module: 'cmh_forms',
            targetId: form.id,
            isSubmission: true,
            title: `Form Submitted: "${form.title}" by ${cleanName}`,
            description: `${cleanName} (${cleanEmail}) submitted "${form.title}" (${form.formCategory} Form).`,
            actorName: cleanName,
            actorEmail: cleanEmail,
            shareUrl,
            detailsMap: labeledDetails,
          });
        }
        res.json({ ok: true, confirmationMessage: formDto.confirmationMessage, submission: savedSubmission });
        return;
      }

      if (targetType === 'task') {
        const task = await prisma.cmhTask.findUnique({ where: { id } });
        if (!task) {
          res.status(404).json({ error: 'Task not found.' });
          return;
        }
        const template = await prisma.cmhFormTemplate.findUnique({
          where: { id: task.formTemplateId },
        });
        const submission = {
          id: submissionId,
          targetType: 'TASK',
          targetId: task.id,
          targetTitle: task.title,
          submitterName: cleanName,
          submitterEmail: cleanEmail,
          submittedAt: nowStr,
          timestamp: Date.now(),
          values: { ...(values || {}), ...(statusUpdate ? { Status: statusUpdate } : {}) },
        };
        const { updated: updatedTask, submission: savedSubmission, duplicate } = await appendTaskSubmissionAtomic(
          id,
          submission,
          statusUpdate ? String(statusUpdate) : undefined
        );
        const taskDto = toCmhTaskDto(updatedTask);
        if (!duplicate) {
          const labeledDetails: Record<string, any> = { 'Task Status': taskDto.status };
          if (template) {
            const tplDto = toCmhFormDto(template);
            for (const fld of tplDto.fields) {
              if (values && values[fld.id] !== undefined) {
                labeledDetails[fld.label] = values[fld.id];
              }
            }
          }
          broadcastRealtimeEvent('cmh:updated', { type: 'task', item: taskDto });
          await triggerCmhActivityAndAdminMail({
            activityType: 'TASK_ACTIVITY',
            module: 'cmh_tasks',
            targetId: task.id,
            isSubmission: true,
            title: `Task Response Submitted: "${task.title}" by ${cleanName}`,
            description: `${cleanName} (${cleanEmail}) submitted an update on Task "${task.title}" (Status: ${taskDto.status}).`,
            actorName: cleanName,
            actorEmail: cleanEmail,
            shareUrl,
            detailsMap: labeledDetails,
          });
        }
        res.json({ ok: true, confirmationMessage: 'Task update recorded and sent to Admin!', submission: savedSubmission });
        return;
      }

      if (targetType === 'project') {
        const project = await prisma.cmhProject.findUnique({ where: { id } });
        if (!project) {
          res.status(404).json({ error: 'Project not found.' });
          return;
        }
        const template = await prisma.cmhFormTemplate.findUnique({
          where: { id: project.formTemplateId },
        });
        const submission = {
          id: submissionId,
          targetType: 'PROJECT',
          targetId: project.id,
          targetTitle: project.title,
          submitterName: cleanName,
          submitterEmail: cleanEmail,
          submittedAt: nowStr,
          timestamp: Date.now(),
          values: { ...(values || {}), ...(statusUpdate ? { Status: statusUpdate } : {}) },
        };
        const { updated: updatedProject, submission: savedSubmission, duplicate } = await appendProjectSubmissionAtomic(
          id,
          submission,
          statusUpdate ? String(statusUpdate) : undefined
        );
        const projectDto = toCmhProjectDto(updatedProject);
        if (!duplicate) {
          const labeledDetails: Record<string, any> = { 'Project Status': projectDto.status };
          if (template) {
            const tplDto = toCmhFormDto(template);
            for (const fld of tplDto.fields) {
              if (values && values[fld.id] !== undefined) {
                labeledDetails[fld.label] = values[fld.id];
              }
            }
          }
          broadcastRealtimeEvent('cmh:updated', { type: 'project', item: projectDto });
          await triggerCmhActivityAndAdminMail({
            activityType: 'PROJECT_ACTIVITY',
            module: 'cmh_projects',
            targetId: project.id,
            isSubmission: true,
            title: `Project Update Submitted: "${project.title}" by ${cleanName}`,
            description: `${cleanName} (${cleanEmail}) submitted an update on Project "${project.title}" (Status: ${projectDto.status}).`,
            actorName: cleanName,
            actorEmail: cleanEmail,
            shareUrl,
            detailsMap: labeledDetails,
          });
        }
        res.json({ ok: true, confirmationMessage: 'Project submission recorded and sent to Admin!', submission: savedSubmission });
        return;
      }

      res.status(400).json({ error: 'Invalid target type.' });
    })
  );

  // ============================================================================
  // UNIFIED WORKSPACE ENGINES API (/api/engines/:collection)
  // ============================================================================

  app.get(
    '/api/engines/:collection',
    asyncHandler(async (req, res) => {
      const col = req.params.collection;
      if (!isEngineCollection(col)) {
        res.status(400).json({ error: 'Unknown engine collection.' });
        return;
      }
      const items = await listEngineRecords(col);
      res.json({ items });
    })
  );

  app.post(
    '/api/engines/:collection',
    asyncHandler(async (req, res) => {
      const col = req.params.collection;
      if (!isEngineCollection(col)) {
        res.status(400).json({ error: 'Unknown engine collection.' });
        return;
      }
      const { item, items } = await saveEngineRecordInDb(col, req.body || {});
      if (col === 'chatMessages') {
        broadcastRealtimeEvent('chat:message', item);
      } else if (col === 'chatChannels') {
        broadcastRealtimeEvent('chat:channel', item);
      }
      res.json({ ok: true, item, items });
    })
  );

  // Execute Automation Workflow Rule with real workspace side-effects
  app.post(
    '/api/automations/run/:id',
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const rule = await prisma.workspaceAutomationRule.findUnique({ where: { id: req.params.id } });
      if (!rule) {
        res.status(404).json({ error: 'Automation rule not found.' });
        return;
      }
      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const actionLower = rule.actionType.toLowerCase();
      let effectSummary = `Executed "${rule.name}"`;

      if (actionLower.includes('notification') || actionLower.includes('alert') || actionLower.includes('email')) {
        await recordAndBroadcastNotification({
          type: 'cmh_activity',
          title: `Automation Executed: ${rule.name}`,
          description: `Trigger: ${rule.triggerEvent} → Action: ${rule.actionType} (${rule.targetValue})`,
          module: 'cmh_tasks',
          targetId: rule.id,
        });
        effectSummary = 'Dispatched live workspace notification';
      } else if (actionLower.includes('calendar') || actionLower.includes('event') || actionLower.includes('schedule')) {
        const today = new Date().toISOString().slice(0, 10);
        await saveEngineRecordInDb('calendarEvents', {
          title: `[Auto] ${rule.name}`,
          description: `Triggered by: ${rule.triggerEvent} · Target: ${rule.targetValue}`,
          eventType: 'REMINDER',
          date: today,
          startTime: '10:00',
          endTime: '10:30',
          location: 'Workspace Automation',
          color: '#7C3AED',
        });
        effectSummary = 'Created live Calendar reminder';
      } else if (actionLower.includes('webhook') && /^https?:\/\//i.test(rule.targetValue)) {
        try {
          await fetch(rule.targetValue, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ruleId: rule.id,
              ruleName: rule.name,
              triggerEvent: rule.triggerEvent,
              timestamp: new Date().toISOString(),
            }),
            signal: AbortSignal.timeout(5000),
          });
          effectSummary = `Posted webhook to ${rule.targetValue}`;
        } catch {
          effectSummary = `Attempted webhook to ${rule.targetValue}`;
        }
      }

      const updated = await prisma.workspaceAutomationRule.update({
        where: { id: rule.id },
        data: {
          runsCount: rule.runsCount + 1,
          lastRunAt: `Today at ${nowStr}`,
          timestampMs: BigInt(Date.now()),
        },
      });
      const rules = await listEngineRecords('automationRules');
      res.json({
        ok: true,
        effectSummary,
        item: rules.find((r: any) => r.id === rule.id) || null,
        items: rules,
      });
    })
  );

  app.delete(
    '/api/engines/:collection/:id',
    asyncHandler(async (req, res) => {
      const col = req.params.collection;
      if (!isEngineCollection(col)) {
        res.status(400).json({ error: 'Unknown engine collection.' });
        return;
      }
      const items = await deleteEngineRecordInDb(col, req.params.id);
      res.json({ ok: true, items });
    })
  );
}
