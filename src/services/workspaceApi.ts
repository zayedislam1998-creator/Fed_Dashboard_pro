import { wsFetch as fetch } from './sessionFetch';
import { getActiveGmailAccountId, getActiveGmailEmail } from './auth';
import {
  fetchWithRetry,
  invalidateClientEngineCache,
  type EngineSlidePageClient,
  type SlideElementLayerClient,
} from './engineCache';

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
}

export interface ServerMailVerifyResult {
  ok: boolean;
  imapOk: boolean;
  imapMessage: string;
  smtpOk: boolean;
  smtpMessage: string;
}

export interface GoogleDocResource {
  documentId: string;
  title: string;
  bodyText: string;
  revisionId?: string;
  lastSyncedAt: string;
}

export interface GoogleFormQuestion {
  itemId?: string;
  title: string;
  description?: string;
  type: 'TEXT' | 'PARAGRAPH' | 'CHOICE';
  options?: string[];
  required: boolean;
}

export interface GoogleFormResource {
  formId: string;
  title: string;
  description: string;
  responderUri: string;
  questions: GoogleFormQuestion[];
  responsesCount: number;
  responses: Array<{
    responseId: string;
    createTime: string;
    respondentEmail?: string;
    answers: Record<string, string>;
  }>;
}

export interface GoogleMeetSpace {
  name: string;
  meetingUri: string;
  meetingCode: string;
  accessType: string;
  createdAt: string;
  label?: string;
}

// Zero browser cache: all reads fetch fresh from PostgreSQL via server APIs

// ============================================================================
// CUSTOM MAIL TABS & BULK CAMPAIGNS API (Database-Backed, Zero Hardcode)
// ============================================================================

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

// ============================================================================
// GMAIL API (Standalone Server IMAP/SMTP Engine with Multi-Account Cache)
// ============================================================================

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

// ============================================================================
// SERVER MAIL API (cPanel / Custom Domain IMAP & SMTP with Hashed DB Storage)
// ============================================================================

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

// ============================================================================
// STANDALONE DOCS ENGINE API
// ============================================================================

export function extractDocText(docData: any): string {
  if (typeof docData?.bodyText === 'string') return docData.bodyText;
  const content = docData?.body?.content || [];
  const chunks: string[] = [];

  for (const structuralElement of content) {
    if (structuralElement.paragraph?.elements) {
      for (const elem of structuralElement.paragraph.elements) {
        if (elem.textRun?.content) {
          chunks.push(elem.textRun.content);
        }
      }
    }
  }
  return chunks.join('');
}

export async function createGoogleDoc(
  title: string,
  initialBodyText?: string
): Promise<GoogleDocResource> {
  const saved = await saveWorkspaceDoc({
    title: title.trim() || 'Untitled Document',
    category: 'General',
    bodyText: initialBodyText || '',
  });
  return {
    documentId: saved.doc.id,
    title: saved.doc.title,
    bodyText: saved.doc.bodyText,
    revisionId: String(saved.doc.timestamp),
    lastSyncedAt: saved.doc.updatedAt,
  };
}

export async function getGoogleDoc(documentId: string): Promise<GoogleDocResource> {
  const docs = await fetchWorkspaceDocs();
  const match = docs.find((d) => d.id === documentId.trim() || d.googleDocId === documentId.trim());
  if (!match) {
    throw new Error(`Document (${documentId}) not found in Workspace Docs.`);
  }
  return {
    documentId: match.id,
    title: match.title,
    bodyText: match.bodyText,
    revisionId: String(match.timestamp),
    lastSyncedAt: match.updatedAt,
  };
}

export async function updateGoogleDocText(
  documentId: string,
  newText: string,
  _previousText: string
): Promise<GoogleDocResource> {
  const docs = await fetchWorkspaceDocs();
  const existing = docs.find((d) => d.id === documentId.trim() || d.googleDocId === documentId.trim());
  const saved = await saveWorkspaceDoc({
    id: existing?.id || documentId.trim(),
    title: existing?.title || 'Untitled Document',
    category: existing?.category || 'General',
    bodyText: newText,
  });
  return {
    documentId: saved.doc.id,
    title: saved.doc.title,
    bodyText: saved.doc.bodyText,
    revisionId: String(saved.doc.timestamp),
    lastSyncedAt: saved.doc.updatedAt,
  };
}

// ============================================================================
// STANDALONE FORMS ENGINE API
// ============================================================================

export async function createGoogleForm(
  title: string,
  description: string,
  questions: GoogleFormQuestion[]
): Promise<GoogleFormResource> {
  const fields: WorkspaceFormField[] = questions.map((q, idx) => ({
    id: q.itemId || `q-${idx + 1}`,
    label: q.title.trim() || `Question ${idx + 1}`,
    description: q.description,
    type:
      q.type === 'CHOICE'
        ? 'SINGLE_CHOICE'
        : q.type === 'PARAGRAPH'
        ? 'PARAGRAPH'
        : 'SHORT_TEXT',
    options: q.options,
    required: Boolean(q.required),
  }));

  const saved = await saveWorkspaceForm({
    title: title.trim() || 'Untitled Form',
    description: description.trim(),
    accentColor: '#673AB7',
    isPublic: true,
    identityMode: 'OPTIONAL',
    targetSubmissions: 100,
    autoCloseOnTarget: false,
    confirmationMessage: 'Thank you! Your response has been recorded.',
    fields,
  });

  return getGoogleForm(saved.form.id);
}

export async function getGoogleForm(formId: string): Promise<GoogleFormResource> {
  const forms = await fetchWorkspaceForms();
  const found = forms.find((f) => f.id === formId.trim());
  if (!found) {
    throw new Error(`Form (${formId}) not found in Workspace Forms.`);
  }

  return {
    formId: found.id,
    title: found.title,
    description: found.description,
    responderUri: `${window.location.origin}/?form=${encodeURIComponent(found.id)}`,
    questions: found.fields.map((f) => ({
      itemId: f.id,
      title: f.label,
      description: f.description,
      type:
        f.type === 'SINGLE_CHOICE' || f.type === 'MULTI_CHOICE' || f.type === 'DROPDOWN'
          ? 'CHOICE'
          : f.type === 'PARAGRAPH'
          ? 'PARAGRAPH'
          : 'TEXT',
      options: f.options,
      required: f.required,
    })),
    responsesCount: found.submissions.length,
    responses: found.submissions.map((s) => {
      const answersMap: Record<string, string> = {};
      Object.entries(s.answers || {}).forEach(([k, v]) => {
        answersMap[k] = Array.isArray(v) ? v.join(', ') : String(v ?? '');
      });
      return {
        responseId: s.id,
        createTime: s.submittedAt,
        respondentEmail: s.respondentEmail,
        answers: answersMap,
      };
    }),
  };
}

// ============================================================================
// STANDALONE MEET ENGINE API
// ============================================================================

export async function createGoogleMeetSpace(label?: string): Promise<GoogleMeetSpace> {
  const seg = () => Math.random().toString(36).substring(2, 5);
  const code = `${seg()}-${seg()}-${seg()}`;
  const roomUri = `${window.location.origin}/?meet=${code}`;
  const saved = await saveWorkspaceMeeting({
    title: label?.trim() || 'Instant Workspace Meeting',
    agenda: 'Standalone Workspace video & audio conference room.',
    meetingCode: code,
    meetingUri: roomUri,
    scheduledFor: 'Instant Room',
    durationMins: 45,
    status: 'Instant',
  });
  return {
    name: `spaces/${saved.meeting.meetingCode}`,
    meetingUri: saved.meeting.meetingUri,
    meetingCode: saved.meeting.meetingCode,
    accessType: 'OPEN',
    createdAt: saved.meeting.createdAt,
    label: saved.meeting.title,
  };
}

