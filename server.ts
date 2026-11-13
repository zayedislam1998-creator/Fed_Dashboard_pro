import './server/env';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  hasConfiguredDatabaseUrl,
  prisma,
  THUMBS_DIR,
  UPLOADS_DIR,
} from './server/db/prisma';
import {
  checkPostgresHealth,
  closePostgresPool,
} from './server/services/postgresConnectionService';
import { ensureWorkspaceBootstrap, syncWorkspaceUsersToMembers } from './server/db/initEngine';
import { attachAuthContext } from './server/auth/sessionAuth';
import { registerRealtimeAndNotificationRoutes } from './server/realtime';
import {
  registerMailAndCampaignRoutes,
  startImapBackgroundWatcher,
} from './server/mail/mailEngine';
import { registerAdminAndSettingsRoutes } from './server/routes/adminAndSettingsRoutes';
import { registerAuthAndAdminPanelRoutes } from './server/routes/authAndAdminPanelRoutes';
import { registerGeoRoutes } from './server/routes/geoRoutes';
import { registerMemberPortalRoutes } from './server/routes/memberPortalRoutes';
import { registerWorkspaceContentRoutes } from './server/routes/workspaceContentRoutes';
import { registerCmhAndEngineRoutes } from './server/routes/cmhAndEngineRoutes';
import { registerFileAndEngineRoutes } from './server/routes/fileAndEngineRoutes';
import { registerCommunicationRoutes } from './server/routes/communicationRoutes';

const app = express();
app.set('trust proxy', 1);
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '55mb' }));
app.use(attachAuthContext);

// Strictly disable browser caching across all API endpoints (SSE overrides in route)
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Authorized thumbnail serving (zero browser cache)
app.get('/uploads/.thumbs/:filename', async (req, res) => {
  const safeName = path.basename(decodeURIComponent(req.params.filename || ''));
  if (!safeName) {
    res.status(400).json({ error: 'Invalid thumbnail name.' });
    return;
  }
  if (!req.auth) {
    res.status(401).json({ error: 'Sign in required.' });
    return;
  }
  const fullPath = path.join(THUMBS_DIR, safeName);
  if (!fs.existsSync(fullPath)) {
    res.status(404).json({ error: 'Thumbnail not found.' });
    return;
  }

  try {
    const thumbUrl = `/uploads/.thumbs/${safeName}`;
    const thumbUrlEncoded = `/uploads/.thumbs/${encodeURIComponent(safeName)}`;
    const fileRecord = await prisma.workspaceFile.findFirst({
      where: {
        OR: [{ thumbnailUrl: thumbUrl }, { thumbnailUrl: thumbUrlEncoded }],
      },
    });

    if (!fileRecord) {
      if (!req.auth.capabilities.isAdmin) {
        res.status(403).json({ error: 'Access denied.' });
        return;
      }
    } else if (
      !req.auth.capabilities.isAdmin &&
      fileRecord.ownerUserId !== req.auth.user.id &&
      fileRecord.visibility !== 'WORKSPACE' &&
      fileRecord.visibility !== 'PUBLIC'
    ) {
      const share = await prisma.resourceShare.findUnique({
        where: {
          resourceType_resourceId_targetUserId: {
            resourceType: 'FILE',
            resourceId: fileRecord.id,
            targetUserId: req.auth.user.id,
          },
        },
      });
      if (!share) {
        res.status(403).json({ error: 'You do not have access to this private thumbnail.' });
        return;
      }
    }

    res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.sendFile(fullPath);
  } catch {
    res.status(500).json({ error: 'Unable to verify thumbnail access.' });
  }
});

