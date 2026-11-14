import express from 'express';
import { requireAuth } from './auth/sessionAuth';
import { formatDbError, isDbUnavailableError, prisma, withDbRetry } from './db/prisma';
import { toNotificationDto } from './db/mappers';

export interface SseClientEntry {
  userId: string;
  res: express.Response;
}

export const sseClients = new Set<SseClientEntry>();
export const sseClientsByUser = new Map<string, Set<SseClientEntry>>();

export function addSseClient(entry: SseClientEntry) {
  sseClients.add(entry);
  let userClients = sseClientsByUser.get(entry.userId);
  if (!userClients) {
    userClients = new Set();
    sseClientsByUser.set(entry.userId, userClients);
  }
  userClients.add(entry);
}

export function removeSseClient(entry: SseClientEntry) {
  sseClients.delete(entry);
  const userClients = sseClientsByUser.get(entry.userId);
  if (userClients) {
    userClients.delete(entry);
    if (userClients.size === 0) {
      sseClientsByUser.delete(entry.userId);
    }
  }
}

export function broadcastRealtimeEvent(
  eventName: string,
  payload: any,
  targetUserIds?: string[]
) {
  // Automatically isolate 1-on-1 communication events to only the participating users
  let allowedUsers: Set<string> | null = null;
  if (Array.isArray(targetUserIds) && targetUserIds.length > 0) {
    allowedUsers = new Set(targetUserIds.filter(Boolean));
  } else if (eventName.startsWith('communication:message:')) {
    const ids = [
      payload?.senderId,
      payload?.recipientId,
      payload?.readerId,
      payload?.partnerId,
      payload?.message?.senderId,
      payload?.message?.recipientId,
    ].filter(Boolean);
    if (ids.length > 0) {
      allowedUsers = new Set(ids);
    }
  }

  const packet = `data: ${JSON.stringify({ event: eventName, payload, ts: Date.now() })}\n\n`;

  if (allowedUsers) {
    // Targeted broadcast: O(targets) instead of O(all_connected_users)
    for (const uid of allowedUsers) {
      const userClients = sseClientsByUser.get(uid);
      if (!userClients) continue;
      for (const client of Array.from(userClients)) {
        try {
          client.res.write(packet);
        } catch {
          removeSseClient(client);
        }
      }
    }
  } else {
    // Workspace-wide broadcast
    for (const client of Array.from(sseClients)) {
      try {
        client.res.write(packet);
      } catch {
        removeSseClient(client);
      }
    }
  }
}

export async function recordAndBroadcastNotification(input: {
  type: string;
  title: string;
  description?: string;
  module: string;
  targetId?: string;
  accountId?: string;
}) {
  const nowMs = Date.now();
  const timeLabel = new Date(nowMs).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  const id = `notif-${nowMs}-${Math.random().toString(36).slice(2, 6)}`;

  try {
    const row = await prisma.systemNotification.create({
      data: {
        id,
        type: input.type,
        title: input.title,
        description: input.description || null,
        module: input.module,
        targetId: input.targetId || null,
        accountId: input.accountId || null,
        timestampMs: BigInt(nowMs),
        timeLabel,
        isRead: false,
      },
    });
    const dto = toNotificationDto(row);
    broadcastRealtimeEvent('notification:new', dto);
    return dto;
  } catch {
    return null;
  }
}

export const asyncHandler =
  (
    fn: (req: express.Request, res: express.Response, next: express.NextFunction) => Promise<any>,
    options?: { skipPrecheck?: boolean }
  ) =>
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const exec = options?.skipPrecheck
      ? Promise.resolve(fn(req, res, next))
      : Promise.resolve(withDbRetry(() => fn(req, res, next)));
    exec.catch((err) => {
      console.error('[API Error]', err);
      if (isDbUnavailableError(err)) {
        res.status(503).json({
          ok: false,
          error: 'Database service temporarily unavailable.',
          code: 'DB_UNAVAILABLE',
        });
        return;
      }
      // SECURITY: Do not leak internal error details to the client
      res.status(500).json({ error: 'Internal server error' });
    });
  };

export function registerRealtimeAndNotificationRoutes(app: express.Express) {
  app.use('/api/realtime', requireAuth);
  app.use('/api/notifications', requireAuth);

  app.get('/api/realtime/stream', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const userId = req.auth?.user?.id || 'anonymous';
    const clientEntry: SseClientEntry = { userId, res };

    res.write(`data: ${JSON.stringify({ event: 'connected', ts: Date.now() })}\n\n`);
    addSseClient(clientEntry);

    const heartbeat = setInterval(() => {
      try {
        res.write(`: heartbeat ${Date.now()}\n\n`);
      } catch {
        clearInterval(heartbeat);
        removeSseClient(clientEntry);
      }
    }, 25000);

    req.on('close', () => {
      clearInterval(heartbeat);
      removeSseClient(clientEntry);
    });
  });

  app.get(
    '/api/notifications',
    asyncHandler(async (_req, res) => {
      const rows = await prisma.systemNotification.findMany({
        orderBy: { timestampMs: 'desc' },
        take: 60,
      });
      res.json({ notifications: rows.map(toNotificationDto) });
    })
  );

  app.post(
    '/api/notifications/mark-read',
    asyncHandler(async (req, res) => {
      const { id } = req.body || {};
      if (id) {
        await prisma.systemNotification.updateMany({
          where: { id: String(id) },
          data: { isRead: true },
        });
      } else {
        await prisma.systemNotification.updateMany({
          data: { isRead: true },
        });
      }
      broadcastRealtimeEvent('notification:read', { id: id || 'all' });
      res.json({ ok: true });
    })
  );

  app.delete(
    '/api/notifications',
    asyncHandler(async (_req, res) => {
      await prisma.systemNotification.deleteMany({});
      broadcastRealtimeEvent('notification:cleared', {});
      res.json({ ok: true });
    })
  );
}