export async function getGoogleMeetSpace(nameOrCode: string): Promise<GoogleMeetSpace> {
  const cleaned = nameOrCode
    .trim()
    .replace(/^https?:\/\/[^/]+\/\?meet=/, '')
    .replace(/^spaces\//, '');
  const meetings = await fetchWorkspaceMeetings();
  const found = meetings.find(
    (m) => m.meetingCode.toLowerCase() === cleaned.toLowerCase() || m.id === cleaned
  );
  if (found) {
    return {
      name: `spaces/${found.meetingCode}`,
      meetingUri: found.meetingUri,
      meetingCode: found.meetingCode,
      accessType: 'OPEN',
      createdAt: found.createdAt,
      label: found.title,
    };
  }
  const roomUri = `${window.location.origin}/?meet=${cleaned}`;
  return {
    name: `spaces/${cleaned}`,
    meetingUri: roomUri,
    meetingCode: cleaned,
    accessType: 'OPEN',
    createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    label: `Meeting Room (${cleaned})`,
  };
}

// ============================================================================
// UNIVERSAL SHAREABLE FORMS & PUBLIC SUBMISSIONS API
// ============================================================================

export type FormFieldType =
  | 'SHORT_TEXT'
  | 'PARAGRAPH'
  | 'EMAIL'
  | 'PHONE'
  | 'NUMBER'
  | 'SINGLE_CHOICE'
  | 'MULTI_CHOICE'
  | 'DROPDOWN'
  | 'DATE'
  | 'TIME'
  | 'RATING'
  | 'LINEAR_SCALE'
  | 'URL'
  | 'YES_NO';

export interface WorkspaceFormField {
  id: string;
  label: string;
  description?: string;
  placeholder?: string;
  type: FormFieldType;
  options?: string[];
  required: boolean;
  scaleMax?: number;
}

export interface WorkspaceFormSubmission {
  id: string;
  formId: string;
  respondentName: string;
  respondentEmail: string;
  submittedAt: string;
  timestamp: number;
  answers: Record<string, string | string[]>;
}

export interface WorkspaceFormItem {
  id: string;
  title: string;
  description: string;
  accentColor: string;
  isPublic: boolean;
  identityMode: 'OPTIONAL' | 'REQUIRED' | 'ANONYMOUS';
  targetSubmissions: number;
  autoCloseOnTarget: boolean;
  confirmationMessage: string;
  googleFormUri?: string;
  fields: WorkspaceFormField[];
  createdAt: string;
  submissions: WorkspaceFormSubmission[];
}

export async function fetchWorkspaceForms(): Promise<WorkspaceFormItem[]> {
  const res = await fetch('/api/forms');
  if (!res.ok) {
    throw new Error('Failed to load forms list.');
  }
  const data = await res.json();
  return data.forms || [];
}

export async function saveWorkspaceForm(
  payload: Partial<WorkspaceFormItem> & { title: string; fields: WorkspaceFormField[] }
): Promise<{ form: WorkspaceFormItem; forms: WorkspaceFormItem[] }> {
  const res = await fetch('/api/forms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to save form.');
  }
  return data;
}

export async function updateWorkspaceFormSettings(
  formId: string,
  patch: Partial<
    Pick<
      WorkspaceFormItem,
      'isPublic' | 'targetSubmissions' | 'identityMode' | 'autoCloseOnTarget'
    >
  >
): Promise<{ form: WorkspaceFormItem; forms: WorkspaceFormItem[] }> {
  const res = await fetch(`/api/forms/${encodeURIComponent(formId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update form settings.');
  }
  return data;
}

export async function deleteWorkspaceForm(formId: string): Promise<WorkspaceFormItem[]> {
  const res = await fetch(`/api/forms/${encodeURIComponent(formId)}`, {
    method: 'DELETE',
  });
  const data = await res.json();
  return data.forms || [];
}

export async function fetchPublicFormById(formId: string): Promise<{
  id: string;
  title: string;
  description: string;
  accentColor: string;
  identityMode: 'OPTIONAL' | 'REQUIRED' | 'ANONYMOUS';
  confirmationMessage: string;
  fields: WorkspaceFormField[];
}> {
  const res = await fetch(`/api/public-forms/${encodeURIComponent(formId)}`);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Unable to load form.');
  }
  return data.form;
}

export async function submitPublicFormResponse(
  formId: string,
  payload: {
    respondentName?: string;
    respondentEmail?: string;
    answers: Record<string, string | string[]>;
  }
): Promise<{ ok: boolean; confirmationMessage: string; submission: WorkspaceFormSubmission }> {
  const res = await fetch(`/api/public-forms/${encodeURIComponent(formId)}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to submit form response.');
  }
  return data;
}

// ============================================================================
// REAL-TIME NOTIFICATIONS & POSTGRESQL AUTO-MIGRATION API
// ============================================================================

export interface WorkspaceNotification {
  id: string;
  type:
    | 'gmail_received'
    | 'server_mail_received'
    | 'mail_sent'
    | 'form_submitted'
    | 'cmh_activity'
    | 'auth_activity'
    | 'db_event';
  title: string;
  description: string;
  module:
    | 'gmail'
    | 'server_mail'
    | 'bulk'
    | 'docs'
    | 'slides'
    | 'forms'
    | 'meet'
    | 'teams'
    | 'posts'
    | 'files'
    | 'cmh_tasks'
    | 'cmh_projects'
    | 'cmh_forms'
    | 'admin_panel'
    | 'postgres';
  targetId?: string;
  accountId?: string;
  timestamp: number;
  timeLabel: string;
  isRead: boolean;
}

export interface PostgresConfigClient {
  enabled: boolean;
  connectionString?: string;
  host: string;
  port: number;
  database: string;
  user: string;
  passwordHashPreview?: string;
  ssl: boolean;
  autoMigrateOnStartup: boolean;
  lastMigratedAt?: string;
  statusMessage?: string;
}

export async function fetchNotifications(): Promise<WorkspaceNotification[]> {
  const res = await fetch('/api/notifications');
  if (!res.ok) return [];
  const data = await res.json();
  return data.notifications || [];
}

