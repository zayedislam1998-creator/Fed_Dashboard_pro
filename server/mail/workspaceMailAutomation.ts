import { createHash, randomUUID } from 'node:crypto';
import type { Express, Request, Response } from 'express';
import type { Prisma } from '@prisma/client';
import nodemailer from 'nodemailer';
import { requireAdmin, requireAuth } from '../auth/sessionAuth';
import {
  decryptSecret,
  encryptSecret,
  hashPasswordScrypt,
  isStagingMemoryMode,
  prisma,
} from '../db/prisma';
import { asyncHandler } from '../realtime';
import { recordAuditEvent } from '../auth/policy';

type MailDb = Pick<
  Prisma.TransactionClient,
  | 'workspaceMailDelivery'
  | 'workspaceSystemSetting'
  | 'workspaceMember'
  | 'cmhNotificationRule'
  | 'serverMailAccount'
  | 'gmailAccount'
  | 'workspaceMailAutomation'
>;

export interface UnifiedSystemSender {
  id: string;
  type: 'server_mail' | 'gmail';
  email: string;
  label: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  username: string;
  encryptedPassword: string;
  isSystemPrimary: boolean;
}

export function normalizeMailAddress(value: unknown): string {
  if (typeof value !== 'string') return '';
  const address = value.trim().toLowerCase();
  return address.length <= 254 && /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/.test(address)
    ? address
    : '';
}

/**
 * Resolves the active System Mail sender (Primary or Fallback).
 * Works across both Server Mail (custom domain) and Gmail accounts.
 */
