import { wsFetch as fetch } from './sessionFetch';

export type MemberThemeKey = 'cloud' | 'mint' | 'lavender';

export interface WorkspaceAuthUser {
  id: string;
  username: string;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  memberTheme: MemberThemeKey;
  memberId?: string | null;
  phoneCountryCode?: string;
  phoneNumber?: string;
  countryCode?: string;
  countryName?: string;
  stateCode?: string;
  stateName?: string;
  cityName?: string;
  addressLine?: string;
  zipCode?: string;
  permissionVersion: number;
  storageQuotaBytes: number;
  maxFileSizeBytes: number;
  usedStorageBytes: number;
  avatarUrl?: string | null;
  isActive: boolean;
}

export interface GeoCountry {
  isoCode: string;
  name: string;
  phonecode: string;
  flag: string;
}

export interface GeoState {
  isoCode: string;
  name: string;
}

export interface GeoCity {
  name: string;
}

export interface MemberRegistrationPayload {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phoneCountryCode: string;
  phoneNumber: string;
  countryCode: string;
  countryName: string;
  stateCode: string;
  stateName: string;
  cityName: string;
  addressLine: string;
  zipCode: string;
}

export interface EvaluatedCapabilitiesClient {
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  isOwner: boolean;
  isAdmin: boolean;
  isMember: boolean;
  presetKey: string;
  allowedModules: string[];
  restrictedModules: string[];
  allowedActions: string[];
  deniedActions: string[];
  projectGrants: Array<{
    projectId: string;
    projectRole: string;
    actions: string[];
    expiresAt?: string;
  }>;
}

export interface WorkspaceSessionResponse {
  authenticated: boolean;
  user: WorkspaceAuthUser | null;
  capabilities: EvaluatedCapabilitiesClient | null;
  storage?: {
    usedBytes: number;
    quotaBytes: number;
    maxFileSizeBytes: number;
  };
}

async function parseJsonOrThrow(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export async function fetchWorkspaceSession(): Promise<WorkspaceSessionResponse> {
  const res = await fetch('/api/auth/session', { credentials: 'include' });
  return parseJsonOrThrow(res);
}

export async function fetchGeoCountries(): Promise<GeoCountry[]> {
  const res = await fetch('/api/geo/countries');
  const data = await parseJsonOrThrow(res);
  return data.countries || [];
}

export async function fetchGeoStates(countryCode: string): Promise<GeoState[]> {
  if (!countryCode) return [];
  const res = await fetch(`/api/geo/states/${encodeURIComponent(countryCode)}`);
  const data = await parseJsonOrThrow(res);
  return data.states || [];
}

export async function fetchGeoCities(countryCode: string, stateCode: string): Promise<GeoCity[]> {
  if (!countryCode || !stateCode) return [];
  const res = await fetch(
    `/api/geo/cities/${encodeURIComponent(countryCode)}/${encodeURIComponent(stateCode)}`
  );
  const data = await parseJsonOrThrow(res);
  return data.cities || [];
}

export async function registerWorkspaceMember(
  payload: MemberRegistrationPayload
): Promise<{ ok: boolean; user: WorkspaceAuthUser; capabilities: EvaluatedCapabilitiesClient }> {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(res);
}

export async function loginWorkspaceAccount(
  email: string,
  password: string
): Promise<{ ok: boolean; user: WorkspaceAuthUser; capabilities: EvaluatedCapabilitiesClient }> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return parseJsonOrThrow(res);
}

export async function logoutWorkspaceAccount(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
}