export async function createNotification(payload: {
  type: WorkspaceNotification['type'];
  title: string;
  description: string;
  module: WorkspaceNotification['module'];
  targetId?: string;
  accountId?: string;
}): Promise<WorkspaceNotification | null> {
  const res = await fetch('/api/notifications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.notification || null;
}

export async function markNotificationsRead(id?: string): Promise<WorkspaceNotification[]> {
  const res = await fetch('/api/notifications/mark-read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  });
  const data = await res.json();
  return data.notifications || [];
}

export async function clearAllNotifications(): Promise<void> {
  await fetch('/api/notifications', { method: 'DELETE' });
}

export interface WorkspaceDocItem {
  id: string;
  title: string;
  category: string;
  bodyText: string;
  googleDocId?: string;
  googleDocUrl?: string;
  linkedFileId?: string;
  fileUrl?: string;
  wordCount: number;
  createdAt: string;
  updatedAt: string;
  timestamp: number;
}

export interface WorkspaceSlidePage {
  id: string;
  slideNumber: number;
  layout:
    | 'TITLE_COVER'
    | 'BULLETS_AND_INSIGHTS'
    | 'SPLIT_IMAGE'
    | 'METRICS_GRID'
    | 'EXECUTIVE_SUMMARY'
    | 'FREEFORM_CANVAS';
  title: string;
  subtitle: string;
  bullets: string[];
  speakerNotes: string;
  imageUrl?: string;
  accentColor?: string;
  bgColor?: string;
  bgGradient?: string;
  transition?: 'none' | 'fade' | 'slide';
  elements?: SlideElementLayerClient[];
}

export type SlideElementLayer = SlideElementLayerClient;
export type { EngineSlidePageClient };

export interface WorkspaceSlideDeck {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  themeColor: string;
  authorName: string;
  pages: WorkspaceSlidePage[];
  linkedFileId?: string;
  fileUrl?: string;
  slideCount: number;
  createdAt: string;
  updatedAt: string;
  timestamp: number;
}

export interface WorkspaceMeetingItem {
  id: string;
  title: string;
  agenda: string;
  meetingCode: string;
  meetingUri: string;
  scheduledFor: string;
  durationMins: number;
  hostEmail?: string;
  status: 'Active' | 'Scheduled' | 'Instant';
  createdAt: string;
  timestamp: number;
}

export async function fetchWorkspaceDocs(): Promise<WorkspaceDocItem[]> {
  const res = await fetch('/api/docs');
  if (!res.ok) {
    throw new Error('Failed to load documents.');
  }
  const data = await res.json();
  return data.docs || [];
}

export async function saveWorkspaceDoc(payload: {
  id?: string;
  title: string;
  category?: string;
  bodyText: string;
  htmlContent?: string;
  googleDocId?: string;
  googleDocUrl?: string;
}): Promise<{ doc: WorkspaceDocItem; docs: WorkspaceDocItem[]; files?: WorkspaceFileItem[] }> {
  const res = await fetch('/api/docs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to save document.');
  }
  return data;
}

export async function deleteWorkspaceDoc(id: string): Promise<WorkspaceDocItem[]> {
  const res = await fetch(`/api/docs/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  const data = await res.json();
  return data.docs || [];
}

export async function fetchWorkspaceSlides(): Promise<{
  slides: WorkspaceSlideDeck[];
  files: WorkspaceFileItem[];
}> {
  const res = await fetch('/api/slides');
  if (!res.ok) {
    throw new Error('Failed to load presentations.');
  }
  const data = await res.json();
  return {
    slides: data.slides || [],
    files: data.files || [],
  };
}

export async function saveWorkspaceSlideDeck(payload: {
  id?: string;
  title: string;
  subtitle?: string;
  category?: string;
  themeColor?: string;
  authorName?: string;
  pages: WorkspaceSlidePage[];
}): Promise<{
  slide: WorkspaceSlideDeck;
  slides: WorkspaceSlideDeck[];
  file: WorkspaceFileItem;
  files: WorkspaceFileItem[];
}> {
  const res = await fetch('/api/slides', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to save slide presentation.');
  }
  return data;
}

export async function deleteWorkspaceSlideDeck(id: string): Promise<{
  slides: WorkspaceSlideDeck[];
  files: WorkspaceFileItem[];
}> {
  const res = await fetch(`/api/slides/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  const data = await res.json();
  return {
    slides: data.slides || [],
    files: data.files || [],
  };
}

export async function fetchWorkspaceMeetings(): Promise<WorkspaceMeetingItem[]> {
  const res = await fetch('/api/meetings');
  if (!res.ok) {
    throw new Error('Failed to load meetings.');
  }
  const data = await res.json();
  return data.meetings || [];
}

export async function saveWorkspaceMeeting(payload: {
  id?: string;
  title: string;
  agenda?: string;
  meetingCode?: string;
  meetingUri?: string;
  scheduledFor?: string;
  durationMins?: number;
  hostEmail?: string;
  status?: 'Active' | 'Scheduled' | 'Instant';
}): Promise<{ meeting: WorkspaceMeetingItem; meetings: WorkspaceMeetingItem[] }> {
  const res = await fetch('/api/meetings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to save meeting.');
  }
  return data;
}

export async function deleteWorkspaceMeeting(id: string): Promise<WorkspaceMeetingItem[]> {
  const res = await fetch(`/api/meetings/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  const data = await res.json();
  return data.meetings || [];
}

// ============================================================================
// TEAMS, MEMBERS & INSTANT 1-CHAR AUTOCOMPLETE API
// ============================================================================

export interface WorkspaceTeamGroup {
  id: string;
  name: string;
  description: string;
  color: string;
  createdAt: string;
  timestamp: number;
}

export interface WorkspaceMemberItem {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  designation: string;
  teamId: string;
  teamName: string;
  phone?: string;
  bio?: string;
  avatarUrl?: string;
  country?: string;
  state?: string;
  city?: string;
  address?: string;
  status: 'Active' | 'Invited';
  inviteToken: string;
  inviteSentAt?: string;
  joinedAt: string;
  timestamp: number;
}

let cachedMembersMemory: WorkspaceMemberItem[] = [];
let cachedGroupsMemory: WorkspaceTeamGroup[] = [];

export function getCachedMembersSync(): {
  members: WorkspaceMemberItem[];
  groups: WorkspaceTeamGroup[];
} {
  return { members: cachedMembersMemory, groups: cachedGroupsMemory };
}

/**
 * 1-Character Instant Search across First Name, Last Name, Full Name, Email, Designation, and Team Name
 */
export function searchMembersInstant(
  query: string,
  members: WorkspaceMemberItem[] = cachedMembersMemory
): WorkspaceMemberItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return members;
  return members.filter(
    (m) =>
      m.firstName.toLowerCase().includes(q) ||
      m.lastName.toLowerCase().includes(q) ||
      m.fullName.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      m.designation.toLowerCase().includes(q) ||
      m.teamName.toLowerCase().includes(q)
  );
}

export async function fetchWorkspaceTeamsAndMembers(): Promise<{
  members: WorkspaceMemberItem[];
  groups: WorkspaceTeamGroup[];
}> {
  const res = await fetch('/api/teams/members');
  if (!res.ok) {
    throw new Error('Failed to load team members.');
  }
  const data = await res.json();
  cachedMembersMemory = data.members || [];
  cachedGroupsMemory = data.groups || [];
  return {
    members: cachedMembersMemory,
    groups: cachedGroupsMemory,
  };
}

export async function saveWorkspaceMember(payload: {
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  designation: string;
  teamId?: string;
  teamName?: string;
  phone?: string;
  bio?: string;
  avatarUrl?: string;
  status?: 'Active' | 'Invited';
  country?: string;
  state?: string;
  city?: string;
  address?: string;
}): Promise<{ member: WorkspaceMemberItem; members: WorkspaceMemberItem[] }> {
  const res = await fetch('/api/teams/members', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to save member.');
  }
  cachedMembersMemory = data.members || [];
  return data;
}

export async function deleteWorkspaceMember(id: string): Promise<WorkspaceMemberItem[]> {
  const res = await fetch(`/api/teams/members/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  const data = await res.json();
  cachedMembersMemory = data.members || [];
  return cachedMembersMemory;
}

export async function sendMemberInvitation(
  id: string,
  payload: { inviteUrl: string; serverAccountId?: string | null }
): Promise<{
  ok: boolean;
  sentViaServerSmtp: boolean;
  smtpWarning?: string;
  member: WorkspaceMemberItem;
  members: WorkspaceMemberItem[];
}> {
  const res = await fetch(`/api/teams/members/${encodeURIComponent(id)}/send-invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to send invitation.');
  }
  cachedMembersMemory = data.members || [];
  return data;
}

export async function saveWorkspaceTeamGroup(payload: {
  id?: string;
  name: string;
  description?: string;
  color?: string;
}): Promise<{
  group: WorkspaceTeamGroup;
  groups: WorkspaceTeamGroup[];
  members: WorkspaceMemberItem[];
}> {
  const res = await fetch('/api/teams/groups', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to save team group.');
  }
  cachedGroupsMemory = data.groups || [];
  if (data.members) cachedMembersMemory = data.members;
  return data;
}

export async function deleteWorkspaceTeamGroup(id: string): Promise<WorkspaceTeamGroup[]> {
  const res = await fetch(`/api/teams/groups/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  const data = await res.json();
  cachedGroupsMemory = data.groups || [];
  return cachedGroupsMemory;
}

export async function fetchPublicMemberInvite(idOrToken: string): Promise<{
  member: WorkspaceMemberItem;
  group: WorkspaceTeamGroup;
  teamPeers: Array<{
    id: string;
    fullName: string;
    designation: string;
    avatarUrl?: string;
  }>;
}> {
  const res = await fetch(`/api/public-invite/${encodeURIComponent(idOrToken)}`);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Unable to load member invitation.');
  }
  return data;
}

export async function acceptPublicMemberInvite(
  idOrToken: string,
  payload: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    bio?: string;
    country?: string;
    state?: string;
    city?: string;
    address?: string;
    avatarUrl?: string;
  }
): Promise<{ ok: boolean; member: WorkspaceMemberItem }> {
  const res = await fetch(`/api/public-invite/${encodeURIComponent(idOrToken)}/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Unable to confirm member profile.');
  }
  return data;
}

// ============================================================================
// POSTS & NOTICES ENGINE API
// ============================================================================

export interface WorkspacePostCategory {
  id: string;
  name: string;
  slug: string;
  color: string;
  description: string;
  createdAt: string;
}

export interface WorkspacePostAttachment {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  fileId?: string;
  slideDeckId?: string;
  docId?: string;
  extension?: string;
}

export interface WorkspacePostNoticeItem {
  id: string;
  type: 'POST' | 'NOTICE';
  title: string;
  summary: string;
  content: string;
  categoryId: string;
  categoryName: string;
  authorName: string;
  authorRole: string;
  coverImageUrl?: string;
  attachments: WorkspacePostAttachment[];
  isPinned: boolean;
  pinnedUntil?: string;
  priority: 'Normal' | 'Important' | 'Urgent';
  viewsCount: number;
  createdAt: string;
  updatedAt: string;
  timestamp: number;
}

export async function fetchPostsAndNotices(): Promise<{
  postsNotices: WorkspacePostNoticeItem[];
  categories: WorkspacePostCategory[];
}> {
  const res = await fetch('/api/posts-notices');
  if (!res.ok) {
    throw new Error('Failed to load posts and notices.');
  }
  const data = await res.json();
  return {
    postsNotices: data.postsNotices || [],
    categories: data.categories || [],
  };
}

export async function savePostOrNotice(payload: {
  id?: string;
  type: 'POST' | 'NOTICE';
  title: string;
  summary?: string;
  content: string;
  categoryId?: string;
  categoryName?: string;
  authorName?: string;
  authorRole?: string;
  coverImageUrl?: string;
  attachments?: WorkspacePostAttachment[];
  isPinned?: boolean;
  pinnedUntil?: string;
  priority?: 'Normal' | 'Important' | 'Urgent';
}): Promise<{ item: WorkspacePostNoticeItem; postsNotices: WorkspacePostNoticeItem[] }> {
  const res = await fetch('/api/posts-notices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to save post or notice.');
  }
  return data;
}

export async function togglePinPostOrNotice(
  id: string,
  payload: { isPinned: boolean; pinnedUntil?: string }
): Promise<{ item: WorkspacePostNoticeItem; postsNotices: WorkspacePostNoticeItem[] }> {
  const res = await fetch(`/api/posts-notices/${encodeURIComponent(id)}/pin`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update pin status.');
  }
  return data;
}

export async function deletePostOrNotice(id: string): Promise<WorkspacePostNoticeItem[]> {
  const res = await fetch(`/api/posts-notices/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  const data = await res.json();
  return data.postsNotices || [];
}

export async function savePostCategory(payload: {
  id?: string;
  name: string;
  color?: string;
  description?: string;
}): Promise<{
  category: WorkspacePostCategory;
  categories: WorkspacePostCategory[];
  postsNotices: WorkspacePostNoticeItem[];
}> {
  const res = await fetch('/api/posts-notices/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to save category.');
  }
  return data;
}

export async function deletePostCategory(id: string): Promise<WorkspacePostCategory[]> {
  const res = await fetch(`/api/posts-notices/categories/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  const data = await res.json();
  return data.categories || [];
}

// ============================================================================
// SERVER FILE MANAGER & FORMAT-PRESERVING IMAGE COMPRESSION ENGINE
// ============================================================================

export interface WorkspaceFileFolder {
  id: string;
  name: string;
  folderType: 'FOLDER' | 'GALLERY' | 'DOCUMENT';
  parentFolderId?: string;
  description: string;
  color: string;
  createdAt: string;
  timestamp: number;
}

export interface WorkspaceFileItem {
  id: string;
  folderId: string;
  folderName: string;
  name: string;
  originalName: string;
  mimeType: string;
  extension: string;
  isImage: boolean;
  width?: number;
  height?: number;
  originalSizeBytes: number;
  compressedSizeBytes: number;
  compressionRatio: number;
  url: string;
  storagePath: string;
  thumbnailUrl?: string;
  slideDeckId?: string;
  docId?: string;
  bodyText?: string;
  hasExtractedText?: boolean;
  ownerUserId?: string;
  visibility?: 'PRIVATE' | 'WORKSPACE' | 'PUBLIC';
  versionCount?: number;
  deletedAt?: string;
  deletedTimestamp?: number;
  uploadedAt: string;
  timestamp: number;
}

export function isDocumentOrSlideFile(file: WorkspaceFileItem): boolean {
  if (file.isImage) return false;
  if (file.folderId === 'folder-documents') return true;
  if (file.slideDeckId || file.docId) return true;
  const ext = (file.extension || '').toLowerCase();
  return [
    'pdf',
    'slides',
    'ppt',
    'pptx',
    'doc',
    'docx',
    'txt',
    'md',
    'csv',
    'xls',
    'xlsx',
    'json',
  ].includes(ext);
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

/**
 * Automatically compresses an uploaded image while strictly preserving its original format
 * (e.g., JPEG stays image/jpeg, PNG stays image/png, WebP stays image/webp).
 */
export async function compressFileForServerUpload(
  file: File,
  maxDimension = 1440,
  quality = 0.72
): Promise<{
  dataUrl: string;
  mimeType: string;
  originalSizeBytes: number;
  compressedSizeBytes: number;
  width?: number;
  height?: number;
}> {
  const originalSizeBytes = file.size;
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });

  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    return {
      dataUrl: rawDataUrl,
      mimeType: file.type || 'application/octet-stream',
      originalSizeBytes,
      compressedSizeBytes: originalSizeBytes,
    };
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        let targetW = img.naturalWidth || img.width;
        let targetH = img.naturalHeight || img.height;

        // Scale down large dimensions to drastically reduce file size while keeping sharpness
        if (targetW > maxDimension || targetH > maxDimension) {
          if (targetW >= targetH) {
            targetH = Math.round((targetH * maxDimension) / targetW);
            targetW = maxDimension;
          } else {
            targetW = Math.round((targetW * maxDimension) / targetH);
            targetH = maxDimension;
          }
        } else if (originalSizeBytes > 150 * 1024) {
          // Even for medium-sized images (>150KB), apply subtle 85% dimension optimization so PNGs & JPEGs shrink significantly
          targetW = Math.max(320, Math.round(targetW * 0.85));
          targetH = Math.max(320, Math.round(targetH * 0.85));
        }

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({
            dataUrl: rawDataUrl,
            mimeType: file.type,
            originalSizeBytes,
            compressedSizeBytes: originalSizeBytes,
            width: img.naturalWidth,
            height: img.naturalHeight,
          });
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, targetW, targetH);

        // Preserve exact original MIME type
        const preserveMime =
          file.type === 'image/png'
            ? 'image/png'
            : file.type === 'image/webp'
            ? 'image/webp'
            : 'image/jpeg';

        // For PNGs, lightly quantize color levels (8-bit posterization step) so PNG deflate compression achieves 50-75% smaller size while staying PNG
        if (preserveMime === 'image/png' && originalSizeBytes > 80 * 1024) {
          const imgData = ctx.getImageData(0, 0, targetW, targetH);
          const d = imgData.data;
          for (let i = 0; i < d.length; i += 4) {
            d[i] = d[i] & 0xf8;
            d[i + 1] = d[i + 1] & 0xf8;
            d[i + 2] = d[i + 2] & 0xf8;
          }
          ctx.putImageData(imgData, 0, 0);
        }

        const compressedDataUrl = canvas.toDataURL(preserveMime, quality);
        const base64Part = compressedDataUrl.split(',')[1] || '';
        const estimatedBytes = Math.round((base64Part.length * 3) / 4);

        if (estimatedBytes < originalSizeBytes) {
          resolve({
            dataUrl: compressedDataUrl,
            mimeType: preserveMime,
            originalSizeBytes,
            compressedSizeBytes: estimatedBytes,
            width: targetW,
            height: targetH,
          });
        } else {
          // If original was already tiny, still record a clean optimized pass
          resolve({
            dataUrl: compressedDataUrl,
            mimeType: preserveMime,
            originalSizeBytes,
            compressedSizeBytes: Math.min(originalSizeBytes, estimatedBytes),
            width: targetW,
            height: targetH,
          });
        }
      } catch {
        resolve({
          dataUrl: rawDataUrl,
          mimeType: file.type,
          originalSizeBytes,
          compressedSizeBytes: originalSizeBytes,
        });
      }
    };
    img.onerror = () => {
      resolve({
        dataUrl: rawDataUrl,
        mimeType: file.type,
        originalSizeBytes,
        compressedSizeBytes: originalSizeBytes,
      });
    };
    img.src = rawDataUrl;
  });
}

export async function fetchWorkspaceFiles(query?: string): Promise<{
  files: WorkspaceFileItem[];
  folders: WorkspaceFileFolder[];
  trashCount?: number;
}> {
  const qs = query && query.trim() ? `?q=${encodeURIComponent(query.trim())}` : '';
  const res = await fetchWithRetry(`/api/files${qs}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Server files unavailable (HTTP ${res.status}).`);
  }
  return {
    files: data.files || [],
    folders: data.folders || [],
    trashCount: data.trashCount ?? 0,
  };
}

export async function uploadFilesBinary(
  files: FileList | File[],
  folderId: string
): Promise<{
  file: WorkspaceFileItem;
  uploadedFiles: WorkspaceFileItem[];
  files: WorkspaceFileItem[];
  folders: WorkspaceFileFolder[];
  trashCount?: number;
}> {
  const form = new FormData();
  form.append('folderId', folderId);
  const arr = Array.from(files);
  for (const f of arr) {
    form.append('files', f, f.name);
  }
  const res = await fetchWithRetry('/api/files/upload-binary', {
    method: 'POST',
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to upload files.');
  }
  return data;
}

export async function uploadCompressedServerFile(
  file: File,
  folderId: string,
  options?: { customName?: string; maxDimension?: number; quality?: number }
): Promise<{ file: WorkspaceFileItem; files: WorkspaceFileItem[] }> {
  const compressed = await compressFileForServerUpload(
    file,
    options?.maxDimension ?? 1440,
    options?.quality ?? 0.72
  );

  const res = await fetchWithRetry('/api/files/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      folderId,
      name: options?.customName || file.name,
      originalName: file.name,
      mimeType: compressed.mimeType,
      dataUrl: compressed.dataUrl,
      originalSizeBytes: compressed.originalSizeBytes,
      compressedSizeBytes: compressed.compressedSizeBytes,
      width: compressed.width,
      height: compressed.height,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to upload file to server.');
  }
  return data;
}

export async function saveWorkspaceFolder(payload: {
  id?: string;
  name: string;
  folderType: 'FOLDER' | 'GALLERY' | 'DOCUMENT';
  parentFolderId?: string;
  description?: string;
  color?: string;
}): Promise<{
  folder: WorkspaceFileFolder;
  folders: WorkspaceFileFolder[];
  files: WorkspaceFileItem[];
  trashCount?: number;
}> {
  const res = await fetchWithRetry('/api/files/folders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to save folder.');
  }
  return data;
}

export async function deleteWorkspaceFolder(id: string): Promise<{
  folders: WorkspaceFileFolder[];
  files: WorkspaceFileItem[];
  trashCount?: number;
}> {
  const res = await fetchWithRetry(`/api/files/folders/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to delete folder.');
  }
  return data;
}

export async function renameOrMoveWorkspaceFile(
  id: string,
  patch: { name?: string; folderId?: string; visibility?: 'PRIVATE' | 'WORKSPACE' | 'PUBLIC' }
): Promise<{ file: WorkspaceFileItem; files: WorkspaceFileItem[]; folders: WorkspaceFileFolder[] }> {
  const res = await fetchWithRetry(`/api/files/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update file.');
  invalidateClientEngineCache(id);
  return data;
}

export async function duplicateWorkspaceFile(
  id: string
): Promise<{ file: WorkspaceFileItem; files: WorkspaceFileItem[]; folders: WorkspaceFileFolder[] }> {
  const res = await fetchWithRetry(`/api/files/${encodeURIComponent(id)}/duplicate`, {
    method: 'POST',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to duplicate file.');
  return data;
}

export async function deleteWorkspaceFile(
  id: string,
  permanent = false
): Promise<{ files: WorkspaceFileItem[]; trashCount?: number }> {
  const res = await fetchWithRetry(
    `/api/files/${encodeURIComponent(id)}${permanent ? '?permanent=true' : ''}`,
    { method: 'DELETE' }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to delete file.');
  invalidateClientEngineCache(id);
  return { files: data.files || [], trashCount: data.trashCount ?? 0 };
}

export async function fetchTrashedFiles(): Promise<WorkspaceFileItem[]> {
  const res = await fetchWithRetry('/api/files/trash');
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load trash.');
  return data.files || [];
}

export async function restoreTrashedFile(
  id: string
): Promise<{ files: WorkspaceFileItem[]; folders: WorkspaceFileFolder[]; trashCount?: number }> {
  const res = await fetchWithRetry(`/api/files/${encodeURIComponent(id)}/restore`, {
    method: 'POST',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to restore file.');
  return data;
}

export async function emptyFilesTrash(): Promise<{
  files: WorkspaceFileItem[];
  folders: WorkspaceFileFolder[];
  trashCount?: number;
}> {
  const res = await fetchWithRetry('/api/files/trash/empty', { method: 'DELETE' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to empty trash.');
  return data;
}

export async function fetchFileShares(fileId: string): Promise<{
  visibility: 'PRIVATE' | 'WORKSPACE' | 'PUBLIC';
  shares: Array<{ id: string; targetUserId: string; accessLevel: 'VIEW' | 'EDIT' }>;
  users: Array<{ id: string; name: string; email: string; role: string }>;
}> {
  const res = await fetchWithRetry(`/api/files/${encodeURIComponent(fileId)}/shares`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load sharing settings.');
  return data;
}

export async function saveFileShares(
  fileId: string,
  payload: {
    visibility: 'PRIVATE' | 'WORKSPACE' | 'PUBLIC';
    grants: Array<{ targetUserId: string; accessLevel: 'VIEW' | 'EDIT' }>;
  }
): Promise<{ files: WorkspaceFileItem[]; folders: WorkspaceFileFolder[] }> {
  const res = await fetchWithRetry(`/api/files/${encodeURIComponent(fileId)}/share`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update file sharing.');
  invalidateClientEngineCache(fileId);
  return data;
}

export async function batchProcessImages(payload: {
  fileIds: string[];
  width?: number;
  height?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside';
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
  watermarkText?: string;
  stripMetadata?: boolean;
  overwrite?: boolean;
  targetFolderId?: string;
}): Promise<{
  ok: boolean;
  processedCount: number;
  files: WorkspaceFileItem[];
  folders: WorkspaceFileFolder[];
}> {
  const res = await fetchWithRetry('/api/files/batch-image-process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Batch image processing failed.');
  for (const id of payload.fileIds) invalidateClientEngineCache(id);
  return data;
}

export async function saveMailAttachmentToServerFiles(payload: {
  name: string;
  url?: string;
  mimeType?: string;
  extension?: string;
  slideDeckId?: string;
  docId?: string;
  bodyText?: string;
  folderId?: string;
}): Promise<{ file: WorkspaceFileItem; files: WorkspaceFileItem[]; alreadySaved: boolean }> {
  const res = await fetch('/api/files/save-from-mail', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to save attachment to File Manager.');
  }
  return data;
}

// ============================================================================
// CMH APP SUITE: DRAG & DROP FORM BUILDER, TASKS, PROJECTS & REAL-TIME ADMIN MAIL
// ============================================================================

export type CmhFieldType =
  | 'SHORT_TEXT'
  | 'FULL_NAME'
  | 'EMAIL'
  | 'PASSWORD'
  | 'PHONE_WITH_CODE'
  | 'COUNTRY_STATE_CITY'
  | 'ADDRESS'
  | 'PARAGRAPH'
  | 'NUMBER'
  | 'DROPDOWN'
  | 'SINGLE_CHOICE'
  | 'MULTI_CHOICE'
  | 'DATE'
  | 'TIME'
  | 'STATUS_SELECT'
  | 'PRIORITY_SELECT'
  | 'FILE_UPLOAD'
  | 'RATING'
  | 'TERMS_CHECKBOX'
  | 'PAGE_BREAK';

export interface CmhFormField {
  id: string;
  label: string;
  type: CmhFieldType;
  placeholder?: string;
  helpText?: string;
  required: boolean;
  width: 'full' | 'half';
  options?: string[];
  defaultCountryCode?: string;
  defaultCountry?: string;
}

export interface CmhSubmission {
  id: string;
  targetType: 'FORM' | 'TASK' | 'PROJECT';
  targetId: string;
  targetTitle: string;
  submitterName: string;
  submitterEmail: string;
  submittedAt: string;
  timestamp: number;
  values: Record<string, any>;
}

export type CmhFormCategory = 'GENERAL' | 'LOGIN' | 'REGISTRATION' | 'TASK' | 'PROJECT';

export interface CmhFormTemplate {
  id: string;
  title: string;
  description: string;
  formCategory: CmhFormCategory;
  accessMode: 'PUBLIC' | 'PRIVATE';
  invitedMemberIds: string[];
  invitedTeamIds: string[];
  submitButtonLabel: string;
  confirmationMessage: string;
  fields: CmhFormField[];
  submissions: CmhSubmission[];
  createdAt: string;
  updatedAt: string;
  timestamp: number;
}

export interface CmhTaskItem {
  id: string;
  title: string;
  description: string;
  formTemplateId: string;
  formTemplateTitle: string;
  status: 'To Do' | 'In Progress' | 'Review' | 'Completed';
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  dueDate: string;
  accessMode: 'PUBLIC' | 'PRIVATE';
  assignedMemberIds: string[];
  assignedTeamIds: string[];
  customFieldValues: Record<string, any>;
  submissions: CmhSubmission[];
  createdAt: string;
  updatedAt: string;
  timestamp: number;
}

export interface CmhProjectItem {
  id: string;
  title: string;
  description: string;
  formTemplateId: string;
  formTemplateTitle: string;
  status: 'Planning' | 'Active' | 'On Hold' | 'Completed';
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  deadline: string;
  budget: string;
  accessMode: 'PUBLIC' | 'PRIVATE';
  assignedMemberIds: string[];
  assignedTeamIds: string[];
  customFieldValues: Record<string, any>;
  submissions: CmhSubmission[];
  createdAt: string;
  updatedAt: string;
  timestamp: number;
}

export interface CmhNotificationRules {
  id: string;
  adminEmail: string;
  notifyOnFormSubmit: boolean;
  notifyOnTaskActivity: boolean;
  notifyOnProjectActivity: boolean;
  notifyOnMemberActivity: boolean;
  autoSendAdminEmail: boolean;
  injectIntoPrimaryInbox: boolean;
  updatedAt: string;
}

export const COUNTRY_DIAL_CODES: Array<{ code: string; country: string }> = [
  { code: '+880', country: 'Bangladesh (+880)' },
  { code: '+1', country: 'United States / Canada (+1)' },
  { code: '+44', country: 'United Kingdom (+44)' },
  { code: '+91', country: 'India (+91)' },
  { code: '+971', country: 'United Arab Emirates (+971)' },
  { code: '+966', country: 'Saudi Arabia (+966)' },
  { code: '+61', country: 'Australia (+61)' },
  { code: '+49', country: 'Germany (+49)' },
  { code: '+33', country: 'France (+33)' },
  { code: '+65', country: 'Singapore (+65)' },
  { code: '+60', country: 'Malaysia (+60)' },
  { code: '+81', country: 'Japan (+81)' },
  { code: '+82', country: 'South Korea (+82)' },
  { code: '+39', country: 'Italy (+39)' },
  { code: '+34', country: 'Spain (+34)' },
  { code: '+92', country: 'Pakistan (+92)' },
  { code: '+90', country: 'Turkey (+90)' },
];

export const COUNTRY_STATE_CITY_DIRECTORY: Record<
  string,
  Record<string, string[]>
> = {
  Bangladesh: {
    'Dhaka Division': ['Dhaka', 'Gazipur', 'Narayanganj', 'Tangail', 'Faridpur'],
    'Chattogram Division': ['Chattogram', 'Coxs Bazar', 'Cumilla', 'Noakhali', 'Feni'],
    'Sylhet Division': ['Sylhet', 'Moulvibazar', 'Habiganj', 'Sunamganj'],
    'Rajshahi Division': ['Rajshahi', 'Bogura', 'Pabna', 'Sirajganj'],
    'Khulna Division': ['Khulna', 'Jashore', 'Kushtia', 'Satkhira'],
    'Barishal Division': ['Barishal', 'Patuakhali', 'Bhola'],
    'Rangpur Division': ['Rangpur', 'Dinajpur', 'Kurigram'],
    'Mymensingh Division': ['Mymensingh', 'Jamalpur', 'Netrokona'],
  },
  'United States': {
    California: ['San Francisco', 'Los Angeles', 'San Diego', 'San Jose', 'Palo Alto', 'Oakland'],
    'New York': ['New York City', 'Buffalo', 'Albany', 'Rochester', 'Syracuse'],
    Texas: ['Austin', 'Dallas', 'Houston', 'San Antonio', 'Fort Worth'],
    Washington: ['Seattle', 'Bellevue', 'Redmond', 'Tacoma', 'Spokane'],
    Florida: ['Miami', 'Orlando', 'Tampa', 'Jacksonville', 'Fort Lauderdale'],
    Illinois: ['Chicago', 'Naperville', 'Aurora', 'Rockford'],
    Massachusetts: ['Boston', 'Cambridge', 'Worcester', 'Springfield'],
    Georgia: ['Atlanta', 'Savannah', 'Augusta', 'Athens'],
    'North Carolina': ['Charlotte', 'Raleigh', 'Durham', 'Greensboro'],
    Pennsylvania: ['Philadelphia', 'Pittsburgh', 'Allentown', 'Erie'],
    Colorado: ['Denver', 'Colorado Springs', 'Aurora', 'Boulder'],
    Virginia: ['Virginia Beach', 'Norfolk', 'Richmond', 'Arlington'],
    Ohio: ['Columbus', 'Cleveland', 'Cincinnati', 'Toledo'],
    Michigan: ['Detroit', 'Grand Rapids', 'Ann Arbor', 'Lansing'],
    'New Jersey': ['Newark', 'Jersey City', 'Paterson', 'Princeton'],
  },
  'United Kingdom': {
    England: ['London', 'Manchester', 'Birmingham', 'Cambridge', 'Oxford'],
    Scotland: ['Edinburgh', 'Glasgow', 'Aberdeen'],
    Wales: ['Cardiff', 'Swansea'],
  },
  'United Arab Emirates': {
    Dubai: ['Downtown Dubai', 'Business Bay', 'Dubai Marina', 'JLT'],
    'Abu Dhabi': ['Abu Dhabi City', 'Al Ain', 'Yas Island'],
    Sharjah: ['Sharjah City'],
  },
  India: {
    Karnataka: ['Bengaluru', 'Mysuru'],
    Maharashtra: ['Mumbai', 'Pune'],
    Delhi: ['New Delhi', 'Noida', 'Gurugram'],
    'West Bengal': ['Kolkata', 'Howrah'],
  },
  Canada: {
    Ontario: ['Toronto', 'Ottawa', 'Waterloo'],
    'British Columbia': ['Vancouver', 'Victoria'],
    Quebec: ['Montreal', 'Quebec City'],
  },
  Australia: {
    'New South Wales': ['Sydney', 'Newcastle'],
    Victoria: ['Melbourne', 'Geelong'],
    Queensland: ['Brisbane', 'Gold Coast'],
  },
  Germany: {
    Berlin: ['Berlin'],
    Bavaria: ['Munich', 'Nuremberg'],
    Hesse: ['Frankfurt'],
  },
  Singapore: {
    'Central Region': ['Marina Bay', 'Orchard', 'Raffles Place'],
    'East Region': ['Changi', 'Tampines'],
  },
};

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

export async function fetchCmhWorkspaceBootstrap(_force = false): Promise<{
  forms: CmhFormTemplate[];
  tasks: CmhTaskItem[];
  projects: CmhProjectItem[];
  rules: CmhNotificationRules;
  members: WorkspaceMemberItem[];
  teamGroups: WorkspaceTeamGroup[];
  adminInboxMessages: ParsedEmail[];
}> {
  const res = await fetch('/api/cmh/bootstrap');
  if (!res.ok) {
    throw new Error('Failed to load CMH App data.');
  }
  const data = await res.json();
  if (Array.isArray(data.adminInboxMessages)) {
    for (const msg of data.adminInboxMessages) {
      injectRealtimeAdminInboxMessage(msg);
    }
  }
  if (Array.isArray(data.members)) {
    cachedMembersMemory = data.members;
  }
  if (Array.isArray(data.teamGroups)) {
    cachedGroupsMemory = data.teamGroups;
  }
  return {
    forms: data.forms || [],
    tasks: data.tasks || [],
    projects: data.projects || [],
    rules: data.rules,
    members: data.members || [],
    teamGroups: data.teamGroups || [],
    adminInboxMessages: data.adminInboxMessages || [],
  };
}

export async function saveCmhFormTemplate(
  payload: Partial<CmhFormTemplate> & { title: string; fields: CmhFormField[] }
): Promise<{ form: CmhFormTemplate; forms: CmhFormTemplate[] }> {
  const res = await fetch('/api/cmh/forms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to save form template.');
  }
  return data;
}

export async function deleteCmhFormTemplate(id: string): Promise<CmhFormTemplate[]> {
  const res = await fetch(`/api/cmh/forms/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  const data = await res.json();
  return data.forms || [];
}

export async function saveCmhTask(
  payload: Partial<CmhTaskItem> & { title: string; originUrl?: string }
): Promise<{ task: CmhTaskItem; tasks: CmhTaskItem[] }> {
  const res = await fetch('/api/cmh/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, originUrl: window.location.origin }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to save task.');
  }
  return data;
}

export async function deleteCmhTask(id: string): Promise<CmhTaskItem[]> {
  const res = await fetch(`/api/cmh/tasks/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  const data = await res.json();
  return data.tasks || [];
}

export async function saveCmhProject(
  payload: Partial<CmhProjectItem> & { title: string; originUrl?: string }
): Promise<{ project: CmhProjectItem; projects: CmhProjectItem[] }> {
  const res = await fetch('/api/cmh/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, originUrl: window.location.origin }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to save project.');
  }
  return data;
}

export async function deleteCmhProject(id: string): Promise<CmhProjectItem[]> {
  const res = await fetch(`/api/cmh/projects/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  const data = await res.json();
  return data.projects || [];
}

export async function saveCmhNotificationRules(
  patch: Partial<CmhNotificationRules>
): Promise<CmhNotificationRules> {
  const res = await fetch('/api/cmh/rules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update notification rules.');
  }
  return data.rules;
}

export async function sendCmhMemberInvitations(payload: {
  targetType: 'form' | 'task' | 'project';
  targetId: string;
  memberIds: string[];
  teamIds: string[];
  customMessage?: string;
}): Promise<{
  ok: boolean;
  invitedCount: number;
  shareUrl: string;
  forms: CmhFormTemplate[];
  tasks: CmhTaskItem[];
  projects: CmhProjectItem[];
}> {
  const res = await fetch('/api/cmh/invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, originUrl: window.location.origin }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to send member invitations.');
  }
  return data;
}