export async function resolveActiveSystemSender(): Promise<UnifiedSystemSender | null> {
  // 1. Check workspaceMailAutomation config row
  const config = await prisma.workspaceMailAutomation.findUnique({ where: { id: 'default' } });

  if (config?.accountId) {
    if (config.senderType === 'gmail') {
      const g = await prisma.gmailAccount.findUnique({ where: { id: config.accountId } });
      if (g) {
        return {
          id: g.id,
          type: 'gmail',
          email: g.email,
          label: g.label || 'System Gmail',
          smtpHost: g.smtpHost || 'smtp.gmail.com',
          smtpPort: g.smtpPort || 465,
          smtpSecure: g.smtpSecure !== false,
          username: g.email,
          encryptedPassword: g.encryptedPassword,
          isSystemPrimary: true,
        };
      }
    } else {
      const s = await prisma.serverMailAccount.findUnique({ where: { id: config.accountId } });
      if (s) {
        return {
          id: s.id,
          type: 'server_mail',
          email: s.email,
          label: s.label || 'System Mail',
          smtpHost: s.smtpHost,
          smtpPort: s.smtpPort,
          smtpSecure: s.smtpSecure,
          username: s.username || s.email,
          encryptedPassword: s.encryptedPassword,
          isSystemPrimary: true,
        };
      }
    }
  }

  // 2. Check for any explicitly designated primary system mail
  const primaryServer = await prisma.serverMailAccount.findFirst({
    where: { isSystemPrimary: true },
  });
  if (primaryServer) {
    return {
      id: primaryServer.id,
      type: 'server_mail',
      email: primaryServer.email,
      label: primaryServer.label || 'System Mail',
      smtpHost: primaryServer.smtpHost,
      smtpPort: primaryServer.smtpPort,
      smtpSecure: primaryServer.smtpSecure,
      username: primaryServer.username || primaryServer.email,
      encryptedPassword: primaryServer.encryptedPassword,
      isSystemPrimary: true,
    };
  }

  const primaryGmail = await prisma.gmailAccount.findFirst({
    where: { isSystemPrimary: true },
  });
  if (primaryGmail) {
    return {
      id: primaryGmail.id,
      type: 'gmail',
      email: primaryGmail.email,
      label: primaryGmail.label || 'System Gmail',
      smtpHost: primaryGmail.smtpHost || 'smtp.gmail.com',
      smtpPort: primaryGmail.smtpPort || 465,
      smtpSecure: primaryGmail.smtpSecure !== false,
      username: primaryGmail.email,
      encryptedPassword: primaryGmail.encryptedPassword,
      isSystemPrimary: true,
    };
  }

  // 3. Fallback: Any account marked with role 'system'
  const systemServer = await prisma.serverMailAccount.findFirst({
    where: { role: 'system' },
  });
  if (systemServer) {
    return {
      id: systemServer.id,
      type: 'server_mail',
      email: systemServer.email,
      label: systemServer.label || 'System Mail',
      smtpHost: systemServer.smtpHost,
      smtpPort: systemServer.smtpPort,
      smtpSecure: systemServer.smtpSecure,
      username: systemServer.username || systemServer.email,
      encryptedPassword: systemServer.encryptedPassword,
      isSystemPrimary: false,
    };
  }

  const systemGmail = await prisma.gmailAccount.findFirst({
    where: { role: 'system' },
  });
  if (systemGmail) {
    return {
      id: systemGmail.id,
      type: 'gmail',
      email: systemGmail.email,
      label: systemGmail.label || 'System Gmail',
      smtpHost: systemGmail.smtpHost || 'smtp.gmail.com',
      smtpPort: systemGmail.smtpPort || 465,
      smtpSecure: systemGmail.smtpSecure !== false,
      username: systemGmail.email,
      encryptedPassword: systemGmail.encryptedPassword,
      isSystemPrimary: false,
    };
  }

  // 4. Fallback: Any connected Server Mail or Gmail account
  const anyServer = await prisma.serverMailAccount.findFirst();
  if (anyServer) {
    return {
      id: anyServer.id,
      type: 'server_mail',
      email: anyServer.email,
      label: anyServer.label,
      smtpHost: anyServer.smtpHost,
      smtpPort: anyServer.smtpPort,
      smtpSecure: anyServer.smtpSecure,
      username: anyServer.username || anyServer.email,
      encryptedPassword: anyServer.encryptedPassword,
      isSystemPrimary: false,
    };
  }

  const anyGmail = await prisma.gmailAccount.findFirst();
  if (anyGmail) {
    return {
      id: anyGmail.id,
      type: 'gmail',
      email: anyGmail.email,
      label: anyGmail.label,
      smtpHost: anyGmail.smtpHost || 'smtp.gmail.com',
      smtpPort: anyGmail.smtpPort || 465,
      smtpSecure: anyGmail.smtpSecure !== false,
      username: anyGmail.email,
      encryptedPassword: anyGmail.encryptedPassword,
      isSystemPrimary: false,
    };
  }

  return null;
}

/**
 * Creates a pooled Nodemailer transport for a verified sender.
 */
