import React, { useEffect, useState } from 'react';
import { Users, Briefcase } from 'lucide-react';
import {
  WorkspaceMemberItem,
  WorkspaceTeamGroup,
  getCachedMembersSync,
  fetchWorkspaceTeamsAndMembers,
  searchMembersInstant,
} from '../services/workspaceApi';

interface MemberAutocompleteDropdownProps {
  inputValue: string;
  onSelectEmails: (newVal: string, selectedMember?: WorkspaceMemberItem) => void;
  isFocused?: boolean;
}

export const MemberAutocompleteDropdown: React.FC<MemberAutocompleteDropdownProps> = ({
  inputValue,
  onSelectEmails,
  isFocused = true,
}) => {
  const [members, setMembers] = useState<WorkspaceMemberItem[]>(
    () => getCachedMembersSync().members
  );
  const [groups, setGroups] = useState<WorkspaceTeamGroup[]>(
    () => getCachedMembersSync().groups
  );

  useEffect(() => {
    if (members.length === 0) {
      fetchWorkspaceTeamsAndMembers()
        .then((res) => {
          setMembers(res.members);
          setGroups(res.groups);
        })
        .catch(() => {});
    }
  }, []);

  if (!isFocused) return null;

  // Extract the current last token after comma, semicolon, or newline
  const parts = inputValue.split(/([,;\n]+)/);
  const currentToken = (parts[parts.length - 1] || '').trim();

  // Trigger even when 1 character is typed!
  if (currentToken.length < 1) return null;

  const q = currentToken.toLowerCase();
  const matchedMembers = searchMembersInstant(q, members).slice(0, 6);
  const matchedGroups = groups.filter(
    (g) =>
      g.name.toLowerCase().includes(q) ||
      g.description.toLowerCase().includes(q)
  );

  if (matchedMembers.length === 0 && matchedGroups.length === 0) return null;

  const replaceLastTokenWithEmails = (emailsToInsert: string[], memberObj?: WorkspaceMemberItem) => {
    const prefixParts = parts.slice(0, parts.length - 1).join('');
    const existingEmails = new Set(
      prefixParts
        .split(/[\s,;]+/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    );
    const deduped = emailsToInsert.filter((e) => !existingEmails.has(e.toLowerCase()));
    const joined = deduped.join(', ');
    const nextValue = prefixParts
      ? `${prefixParts.replace(/\s*$/, '')} ${joined}, `
      : `${joined}, `;
    onSelectEmails(nextValue, memberObj);
  };

  return (
    <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden max-h-56 overflow-y-auto text-xs">
      {matchedGroups.length > 0 && (
        <div className="border-b border-slate-100 dark:border-slate-800">
          <div className="px-3 py-1 bg-slate-50 dark:bg-slate-800/80 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Team Groups (Click to add entire team)
          </div>
          {matchedGroups.map((grp) => {
            const grpMembers = members.filter((m) => m.teamId === grp.id);
            return (
              <button
                key={grp.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (grpMembers.length > 0) {
                    replaceLastTokenWithEmails(grpMembers.map((m) => m.email));
                  }
                }}
                className="w-full text-left px-3 py-2 hover:bg-blue-50/70 dark:hover:bg-slate-800 flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Users className="w-3.5 h-3.5 text-[#0B57D0] shrink-0" />
                  <span className="font-bold text-slate-800 dark:text-slate-100 truncate">
                    {grp.name}
                  </span>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-[#0B57D0] shrink-0">
                  {grpMembers.length} member(s)
                </span>
              </button>
            );
          })}
        </div>
      )}

      {matchedMembers.length > 0 && (
        <div>
          <div className="px-3 py-1 bg-slate-50 dark:bg-slate-800/80 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Matching Workspace Members
          </div>
          {matchedMembers.map((mem) => (
            <button
              key={mem.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                replaceLastTokenWithEmails([mem.email], mem);
              }}
              className="w-full text-left px-3 py-2 hover:bg-blue-50/70 dark:hover:bg-slate-800 flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-full bg-[#0B57D0] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                  {mem.firstName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {mem.fullName}{' '}
                    <span className="font-normal text-slate-500">· {mem.designation}</span>
                  </div>
                  <div className="font-mono text-[11px] text-[#0B57D0] truncate">{mem.email}</div>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                <Briefcase className="w-2.5 h-2.5" />
                {mem.teamName}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
