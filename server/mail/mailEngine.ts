import express from 'express';
import nodemailer from 'nodemailer';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { requireAdmin, requireAuth } from '../auth/sessionAuth';
import {
  decryptSecret,
  encryptSecret,
  hashPasswordScrypt,
  prisma,
} from '../db/prisma';
import {
  sanitizeMailAccountForClient,
  toBulkCampaignDto,
  toCustomMailTabDto,
  toMailMessageDto,
} from '../db/mappers';
import {
  asyncHandler,
  broadcastRealtimeEvent,
  recordAndBroadcastNotification,
  sseClients,
} from '../realtime';

export interface RuntimeMailMessage {
  id: string;
  accountId: string;
  threadId: string;
  folder: 'inbox' | 'sent' | 'drafts';
  subject: string;
  fromName: string;
  fromEmail: string;
  to: string;
  cc?: string;
  date: string;
  timestamp: number;
  snippet: string;
  bodyHtml: string;
  bodyText: string;
  isUnread: boolean;
  isStarred: boolean;
}

function decodeQuotedPrintableText(input: string): string {
  if (!input) return '';
  const withoutSoftBreaks = input.replace(/=\r?\n/g, '');
  const bytes: number[] = [];
  const chunks: string[] = [];

  const flushBytes = () => {
    if (bytes.length > 0) {
      try {
        chunks.push(Buffer.from(bytes).toString('utf8'));
      } catch {
        chunks.push(Buffer.from(bytes).toString('latin1'));
      }
      bytes.length = 0;
    }
  };

  let i = 0;
  while (i < withoutSoftBreaks.length) {
    if (
      withoutSoftBreaks[i] === '=' &&
      i + 2 < withoutSoftBreaks.length &&
      /^[0-9A-Fa-f]{2}$/.test(withoutSoftBreaks.slice(i + 1, i + 3))
    ) {
      bytes.push(parseInt(withoutSoftBreaks.slice(i + 1, i + 3), 16));
      i += 3;
    } else {
      flushBytes();
      chunks.push(withoutSoftBreaks[i]);
      i += 1;
    }
  }
  flushBytes();
  return chunks.join('');
}

export function cleanLegacyCorruptedText(raw: string): string {
  if (!raw) return '';
  let text = raw;
  text = text.replace(/--[0-9a-fA-F]{16,}[a-zA-Z0-9._-]*--?/g, '\n');
  text = text.replace(/Content-Type:[^\r\n]+(\r?\n)?/gi, '');
  text = text.replace(/Content-Transfer-Encoding:[^\r\n]+(\r?\n)?/gi, '');
  text = text.replace(/charset=["']?[^"'\r\n;]+["']?/gi, '');

  if (/=[0-9A-Fa-f]{2}/.test(text) || /=\s/.test(text)) {
    text = text.replace(/=\s+(?=[a-zA-Z0-9])/g, '');
    text = decodeQuotedPrintableText(text);
  }

  return text.replace(/\n{3,}/g, '\n\n').trim();
}

async function parseRfc822Source(rawBuffer: Buffer | string): Promise<{
  text: string;
  html: string;
}> {
  try {
    const parsed = await simpleParser(rawBuffer);
    const html = typeof parsed.html === 'string' ? parsed.html : '';
    const text =
      parsed.text ||
      (html ? html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '');
    if (text || html) {
      return {
        text: cleanLegacyCorruptedText(text),
        html,
      };
    }
  } catch {
    // Fallback below
  }

  const rawStr = Buffer.isBuffer(rawBuffer) ? rawBuffer.toString('utf8') : String(rawBuffer);
  const separatorIdx = rawStr.indexOf('\r\n\r\n');
  const bodyPart = separatorIdx !== -1 ? rawStr.slice(separatorIdx + 4) : rawStr;
  const decoded = cleanLegacyCorruptedText(bodyPart);
  const isHtml = /<[a-z][\s\S]*>/i.test(decoded);

  return {
    text: isHtml ? decoded.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : decoded,
    html: isHtml ? decoded : '',
  };
}

export const imapCache = new Map<string, { timestamp: number; items: RuntimeMailMessage[] }>();
export const knownImapUids = new Map<string, Set<string>>();

