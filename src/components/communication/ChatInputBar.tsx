import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Paperclip,
  Image as ImageIcon,
  FileText,
  FolderOpen,
  Mic,
  Square,
  X,
  Smile,
  Loader2,
} from 'lucide-react';
import {
  CommunicationAttachment,
  CommunicationMessageItem,
  uploadCommunicationFile,
} from '../../services/workspaceApi';

interface ChatInputBarProps {
  onSendMessage: (
    text: string,
    attachments?: CommunicationAttachment[],
    replyToId?: string,
    replySnippet?: string
  ) => Promise<void>;
  replyingTo: CommunicationMessageItem | null;
  onCancelReply: () => void;
  isAdmin: boolean;
  onOpenFileManagerPicker?: () => void;
}

export const ChatInputBar: React.FC<ChatInputBarProps> = ({
  onSendMessage,
  replyingTo,
  onCancelReply,
  isAdmin,
  onOpenFileManagerPicker,
}) => {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<CommunicationAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-grow textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        120
      )}px`;
    }
  }, [text]);

  // Handle local file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setIsAttachmentMenuOpen(false);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const att = await uploadCommunicationFile(file);
        setAttachments((prev) => [...prev, att]);
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to upload attachment.');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  // Voice recording controls
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: 'audio/webm',
        });
        stream.getTracks().forEach((track) => track.stop());

        if (audioBlob.size > 0) {
          setIsUploading(true);
          try {
            const att = await uploadCommunicationFile(
              audioBlob,
              `voice-note-${Date.now()}.webm`
            );
            await onSendMessage('', [att], replyingTo?.id, replyingTo?.text);
            if (replyingTo) onCancelReply();
          } catch (err: any) {
            alert(err?.message || 'Failed to send voice note.');
          } finally {
            setIsUploading(false);
          }
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch {
      alert('Microphone access was denied or is unavailable.');
    }
  };

  const stopRecording = (cancel = false) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      if (cancel) {
        audioChunksRef.current = [];
        mediaRecorderRef.current.stop();
      } else {
        mediaRecorderRef.current.stop();
      }
    }
  };

  const handleSend = async () => {
    if (!text.trim() && attachments.length === 0) return;
    const currentText = text.trim();
    const currentAtts = [...attachments];

    setText('');
    setAttachments([]);
    if (replyingTo) onCancelReply();

    await onSendMessage(
      currentText,
      currentAtts,
      replyingTo?.id,
      replyingTo?.text
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="relative border-t border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-2.5 sm:p-3 transition-all">
      {/* Replying Banner */}
      {replyingTo && (
        <div className="flex items-center justify-between px-3 py-1.5 mb-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-xs">
          <div className="truncate">
            <span className="font-bold text-blue-600 dark:text-blue-400">
              Replying to {replyingTo.senderName}:{' '}
            </span>
            <span className="text-slate-600 dark:text-slate-300">
              {replyingTo.text || '[Attachment]'}
            </span>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Attachment Previews */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold"
            >
              {att.fileType === 'IMAGE' ? (
                <ImageIcon className="w-3 h-3 text-blue-600" />
              ) : (
                <FileText className="w-3 h-3 text-emerald-600" />
              )}
              <span className="max-w-[120px] truncate">{att.name}</span>
              <button
                type="button"
                onClick={() =>
                  setAttachments((prev) => prev.filter((a) => a.id !== att.id))
                }
                className="text-rose-500 hover:text-rose-700 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Hidden File Inputs */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileUpload}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.rtf"
        multiple
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Main Input Dock */}
      {isRecording ? (
        /* Voice Recording Dock */
        <div className="flex items-center justify-between px-4 py-2 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 animate-pulse">
          <div className="flex items-center gap-2 text-rose-600 font-semibold text-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping" />
            <span>Recording Voice Memo: {formatTimer(recordingSeconds)}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => stopRecording(true)}
              className="p-1.5 rounded-xl hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 text-xs font-bold"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => stopRecording(false)}
              className="flex items-center gap-1 px-3 py-1 rounded-xl bg-rose-600 text-white text-xs font-bold shadow-xs hover:bg-rose-700"
            >
              <Send className="w-3 h-3" />
              <span>Send Memo</span>
            </button>
          </div>
        </div>
      ) : (
        /* Standard Typing Dock */
        <div className="flex items-end gap-1.5 sm:gap-2">
          {/* Attachment Popup Toggle */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsAttachmentMenuOpen(!isAttachmentMenuOpen)}
              className="p-2 sm:p-2.5 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Attach File"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {isAttachmentMenuOpen && (
              <div className="absolute bottom-full left-0 mb-2 w-48 p-1.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl space-y-1 z-30 animate-in fade-in zoom-in-95 duration-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsAttachmentMenuOpen(false);
                    photoInputRef.current?.click();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  <ImageIcon className="w-4 h-4 text-blue-600" />
                  <span>Send Photos</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsAttachmentMenuOpen(false);
                    fileInputRef.current?.click();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-emerald-600" />
                  <span>Send Documents</span>
                </button>

                {isAdmin && onOpenFileManagerPicker && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsAttachmentMenuOpen(false);
                      onOpenFileManagerPicker();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer border-t border-slate-100 dark:border-slate-700"
                  >
                    <FolderOpen className="w-4 h-4 text-amber-500" />
                    <span>Workspace Cloud Files</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Text Area */}
          <div className="flex-1 min-w-0 relative bg-slate-100 dark:bg-slate-800 rounded-2xl border border-transparent focus-within:border-blue-500 transition-colors">
            <textarea
              ref={textareaRef}
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message... (Press Enter to send)"
              className="w-full text-xs sm:text-sm px-3.5 py-2.5 bg-transparent resize-none outline-none text-slate-900 dark:text-white placeholder:text-slate-400"
            />
          </div>

          {/* Quick Emoji Picker Toggle */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}
              className="p-2 sm:p-2.5 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Emojis"
            >
              <Smile className="w-4 h-4" />
            </button>

            {isEmojiPickerOpen && (
              <div className="absolute bottom-full right-0 mb-2 p-2 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl flex gap-1 z-30">
                {['👍', '❤️', '😊', '🔥', '👏', '🎉', '🙏', '🙌'].map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => {
                      setText((prev) => prev + em);
                      setIsEmojiPickerOpen(false);
                    }}
                    className="p-1 hover:scale-125 transition-transform text-base cursor-pointer"
                  >
                    {em}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Microphone Voice Recorder Trigger */}
          <button
            type="button"
            onClick={startRecording}
            className="p-2 sm:p-2.5 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
            title="Record Voice Memo"
          >
            <Mic className="w-4 h-4" />
          </button>

          {/* Send Button */}
          <button
            type="button"
            onClick={handleSend}
            disabled={isUploading || (!text.trim() && attachments.length === 0)}
            className="p-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20 hover:shadow-lg disabled:opacity-40 transition-all cursor-pointer shrink-0"
            title="Send"
          >
            {isUploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      )}
    </div>
  );
};
