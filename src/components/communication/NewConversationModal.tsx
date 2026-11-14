import React, { useState, useEffect } from 'react';
import { Search, X, User, MessageCircle, Shield } from 'lucide-react';
import {
  CommunicationMemberItem,
  fetchCommunicationMembersList,
} from '../../services/workspaceApi';

interface NewConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMember: (memberId: string) => void;
}

export const NewConversationModal: React.FC<NewConversationModalProps> = ({
  isOpen,
  onClose,
  onSelectMember,
}) => {
  const [members, setMembers] = useState<CommunicationMemberItem[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      fetchCommunicationMembersList()
        .then((list) => setMembers(list))
        .finally(() => setIsLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filtered = members.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.role.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase()) ||
      (m.teamName && m.teamName.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs   duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Start Direct Message
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-slate-100 dark:border-slate-800/80">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, role or team..."
              className="w-full text-xs pl-9 pr-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border-none outline-none text-slate-900 dark:text-white placeholder:text-slate-400"
              autoFocus
            />
          </div>
        </div>

        {/* Member Directory List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 p-2">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No matching members found.
            </div>
          ) : (
            filtered.map((m) => (
              <div
                key={m.id}
                onClick={() => {
                  onSelectMember(m.id);
                  onClose();
                }}
                className="flex items-center justify-between p-2.5 rounded-2xl hover:bg-blue-50/80 dark:hover:bg-slate-800/70 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-slate-200 to-slate-300 dark:from-slate-800 dark:to-slate-700 overflow-hidden flex items-center justify-center shrink-0">
                    {m.avatarUrl ? (
                      <img
                        src={m.avatarUrl}
                        alt={m.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {m.name}
                      </h4>
                      {m.isUser && (
                        <span className="p-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300" title="Administrator">
                          <Shield className="w-2.5 h-2.5" />
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {m.role} {m.teamName ? `• ${m.teamName}` : ''}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  className="px-3 py-1 rounded-xl bg-blue-600 text-white text-xs font-semibold shrink-0"
                >
                  Chat
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
