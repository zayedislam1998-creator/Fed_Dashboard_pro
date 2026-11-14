import { fetchWithRetry } from '../engineCache';
import { wsFetch as fetch } from '../sessionFetch';
import { type WorkspaceMemberItem } from './teamsApi';

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
