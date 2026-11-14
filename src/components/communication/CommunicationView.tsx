import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CommunicationConversationItem,
  CommunicationMessageItem,
  CommunicationAttachment,
  fetchCommunicationConversations,
  getOrCreateDirectConversation,
  fetchCommunicationMessages,
  sendCommunicationMessage,
  markCommunicationMessagesRead,
} from '../../services/workspaceApi';
import { emitLocalWorkspaceEvent, subscribeWorkspaceEvents } from '../../services/realtimeBus';
import { ConversationListSidebar } from './ConversationListSidebar';
import { ChatThreadCanvas } from './ChatThreadCanvas';
import { NewConversationModal } from './NewConversationModal';
import { MessageSquare, ShieldCheck } from 'lucide-react';
import type { UniversalEngineTarget } from '../shared/UniversalDocumentEngineModal';

const UniversalDocumentEngineModal = lazy(() =>
  import('../shared/UniversalDocumentEngineModal').then((m) => ({
    default: m.UniversalDocumentEngineModal,
  }))
);

const FileManagerPickerModal = lazy(() =>
  import('../filemanager/FileManagerPickerModal').then((m) => ({
    default: m.FileManagerPickerModal,
  }))
);

interface CommunicationViewProps {
  currentUserId: string;
  currentUserRole?: string;
  initialTargetUserId?: string | null;
}

