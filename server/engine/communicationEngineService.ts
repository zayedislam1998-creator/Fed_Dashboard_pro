import { prisma } from '../db/prisma';
import { syncWorkspaceUsersToMembers } from '../db/initEngine';

export interface CommunicationAttachmentItem {
  id: string;
  name: string;
  url: string;
  fileType: 'IMAGE' | 'DOCUMENT' | 'AUDIO' | 'OTHER';
  sizeBytes?: number;
  mimeType?: string;
  fileId?: string;
}

export interface CommunicationMessageDto {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  senderAvatarUrl?: string | null;
  recipientId: string;
  text: string;
  attachments: CommunicationAttachmentItem[];
  status: 'SENT' | 'DELIVERED' | 'READ';
  isRead: boolean;
  readAt?: string | null;
  replyToId?: string | null;
  replySnippet?: string | null;
  reactions: Record<string, string[]>;
  isPinned: boolean;
  createdAt: string;
  timestampMs: number;
}

export interface CommunicationConversationDto {
  id: string;
  conversationKey: string;
  partner: {
    id: string;
    name: string;
    role: string;
    avatarUrl?: string | null;
  };
  lastMessageText: string;
  lastMessageTimestampMs: number;
  unreadCount: number;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Deterministic conversation key generator for 1-on-1 private chats.
 */
export function resolveConversationKey(userId1: string, userId2: string): string {
  const [min, max] = [userId1.trim(), userId2.trim()].sort();
  return `direct:${min}:${max}`;
}

/**
 * Retrieve or initialize a 1-on-1 direct conversation between two users.
 */
export async function getOrCreateDirectConversation(
  currentUser: { id: string; name: string; role: string; avatarUrl?: string | null },
  targetUser: { id: string; name: string; role: string; avatarUrl?: string | null }
): Promise<any> {
  const key = resolveConversationKey(currentUser.id, targetUser.id);

  let conv = await prisma.communicationConversation.findUnique({
    where: { conversationKey: key },
  });

  if (!conv) {
    const nowIso = new Date().toISOString();
    const nowMs = BigInt(Date.now());
    const id = `conv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    conv = await prisma.communicationConversation.create({
      data: {
        id,
        conversationKey: key,
        participant1Id: currentUser.id,
        participant1Name: currentUser.name,
        participant1Role: currentUser.role,
        participant1AvatarUrl: currentUser.avatarUrl || null,
        participant2Id: targetUser.id,
        participant2Name: targetUser.name,
        participant2Role: targetUser.role,
        participant2AvatarUrl: targetUser.avatarUrl || null,
        lastMessageText: '',
        lastMessageTimestampMs: BigInt(0),
        unreadCountP1: 0,
        unreadCountP2: 0,
        createdAt: nowIso,
        updatedAt: nowIso,
        timestampMs: nowMs,
        extraFields: {},
      },
    });
  } else {
    // Keep participant metadata fresh
    const isP1Current = conv.participant1Id === currentUser.id;
    const expectedP1Name = isP1Current ? currentUser.name : targetUser.name;
    const expectedP1Role = isP1Current ? currentUser.role : targetUser.role;
    const expectedP1Avatar = (isP1Current ? currentUser.avatarUrl : targetUser.avatarUrl) || null;
    const expectedP2Name = isP1Current ? targetUser.name : currentUser.name;
    const expectedP2Role = isP1Current ? targetUser.role : currentUser.role;
    const expectedP2Avatar = (isP1Current ? targetUser.avatarUrl : currentUser.avatarUrl) || null;

    if (
      conv.participant1Name !== expectedP1Name ||
      conv.participant1Role !== expectedP1Role ||
      conv.participant1AvatarUrl !== expectedP1Avatar ||
      conv.participant2Name !== expectedP2Name ||
      conv.participant2Role !== expectedP2Role ||
      conv.participant2AvatarUrl !== expectedP2Avatar
    ) {
      conv = await prisma.communicationConversation.update({
        where: { id: conv.id },
        data: {
          participant1Name: expectedP1Name,
          participant1Role: expectedP1Role,
          participant1AvatarUrl: expectedP1Avatar,
          participant2Name: expectedP2Name,
          participant2Role: expectedP2Role,
          participant2AvatarUrl: expectedP2Avatar,
        },
      });
    }
  }

  return conv;
}

/**
 * Get all conversations for a specific user, automatically provisioning 1-on-1 threads
 * for every active workspace member so all members appear automatically in Communication.
 */
export async function getUserConversations(
  userId: string
): Promise<CommunicationConversationDto[]> {
  await syncWorkspaceUsersToMembers();

  const [currentUser, allEligibleUsers, allMembers, existingConversations] = await Promise.all([
    prisma.workspaceUser.findUnique({ where: { id: userId } }),
    prisma.workspaceUser.findMany({
      where: {
        isActive: true,
        role: { in: ['OWNER', 'ADMIN', 'MEMBER'] },
        NOT: { id: userId },
      },
      orderBy: { timestampMs: 'asc' },
    }),
    prisma.workspaceMember.findMany(),
    prisma.communicationConversation.findMany({
      where: {
        OR: [{ participant1Id: userId }, { participant2Id: userId }],
      },
    }),
  ]);

  const memberById = new Map(allMembers.map((m) => [m.id, m]));
  const memberByEmail = new Map(allMembers.map((m) => [(m.email || '').toLowerCase(), m]));
  const existingByKey = new Map(existingConversations.map((c) => [c.conversationKey, c]));

  if (currentUser) {
    const missingTargets: Array<{
      id: string;
      name: string;
      role: string;
      avatarUrl: string | null;
    }> = [];

    for (const target of allEligibleUsers) {
      const linkedMem =
        (target.memberId ? memberById.get(target.memberId) : undefined) ||
        memberByEmail.get((target.email || '').toLowerCase());

      const roleLabel =
        linkedMem?.designation ||
        (target.role === 'OWNER'
          ? 'Owner & Super Admin'
          : target.role === 'ADMIN'
            ? 'Workspace Administrator'
            : 'Workspace Member');

      const key = resolveConversationKey(currentUser.id, target.id);
      if (!existingByKey.has(key)) {
        missingTargets.push({
          id: target.id,
          name: target.name,
          role: roleLabel,
          avatarUrl: target.avatarUrl || linkedMem?.avatarUrl || null,
        });
      }
    }

    if (missingTargets.length > 0) {
      await Promise.all(
        missingTargets.map((targetMeta) =>
          getOrCreateDirectConversation(
            {
              id: currentUser.id,
              name: currentUser.name,
              role: currentUser.role,
              avatarUrl: currentUser.avatarUrl,
            },
            targetMeta
          )
        )
      );
    }
  }

  const eligibleIdSet = new Set(allEligibleUsers.map((u) => u.id));

  const rows = await prisma.communicationConversation.findMany({
    where: {
      OR: [{ participant1Id: userId }, { participant2Id: userId }],
    },
    orderBy: { lastMessageTimestampMs: 'desc' },
  });

  const mapped: CommunicationConversationDto[] = [];
  const seenPartnerIds = new Set<string>();

  for (const r of rows) {
    const isP1 = r.participant1Id === userId;
    const partnerId = isP1 ? r.participant2Id : r.participant1Id;

    // Filter out any legacy conversations with deleted/non-member accounts unless they have active history
    if (!eligibleIdSet.has(partnerId) && !r.lastMessageText) {
      continue;
    }
    if (seenPartnerIds.has(partnerId)) {
      continue;
    }
    seenPartnerIds.add(partnerId);

    const partner = isP1
      ? {
          id: r.participant2Id,
          name: r.participant2Name,
          role: r.participant2Role,
          avatarUrl: r.participant2AvatarUrl,
        }
      : {
          id: r.participant1Id,
          name: r.participant1Name,
          role: r.participant1Role,
          avatarUrl: r.participant1AvatarUrl,
        };

    const unreadCount = isP1 ? r.unreadCountP1 : r.unreadCountP2;

    mapped.push({
      id: r.id,
      conversationKey: r.conversationKey,
      partner,
      lastMessageText: r.lastMessageText,
      lastMessageTimestampMs: Number(r.lastMessageTimestampMs),
      unreadCount,
      isPinned: r.isPinned,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    });
  }

  mapped.sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    const aHasMsg = Boolean(a.lastMessageText && a.lastMessageText.trim());
    const bHasMsg = Boolean(b.lastMessageText && b.lastMessageText.trim());
    if (aHasMsg && bHasMsg) {
      return b.lastMessageTimestampMs - a.lastMessageTimestampMs;
    }
    if (aHasMsg !== bHasMsg) {
      return aHasMsg ? -1 : 1;
    }
    return a.partner.name.localeCompare(b.partner.name);
  });

  return mapped;
}

/**
 * Send a new communication message and update conversation stats.
 */
export async function sendCommunicationMessage(params: {
  conversationId: string;
  sender: { id: string; name: string; role: string; avatarUrl?: string | null };
  recipientId: string;
  text: string;
  attachments?: CommunicationAttachmentItem[];
  replyToId?: string;
  replySnippet?: string;
}): Promise<{ message: CommunicationMessageDto; conversation: any }> {
  const nowIso = new Date().toISOString();
  const nowMs = BigInt(Date.now());
  const msgId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const conv = await prisma.communicationConversation.findUnique({
    where: { id: params.conversationId },
  });

  if (!conv) {
    throw new Error('Conversation not found.');
  }

  const isSenderP1 = conv.participant1Id === params.sender.id;
  const snippet = params.text.trim()
    ? params.text.trim()
    : params.attachments && params.attachments.length > 0
      ? params.attachments[0].fileType === 'AUDIO'
        ? 'Voice memo'
        : params.attachments[0].fileType === 'IMAGE'
          ? 'Photo'
          : params.attachments[0].name || 'Attachment'
      : '';

  const [createdMessage, updatedConv] = await prisma.$transaction([
    prisma.communicationMessage.create({
      data: {
        id: msgId,
        conversationId: params.conversationId,
        senderId: params.sender.id,
        senderName: params.sender.name,
        senderRole: params.sender.role,
        senderAvatarUrl: params.sender.avatarUrl || null,
        recipientId: params.recipientId,
        text: params.text || '',
        attachments: (params.attachments || []) as any,
        status: 'SENT',
        isRead: false,
        replyToId: params.replyToId || null,
        replySnippet: params.replySnippet || null,
        reactions: {},
        isPinned: false,
        createdAt: nowIso,
        timestampMs: nowMs,
        extraFields: {},
      },
    }),
    prisma.communicationConversation.update({
      where: { id: params.conversationId },
      data: {
        lastMessageText: snippet,
        lastMessageTimestampMs: nowMs,
        updatedAt: nowIso,
        unreadCountP1: isSenderP1 ? conv.unreadCountP1 : { increment: 1 },
        unreadCountP2: isSenderP1 ? { increment: 1 } : conv.unreadCountP2,
      },
    }),
  ]);

  const dto: CommunicationMessageDto = {
    id: createdMessage.id,
    conversationId: createdMessage.conversationId,
    senderId: createdMessage.senderId,
    senderName: createdMessage.senderName,
    senderRole: createdMessage.senderRole,
    senderAvatarUrl: createdMessage.senderAvatarUrl,
    recipientId: createdMessage.recipientId,
    text: createdMessage.text,
    attachments: (createdMessage.attachments as any) || [],
    status: createdMessage.status as any,
    isRead: createdMessage.isRead,
    readAt: createdMessage.readAt,
    replyToId: createdMessage.replyToId,
    replySnippet: createdMessage.replySnippet,
    reactions: (createdMessage.reactions as any) || {},
    isPinned: createdMessage.isPinned,
    createdAt: createdMessage.createdAt,
    timestampMs: Number(createdMessage.timestampMs),
  };

  return { message: dto, conversation: updatedConv };
}

/**
 * Mark messages in a conversation as read by the recipient.
 */
export async function markConversationAsRead(
  conversationId: string,
  recipientId: string
): Promise<{ count: number; conversationId: string }> {
  const conv = await prisma.communicationConversation.findUnique({
    where: { id: conversationId },
  });

  if (!conv) return { count: 0, conversationId };

  const isP1 = conv.participant1Id === recipientId;
  const nowIso = new Date().toISOString();

  const updateResult = await prisma.communicationMessage.updateMany({
    where: {
      conversationId,
      recipientId,
      isRead: false,
    },
    data: {
      isRead: true,
      status: 'READ',
      readAt: nowIso,
    },
  });

  await prisma.communicationConversation.update({
    where: { id: conversationId },
    data: {
      unreadCountP1: isP1 ? 0 : conv.unreadCountP1,
      unreadCountP2: isP1 ? conv.unreadCountP2 : 0,
      updatedAt: nowIso,
    },
  });

  return { count: updateResult.count, conversationId };
}

/**
 * Get messages for a conversation ordered chronologically.
 */
export async function getConversationMessages(
  conversationId: string
): Promise<CommunicationMessageDto[]> {
  const rows = await prisma.communicationMessage.findMany({
    where: { conversationId },
    orderBy: { timestampMs: 'asc' },
    take: 300,
  });

  return rows.map((r) => ({
    id: r.id,
    conversationId: r.conversationId,
    senderId: r.senderId,
    senderName: r.senderName,
    senderRole: r.senderRole,
    senderAvatarUrl: r.senderAvatarUrl,
    recipientId: r.recipientId,
    text: r.text,
    attachments: (r.attachments as any) || [],
    status: r.status as any,
    isRead: r.isRead,
    readAt: r.readAt,
    replyToId: r.replyToId,
    replySnippet: r.replySnippet,
    reactions: (r.reactions as any) || {},
    isPinned: r.isPinned,
    createdAt: r.createdAt,
    timestampMs: Number(r.timestampMs),
  }));
}
