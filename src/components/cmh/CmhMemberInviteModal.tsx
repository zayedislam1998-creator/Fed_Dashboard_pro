import React, { useState, useEffect } from 'react';
import {
  Users,
  Send,
  Copy,
  Check,
  Search,
  X,
  Layers,
  Link2,
} from 'lucide-react';
import {
  WorkspaceMemberItem,
  WorkspaceTeamGroup,
  searchMembersInstant,
  sendCmhMemberInvitations,
  sendGmailMessage,
} from '../../services/workspaceApi';

interface CmhMemberInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: 'form' | 'task' | 'project';
  targetId: string;
  targetTitle: string;
  initialMemberIds?: string[];
  initialTeamIds?: string[];
  members: WorkspaceMemberItem[];
  teamGroups: WorkspaceTeamGroup[];
  isAuthenticated?: boolean;
  onSuccess?: (result: {
    invitedCount: number;
    shareUrl: string;
    forms: any[];
    tasks: any[];
    projects: any[];
  }) => void;
}

export const CmhMemberInviteModal: React.FC<CmhMemberInviteModalProps> = ({
  isOpen,
  onClose,
  targetType,
  targetId,
  targetTitle,
  initialMemberIds = [],
  initialTeamIds = [],
  members,
  teamGroups,
  isAuthenticated = false,
  onSuccess,
}) => {
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(initialMemberIds);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>(initialTeamIds);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [customMessage, setCustomMessage] = useState<string>(
    `Please review "${targetTitle}" and submit your update using the direct link below.`
  );
  const [isSending, setIsSending] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedMemberIds(initialMemberIds);
      setSelectedTeamIds(initialTeamIds);
      setCustomMessage(
        `Please review "${targetTitle}" and submit your update using the direct link below.`
      );
      setStatusBanner(null);
    }
  }, [isOpen, targetId, targetTitle]);

  if (!isOpen) return null;

  const shareUrl = `${window.location.origin}/?cmh=${targetType}:${targetId}`;
  const filteredMembers = searchMembersInstant(searchQuery, members);

  const toggleMember = (id: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleTeamGroup = (teamId: string) => {
    const exists = selectedTeamIds.includes(teamId);
    const nextTeams = exists
      ? selectedTeamIds.filter((x) => x !== teamId)
      : [...selectedTeamIds, teamId];
    setSelectedTeamIds(nextTeams);

    // Also auto-select/deselect members belonging to that team group
    const teamMemberIds = members.filter((m) => m.teamId === teamId).map((m) => m.id);
    if (!exists) {
      setSelectedMemberIds((prev) => Array.from(new Set([...prev, ...teamMemberIds])));
    } else {
      setSelectedMemberIds((prev) => prev.filter((id) => !teamMemberIds.includes(id)));
    }
  };

  const selectAllMembers = () => {
    if (selectedMemberIds.length === members.length) {
      setSelectedMemberIds([]);
      setSelectedTeamIds([]);
    } else {
      setSelectedMemberIds(members.map((m) => m.id));
      setSelectedTeamIds(teamGroups.map((g) => g.id));
    }
  };

  const handleCopyShareLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleSendInvitations = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);
    setStatusBanner(null);
    try {
      const res = await sendCmhMemberInvitations({
        targetType,
        targetId,
        memberIds: selectedMemberIds,
        teamIds: selectedTeamIds,
        customMessage,
      });

      // Also send via connected Gmail if authenticated
      if (isAuthenticated) {
        const recipients = members.filter(
          (m) =>
            selectedMemberIds.includes(m.id) || selectedTeamIds.includes(m.teamId)
        );
        for (const rec of recipients) {
          try {
            await sendGmailMessage({
              to: rec.email,
              subject: `Invitation: ${targetTitle} (${targetType.toUpperCase()})`,
              bodyHtml: `<div style="font-family:sans-serif;max-width:580px;padding:18px;border:1px solid #e2e8f0;border-radius:12px;">
                <h2 style="margin:0 0 8px 0;color:#0f172a;">${targetTitle}</h2>
                <p style="font-size:13px;color:#334155;">${customMessage}</p>
                <p style="margin-top:16px;"><a href="${shareUrl}" target="_blank" style="display:inline-block;padding:10px 18px;background:#0B57D0;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:12px;">Open Direct Link â†’</a></p>
              </div>`,
            });
          } catch {
            // Server Mail SMTP / backend already handled
          }
        }
      }

      setStatusBanner(
        `Sent direct link and invitations to ${res.invitedCount} member(s)!`
      );
      onSuccess?.(res);
      setTimeout(() => {
        onClose();
      }, 1100);
    } catch (err: any) {
      setStatusBanner(err?.message || 'Failed to send invitations.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[2px] p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-[#F8FAFD] dark:bg-slate-800/70">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
              Invite Members & Share Link â€” {targetTitle}
            </h3>
            <p className="text-[11px] text-slate-500">
              Select individual members or entire Team Groups to send the direct{' '}
              {targetType.toUpperCase()} link
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSendInvitations} className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Individual Link Box */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Link2 className="w-4 h-4 text-[#0B57D0] shrink-0" />
              <span className="text-xs font-mono text-slate-700 dark:text-slate-200 truncate">
                {shareUrl}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopyShareLink}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-[#0B57D0] hover:bg-blue-50 shrink-0"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Link</span>
                </>
              )}
            </button>
          </div>

          {/* Team Group Category Selection */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#0B57D0]" />
                <span>Select by Team Category / Group</span>
              </span>
              <button
                type="button"
                onClick={selectAllMembers}
                className="text-[11px] font-semibold text-[#0B57D0] hover:underline"
              >
                {selectedMemberIds.length === members.length
                  ? 'Clear All'
                  : `Select All Members (${members.length})`}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {teamGroups.map((grp) => {
                const active = selectedTeamIds.includes(grp.id);
                const count = members.filter((m) => m.teamId === grp.id).length;
                return (
                  <button
                    key={grp.id}
                    type="button"
                    onClick={() => toggleTeamGroup(grp.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                      active
                        ? 'bg-[#0B57D0] text-white border-[#0B57D0]'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-500'
                    }`}
                  >
                    {grp.name} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* 1-Character Instant Member Search & Multi-Select */}
          <div className="space-y-2">
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl px-3 py-2">
              <Search className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type 1+ letter to filter members by name, role, or email..."
                className="w-full bg-transparent text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
              {filteredMembers.map((mem) => {
                const checked = selectedMemberIds.includes(mem.id);
                return (
                  <label
                    key={mem.id}
                    className="flex items-center justify-between px-3.5 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleMember(mem.id)}
                        className="rounded text-[#0B57D0]"
                      />
                      <div className="min-w-0">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {mem.fullName}
                        </span>
                        <span className="text-slate-500 ml-1.5">Â· {mem.designation}</span>
                        <div className="text-[11px] font-mono text-slate-400 truncate">
                          {mem.email} Â· {mem.teamName}
                        </div>
                      </div>
                    </div>
                    {checked && (
                      <span className="text-[11px] font-semibold text-[#0B57D0] shrink-0">
                        Selected
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Custom Invitation Message */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
              Invitation Note (Sent via Email with Direct Link)
            </label>
            <textarea
              rows={2}
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600 resize-none"
            />
          </div>

          {statusBanner && (
            <div className="px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
              {statusBanner}
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-xs text-slate-500">
              <Users className="w-3.5 h-3.5 inline mr-1 text-[#0B57D0]" />
              {selectedMemberIds.length} member(s) selected
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0B57D0] hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold"
              >
                <Send className="w-3.5 h-3.5" />
                <span>
                  {`Save & Send Link (${selectedMemberIds.length})`}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