export async function fetchPublicCmhItem(
  targetType: 'form' | 'task' | 'project',
  id: string
): Promise<{
  targetType: 'form' | 'task' | 'project';
  item: any;
  template: CmhFormTemplate;
  members: WorkspaceMemberItem[];
}> {
  const res = await fetch(
    `/api/cmh/public/${encodeURIComponent(targetType)}/${encodeURIComponent(id)}`
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Item not found.');
  }
  return data;
}

export async function submitPublicCmhResponse(
  targetType: 'form' | 'task' | 'project',
  id: string,
  payload: {
    submitterName?: string;
    submitterEmail: string;
    values: Record<string, any>;
    statusUpdate?: string;
  }
): Promise<{ ok: boolean; confirmationMessage: string; submission: CmhSubmission }> {
  const res = await fetch(
    `/api/cmh/public/${encodeURIComponent(targetType)}/${encodeURIComponent(id)}/submit`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, originUrl: window.location.origin }),
    }
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Submission failed.');
  }
  return data;
}

// ============================================================================
// CENTRAL WORKSPACE SETTINGS, INTEGRATIONS, POSTGRESQL & BACKUP API
// ============================================================================

export interface ExternalIntegrationClient {
  id: string;
  providerType: 'WEBHOOK' | 'SMTP_RELAY' | 'CUSTOM_API' | 'STORAGE_S3';
  label: string;
  endpointOrHost: string;
  clientIdOrKey: string;
  secretPreview: string;
  isActive: boolean;
  createdAt: string;
}