// Authorized file access (supports Unicode filenames, zero browser cache)
app.get('/uploads/:filename', async (req, res) => {
  let decodedParam = req.params.filename || '';
  try {
    decodedParam = decodeURIComponent(decodedParam);
  } catch {
    // keep raw if malformed
  }
  const safeName = path.basename(decodedParam);
  if (!safeName) {
    res.status(400).json({ error: 'Invalid file name.' });
    return;
  }
  const fullPath = path.join(UPLOADS_DIR, safeName);

  try {
    const encodedUrl = `/uploads/${encodeURIComponent(safeName)}`;
    const rawUrl = `/uploads/${safeName}`;
    const fileRecord = await prisma.workspaceFile.findFirst({
      where: {
        OR: [
          { url: encodedUrl },
          { url: rawUrl },
          { storagePath: `external/uploads/${safeName}` },
        ],
      },
    });

    if (fileRecord?.visibility === 'PUBLIC') {
      if (!fs.existsSync(fullPath)) {
        res.status(404).json({ error: 'File not found.' });
        return;
      }
      res.setHeader('Cache-Control', 'public, no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.sendFile(fullPath);
      return;
    }

    if (!req.auth) {
      res.status(401).json({ error: 'Sign in required to access this file.' });
      return;
    }

    if (!fs.existsSync(fullPath)) {
      res.status(404).json({ error: 'File not found.' });
      return;
    }

    if (!fileRecord) {
      if (!req.auth.capabilities.isAdmin) {
        res.status(403).json({ error: 'Access denied.' });
        return;
      }
      res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.sendFile(fullPath);
      return;
    }

    if (
      req.auth.capabilities.isAdmin ||
      fileRecord.ownerUserId === req.auth.user.id ||
      fileRecord.visibility === 'WORKSPACE'
    ) {
      res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.sendFile(fullPath);
      return;
    }

    const share = await prisma.resourceShare.findUnique({
      where: {
        resourceType_resourceId_targetUserId: {
          resourceType: 'FILE',
          resourceId: fileRecord.id,
          targetUserId: req.auth.user.id,
        },
      },
    });
    if (share) {
      res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.sendFile(fullPath);
      return;
    }

    res.status(403).json({ error: 'You do not have access to this private file.' });
  } catch {
    res.status(500).json({ error: 'Unable to verify file access.' });
  }
});

// Register all PostgreSQL API modules
registerRealtimeAndNotificationRoutes(app);
registerGeoRoutes(app);
registerAuthAndAdminPanelRoutes(app);
registerMemberPortalRoutes(app);
registerAdminAndSettingsRoutes(app);
registerMailAndCampaignRoutes(app);
registerWorkspaceContentRoutes(app);
registerFileAndEngineRoutes(app);
registerCmhAndEngineRoutes(app);
registerCommunicationRoutes(app);

async function startServer() {
  if (hasConfiguredDatabaseUrl()) {
    const health = await checkPostgresHealth();
    if (health.connected && health.schemaReady) {
      try {
        await ensureWorkspaceBootstrap();
        await syncWorkspaceUsersToMembers();
        console.log(
          `PostgreSQL connected via pg.Pool + Prisma (${health.host}:${health.port}/${health.database}, ${health.tableCount} tables).`
        );
      } catch (err: any) {
        console.warn('Workspace bootstrap warning:', err?.message || err);
      }
    } else {
      console.warn(`PostgreSQL status: ${health.error || 'Schema push pending'}`);
    }
  } else {
    try {
      await ensureWorkspaceBootstrap();
      await syncWorkspaceUsersToMembers();
      console.log(
        'Staging memory mode active — login and dashboard ready. Connect PostgreSQL DATABASE_URL anytime in Settings -> PostgreSQL & Backup.'
      );
    } catch (err: any) {
      console.warn('Staging bootstrap warning:', err?.message || err);
    }
  }

  startImapBackgroundWatcher();

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(
      express.static(distPath, {
        etag: false,
        lastModified: false,
        setHeaders: (res) => {
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
        },
      })
    );
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const httpServer = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });

  const gracefulShutdown = async () => {
    httpServer.close();
    await Promise.all([
      prisma.$disconnect().catch(() => {}),
      closePostgresPool().catch(() => {}),
    ]);
    process.exit(0);
  };
  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);
}

startServer();
