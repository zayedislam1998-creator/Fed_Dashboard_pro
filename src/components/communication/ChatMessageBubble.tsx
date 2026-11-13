import React, { useState } from 'react';
import {
  Check,
  CheckCheck,
  FileText,
  Eye,
  CornerUpLeft,
  Smile,
  Download,
} from 'lucide-react';
import type { CommunicationMessageItem } from '../../services/workspaceApi';
import { VoiceMemoPlayer } from './VoiceMemoPlayer';

interface ChatMessageBubbleProps {
  message: CommunicationMessageItem;
  isMine: boolean;
  onOpenImage: (url: string, name?: string) => void;
  onOpenDocument: (target: { fileId?: string; fileUrl?: string; title: string }) => void;
  onReply: (message: CommunicationMessageItem) => void;
}

const EMOJI_REACTIONS = ['❤️', '👍', '😂', '👏', '🔥', '😮'];

export const ChatMessageBubble: React.FC<ChatMessageBubbleProps> = ({
  message,
  isMine,
  onOpenImage,
  onOpenDocument,
  onReply,
}) => {
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  const formatTime = (ts: number | string) => {
    if (!ts) return '';
    const date = new Date(Number(ts));
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div
      className={`group relative flex flex-col mb-1.5 transition-all ${
        isMine ? 'items-end' : 'items-start'
      }`}
    >
      {/* Floating Action Bar on Hover */}
      <div
        className={`absolute -top-3 z-10 hidden group-hover:flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-white dark:bg-slate-800 shadow-md border border-slate-200 dark:border-slate-700 text-slate-500 text-xs transition-all ${
          isMine ? 'right-2' : 'left-2'
        }`}
      >
        <button
          type="button"
          onClick={() => setShowReactionPicker(!showReactionPicker)}
          className="p-1 hover:text-blue-600 transition-colors cursor-pointer"
          title="React"
        >
          <Smile className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onReply(message)}
          className="p-1 hover:text-blue-600 transition-colors cursor-pointer"
          title="Reply"
        >
          <CornerUpLeft className="w-3.5 h-3.5" />
        </button>

        {showReactionPicker && (
          <div className="absolute bottom-full mb-1 flex items-center gap-1 p-1 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl z-20">
            {EMOJI_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  setSelectedEmoji(emoji === selectedEmoji ? null : emoji);
                  setShowReactionPicker(false);
                }}
                className="hover:scale-125 transition-transform p-1 text-sm cursor-pointer"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Bubble Container */}
      <div
        className={`relative max-w-[85%] sm:max-w-md md:max-w-lg px-3.5 py-2 rounded-2xl shadow-2xs text-xs sm:text-[13px] leading-relaxed break-words ${
          isMine
            ? 'bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-tr-xs'
            : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/70 dark:border-slate-700/70 rounded-tl-xs'
        }`}
      >
        {/* Quoted Reply Snippet */}
        {message.replySnippet && (
          <div
            className={`mb-1.5 p-1.5 rounded-lg border-l-2 text-[11px] truncate opacity-90 ${
              isMine
                ? 'bg-white/10 border-white/60 text-white'
                : 'bg-slate-100 dark:bg-slate-900 border-blue-500 text-slate-600 dark:text-slate-300'
            }`}
          >
            <span className="font-semibold block text-[10px]">Quoted message</span>
            <span className="truncate">{message.replySnippet}</span>
          </div>
        )}

        {/* Text Message Content */}
        {message.text && (
          <p className="whitespace-pre-wrap select-text">{message.text}</p>
        )}

        {/* Attachments Section */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-2 space-y-2">
            {message.attachments.map((att) => {
              if (att.fileType === 'IMAGE') {
                return (
                  <div
                    key={att.id}
                    className="relative rounded-xl overflow-hidden cursor-pointer group/img border border-black/10 dark:border-white/10 max-h-56 bg-slate-950"
                    onClick={() => onOpenImage(att.url, att.name)}
                  >
                    <img
                      src={att.url}
                      alt={att.name}
                      className="w-full h-full object-cover group-hover/img:scale-102 transition-transform duration-200"
                    />
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white">
                      <Eye className="w-5 h-5 drop-shadow-md" />
                    </div>
                  </div>
                );
              }

              if (att.fileType === 'AUDIO') {
                return <VoiceMemoPlayer key={att.id} audioUrl={att.url} />;
              }

              // Document Attachment Card
              return (
                <div
                  key={att.id}
                  className={`flex items-center justify-between gap-3 p-2.5 rounded-xl border transition-all ${
                    isMine
                      ? 'bg-white/15 border-white/20 text-white'
                      : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-500 dark:text-blue-400 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-xs truncate max-w-[150px] sm:max-w-[200px]">
                        {att.name}
                      </p>
                      {att.sizeBytes && (
                        <span className="text-[10px] opacity-70">
                          {(att.sizeBytes / 1024).toFixed(0)} KB
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {/* Instant Document Viewer Button */}
                    <button
                      type="button"
                      onClick={() =>
                        onOpenDocument({
                          fileId: att.fileId,
                          fileUrl: att.url,
                          title: att.name,
                        })
                      }
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold shadow-2xs transition-transform active:scale-95 cursor-pointer ${
                        isMine
                          ? 'bg-white text-blue-600 hover:bg-slate-100'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      <Eye className="w-3 h-3" />
                      <span>Instant View</span>
                    </button>

                    <a
                      href={att.url}
                      download={att.name}
                      className="p-1 rounded hover:opacity-80 transition-opacity"
                      title="Download"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Timestamp & Delivery Checkmarks */}
        <div
          className={`flex items-center justify-end gap-1 mt-1 text-[10px] select-none ${
            isMine ? 'text-blue-100' : 'text-slate-400'
          }`}
        >
          <span>{formatTime(message.timestampMs)}</span>
          {isMine && (
            <span>
              {message.isRead || message.status === 'READ' ? (
                <CheckCheck className="w-3.5 h-3.5 text-sky-200 fill-current" />
              ) : message.status === 'DELIVERED' ? (
                <CheckCheck className="w-3.5 h-3.5 opacity-80" />
              ) : (
                <Check className="w-3 h-3 opacity-80" />
              )}
            </span>
          )}
        </div>

        {/* Reaction Pill on Corner */}
        {selectedEmoji && (
          <div className="absolute -bottom-2 right-2 px-1.5 py-0.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs text-xs">
            {selectedEmoji}
          </div>
        )}
      </div>
    </div>
  );
};