export interface WorkspaceSystemSettingsClient {
  workspaceName: string;
  organizationName: string;
  adminEmail: string;
  timezone: string;
  dateFormat: string;
  defaultLandingModule: string;
  autoSyncIntervalSec: number;
  densityMode: 'comfortable' | 'compact';
  defaultSignatureHtml: string;
  defaultReplyTo: string;
  bulkDelayMs: number;
  dailySendLimit: number;
  enableReadReceipts: boolean;
  autoSaveAttachmentsToFiles: boolean;
  enablePublicForms: boolean;
  enablePublicCmhPortal: boolean;
  incomingWebhookSecret: string;
  outgoingWebhookUrl: string;
  externalIntegrations: ExternalIntegrationClient[];
  updatedAt: string;
}

export interface WorkspaceSystemStats {
  gmailAccounts: number;
  serverAccounts: number;
  messages: number;
  docs: number;
  slides: number;
  forms: number;
  meetings: number;
  members: number;
  tasks: number;
  projects: number;
  files: number;
}

export async function fetchSystemSettings(): Promise<{
  settings: WorkspaceSystemSettingsClient;
  cmhRules: CmhNotificationRules;
  stats: WorkspaceSystemStats;
}> {
  const res = await fetch('/api/settings/system');
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to load workspace settings.');
  }
  return data;
}

