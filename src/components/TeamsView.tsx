import React, { Suspense, lazy, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users,
  UserPlus,
  Layers,
  Copy,
  Check,
  Send,
  Edit3,
  Trash2,
  Search,
  Eye,
  Mail,
  Image as ImageIcon,
  Plus,
  X,
  Briefcase,
  CheckCircle2,
  LayoutGrid,
  List,
  UserCheck,
  Phone,
  ArrowUpRight,
  MessageSquare,
} from 'lucide-react';
import { emitLocalWorkspaceEvent, subscribeWorkspaceEvents } from '../services/realtimeBus';
import {
  WorkspaceMemberItem,
  WorkspaceTeamGroup,
  ServerMailAccount,
  fetchWorkspaceTeamsAndMembers,
  saveWorkspaceMember,
  deleteWorkspaceMember,
  sendMemberInvitation,
  saveWorkspaceTeamGroup,
  deleteWorkspaceTeamGroup,
  sendGmailMessage,
  searchMembersInstant,
} from '../services/workspaceApi';
import { FileManagerPickerModal } from './FileManagerPickerModal';
import type { ImageEditorTarget } from './ImageEditorModal';

const ImageEditorModal = lazy(() =>
  import('./ImageEditorModal').then((m) => ({ default: m.ImageEditorModal }))
);

export type TeamsSubTab = 'all_members' | 'team_groups' | 'add_member';

interface TeamsViewProps {
  activeSubTab?: TeamsSubTab;
  onSelectSubTab?: (tab: TeamsSubTab) => void;
  onPreviewMemberInvite: (memberId: string) => void;
  isAuthenticated: boolean;
  serverAccounts: ServerMailAccount[];
  activeServerAccountId?: string | null;
  onEmailTeamMembers?: (members: WorkspaceMemberItem[], teamName: string) => void;
  onViewMemberProfile?: (memberId: string) => void;
  onMessageMember?: (memberId: string) => void;
}

