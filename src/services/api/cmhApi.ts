import { wsFetch as fetch } from '../sessionFetch';
import { readNavigationData } from '../navigationCache';
import { type ParsedEmail, injectRealtimeAdminInboxMessage } from './mailApi';
import { type WorkspaceMemberItem, type WorkspaceTeamGroup } from './teamsApi';

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

export function readCmhWorkspaceSnapshot(): Awaited<ReturnType<typeof fetchCmhWorkspaceBootstrap>> | undefined {
  return readNavigationData('/api/cmh/bootstrap');
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
  const res = await fetch('/api/cmh/bootstrap', _force ? { cache: 'reload' } : undefined);
  if (!res.ok) {
    throw new Error('Failed to load CMH App data.');
  }
  const data = await res.json();
  if (Array.isArray(data.adminInboxMessages)) {
    for (const msg of data.adminInboxMessages) {
      injectRealtimeAdminInboxMessage(msg);
    }
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
  },
  requestId?: string
): Promise<{ ok: boolean; confirmationMessage: string; submission: CmhSubmission }> {
  const res = await fetch(
    `/api/cmh/public/${encodeURIComponent(targetType)}/${encodeURIComponent(id)}/submit`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(requestId ? { 'Idempotency-Key': requestId } : {}),
      },
      body: JSON.stringify({ ...payload, originUrl: window.location.origin }),
    }
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Submission failed.');
  }
  return data;
}