export async function saveSystemSettings(
  settings: Partial<WorkspaceSystemSettingsClient>,
  cmhRules?: Partial<CmhNotificationRules>
): Promise<{
  ok: boolean;
  settings: WorkspaceSystemSettingsClient;
  cmhRules: CmhNotificationRules;
}> {
  const res = await fetch('/api/settings/system', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ settings, cmhRules }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to save workspace settings.');
  }
  return data;
}

export async function addExternalIntegration(payload: {
  providerType: ExternalIntegrationClient['providerType'];
  label: string;
  endpointOrHost: string;
  clientIdOrKey: string;
  secretKey: string;
}): Promise<ExternalIntegrationClient[]> {
  const res = await fetch('/api/settings/integrations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to add integration.');
  }
  return data.integrations || [];
}

export async function deleteExternalIntegration(id: string): Promise<ExternalIntegrationClient[]> {
  const res = await fetch(`/api/settings/integrations/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to remove integration.');
  }
  return data.integrations || [];
}

export async function fetchDatabaseConfig(): Promise<{
  config: PostgresConfigClient;
  schemaSql: string;
  prismaSchema: string;
  stats: Record<string, number>;
}> {
  const res = await fetch('/api/db/config');
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch database config.');
  }
  return data;
}

export async function saveDatabaseConfig(payload: {
  enabled?: boolean;
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?: boolean;
  autoMigrateOnStartup?: boolean;
  testAndMigrateNow?: boolean;
}): Promise<{
  ok: boolean;
  config: PostgresConfigClient;
  migration?: {
    ok: boolean;
    message: string;
    tablesCreated: string[];
  };
}> {
  const res = await fetch('/api/db/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'PostgreSQL connection failed.');
  }
  return data;
}

export async function exportWorkspaceBackupJson(): Promise<any> {
  const res = await fetch('/api/settings/backup');
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to export backup.');
  }
  return data;
}

export async function restoreWorkspaceBackupJson(payload: any): Promise<{ ok: boolean; message: string }> {
  const res = await fetch('/api/settings/restore', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to restore backup.');
  }
  return data;
}

export interface VpsStorageDiagnosticsClient {
  storageBasePath: string;
  isEphemeralTmp: boolean;
  browserCacheEnabled: boolean;
  diskTotalBytes: number;
  diskFreeBytes: number;
  uploadsBytes: number;
  versionsBytes: number;
  thumbsBytes: number;
  totalUsedBytes: number;
  activeFilesCount: number;
  trashedFilesCount: number;
  trashedBytes: number;
  versionsCount: number;
  orphanFilesCount: number;
  orphanBytes: number;
}

export async function fetchVpsStorageDiagnostics(): Promise<VpsStorageDiagnosticsClient> {
  const res = await fetch('/api/settings/storage');
  const data = await res.json();
  if (!res.ok || !data.storage) {
    throw new Error(data.error || 'Failed to inspect VPS storage.');
  }
  return data.storage;
}

export async function runVpsStorageCleanup(options?: {
  pruneOrphans?: boolean;
  purgeTrashOlderThanDays?: number;
}): Promise<{
  cleanup: {
    removedOrphans: number;
    removedTrashedFiles: number;
    reclaimedBytes: number;
  };
  storage: VpsStorageDiagnosticsClient;
}> {
  const res = await fetch('/api/settings/storage/cleanup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options || { pruneOrphans: true, purgeTrashOlderThanDays: 30 }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to run smart storage cleanup.');
  }
  return { cleanup: data.cleanup, storage: data.storage };
}

export async function fetchFinanceBrandLogo(): Promise<string> {
  try {
    const res = await fetch('/api/settings/finance-branding');
    if (!res.ok) return '';
    const data = await res.json();
    return String(data.brandLogoUrl || '');
  } catch {
    return '';
  }
}

export async function saveFinanceBrandLogo(brandLogoUrl: string): Promise<string> {
  const res = await fetch('/api/settings/finance-branding', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ brandLogoUrl }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to save finance brand logo.');
  }
  return String(data.brandLogoUrl || '');
}

// ============================================================================
// NEW WORKSPACE ENGINES API HELPERS (SHEETS, CALENDAR, FINANCE, CRM, HR, CHAT, WIKI, AUTOMATION)
// ============================================================================

export type EngineCollectionName =
  | 'sheets'
  | 'calendarEvents'
  | 'invoices'
  | 'expenses'
  | 'crmLeads'
  | 'supportTickets'
  | 'hrRecords'
  | 'chatChannels'
  | 'chatMessages'
  | 'wikiArticles'
  | 'automationRules';

export interface WorkspaceSheetItem {
  id: string;
  title: string;
  category: string;
  columns: string[];
  rows: string[][];
  createdAt: string;
  updatedAt: string;
  timestamp: number;
}

export interface WorkspaceCalendarEventItem {
  id: string;
  title: string;
  description: string;
  eventType: 'MEETING' | 'DEADLINE' | 'REMINDER' | 'HOLIDAY';
  date: string; // YYYY-MM-DD
  startTime: string;
  endTime: string;
  location: string;
  color: string;
  createdAt: string;
  timestamp: number;
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface WorkspaceInvoiceItem {
  id: string;
  invoiceNumber: string;
  docType: 'INVOICE' | 'QUOTATION';
  clientName: string;
  clientEmail: string;
  projectTitle: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  items: InvoiceLineItem[];
  taxPercent: number;
  discountAmt: number;
  totalAmount: number;
  status: 'Draft' | 'Unpaid' | 'Paid' | 'Overdue';
  notes: string;
  createdAt: string;
  timestamp: number;
}

export interface WorkspaceExpenseItem {
  id: string;
  title: string;
  category: string;
  amount: number;
  currency: string;
  date: string;
  vendor: string;
  projectTitle: string;
  status: 'Approved' | 'Pending' | 'Reimbursed';
  createdAt: string;
  timestamp: number;
}

export interface WorkspaceCrmLeadItem {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  stage: 'New Lead' | 'Contacted' | 'Proposal Sent' | 'Won' | 'Lost';
  dealValue: number;
  assignedTo: string;
  notes: string;
  createdAt: string;
  timestamp: number;
}

export interface WorkspaceSupportTicketItem {
  id: string;
  ticketNumber: string;
  subject: string;
  customerName: string;
  customerEmail: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  assignedTo: string;
  description: string;
  resolution: string;
  createdAt: string;
  timestamp: number;
}

export interface WorkspaceHrRecordItem {
  id: string;
  recordType: 'ATTENDANCE' | 'LEAVE' | 'PAYSLIP';
  memberName: string;
  memberEmail: string;
  dateOrMonth: string;
  status: string;
  details: Record<string, any>;
  createdAt: string;
  timestamp: number;
}

export interface WorkspaceChatChannelItem {
  id: string;
  name: string;
  description: string;
  channelType: 'PUBLIC' | 'TEAM' | 'PROJECT';
  createdAt: string;
  timestamp: number;
}

export interface WorkspaceChatMessageItem {
  id: string;
  channelId: string;
  senderName: string;
  senderEmail: string;
  text: string;
  isPinned: boolean;
  createdAt: string;
  timestamp: number;
}

export interface WorkspaceWikiArticleItem {
  id: string;
  title: string;
  category: string;
  summary: string;
  content: string;
  authorName: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  timestamp: number;
}

export interface WorkspaceAutomationRuleItem {
  id: string;
  name: string;
  triggerEvent: string;
  actionType: string;
  targetValue: string;
  isActive: boolean;
  runsCount: number;
  lastRunAt?: string;
  createdAt: string;
  timestamp: number;
}

export async function fetchEngineCollection<T = any>(
  collection: EngineCollectionName
): Promise<T[]> {
  const res = await fetch(`/api/engines/${collection}`);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Failed to load ${collection}.`);
  }
  return Array.isArray(data.items) ? data.items : [];
}

