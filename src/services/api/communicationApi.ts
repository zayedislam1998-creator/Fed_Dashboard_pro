import { fetchWithRetry } from '../engineCache';
import { wsFetch as fetch } from '../sessionFetch';

export interface CommunicationAttachment {
  id: string;
  name: string;
  url: string;
  fileType: 'IMAGE' | 'DOCUMENT' | 'AUDIO' | 'OTHER';
  sizeBytes?: number;
  mimeType?: string;
  fileId?: string;
}

export interface CommunicationMessageItem {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  senderAvatarUrl?: string | null;
  recipientId: string;
  text: string;
  attachments: CommunicationAttachment[];
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

export interface CommunicationConversationItem {
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

export interface CommunicationMemberItem {
  id: string;
  name: string;
  role: string;
  email: string;
  avatarUrl?: string | null;
  teamName?: string | null;
  isUser: boolean;
}

export async function fetchCommunicationConversations(): Promise<CommunicationConversationItem[]> {
  try {
    const res = await fetchWithRetry('/api/communication/conversations');
    if (!res.ok) return [];
    const data = await res.json();
    return data.conversations || [];
  } catch {
    return [];
  }
}

export async function getOrCreateDirectConversation(
  targetUserId: string
): Promise<{ id: string; conversationKey: string }> {
  const res = await fetchWithRetry(`/api/communication/conversations/direct/${encodeURIComponent(targetUserId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to initiate conversation.');
  }
  return data.conversation;
}

export async function fetchCommunicationMessages(
  conversationId: string,
  cursor?: string,
  limit?: number
): Promise<CommunicationMessageItem[]> {
  try {
    const params = new URLSearchParams();
    if (cursor) params.set('cursor', cursor);
    if (limit) params.set('limit', String(limit));
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetchWithRetry(`/api/communication/conversations/${encodeURIComponent(conversationId)}/messages${qs}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.messages || [];
  } catch {
    return [];
  }
}

export async function sendCommunicationMessage(payload: {
  conversationId: string;
  recipientId?: string;
  text: string;
  attachments?: CommunicationAttachment[];
  replyToId?: string;
  replySnippet?: string;
}): Promise<CommunicationMessageItem> {
  const res = await fetchWithRetry('/api/communication/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to send message.');
  }
  return data.message;
}

export async function markCommunicationMessagesRead(
  conversationId: string
): Promise<void> {
  try {
    await fetchWithRetry('/api/communication/messages/mark-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId }),
    });
  } catch {
    // ignore
  }
}

export async function uploadCommunicationFile(file: File | Blob, filename?: string): Promise<CommunicationAttachment> {
  const formData = new FormData();
  formData.append('file', file, filename || (file as any).name || 'voice-note.webm');

  const res = await fetch('/api/communication/upload', {
    method: 'POST',
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to upload attachment.');
  }
  return data.attachment;
}

export async function fetchCommunicationMembersList(
  query?: string,
  limit?: number
): Promise<CommunicationMemberItem[]> {
  try {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (limit) params.set('limit', String(limit));
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetchWithRetry(`/api/communication/members${qs}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.members || [];
  } catch {
    return [];
  }
}