export const CommunicationView: React.FC<CommunicationViewProps> = ({
  currentUserId,
  currentUserRole = 'ADMIN',
  initialTargetUserId,
}) => {
  const isAdmin = currentUserRole === 'OWNER' || currentUserRole === 'ADMIN';

  const [conversations, setConversations] = useState<CommunicationConversationItem[]>([]);
  const [activeConversation, setActiveConversation] = useState<CommunicationConversationItem | null>(null);
  const [messages, setMessages] = useState<CommunicationMessageItem[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'direct' | 'unread'>('all');
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [isFileManagerPickerOpen, setIsFileManagerPickerOpen] = useState(false);
  const [universalDocTarget, setUniversalDocTarget] = useState<UniversalEngineTarget | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const activeConvIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeConvIdRef.current = activeConversation?.id || null;
  }, [activeConversation?.id]);

  // Load conversations silently without page flicker
  const loadConversations = useCallback(async () => {
    try {
      const list = await fetchCommunicationConversations();
      setConversations(list);
      setActiveConversation((prev) => {
        if (!prev) return null;
        const updated = list.find((c) => c.id === prev.id);
        return updated ? { ...prev, partner: updated.partner } : prev;
      });
      return list;
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Load messages when active conversation changes
  const handleSelectConversation = useCallback(
    async (conv: CommunicationConversationItem) => {
      setActiveConversation(conv);
      activeConvIdRef.current = conv.id;
      setIsLoadingMessages(true);
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
      } finally {
        setIsLoadingMessages(false);
      }
    },
    [currentUserId]
  );

  // Handle direct conversation switch from prop (e.g. Teams "Message" click)
  useEffect(() => {
    if (initialTargetUserId && initialTargetUserId !== currentUserId) {
      getOrCreateDirectConversation(initialTargetUserId)
        .then(async (conv) => {
          const list = await loadConversations();
          const found = list.find((c) => c.id === conv.id);
          if (found) {
            handleSelectConversation(found);
          }
        })
        .catch(() => {});
    }
  }, [initialTargetUserId, currentUserId, loadConversations, handleSelectConversation]);

  // Event-driven real-time listener (Zero polling, zero page reload)
  useEffect(() => {
    const unsubscribe = subscribeWorkspaceEvents((eventName, payload) => {
      if (eventName === 'communication:message:new' && payload?.message) {
        const incoming: CommunicationMessageItem = payload.message;
        const isCurrentThread = activeConvIdRef.current === incoming.conversationId;

        if (isCurrentThread) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === incoming.id)) return prev;
            return [...prev, incoming];
          });

          if (incoming.recipientId === currentUserId) {
            markCommunicationMessagesRead(incoming.conversationId).catch(() => {});
          }
        }

        // Update conversation snippet & unread count in-place
        setConversations((prev) => {
          const exists = prev.some((c) => c.id === incoming.conversationId);
          if (!exists) {
            loadConversations();
            return prev;
          }
          return prev.map((c) => {
            if (c.id !== incoming.conversationId) return c;
            const shouldIncrementUnread =
              incoming.recipientId === currentUserId && !isCurrentThread;
            return {
              ...c,
              lastMessageText:
                incoming.text ||
                (incoming.attachments?.length ? incoming.attachments[0].name || 'Attachment' : c.lastMessageText),
              lastMessageTimestampMs: incoming.timestampMs || Date.now(),
              unreadCount: shouldIncrementUnread ? (c.unreadCount || 0) + 1 : isCurrentThread ? 0 : c.unreadCount,
            };
          });
        });
      } else if (eventName === 'communication:message:read' && payload?.conversationId) {
        if (activeConvIdRef.current === payload.conversationId) {
          setMessages((prev) =>
            prev.map((m) =>
              m.senderId === currentUserId ? { ...m, isRead: true, status: 'READ' } : m
            )
          );
        }
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
  }, [currentUserId, loadConversations]);

  // Send Message Handler
  const handleSendMessage = async (
    text: string,
    attachments?: CommunicationAttachment[],
    replyToId?: string,
    replySnippet?: string
  ) => {
    if (!activeConversation) return;
    setErrorBanner(null);

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: CommunicationMessageItem = {
      id: tempId,
      conversationId: activeConversation.id,
      senderId: currentUserId,
      senderName: 'You',
      senderRole: currentUserRole,
      recipientId: activeConversation.partner.id,
      text,
      attachments: attachments || [],
      status: 'SENT',
      isRead: false,
      replyToId,
      replySnippet,
      reactions: {},
      isPinned: false,
      createdAt: new Date().toISOString(),
      timestampMs: Date.now(),
    };

    setMessages((prev) => [...prev, optimisticMessage]);

    try {
      const realMessage = await sendCommunicationMessage({
        conversationId: activeConversation.id,
        recipientId: activeConversation.partner.id,
        text,
        attachments,
        replyToId,
        replySnippet,
      });

      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== tempId && m.id !== realMessage.id);
        return [...withoutTemp, realMessage];
      });

      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConversation.id
            ? {
                ...c,
                lastMessageText:
                  realMessage.text ||
                  (realMessage.attachments?.length
                    ? realMessage.attachments[0].name || 'Attachment'
                    : c.lastMessageText),
                lastMessageTimestampMs: realMessage.timestampMs || Date.now(),
              }
            : c
        )
      );

      emitLocalWorkspaceEvent('communication:message:new', {
        message: realMessage,
        conversationId: activeConversation.id,
        recipientId: activeConversation.partner.id,
        senderId: currentUserId,
      });
    } catch (err: any) {
      setErrorBanner(err?.message || 'Failed to send message.');
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    }
  };

  // Start new conversation from member picker
  const handleSelectMemberForChat = async (memberId: string) => {
    try {
      const conv = await getOrCreateDirectConversation(memberId);
      const list = await loadConversations();
      const found = list.find((c) => c.id === conv.id);
      if (found) {
        handleSelectConversation(found);
      }
    } catch (err: any) {
      setErrorBanner(err?.message || 'Unable to start chat.');
    }
  };

  // Admin File Manager Picker selection
  const handleFileManagerFileSelect = (file: any) => {
    setIsFileManagerPickerOpen(false);
    if (!file) return;

    const mime = file.mimeType || '';
    const isImg = mime.startsWith('image/');
    const att: CommunicationAttachment = {
      id: `att-cloud-${Date.now()}`,
      name: file.name,
      url: file.url,
      fileType: isImg ? 'IMAGE' : 'DOCUMENT',
      sizeBytes: Number(file.compressedSizeBytes || file.originalSizeBytes || 0),
      fileId: file.id,
      mimeType: mime,
    };

    handleSendMessage('', [att]);
  };

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden bg-slate-50/50 dark:bg-slate-950/50">
      <AnimatePresence>
        {errorBanner && (
          <motion.div
            initial={false}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 py-2 bg-rose-50 dark:bg-rose-950/60 border-b border-rose-200 text-xs text-rose-700 dark:text-rose-200 flex items-center justify-between shrink-0 overflow-hidden"
          >
            <span>{errorBanner}</span>
            <button
              type="button"
              onClick={() => setErrorBanner(null)}
              className="text-rose-500 hover:text-rose-800 font-bold"
            >
              âœ•
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* 1. Left Conversation List Sidebar */}
        <div
          className={`h-full ${
            activeConversation ? 'hidden md:flex' : 'flex w-full md:w-auto'
          }`}
        >
          <ConversationListSidebar
            conversations={conversations}
            activeConversationId={activeConversation?.id || null}
            onSelectConversation={handleSelectConversation}
            onOpenNewChatModal={() => setIsNewChatModalOpen(true)}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
          />
        </div>

        {/* 2. Right Active Chat Canvas / Empty State */}
        <div
          className={`flex-1 h-full min-h-0 ${
            activeConversation ? 'flex w-full' : 'hidden md:flex'
          }`}
        >
          <AnimatePresence mode="wait">
            {activeConversation ? (
              <motion.div
                key={activeConversation.id}
                initial={false}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -14 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="flex-1 flex h-full min-h-0 w-full"
              >
                <ChatThreadCanvas
                  conversation={activeConversation}
                  currentUserId={currentUserId}
                  messages={messages}
                  onSendMessage={handleSendMessage}
                  onBackOnMobile={() => setActiveConversation(null)}
                  isAdmin={isAdmin}
                  onOpenFileManagerPicker={() => setIsFileManagerPickerOpen(true)}
                  onOpenDocument={(target) => {
                    setUniversalDocTarget({
                      title: target.title,
                      fileId: target.fileId,
                      url: target.fileUrl,
                    });
                  }}
                />
              </motion.div>
            ) : (
              /* Desktop Empty State */
              <motion.div
                key="empty-chat"
                initial={false}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.2 }}
                className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-3 bg-white/40 dark:bg-slate-900/40"
              >
                <motion.div
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  className="w-16 h-16 rounded-3xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800/60 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm"
                >
                  <MessageSquare className="w-8 h-8" />
                </motion.div>
                <h3 className="text-base font-black text-slate-800 dark:text-slate-100">
                  Workspace Direct Messenger
                </h3>
                <p className="text-xs text-slate-500 max-w-sm">
                  Select any team member from the left directory to start an instant, real-time conversation.
                </p>
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold pt-2">
                  <ShieldCheck className="w-4 h-4" />
                  <span>End-to-End Workspace Encrypted Â· Instant Event Push</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* 3. New Conversation Directory Picker Modal */}
      <NewConversationModal
        isOpen={isNewChatModalOpen}
        onClose={() => setIsNewChatModalOpen(false)}
        onSelectMember={handleSelectMemberForChat}
      />

      {/* 4. Admin Cloud File Manager Picker Modal */}
      {isFileManagerPickerOpen && (
        <Suspense fallback={null}>
          <FileManagerPickerModal
            isOpen={isFileManagerPickerOpen}
            onClose={() => setIsFileManagerPickerOpen(false)}
            onSelectFile={handleFileManagerFileSelect}
          />
        </Suspense>
      )}

      {/* 5. Universal Document Engine Preview Modal */}
      {universalDocTarget && (
        <Suspense fallback={null}>
          <UniversalDocumentEngineModal
            isOpen={Boolean(universalDocTarget)}
            target={universalDocTarget}
            onClose={() => setUniversalDocTarget(null)}
          />
        </Suspense>
      )}
    </div>
  );
};