async function getStarredIdSet(accountId: string): Promise<Set<string>> {
  const rows = await prisma.mailStarredMessage.findMany({
    where: { accountId },
    select: { messageId: true },
  });
  return new Set(rows.map((r) => r.messageId));
}

export async function syncAccountImapInbox(
  account: {
    id: string;
    email: string;
    username?: string;
    imapHost: string;
    imapPort: number;
    imapSecure: boolean;
    encryptedPassword: string;
  },
  starredSet: Set<string>,
  notifyOnNew = false,
  notifModule: 'server_mail' | 'gmail' = 'server_mail'
): Promise<RuntimeMailMessage[]> {
  const pass = decryptSecret(account.encryptedPassword);
  const client = new ImapFlow({
    host: account.imapHost,
    port: account.imapPort,
    secure: account.imapSecure,
    auth: {
      user: account.username || account.email,
      pass,
    },
    logger: false,
    connectionTimeout: 10000,
    greetingTimeout: 8000,
    // SECURITY: TLS certificate validation — defaults to true; set MAIL_TLS_STRICT=false to disable
    tls: {
      rejectUnauthorized: process.env.MAIL_TLS_STRICT !== 'false',
    },
  });

  const fetched: RuntimeMailMessage[] = [];
  await client.connect();
  const lock = await client.getMailboxLock('INBOX');
  try {
    const total = client.mailbox ? client.mailbox.exists : 0;
    if (total > 0) {
      const startSeq = Math.max(1, total - 24);
      const range = `${startSeq}:*`;

      for await (const msg of client.fetch(range, {
        uid: true,
        envelope: true,
        flags: true,
        internalDate: true,
        source: { maxLength: 65536 },
      })) {
        const env = msg.envelope;
        const fromEntry = env?.from?.[0];
        const toEntry = env?.to?.[0];
        const fromName = fromEntry?.name || fromEntry?.address?.split('@')[0] || 'Unknown';
        const fromEmail = fromEntry?.address || '';
        const toEmail = toEntry?.address || account.email;
        const subject = env?.subject || '(No Subject)';
        const rawDate = msg.internalDate ? new Date(msg.internalDate) : new Date();
        const rawBuffer = msg.source ? msg.source : Buffer.from('');
        const { text, html } = await parseRfc822Source(rawBuffer);
        const msgId = `imap-${account.id}-${msg.uid}`;
        const flags = msg.flags || new Set();

        fetched.push({
          id: msgId,
          accountId: account.id,
          threadId: msgId,
          folder: 'inbox',
          subject,
          fromName,
          fromEmail,
          to: toEmail,
          date: rawDate.toLocaleString([], {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
          timestamp: rawDate.getTime(),
          snippet: (text || subject).replace(/\s+/g, ' ').slice(0, 140),
          bodyHtml: html,
          bodyText: text || subject,
          isUnread: !flags.has('\\Seen'),
          isStarred: flags.has('\\Flagged') || starredSet.has(msgId),
        });
      }
    }
  } finally {
    lock.release();
  }
  await client.logout();

  const sorted = fetched.sort((a, b) => b.timestamp - a.timestamp);
  imapCache.set(`${account.id}__inbox`, { timestamp: Date.now(), items: sorted });

  const prevSet = knownImapUids.get(account.id);
  const currentSet = new Set(sorted.map((m) => m.id));
  if (!prevSet) {
    knownImapUids.set(account.id, currentSet);
  } else {
    const newArrivals = sorted.filter((m) => !prevSet.has(m.id));
    knownImapUids.set(account.id, currentSet);

    if (notifyOnNew && newArrivals.length > 0) {
      for (const arrived of newArrivals) {
        broadcastRealtimeEvent('mail:arrived', {
          accountId: account.id,
          accountEmail: account.email,
          message: arrived,
        });
        await recordAndBroadcastNotification({
          type: notifModule === 'gmail' ? 'gmail_received' : 'server_mail_received',
          title: `New ${notifModule === 'gmail' ? 'Gmail' : 'Server Mail'} from ${arrived.fromName}`,
          description: `${arrived.subject} — ${arrived.snippet.slice(0, 80)}`,
          module: notifModule,
          targetId: arrived.id,
          accountId: account.id,
        }).catch(() => {});
      }
    }
  }

  return sorted;
}

export function startImapBackgroundWatcher() {
  let isWatcherRunning = false;
  let lastSyncCompletedAt = 0;
  const SYNC_BACKOFF_INTERVAL_MS = 60_000; // 60 seconds minimum interval between account sync cycles

  setInterval(async () => {
    const now = Date.now();
    if (isWatcherRunning || sseClients.size === 0 || now - lastSyncCompletedAt < SYNC_BACKOFF_INTERVAL_MS) {
      return;
    }
    isWatcherRunning = true;
    try {
      const serverAccounts = await prisma.serverMailAccount.findMany();
      for (const acc of serverAccounts) {
        const starredSet = await getStarredIdSet(acc.id);
        await syncAccountImapInbox(acc, starredSet, true, 'server_mail').catch(() => {});
      }
    } catch {
      // Skip if PostgreSQL isn't ready yet
    } finally {
      lastSyncCompletedAt = Date.now();
      isWatcherRunning = false;
    }
  }, 15_000);
}

async function verifyMailConnection(params: {
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  authUser: string;
  password: string;
}) {
  let imapOk = false;
  let imapMessage = '';
  let smtpOk = false;
  let smtpMessage = '';

  const imapClient = new ImapFlow({
    host: params.imapHost,
    port: params.imapPort,
    secure: params.imapSecure,
    auth: { user: params.authUser, pass: params.password },
    logger: false,
    connectionTimeout: 10000,
    greetingTimeout: 8000,
    // SECURITY: TLS certificate validation — defaults to true; set MAIL_TLS_STRICT=false to disable
    tls: { rejectUnauthorized: process.env.MAIL_TLS_STRICT !== 'false' },
  });

  try {
    await imapClient.connect();
    const status = await imapClient.status('INBOX', { messages: true, unseen: true });
    const msgCount = status && typeof status === 'object' ? status.messages ?? 0 : 0;
    imapOk = true;
    imapMessage = `Connected to ${params.imapHost}:${params.imapPort} (INBOX: ${msgCount} messages)`;
    await imapClient.logout();
  } catch (err: any) {
    imapMessage = `IMAP Error (${params.imapHost}:${params.imapPort}): ${
      err?.message || 'Connection failed'
    }`;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: params.smtpHost,
      port: params.smtpPort,
      secure: params.smtpSecure,
      auth: { user: params.authUser, pass: params.password },
      connectionTimeout: 10000,
      // SECURITY: TLS certificate validation — defaults to true; set MAIL_TLS_STRICT=false to disable
      tls: { rejectUnauthorized: process.env.MAIL_TLS_STRICT !== 'false' },
    });
    await transporter.verify();
    smtpOk = true;
    smtpMessage = `Connected to ${params.smtpHost}:${params.smtpPort} (SMTP Ready)`;
  } catch (err: any) {
    smtpMessage = `SMTP Error (${params.smtpHost}:${params.smtpPort}): ${
      err?.message || 'Verification failed'
    }`;
  }

  return { ok: imapOk && smtpOk, imapOk, imapMessage, smtpOk, smtpMessage };
}

