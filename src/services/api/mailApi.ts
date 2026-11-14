import { wsFetch as fetch } from '../sessionFetch';
import { getActiveGmailAccountId } from '../auth';

export interface ParsedEmail {
  id: string;
  threadId: string;
  snippet: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  to: string;
  cc?: string;
  date: string;
  timestamp: number;
  bodyHtml: string;
  bodyText: string;
  labelIds?: string[];
  folder?: string;
  isUnread: boolean;
  isStarred: boolean;
}

export interface CustomMailTab {
  id: string;
  name: string;
  query: string;
  accentColor: string;
  description: string;
  isBulkShortcut?: boolean;
}

export interface BulkCampaignItem {
  id: string;
  name: string;
  subject: string;
  bodyHtml: string;
  status: 'Draft' | 'Ready' | 'Sent';
  sentCount: number;
  totalCount: number;
  updatedAt: string;
  recipients?: Array<{
    id: string;
    name: string;
    email: string;
    company: string;
    role: string;
    selected: boolean;
    status: 'Idle' | 'Sending' | 'Sent' | 'Failed';
    error?: string;
  }>;
}

export interface ServerMailAccount {
  id: string;
  label: string;
  email: string;
  username: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  passwordHashPreview: string;
  createdAt: string;
  lastVerifiedAt?: string;
  role?: string;
  isSystemPrimary?: boolean;
}

export interface ServerMailVerifyResult {
  ok: boolean;
  imapOk: boolean;
  imapMessage: string;
  smtpOk: boolean;
  smtpMessage: string;
}

const adminRealtimeMessages: ParsedEmail[] = [];

export function injectRealtimeAdminInboxMessage(msg: ParsedEmail) {
  if (!adminRealtimeMessages.some((m) => m.id === msg.id)) {
    adminRealtimeMessages.unshift(msg);
    if (adminRealtimeMessages.length > 25) {
      adminRealtimeMessages.length = 25;
    }
  }
}

export function getRealtimeAdminInboxMessages(): ParsedEmail[] {
  return adminRealtimeMessages;
}

export async function fetchCustomMailTabs(): Promise<CustomMailTab[]> {
  try {
    const res = await fetch('/api/mail-tabs');
    if (!res.ok) return [];
    const data = await res.json();
    return data.tabs || [];
  } catch {
    return [];
  }
}

export async function saveCustomMailTab(tab: CustomMailTab): Promise<CustomMailTab[]> {
  const res = await fetch('/api/mail-tabs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tab),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to save custom mail tab.');
  }
  return data.tabs || [];
}

export async function deleteCustomMailTab(id: string): Promise<CustomMailTab[]> {
  const res = await fetch(`/api/mail-tabs/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  const data = await res.json();
  return data.tabs || [];
}

export async function fetchBulkCampaigns(): Promise<BulkCampaignItem[]> {
  try {
    const res = await fetch('/api/bulk-campaigns');
    if (!res.ok) return [];
    const data = await res.json();
    return data.campaigns || [];
  } catch {
    return [];
  }
}

export async function saveBulkCampaign(campaign: BulkCampaignItem): Promise<BulkCampaignItem[]> {
  const res = await fetch('/api/bulk-campaigns', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(campaign),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to save campaign.');
  }
  return data.campaigns || [];
}

export async function deleteBulkCampaign(id: string): Promise<BulkCampaignItem[]> {
  const res = await fetch(`/api/bulk-campaigns/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  const data = await res.json();
  return data.campaigns || [];
}

function mapQueryToFolderAndSearch(query: string): { folder: string; search: string } {
  const q = query.trim();
  const lower = q.toLowerCase();
  if (lower.startsWith('in:sent')) {
    return { folder: 'sent', search: q.replace(/^in:sent\s*/i, '').trim() };
  }
  if (lower.startsWith('is:starred')) {
    return { folder: 'starred', search: q.replace(/^is:starred\s*/i, '').trim() };
  }
  if (lower.startsWith('in:drafts')) {
    return { folder: 'drafts', search: q.replace(/^in:drafts\s*/i, '').trim() };
  }
  if (lower.startsWith('in:trash')) {
    return { folder: 'trash', search: q.replace(/^in:trash\s*/i, '').trim() };
  }
  if (lower.startsWith('in:inbox')) {
    return { folder: 'inbox', search: q.replace(/^in:inbox\s*/i, '').trim() };
  }
  if (lower.startsWith('in:anywhere')) {
    return { folder: 'all', search: q.replace(/^in:anywhere\s*/i, '').trim() };
  }
  return { folder: 'inbox', search: q };
}

export async function fetchGmailMessages(
  query = 'in:inbox',
  _maxResults = 25,
  forceRefresh = false
): Promise<ParsedEmail[]> {
  const accountId = getActiveGmailAccountId();

  if (!accountId) {
    if (query.includes('in:inbox') || query.includes('in:anywhere')) {
      return [...adminRealtimeMessages];
    }
    return [];
  }

  const { folder, search } = mapQueryToFolderAndSearch(query);
  const params = new URLSearchParams({
    folder,
    q: search,
    ...(forceRefresh ? { force: 'true' } : {}),
  });

  const res = await fetch(
    `/api/gmail/accounts/${encodeURIComponent(accountId)}/messages?${params.toString()}`
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch Gmail messages.');
  }

  const valid: ParsedEmail[] = data.messages || [];
  const merged =
    folder === 'inbox' || folder === 'all'
      ? [
          ...adminRealtimeMessages,
          ...valid.filter((v) => !adminRealtimeMessages.some((a) => a.id === v.id)),
        ]
      : valid;

  return merged;
}

export function getCachedMessages(query = 'in:inbox', _maxResults = 25): ParsedEmail[] | null {
  if ((query.includes('in:inbox') || query.includes('in:anywhere')) && adminRealtimeMessages.length > 0) {
    return [...adminRealtimeMessages];
  }
  return null;
}

export async function toggleGmailStar(messageId: string): Promise<void> {
  const accountId = getActiveGmailAccountId();
  if (!accountId) return;
  await fetch(`/api/gmail/accounts/${encodeURIComponent(accountId)}/star`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messageId }),
  });
}

