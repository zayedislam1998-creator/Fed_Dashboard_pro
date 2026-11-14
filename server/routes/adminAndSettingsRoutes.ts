import express from 'express';
import { requireAdmin, requireAuth } from '../auth/sessionAuth';
import { registerAdminAuthRoutes } from './settings/adminAuthRoutes';
import { registerDatabaseConfigRoutes } from './settings/databaseConfigRoutes';
import { registerWorkspaceSettingsRoutes } from './settings/workspaceSettingsRoutes';
import { registerStorageBackupRoutes } from './settings/storageBackupRoutes';

export function registerAdminAndSettingsRoutes(app: express.Express) {
  // Security route guards
  app.use('/api/auth/admin', requireAuth, requireAdmin);
  app.use('/api/db/config', requireAuth, requireAdmin);
  app.use('/api/db/catalog', requireAuth, requireAdmin);
  app.use('/api/settings', requireAuth, requireAdmin);

  // Register modularized settings & database sub-routers
  registerDatabaseConfigRoutes(app);
  registerAdminAuthRoutes(app);
  registerWorkspaceSettingsRoutes(app);
  registerStorageBackupRoutes(app);
}
