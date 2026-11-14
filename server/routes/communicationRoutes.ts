import express from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { ensureExternalStorageDirs, prisma, UPLOADS_DIR } from '../db/prisma';
import { optimizeUploadedImageBuffer } from '../services/storageService';
import { requireAuth } from '../auth/sessionAuth';
import { asyncHandler, broadcastRealtimeEvent } from '../realtime';
import {
  getUserConversations,
  getOrCreateDirectConversation,
  getConversationMessages,
  sendCommunicationMessage,
  markConversationAsRead,
  CommunicationAttachmentItem,
} from '../engine/communicationEngineService';

const uploadStorage = multer.memoryStorage();
const uploadMiddleware = multer({
  storage: uploadStorage,
  limits: { fileSize: 30 * 1024 * 1024 },
});

export function registerCommunicationRoutes(app: express.Express) {
  /**
   * GET /api/communication/conversations
   * Lists all active conversation threads for the authenticated user.
   */
  app.get(
    '/api/communication/conversations',
    requireAuth,
    asyncHandler(async (req, res) => {
      const user = req.auth!.user;
      const conversations = await getUserConversations(user.id);
      res.json({ conversations });
    })
  );

  /**
   * POST /api/communication/conversations/direct/:targetUserId
   * Retrieve or create a 1-on-1 direct conversation with a target member or admin.
   * Accepts WorkspaceUser.id, WorkspaceMember.id, or email.
   */
  app.post(
    '/api/communication/conversations/direct/:targetUserId',
    requireAuth,
    asyncHandler(async (req, res) => {
      const user = req.auth!.user;
      const rawTargetId = String(req.params.targetUserId || '').trim();

      if (!rawTargetId) {
        res.status(400).json({ error: 'Invalid target user ID.' });
        return;
      }

      // Resolve target whether passed as WorkspaceUser.id, WorkspaceMember.id, or email
      let targetUser = await prisma.workspaceUser.findFirst({
        where: {
          OR: [
            { id: rawTargetId },
            { memberId: rawTargetId },
            { email: rawTargetId.toLowerCase() },
          ],
        },
      });

      let targetMember = await prisma.workspaceMember.findFirst({
        where: {
          OR: [
            { id: rawTargetId },
            ...(targetUser?.memberId ? [{ id: targetUser.memberId }] : []),
            ...(targetUser?.email ? [{ email: targetUser.email.toLowerCase() }] : []),
            { email: rawTargetId.toLowerCase() },
          ],
        },
      });

      if (!targetUser && targetMember) {
        targetUser = await prisma.workspaceUser.findFirst({
          where: {
            OR: [
              { memberId: targetMember.id },
              { email: targetMember.email.toLowerCase() },
            ],
          },
        });
      }

      if (!targetUser && !targetMember) {
        res.status(404).json({ error: 'Target member not found.' });
        return;
      }

      const resolvedTargetId = targetUser ? targetUser.id : targetMember!.id;
      if (resolvedTargetId === user.id) {
        res.status(400).json({ error: 'Cannot start a direct conversation with yourself.' });
        return;
      }

      const targetMeta = {
        id: resolvedTargetId,
        name: targetUser?.name || targetMember?.fullName || 'Workspace Member',
        role:
          targetMember?.designation ||
          (targetUser?.role === 'OWNER'
            ? 'Owner & Super Admin'
            : targetUser?.role === 'ADMIN'
              ? 'Workspace Administrator'
              : 'Workspace Member'),
        avatarUrl: targetUser?.avatarUrl || targetMember?.avatarUrl || null,
      };

      const conv = await getOrCreateDirectConversation(
        {
          id: user.id,
          name: user.name,
          role: user.role,
          avatarUrl: user.avatarUrl,
        },
        targetMeta
      );

      res.json({ conversation: conv });
    })
  );

  /**
   * GET /api/communication/conversations/:id/messages
   * Returns message history for a specific conversation strictly isolated to its two participants.
   */
  app.get(
    '/api/communication/conversations/:id/messages',
    requireAuth,
    asyncHandler(async (req, res) => {
      const user = req.auth!.user;
      const convId = req.params.id;
      const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : 100;

      const conv = await prisma.communicationConversation.findUnique({
        where: { id: convId },
      });

      if (!conv) {
        res.status(404).json({ error: 'Conversation not found.' });
        return;
      }

      if (conv.participant1Id !== user.id && conv.participant2Id !== user.id) {
        res.status(403).json({
          error: 'Access denied. Private 1-on-1 messages are strictly isolated to the two participants.',
        });
        return;
      }

      const messages = await getConversationMessages(convId, cursor, limit);
      res.json({ messages });
    })
  );

  /**
   * POST /api/communication/messages
   * Sends a message, updates conversation snippet & unread count, and broadcasts SSE event strictly to the two participants.
   */
  app.post(
    '/api/communication/messages',
    requireAuth,
    asyncHandler(async (req, res) => {
      const user = req.auth!.user;
      const {
        conversationId,
        recipientId,
        text,
        attachments,
        replyToId,
        replySnippet,
      } = req.body || {};

      if (!conversationId) {
        res.status(400).json({ error: 'conversationId is required.' });
        return;
      }

      const conv = await prisma.communicationConversation.findUnique({
        where: { id: conversationId },
      });

      if (!conv) {
        res.status(404).json({ error: 'Conversation not found.' });
        return;
      }

      if (conv.participant1Id !== user.id && conv.participant2Id !== user.id) {
        res.status(403).json({
          error: 'Access denied. You are not a participant in this private conversation.',
        });
        return;
      }

      const resolvedRecipientId =
        recipientId ||
        (conv.participant1Id === user.id ? conv.participant2Id : conv.participant1Id);

      const result = await sendCommunicationMessage({
        conversationId,
        sender: {
          id: user.id,
          name: user.name,
          role: user.role,
          avatarUrl: user.avatarUrl,
        },
        recipientId: resolvedRecipientId,
        text: String(text || '').trim(),
        attachments: (attachments as CommunicationAttachmentItem[]) || [],
        replyToId: replyToId ? String(replyToId) : undefined,
        replySnippet: replySnippet ? String(replySnippet) : undefined,
      });

      broadcastRealtimeEvent(
        'communication:message:new',
        {
          message: result.message,
          conversationId,
          recipientId: resolvedRecipientId,
          senderId: user.id,
        },
        [user.id, resolvedRecipientId]
      );

      res.json({ success: true, message: result.message });
    })
  );

  /**
   * POST /api/communication/messages/mark-read
   * Marks unread messages as read and resets conversation unread count.
   */
  app.post(
    '/api/communication/messages/mark-read',
    requireAuth,
    asyncHandler(async (req, res) => {
      const user = req.auth!.user;
      const { conversationId } = req.body || {};

      if (!conversationId) {
        res.status(400).json({ error: 'conversationId required.' });
        return;
      }

      const conv = await prisma.communicationConversation.findUnique({
        where: { id: conversationId },
      });

      if (!conv || (conv.participant1Id !== user.id && conv.participant2Id !== user.id)) {
        res.status(403).json({ error: 'Access denied.' });
        return;
      }

      const result = await markConversationAsRead(conversationId, user.id);

      broadcastRealtimeEvent(
        'communication:message:read',
        {
          conversationId,
          readerId: user.id,
        },
        [conv.participant1Id, conv.participant2Id]
      );

      res.json({ success: true, count: result.count });
    })
  );

  /**
   * POST /api/communication/upload
   * Multipart upload handler for photos, documents, and voice audio notes.
   */
  app.post(
    '/api/communication/upload',
    requireAuth,
    uploadMiddleware.single('file'),
    asyncHandler(async (req, res) => {
      if (!req.file) {
        res.status(400).json({ error: 'No file provided.' });
        return;
      }

      ensureExternalStorageDirs();

      const originalName = req.file.originalname || 'attachment.dat';
      const rawExt = path.extname(originalName).toLowerCase();
      const rawMime = req.file.mimetype || 'application/octet-stream';
      const optimized = await optimizeUploadedImageBuffer(req.file.buffer, rawMime, originalName);
      const ext = optimized.optimized ? `.${optimized.extension}` : rawExt;
      const mime = optimized.mimeType || rawMime;

      const safeBase = path
        .basename(originalName, rawExt)
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 40);

      const uniqueDiskName = `comm-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 6)}-${safeBase}${ext}`;
      const diskPath = path.join(UPLOADS_DIR, uniqueDiskName);

      fs.writeFileSync(diskPath, optimized.buffer);

      let fileType: 'IMAGE' | 'DOCUMENT' | 'AUDIO' | 'OTHER' = 'OTHER';

      if (mime.startsWith('image/')) {
        fileType = 'IMAGE';
      } else if (
        mime.startsWith('audio/') ||
        ext === '.webm' ||
        ext === '.mp3' ||
        ext === '.ogg' ||
        ext === '.wav'
      ) {
        fileType = 'AUDIO';
      } else if (
        mime.includes('pdf') ||
        mime.includes('word') ||
        mime.includes('document') ||
        mime.includes('sheet') ||
        mime.includes('excel') ||
        ext === '.pdf' ||
        ext === '.doc' ||
        ext === '.docx' ||
        ext === '.xls' ||
        ext === '.xlsx' ||
        ext === '.txt'
      ) {
        fileType = 'DOCUMENT';
      }

      const attachment: CommunicationAttachmentItem = {
        id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: originalName,
        url: `/uploads/${encodeURIComponent(uniqueDiskName)}`,
        fileType,
        sizeBytes: optimized.finalBytes,
        mimeType: mime,
      };

      res.json({ success: true, attachment });
    })
  );

  /**
   * GET /api/communication/members
   * Returns unified directory of all active workspace members and admin users for direct messaging.
   */
  app.get(
    '/api/communication/members',
    requireAuth,
    asyncHandler(async (req, res) => {
      const currentUser = req.auth!.user;
      const q = String(req.query.q || '').trim();
      const limit = Math.min(Math.max(1, Number(req.query.limit) || 100), 200);

      const [users, members] = await Promise.all([
        prisma.workspaceUser.findMany({
          where: {
            isActive: true,
            role: { in: ['OWNER', 'ADMIN', 'MEMBER'] },
            ...(q
              ? {
                  OR: [
                    { name: { contains: q, mode: 'insensitive' } },
                    { email: { contains: q, mode: 'insensitive' } },
                    { username: { contains: q, mode: 'insensitive' } },
                  ],
                }
              : {}),
          },
          select: {
            id: true,
            name: true,
            role: true,
            email: true,
            avatarUrl: true,
            phoneNumber: true,
            memberId: true,
          },
          orderBy: { name: 'asc' },
          take: limit,
        }),
        prisma.workspaceMember.findMany({
          where: q
            ? {
                OR: [
                  { fullName: { contains: q, mode: 'insensitive' } },
                  { email: { contains: q, mode: 'insensitive' } },
                  { designation: { contains: q, mode: 'insensitive' } },
                  { teamName: { contains: q, mode: 'insensitive' } },
                ],
              }
            : undefined,
          select: {
            id: true,
            fullName: true,
            email: true,
            designation: true,
            teamName: true,
            avatarUrl: true,
            phone: true,
          },
          orderBy: { fullName: 'asc' },
          take: limit,
        }),
      ]);

      const memberById = new Map(members.map((m) => [m.id, m]));
      const memberByEmail = new Map(members.map((m) => [(m.email || '').toLowerCase(), m]));
      const seenEmails = new Set<string>();

      const directory: Array<{
        id: string;
        memberId?: string | null;
        name: string;
        role: string;
        email: string;
        avatarUrl?: string | null;
        teamName?: string | null;
        isUser: boolean;
      }> = [];

      for (const u of users) {
        if (u.id === currentUser.id) continue;
        const emailLower = (u.email || '').toLowerCase();
        if (emailLower) seenEmails.add(emailLower);

        const linkedMem =
          (u.memberId ? memberById.get(u.memberId) : undefined) ||
          memberByEmail.get(emailLower);

        directory.push({
          id: u.id,
          memberId: linkedMem?.id || u.memberId || null,
          name: u.name || linkedMem?.fullName || u.email,
          role: linkedMem?.designation || u.role,
          email: u.email,
          avatarUrl: u.avatarUrl || linkedMem?.avatarUrl || null,
          teamName: linkedMem?.teamName || null,
          isUser: true,
        });
      }

      for (const m of members) {
        const emailLower = (m.email || '').toLowerCase();
        if (emailLower && (seenEmails.has(emailLower) || emailLower === (currentUser.email || '').toLowerCase())) {
          continue;
        }
        if (m.id === currentUser.memberId) continue;
        if (emailLower) seenEmails.add(emailLower);

        directory.push({
          id: m.id,
          memberId: m.id,
          name: m.fullName,
          role: m.designation || 'Member',
          email: m.email,
          avatarUrl: m.avatarUrl || null,
          teamName: m.teamName || null,
          isUser: false,
        });
      }

      res.json({ members: directory });
    })
  );
}
