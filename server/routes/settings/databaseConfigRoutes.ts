import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  buildPostgresConnectionUrl,
  checkPrismaHealth,
  DEFAULT_ADMIN_USERNAME,
  getPostgresDbStats,
  hasConfiguredDatabaseUrl,
  parsePostgresUrlInfo,
  prisma,
  pushPrismaSchemaToPostgres,
  queryPostgres,
  reinitializePostgresClient,
} from '../../db/prisma';
import { ensureWorkspaceBootstrap, getPrimaryAdminIdentity } from '../../db/initEngine';
import { asyncHandler } from '../../realtime';

export function registerDatabaseConfigRoutes(app: express.Express) {
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
}