export async function saveGmailDraft(draft: {
  to: string;
  cc?: string;
  subject: string;
  bodyText: string;
}): Promise<void> {
  const accountId = getActiveGmailAccountId();
  if (!accountId) {
    throw new Error('Please configure your Gmail account in Gmail Settings first.');
  }
  const res = await fetch(`/api/gmail/accounts/${encodeURIComponent(accountId)}/drafts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(draft),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to save draft.');
  }
}

export async function sendGmailMessage(params: {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  bodyHtml: string;
  threadId?: string;
}): Promise<{ id: string; threadId: string }> {
  const accountId = getActiveGmailAccountId();
  if (!accountId) {
    throw new Error('Please connect a Gmail account in Gmail Settings first.');
  }

  const bodyText = params.bodyHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const res = await fetch(`/api/gmail/accounts/${encodeURIComponent(accountId)}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: params.to,
      cc: params.cc,
      bcc: params.bcc,
      subject: params.subject,
      bodyHtml: params.bodyHtml,
      bodyText,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to send email via Gmail SMTP.');
  }

  return {
    id: data.message?.id || `msg-${Date.now()}`,
    threadId: data.message?.threadId || `thread-${Date.now()}`,
  };
}

export async function fetchServerMailAccounts(): Promise<ServerMailAccount[]> {
  const res = await fetch('/api/server-mail/accounts');
  if (!res.ok) {
    throw new Error('Failed to load Server Mail accounts.');
  }
  const data = await res.json();
  return data.accounts || [];
}

export async function verifyServerMailConnection(payload: {
  accountId?: string;
  email: string;
  username: string;
  password?: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
}): Promise<ServerMailVerifyResult> {
  const res = await fetch('/api/server-mail/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Connection verification failed.');
  }
  return data;
}

export async function saveServerMailAccount(payload: {
  id?: string;
  label: string;
  email: string;
  username: string;
  password?: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
}): Promise<{ account: ServerMailAccount; accounts: ServerMailAccount[] }> {
  const res = await fetch('/api/server-mail/accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to save Server Mail account.');
  }
  return data;
}

export async function deleteServerMailAccount(id: string): Promise<ServerMailAccount[]> {
  const res = await fetch(`/api/server-mail/accounts/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  const data = await res.json();
  return data.accounts || [];
}

export function getCachedServerMailMessages(
  _accountId: string,
  _folder: string,
  _searchQuery = ''
): ParsedEmail[] | null {
  return null;
}

export async function fetchServerMailMessages(
  accountId: string,
  folder = 'inbox',
  searchQuery = '',
  force = false
): Promise<{ messages: ParsedEmail[]; warning: string | null }> {
  const params = new URLSearchParams({
    folder,
    q: searchQuery,
    ...(force ? { force: 'true' } : {}),
  });

  const res = await fetch(
    `/api/server-mail/accounts/${encodeURIComponent(accountId)}/messages?${params.toString()}`
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch Server Mail messages.');
  }

  const messages: ParsedEmail[] = data.messages || [];
  return { messages, warning: data.warning || null };
}

export async function toggleServerMailStar(accountId: string, messageId: string): Promise<void> {
  await fetch(`/api/server-mail/accounts/${encodeURIComponent(accountId)}/star`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messageId }),
  });
}

export async function saveServerMailDraft(
  accountId: string,
  draft: { to: string; cc?: string; subject: string; bodyText: string }
): Promise<void> {
  await fetch(`/api/server-mail/accounts/${encodeURIComponent(accountId)}/drafts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(draft),
  });
}

export async function sendServerMailMessage(
  accountId: string,
  params: {
    to: string;
    cc?: string;
    bcc?: string;
    subject: string;
    bodyHtml: string;
    bodyText: string;
  }
): Promise<void> {
  const res = await fetch(`/api/server-mail/accounts/${encodeURIComponent(accountId)}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to send Server Mail message.');
  }
}
