import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  Plus,
  User,
  X,
  MessageSquare,
} from 'lucide-react';
import type { CommunicationConversationItem } from '../../services/workspaceApi';

interface ConversationListSidebarProps {
  conversations: CommunicationConversationItem[];
  activeConversationId: string | null;
  onSelectConversation: (conv: CommunicationConversationItem) => void;
  onOpenNewChatModal: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activeFilter: 'all' | 'direct' | 'unread';
  onFilterChange: (f: 'all' | 'direct' | 'unread') => void;
}

export const ConversationListSidebar: React.FC<ConversationListSidebarProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  onOpenNewChatModal,
  searchQuery,
  onSearchChange,
  activeFilter,
  onFilterChange,
}) => {
  // Filter logic
  const filtered = conversations.filter((c) => {
    const matchesSearch =
      c.partner.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.partner.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.lastMessageText.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeFilter === 'unread') return c.unreadCount > 0;
    return true;
  });

  const totalUnreadCount = conversations.reduce(
    (acc, curr) => acc + (curr.unreadCount || 0),
    0
  );

  const formatConversationTime = (ts: number) => {
    if (!ts) return '';
    const date = new Date(ts);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="flex flex-col h-full w-full md:w-80 lg:w-96 border-r border-slate-200/80 dark:border-slate-800 bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl shrink-0">
      {/* Top Header & New Chat Action */}
      <div className="p-3.5 pb-2.5 border-b border-slate-200/60 dark:border-slate-800/80 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
              Messages
            </h2>
            <AnimatePresence>
              {totalUnreadCount > 0 && (
                <motion.span
                  initial={false}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.7, opacity: 0 }}
                  className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold"
                >
                  {totalUnreadCount} unread
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            type="button"
            onClick={onOpenNewChatModal}
            className="flex items-center gap-1.5 px-3.5 py-2 sm:py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            title="Start new direct conversation"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Chat</span>
          </motion.button>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search conversations & people..."
            className="w-full text-xs pl-9 pr-8 py-2.5 sm:py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-blue-500 text-slate-900 dark:text-white placeholder:text-slate-400 outline-none transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 pt-0.5">
          {(['all', 'direct', 'unread'] as const).map((tab) => {
            const isTabActive = activeFilter === tab;
            const label = tab === 'all' ? 'All' : tab === 'direct' ? 'Direct' : 'Unread';
            return (
              <motion.button
                key={tab}
                whileTap={{ scale: 0.95 }}
                type="button"
                onClick={() => onFilterChange(tab)}
                className={`relative px-3.5 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  isTabActive
                    ? tab === 'unread'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span>{label}</span>
                {tab === 'unread' && totalUnreadCount > 0 && (
                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] ${
                      isTabActive
                        ? 'bg-white text-emerald-600'
                        : 'bg-emerald-600 text-white'
                    }`}
                  >
                    {totalUnreadCount}
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Conversations Feed */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 pb-14 md:pb-0">
        {filtered.length === 0 ? (
          <motion.div
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            className="p-8 text-center text-slate-400 space-y-2"
          >
            <MessageSquare className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
            <p className="text-xs font-semibold">No conversations found</p>
            <p className="text-[11px] text-slate-400">
              Tap &ldquo;+ New Chat&rdquo; to start a direct message with any workspace member.
            </p>
          </motion.div>
        ) : (
          filtered.map((conv, idx) => {
            const isActive = activeConversationId === conv.id;
            const hasUnread = conv.unreadCount > 0;

            return (
              <motion.div
                key={conv.id}
                initial={false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, delay: Math.min(idx * 0.03, 0.25) }}
                whileTap={{ scale: 0.99 }}
                onClick={() => onSelectConversation(conv)}
                className={`relative flex items-center gap-3 p-3.5 sm:p-3 sm:px-3.5 transition-all cursor-pointer select-none ${
                  isActive
                    ? 'bg-blue-50/90 dark:bg-blue-950/40 border-l-3 border-blue-600'
                    : 'hover:bg-slate-100/60 dark:hover:bg-slate-800/50 active:bg-slate-100 dark:active:bg-slate-800'
                }`}
              >
                {/* Avatar with Presence Indicator */}
                <div className="relative shrink-0">
                  <div className="w-11 h-11 sm:w-10 sm:h-10 rounded-full bg-gradient-to-tr from-slate-200 to-slate-300 dark:from-slate-800 dark:to-slate-700 overflow-hidden flex items-center justify-center border border-white dark:border-slate-800 shadow-2xs">
                    {conv.partner.avatarUrl ? (
                      <img
                        src={conv.partner.avatarUrl}
                        alt={conv.partner.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                  {/* Green Online Dot */}
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
                </div>

                {/* Conversation Meta & Last Message */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <h3
                      className={`text-sm truncate ${
                        hasUnread
                          ? 'font-black text-slate-900 dark:text-white'
                          : 'font-semibold text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {conv.partner.name}
                    </h3>
                    <span className="text-[10px] text-slate-400 shrink-0 ml-1">
                      {formatConversationTime(conv.lastMessageTimestampMs)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <p
                      className={`text-xs truncate ${
                        hasUnread
                          ? 'font-bold text-slate-900 dark:text-white'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {conv.lastMessageText || 'Started a conversation'}
                    </p>

                    {/* Unread Counter Pill */}
                    {hasUnread && (
                      <motion.span
                        initial={{ scale: 0.6 }}
                        animate={{ scale: 1 }}
                        className="shrink-0 ml-2 px-1.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-black shadow-xs"
                      >
                        {conv.unreadCount}
                      </motion.span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
};
