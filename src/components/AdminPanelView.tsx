import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Ban,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  FolderLock,
  HardDrive,
  History,
  KeyRound,
  LogOut,
  Plus,
  Shield,
  ShieldAlert,
  Sliders,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { emitLocalWorkspaceEvent, subscribeWorkspaceEvents } from '../services/realtimeBus';
import {
  createAdminUserOrInvite,
  fetchAdminMemberPreview,
  fetchAdminPanelOverview,
  fetchAdminUserSessions,
  revokeAdminInvitation,
  revokeAdminUserSessions,
  updateAdminUserAccess,
  updateAdminUserProjectGrants,
  updateAdminUserRoleFast,
  type WorkspaceAuthUser,
} from '../services/workspaceAuth';
import { MemberPortalShell } from './member/MemberPortalShell';

interface AdminPanelViewProps {
  currentUser: WorkspaceAuthUser;
  searchQuery?: string;
}

const MODULE_LABELS: Record<string, string> = {
  overview: 'Overview',
  cmh_tasks: 'Tasks',
  cmh_projects: 'Projects',
  teams: 'Teams Directory',
  posts: 'Posts & Notices',
  docs: 'My Docs',
  forms: 'My Forms',
  slides: 'Slides',
  chat: 'Team Chat & Channels',
  files: 'File Manager (Quota)',
};

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb.toFixed(1)} MB`;
}

export const AdminPanelView: React.FC<AdminPanelViewProps> = ({ currentUser, searchQuery = '' }) => {
  const [subTab, setSubTab] = useState<'users' | 'invites' | 'policies' | 'audit'>('users');
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<any>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Add/Invite Modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'USER' | 'MEMBER' | 'ADMIN'>('MEMBER');
  const [newPreset, setNewPreset] = useState('standard_member');
  const [newQuotaMb, setNewQuotaMb] = useState(100);
  const [newMaxFileMb, setNewMaxFileMb] = useState(15);
  const [newPassword, setNewPassword] = useState('');
  const [sendInviteLink, setSendInviteLink] = useState(true);
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState<string | null>(null);
  const [inviteEmailMeta, setInviteEmailMeta] = useState<{
    emailSent?: boolean;
    emailFrom?: string;
    emailError?: string;
  } | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Selected User Draft Inspector State
  const [draftRole, setDraftRole] = useState<'OWNER' | 'ADMIN' | 'MEMBER' | 'USER'>('MEMBER');
  const [draftPreset, setDraftPreset] = useState('standard_member');
  const [draftRestrictedModules, setDraftRestrictedModules] = useState<string[]>([]);
  const [draftAllowedActions, setDraftAllowedActions] = useState<string[]>([]);
  const [draftDeniedActions, setDraftDeniedActions] = useState<string[]>([]);
  const [draftQuotaMb, setDraftQuotaMb] = useState(100);
  const [draftMaxFileMb, setDraftMaxFileMb] = useState(15);
  const [draftGrants, setDraftGrants] = useState<
    Array<{ projectId: string; projectRole: 'PARTICIPANT' | 'MANAGER'; actions: string[]; expiresAt?: string }>
  >([]);
  const [draftTaskIds, setDraftTaskIds] = useState<string[]>([]);
  const [draftChannelIds, setDraftChannelIds] = useState<string[]>([]);
  const [userSessions, setUserSessions] = useState<any[]>([]);
  const [isSavingInspector, setIsSavingInspector] = useState(false);

  // Read-only "View As Member" Preview State
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const notify = (type: 'ok' | 'err', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3500);
  };

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await fetchAdminPanelOverview();
      setOverview(data);
      if (!selectedUserId && data.users?.length) {
        const firstMember = data.users.find((u: any) => u.role === 'MEMBER') || data.users[0];
        setSelectedUserId(firstMember.id);
      }
    } catch (err: any) {
      if (!silent) notify('err', err?.message || 'Failed to load Admin Control Center.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadData(false);
    const unsubscribe = subscribeWorkspaceEvents((eventName) => {
      if (
        eventName === 'members:updated' ||
        eventName === 'auth:permissions_updated' ||
        eventName === 'workspace:updated'
      ) {
        loadData(true);
      }
    });
    return unsubscribe;
  }, []);

  const users: any[] = overview?.users || [];
  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
    );
  }, [users, searchQuery]);

  const selectedUser = useMemo(
    () => users.find((u) => u.id === selectedUserId) || null,
    [users, selectedUserId]
  );

  // Sync draft state when selected user changes
  useEffect(() => {
    if (!selectedUser) return;
    setDraftRole(selectedUser.role);
    setDraftPreset(selectedUser.policy?.presetKey || 'standard_member');
    setDraftRestrictedModules(
      Array.isArray(selectedUser.policy?.restrictedModules)
        ? selectedUser.policy.restrictedModules
        : []
    );
    setDraftAllowedActions(
      Array.isArray(selectedUser.effectiveCapabilities?.allowedActions)
        ? selectedUser.effectiveCapabilities.allowedActions
        : []
    );
    setDraftDeniedActions(
      Array.isArray(selectedUser.policy?.deniedActions) ? selectedUser.policy.deniedActions : []
    );
    setDraftQuotaMb(Math.max(5, Math.round((selectedUser.storageQuotaBytes || 104857600) / (1024 * 1024))));
    setDraftMaxFileMb(Math.max(1, Math.round((selectedUser.maxFileSizeBytes || 15728640) / (1024 * 1024))));
    setDraftGrants(
      Array.isArray(selectedUser.effectiveCapabilities?.projectGrants)
        ? selectedUser.effectiveCapabilities.projectGrants.map((g: any) => ({
            projectId: g.projectId,
            projectRole: g.projectRole === 'MANAGER' ? 'MANAGER' : 'PARTICIPANT',
            actions: Array.isArray(g.actions) ? g.actions : ['project.read_assigned'],
            expiresAt: g.expiresAt || '',
          }))
        : []
    );
    setDraftTaskIds(selectedUser.assignedTaskIds || []);
    setDraftChannelIds(selectedUser.channelIds || []);

    fetchAdminUserSessions(selectedUser.id)
      .then((res) => setUserSessions(res.sessions || []))
      .catch(() => setUserSessions([]));
  }, [selectedUser?.id, selectedUser?.permissionVersion]);

  const handleApplyPreset = (presetKey: string) => {
    const preset = (overview?.presets || []).find((p: any) => p.key === presetKey);
    if (!preset) return;
    setDraftPreset(presetKey);
    const pool: string[] = overview?.memberModulePool || [];
    setDraftRestrictedModules(pool.filter((m) => !preset.defaultModules.includes(m)));
    setDraftAllowedActions(preset.defaultActions || []);
    setDraftDeniedActions([]);
    setDraftQuotaMb(preset.defaultQuotaMb);
    setDraftMaxFileMb(preset.defaultMaxFileMb);
  };

  const toggleModuleRestriction = (mod: string) => {
    setDraftRestrictedModules((prev) =>
      prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod]
    );
  };

  const toggleActionPermission = (actionKey: string) => {
    const currentlyAllowed =
      draftAllowedActions.includes(actionKey) && !draftDeniedActions.includes(actionKey);
    if (currentlyAllowed) {
      setDraftAllowedActions((prev) => prev.filter((a) => a !== actionKey));
      setDraftDeniedActions((prev) => (prev.includes(actionKey) ? prev : [...prev, actionKey]));
    } else {
      setDraftDeniedActions((prev) => prev.filter((a) => a !== actionKey));
      setDraftAllowedActions((prev) => (prev.includes(actionKey) ? prev : [...prev, actionKey]));
    }
  };

  const handleSaveUserAccess = async () => {
    if (!selectedUser) return;
    setIsSavingInspector(true);
    try {
      const pool: string[] = overview?.memberModulePool || [];
      const allowedModules = pool.filter((m) => !draftRestrictedModules.includes(m));
      await updateAdminUserAccess(selectedUser.id, {
        role: draftRole,
        presetKey: draftPreset,
        allowedModules,
        restrictedModules: draftRestrictedModules,
        allowedActions: draftAllowedActions,
        deniedActions: draftDeniedActions,
        storageQuotaMb: draftQuotaMb,
        maxFileSizeMb: draftMaxFileMb,
      });
      await updateAdminUserProjectGrants(selectedUser.id, {
        grants: draftGrants,
        assignedTaskIds: draftTaskIds,
        channelIds: draftChannelIds,
      });
      await loadData(true);
      emitLocalWorkspaceEvent('members:updated', { userId: selectedUser.id });
      notify('ok', `Saved access & restrictions for ${selectedUser.email}`);
    } catch (err: any) {
      notify('err', err?.message || 'Failed to save access settings.');
    } finally {
      setIsSavingInspector(false);
    }
  };

  const handleFastRoleChange = async (userId: string, newRole: 'USER' | 'MEMBER' | 'ADMIN' | 'OWNER', userName: string) => {
    try {
      await updateAdminUserRoleFast(userId, newRole);
      await loadData(true);
      emitLocalWorkspaceEvent('members:updated', { userId, role: newRole });
      notify('ok', `Updated ${userName}'s workspace role to ${newRole} (synchronized to Teams & Communication).`);
    } catch (err: any) {
      notify('err', err?.message || 'Failed to update role.');
    }
  };

  const handleToggleSuspend = async (u: any) => {
    try {
      await updateAdminUserAccess(u.id, { isActive: !u.isActive });
      await loadData(true);
      emitLocalWorkspaceEvent('members:updated', { userId: u.id });
      notify('ok', u.isActive ? `Suspended ${u.email} and revoked sessions.` : `Reactivated ${u.email}.`);
    } catch (err: any) {
      notify('err', err?.message || 'Failed to update status.');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setGeneratedInviteUrl(null);
    setInviteEmailMeta(null);
    const fullName = `${newFirstName.trim()} ${newLastName.trim()}`.trim();
    try {
      const res = await createAdminUserOrInvite({
        firstName: newFirstName.trim(),
        lastName: newLastName.trim(),
        name: fullName,
        email: newEmail.trim(),
        targetRole: newRole,
        presetKey: newPreset,
        storageQuotaMb: newQuotaMb,
        maxFileSizeMb: newMaxFileMb,
        sendInvite: sendInviteLink,
        ...(newPassword.trim().length >= 6 ? { initialPassword: newPassword.trim() } : {}),
      });
      await loadData(true);
      emitLocalWorkspaceEvent('members:updated', { userId: res.user?.id });
      if (res.inviteUrl) {
        setGeneratedInviteUrl(res.inviteUrl);
        setInviteEmailMeta({
          emailSent: res.emailSent,
          emailFrom: res.emailFrom,
          emailError: res.emailError,
        });
        notify(
          'ok',
          res.emailSent
            ? `Invitation emailed & link ready for ${newEmail}`
            : `Invite link generated for ${newEmail}`
        );
      } else {
        setIsAddOpen(false);
        setNewFirstName('');
        setNewLastName('');
        setNewEmail('');
        setNewPassword('');
        notify('ok', `Created account ${res.user.email}`);
      }
      if (res.user?.id) setSelectedUserId(res.user.id);
    } catch (err: any) {
      notify('err', err?.message || 'Failed to create user.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleOpenPreview = async (userId: string) => {
    setIsLoadingPreview(true);
    try {
      const data = await fetchAdminMemberPreview(userId);
      setPreviewData(data);
    } catch (err: any) {
      notify('err', err?.message || 'Failed to load member preview.');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  if (previewData) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
        <div className="sticky top-0 z-50 bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 font-semibold text-amber-900">
            <Eye className="w-4 h-4" />
            <span>
              Read-Only Preview: Viewing Member Portal as <strong>{previewData.user.name}</strong> ({previewData.user.email})
            </span>
          </div>
          <button
            type="button"
            onClick={() => setPreviewData(null)}
            className="px-3 py-1.5 rounded-full bg-amber-900 text-white font-semibold hover:bg-amber-800 cursor-pointer"
          >
            Exit Preview
          </button>
        </div>
        <MemberPortalShell
          user={{
            ...previewData.user,
            usedStorageBytes: previewData.storage.usedBytes,
          }}
          capabilities={previewData.capabilities}
          previewSnapshot={previewData}
          readOnlyPreview
          onLogout={async () => setPreviewData(null)}
          onUserUpdated={() => {}}
        />
      </div>
    );
  }

  const totalMembers = users.filter((u) => u.role === 'MEMBER').length;
  const suspendedCount = users.filter((u) => !u.isActive).length;
  const activeInvites = (overview?.invitations || []).filter(
    (inv: any) => !inv.acceptedAt && !inv.revokedAt && inv.expiresAt > Date.now()
  );

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#F6F8FC] dark:bg-slate-950">
      <div className="max-w-7xl mx-auto space-y-5">
        {toast && (
          <div
            className={`px-4 py-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
              toast.type === 'ok'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{toast.text}</span>
          </div>
        )}

        {/* Header + Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0B57D0] flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Admin Access &amp; Restriction Control Panel
              </h1>
              <p className="text-xs text-slate-500">
                Manage Members, Administrators, Project Manager Grants, Storage Quotas &amp; Security Audit
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setGeneratedInviteUrl(null);
                setInviteEmailMeta(null);
                setSendInviteLink(true);
                setIsAddOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-[#0B57D0] hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add / Invite User</span>
            </button>
          </div>
        </div>

        {/* Summary KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="text-xs text-slate-500 font-medium">Total Accounts</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
              {users.length}
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="text-xs text-slate-500 font-medium">Member Accounts</div>
            <div className="text-2xl font-bold text-[#0B57D0] mt-1 tabular-nums">{totalMembers}</div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="text-xs text-slate-500 font-medium">Pending Invites</div>
            <div className="text-2xl font-bold text-amber-600 mt-1 tabular-nums">
              {activeInvites.length}
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="text-xs text-slate-500 font-medium">Suspended Accounts</div>
            <div className="text-2xl font-bold text-rose-600 mt-1 tabular-nums">
              {suspendedCount}
            </div>
          </div>
        </div>

        {/* Section Selector */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
          {[
            { id: 'users', label: 'Users & Restrictions', icon: Users },
            { id: 'invites', label: `Invitations (${activeInvites.length})`, icon: KeyRound },
            { id: 'policies', label: 'Default Role Rules', icon: Sliders },
            { id: 'audit', label: 'Security Audit Log', icon: History },
          ].map((t) => {
            const Icon = t.icon;
            const active = subTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSubTab(t.id as any)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                  active
                    ? 'bg-[#0B57D0] text-white'
                    : 'bg-white dark:bg-slate-900 text-slate-600 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: USERS & PERMISSION/RESTRICTION INSPECTOR */}
        {subTab === 'users' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left Account List */}
            <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300">
                Accounts ({filteredUsers.length})
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[680px] overflow-y-auto">
                {filteredUsers.map((u) => {
                  const isSel = u.id === selectedUser?.id;
                  const pct = Math.min(
                    100,
                    Math.round(((u.usedStorageBytes || 0) / Math.max(1, u.storageQuotaBytes || 1)) * 100)
                  );
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setSelectedUserId(u.id)}
                      className={`w-full text-left p-4 flex items-start justify-between gap-3 transition cursor-pointer ${
                        isSel ? 'bg-blue-50/70 dark:bg-slate-800/80' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {u.name}
                          </span>
                          <select
                            value={u.role}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => handleFastRoleChange(u.id, e.target.value as any, u.name)}
                            className="text-[11px] font-bold px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 cursor-pointer hover:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            title="Direct Workspace Role Switcher"
                          >
                            <option value="USER">USER (Basic User)</option>
                            <option value="MEMBER">MEMBER (Team Member)</option>
                            <option value="ADMIN">ADMIN (Administrator)</option>
                            {currentUser.role === 'OWNER' && (
                              <option value="OWNER">OWNER (Executive Owner)</option>
                            )}
                          </select>
                          {!u.isActive && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                              SUSPENDED
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 truncate mt-0.5">{u.email}</div>
                        <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-500">
                          <span>
                            Storage: {formatBytes(u.usedStorageBytes)} / {formatBytes(u.storageQuotaBytes)} ({pct}%)
                          </span>
                          <span>·</span>
                          <span>Sessions: {u.activeSessionCount || 0}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Access, Restrictions, Project Grants & Quota Editor */}
            <div className="lg:col-span-7">
              {selectedUser ? (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-5">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold text-slate-900 dark:text-white">
                          {selectedUser.name}
                        </h2>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">
                          {selectedUser.role}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {selectedUser.email} · Permission v{selectedUser.permissionVersion}
                      </p>
                      {(selectedUser.phoneNumber || selectedUser.countryName || selectedUser.addressLine) && (
                        <div className="mt-2 text-[11px] text-slate-600 dark:text-slate-300 space-y-0.5">
                          {selectedUser.phoneNumber && (
                            <div>
                              Phone: {selectedUser.phoneCountryCode || ''} {selectedUser.phoneNumber}
                            </div>
                          )}
                          {(selectedUser.addressLine || selectedUser.cityName || selectedUser.stateName || selectedUser.countryName) && (
                            <div>
                              Address:{' '}
                              {[
                                selectedUser.addressLine,
                                selectedUser.cityName,
                                selectedUser.stateName,
                                selectedUser.zipCode,
                                selectedUser.countryName,
                              ]
                                .filter(Boolean)
                                .join(', ')}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {selectedUser.role === 'MEMBER' && (
                        <button
                          type="button"
                          disabled={isLoadingPreview}
                          onClick={() => handleOpenPreview(selectedUser.id)}
                          className="px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-indigo-100 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Preview Member Portal</span>
                        </button>
                      )}
                      {selectedUser.role !== 'OWNER' && (
                        <button
                          type="button"
                          onClick={() => handleToggleSuspend(selectedUser)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                            selectedUser.isActive
                              ? 'border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                              : 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>{selectedUser.isActive ? 'Suspend' : 'Reactivate'}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Role & Quick Preset */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Workspace Role
                      </label>
                      <select
                        value={draftRole}
                        disabled={!currentUser || currentUser.role !== 'OWNER' || selectedUser.role === 'OWNER'}
                        onChange={(e) => setDraftRole(e.target.value as any)}
                        className="w-full"
                      >
                        {selectedUser.role === 'OWNER' && <option value="OWNER">Owner (Primary Admin)</option>}
                        <option value="ADMIN">Administrator</option>
                        <option value="MEMBER">Regular Member / Team Member (Visible in Teams)</option>
                        <option value="USER">USER (Basic Registered User)</option>
                      </select>
                    </div>

                    {draftRole === 'MEMBER' && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Quick Access Preset
                        </label>
                        <select
                          value={draftPreset}
                          onChange={(e) => handleApplyPreset(e.target.value)}
                          className="w-full"
                        >
                          {(overview?.presets || []).map((p: any) => (
                            <option key={p.key} value={p.key}>
                              {p.label}
                            </option>
                          ))}
                          <option value="custom">Custom Restrictions</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Storage Quota Controls */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 space-y-3">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-200">
                      <span className="inline-flex items-center gap-1.5">
                        <HardDrive className="w-4 h-4 text-[#0B57D0]" />
                        Storage Quota &amp; File Upload Limits
                      </span>
                      <span>
                        Used: {formatBytes(selectedUser.usedStorageBytes)} / {draftQuotaMb} MB
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1">Total Quota (MB)</label>
                        <input
                          type="number"
                          min={5}
                          value={draftQuotaMb}
                          onChange={(e) => setDraftQuotaMb(Math.max(5, Number(e.target.value) || 100))}
                          className="w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1">Max Single File (MB)</label>
                        <input
                          type="number"
                          min={1}
                          value={draftMaxFileMb}
                          onChange={(e) => setDraftMaxFileMb(Math.max(1, Number(e.target.value) || 10))}
                          className="w-full"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Member Module Allow / Restrict Switches */}
                  {draftRole === 'MEMBER' && (
                    <>
                      <div>
                        <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-1.5">
                          <FolderLock className="w-4 h-4 text-[#0B57D0]" />
                          <span>Member Dashboard Modules (Toggle Off to Restrict)</span>
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {(overview?.memberModulePool || []).map((mod: string) => {
                            const restricted = draftRestrictedModules.includes(mod);
                            return (
                              <button
                                key={mod}
                                type="button"
                                onClick={() => toggleModuleRestriction(mod)}
                                className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 cursor-pointer ${
                                  restricted
                                    ? 'bg-rose-50/70 border-rose-200 text-rose-700'
                                    : 'bg-emerald-50/70 border-emerald-200 text-emerald-800'
                                }`}
                              >
                                <span className="truncate">{MODULE_LABELS[mod] || mod}</span>
                                <span className="text-[10px] font-bold">
                                  {restricted ? 'RESTRICTED' : 'ON'}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Granular Action Permissions */}
                      <div>
                        <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2">
                          Action Capabilities &amp; Restrictions
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {(overview?.permissionCatalog || []).map((perm: any) => {
                            const allowed =
                              draftAllowedActions.includes(perm.key) &&
                              !draftDeniedActions.includes(perm.key);
                            return (
                              <label
                                key={perm.key}
                                className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50"
                              >
                                <input
                                  type="checkbox"
                                  checked={allowed}
                                  onChange={() => toggleActionPermission(perm.key)}
                                  className="mt-0.5 rounded accent-[#0B57D0]"
                                />
                                <div className="min-w-0">
                                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                                    {perm.label}
                                  </div>
                                  <div className="text-[11px] text-slate-500">{perm.description}</div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* Scoped Project Manager / Participant Grants */}
                      <div>
                        <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2">
                          Project Access &amp; Project Manager Responsibilities ({overview?.projects?.length || 0})
                        </h3>
                        {(overview?.projects || []).length === 0 ? (
                          <div className="p-3 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500">
                            No projects exist yet. Create a project first to grant Member/Manager access.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {(overview?.projects || []).map((proj: any) => {
                              const existingGrant = draftGrants.find((g) => g.projectId === proj.id);
                              return (
                                <div
                                  key={proj.id}
                                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={Boolean(existingGrant)}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setDraftGrants((prev) => [
                                              ...prev,
                                              {
                                                projectId: proj.id,
                                                projectRole: 'PARTICIPANT',
                                                actions: ['project.read_assigned'],
                                              },
                                            ]);
                                          } else {
                                            setDraftGrants((prev) =>
                                              prev.filter((g) => g.projectId !== proj.id)
                                            );
                                          }
                                        }}
                                      />
                                      <span>{proj.title}</span>
                                    </label>
                                    {existingGrant && (
                                      <select
                                        value={existingGrant.projectRole}
                                        onChange={(e) => {
                                          const roleVal =
                                            e.target.value === 'MANAGER' ? 'MANAGER' : 'PARTICIPANT';
                                          setDraftGrants((prev) =>
                                            prev.map((g) =>
                                              g.projectId === proj.id
                                                ? { ...g, projectRole: roleVal }
                                                : g
                                            )
                                          );
                                        }}
                                        className="text-xs py-1 px-2"
                                      >
                                        <option value="PARTICIPANT">Participant (View Only)</option>
                                        <option value="MANAGER">Project Manager</option>
                                      </select>
                                    )}
                                  </div>
                                  {existingGrant && existingGrant.projectRole === 'MANAGER' && (
                                    <div className="flex flex-wrap gap-2 pt-1">
                                      {(overview?.projectGrantActions || []).map((act: any) => {
                                        const hasAct = existingGrant.actions.includes(act.key);
                                        return (
                                          <label
                                            key={act.key}
                                            className="inline-flex items-center gap-1.5 text-[11px] bg-blue-50 text-blue-800 px-2.5 py-1 rounded-lg cursor-pointer"
                                          >
                                            <input
                                              type="checkbox"
                                              checked={hasAct}
                                              onChange={() =>
                                                setDraftGrants((prev) =>
                                                  prev.map((g) => {
                                                    if (g.projectId !== proj.id) return g;
                                                    const nextActs = hasAct
                                                      ? g.actions.filter((a) => a !== act.key)
                                                      : [...g.actions, act.key];
                                                    return { ...g, actions: nextActs };
                                                  })
                                                )
                                              }
                                            />
                                            <span>{act.label}</span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Task Assignments & Allowed Chat Channels */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                          <div className="text-xs font-bold text-slate-700 mb-2">
                            Assigned Tasks ({draftTaskIds.length})
                          </div>
                          <div className="max-h-36 overflow-y-auto space-y-1.5">
                            {(overview?.tasks || []).length === 0 ? (
                              <div className="text-[11px] text-slate-400">No tasks available</div>
                            ) : (
                              (overview?.tasks || []).map((t: any) => (
                                <label key={t.id} className="flex items-center gap-2 text-xs cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={draftTaskIds.includes(t.id)}
                                    onChange={(e) =>
                                      setDraftTaskIds((prev) =>
                                        e.target.checked ? [...prev, t.id] : prev.filter((id) => id !== t.id)
                                      )
                                    }
                                  />
                                  <span className="truncate">{t.title}</span>
                                </label>
                              ))
                            )}
                          </div>
                        </div>

                        <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                          <div className="text-xs font-bold text-slate-700 mb-2">
                            Allowed Chat Channels ({draftChannelIds.length})
                          </div>
                          <div className="max-h-36 overflow-y-auto space-y-1.5">
                            {(overview?.channels || []).length === 0 ? (
                              <div className="text-[11px] text-slate-400">No chat channels available</div>
                            ) : (
                              (overview?.channels || []).map((c: any) => (
                                <label key={c.id} className="flex items-center gap-2 text-xs cursor-pointer">
                                  <input
                                    type="checkbox"
                                    disabled={c.isWorkspaceWide}
                                    checked={draftChannelIds.includes(c.id)}
                                    onChange={(e) =>
                                      setDraftChannelIds((prev) =>
                                        e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id)
                                      )
                                    }
                                  />
                                  <span className="truncate">
                                    #{c.name} {c.isWorkspaceWide ? '(Admin Only)' : ''}
                                  </span>
                                </label>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Save + Force Logout Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={async () => {
                        await revokeAdminUserSessions(selectedUser.id);
                        await loadData();
                        notify('ok', `Revoked all active sessions for ${selectedUser.email}`);
                      }}
                      className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5 text-rose-600" />
                      <span>Force Logout ({userSessions.filter((s) => !s.revokedAt).length} active)</span>
                    </button>

                    <button
                      type="button"
                      disabled={isSavingInspector}
                      onClick={handleSaveUserAccess}
                      className="px-5 py-2.5 rounded-xl bg-[#0B57D0] hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>{isSavingInspector ? 'Saving...' : 'Save Access & Restrictions'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500">
                  Select a user account to inspect or restrict permissions.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: INVITATIONS */}
        {subTab === 'invites' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Account Invitations</h2>
            </div>
            {(overview?.invitations || []).length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">No invitations created yet.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {(overview?.invitations || []).map((inv: any) => {
                  const status = inv.revokedAt
                    ? 'Revoked'
                    : inv.acceptedAt
                    ? 'Accepted'
                    : inv.expiresAt < Date.now()
                    ? 'Expired'
                    : 'Pending';
                  return (
                    <div key={inv.id} className="p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="font-bold text-slate-900">{inv.name} ({inv.email})</div>
                        <div className="text-slate-500 mt-0.5">
                          Role: {inv.targetRole} · Preset: {inv.presetKey} · Created: {inv.createdAt}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-1 rounded-full font-bold ${
                            status === 'Accepted'
                              ? 'bg-emerald-50 text-emerald-700'
                              : status === 'Pending'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {status}
                        </span>
                        {status === 'Pending' && (
                          <button
                            type="button"
                            onClick={async () => {
                              await revokeAdminInvitation(inv.id);
                              await loadData();
                              notify('ok', `Revoked invite for ${inv.email}`);
                            }}
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: ROLE PRESETS MATRIX */}
        {subTab === 'policies' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(overview?.presets || []).map((preset: any) => (
              <div
                key={preset.key}
                className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">{preset.label}</h3>
                  <span className="px-2.5 py-1 rounded-full bg-blue-50 text-[#0B57D0] text-[11px] font-bold">
                    {preset.defaultQuotaMb} MB Quota · {preset.defaultMaxFileMb} MB Max File
                  </span>
                </div>
                <p className="text-xs text-slate-500">{preset.description}</p>
                <div className="flex flex-wrap gap-1.5">
                  {preset.defaultModules.map((m: string) => (
                    <span
                      key={m}
                      className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-medium"
                    >
                      {MODULE_LABELS[m] || m}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 4: SECURITY AUDIT TIMELINE */}
        {subTab === 'audit' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center gap-2 text-sm font-bold text-slate-900">
              <Activity className="w-4 h-4 text-[#0B57D0]" />
              <span>Security &amp; Access Audit Log</span>
            </div>
            <div className="divide-y divide-slate-100 max-h-[540px] overflow-y-auto">
              {(overview?.auditEvents || []).map((ev: any) => (
                <div key={ev.id} className="p-4 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div>
                    <div className="font-semibold text-slate-900">{ev.summary}</div>
                    <div className="text-slate-500 mt-0.5">
                      Actor: {ev.actorEmail} · Action: <code className="text-blue-700">{ev.action}</code>
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium">{ev.createdAt}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ADD / INVITE USER MODAL */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 p-6 border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Add or Invite User</h2>
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Close
              </button>
            </div>

            {generatedInviteUrl ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-2">
                  <div className="font-bold">Account Invitation Link Ready!</div>
                  {inviteEmailMeta?.emailSent ? (
                    <p className="font-medium text-emerald-800">
                      Invitation email automatically sent to <strong>{newEmail}</strong> from{' '}
                      <strong>{inviteEmailMeta.emailFrom}</strong>. They can open this link to review their
                      name, generate a strong password, and finish their address profile:
                    </p>
                  ) : (
                    <p className="text-amber-800 bg-amber-50/90 border border-amber-200 rounded-lg p-2">
                      <strong>Link created:</strong>{' '}
                      {inviteEmailMeta?.emailError || 'Connect Server Mail or Gmail in Settings to email invites automatically.'}{' '}
                      Share this link directly so they can activate and set their password:
                    </p>
                  )}
                  <div className="p-2.5 rounded-lg bg-white border border-emerald-200 font-mono text-[11px] break-all">
                    {generatedInviteUrl}
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(generatedInviteUrl);
                      notify('ok', 'Copied invite link!');
                    }}
                    className="px-4 py-2 rounded-xl bg-[#0B57D0] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Invite Link</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddOpen(false);
                      setNewFirstName('');
                      setNewLastName('');
                      setNewEmail('');
                      setNewPassword('');
                    }}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateUser} className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">First Name</label>
                    <input
                      type="text"
                      required
                      value={newFirstName}
                      onChange={(e) => setNewFirstName(e.target.value)}
                      placeholder="e.g. Rahim"
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Last Name</label>
                    <input
                      type="text"
                      required
                      value={newLastName}
                      onChange={(e) => setNewLastName(e.target.value)}
                      placeholder="e.g. Hasan"
                      className="w-full"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="member@company.com"
                    className="w-full"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Role</label>
                    <select
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value as any)}
                      className="w-full"
                    >
                      <option value="USER">USER (Basic Registered User)</option>
                      <option value="MEMBER">Regular Member (Member Portal &amp; Teams)</option>
                      {currentUser.role === 'OWNER' && (
                        <option value="ADMIN">Administrator (Admin Console)</option>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Default Preset</label>
                    <select
                      value={newPreset}
                      disabled={newRole === 'ADMIN'}
                      onChange={(e) => {
                        setNewPreset(e.target.value);
                        const p = (overview?.presets || []).find((x: any) => x.key === e.target.value);
                        if (p) {
                          setNewQuotaMb(p.defaultQuotaMb);
                          setNewMaxFileMb(p.defaultMaxFileMb);
                        }
                      }}
                      className="w-full"
                    >
                      {(overview?.presets || []).map((p: any) => (
                        <option key={p.key} value={p.key}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Storage Quota (MB)
                    </label>
                    <input
                      type="number"
                      min={5}
                      value={newQuotaMb}
                      onChange={(e) => setNewQuotaMb(Math.max(5, Number(e.target.value) || 100))}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Max File Size (MB)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={newMaxFileMb}
                      onChange={(e) => setNewMaxFileMb(Math.max(1, Number(e.target.value) || 15))}
                      className="w-full"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Starter Password (Optional)
                  </label>
                  <input
                    type="password"
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Optional starter password (member can change/generate via link)"
                    className="w-full"
                  />
                </div>

                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/80 cursor-pointer text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={sendInviteLink}
                    onChange={(e) => setSendInviteLink(e.target.checked)}
                    className="mt-0.5 rounded"
                  />
                  <span>
                    <strong className="block text-slate-900">Generate Invite Link & Send Invitation Email</strong>
                    Invited member sees their name & inviter, generates their own password, and completes address setup.
                  </span>
                </label>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="px-5 py-2 rounded-xl bg-[#0B57D0] text-white text-xs font-semibold cursor-pointer"
                  >
                    {isCreating
                      ? 'Sending...'
                      : sendInviteLink
                      ? 'Invite User & Generate Link'
                      : 'Create User Directly'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
