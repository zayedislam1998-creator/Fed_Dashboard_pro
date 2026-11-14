import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  User,
  MoreVertical,
  Search,
} from 'lucide-react';
import type {
  CommunicationConversationItem,
  CommunicationMessageItem,
  CommunicationAttachment,
} from '../../services/workspaceApi';
import { ChatMessageBubble } from './ChatMessageBubble';
import { ChatInputBar } from './ChatInputBar';
import { LightboxImageModal } from './LightboxImageModal';

interface ChatThreadCanvasProps {
  conversation: CommunicationConversationItem;
  currentUserId: string;
  messages: CommunicationMessageItem[];
  onSendMessage: (
    text: string,
    attachments?: CommunicationAttachment[],
    replyToId?: string,
    replySnippet?: string
  ) => Promise<void>;
  onBackOnMobile?: () => void;
  isAdmin: boolean;
  onOpenFileManagerPicker?: () => void;
  onOpenDocument: (target: { fileId?: string; fileUrl?: string; title: string }) => void;
}

export const ChatThreadCanvas: React.FC<ChatThreadCanvasProps> = ({
  conversation,
  currentUserId,
  messages,
  onSendMessage,
  onBackOnMobile,
  isAdmin,
  onOpenFileManagerPicker,
  onOpenDocument,
}) => {
  const [replyingTo, setReplyingTo] = useState<CommunicationMessageItem | null>(
    null
  );
  const [lightboxImage, setLightboxImage] = useState<{
    url: string;
    name?: string;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom on message updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Group messages with date separators
  const renderMessagesWithDateDividers = () => {
    let lastDateStr = '';

    return messages.map((msg) => {
      const msgDate = new Date(msg.timestampMs || Date.now());
      const dateStr = msgDate.toLocaleDateString([], {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      const showDivider = dateStr !== lastDateStr;
      lastDateStr = dateStr;

      const isMine = msg.senderId === currentUserId;

      return (
        <React.Fragment key={msg.id}>
          {showDivider && (
            <div className="flex items-center justify-center my-3">
              <span className="px-3 py-1 rounded-full bg-slate-200/70 dark:bg-slate-800/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider shadow-2xs">
                {dateStr}
              </span>
            </div>
          )}
          <motion.div
            initial={false}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
          >
            <ChatMessageBubble
              message={msg}
              isMine={isMine}
              onOpenImage={(url, name) => setLightboxImage({ url, name })}
              onOpenDocument={onOpenDocument}
              onReply={(m) => setReplyingTo(m)}
            />
          </motion.div>
        </React.Fragment>
      );
    });
  };

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 w-full bg-slate-50/50 dark:bg-slate-950/40 relative">
      {/* Sticky Chat Header */}
      <div className="flex items-center justify-between px-3 sm:px-6 py-2.5 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800 z-10 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Back Button on Mobile */}
          {onBackOnMobile && (
            <motion.button
              whileTap={{ scale: 0.92 }}
              type="button"
              onClick={onBackOnMobile}
              className="md:hidden flex items-center justify-center w-9 h-9 -ml-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer shrink-0"
              aria-label="Back to conversations list"
            >
              <ArrowLeft className="w-5 h-5" />
            </motion.button>
          )}

          {/* Partner Avatar with Presence Indicator */}
          <div className="relative shrink-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-tr from-slate-200 to-slate-300 dark:from-slate-800 dark:to-slate-700 overflow-hidden flex items-center justify-center border border-white dark:border-slate-800 shadow-2xs">
              {conversation.partner.avatarUrl ? (
                <img
                  src={conversation.partner.avatarUrl}
                  alt={conversation.partner.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-5 h-5 text-slate-400" />
              )}
            </div>
            {/* Green Online Dot */}
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
          </div>

          {/* Partner Name & Role */}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                {conversation.partner.name}
              </h3>
              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 shrink-0">
                {conversation.partner.role}
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
              <span>Active now</span>
            </p>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-1 text-slate-500">
          <button
            type="button"
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Search in conversation"
          >
            <Search className="w-4 h-4" />
          </button>
          <button
            type="button"
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="More Options"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* High-Density Message Feed Stream */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-3 space-y-1">
        {messages.length === 0 ? (
          <motion.div
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-2"
          >
            <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-500 flex items-center justify-center">
              <User className="w-6 h-6" />
            </div>
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Direct conversation with {conversation.partner.name}
            </p>
            <p className="text-[11px] text-slate-400 max-w-xs">
              Messages and attachments are private and encrypted in workspace storage.
            </p>
          </motion.div>
        ) : (
          renderMessagesWithDateDividers()
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Bottom Input Bar */}
      <ChatInputBar
        onSendMessage={onSendMessage}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
        isAdmin={isAdmin}
        onOpenFileManagerPicker={onOpenFileManagerPicker}
      />

      {/* Lightbox Image Preview Modal */}
      {lightboxImage && (
        <LightboxImageModal
          isOpen={true}
          onClose={() => setLightboxImage(null)}
          imageUrl={lightboxImage.url}
          imageName={lightboxImage.name}
        />
      )}
    </div>
  );
};