function createSmtpTransport(sender: UnifiedSystemSender) {
  let pass = '';
  try {
    pass = decryptSecret(sender.encryptedPassword);
  } catch {
    pass = '';
  }

  return nodemailer.createTransport({
    host: sender.smtpHost,
    port: sender.smtpPort,
    secure: sender.smtpSecure,
    pool: true,
    maxConnections: 3,
    maxMessages: 50,
    auth: { user: sender.username, pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    tls: { rejectUnauthorized: false },
  });
}

/**
 * Queues an automated workspace notification email.
 * Works seamlessly in both PostgreSQL and Memory Staging modes.
 */
export async function queueWorkspaceMail(
  event: string,
  recipients: unknown[],
  subject: string,
  body: string,
  db: MailDb = prisma,
  options?: { priority?: 'URGENT' | 'NORMAL' | 'DIGEST'; eventType?: string }
): Promise<number> {
  const addresses = [...new Set(recipients.map(normalizeMailAddress).filter(Boolean))];
  if (!addresses.length) return 0;

  const priority = options?.priority || 'NORMAL';
  const eventType = options?.eventType || event.split(':')[0] || 'GENERAL';

  try {
    const result = await db.workspaceMailDelivery.createMany({
      skipDuplicates: true,
      data: addresses.map((recipient) => ({
        id: createHash('sha256').update(JSON.stringify([event, recipient])).digest('hex'),
        recipient,
        subject: subject.replace(/[\r\n]/g, ' ').slice(0, 220),
        body: body.slice(0, 4000),
        priority,
        eventType,
      })),
    });
    return result.count;
  } catch (err) {
    console.warn('[WorkspaceMail] Failed to insert queue items:', err);
    return 0;
  }
}

/**
 * Queues an alert email to the configured Admin recipient.
 */
export async function queueAdminMail(
  event: string,
  subject: string,
  body: string,
  db: MailDb = prisma,
  options?: { priority?: 'URGENT' | 'NORMAL'; eventType?: string }
): Promise<number> {
  const settings = await db.workspaceSystemSetting.findUnique({
    where: { id: 'default' },
    select: { adminEmail: true },
  });
  const adminEmail = settings?.adminEmail || process.env.ADMIN_USERNAME || '';
  if (!adminEmail) return 0;
  return queueWorkspaceMail(event, [adminEmail], subject, body, db, {
    priority: options?.priority || 'NORMAL',
    eventType: options?.eventType || 'ADMIN_ALERT',
  });
}

/**
 * Queues an administrative submission alert when a form, task, or project activity occurs.
 */
export async function queueAdminSubmission(
  kind: 'form' | 'task' | 'project',
  id: string,
  title: string,
  db: MailDb = prisma
): Promise<number> {
  const rules = await db.cmhNotificationRule.findUnique({ where: { id: 'cmh-rules-default' } });
  const enabled =
    kind === 'form'
      ? rules?.notifyOnFormSubmit
      : kind === 'task'
        ? rules?.notifyOnTaskActivity
        : rules?.notifyOnProjectActivity;

  if (rules && (!rules.autoSendAdminEmail || !enabled)) return 0;

  return queueAdminMail(
    `submission:${kind}:${id}:${Date.now()}`,
    `[Submission Received] ${kind.toUpperCase()}: ${title}`,
    `A new ${kind} submission was recorded in Workspace Pro.\n\nItem: ${title}\nReference ID: ${id}\nTimestamp: ${new Date().toLocaleString()}\n\nSign in to your Workspace Pro Dashboard to review the submission.`,
    db,
    { priority: 'NORMAL', eventType: 'SUBMISSION' }
  );
}

/**
 * Queues notifications to members when a task or project is assigned.
 */
export async function queueDirectoryAssignments(
  kind: 'task' | 'project' | 'form',
  id: string,
  title: string,
  members: unknown,
  teams: unknown,
  db: MailDb = prisma,
  previous?: { members: unknown; teams: unknown },
  customMessage?: string
): Promise<number> {
  const ids = (value: unknown) =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

  const memberIds = ids(members);
  const teamIds = ids(teams);

  const directory = await db.workspaceMember.findMany({
    where: { OR: [{ id: { in: memberIds } }, { teamId: { in: teamIds } }] },
    select: { id: true, teamId: true, email: true },
  });

  const oldMembers = new Set(ids(previous?.members));
  const oldTeams = new Set(ids(previous?.teams));

  const recipients = directory.filter(
    (member) => !oldMembers.has(member.id) && !oldTeams.has(member.teamId || '')
  );

  return queueWorkspaceMail(
    `assignment:${kind}:${id}:${previous ? randomUUID() : 'initial'}`,
    recipients.map((member) => member.email),
    `[Assigned to You] ${kind === 'form' ? 'Invitation' : 'New Assignment'}: ${title}`,
    `Hello,\n\nYou have been assigned a new ${kind} in Workspace Pro: "${title}".\n\nPlease sign in to your Member Portal to review requirements and start progress.\n${customMessage ? `\nNote from assigner:\n${customMessage}\n` : ''}\nWorkspace Pro Automated System`,
    db,
    { priority: 'NORMAL', eventType: 'ASSIGNMENT' }
  );
}

/**
 * Processes queued mail deliveries in controlled batches with rate limiting & backoff.
 */
export async function deliverWorkspaceMailBatch(): Promise<{ processed: number; sent: number }> {
  const sender = await resolveActiveSystemSender();
  if (!sender) return { processed: 0, sent: 0 };

  const now = new Date();

  // Pick up to 8 due jobs, prioritizing URGENT items
  const jobs = await prisma.workspaceMailDelivery.findMany({
    where: {
      status: { in: ['PENDING', 'SENDING'] },
      nextAt: { lte: now },
    },
    orderBy: [
      { priority: 'desc' },
      { nextAt: 'asc' },
      { id: 'asc' },
    ],
    take: 8,
  });

  if (!jobs.length) return { processed: 0, sent: 0 };

  const transport = createSmtpTransport(sender);
  let sentCount = 0;

  try {
    for (const job of jobs) {
      const lease = new Date(Date.now() + 120000); // 2 minute lease
      const claim = await prisma.workspaceMailDelivery.updateMany({
        where: { id: job.id, status: job.status, nextAt: job.nextAt },
        data: { status: 'SENDING', nextAt: lease, attempts: { increment: 1 } },
      });

      if (!claim.count) continue;
      const attempts = job.attempts + 1;

      try {
        const fromAddress = sender.email;
        const fromLabel = sender.label || 'Workspace Pro';

        const result = await transport.sendMail({
          from: `"${fromLabel}" <${fromAddress}>`,
          to: job.recipient,
          subject: job.subject,
          text: job.body,
          messageId: `<${job.id}@${fromAddress.split('@').at(-1) || 'workspace.local'}>`,
        });

        if (!result.accepted.length) {
          throw new Error('Recipient was not accepted by SMTP server');
        }

        await prisma.workspaceMailDelivery.updateMany({
          where: { id: job.id, status: 'SENDING', nextAt: lease },
          data: { status: 'SENT', sentAt: new Date(), lastError: null },
        });
        sentCount++;
      } catch (error: any) {
        const code = error?.responseCode;
        const failed = attempts >= 5 || (typeof code === 'number' && code >= 500);
        const retryDelaySec = Math.min(3600, 30 * Math.pow(2, attempts - 1));

        await prisma.workspaceMailDelivery.updateMany({
          where: { id: job.id, status: 'SENDING', nextAt: lease },
          data: {
            status: failed ? 'FAILED' : 'PENDING',
            nextAt: new Date(Date.now() + retryDelaySec * 1000),
            lastError:
              typeof code === 'number'
                ? `SMTP ${code}: ${error?.message || 'Rejected'}`
                : error?.message || 'SMTP delivery error',
          },
        });
      }
    }
  } finally {
    transport.close();
  }

  return { processed: jobs.length, sent: sentCount };
}

/**
 * Background worker timer for Mail Queue.
 */
export function startWorkspaceMailWorker() {
  let active: Promise<any> | undefined;
  const timer = setInterval(() => {
    if (active) return;
    active = deliverWorkspaceMailBatch()
      .catch((error) => {
        // Suppress expected transient errors in worker loop
        const errCode = (error as { code?: string })?.code;
        if (errCode !== 'ECONNREFUSED' && errCode !== 'ETIMEDOUT') {
          console.warn('[Workspace Mail Worker] Delivery error:', error?.message || 'transient error');
        }
      })
      .finally(() => {
        active = undefined;
      });
  }, 3500);

  timer.unref();
  return async () => {
    clearInterval(timer);
    await active;
  };
}

/**
 * Registers all REST endpoints for Mailbox Roles, Dedicated System Mail & Notifications.
 */
export function registerWorkspaceMailAutomation(app: Express) {
  /**
   * GET /api/settings/mailboxes/overview
   * Returns unified metrics and role breakdown across all connected Gmail & Server Mail accounts.
   */
  app.get(
    '/api/settings/mailboxes/overview',
    requireAuth,
    requireAdmin,
    asyncHandler(async (_req: Request, res: Response) => {
      const [serverAccounts, gmailAccounts, systemSetting, automationConfig] = await Promise.all([
        prisma.serverMailAccount.findMany({
          orderBy: { createdAt: 'desc' },
        }),
        prisma.gmailAccount.findMany({
          orderBy: { createdAt: 'desc' },
        }),
        prisma.workspaceSystemSetting.findUnique({
          where: { id: 'default' },
          select: { adminEmail: true },
        }),
        prisma.workspaceMailAutomation.findUnique({
          where: { id: 'default' },
        }),
      ]);

      const primarySender = await resolveActiveSystemSender();

      const mailboxes = [
        ...serverAccounts.map((s) => ({
          id: s.id,
          type: 'server_mail' as const,
          label: s.label,
          email: s.email,
          role: s.role || 'general',
          isSystemPrimary:
            automationConfig?.accountId === s.id && automationConfig?.senderType === 'server_mail'
              ? true
              : s.isSystemPrimary,
          lastVerifiedAt: s.lastVerifiedAt,
          host: `${s.smtpHost}:${s.smtpPort}`,
        })),
        ...gmailAccounts.map((g) => ({
          id: g.id,
          type: 'gmail' as const,
          label: g.label,
          email: g.email,
          role: g.role || 'general',
          isSystemPrimary:
            automationConfig?.accountId === g.id && automationConfig?.senderType === 'gmail'
              ? true
              : g.isSystemPrimary,
          lastVerifiedAt: g.lastVerifiedAt,
          host: `${g.smtpHost || 'smtp.gmail.com'}:${g.smtpPort || 465}`,
        })),
      ];

      const totalCount = mailboxes.length;
      const systemCount = mailboxes.filter((m) => m.role === 'system' || m.isSystemPrimary).length;
      const generalCount = mailboxes.filter((m) => m.role === 'general').length;

      res.json({
        ok: true,
        totalCount,
        systemCount,
        generalCount,
        adminRecipient: systemSetting?.adminEmail || process.env.ADMIN_USERNAME || '',
        primarySystemMail: primarySender
          ? {
              id: primarySender.id,
              type: primarySender.type,
              email: primarySender.email,
              label: primarySender.label,
              host: `${primarySender.smtpHost}:${primarySender.smtpPort}`,
              isVerified: true,
            }
          : null,
        mailboxes,
      });
    })
  );

  /**
   * PUT /api/settings/mailboxes/:type/:id/role
   * Updates the role of a connected mailbox (system, admin, general, marketing).
   */
  app.put(
    '/api/settings/mailboxes/:type/:id/role',
    requireAuth,
    requireAdmin,
    asyncHandler(async (req: Request, res: Response) => {
      const type = req.params.type as 'server_mail' | 'gmail';
      const id = req.params.id;
      const role = String(req.body?.role || 'general').trim().toLowerCase();
      const setAsPrimary = Boolean(req.body?.isSystemPrimary);

      if (!['system', 'admin', 'general', 'marketing'].includes(role)) {
        res.status(400).json({ error: 'Invalid role. Choose system, admin, general, or marketing.' });
        return;
      }

      await prisma.$transaction(async (tx) => {
        if (setAsPrimary || role === 'system') {
          // Demote existing primaries if setting this one as primary
          if (setAsPrimary) {
            await tx.serverMailAccount.updateMany({ data: { isSystemPrimary: false } });
            await tx.gmailAccount.updateMany({ data: { isSystemPrimary: false } });
            await tx.workspaceMailAutomation.upsert({
              where: { id: 'default' },
              create: { id: 'default', accountId: id, senderType: type },
              update: { accountId: id, senderType: type },
            });
          }
        }

        if (type === 'gmail') {
          await tx.gmailAccount.update({
            where: { id },
            data: { role, isSystemPrimary: setAsPrimary },
          });
        } else {
          await tx.serverMailAccount.update({
            where: { id },
            data: { role, isSystemPrimary: setAsPrimary },
          });
        }
      });

      res.json({ ok: true, role, isSystemPrimary: setAsPrimary });
    })
  );

  /**
   * POST /api/settings/system-mail/add
   * Dedicated, clean single-step action to add a System Mail (Gmail or Server Mail) with instant verification.
   */
  app.post(
    '/api/settings/system-mail/add',
    requireAuth,
    requireAdmin,
    asyncHandler(async (req: Request, res: Response) => {
      const {
        type = 'server_mail',
        email,
        label,
        password,
        smtpHost = type === 'gmail' ? 'smtp.gmail.com' : 'mail.yourdomain.com',
        smtpPort = 465,
        smtpSecure = true,
        imapHost = type === 'gmail' ? 'imap.gmail.com' : 'mail.yourdomain.com',
        imapPort = 993,
        imapSecure = true,
        setAsPrimary = true,
      } = req.body || {};

      const cleanEmail = normalizeMailAddress(email);
      const cleanPass = String(password || '').trim();

      if (!cleanEmail || !cleanPass) {
        res.status(400).json({ error: 'Email address and password are required.' });
        return;
      }

      // 1. Verify SMTP connection before saving
      let smtpVerified = false;
      let verifyMessage = '';
      try {
        const testTransporter = nodemailer.createTransport({
          host: smtpHost,
          port: Number(smtpPort) || 465,
          secure: Boolean(smtpSecure),
          auth: { user: cleanEmail, pass: cleanPass },
          connectionTimeout: 8000,
          greetingTimeout: 8000,
          tls: { rejectUnauthorized: false },
        });
        await testTransporter.verify();
        smtpVerified = true;
        verifyMessage = `Connected successfully to ${smtpHost}:${smtpPort}`;
      } catch (err: any) {
        smtpVerified = false;
        verifyMessage = `SMTP Handshake warning: ${err?.message || 'Verification timed out'}`;
      }

      const id = `sysmail-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const nowIso = new Date().toISOString();
      const encPassword = encryptSecret(cleanPass);
      const passHash = hashPasswordScrypt(cleanPass);
      const cleanLabel = (label || '').trim() || (type === 'gmail' ? 'System Gmail' : 'System Mail');

      await prisma.$transaction(async (tx) => {
        if (setAsPrimary) {
          await tx.serverMailAccount.updateMany({ data: { isSystemPrimary: false } });
          await tx.gmailAccount.updateMany({ data: { isSystemPrimary: false } });
          await tx.workspaceMailAutomation.upsert({
            where: { id: 'default' },
            create: { id: 'default', accountId: id, senderType: type },
            update: { accountId: id, senderType: type },
          });
        }

        if (type === 'gmail') {
          await tx.gmailAccount.create({
            data: {
              id,
              label: cleanLabel,
              email: cleanEmail,
              username: cleanEmail,
              authMode: 'app_password',
              imapHost,
              imapPort: Number(imapPort) || 993,
              imapSecure: Boolean(imapSecure),
              smtpHost,
              smtpPort: Number(smtpPort) || 465,
              smtpSecure: Boolean(smtpSecure),
              passwordHash: passHash,
              encryptedPassword: encPassword,
              role: 'system',
              isSystemPrimary: Boolean(setAsPrimary),
              createdAt: nowIso,
              lastVerifiedAt: smtpVerified ? nowIso : null,
            },
          });
        } else {
          await tx.serverMailAccount.create({
            data: {
              id,
              label: cleanLabel,
              email: cleanEmail,
              username: cleanEmail,
              imapHost,
              imapPort: Number(imapPort) || 993,
              imapSecure: Boolean(imapSecure),
              smtpHost,
              smtpPort: Number(smtpPort) || 465,
              smtpSecure: Boolean(smtpSecure),
              passwordHash: passHash,
              encryptedPassword: encPassword,
              role: 'system',
              isSystemPrimary: Boolean(setAsPrimary),
              createdAt: nowIso,
              lastVerifiedAt: smtpVerified ? nowIso : null,
            },
          });
        }
      });

      res.json({
        ok: true,
        smtpVerified,
        verifyMessage,
        account: {
          id,
          type,
          email: cleanEmail,
          label: cleanLabel,
          role: 'system',
          isSystemPrimary: Boolean(setAsPrimary),
        },
      });
    })
  );

  /**
   * POST /api/settings/system-mail/test-connection
   * Verifies live SMTP handshake for the active System Mail dispatcher.
   */
  app.post(
    '/api/settings/system-mail/test-connection',
    requireAuth,
    requireAdmin,
    asyncHandler(async (_req: Request, res: Response) => {
      const sender = await resolveActiveSystemSender();
      if (!sender) {
        res.status(400).json({
          ok: false,
          error: 'No active System Mail configured. Please add or select a System Mail first.',
        });
        return;
      }

      const start = Date.now();
      try {
        const transport = createSmtpTransport(sender);
        await transport.verify();
        transport.close();
        const latencyMs = Date.now() - start;

        // Record verification timestamp
        const nowIso = new Date().toISOString();
        if (sender.type === 'gmail') {
          await prisma.gmailAccount.update({
            where: { id: sender.id },
            data: { lastVerifiedAt: nowIso },
          });
        } else {
          await prisma.serverMailAccount.update({
            where: { id: sender.id },
            data: { lastVerifiedAt: nowIso },
          });
        }

        res.json({
          ok: true,
          message: `Active System Mail (${sender.email}) is connected and ready to send.`,
          host: `${sender.smtpHost}:${sender.smtpPort}`,
          latencyMs,
          senderEmail: sender.email,
        });
      } catch (err: any) {
        res.status(502).json({
          ok: false,
          error: `SMTP connection failed for ${sender.email}: ${err?.message || 'Server did not respond'}`,
          host: `${sender.smtpHost}:${sender.smtpPort}`,
        });
      }
    })
  );

  /**
   * GET /api/settings/automation-mail
   * Returns automation sender configuration, admin recipient address, and recent deliveries.
   */
  app.get(
    '/api/settings/automation-mail',
    requireAuth,
    requireAdmin,
    asyncHandler(async (_req: Request, res: Response) => {
      const [config, settings, serverAccounts, gmailAccounts, deliveries] = await Promise.all([
        prisma.workspaceMailAutomation.findUnique({ where: { id: 'default' } }),
        prisma.workspaceSystemSetting.findUnique({
          where: { id: 'default' },
          select: { adminEmail: true },
        }),
        prisma.serverMailAccount.findMany({
          select: { id: true, label: true, email: true, role: true, isSystemPrimary: true },
          orderBy: { email: 'asc' },
        }),
        prisma.gmailAccount.findMany({
          select: { id: true, label: true, email: true, role: true, isSystemPrimary: true },
          orderBy: { email: 'asc' },
        }),
        prisma.workspaceMailDelivery.findMany({
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 20,
          select: {
            id: true,
            recipient: true,
            subject: true,
            status: true,
            attempts: true,
            lastError: true,
            createdAt: true,
          },
        }),
      ]);

      const allAccounts = [
        ...serverAccounts.map((s) => ({
          id: s.id,
          label: `${s.label} (Server Mail)`,
          email: s.email,
          type: 'server_mail',
          role: s.role,
        })),
        ...gmailAccounts.map((g) => ({
          id: g.id,
          label: `${g.label} (Gmail)`,
          email: g.email,
          type: 'gmail',
          role: g.role,
        })),
      ];

      res.json({
        accountId: config?.accountId || '',
        senderType: config?.senderType || 'server_mail',
        adminEmail: settings?.adminEmail || process.env.ADMIN_USERNAME || '',
        accounts: allAccounts,
        deliveries,
      });
    })
  );

  /**
   * PUT /api/settings/automation-mail
   * Updates the selected automated sender mailbox.
   */
  app.put(
    '/api/settings/automation-mail',
    requireAuth,
    requireAdmin,
    asyncHandler(async (req: Request, res: Response) => {
      const accountId =
        typeof req.body?.accountId === 'string' ? req.body.accountId.trim() || null : null;
      const senderType =
        req.body?.senderType === 'gmail' ? 'gmail' : 'server_mail';

      if (accountId) {
        if (senderType === 'gmail') {
          const acc = await prisma.gmailAccount.findUnique({ where: { id: accountId } });
          if (!acc) {
            res.status(400).json({ error: 'Selected Gmail account was not found.' });
            return;
          }
        } else {
          const acc = await prisma.serverMailAccount.findUnique({ where: { id: accountId } });
          if (!acc) {
            res.status(400).json({ error: 'Selected Server Mail account was not found.' });
            return;
          }
        }
      }

      const actor = req.auth!.user;
      await prisma.$transaction(async (tx) => {
        // Demote previous primaries
        await tx.serverMailAccount.updateMany({ data: { isSystemPrimary: false } });
        await tx.gmailAccount.updateMany({ data: { isSystemPrimary: false } });

        if (accountId) {
          if (senderType === 'gmail') {
            await tx.gmailAccount.update({ where: { id: accountId }, data: { isSystemPrimary: true } });
          } else {
            await tx.serverMailAccount.update({ where: { id: accountId }, data: { isSystemPrimary: true } });
          }
        }

        await tx.workspaceMailAutomation.upsert({
          where: { id: 'default' },
          create: { id: 'default', accountId, senderType },
          update: { accountId, senderType },
        });

        await recordAuditEvent(
          {
            actorUserId: actor.id,
            actorEmail: actor.email,
            action: 'mail.automation.sender',
            summary: 'Updated workspace automation system sender',
            details: { accountId, senderType },
          },
          tx
        );
      });

      res.json({ ok: true, accountId, senderType });
    })
  );

  /**
   * POST /api/settings/automation-mail/test
   * Queues an immediate test alert to the Admin recipient and runs a delivery batch.
   */
  app.post(
    '/api/settings/automation-mail/test',
    requireAuth,
    requireAdmin,
    asyncHandler(async (_req: Request, res: Response) => {
      const sender = await resolveActiveSystemSender();
      if (!sender) {
        res.status(400).json({ error: 'Configure and save a System Mail sender first.' });
        return;
      }

      const queued = await queueAdminMail(
        `test:${randomUUID()}`,
        'Workspace Pro System Mail Test Alert',
        `Hello Administrator,\n\nThis is a live test notification from your active System Mail dispatcher (${sender.email}).\n\nIf you are reading this email, your automated workspace notifications, task assignment alerts, and member invitations are functioning properly.\n\nTime sent: ${new Date().toLocaleString()}\nWorkspace Pro Platform`,
        prisma,
        { priority: 'URGENT', eventType: 'TEST_ALERT' }
      );

      if (!queued) {
        res.status(400).json({
          error: 'Could not queue test email. Ensure a valid Admin Email is configured.',
        });
        return;
      }

      // Immediately attempt delivery so user sees result without waiting for timer
      setTimeout(() => {
        deliverWorkspaceMailBatch().catch(() => {});
      }, 500);

      res.status(202).json({
        ok: true,
        message: `Test email queued using system sender ${sender.email}. Check Recent Deliveries below.`,
      });
    })
  );
}
