import { wsFetch as fetch } from '../sessionFetch';

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
