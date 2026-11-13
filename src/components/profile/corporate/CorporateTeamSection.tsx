import React, { useState } from 'react';
import {
  Users,
  Plus,
  Trash2,
  Mail,
  Linkedin,
  Camera,
  User,
  X,
  Check,
} from 'lucide-react';
import type { CorporateOrgProfileData } from '../../../services/workspaceApi';

interface CorporateTeamSectionProps {
  team: CorporateOrgProfileData['team'];
  isEditing: boolean;
  onChangeTeam: (team: CorporateOrgProfileData['team']) => void;
  onEditMemberAvatar: (memberId: string, currentUrl: string) => void;
}

export const CorporateTeamSection: React.FC<CorporateTeamSectionProps> = ({
  team,
  isEditing,
  onChangeTeam,
  onEditMemberAvatar,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newMember, setNewMember] = useState({
    name: '',
    role: '',
    avatarUrl: '',
    bio: '',
    email: '',
    linkedInUrl: '',
  });

  const handleOpenAddModal = () => {
    setNewMember({
      name: '',
      role: '',
      avatarUrl: '',
      bio: '',
      email: '',
      linkedInUrl: '',
    });
    setIsModalOpen(true);
  };

  const handleSaveNewMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMember.name.trim() || !newMember.role.trim()) return;

    const member = {
      id: `member-${Date.now()}`,
      ...newMember,
    };
    onChangeTeam([...(team || []), member]);
    setIsModalOpen(false);
  };

  const handleDeleteMember = (id: string) => {
    onChangeTeam((team || []).filter((m) => m.id !== id));
  };

  const handleUpdateMember = (
    id: string,
    field: keyof CorporateOrgProfileData['team'][0],
    val: string
  ) => {
    onChangeTeam(
      (team || []).map((m) => (m.id === id ? { ...m, [field]: val } : m))
    );
  };

  return (
    <section
      id="sec-org-team"
      aria-label="Executive Leadership Roster"
      className="space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
            Executive Leadership & Board of Governors
          </h2>
        </div>

        {isEditing && (
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Leader</span>
          </button>
        )}
      </div>

      {(!team || team.length === 0) ? (
        <div className="p-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 text-center space-y-2">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            No leadership members added yet.
          </p>
          {isEditing && (
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add First Leader</span>
            </button>
          )}
        </div>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {team.map((member) => (
          <div
            key={member.id}
            className="p-5 rounded-3xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-md hover:shadow-lg transition-all flex flex-col items-center text-center group"
          >
            {/* Avatar Frame with Edit Trigger */}
            <div className="relative group/avatar mb-3">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 border-2 border-white dark:border-slate-800 shadow-md overflow-hidden flex items-center justify-center">
                {member.avatarUrl ? (
                  <img
                    src={member.avatarUrl}
                    alt={member.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-8 h-8 text-slate-400" />
                )}
              </div>

              {isEditing && (
                <button
                  type="button"
                  onClick={() =>
                    onEditMemberAvatar(member.id, member.avatarUrl || '')
                  }
                  title="Change Member Photo"
                  className="absolute inset-0 bg-slate-900/60 rounded-2xl flex flex-col items-center justify-center text-white text-[10px] font-bold opacity-0 group-hover/avatar:opacity-100 transition-opacity cursor-pointer"
                >
                  <Camera className="w-4 h-4 mb-0.5" />
                  <span>Edit</span>
                </button>
              )}
            </div>

            {/* Name & Role */}
            {isEditing ? (
              <div className="space-y-1.5 w-full mb-2">
                <input
                  type="text"
                  value={member.name}
                  onChange={(e) =>
                    handleUpdateMember(member.id, 'name', e.target.value)
                  }
                  className="w-full text-xs font-bold text-center px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  placeholder="Leader Name"
                />
                <input
                  type="text"
                  value={member.role}
                  onChange={(e) =>
                    handleUpdateMember(member.id, 'role', e.target.value)
                  }
                  className="w-full text-[11px] text-center px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-blue-600"
                  placeholder="Designation"
                />
              </div>
            ) : (
              <div className="mb-2">
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  {member.name}
                </h3>
                <span className="inline-block mt-0.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/50">
                  {member.role}
                </span>
              </div>
            )}

            {/* Bio */}
            {isEditing ? (
              <textarea
                rows={2}
                value={member.bio || ''}
                onChange={(e) =>
                  handleUpdateMember(member.id, 'bio', e.target.value)
                }
                className="w-full text-[11px] p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 mb-2"
                placeholder="Executive biography / tenure..."
              />
            ) : (
              member.bio && (
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-3 mb-3 leading-relaxed">
                  {member.bio}
                </p>
              )
            )}

            {/* Social / Direct Contacts */}
            <div className="flex items-center gap-2 mt-auto pt-2 border-t border-slate-100 dark:border-slate-800 w-full justify-center">
              {member.email && (
                <a
                  href={`mailto:${member.email}`}
                  title={member.email}
                  className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-blue-600 transition-colors"
                >
                  <Mail className="w-3.5 h-3.5" />
                </a>
              )}
              {member.linkedInUrl && (
                <a
                  href={member.linkedInUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="LinkedIn Profile"
                  className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-blue-600 transition-colors"
                >
                  <Linkedin className="w-3.5 h-3.5" />
                </a>
              )}
              {isEditing && (
                <button
                  type="button"
                  onClick={() => handleDeleteMember(member.id)}
                  title="Remove Team Member"
                  className="p-1.5 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      )}

      {/* Add Team Member Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Add Executive Leader
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNewMember} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-500">Full Name *</label>
                <input
                  type="text"
                  required
                  value={newMember.name}
                  onChange={(e) =>
                    setNewMember({ ...newMember, name: e.target.value })
                  }
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  placeholder="e.g. Dr. Eleanor Vance"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500">Designation / Role *</label>
                <input
                  type="text"
                  required
                  value={newMember.role}
                  onChange={(e) =>
                    setNewMember({ ...newMember, role: e.target.value })
                  }
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  placeholder="e.g. Chief Operations Officer"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500">Photo URL</label>
                <input
                  type="text"
                  value={newMember.avatarUrl}
                  onChange={(e) =>
                    setNewMember({ ...newMember, avatarUrl: e.target.value })
                  }
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500">Brief Bio</label>
                <textarea
                  rows={2}
                  value={newMember.bio}
                  onChange={(e) =>
                    setNewMember({ ...newMember, bio: e.target.value })
                  }
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  placeholder="Executive background..."
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-500">Email</label>
                  <input
                    type="email"
                    value={newMember.email}
                    onChange={(e) =>
                      setNewMember({ ...newMember, email: e.target.value })
                    }
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    placeholder="leader@org.com"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500">LinkedIn URL</label>
                  <input
                    type="text"
                    value={newMember.linkedInUrl}
                    onChange={(e) =>
                      setNewMember({ ...newMember, linkedInUrl: e.target.value })
                    }
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    placeholder="https://linkedin.com/in/..."
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Member</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