export const TeamsView: React.FC<TeamsViewProps> = ({
  activeSubTab = 'all_members',
  onSelectSubTab,
  onPreviewMemberInvite,
  isAuthenticated,
  serverAccounts,
  activeServerAccountId,
  onEmailTeamMembers,
  onViewMemberProfile,
  onMessageMember,
}) => {
  const [subTab, setSubTab] = useState<TeamsSubTab>(activeSubTab);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [members, setMembers] = useState<WorkspaceMemberItem[]>([]);
  const [groups, setGroups] = useState<WorkspaceTeamGroup[]>([]);
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sendingInviteId, setSendingInviteId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Add / Edit Member State
  const [editingMemberId, setEditingMemberId] = useState<string | undefined>(undefined);
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [designation, setDesignation] = useState<string>('');
  const [teamId, setTeamId] = useState<string>('team-exec');
  const [phone, setPhone] = useState<string>('');
  const [bio, setBio] = useState<string>('');
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [isSavingMember, setIsSavingMember] = useState<boolean>(false);
  const [isFilePickerOpen, setIsFilePickerOpen] = useState<boolean>(false);
  const [editingAvatarTarget, setEditingAvatarTarget] = useState<ImageEditorTarget | null>(null);

  // Team Group Form State
  const [editingGroupId, setEditingGroupId] = useState<string | undefined>(undefined);
  const [groupName, setGroupName] = useState<string>('');
  const [groupDesc, setGroupDesc] = useState<string>('');
  const [groupColor, setGroupColor] = useState<string>('#0B57D0');
  const [isSavingGroup, setIsSavingGroup] = useState<boolean>(false);

  useEffect(() => {
    setSubTab(activeSubTab);
  }, [activeSubTab]);

  const selectTab = (next: TeamsSubTab) => {
    setSubTab(next);
    onSelectSubTab?.(next);
  };

  const loadTeamsData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const data = await fetchWorkspaceTeamsAndMembers();
      setMembers(data.members);
      setGroups(data.groups);
      if (data.groups.length > 0 && !data.groups.some((g) => g.id === teamId)) {
        setTeamId(data.groups[0].id);
      }
    } catch (err: any) {
      if (!silent) setErrorMsg(err?.message || 'Failed to load team members.');
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTeamsData(false);
    const unsubscribe = subscribeWorkspaceEvents((eventName) => {
      if (eventName === 'members:updated' || eventName === 'auth:permissions_updated') {
        loadTeamsData(true);
      }
    });
    return unsubscribe;
  }, []);

  const getMemberInviteUrl = (member: WorkspaceMemberItem) => {
    return `${window.location.origin}/?invite=${encodeURIComponent(member.id)}`;
  };

  const handleCopyInviteLink = (member: WorkspaceMemberItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const url = getMemberInviteUrl(member);
    navigator.clipboard.writeText(url);
    setCopiedId(member.id);
    setToastMsg(`Invitation link copied for ${member.fullName}`);
    setTimeout(() => {
      setCopiedId(null);
      setToastMsg(null);
    }, 2500);
  };

  const handleSendInviteLink = async (member: WorkspaceMemberItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSendingInviteId(member.id);
    setErrorMsg(null);
    const inviteUrl = getMemberInviteUrl(member);

    try {
      const res = await sendMemberInvitation(member.id, {
        inviteUrl,
        serverAccountId: activeServerAccountId || serverAccounts[0]?.id || null,
      });

      // If no Server Mail SMTP was configured, fallback to sending via connected Gmail if authenticated
      if (!res.sentViaServerSmtp && isAuthenticated) {
        const subject = `Workspace Invitation: ${member.fullName} (${member.designation} — ${member.teamName})`;
        const bodyHtml = `
          <div style="max-width:580px;padding:20px;font-family:sans-serif;border:1px solid #e2e8f0;border-radius:16px;">
            <h2 style="margin:0 0 12px 0;color:#0f172a;">You're Invited to Workspace Pro</h2>
            <p style="font-size:14px;color:#334155;line-height:1.6;">
              Hello <strong>${member.fullName}</strong>, you have been added to <strong>${member.teamName}</strong> as <strong>${member.designation}</strong>.
            </p>
            <p style="margin:20px 0;">
              <a href="${inviteUrl}" style="display:inline-block;padding:10px 22px;background:#0B57D0;color:#ffffff;text-decoration:none;border-radius:999px;font-weight:600;font-size:13px;">
                View & Activate My Profile
              </a>
            </p>
            <p style="font-size:12px;color:#64748b;">Direct Link: <a href="${inviteUrl}">${inviteUrl}</a></p>
          </div>
        `;
        try {
          await sendGmailMessage({
            to: member.email,
            subject,
            bodyHtml,
          });
        } catch {
          // ignore if Gmail send is skipped
        }
      }

      setMembers(res.members);
      setToastMsg(
        `Invitation link sent to ${member.fullName} (${member.email})!`
      );
      setTimeout(() => setToastMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to send invitation link.');
    } finally {
      setSendingInviteId(null);
    }
  };

  const resetMemberForm = () => {
    setEditingMemberId(undefined);
    setFirstName('');
    setLastName('');
    setEmail('');
    setDesignation('');
    setTeamId(groups[0]?.id || 'team-exec');
    setPhone('');
    setBio('');
    setAvatarUrl('');
  };

  const handleOpenEditMember = (member: WorkspaceMemberItem) => {
    setEditingMemberId(member.id);
    setFirstName(member.firstName);
    setLastName(member.lastName);
    setEmail(member.email);
    setDesignation(member.designation);
    setTeamId(member.teamId);
    setPhone(member.phone || '');
    setBio(member.bio || '');
    setAvatarUrl(member.avatarUrl || '');
    selectTab('add_member');
  };

  const handleSaveMemberForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !email.trim() || !designation.trim()) return;
    setIsSavingMember(true);
    setErrorMsg(null);

    try {
      const selectedGroup = groups.find((g) => g.id === teamId);
      const res = await saveWorkspaceMember({
        id: editingMemberId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        designation: designation.trim(),
        teamId,
        teamName: selectedGroup?.name || 'Executive Leadership',
        phone: phone.trim(),
        bio: bio.trim(),
        avatarUrl: avatarUrl.trim() || undefined,
      });
      setMembers(res.members);
      emitLocalWorkspaceEvent('members:updated', { memberId: res.member.id });
      setToastMsg(
        editingMemberId
          ? `Member "${res.member.fullName}" updated in database.`
          : `Member "${res.member.fullName}" added to ${res.member.teamName}.`
      );
      setTimeout(() => setToastMsg(null), 3500);
      resetMemberForm();
      selectTab('all_members');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save member.');
    } finally {
      setIsSavingMember(false);
    }
  };

  const handleDeleteMember = async (id: string) => {
    try {
      const updated = await deleteWorkspaceMember(id);
      setMembers(updated);
      emitLocalWorkspaceEvent('members:updated', { deletedId: id });
      setToastMsg('Member removed.');
      setTimeout(() => setToastMsg(null), 2500);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not remove member.');
    }
  };

  const handleQuickAssignTeam = async (member: WorkspaceMemberItem, newTeamId: string) => {
    const grp = groups.find((g) => g.id === newTeamId);
    if (!grp) return;
    try {
      const res = await saveWorkspaceMember({
        id: member.id,
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email,
        designation: member.designation,
        teamId: grp.id,
        teamName: grp.name,
        phone: member.phone,
        bio: member.bio,
        avatarUrl: member.avatarUrl,
        status: member.status,
      });
      setMembers(res.members);
      setToastMsg(`Moved ${member.fullName} to ${grp.name}`);
      setTimeout(() => setToastMsg(null), 2500);
    } catch {
      // ignore
    }
  };

  const handleSaveTeamGroupForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;
    setIsSavingGroup(true);
    try {
      const res = await saveWorkspaceTeamGroup({
        id: editingGroupId,
        name: groupName.trim(),
        description: groupDesc.trim(),
        color: groupColor,
      });
      setGroups(res.groups);
      if (res.members) setMembers(res.members);
      setEditingGroupId(undefined);
      setGroupName('');
      setGroupDesc('');
      setToastMsg(`Team group "${res.group.name}" saved.`);
      setTimeout(() => setToastMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save team group.');
    } finally {
      setIsSavingGroup(false);
    }
  };

  const handleDeleteTeamGroup = async (id: string) => {
    try {
      const updated = await deleteWorkspaceTeamGroup(id);
      setGroups(updated);
      if (selectedTeamFilter === id) setSelectedTeamFilter('ALL');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not delete team group.');
    }
  };

  // Instant 1-Character Search + Team Group Filter
  const searchedMembers = searchMembersInstant(searchQuery, members);
  const filteredMembers = searchedMembers.filter((m) =>
    selectedTeamFilter === 'ALL' ? true : m.teamId === selectedTeamFilter
  );

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 md:rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
      {/* Top Sub-Navigation Bar: 1. All Members | 2. Team Groups | 3. Add New Member */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-between gap-2.5 px-3 sm:px-4 py-2.5 border-b border-slate-200/80 dark:border-slate-800 bg-[#F8FAFD] dark:bg-slate-900 shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 sm:pb-0">
          <motion.button
            whileTap={{ scale: 0.96 }}
            type="button"
            onClick={() => selectTab('all_members')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
              subTab === 'all_members'
                ? 'bg-[#0B57D0] text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>All Members ({members.length})</span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.96 }}
            type="button"
            onClick={() => selectTab('team_groups')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
              subTab === 'team_groups'
                ? 'bg-[#0B57D0] text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Team Groups ({groups.length})</span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.96 }}
            type="button"
            onClick={() => {
              resetMemberForm();
              selectTab('add_member');
            }}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
              subTab === 'add_member'
                ? 'bg-[#0B57D0] text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>{editingMemberId ? 'Edit Member' : 'Add New Member'}</span>
          </motion.button>
        </div>

        {/* Right: Instant 1-Char Search */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (subTab !== 'all_members') selectTab('all_members');
              }}
              placeholder="Type 1 letter to search members..."
              className="pl-8 pr-7 py-2 sm:py-1.5 text-xs rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-600 w-full sm:w-64"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Banners */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex items-center justify-between px-4 py-2 bg-emerald-50 dark:bg-emerald-950/60 border-b border-emerald-200 text-xs font-medium text-emerald-800 dark:text-emerald-200 overflow-hidden"
          >
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4" />
              {toastMsg}
            </span>
            <button type="button" onClick={() => setToastMsg(null)}>
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {errorMsg && (
        <div className="flex items-center justify-between px-4 py-2 bg-red-50 dark:bg-red-950/60 border-b border-red-200 text-xs text-red-700 dark:text-red-300">
          <span>{errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg(null)}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* TAB 1: ALL MEMBERS */}
      {subTab === 'all_members' && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Clean Team Group Dropdown Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 shrink-0">
            <div className="flex items-center gap-2 flex-wrap flex-1 sm:flex-initial">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300 hidden xs:inline">
                Team Group:
              </span>
              <select
                value={selectedTeamFilter}
                onChange={(e) => setSelectedTeamFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#0B57D0] flex-1 sm:flex-initial max-w-[210px] sm:max-w-none"
              >
                <option value="ALL">All Teams ({members.length} Members)</option>
                {groups.map((grp) => {
                  const count = members.filter((m) => m.teamId === grp.id).length;
                  return (
                    <option key={grp.id} value={grp.id}>
                      {grp.name} ({count})
                    </option>
                  );
                })}
              </select>

              {/* View Switcher: Frosted Glass Cards vs Compact Table */}
              <div className="flex items-center gap-1 p-0.5 rounded-xl bg-slate-200/70 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                    viewMode === 'grid'
                      ? 'bg-white dark:bg-slate-900 text-[#0B57D0] dark:text-blue-400 shadow-2xs font-bold'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Frosted Glass Profile Cards"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Cards</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                    viewMode === 'table'
                      ? 'bg-white dark:bg-slate-900 text-[#0B57D0] dark:text-blue-400 shadow-2xs font-bold'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Compact List View"
                >
                  <List className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">List</span>
                </button>
              </div>
            </div>

            {onEmailTeamMembers && filteredMembers.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const teamLabel =
                    selectedTeamFilter === 'ALL'
                      ? 'All Workspace Members'
                      : groups.find((g) => g.id === selectedTeamFilter)?.name || 'Selected Team';
                  onEmailTeamMembers(filteredMembers, teamLabel);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-[#0B57D0] dark:text-blue-300 text-xs font-semibold hover:bg-blue-100 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Mail className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Bulk Email Selected Team ({filteredMembers.length})</span>
                <span className="sm:hidden">Email ({filteredMembers.length})</span>
              </button>
            )}
          </div>

          {/* Single-Line Compact Member Row List */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 pb-20 md:pb-6">
            {isLoading ? (
              <div className="text-center py-12 text-xs text-slate-400">
                Loading members...
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="text-center py-14 space-y-2">
                <Users className="w-10 h-10 text-slate-300 mx-auto" />
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  No members matched your filter
                </div>
                <p className="text-xs text-slate-500">
                  Use the &ldquo;Add New Member&rdquo; tab above to add a team member.
                </p>
              </div>
            ) : viewMode === 'grid' ? (
              /* Frosted Glass Modern Member Profile Card Grid */
              <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
                {filteredMembers.map((member, idx) => {
                  const grp = groups.find((g) => g.id === member.teamId);
                  const isCopied = copiedId === member.id;
                  const isSending = sendingInviteId === member.id;

                  return (
                    <motion.div
                      key={member.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.22, delay: Math.min(idx * 0.04, 0.28) }}
                      whileHover={{ y: -4 }}
                      className="group relative rounded-3xl overflow-hidden bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border border-white/70 dark:border-slate-800 shadow-[0_8px_30px_rgba(0,0,0,0.04)] hover:shadow-xl transition-shadow duration-300 flex flex-col justify-between"
                    >
                      {/* Card Mini Cover Banner */}
                      <div
                        className="h-20 w-full relative overflow-hidden"
                        style={{
                          background: grp?.color
                            ? `linear-gradient(135deg, ${grp.color}dd, #1e293b)`
                            : 'linear-gradient(135deg, #0B57D0, #4f46e5)',
                        }}
                      >
                        {/* Status Pill */}
                        <div className="absolute top-2.5 right-2.5 flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-black/40 text-white backdrop-blur-md border border-white/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span>{member.status}</span>
                        </div>
                      </div>

                      {/* Avatar and Identity */}
                      <div className="px-5 pb-5 pt-0 flex-1 flex flex-col">
                        <div className="relative -mt-10 mb-3 flex items-end justify-between">
                          <div className="w-16 h-16 rounded-2xl p-0.5 bg-white dark:bg-slate-900 shadow-lg border border-slate-100 dark:border-slate-800 shrink-0 overflow-hidden">
                            {member.avatarUrl ? (
                              <img
                                src={member.avatarUrl}
                                alt={member.fullName}
                                className="w-full h-full rounded-xl object-cover"
                              />
                            ) : (
                              <div
                                className="w-full h-full rounded-xl text-white font-bold text-lg flex items-center justify-center"
                                style={{ backgroundColor: grp?.color || '#0B57D0' }}
                              >
                                {member.firstName.charAt(0)}
                                {member.lastName ? member.lastName.charAt(0) : ''}
                              </div>
                            )}
                          </div>

                          {/* Team Pill */}
                          <span
                            className="px-2.5 py-1 rounded-xl text-[10px] font-bold text-white shadow-2xs truncate max-w-[130px]"
                            style={{ backgroundColor: grp?.color || '#0B57D0' }}
                          >
                            {member.teamName}
                          </span>
                        </div>

                        {/* Name & Designation */}
                        <div className="space-y-1 mb-3">
                          <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 truncate">
                            {member.fullName}
                          </h3>
                          <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 truncate flex items-center gap-1">
                            <Briefcase className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{member.designation}</span>
                          </p>
                        </div>

                        {/* Bio Snippet */}
                        {member.bio && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-3 leading-relaxed">
                            {member.bio}
                          </p>
                        )}

                        {/* Contact Chips */}
                        <div className="mt-auto space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500">
                          <div className="flex items-center gap-1.5 truncate">
                            <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{member.email}</span>
                          </div>
                          {member.phone && (
                            <div className="flex items-center gap-1.5 truncate">
                              <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate">{member.phone}</span>
                            </div>
                          )}
                        </div>

                        {/* Card Actions: Primary "About" + Secondary Icons */}
                        <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-1.5">
                          {/* PRIMARY ABOUT / FULL CV BUTTON */}
                          <button
                            type="button"
                            onClick={() =>
                              onViewMemberProfile
                                ? onViewMemberProfile(member.id)
                                : onPreviewMemberInvite(member.id)
                            }
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 hover:bg-[#0B57D0] text-[#0B57D0] dark:text-blue-300 hover:text-white text-xs font-bold transition-all shadow-2xs group/btn cursor-pointer"
                            title="View Full Executive CV & Portfolio"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>About</span>
                            <ArrowUpRight className="w-3 h-3 opacity-60 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
                          </button>

                          {/* Direct Message in Communication */}
                          {onMessageMember && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onMessageMember(member.id);
                              }}
                              className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-600 text-emerald-700 dark:text-emerald-300 hover:text-white transition-colors cursor-pointer"
                              title={`Message ${member.fullName} in Communication`}
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Copy Invitation Link */}
                          <button
                            type="button"
                            onClick={(e) => handleCopyInviteLink(member, e)}
                            className={`p-2 rounded-xl border text-xs font-semibold transition-colors ${
                              isCopied
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                            title={isCopied ? 'Link Copied' : 'Copy Invitation Link'}
                          >
                            {isCopied ? (
                              <Check className="w-3.5 h-3.5" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {/* Send Email Invite */}
                          <button
                            type="button"
                            onClick={(e) => handleSendInviteLink(member, e)}
                            disabled={isSending}
                            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/40 text-slate-700 dark:text-slate-200 hover:text-blue-600 disabled:opacity-50 transition-colors"
                            title={`Send Invitation Link to ${member.email}`}
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit Member */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditMember(member);
                            }}
                            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
                            title="Edit Member"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Member */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteMember(member.id);
                            }}
                            className="p-2 rounded-xl border border-rose-100 dark:border-rose-950 hover:bg-rose-50 text-rose-600 transition-colors"
                            title="Remove Member"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              /* Compact Table List View */
              <div className="max-w-6xl mx-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200/90 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
                {filteredMembers.map((member) => {
                  const grp = groups.find((g) => g.id === member.teamId);
                  const isCopied = copiedId === member.id;
                  const isSending = sendingInviteId === member.id;

                  return (
                    <div
                      key={member.id}
                      onClick={() => onPreviewMemberInvite(member.id)}
                      className="group flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-blue-50/40 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
                    >
                      {/* Left: Avatar + Name + Designation + Team Group + Email */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {member.avatarUrl ? (
                          <img
                            src={member.avatarUrl}
                            alt={member.fullName}
                            className="w-8 h-8 rounded-full object-cover shrink-0 border border-slate-200"
                          />
                        ) : (
                          <div
                            className="w-8 h-8 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0"
                            style={{ backgroundColor: grp?.color || '#0B57D0' }}
                          >
                            {member.firstName.charAt(0).toUpperCase()}
                            {member.lastName ? member.lastName.charAt(0).toUpperCase() : ''}
                          </div>
                        )}

                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {member.fullName}
                        </span>

                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shrink-0">
                          <Briefcase className="w-3 h-3 text-[#0B57D0]" />
                          {member.designation}
                        </span>

                        <span
                          className="hidden md:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold text-white shrink-0"
                          style={{ backgroundColor: grp?.color || '#0B57D0' }}
                        >
                          {member.teamName}
                        </span>

                        <span className="hidden lg:inline font-mono text-xs text-slate-500 truncate">
                          {member.email}
                        </span>

                        {member.inviteSentAt && (
                          <span className="hidden xl:inline text-[10px] text-emerald-600 font-semibold shrink-0">
                            · Invite Sent ({member.inviteSentAt})
                          </span>
                        )}
                      </div>

                      {/* Right: Actions */}
                      <div
                        className="flex items-center gap-1.5 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Primary "About" Button in Table */}
                        <button
                          type="button"
                          onClick={() =>
                            onViewMemberProfile
                              ? onViewMemberProfile(member.id)
                              : onPreviewMemberInvite(member.id)
                          }
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 hover:bg-[#0B57D0] text-[#0B57D0] dark:text-blue-300 hover:text-white text-[11px] font-bold transition-colors"
                          title="View Full Executive CV & Portfolio"
                        >
                          <UserCheck className="w-3 h-3" />
                          <span>About</span>
                        </button>

                        {/* Direct Message in Table */}
                        {onMessageMember && (
                          <button
                            type="button"
                            onClick={() => onMessageMember(member.id)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-600 text-emerald-700 dark:text-emerald-300 hover:text-white text-[11px] font-bold transition-colors cursor-pointer"
                            title={`Message ${member.fullName}`}
                          >
                            <MessageSquare className="w-3 h-3" />
                            <span>Message</span>
                          </button>
                        )}

                        {/* Copy Invitation Link */}
                        <button
                          type="button"
                          onClick={(e) => handleCopyInviteLink(member, e)}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-colors ${
                            isCopied
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                          title="Copy Invitation Link"
                        >
                          {isCopied ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          <span className="hidden sm:inline">
                            {isCopied ? 'Copied' : 'Copy Invite'}
                          </span>
                        </button>

                        {/* Send Invitation Link to Member's Email */}
                        <button
                          type="button"
                          onClick={(e) => handleSendInviteLink(member, e)}
                          disabled={isSending}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0B57D0] hover:bg-blue-700 disabled:opacity-50 text-white text-[11px] font-semibold transition-colors"
                          title={`Send Invitation Link to ${member.email}`}
                        >
                          <Send className="w-3 h-3" />
                          <span className="hidden sm:inline">
                            {isSending ? 'Sending...' : 'Send Invite'}
                          </span>
                        </button>

                        {/* Preview Member Profile Portal */}
                        <button
                          type="button"
                          onClick={() => onPreviewMemberInvite(member.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="View Member Profile Page"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {/* Edit Member */}
                        <button
                          type="button"
                          onClick={() => handleOpenEditMember(member)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Edit Member"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete Member */}
                        <button
                          type="button"
                          onClick={() => handleDeleteMember(member.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                          title="Remove Member"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: TEAM GROUPS */}
      {subTab === 'team_groups' && (
        <div className="flex-1 overflow-y-auto p-5 md:p-8">
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Create / Edit Team Group Form */}
            <form
              onSubmit={handleSaveTeamGroupForm}
              className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {editingGroupId ? 'Update Team Group' : 'Create New Team Group / Category'}
                </h3>
                {editingGroupId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingGroupId(undefined);
                      setGroupName('');
                      setGroupDesc('');
                    }}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    + Create New Instead
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  required
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Team Group Name (e.g. Core Engineering) *"
                  className="px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
                <input
                  type="text"
                  value={groupDesc}
                  onChange={(e) => setGroupDesc(e.target.value)}
                  placeholder="Description / Department Focus"
                  className="px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={groupColor}
                    onChange={(e) => setGroupColor(e.target.value)}
                    className="w-9 h-9 rounded-lg border border-slate-200 cursor-pointer shrink-0"
                    title="Team Badge Color"
                  />
                  <button
                    type="submit"
                    disabled={isSavingGroup}
                    className="flex-1 py-2 px-4 rounded-xl bg-[#0B57D0] hover:bg-blue-700 text-white text-xs font-semibold"
                  >
                    {editingGroupId ? 'Update Team Group' : '+ Save Team Group'}
                  </button>
                </div>
              </div>
            </form>

            {/* Team Groups List with Assigned Members */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {groups.map((grp) => {
                const teamMembers = members.filter((m) => m.teamId === grp.id);
                return (
                  <div
                    key={grp.id}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between space-y-4 shadow-2xs"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-3.5 h-3.5 rounded-full shrink-0"
                            style={{ backgroundColor: grp.color }}
                          />
                          <div>
                            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                              {grp.name}
                            </h4>
                            <p className="text-xs text-slate-500">{grp.description}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingGroupId(grp.id);
                              setGroupName(grp.name);
                              setGroupDesc(grp.description);
                              setGroupColor(grp.color);
                            }}
                            className="p-1 text-slate-400 hover:text-slate-700"
                            title="Edit Team Group"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTeamGroup(grp.id)}
                            className="p-1 text-slate-400 hover:text-red-600"
                            title="Delete Team Group"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Members inside this Team Group */}
                      <div className="pt-2 space-y-1.5">
                        <div className="text-[11px] font-semibold text-slate-400">
                          Assigned Members ({teamMembers.length})
                        </div>
                        {teamMembers.length === 0 ? (
                          <div className="text-xs text-slate-400 py-2">
                            No members assigned yet.
                          </div>
                        ) : (
                          <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden">
                            {teamMembers.map((tm) => (
                              <div
                                key={tm.id}
                                className="flex items-center justify-between gap-2 px-3 py-2 text-xs bg-slate-50/50 dark:bg-slate-800/40"
                              >
                                <div className="min-w-0">
                                  <div className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                                    {tm.fullName}{' '}
                                    <span className="font-normal text-slate-500">
                                      · {tm.designation}
                                    </span>
                                  </div>
                                  <div className="font-mono text-[10px] text-slate-400 truncate">
                                    {tm.email}
                                  </div>
                                </div>
                                <select
                                  value={tm.teamId}
                                  onChange={(e) => handleQuickAssignTeam(tm, e.target.value)}
                                  className="px-2 py-1 text-[10px] rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                                  title="Move member to another team"
                                >
                                  {groups.map((g) => (
                                    <option key={g.id} value={g.id}>
                                      {g.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          resetMemberForm();
                          setTeamId(grp.id);
                          selectTab('add_member');
                        }}
                        className="text-xs font-semibold text-[#0B57D0] hover:underline flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Member to {grp.name}</span>
                      </button>

                      {onEmailTeamMembers && teamMembers.length > 0 && (
                        <button
                          type="button"
                          onClick={() => onEmailTeamMembers(teamMembers, grp.name)}
                          className="flex items-center gap-1 px-3 py-1 rounded-full bg-blue-50 text-[#0B57D0] text-[11px] font-semibold hover:bg-blue-100"
                        >
                          <Mail className="w-3 h-3" />
                          <span>Email Team ({teamMembers.length})</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ADD NEW MEMBER */}
      {subTab === 'add_member' && (
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 md:p-8 bg-slate-50/40 dark:bg-slate-950/30">
          <div className="max-w-3xl mx-auto pb-8">
            <form
              onSubmit={handleSaveMemberForm}
              className="rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-7 space-y-6 shadow-sm"
            >
              {/* Header Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#0B57D0] to-indigo-600 text-white flex items-center justify-center shadow-sm shrink-0">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100">
                      {editingMemberId ? 'Edit Team Member Profile' : 'Add New Workspace Member'}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Saved directly to the database with an automatic shareable profile invitation link.
                    </p>
                  </div>
                </div>
                {editingMemberId && (
                  <button
                    type="button"
                    onClick={resetMemberForm}
                    className="self-start sm:self-auto px-3 py-1.5 rounded-xl bg-blue-50 text-xs font-bold text-[#0B57D0] hover:bg-blue-100 transition-colors"
                  >
                    + Add New Instead
                  </button>
                )}
              </div>

              {/* Profile Avatar Linked with Server File Manager */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Member Avatar"
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-white dark:border-slate-700 shadow-sm shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#0B57D0] to-indigo-600 text-white font-extrabold text-xl flex items-center justify-center shadow-sm shrink-0">
                    {(firstName || 'M').charAt(0).toUpperCase()}
                    {lastName ? lastName.charAt(0).toUpperCase() : ''}
                  </div>
                )}
                <div className="space-y-2 flex-1">
                  <div>
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
                      Member Profile Avatar
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Upload a photo or select from your workspace file manager
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setIsFilePickerOpen(true)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0B57D0] hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-all"
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>Select / Upload Photo</span>
                    </button>
                    {avatarUrl && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setEditingAvatarTarget({
                              title: `${firstName || 'Member'} Avatar`,
                              imageUrl: avatarUrl,
                              defaultAspect: '1:1',
                            })
                          }
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 text-xs font-bold cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Crop / Edit Avatar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setAvatarUrl('')}
                          className="px-3 py-1.5 rounded-xl bg-red-50 text-xs font-semibold text-red-600 hover:bg-red-100"
                        >
                          Remove Photo
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Core Member Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 focus-within:bg-white dark:focus-within:bg-slate-900 focus-within:border-[#0B57D0] transition-all">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="e.g. Alex"
                    className="w-full px-3.5 py-2.5 text-sm font-medium rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 focus-within:bg-white dark:focus-within:bg-slate-900 focus-within:border-[#0B57D0] transition-all">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="e.g. Morgan"
                    className="w-full px-3.5 py-2.5 text-sm font-medium rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 focus-within:bg-white dark:focus-within:bg-slate-900 focus-within:border-[#0B57D0] transition-all">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="member@yourdomain.com"
                      className="w-full pl-10 pr-3.5 py-2.5 text-sm font-mono rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 focus-within:bg-white dark:focus-within:bg-slate-900 focus-within:border-[#0B57D0] transition-all">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                    Designation / Role <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Briefcase className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={designation}
                      onChange={(e) => setDesignation(e.target.value)}
                      placeholder="e.g. Senior Engineer, Operations Lead"
                      className="w-full pl-10 pr-3.5 py-2.5 text-sm font-medium rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 focus-within:bg-white dark:focus-within:bg-slate-900 focus-within:border-[#0B57D0] transition-all">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                    Assign to Team Group <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={teamId}
                    onChange={(e) => setTeamId(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm font-medium rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-900"
                  >
                    {groups.length === 0 && <option value="team-general">General Workspace Team</option>}
                    {groups.map((grp) => (
                      <option key={grp.id} value={grp.id}>
                        {grp.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 focus-within:bg-white dark:focus-within:bg-slate-900 focus-within:border-[#0B57D0] transition-all">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                    Phone / Contact Number
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+880 1XXX-XXXXXX"
                    className="w-full px-3.5 py-2.5 text-sm font-medium rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 focus-within:bg-white dark:focus-within:bg-slate-900 focus-within:border-[#0B57D0] transition-all">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                  Profile Bio / Role Responsibilities
                </label>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Brief description of responsibilities (visible on member's invitation profile)..."
                  className="w-full p-3.5 text-sm rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-900 leading-relaxed"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => selectTab('all_members')}
                  className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingMember}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#0B57D0] to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-blue-500/20 transition-all"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {isSavingMember
                      ? 'Saving Member...'
                      : editingMemberId
                      ? 'Save Member Changes'
                      : 'Add Member to Workspace'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Server File Manager Picker Modal for Member Avatar */}
      <FileManagerPickerModal
        isOpen={isFilePickerOpen}
        onClose={() => setIsFilePickerOpen(false)}
        defaultFolderId="folder-avatars"
        imagesOnly={true}
        title="Select or Upload Member Profile Photo (Auto-Compressed)"
        onSelectFile={(file) => setAvatarUrl(file.url)}
      />

      {editingAvatarTarget && (
        <Suspense fallback={null}>
          <ImageEditorModal
            isOpen={Boolean(editingAvatarTarget)}
            target={editingAvatarTarget}
            onClose={() => setEditingAvatarTarget(null)}
            onSaved={(res) => {
              setAvatarUrl(res.file?.url || res.dataUrl);
              setEditingAvatarTarget(null);
            }}
          />
        </Suspense>
      )}
    </div>
  );
};
