import express from 'express';
import {
  prisma,
  DEFAULT_ADMIN_USERNAME,
  encryptSecret,
} from '../../db/prisma';
import { ensureWorkspaceBootstrap } from '../../db/initEngine';
import { toSystemSettingsDto, toCmhRulesDto } from '../../db/mappers';
import { asyncHandler } from '../../realtime';

export function registerWorkspaceSettingsRoutes(app: express.Express) {
  // Finance Branding
  app.get(
    '/api/settings/finance-branding',
    asyncHandler(async (_req, res) => {
      await ensureWorkspaceBootstrap();
      const sysRow = await prisma.workspaceSystemSetting.findUnique({ where: { id: 'default' } });
      const cfg =
        sysRow?.postgresConfigJson && typeof sysRow.postgresConfigJson === 'object'
          ? (sysRow.postgresConfigJson as Record<string, any>)
          : {};
      res.json({ ok: true, brandLogoUrl: String(cfg.financeBrandLogoUrl || '') });
    })
  );

  app.put(
    '/api/settings/finance-branding',
    asyncHandler(async (req, res) => {
      await ensureWorkspaceBootstrap();
      const brandLogoUrl = String(req.body?.brandLogoUrl || '').trim();
      const sysRow = await prisma.workspaceSystemSetting.findUnique({ where: { id: 'default' } });
      const prevCfg =
        sysRow?.postgresConfigJson && typeof sysRow.postgresConfigJson === 'object'
          ? (sysRow.postgresConfigJson as Record<string, any>)
          : {};
      await prisma.workspaceSystemSetting.update({
        where: { id: 'default' },
        data: {
          postgresConfigJson: {
            ...prevCfg,
            financeBrandLogoUrl: brandLogoUrl,
          },
        },
      });
      res.json({ ok: true, brandLogoUrl });
    })
  );

  // System Settings GET
  app.get(
    '/api/settings/system',
    asyncHandler(async (_req, res) => {
      await ensureWorkspaceBootstrap();
      const [
        sysRow,
        rulesRow,
        gmailAccounts,
        serverAccounts,
        messages,
        docs,
        slides,
        forms,
        meetings,
        members,
        tasks,
        projects,
        files,
      ] = await Promise.all([
        prisma.workspaceSystemSetting.findUniqueOrThrow({ where: { id: 'default' } }),
        prisma.cmhNotificationRule.findUniqueOrThrow({ where: { id: 'cmh-rules-default' } }),
        prisma.gmailAccount.count(),
        prisma.serverMailAccount.count(),
        prisma.mailMessage.count(),
        prisma.workspaceDoc.count(),
        prisma.workspaceSlide.count(),
        prisma.workspaceForm.count(),
        prisma.workspaceMeeting.count(),
        prisma.workspaceMember.count(),
        prisma.cmhTask.count(),
        prisma.cmhProject.count(),
        prisma.workspaceFile.count(),
      ]);

      res.json({
        settings: toSystemSettingsDto(sysRow),
        cmhRules: toCmhRulesDto(rulesRow),
        stats: {
          gmailAccounts,
          serverAccounts,
          messages,
          docs,
          slides,
          forms,
          meetings,
          members,
          tasks,
          projects,
          files,
        },
      });
    })
  );

  // System Settings POST
  app.post(
    '/api/settings/system',
    asyncHandler(async (req, res) => {
      await ensureWorkspaceBootstrap();
      const incoming = req.body?.settings || req.body || {};
      const prev = await prisma.workspaceSystemSetting.findUniqueOrThrow({
        where: { id: 'default' },
      });
      const updatedAt = new Date().toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const nextData = {
        workspaceName: String(incoming.workspaceName ?? prev.workspaceName).trim() || 'Workspace Pro',
        organizationName: String(incoming.organizationName ?? prev.organizationName).trim(),
        adminEmail: String(incoming.adminEmail ?? prev.adminEmail).trim() || DEFAULT_ADMIN_USERNAME,
        timezone: String(incoming.timezone ?? prev.timezone).trim() || 'Asia/Dhaka',
        dateFormat: String(incoming.dateFormat ?? prev.dateFormat).trim() || 'MMM DD, YYYY',
        defaultLandingModule:
          String(incoming.defaultLandingModule ?? prev.defaultLandingModule).trim() || 'gmail',
        autoSyncIntervalSec: Math.max(
          5,
          Number(incoming.autoSyncIntervalSec ?? prev.autoSyncIntervalSec) || 15
        ),
        densityMode: incoming.densityMode === 'compact' ? 'compact' : 'comfortable',
        defaultSignatureHtml: String(incoming.defaultSignatureHtml ?? prev.defaultSignatureHtml),
        defaultReplyTo: String(incoming.defaultReplyTo ?? prev.defaultReplyTo).trim(),
        bulkDelayMs: Math.max(100, Number(incoming.bulkDelayMs ?? prev.bulkDelayMs) || 400),
        dailySendLimit: Math.max(10, Number(incoming.dailySendLimit ?? prev.dailySendLimit) || 500),
        enableReadReceipts: Boolean(incoming.enableReadReceipts ?? prev.enableReadReceipts),
        autoSaveAttachmentsToFiles: Boolean(
          incoming.autoSaveAttachmentsToFiles ?? prev.autoSaveAttachmentsToFiles
        ),
        enablePublicForms: Boolean(incoming.enablePublicForms ?? prev.enablePublicForms),
        enablePublicCmhPortal: Boolean(incoming.enablePublicCmhPortal ?? prev.enablePublicCmhPortal),
        incomingWebhookSecret:
          String(incoming.incomingWebhookSecret ?? prev.incomingWebhookSecret).trim() ||
          prev.incomingWebhookSecret,
        outgoingWebhookUrl: String(incoming.outgoingWebhookUrl ?? prev.outgoingWebhookUrl).trim(),
        updatedAt,
      };

      const result = await prisma.$transaction(async (tx) => {
        const savedSettings = await tx.workspaceSystemSetting.update({
          where: { id: 'default' },
          data: nextData,
        });

        let savedRules = await tx.cmhNotificationRule.findUnique({
          where: { id: 'cmh-rules-default' },
        });
        if (req.body?.cmhRules) {
          const r = req.body.cmhRules;
          savedRules = await tx.cmhNotificationRule.update({
            where: { id: 'cmh-rules-default' },
            data: {
              ...(r.adminEmail !== undefined ? { adminEmail: String(r.adminEmail).trim() } : {}),
              ...(r.notifyOnFormSubmit !== undefined
                ? { notifyOnFormSubmit: Boolean(r.notifyOnFormSubmit) }
                : {}),
              ...(r.notifyOnTaskActivity !== undefined
                ? { notifyOnTaskActivity: Boolean(r.notifyOnTaskActivity) }
                : {}),
              ...(r.notifyOnProjectActivity !== undefined
                ? { notifyOnProjectActivity: Boolean(r.notifyOnProjectActivity) }
                : {}),
              ...(r.notifyOnMemberActivity !== undefined
                ? { notifyOnMemberActivity: Boolean(r.notifyOnMemberActivity) }
                : {}),
              ...(r.autoSendAdminEmail !== undefined
                ? { autoSendAdminEmail: Boolean(r.autoSendAdminEmail) }
                : {}),
              ...(r.injectIntoPrimaryInbox !== undefined
                ? { injectIntoPrimaryInbox: Boolean(r.injectIntoPrimaryInbox) }
                : {}),
              updatedAt,
            },
          });
        }

        return { savedSettings, savedRules };
      });

      res.json({
        ok: true,
        settings: toSystemSettingsDto(result.savedSettings),
        cmhRules: result.savedRules ? toCmhRulesDto(result.savedRules) : undefined,
      });
    })
  );

  // External Integrations
  app.post(
    '/api/settings/integrations',
    asyncHandler(async (req, res) => {
      await ensureWorkspaceBootstrap();
      const { providerType, label, endpointOrHost, clientIdOrKey, secretKey } = req.body || {};
      if (!label || !secretKey) {
        res.status(400).json({ error: 'Integration label and secret key/token are required.' });
        return;
      }

      const sysRow = await prisma.workspaceSystemSetting.findUniqueOrThrow({
        where: { id: 'default' },
      });
      const prevList = Array.isArray(sysRow.externalIntegrationsJson)
        ? (sysRow.externalIntegrationsJson as any[])
        : [];

      const newItem = {
        id: `ext-${Date.now()}`,
        providerType: providerType || 'CUSTOM_API',
        label: String(label).trim(),
        endpointOrHost: String(endpointOrHost || '').trim(),
        clientIdOrKey: String(clientIdOrKey || '').trim(),
        secretPreview: `${String(secretKey).slice(0, 4)}••••••••${String(secretKey).slice(-3)}`,
        encryptedSecret: encryptSecret(String(secretKey)),
        isActive: true,
        createdAt: new Date().toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
      };

      const nextList = [newItem, ...prevList];
      await prisma.workspaceSystemSetting.update({
        where: { id: 'default' },
        data: { externalIntegrationsJson: nextList },
      });

      res.json({
        ok: true,
        integrations: nextList.map((e) => ({ ...e, encryptedSecret: undefined })),
      });
    })
  );

  app.delete(
    '/api/settings/integrations/:id',
    asyncHandler(async (req, res) => {
      await ensureWorkspaceBootstrap();
      const { id } = req.params;
      const sysRow = await prisma.workspaceSystemSetting.findUniqueOrThrow({
        where: { id: 'default' },
      });
      const prevList = Array.isArray(sysRow.externalIntegrationsJson)
        ? (sysRow.externalIntegrationsJson as any[])
        : [];
      const nextList = prevList.filter((e) => e.id !== id);
      await prisma.workspaceSystemSetting.update({
        where: { id: 'default' },
        data: { externalIntegrationsJson: nextList },
      });
      res.json({
        ok: true,
        integrations: nextList.map((e) => ({ ...e, encryptedSecret: undefined })),
      });
    })
  );
}