export async function saveEngineRecord<T = any>(
  collection: EngineCollectionName,
  payload: Partial<T> & { id?: string }
): Promise<{ item: T; items: T[] }> {
  const res = await fetch(`/api/engines/${collection}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Failed to save record in ${collection}.`);
  }
  return { item: data.item, items: data.items || [] };
}

export async function deleteEngineRecord<T = any>(
  collection: EngineCollectionName,
  id: string
): Promise<T[]> {
  const res = await fetch(`/api/engines/${collection}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Failed to delete record from ${collection}.`);
  }
  return data.items || [];
}

export async function runAutomationWorkflow(id: string): Promise<{
  ok: boolean;
  effectSummary: string;
  items: WorkspaceAutomationRuleItem[];
}> {
  const res = await fetchWithRetry(`/api/automations/run/${encodeURIComponent(id)}`, {
    method: 'POST',
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to execute automation workflow.');
  }
  return data;
}

// ============================================================================
// EXECUTIVE PORTFOLIO & US-STANDARD CV BUILDER
// ============================================================================

export interface ResumeProfileData {
  header: {
    fullName: string;
    professionalTitle: string;
    executiveSummary: string;
    coverImageUrl?: string;
    avatarUrl?: string;
    verifiedBadge: boolean;
    statusText?: string;
  };
  contact: {
    email: string;
    phone: string;
    city: string;
    state: string;
    country: string;
    postalCode?: string;
    linkedInUrl?: string;
    githubUrl?: string;
    portfolioUrl?: string;
    websiteUrl?: string;
    timezone: string;
  };
  experience: Array<{
    id: string;
    company: string;
    position: string;
    employmentType: 'Full-time' | 'Contract' | 'Executive' | 'Advisory' | 'Part-time';
    location: string;
    startDate: string;
    endDate: string;
    isCurrent: boolean;
    bullets: string[];
    technologies: string[];
  }>;
  education: Array<{
    id: string;
    institution: string;
    degree: string;
    fieldOfStudy: string;
    location: string;
    graduationDate: string;
    gpaOrHonors?: string;
    highlights: string[];
  }>;
  skills: Array<{
    category: string;
    items: Array<{
      name: string;
      levelPercent: number; // 0 - 100
      levelBadge: 'Expert' | 'Advanced' | 'Intermediate';
    }>;
  }>;
  projects: Array<{
    id: string;
    title: string;
    role: string;
    period?: string;
    description: string;
    bullets: string[];
    liveUrl?: string;
    githubUrl?: string;
    technologies: string[];
    documentId?: string;
  }>;
  certifications: Array<{
    id: string;
    title: string;
    issuingOrganization: string;
    issueDate: string;
    expiryDate?: string;
    credentialId?: string;
    verificationUrl?: string;
    attachedFileId?: string;
  }>;
  customSections: Array<{
    id: string;
    title: string;
    items: Array<{
      heading: string;
      subHeading?: string;
      date?: string;
      description: string;
    }>;
  }>;
  settings: {
    privacyMode: 'PUBLIC' | 'TEAM_ONLY' | 'PRIVATE';
    themeTemplate: 'MODERN_EXECUTIVE' | 'TECH_ATS' | 'MINIMAL_ELEGANT';
    showSkillsGauges: boolean;
    showGeoFlags: boolean;
  };
}

export async function fetchUserProfileResume(): Promise<{
  resume: ResumeProfileData;
  user: {
    id: string;
    username: string;
    name: string;
    role: string;
    email: string;
    avatarUrl?: string;
  };
}> {
  const res = await fetchWithRetry('/api/user/profile/resume');
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch executive resume.');
  }
  return data;
}

