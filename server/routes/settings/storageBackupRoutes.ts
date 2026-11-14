import express from 'express';
import { prisma } from '../../db/prisma';
import { ensureWorkspaceBootstrap } from '../../db/initEngine';
import {
  sanitizeAdminUser,
  toBulkCampaignDto,
  toCmhFormDto,
  toCmhProjectDto,
  toCmhRulesDto,
  toCmhTaskDto,
  toCustomMailTabDto,
  toMailMessageDto,
  toNotificationDto,
  toSystemSettingsDto,
  toWorkspaceDocDto,
  toWorkspaceFileDto,
  toWorkspaceFolderDto,
  toWorkspaceFormDto,
  toWorkspaceMeetingDto,
  toWorkspaceMemberDto,
  toWorkspacePostCategoryDto,
  toWorkspacePostNoticeDto,
  toWorkspaceSlideDto,
  toWorkspaceTeamGroupDto,
} from '../../db/mappers';
import { ENGINE_COLLECTIONS, listEngineRecords, saveEngineRecordInDb } from '../../db/enginesRepo';
import { getVpsStorageDiagnostics, runSmartStorageCleanup } from '../../services/storageService';
import { asyncHandler } from '../../realtime';

export function registerStorageBackupRoutes(app: express.Express) {
  // VPS Storage Diagnostics
  app.get(
    '/api/settings/storage',
    asyncHandler(async (_req, res) => {
      await ensureWorkspaceBootstrap();
      const storage = await getVpsStorageDiagnostics();
      res.json({ ok: true, storage });
    })
  );

  // VPS Storage Cleanup
  app.post(
    '/api/settings/storage/cleanup',
    asyncHandler(async (req, res) => {
      await ensureWorkspaceBootstrap();
      const { pruneOrphans = true, purgeTrashOlderThanDays = 30 } = req.body || {};
      const cleanup = await runSmartStorageCleanup({
        pruneOrphans: Boolean(pruneOrphans),
        purgeTrashOlderThanDays: Number(purgeTrashOlderThanDays) || 0,
      });
      const storage = await getVpsStorageDiagnostics();
      res.json({ ok: true, cleanup, storage });
    })
  );

  // Backup Export
  app.get(
    '/api/settings/backup',
    asyncHandler(async (_req, res) => {
      await ensureWorkspaceBootstrap();
      const [
        users,
        accounts,
        gmailAccounts,
        messages,
        starredRows,
        customTabs,
        bulkCampaigns,
        docs,
        slides,
        forms,
        meetings,
        teamGroups,
        members,
        postCategories,
        postsNotices,
        folders,
        files,
        notifications,
        cmhForms,
        cmhTasks,
        cmhProjects,
        cmhRules,
        sysSettings,
        ...engineLists
      ] = await Promise.all([
        prisma.workspaceUser.findMany(),
        prisma.serverMailAccount.findMany(),
        prisma.gmailAccount.findMany(),
        prisma.mailMessage.findMany(),
        prisma.mailStarredMessage.findMany(),
        prisma.customMailTab.findMany(),
        prisma.bulkCampaign.findMany(),
        prisma.workspaceDoc.findMany(),
        prisma.workspaceSlide.findMany(),
        prisma.workspaceForm.findMany({ include: { submissions: true } }),
        prisma.workspaceMeeting.findMany(),
        prisma.workspaceTeamGroup.findMany(),
        prisma.workspaceMember.findMany(),
        prisma.workspacePostCategory.findMany(),
        prisma.workspacePostNotice.findMany(),
        prisma.workspaceFolder.findMany(),
        prisma.workspaceFile.findMany(),
        prisma.systemNotification.findMany(),
        prisma.cmhFormTemplate.findMany(),
        prisma.cmhTask.findMany(),
        prisma.cmhProject.findMany(),
        prisma.cmhNotificationRule.findUnique({ where: { id: 'cmh-rules-default' } }),
        prisma.workspaceSystemSetting.findUnique({ where: { id: 'default' } }),
        ...ENGINE_COLLECTIONS.map((col) => listEngineRecords(col)),
      ]);

      const starredIds: Record<string, string[]> = {};
      for (const s of starredRows) {
        if (!starredIds[s.accountId]) starredIds[s.accountId] = [];
        starredIds[s.accountId].push(s.messageId);
      }

      const enginesData: Record<string, any[]> = {};
      ENGINE_COLLECTIONS.forEach((col, idx) => {
        enginesData[col] = engineLists[idx] || [];
      });

      res.json({
        exportedAt: new Date().toISOString(),
        version: '5.0-postgresql-prisma',
        data: {
          users: users.map(sanitizeAdminUser),
          accounts: accounts.map((a) => ({ ...a, encryptedPassword: '', passwordHash: '' })),
          gmailAccounts: gmailAccounts.map((a) => ({
            ...a,
            encryptedPassword: '',
            passwordHash: '',
            clientSecretEnc: null,
            refreshTokenEnc: null,
          })),
          messages: messages.map(toMailMessageDto),
          starredIds,
          customTabs: customTabs.map(toCustomMailTabDto),
          bulkCampaigns: bulkCampaigns.map(toBulkCampaignDto),
          docs: docs.map(toWorkspaceDocDto),
          slides: slides.map(toWorkspaceSlideDto),
          forms: forms.map(toWorkspaceFormDto),
          meetings: meetings.map(toWorkspaceMeetingDto),
          teamGroups: teamGroups.map(toWorkspaceTeamGroupDto),
          members: members.map(toWorkspaceMemberDto),
          postCategories: postCategories.map(toWorkspacePostCategoryDto),
          postsNotices: postsNotices.map(toWorkspacePostNoticeDto),
          folders: folders.map(toWorkspaceFolderDto),
          files: files.map(toWorkspaceFileDto),
          notifications: notifications.map(toNotificationDto),
          cmhForms: cmhForms.map(toCmhFormDto),
          cmhTasks: cmhTasks.map(toCmhTaskDto),
          cmhProjects: cmhProjects.map(toCmhProjectDto),
          cmhRules: cmhRules ? toCmhRulesDto(cmhRules) : undefined,
          systemSettings: sysSettings ? toSystemSettingsDto(sysSettings) : undefined,
          ...enginesData,
        },
      });
    })
  );

  // Backup Restore
  app.post(
    '/api/settings/restore',
    asyncHandler(async (req, res) => {
      await ensureWorkspaceBootstrap();
      const payload = req.body?.data || req.body;
      if (!payload || typeof payload !== 'object') {
        res.status(400).json({ error: 'Invalid backup JSON payload.' });
        return;
      }

      await prisma.$transaction(async (tx) => {
        if (Array.isArray(payload.customTabs)) {
          for (const t of payload.customTabs) {
            if (!t?.id) continue;
            await tx.customMailTab.upsert({
              where: { id: String(t.id) },
              update: { name: String(t.name || t.label || 'Tab'), query: String(t.query || '') },
              create: {
                id: String(t.id),
                name: String(t.name || t.label || 'Tab'),
                query: String(t.query || ''),
                accentColor: String(t.accentColor || '#0B57D0'),
                description: t.description || '',
                isBulkShortcut: Boolean(t.isBulkShortcut),
                createdAt: String(t.createdAt || 'Restored'),
                timestampMs: BigInt(Date.now()),
              },
            });
          }
        }

        if (Array.isArray(payload.docs)) {
          for (const d of payload.docs) {
            if (!d?.id) continue;
            await tx.workspaceDoc.upsert({
              where: { id: String(d.id) },
              update: {
                title: String(d.title || 'Untitled'),
                category: String(d.category || 'General'),
                bodyText: String(d.bodyText || ''),
                wordCount: Number(d.wordCount) || 0,
                updatedAt: String(d.updatedAt || 'Restored'),
              },
              create: {
                id: String(d.id),
                title: String(d.title || 'Untitled'),
                category: String(d.category || 'General'),
                bodyText: String(d.bodyText || ''),
                googleDocId: d.googleDocId || null,
                googleDocUrl: d.googleDocUrl || null,
                linkedFileId: d.linkedFileId || null,
                fileUrl: d.fileUrl || null,
                wordCount: Number(d.wordCount) || 0,
                createdAt: String(d.createdAt || 'Restored'),
                updatedAt: String(d.updatedAt || 'Restored'),
                timestampMs: BigInt(Number(d.timestamp) || Date.now()),
              },
            });
          }
        }

        if (Array.isArray(payload.slides)) {
          for (const s of payload.slides) {
            if (!s?.id) continue;
            await tx.workspaceSlide.upsert({
              where: { id: String(s.id) },
              update: {
                title: String(s.title || 'Untitled Deck'),
                pagesJson: Array.isArray(s.pages) ? s.pages : [],
                slideCount: Number(s.slideCount) || 1,
                updatedAt: String(s.updatedAt || 'Restored'),
              },
              create: {
                id: String(s.id),
                title: String(s.title || 'Untitled Deck'),
                subtitle: String(s.subtitle || ''),
                category: String(s.category || 'Presentations'),
                themeColor: String(s.themeColor || '#D97706'),
                authorName: String(s.authorName || 'Administrator'),
                pagesJson: Array.isArray(s.pages) ? s.pages : [],
                linkedFileId: s.linkedFileId || null,
                fileUrl: s.fileUrl || null,
                slideCount: Number(s.slideCount) || 1,
                createdAt: String(s.createdAt || 'Restored'),
                updatedAt: String(s.updatedAt || 'Restored'),
                timestampMs: BigInt(Number(s.timestamp) || Date.now()),
              },
            });
          }
        }

        if (Array.isArray(payload.forms)) {
          for (const f of payload.forms) {
            if (!f?.id) continue;
            await tx.workspaceForm.upsert({
              where: { id: String(f.id) },
              update: {
                title: String(f.title || 'Untitled Form'),
                description: String(f.description || ''),
                fieldsJson: Array.isArray(f.fields) ? f.fields : [],
              },
              create: {
                id: String(f.id),
                title: String(f.title || 'Untitled Form'),
                description: String(f.description || ''),
                accentColor: String(f.accentColor || '#673AB7'),
                isPublic: Boolean(f.isPublic ?? true),
                identityMode: String(f.identityMode || 'OPTIONAL'),
                targetSubmissions: Number(f.targetSubmissions) || 50,
                autoCloseOnTarget: Boolean(f.autoCloseOnTarget),
                confirmationMessage: String(f.confirmationMessage || ''),
                googleFormUri: f.googleFormUri || null,
                fieldsJson: Array.isArray(f.fields) ? f.fields : [],
                createdAt: String(f.createdAt || 'Restored'),
                timestampMs: BigInt(Date.now()),
              },
            });
            if (Array.isArray(f.submissions)) {
              for (const sub of f.submissions) {
                if (!sub?.id) continue;
                await tx.formSubmission.upsert({
                  where: { id: String(sub.id) },
                  update: {},
                  create: {
                    id: String(sub.id),
                    formId: String(f.id),
                    respondentName: String(sub.respondentName || 'Anonymous'),
                    respondentEmail: String(sub.respondentEmail || ''),
                    submittedAt: String(sub.submittedAt || 'Restored'),
                    timestampMs: BigInt(Number(sub.timestamp) || Date.now()),
                    answersJson: sub.answers || {},
                  },
                });
              }
            }
          }
        }

        if (Array.isArray(payload.teamGroups)) {
          for (const g of payload.teamGroups) {
            if (!g?.id) continue;
            await tx.workspaceTeamGroup.upsert({
              where: { id: String(g.id) },
              update: { name: String(g.name || 'Team'), color: String(g.color || '#0B57D0') },
              create: {
                id: String(g.id),
                name: String(g.name || 'Team'),
                description: String(g.description || ''),
                color: String(g.color || '#0B57D0'),
                createdAt: String(g.createdAt || 'Restored'),
                timestampMs: BigInt(Number(g.timestamp) || Date.now()),
              },
            });
          }
        }

        if (Array.isArray(payload.members)) {
          for (const m of payload.members) {
            if (!m?.id) continue;
            await tx.workspaceMember.upsert({
              where: { id: String(m.id) },
              update: {
                fullName: String(m.fullName || ''),
                email: String(m.email || ''),
                designation: String(m.designation || ''),
                status: String(m.status || 'Active'),
              },
              create: {
                id: String(m.id),
                firstName: String(m.firstName || ''),
                lastName: String(m.lastName || ''),
                fullName: String(m.fullName || ''),
                email: String(m.email || ''),
                designation: String(m.designation || 'Member'),
                teamId: m.teamId || null,
                teamName: m.teamName || null,
                phone: m.phone || null,
                bio: m.bio || null,
                avatarUrl: m.avatarUrl || null,
                status: String(m.status || 'Active'),
                inviteToken: String(m.inviteToken || `inv-${Date.now()}`),
                inviteSentAt: m.inviteSentAt || null,
                joinedAt: String(m.joinedAt || 'Restored'),
                timestampMs: BigInt(Number(m.timestamp) || Date.now()),
              },
            });
          }
        }

        if (Array.isArray(payload.cmhForms)) {
          for (const cf of payload.cmhForms) {
            if (!cf?.id) continue;
            await tx.cmhFormTemplate.upsert({
              where: { id: String(cf.id) },
              update: { title: String(cf.title || 'Template'), fieldsJson: cf.fields || [] },
              create: {
                id: String(cf.id),
                title: String(cf.title || 'Template'),
                description: String(cf.description || ''),
                formCategory: String(cf.formCategory || 'GENERAL'),
                accessMode: String(cf.accessMode || 'PUBLIC'),
                invitedMemberIdsJson: cf.invitedMemberIds || [],
                invitedTeamIdsJson: cf.invitedTeamIds || [],
                submitButtonLabel: String(cf.submitButtonLabel || 'Submit'),
                confirmationMessage: String(cf.confirmationMessage || ''),
                fieldsJson: cf.fields || [],
                submissionsJson: cf.submissions || [],
                createdAt: String(cf.createdAt || 'Restored'),
                updatedAt: String(cf.updatedAt || 'Restored'),
                timestampMs: BigInt(Number(cf.timestamp) || Date.now()),
              },
            });
          }
        }

        if (Array.isArray(payload.cmhTasks)) {
          for (const t of payload.cmhTasks) {
            if (!t?.id) continue;
            await tx.cmhTask.upsert({
              where: { id: String(t.id) },
              update: { title: String(t.title || 'Task'), status: String(t.status || 'To Do') },
              create: {
                id: String(t.id),
                title: String(t.title || 'Task'),
                description: String(t.description || ''),
                formTemplateId: String(t.formTemplateId || ''),
                formTemplateTitle: String(t.formTemplateTitle || ''),
                status: String(t.status || 'To Do'),
                priority: String(t.priority || 'Medium'),
                dueDate: t.dueDate || '',
                accessMode: String(t.accessMode || 'PUBLIC'),
                assignedMemberIdsJson: t.assignedMemberIds || [],
                assignedTeamIdsJson: t.assignedTeamIds || [],
                customFieldValuesJson: t.customFieldValues || {},
                submissionsJson: t.submissions || [],
                createdAt: String(t.createdAt || 'Restored'),
                updatedAt: String(t.updatedAt || 'Restored'),
                timestampMs: BigInt(Number(t.timestamp) || Date.now()),
              },
            });
          }
        }

        if (Array.isArray(payload.cmhProjects)) {
          for (const p of payload.cmhProjects) {
            if (!p?.id) continue;
            await tx.cmhProject.upsert({
              where: { id: String(p.id) },
              update: { title: String(p.title || 'Project'), status: String(p.status || 'Active') },
              create: {
                id: String(p.id),
                title: String(p.title || 'Project'),
                description: String(p.description || ''),
                formTemplateId: String(p.formTemplateId || ''),
                formTemplateTitle: String(p.formTemplateTitle || ''),
                status: String(p.status || 'Active'),
                priority: String(p.priority || 'High'),
                deadline: p.deadline || '',
                budget: p.budget || '',
                accessMode: String(p.accessMode || 'PUBLIC'),
                assignedMemberIdsJson: p.assignedMemberIds || [],
                assignedTeamIdsJson: p.assignedTeamIds || [],
                customFieldValuesJson: p.customFieldValues || {},
                submissionsJson: p.submissions || [],
                createdAt: String(p.createdAt || 'Restored'),
                updatedAt: String(p.updatedAt || 'Restored'),
                timestampMs: BigInt(Number(p.timestamp) || Date.now()),
              },
            });
          }
        }
      });

      for (const col of ENGINE_COLLECTIONS) {
        if (Array.isArray(payload[col])) {
          for (const item of payload[col]) {
            if (item && typeof item === 'object') {
              await saveEngineRecordInDb(col, item);
            }
          }
        }
      }

      res.json({ ok: true, message: 'Workspace database backup restored to PostgreSQL!' });
    })
  );
}
