import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  buildPostgresConnectionUrl,
  checkPrismaHealth,
  DEFAULT_ADMIN_USERNAME,
  encryptSecret,
  getPostgresDbStats,
  hashPasswordScrypt,
  hasConfiguredDatabaseUrl,
  parsePostgresUrlInfo,
  prisma,
  pushPrismaSchemaToPostgres,
  queryPostgres,
  reinitializePostgresClient,
  verifyPasswordScrypt,
} from '../db/prisma';
import { ensureWorkspaceBootstrap, getPrimaryAdminIdentity } from '../db/initEngine';
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
} from '../db/mappers';
import { ENGINE_COLLECTIONS, listEngineRecords, saveEngineRecordInDb } from '../db/enginesRepo';
import { requireAdmin, requireAuth } from '../auth/sessionAuth';
import { asyncHandler } from '../realtime';
import {
  getVpsStorageDiagnostics,
  runSmartStorageCleanup,
} from '../services/storageService';

export function registerAdminAndSettingsRoutes(app: express.Express) {
  app.use('/api/auth/admin', requireAuth, requireAdmin);
  app.use('/api/db/config', requireAuth, requireAdmin);
  app.use('/api/db/catalog', requireAuth, requireAdmin);
  app.use('/api/settings', requireAuth, requireAdmin);

  app.get('/api/health', async (req, res) => {
    const configured = hasConfiguredDatabaseUrl();
    const health = await checkPrismaHealth();
    const isOk = !configured || (health.connected && health.schemaReady);

    if (!req.auth?.capabilities?.isAdmin) {
      res.status(isOk ? 200 : 503).json({
        ok: isOk,
        status: isOk ? 'ok' : 'degraded',
      });
      return;
    }

    let adminUsername = DEFAULT_ADMIN_USERNAME;
    if (isOk) {
      const admin = await getPrimaryAdminIdentity().catch(() => null);
      if (admin) adminUsername = admin.username;
    }
    res.status(isOk ? 200 : 503).json({
      ok: isOk,
      driver: configured ? 'pg+prisma' : 'staging-memory',
      orm: 'prisma',
      engine: configured ? 'postgresql' : 'staging-memory',
      configured: health.configured,
      host: health.host,
      port: health.port,
      database: health.database,
      ssl: health.ssl,
      connected: health.connected,
      schemaReady: health.schemaReady,
      tableCount: health.tableCount,
      serverVersion: health.serverVersion,
      pool: health.pool,
      adminUsername,
      ...(health.error ? { error: health.error } : {}),
    });
  });

  // ============================================================================
  // ADMINISTRATOR IDENTITY & PASSWORD SETUP
  // ============================================================================

  app.get(
    '/api/auth/admin',
    asyncHandler(async (_req, res) => {
      await ensureWorkspaceBootstrap();
      const admin = await prisma.workspaceUser.findFirst({
        where: { role: { in: ['OWNER', 'ADMIN'] } },
        orderBy: { timestampMs: 'asc' },
      });
      if (!admin) {
        res.status(404).json({ error: 'Administrator account not found.' });
        return;
      }
      res.json({ admin: sanitizeAdminUser(admin) });
    })
  );

  app.post(
    '/api/auth/admin/profile',
    asyncHandler(async (req, res) => {
      await ensureWorkspaceBootstrap();
      const { name, email, username, avatarUrl } = req.body || {};
      const existing = await prisma.workspaceUser.findFirst({
        where: { role: { in: ['OWNER', 'ADMIN'] } },
        orderBy: { timestampMs: 'asc' },
      });
      if (!existing) {
        res.status(404).json({ error: 'Administrator account not found.' });
        return;
      }

      const nextUsername = String(username ?? email ?? existing.username).trim();
      const nextEmail = String(email ?? username ?? existing.email).trim();
      const nextName = String(name ?? existing.name).trim() || existing.name;
      const nowStr = new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      const updated = await prisma.$transaction(async (tx) => {
        const userRow = await tx.workspaceUser.update({
          where: { id: existing.id },
          data: {
            username: nextUsername,
            email: nextEmail,
            name: nextName,
            ...(avatarUrl !== undefined ? { avatarUrl: avatarUrl || null } : {}),
            updatedAt: nowStr,
          },
        });
        await tx.workspaceSystemSetting.updateMany({
          where: { id: 'default' },
          data: { adminEmail: nextEmail, updatedAt: nowStr },
        });
        await tx.cmhNotificationRule.updateMany({
          where: { id: 'cmh-rules-default' },
          data: { adminEmail: nextEmail, updatedAt: nowStr },
        });
        return userRow;
      });

      res.json({ ok: true, admin: sanitizeAdminUser(updated) });
    })
  );

  app.post(
    '/api/auth/admin/password',
    asyncHandler(async (req, res) => {
      await ensureWorkspaceBootstrap();
      const { currentPassword, newPassword } = req.body || {};
      if (!newPassword || String(newPassword).length < 6) {
        res.status(400).json({ error: 'New password must be at least 6 characters.' });
        return;
      }
      const existing = await prisma.workspaceUser.findFirst({
        where: { role: { in: ['OWNER', 'ADMIN'] } },
        orderBy: { timestampMs: 'asc' },
      });
      if (!existing) {
        res.status(404).json({ error: 'Administrator account not found.' });
        return;
      }
      if (existing.passwordSet && existing.passwordHash) {
        if (!currentPassword || !verifyPasswordScrypt(String(currentPassword), existing.passwordHash)) {
          res.status(403).json({ error: 'Current password does not match.' });
          return;
        }
      }

      const nowStr = new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      const newHash = hashPasswordScrypt(String(newPassword));
      const updated = await prisma.workspaceUser.update({
        where: { id: existing.id },
        data: {
          passwordHash: newHash,
          passwordSet: true,
          updatedAt: nowStr,
        },
      });
      res.json({ ok: true, admin: sanitizeAdminUser(updated) });
    })
  );

  // ============================================================================
  // PURE POSTGRESQL CONFIG, PRISMA SCHEMA PUSH & HEALTH DIAGNOSTICS
  // ============================================================================

  app.get('/api/db/config', async (_req, res) => {
    const health = await checkPrismaHealth();
    const envInfo = parsePostgresUrlInfo(process.env.DATABASE_URL);
    const dbStats = await getPostgresDbStats();

    let prismaSchema = '';
    try {
      const schemaPath = path.resolve(process.cwd(), 'prisma/schema.prisma');
      if (fs.existsSync(schemaPath)) {
        prismaSchema = fs.readFileSync(schemaPath, 'utf-8');
      }
    } catch {
      // ignore
    }

    let storedPgCfg: Record<string, any> = {};
    let stats = {
      accounts: 0,
      gmailAccounts: 0,
      messages: 0,
      docs: 0,
      slides: 0,
      forms: 0,
      meetings: 0,
      members: 0,
      tasks: 0,
      projects: 0,
      files: 0,
      submissions: 0,
    };

    if (!health.configured || (health.connected && health.schemaReady)) {
      try {
        await ensureWorkspaceBootstrap();
        const [
          sysRow,
          accounts,
          gmailAccounts,
          messages,
          docs,
          slides,
          forms,
          meetings,
          members,
          tasks,
          projects,
          files,
          submissions,
        ] = await Promise.all([
          prisma.workspaceSystemSetting.findUnique({ where: { id: 'default' } }),
          prisma.serverMailAccount.count(),
          prisma.gmailAccount.count(),
          prisma.mailMessage.count(),
          prisma.workspaceDoc.count(),
          prisma.workspaceSlide.count(),
          prisma.workspaceForm.count(),
          prisma.workspaceMeeting.count(),
          prisma.workspaceMember.count(),
          prisma.cmhTask.count(),
          prisma.cmhProject.count(),
          prisma.workspaceFile.count({ where: { deletedAt: null } }),
          prisma.formSubmission.count(),
        ]);

        if (sysRow?.postgresConfigJson && typeof sysRow.postgresConfigJson === 'object') {
          storedPgCfg = sysRow.postgresConfigJson as Record<string, any>;
        }
        stats = {
          accounts,
          gmailAccounts,
          messages,
          docs,
          slides,
          forms,
          meetings,
          members,
          tasks,
          projects,
          files,
          submissions,
        };
      } catch {
        // leave zero counts
      }
    }

    res.json({
      config: {
        enabled: health.connected && health.schemaReady,
        mode: 'postgresql-prisma',
        connectionString: envInfo.maskedUrl,
        host: envInfo.host || storedPgCfg.host || 'localhost',
        port: envInfo.port || storedPgCfg.port || 5432,
        database: envInfo.database || storedPgCfg.database || 'workspace_pro',
        user: envInfo.user || storedPgCfg.user || 'postgres',
        ssl: envInfo.ssl,
        autoMigrateOnStartup: storedPgCfg.autoMigrateOnStartup ?? true,
        dbFileSizeBytes: dbStats.sizeBytes,
        serverVersion: dbStats.serverVersion,
        lastMigratedAt: storedPgCfg.lastMigratedAt,
        statusMessage:
          health.connected && health.schemaReady
            ? `PostgreSQL Connected (${envInfo.host}:${envInfo.port}/${envInfo.database}${dbStats.serverVersion ? ` · ${dbStats.serverVersion}` : ''})`
            : !health.configured
            ? 'Staging Mode Active — paste your PostgreSQL DATABASE_URL below whenever ready to connect.'
            : health.error || 'PostgreSQL connection pending.',
      },
      schemaSql: `-- Managed automatically by Prisma ORM (npx prisma db push)\n-- Provider: postgresql\n-- DATABASE_URL: ${envInfo.maskedUrl || 'postgresql://user:password@host:5432/workspace_pro?schema=public'}`,
      prismaSchema,
      stats,
    });
  });

  app.post(
    '/api/db/config',
    asyncHandler(async (req, res) => {
      const {
        connectionString,
        host,
        port,
        database,
        user,
        password,
        ssl,
        autoMigrateOnStartup,
        testAndMigrateNow,
      } = req.body || {};

      let targetUrl = String(connectionString || '').trim();
      // Ignore if caller sent masked password unchanged
      if (targetUrl && targetUrl.includes('••••••••')) {
        targetUrl = process.env.DATABASE_URL || '';
      }

      if (!targetUrl && host) {
        targetUrl = buildPostgresConnectionUrl({
          host: String(host),
          port: Number(port) || 5432,
          database: String(database || 'workspace_pro'),
          user: String(user || 'postgres'),
          password: password ? String(password) : undefined,
          ssl: Boolean(ssl),
        });
      }

      if (!targetUrl) {
        targetUrl = (process.env.DATABASE_URL || '').trim();
      }

      if (!hasConfiguredDatabaseUrl(targetUrl)) {
        res.status(400).json({
          error: 'Valid PostgreSQL connection string (postgresql://...) is required.',
        });
        return;
      }

      let migrationOutput = '';
      if (testAndMigrateNow || targetUrl !== process.env.DATABASE_URL) {
        const pushRes = await pushPrismaSchemaToPostgres(targetUrl);
        migrationOutput = pushRes.output;
      } else {
        await reinitializePostgresClient(targetUrl, true);
      }

      const health = await checkPrismaHealth();
      const dbStats = await getPostgresDbStats();
      const envInfo = parsePostgresUrlInfo(targetUrl);
      const nowLabel = new Date().toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      if (health.connected && health.schemaReady) {
        await ensureWorkspaceBootstrap(true);
        const cfgPayload = {
          mode: 'postgresql-prisma',
          host: envInfo.host,
          port: envInfo.port,
          database: envInfo.database,
          user: envInfo.user,
          ssl: envInfo.ssl,
          autoMigrateOnStartup: Boolean(autoMigrateOnStartup ?? true),
          lastMigratedAt: nowLabel,
        };
        await prisma.workspaceSystemSetting.upsert({
          where: { id: 'default' },
          update: { postgresConfigJson: cfgPayload },
          create: {
            id: 'default',
            adminEmail: DEFAULT_ADMIN_USERNAME,
            incomingWebhookSecret: `whsec_${crypto.randomBytes(12).toString('hex')}`,
            postgresConfigJson: cfgPayload,
            updatedAt: nowLabel,
          },
        });
      }

      const message =
        health.connected && health.schemaReady
          ? `PostgreSQL (${envInfo.host}:${envInfo.port}/${envInfo.database}) verified & Prisma schema synced.`
          : health.error || 'PostgreSQL connection failed.';

      res.status(health.connected && health.schemaReady ? 200 : 400).json({
        ok: health.connected && health.schemaReady,
        migration: {
          ok: health.connected && health.schemaReady,
          message: migrationOutput ? `${message}\n${migrationOutput}` : message,
          tablesCreated: health.schemaReady
            ? [
                'workspace_users',
                'workspace_sessions',
                'workspace_members',
                'communication_conversations',
                'communication_messages',
                'workspace_resume_profiles',
                'workspace_corporate_websites',
                'workspace_files (+ folders/versions)',
                'workspace_docs / slides / forms / sheets',
                'cmh_projects / cmh_tasks / mail_messages',
              ]
            : [],
        },
        config: {
          enabled: health.connected && health.schemaReady,
          mode: 'postgresql-prisma',
          connectionString: envInfo.maskedUrl,
          host: envInfo.host,
          port: envInfo.port,
          database: envInfo.database,
          user: envInfo.user,
          ssl: envInfo.ssl,
          autoMigrateOnStartup: Boolean(autoMigrateOnStartup ?? true),
          dbFileSizeBytes: dbStats.sizeBytes,
          serverVersion: dbStats.serverVersion,
          lastMigratedAt: nowLabel,
          statusMessage: message,
        },
      });
    })
  );

  // ============================================================================
  // POSTGRESQL LIVE CATALOG & STATISTICS (Zero write lock, read-only system stats)
  // ============================================================================

  app.get('/api/db/catalog', async (_req, res) => {
    try {
      const configured = hasConfiguredDatabaseUrl();
      if (!configured) {
        return res.json({
          connected: false,
          configured: false,
          serverVersion: 'In-Memory Staging',
          host: 'localhost',
          port: 5432,
          database: 'memory_workspace',
          user: 'memory',
          ssl: false,
          maskedUrl: '',
          dbSizeBytes: 0,
          dbSizePretty: '0 KB',
          tableCount: 0,
          totalLiveRows: 0,
          activeConnections: 1,
          poolStatus: 'Memory (Staging)',
          authStatus: 'Staging / In-Memory',
          userCount: 1,
          sessionCount: 0,
          envSaved: false,
          syncedAt: new Date().toISOString(),
          tables: [],
        });
      }

      const envInfo = parsePostgresUrlInfo(process.env.DATABASE_URL);

      const [verRes, sizeRes, connRes, tablesRes, userCount, sessionCount] = await Promise.all([
        queryPostgres("SELECT split_part(version(), ',', 1) AS ver, version() AS full_ver;").catch(() => ({ rows: [] })),
        queryPostgres('SELECT pg_database_size(current_database()) AS db_size;').catch(() => ({ rows: [] })),
        queryPostgres('SELECT count(*) AS active_conns FROM pg_stat_activity WHERE datname = current_database();').catch(() => ({ rows: [{ active_conns: '1' }] })),
        queryPostgres(`
          SELECT
            relname AS table_name,
            COALESCE(n_live_tup, 0) AS row_count,
            pg_relation_size(relid) AS data_bytes,
            pg_indexes_size(relid) AS index_bytes,
            pg_total_relation_size(relid) AS total_bytes
          FROM pg_stat_user_tables
          ORDER BY total_bytes DESC, relname ASC;
        `).catch(() => ({ rows: [] })),
        prisma.workspaceUser.count().catch(() => 0),
        prisma.workspaceSession.count({ where: { revokedAt: null } }).catch(() => 0),
      ]);

      const rawVer = String(verRes.rows[0]?.ver || verRes.rows[0]?.full_ver || 'PostgreSQL 16');
      const verMatch = rawVer.match(/PostgreSQL\s+([\d.]+)/i);
      const serverVersion = verMatch ? `PostgreSQL ${verMatch[1]}` : rawVer;

      const dbSizeBytes = Number(sizeRes.rows[0]?.db_size || 0);

      const formatSize = (bytes: number): string => {
        if (!bytes || bytes <= 0) return '0.0 KB';
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
      };

      const dbSizePretty = formatSize(dbSizeBytes);
      const activeDbConns = Number(connRes.rows[0]?.active_conns || 1);

      const tables = (tablesRes.rows || []).map((r: any) => {
        const dataBytes = Number(r.data_bytes || 0);
        const indexBytes = Number(r.index_bytes || 0);
        const totalBytes = Number(r.total_bytes || 0);
        return {
          tableName: String(r.table_name),
          rowCount: Number(r.row_count || 0),
          dataSize: formatSize(dataBytes),
          indexSize: formatSize(indexBytes),
          totalSize: formatSize(totalBytes),
          totalBytes,
          dataBytes,
          indexBytes,
        };
      });

      const totalLiveRows = tables.reduce((acc: number, t: any) => acc + t.rowCount, 0);

      res.json({
        connected: true,
        configured: true,
        serverVersion,
        host: envInfo.host || 'localhost',
        port: envInfo.port || 5432,
        database: envInfo.database || 'fobana_dashboard',
        user: envInfo.user || 'postgres',
        ssl: envInfo.ssl,
        maskedUrl: envInfo.maskedUrl,
        dbSizeBytes,
        dbSizePretty,
        tableCount: tables.length,
        totalLiveRows,
        activeConnections: activeDbConns,
        poolStatus: `Pool ${Math.min(activeDbConns, 2)}/3`,
        authStatus: 'Admin Hash Saved (scrypt)',
        userCount,
        sessionCount,
        envSaved: Boolean(process.env.DATABASE_URL),
        syncedAt: new Date().toISOString(),
        tables,
      });
    } catch (err: any) {
      res.status(500).json({
        error: String(err?.message || 'Failed to query database catalog.'),
      });
    }
  });

  // ============================================================================
  // SYSTEM SETTINGS, VPS STORAGE DIAGNOSTICS, INTEGRATIONS & BACKUP/RESTORE
  // ============================================================================

  app.get(
    '/api/settings/storage',
    asyncHandler(async (_req, res) => {
      await ensureWorkspaceBootstrap();
      const storage = await getVpsStorageDiagnostics();
      res.json({ ok: true, storage });
    })
  );

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