export async function updateMyMemberPreferences(payload: {
  memberTheme?: MemberThemeKey;
  name?: string;
}) {
  const res = await fetch('/api/auth/me/preferences', {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(res);
}

export async function updateMyPassword(currentPassword: string, newPassword: string) {
  const res = await fetch('/api/auth/me/password', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  return parseJsonOrThrow(res);
}

export async function fetchAppInvitation(token: string) {
  const res = await fetch(`/api/auth/invite/${encodeURIComponent(token)}`);
  return parseJsonOrThrow(res);
}

export async function acceptAppInvitation(
  token: string,
  payload: {
    firstName?: string;
    lastName?: string;
    name?: string;
    password: string;
    phoneCountryCode?: string;
    phoneNumber?: string;
    countryCode?: string;
    countryName?: string;
    stateCode?: string;
    stateName?: string;
    cityName?: string;
    addressLine?: string;
    zipCode?: string;
  }
) {
  const res = await fetch(`/api/auth/invite/${encodeURIComponent(token)}/accept`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(res);
}

// ============================================================================
// ADMIN PANEL CLIENT API
// ============================================================================

export async function fetchAdminPanelOverview() {
  const res = await fetch('/api/admin/overview', { credentials: 'include' });
  return parseJsonOrThrow(res);
}

export async function createAdminUserOrInvite(payload: {
  name?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  targetRole: 'MEMBER' | 'ADMIN' | 'USER';
  presetKey: string;
  storageQuotaMb: number;
  maxFileSizeMb: number;
  initialPassword?: string;
  sendInvite?: boolean;
  memberId?: string;
  originUrl?: string;
}) {
  const res = await fetch('/api/admin/users', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, originUrl: payload.originUrl || window.location.origin }),
  });
  return parseJsonOrThrow(res);
}

export async function updateAdminUserAccess(
  userId: string,
  payload: {
    isActive?: boolean;
    role?: 'OWNER' | 'ADMIN' | 'MEMBER' | 'USER';
    presetKey?: string;
    allowedModules?: string[];
    restrictedModules?: string[];
    allowedActions?: string[];
    deniedActions?: string[];
    storageQuotaMb?: number;
    maxFileSizeMb?: number;
    memberId?: string | null;
  }
) {
  const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/access`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(res);
}

export async function updateAdminUserRoleFast(
  userId: string,
  role: 'USER' | 'MEMBER' | 'ADMIN' | 'OWNER'
) {
  const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/role`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });
  return parseJsonOrThrow(res);
}

export async function updateAdminUserProjectGrants(
  userId: string,
  payload: {
    grants?: Array<{
      projectId: string;
      projectRole: 'PARTICIPANT' | 'MANAGER';
      actions: string[];
      expiresAt?: string;
    }>;
    assignedTaskIds?: string[];
    channelIds?: string[];
  }
) {
  const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/project-grants`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(res);
}

export async function fetchAdminUserSessions(userId: string) {
  const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/sessions`, {
    credentials: 'include',
  });
  return parseJsonOrThrow(res);
}

export async function revokeAdminUserSessions(userId: string) {
  const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/revoke-sessions`, {
    method: 'POST',
    credentials: 'include',
  });
  return parseJsonOrThrow(res);
}

export async function revokeAdminInvitation(inviteId: string) {
  const res = await fetch(`/api/admin/invitations/${encodeURIComponent(inviteId)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  return parseJsonOrThrow(res);
}

export async function fetchAdminMemberPreview(userId: string) {
  const res = await fetch(`/api/admin/preview-member/${encodeURIComponent(userId)}`, {
    credentials: 'include',
  });
  return parseJsonOrThrow(res);
}

// ============================================================================
// MEMBER PORTAL SCOPED API
// ============================================================================

export async function fetchMemberPortalBootstrap() {
  const res = await fetch('/api/member/bootstrap', { credentials: 'include' });
  return parseJsonOrThrow(res);
}

export async function submitMemberTaskProgress(
  taskId: string,
  payload: { statusUpdate?: string; note?: string; values?: Record<string, any> }
) {
  const res = await fetch(`/api/member/tasks/${encodeURIComponent(taskId)}/submit`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(res);
}

export async function updateMemberProjectAsManager(
  projectId: string,
  payload: { description?: string; status?: string; deadline?: string }
) {
  const res = await fetch(`/api/member/projects/${encodeURIComponent(projectId)}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(res);
}

export async function saveMemberDoc(payload: {
  id?: string;
  title: string;
  category?: string;
  bodyText: string;
}) {
  const res = await fetch('/api/member/docs', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(res);
}

export async function deleteMemberDoc(docId: string) {
  const res = await fetch(`/api/member/docs/${encodeURIComponent(docId)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  return parseJsonOrThrow(res);
}

export async function saveMemberForm(payload: {
  id?: string;
  title: string;
  description?: string;
  fields: any[];
}) {
  const res = await fetch('/api/member/forms', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(res);
}

export async function saveMemberPost(payload: {
  title: string;
  summary?: string;
  content: string;
  type?: 'POST' | 'NOTICE';
  publishNow?: boolean;
}) {
  const res = await fetch('/api/member/posts', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(res);
}

export async function saveMemberSlide(payload: {
  id?: string;
  title: string;
  subtitle?: string;
  pages?: any[];
}) {
  const res = await fetch('/api/member/slides', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(res);
}

export async function sendMemberChatMessage(channelId: string, text: string) {
  const res = await fetch(`/api/member/chat/${encodeURIComponent(channelId)}/messages`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  return parseJsonOrThrow(res);
}

export async function uploadMemberFile(payload: {
  originalName: string;
  mimeType: string;
  dataUrl: string;
}) {
  const res = await fetch('/api/member/files/upload', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(res);
}

export async function deleteMemberFile(fileId: string) {
  const res = await fetch(`/api/member/files/${encodeURIComponent(fileId)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  return parseJsonOrThrow(res);
}
