import { wsFetch as fetch } from '../sessionFetch';
import { type EngineSlidePageClient, type SlideElementLayerClient } from '../engineCache';
import { WorkspaceFileItem } from './filesApi';

// ============================================================================
// STANDALONE DOCS ENGINE API
// ============================================================================

export interface GoogleDocResource {
  documentId: string;
  title: string;
  bodyText: string;
  revisionId?: string;
  lastSyncedAt: string;
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
  _previousText?: string
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

// ============================================================================
// STANDALONE FORMS & UNIVERSAL FORMS ENGINE API
// ============================================================================

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

export interface GoogleMeetSpace {
  name: string;
  meetingUri: string;
  meetingCode: string;
  accessType: string;
  createdAt: string;
  label?: string;
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
// STANDALONE PRESENTATIONS / SLIDES ENGINE API
// ============================================================================

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
