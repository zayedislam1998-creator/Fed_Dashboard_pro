import express from 'express';
import { prisma, hashPasswordScrypt, verifyPasswordScrypt } from '../../db/prisma';
import { ensureWorkspaceBootstrap } from '../../db/initEngine';
import { sanitizeAdminUser } from '../../db/mappers';
import { asyncHandler } from '../../realtime';

export function registerAdminAuthRoutes(app: express.Express) {
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
}