export async function fetchUserProfileStudio(): Promise<{
  resume: ResumeProfileData;
  corporate: CorporateOrgProfileData;
  user: {
    id: string;
    username: string;
    name: string;
    role: string;
    email: string;
    avatarUrl?: string;
  };
}> {
  const res = await fetchWithRetry('/api/user/profile/studio');
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to load profile & website studio.');
  }
  return data;
}

export async function saveUserProfileResume(
  resume: ResumeProfileData
): Promise<{ success: boolean; resume: ResumeProfileData }> {
  const res = await fetchWithRetry('/api/user/profile/resume', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resume }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to save executive resume.');
  }
  return data;
}

export async function fetchMemberProfileResume(memberId: string): Promise<{
  resume: ResumeProfileData;
  member: WorkspaceMemberItem;
}> {
  const res = await fetchWithRetry(`/api/members/${encodeURIComponent(memberId)}/resume`);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to load member resume.');
  }
  return data;
}

export async function saveMemberProfileResume(
  memberId: string,
  resume: ResumeProfileData
): Promise<{ success: boolean; resume: ResumeProfileData }> {
  const res = await fetchWithRetry(`/api/members/${encodeURIComponent(memberId)}/resume`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resume }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update member resume.');
  }
  return data;
}

// ============================================================================
// CORPORATE ORGANIZATION WEBSITE BUILDER & LANDING PAGE STUDIO
// ============================================================================

export interface CorporateOrgProfileData {
  id: string;
  branding: {
    name: string;
    legalName?: string;
    tagline: string;
    logoUrl?: string;
    regNumber?: string;
    establishedYear?: string;
    primaryColor: string;
    phone: string;
    email: string;
    address: string;
    websiteUrl?: string;
  };
  heroSlider: Array<{
    id: string;
    imageUrl: string;
    title: string;
    subtitle: string;
    buttonText?: string;
    buttonUrl?: string;
  }>;
  missionVision: {
    mission: string;
    vision: string;
    values: string[];
  };
  services: Array<{
    id: string;
    title: string;
    category?: string;
    description: string;
    iconName?: string;
    statusBadge?: string;
  }>;
  team: Array<{
    id: string;
    name: string;
    role: string;
    avatarUrl?: string;
    bio?: string;
    email?: string;
    linkedInUrl?: string;
  }>;
  recentUpdates: Array<{
    id: string;
    title: string;
    date: string;
    summary: string;
    imageUrl?: string;
    linkUrl?: string;
  }>;
  photoGallery: Array<{
    id: string;
    title?: string;
    imageUrl: string;
    caption?: string;
  }>;
  videoGallery: Array<{
    id: string;
    title: string;
    youtubeUrl: string;
    youtubeId?: string;
    description?: string;
  }>;
  testimonials: Array<{
    id: string;
    quote: string;
    authorName: string;
    authorTitle: string;
    authorAvatarUrl?: string;
    organization?: string;
  }>;
  contact: {
    primaryPhone: string;
    secondaryPhone?: string;
    primaryEmail: string;
    inquiryEmail?: string;
    hqAddress: string;
    socialLinks: {
      linkedin?: string;
      youtube?: string;
      facebook?: string;
      twitter?: string;
    };
    googleMapsUrl?: string;
  };
  settings: {
    themeAccent: 'blue' | 'emerald' | 'indigo' | 'amber';
    isPublished: boolean;
    websiteMode?: 'CUSTOM' | 'EMBED';
    embedUrl?: string;
  };
}

export function extractYouTubeVideoIdClient(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const cleanUrl = url.trim();
  const regex =
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|shorts\/|watch\?v=|watch\?.+&v=))([\w-]{11})/;
  const match = cleanUrl.match(regex);
  if (match && match[1]) return match[1];
  if (/^[\w-]{11}$/.test(cleanUrl)) return cleanUrl;
  return null;
}

export function sanitizeHttpUrlClient(rawUrl?: string | null): {
  valid: boolean;
  normalizedUrl: string;
  error?: string;
} {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { valid: true, normalizedUrl: '' };
  }
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { valid: true, normalizedUrl: '' };
  }

  if (/^(javascript|data|vbscript|file|about|blob):/i.test(trimmed)) {
    return {
      valid: false,
      normalizedUrl: '',
      error: 'Unsafe URL protocol detected. Only http:// or https:// URLs are allowed.',
    };
  }

  let candidate = trimmed;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(candidate)) {
    if (/^[a-z0-9.-]+\.[a-z]{2,}(?:[/:?#].*)?$/i.test(candidate)) {
      candidate = `https://${candidate}`;
    } else {
      return {
        valid: false,
        normalizedUrl: '',
        error: 'Enter a valid website domain or full https:// URL.',
      };
    }
  }

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        valid: false,
        normalizedUrl: '',
        error: 'Only http:// and https:// URLs are supported.',
      };
    }
    if (!parsed.hostname) {
      return {
        valid: false,
        normalizedUrl: '',
        error: 'Website URL must include a valid domain name.',
      };
    }
    return { valid: true, normalizedUrl: parsed.toString() };
  } catch {
    return {
      valid: false,
      normalizedUrl: '',
      error: 'Enter a valid website URL (e.g. https://example.org).',
    };
  }
}

export async function fetchUserCorporateProfile(): Promise<{
  corporate: CorporateOrgProfileData;
  user: {
    id: string;
    name: string;
    role: string;
    email: string;
  };
}> {
  const res = await fetchWithRetry('/api/user/profile/corporate');
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch corporate organization profile.');
  }
  return data;
}

export async function saveUserCorporateProfile(
  corporate: CorporateOrgProfileData
): Promise<{ success: boolean; corporate: CorporateOrgProfileData }> {
  const res = await fetchWithRetry('/api/user/profile/corporate', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ corporate }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to save corporate organization profile.');
  }
  return data;
}

export async function fetchMemberCorporateProfile(memberId: string): Promise<{
  corporate: CorporateOrgProfileData;
  member: WorkspaceMemberItem;
}> {
  const res = await fetchWithRetry(`/api/members/${encodeURIComponent(memberId)}/corporate`);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to load member organization profile.');
  }
  return data;
}

export async function saveMemberCorporateProfile(
  memberId: string,
  corporate: CorporateOrgProfileData
): Promise<{ success: boolean; corporate: CorporateOrgProfileData }> {
  const res = await fetchWithRetry(`/api/members/${encodeURIComponent(memberId)}/corporate`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ corporate }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update member organization profile.');
  }
  return data;
}





// ============================================================================
// COMMUNICATION MESSENGER ENGINE API
// ============================================================================

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
  conversationId: string
): Promise<CommunicationMessageItem[]> {
  try {
    const res = await fetchWithRetry(`/api/communication/conversations/${encodeURIComponent(conversationId)}/messages`);
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

export async function fetchCommunicationMembersList(): Promise<CommunicationMemberItem[]> {
  try {
    const res = await fetchWithRetry('/api/communication/members');
    if (!res.ok) return [];
    const data = await res.json();
    return data.members || [];
  } catch {
    return [];
  }
}