function registerMailProviderRoutes(app: express.Express, kind: 'server-mail' | 'gmail') {
  const isGmail = kind === 'gmail';
  const base = isGmail ? '/api/gmail' : '/api/server-mail';
  const warningHeader = isGmail ? 'X-Gmail-Warning' : 'X-Server-Mail-Warning';
  const moduleName = isGmail ? 'gmail' : 'server_mail';
  const defaultImapHost = isGmail ? 'imap.gmail.com' : '';
  const defaultSmtpHost = isGmail ? 'smtp.gmail.com' : '';

  const findAccount = async (idOrEmail: string) => {
    const clean = idOrEmail.trim();
    const lower = clean.toLowerCase();
    if (isGmail) {
      return prisma.gmailAccount.findFirst({
        where: {
          OR: [
            { id: clean },
            { email: clean },
            { email: lower },
          ],
        },
      });
    }
    return prisma.serverMailAccount.findUnique({ where: { id: clean } });
  };

  const listAllAccounts = async () => {
    const rows = isGmail
      ? await prisma.gmailAccount.findMany({ orderBy: { id: 'asc' } })
      : await prisma.serverMailAccount.findMany({ orderBy: { id: 'asc' } });
    return rows.map(sanitizeMailAccountForClient);
  };

  app.get(
    `${base}/accounts`,
    asyncHandler(async (_req, res) => {
      res.json({ accounts: await listAllAccounts() });
    })
  );

  app.post(
    `${base}/verify`,
    asyncHandler(async (req, res) => {
      const {
        accountId,
        email,
        username,
        password,
        imapHost = defaultImapHost,
        imapPort = 993,
        imapSecure = true,
        smtpHost = defaultSmtpHost,
        smtpPort = 465,
        smtpSecure = true,
      } = req.body || {};

      let resolvedPass = password;
      if (!resolvedPass && accountId) {
        const existing = await findAccount(String(accountId));
        if (existing) {
          resolvedPass = decryptSecret(existing.encryptedPassword);
        }
      }

      if (isGmail) {
        if (!email || !resolvedPass) {
          res.status(400).json({
            error: 'Please provide your Gmail address and App Password / Secret Key.',
          });
          return;
        }
      } else if (!imapHost || !smtpHost || !(username || email) || !resolvedPass) {
        res.status(400).json({
          error: 'Please provide Incoming IMAP host, Outgoing SMTP host, Username, and Password.',
        });
        return;
      }

      const result = await verifyMailConnection({
        imapHost: String(imapHost).trim(),
        imapPort: Number(imapPort) || 993,
        imapSecure: Boolean(imapSecure),
        smtpHost: String(smtpHost).trim(),
        smtpPort: Number(smtpPort) || 465,
        smtpSecure: Boolean(smtpSecure),
        authUser: String(username || email).trim(),
        password: String(resolvedPass),
      });

      if (accountId && result.ok) {
        const verifiedAt = new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });
        if (isGmail) {
          await prisma.gmailAccount
            .update({ where: { id: String(accountId) }, data: { lastVerifiedAt: verifiedAt } })
            .catch(() => {});
        } else {
          await prisma.serverMailAccount
            .update({ where: { id: String(accountId) }, data: { lastVerifiedAt: verifiedAt } })
            .catch(() => {});
        }
      }

      res.json(result);
    })
  );

  app.post(
    `${base}/accounts`,
    asyncHandler(async (req, res) => {
      const {
        id,
        label,
        email,
        username,
        password,
        authMode = 'app_password',
        clientId,
        clientSecret,
        refreshToken,
        imapHost = defaultImapHost,
        imapPort = 993,
        imapSecure = true,
        smtpHost = defaultSmtpHost,
        smtpPort = 465,
        smtpSecure = true,
      } = req.body || {};

      if (isGmail) {
        if (!email) {
          res.status(400).json({ error: 'Gmail address is required.' });
          return;
        }
      } else if (!email || !imapHost || !smtpHost) {
        res.status(400).json({
          error: 'Email, Incoming IMAP Host, and Outgoing SMTP Host are required.',
        });
        return;
      }

      const cleanEmail = String(email).trim();
      const existing = id
        ? await findAccount(String(id))
        : isGmail
        ? await findAccount(cleanEmail)
        : null;

      let passwordHash = '';
      let encryptedPassword = '';

      if (password && String(password).trim().length > 0) {
        passwordHash = hashPasswordScrypt(String(password));
        encryptedPassword = encryptSecret(String(password));
      } else if (existing) {
        passwordHash = existing.passwordHash;
        encryptedPassword = existing.encryptedPassword;
      } else {
        res.status(400).json({
          error: isGmail
            ? 'App Password / Secret Key is required when adding a Gmail account.'
            : 'Password is required when adding a new Server Mail account.',
        });
        return;
      }

      const recordId = existing ? existing.id : `${isGmail ? 'gmail' : 'srv'}-${Date.now()}`;
      const createdAt = existing
        ? existing.createdAt
        : new Date().toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
      const cleanLabel = (label || cleanEmail.split('@')[0]).trim();
      const cleanUser = (username || cleanEmail).trim();

      let savedRecord: any;
      if (isGmail) {
        savedRecord = await prisma.gmailAccount.upsert({
          where: { id: recordId },
          update: {
            label: cleanLabel,
            email: cleanEmail,
            username: cleanUser,
            authMode: String(authMode || 'app_password'),
            imapHost: String(imapHost || 'imap.gmail.com').trim(),
            imapPort: Number(imapPort) || 993,
            imapSecure: Boolean(imapSecure ?? true),
            smtpHost: String(smtpHost || 'smtp.gmail.com').trim(),
            smtpPort: Number(smtpPort) || 465,
            smtpSecure: Boolean(smtpSecure ?? true),
            ...(clientId !== undefined ? { clientId: clientId ? String(clientId) : null } : {}),
            ...(clientSecret ? { clientSecretEnc: encryptSecret(String(clientSecret)) } : {}),
            ...(refreshToken ? { refreshTokenEnc: encryptSecret(String(refreshToken)) } : {}),
            passwordHash,
            encryptedPassword,
          },
          create: {
            id: recordId,
            label: cleanLabel,
            email: cleanEmail,
            username: cleanUser,
            authMode: String(authMode || 'app_password'),
            imapHost: String(imapHost || 'imap.gmail.com').trim(),
            imapPort: Number(imapPort) || 993,
            imapSecure: Boolean(imapSecure ?? true),
            smtpHost: String(smtpHost || 'smtp.gmail.com').trim(),
            smtpPort: Number(smtpPort) || 465,
            smtpSecure: Boolean(smtpSecure ?? true),
            clientId: clientId ? String(clientId) : null,
            clientSecretEnc: clientSecret ? encryptSecret(String(clientSecret)) : null,
            refreshTokenEnc: refreshToken ? encryptSecret(String(refreshToken)) : null,
            passwordHash,
            encryptedPassword,
            createdAt,
            lastVerifiedAt: null,
          },
        });
      } else {
        savedRecord = await prisma.serverMailAccount.upsert({
          where: { id: recordId },
          update: {
            label: cleanLabel,
            email: cleanEmail,
            username: cleanUser,
            imapHost: String(imapHost).trim(),
            imapPort: Number(imapPort) || 993,
            imapSecure: Boolean(imapSecure ?? true),
            smtpHost: String(smtpHost).trim(),
            smtpPort: Number(smtpPort) || 465,
            smtpSecure: Boolean(smtpSecure ?? true),
            passwordHash,
            encryptedPassword,
          },
          create: {
            id: recordId,
            label: cleanLabel,
            email: cleanEmail,
            username: cleanUser,
            imapHost: String(imapHost).trim(),
            imapPort: Number(imapPort) || 993,
            imapSecure: Boolean(imapSecure ?? true),
            smtpHost: String(smtpHost).trim(),
            smtpPort: Number(smtpPort) || 465,
            smtpSecure: Boolean(smtpSecure ?? true),
            passwordHash,
            encryptedPassword,
            createdAt,
            lastVerifiedAt: null,
          },
        });
      }

      imapCache.clear();
      res.json({
        account: sanitizeMailAccountForClient(savedRecord),
        accounts: await listAllAccounts(),
      });
    })
  );

  app.delete(
    `${base}/accounts/:id`,
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      const target = await findAccount(id);
      const targetIds = target ? [target.id, id] : [id];

      await prisma.$transaction(async (tx) => {
        if (isGmail) {
          await tx.gmailAccount.deleteMany({
            where: { OR: [{ id }, { email: id }] },
          });
        } else {
          await tx.serverMailAccount.deleteMany({ where: { id } });
        }
        await tx.mailMessage.deleteMany({
          where: { accountId: { in: targetIds } },
        });
        await tx.mailStarredMessage.deleteMany({
          where: { accountId: { in: targetIds } },
        });
      });

      imapCache.clear();
      knownImapUids.delete(id);
      if (target) knownImapUids.delete(target.id);

      res.json({ accounts: await listAllAccounts() });
    })
  );

  app.get(
    `${base}/accounts/:id/messages`,
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      const folder = String(req.query.folder || 'inbox').toLowerCase();
      const search = String(req.query.q || '').toLowerCase().trim();
      const force = req.query.force === 'true';

      const account = await findAccount(id);
      if (!account) {
        if (isGmail) {
          res.json({ messages: [], warning: null });
          return;
        }
        res.status(404).json({ error: 'Server Mail account not found.' });
        return;
      }

      const [starredSet, localRows] = await Promise.all([
        getStarredIdSet(account.id),
        prisma.mailMessage.findMany({
          where: { accountId: account.id },
          orderBy: { timestampMs: 'desc' },
        }),
      ]);

      const localMessages: RuntimeMailMessage[] = localRows.map((row) => {
        const dto = toMailMessageDto(row);
        return {
          ...dto,
          bodyText: cleanLegacyCorruptedText(dto.bodyText),
          snippet: cleanLegacyCorruptedText(dto.snippet).slice(0, 140),
          isStarred: starredSet.has(dto.id) || dto.isStarred,
        };
      });

      let inboxMessages: RuntimeMailMessage[] = [];
      const cacheKey = `${account.id}__inbox`;
      const cached = imapCache.get(cacheKey);

      if (!force && cached && Date.now() - cached.timestamp < 4000) {
        inboxMessages = cached.items;
      } else if (folder === 'inbox' || folder === 'all' || folder === 'starred') {
        try {
          inboxMessages = await syncAccountImapInbox(
            account,
            starredSet,
            true,
            moduleName as 'server_mail' | 'gmail'
          );
        } catch (err: any) {
          if (cached) {
            inboxMessages = cached.items;
          }
          res.setHeader(warningHeader, err?.message || 'IMAP sync warning');
        }
      }

      const combinedMap = new Map<string, RuntimeMailMessage>();
      [...localMessages, ...inboxMessages].forEach((m) => {
        combinedMap.set(m.id, {
          ...m,
          bodyText: cleanLegacyCorruptedText(m.bodyText),
          snippet: cleanLegacyCorruptedText(m.snippet).slice(0, 140),
          isStarred: starredSet.has(m.id) || m.isStarred,
        });
      });

      let results = Array.from(combinedMap.values()).sort((a, b) => b.timestamp - a.timestamp);
      if (folder === 'inbox' || folder === 'sent' || folder === 'drafts') {
        results = results.filter((m) => m.folder === folder);
      } else if (folder === 'starred') {
        results = results.filter((m) => m.isStarred);
      }

      if (search) {
        results = results.filter(
          (m) =>
            m.subject.toLowerCase().includes(search) ||
            m.fromName.toLowerCase().includes(search) ||
            m.fromEmail.toLowerCase().includes(search) ||
            m.bodyText.toLowerCase().includes(search)
        );
      }

      res.json({
        messages: results,
        warning: res.getHeader(warningHeader) || null,
      });
    })
  );

  app.post(
    `${base}/accounts/:id/star`,
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      const { messageId } = req.body || {};
      if (!messageId) {
        res.status(400).json({ error: 'messageId required' });
        return;
      }
      const account = isGmail ? await findAccount(id) : null;
      const key = account ? account.id : id;
      const msgId = String(messageId);

      await prisma.$transaction(async (tx) => {
        const existingStar = await tx.mailStarredMessage.findUnique({
          where: { accountId_messageId: { accountId: key, messageId: msgId } },
        });
        if (existingStar) {
          await tx.mailStarredMessage.delete({ where: { id: existingStar.id } });
          await tx.mailMessage.updateMany({
            where: { id: msgId, accountId: key },
            data: { isStarred: false },
          });
        } else {
          await tx.mailStarredMessage.create({
            data: {
              id: `${key}__${msgId}`.slice(0, 190),
              accountId: key,
              messageId: msgId,
            },
          });
          await tx.mailMessage.updateMany({
            where: { id: msgId, accountId: key },
            data: { isStarred: true },
          });
        }
      });

      const updatedSet = await getStarredIdSet(key);
      res.json({ starredIds: Array.from(updatedSet) });
    })
  );

  app.post(
    `${base}/accounts/:id/drafts`,
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      const { to, cc, subject, bodyText } = req.body || {};
      const account = await findAccount(id);
      if (!account) {
        res.status(404).json({ error: isGmail ? 'Gmail account not found' : 'Account not found' });
        return;
      }

      const nowMs = Date.now();
      const draftRow = await prisma.mailMessage.create({
        data: {
          id: `draft-${nowMs}`,
          accountId: account.id,
          threadId: `draft-${nowMs}`,
          folder: 'drafts',
          subject: subject || '(Draft)',
          fromName: account.label,
          fromEmail: account.email,
          toEmail: to || '',
          cc: cc || '',
          dateStr: new Date().toLocaleString([], {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
          timestampMs: BigInt(nowMs),
          snippet: String(bodyText || '').slice(0, 120),
          bodyHtml: '',
          bodyText: bodyText || '',
          isUnread: false,
          isStarred: false,
        },
      });

      res.json({ draft: toMailMessageDto(draftRow) });
    })
  );

  app.post(
    `${base}/accounts/:id/send`,
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      const { to, cc, bcc, subject, bodyHtml, bodyText } = req.body || {};

      if (!to) {
        res.status(400).json({ error: 'Recipient (To) address is required.' });
        return;
      }

      const account = await findAccount(id);
      if (!account) {
        res.status(404).json({
          error: isGmail
            ? 'Gmail account not found. Please configure it in Gmail Settings.'
            : 'Server Mail account not found.',
        });
        return;
      }

      try {
        const pass = decryptSecret(account.encryptedPassword);
        const transporter = nodemailer.createTransport({
          host: account.smtpHost,
          port: account.smtpPort,
          secure: account.smtpSecure,
          auth: {
            user: account.username || account.email,
            pass,
          },
          connectionTimeout: 12000,
          // SECURITY: TLS certificate validation — defaults to true; set MAIL_TLS_STRICT=false to disable
          tls: { rejectUnauthorized: process.env.MAIL_TLS_STRICT !== 'false' },
        });

        await transporter.sendMail({
          from: `"${account.label}" <${account.email}>`,
          to,
          ...(cc ? { cc } : {}),
          ...(bcc ? { bcc } : {}),
          subject: subject || '(No Subject)',
          text: bodyText || '',
          html: bodyHtml || `<p>${bodyText || ''}</p>`,
        });

        const nowMs = Date.now();
        const sentRow = await prisma.mailMessage.create({
          data: {
            id: `sent-${nowMs}-${Math.random().toString(36).slice(2, 6)}`,
            accountId: account.id,
            threadId: `sent-${nowMs}`,
            folder: 'sent',
            subject: subject || '(No Subject)',
            fromName: account.label,
            fromEmail: account.email,
            toEmail: to,
            cc: cc || null,
            dateStr: new Date().toLocaleString([], {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            }),
            timestampMs: BigInt(nowMs),
            snippet: String(bodyText || subject || '').slice(0, 120),
            bodyHtml: bodyHtml || '',
            bodyText: bodyText || '',
            isUnread: false,
            isStarred: false,
          },
        });

        const sentDto = toMailMessageDto(sentRow);
        await recordAndBroadcastNotification({
          type: 'mail_sent',
          title: `${isGmail ? 'Gmail' : 'Server Mail'} Sent to ${to}`,
          description: `Subject: ${subject || '(No Subject)'} via ${account.email}`,
          module: moduleName as 'gmail' | 'server_mail',
          targetId: sentDto.id,
          accountId: account.id,
        });

        res.json({ ok: true, message: sentDto });
      } catch (err: any) {
        res.status(500).json({
          error: `${isGmail ? 'Gmail ' : ''}SMTP Send Failed (${account.smtpHost}:${account.smtpPort}): ${
            err?.message || 'Unable to send email'
          }`,
        });
      }
    })
  );
}

