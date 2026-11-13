import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MessageCircle,
  X,
  Maximize2,
  Send,
  User,
} from 'lucide-react';
import {
  CommunicationConversationItem,
  CommunicationMessageItem,
  fetchCommunicationConversations,
  fetchCommunicationMessages,
  sendCommunicationMessage,
  markCommunicationMessagesRead,
} from '../../services/workspaceApi';
import { emitLocalWorkspaceEvent, subscribeWorkspaceEvents } from '../../services/realtimeBus';

interface FloatingMessengerWidgetProps {
  currentUserId: string;
  currentUserRole?: string;
  onNavigateToCommunication: () => void;
  isCurrentViewCommunication?: boolean;
}

export const FloatingMessengerWidget: React.FC<FloatingMessengerWidgetProps> = ({
  currentUserId,
  onNavigateToCommunication,
  isCurrentViewCommunication = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [conversations, setConversations] = useState<CommunicationConversationItem[]>([]);
  const [activeConv, setActiveConv] = useState<CommunicationConversationItem | null>(null);
  const [messages, setMessages] = useState<CommunicationMessageItem[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);

  const activeConvIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeConvIdRef.current = activeConv?.id || null;
  }, [activeConv?.id]);

  const loadConversations = useCallback(async () => {
    try {
      const list = await fetchCommunicationConversations();
      setConversations(list);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Subscribe to real-time message & member roster updates
  useEffect(() => {
    const unsubscribe = subscribeWorkspaceEvents((eventName, payload) => {
      if (eventName === 'communication:message:new' && payload?.message) {
        const incoming: CommunicationMessageItem = payload.message;
        const isCurrentOpenChat = isOpen && activeConvIdRef.current === incoming.conversationId;

        if (isCurrentOpenChat) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === incoming.id)) return prev;
            return [...prev, incoming];
          });
          if (incoming.recipientId === currentUserId) {
            markCommunicationMessagesRead(incoming.conversationId).catch(() => {});
          }
        }

        setConversations((prev) => {
          const exists = prev.some((c) => c.id === incoming.conversationId);
          if (!exists) {
            loadConversations();
            return prev;
          }
          return prev.map((c) => {
            if (c.id !== incoming.conversationId) return c;
            const shouldInc = incoming.recipientId === currentUserId && !isCurrentOpenChat;
            return {
              ...c,
              lastMessageText: incoming.text || c.lastMessageText,
              lastMessageTimestampMs: incoming.timestampMs || Date.now(),
              unreadCount: shouldInc ? (c.unreadCount || 0) + 1 : isCurrentOpenChat ? 0 : c.unreadCount,
            };
          });
        });
      } else if (eventName === 'communication:message:read' && payload?.conversationId) {
        if (payload.readerId === currentUserId) {
          setConversations((prev) =>
            prev.map((c) => (c.id === payload.conversationId ? { ...c, unreadCount: 0 } : c))
          );
        }
      } else if (eventName === 'members:updated' || eventName === 'auth:permissions_updated') {
        loadConversations();
      }
    });

    return unsubscribe;
  }, [currentUserId, isOpen, loadConversations]);

  if (isCurrentViewCommunication) return null;

  const handleSelectConversation = async (conv: CommunicationConversationItem) => {
    setActiveConv(conv);
    activeConvIdRef.current = conv.id;
    try {
      const msgs = await fetchCommunicationMessages(conv.id);
      setMessages(msgs);
      if (conv.unreadCount > 0) {
        await markCommunicationMessagesRead(conv.id);
        setConversations((prev) =>
          prev.map((c) => (c.id === conv.id ? { ...c, unreadCount: 0 } : c))
        );
        emitLocalWorkspaceEvent('communication:message:read', {
          conversationId: conv.id,
          readerId: currentUserId,
        });
      }
    } catch {
      // ignore
    }
  };

  const handleQuickSend = async () => {
    if (!activeConv || !inputText.trim() || isSending) return;
    const textToSend = inputText.trim();
    setInputText('');
    setIsSending(true);

    try {
      const sent = await sendCommunicationMessage({
        conversationId: activeConv.id,
        recipientId: activeConv.partner.id,
        text: textToSend,
      });
      setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));
      emitLocalWorkspaceEvent('communication:message:new', {
        message: sent,
        conversationId: activeConv.id,
        recipientId: activeConv.partner.id,
        senderId: currentUserId,
      });
      loadConversations();
    } catch {
      // restore input on failure
      setInputText(textToSend);
    } finally {
      setIsSending(false);
    }
  };

  const totalUnreadCount = conversations.reduce(
    (acc, curr) => acc + (curr.unreadCount || 0),
    0
  );

  return (
    <div className="fixed z-40 select-none print:hidden bottom-16 md:bottom-6 right-3 md:right-6 flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="flex flex-col w-[calc(100vw-24px)] sm:w-88 h-[410px] sm:h-[440px] rounded-3xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xl mb-3 overflow-hidden"
          >
            <div className="px-4 py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                {activeConv ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setActiveConv(null)}
                      className="text-white/90 hover:text-white text-xs font-bold mr-1 px-1.5 py-0.5 rounded-lg bg-white/10 cursor-pointer"
                    >
                      ←
                    </button>
                    <span className="font-bold text-xs truncate">
                      {activeConv.partner.name}
                    </span>
                  </>
                ) : (
                  <>
                    <MessageCircle className="w-4 h-4" />
                    <span className="font-bold text-xs">Direct Messenger</span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-white/80">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onNavigateToCommunication();
                  }}
                  className="p-1.5 rounded-lg hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
                  title="Full Screen View"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
                  title="Close"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {activeConv ? (
              <div className="flex-1 flex flex-col min-h-0 bg-slate-50/50 dark:bg-slate-950/40">
                <div className="flex-1 overflow-y-auto p-3 space-y-2 text-xs">
                  {messages.map((m) => {
                    const isMine = m.senderId === currentUserId;
                    return (
                      <motion.div
                        key={m.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex flex-col ${
                          isMine ? 'items-end' : 'items-start'
                        }`}
                      >
                        <div
                          className={`max-w-[85%] px-3 py-1.5 rounded-2xl text-xs break-words shadow-2xs ${
                            isMine
                              ? 'bg-blue-600 text-white rounded-tr-xs'
                              : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/60 dark:border-slate-700 rounded-tl-xs'
                          }`}
                        >
                          <p>{m.text}</p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                <div className="p-2 border-t border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-1.5">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleQuickSend()}
                    placeholder="Type a message..."
                    className="flex-1 text-xs px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 outline-none text-slate-900 dark:text-white placeholder:text-slate-400"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleQuickSend}
                    disabled={!inputText.trim() || isSending}
                    className="p-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
                {conversations.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    No other members yet. Add a member in Teams or Admin Panel to message them immediately.
                  </div>
                ) : (
                  conversations.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => handleSelectConversation(c)}
                      className="flex items-center gap-2.5 p-3 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
                    >
                      <div className="relative shrink-0">
                        <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden">
                          {c.partner.avatarUrl ? (
                            <img
                              src={c.partner.avatarUrl}
                              alt={c.partner.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <User className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                        <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-1 ring-white" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                            {c.partner.name}
                          </span>
                          {c.unreadCount > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full bg-emerald-600 text-white text-[9px] font-bold">
                              {c.unreadCount}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 truncate">
                          {c.lastMessageText || `${c.partner.role} · Tap to message`}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.94 }}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative group flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-xl shadow-blue-600/30 hover:shadow-blue-600/50 transition-all cursor-pointer"
        title="Open Workspace Direct Messenger"
      >
        <div className="relative flex items-center justify-center">
          <MessageCircle className="w-5 h-5" />
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-blue-600 animate-pulse" />
        </div>
        <span className="hidden sm:inline tracking-tight">Messenger</span>

        {totalUnreadCount > 0 && (
          <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black shadow-sm animate-bounce">
            {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
          </span>
        )}
      </motion.button>
    </div>
  );
};