export function registerMailAndCampaignRoutes(app: express.Express) {
  app.use('/api/server-mail', requireAuth, requireAdmin);
  app.use('/api/gmail', requireAuth, requireAdmin);
  app.use('/api/mail-tabs', requireAuth, requireAdmin);
  app.use('/api/bulk-campaigns', requireAuth, requireAdmin);

  registerMailProviderRoutes(app, 'server-mail');
  registerMailProviderRoutes(app, 'gmail');

  app.get(
    '/api/mail-tabs',
    asyncHandler(async (_req, res) => {
      const rows = await prisma.customMailTab.findMany({
        orderBy: { timestampMs: 'asc' },
      });
      res.json({ tabs: rows.map(toCustomMailTabDto) });
    })
  );

  app.post(
    '/api/mail-tabs',
    asyncHandler(async (req, res) => {
      const { id, name, label, query, accentColor, description, isBulkShortcut } = req.body || {};
      const resolvedName = String(name || label || '').trim();
      if (!resolvedName || !query) {
        res.status(400).json({ error: 'Tab name and query are required.' });
        return;
      }
      const tabId = String(id || `tab-${Date.now()}`);
      const nowStr = new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      await prisma.customMailTab.upsert({
        where: { id: tabId },
        update: {
          name: resolvedName,
          query: String(query).trim(),
          accentColor: String(accentColor || '#0B57D0'),
          description: description !== undefined ? String(description) : undefined,
          isBulkShortcut: Boolean(isBulkShortcut ?? false),
        },
        create: {
          id: tabId,
          name: resolvedName,
          query: String(query).trim(),
          accentColor: String(accentColor || '#0B57D0'),
          description: String(description || `Filter: ${String(query).trim()}`),
          isBulkShortcut: Boolean(isBulkShortcut ?? false),
          createdAt: nowStr,
          timestampMs: BigInt(Date.now()),
        },
      });
      const rows = await prisma.customMailTab.findMany({ orderBy: { timestampMs: 'asc' } });
      res.json({ tabs: rows.map(toCustomMailTabDto) });
    })
  );

  app.delete(
    '/api/mail-tabs/:id',
    asyncHandler(async (req, res) => {
      await prisma.customMailTab.deleteMany({ where: { id: req.params.id } });
      const rows = await prisma.customMailTab.findMany({ orderBy: { timestampMs: 'asc' } });
      res.json({ tabs: rows.map(toCustomMailTabDto) });
    })
  );

  app.get(
    '/api/bulk-campaigns',
    asyncHandler(async (_req, res) => {
      const rows = await prisma.bulkCampaign.findMany({ orderBy: { timestampMs: 'desc' } });
      res.json({ campaigns: rows.map(toBulkCampaignDto) });
    })
  );

  app.post(
    '/api/bulk-campaigns',
    asyncHandler(async (req, res) => {
      const campaign = req.body || {};
      if (!campaign.name) {
        res.status(400).json({ error: 'Campaign name is required.' });
        return;
      }
      const id = String(campaign.id || `camp-${Date.now()}`);
      const {
        name,
        subject,
        bodyHtml,
        status,
        sentCount,
        totalCount,
        updatedAt,
        recipients,
        id: _ignoredId,
        ...rest
      } = campaign;

      await prisma.bulkCampaign.upsert({
        where: { id },
        update: {
          name: String(name),
          subject: String(subject || ''),
          bodyHtml: String(bodyHtml || ''),
          status: String(status || 'Draft'),
          sentCount: Number(sentCount) || 0,
          totalCount: Number(totalCount) || 0,
          updatedAt: String(
            updatedAt ||
              new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          ),
          recipientsJson: Array.isArray(recipients) ? recipients : [],
          timestampMs: BigInt(Date.now()),
          extraFields: rest,
        },
        create: {
          id,
          name: String(name),
          subject: String(subject || ''),
          bodyHtml: String(bodyHtml || ''),
          status: String(status || 'Draft'),
          sentCount: Number(sentCount) || 0,
          totalCount: Number(totalCount) || 0,
          updatedAt: String(
            updatedAt ||
              new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          ),
          recipientsJson: Array.isArray(recipients) ? recipients : [],
          timestampMs: BigInt(Date.now()),
          extraFields: rest,
        },
      });

      const rows = await prisma.bulkCampaign.findMany({ orderBy: { timestampMs: 'desc' } });
      res.json({ campaigns: rows.map(toBulkCampaignDto) });
    })
  );

  app.delete(
    '/api/bulk-campaigns/:id',
    asyncHandler(async (req, res) => {
      await prisma.bulkCampaign.deleteMany({ where: { id: req.params.id } });
      const rows = await prisma.bulkCampaign.findMany({ orderBy: { timestampMs: 'desc' } });
      res.json({ campaigns: rows.map(toBulkCampaignDto) });
    })
  );
}
