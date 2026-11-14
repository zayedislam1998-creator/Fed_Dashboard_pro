import React, { useMemo, useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import { sendMemberChatMessage } from '../../services/workspaceAuth';
import {
  canMemberAction,
  EmptyAppCard,
  MemberBootstrapData,
} from './shared';

export function MemberChatView({
  data,
  readOnlyPreview,
  onReload,
  onNotify,
}: {
  data: MemberBootstrapData;
  readOnlyPreview?: boolean;
  onReload: () => Promise<void>;
  onNotify: (msg: string, isError?: boolean) => void;
}) {
  const [activeChannelId, setActiveChannelId] = useState<string>(data.channels[0]?.id || '');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);



  const selectedChannel =
    data.channels.find((c) => c.id === activeChannelId) || data.channels[0] || null;
  const canSend = !readOnlyPreview && canMemberAction(data.capabilities, 'channel.send_member');

  const messages = useMemo(
    () =>
      selectedChannel
        ? data.chatMessages.filter((m) => m.channelId === selectedChannel.id)
        : [],
    [data.chatMessages, selectedChannel]
  );

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChannel || !text.trim() || !canSend) return;
    setSending(true);
    try {
      await sendMemberChatMessage(selectedChannel.id, text.trim());
      setText('');
      await onReload();
    } catch (err: any) {
      onNotify(err.message || 'Could not send message.', true);
    } finally {
      setSending(false);
    }
  };

  if (data.channels.length === 0) {
    return (
      <EmptyAppCard
        icon={MessageCircle}
        title="No channels assigned"
        subtitle="Ask your Admin to invite you to a project or team chat channel."
      />
    );
  }

  return (
    <div className="mp-card rounded-3xl overflow-hidden flex flex-col min-h-[62dvh]">
      {/* Channel Pills */}
      <div className="p-3.5 border-b border-[var(--mp-border)] flex items-center gap-2 overflow-x-auto bg-[var(--mp-surface-subtle)]">
        {data.channels.map((ch) => (
          <button
            key={ch.id}
            type="button"
            onClick={() => setActiveChannelId(ch.id)}
            className={`min-h-[40px] px-4 rounded-2xl text-xs sm:text-sm font-semibold whitespace-nowrap transition cursor-pointer ${
              selectedChannel?.id === ch.id
                ? 'bg-[var(--mp-accent)] text-white shadow-sm'
                : 'bg-white text-[var(--mp-text-muted)]'
            }`}
          >
            # {ch.name}
          </button>
        ))}
      </div>

      {/* Messages Feed */}
      <div className="flex-1 p-4 space-y-3 overflow-y-auto max-h-[52dvh]">
        {messages.length === 0 ? (
          <p className="text-sm text-[var(--mp-text-muted)] text-center py-10">
            No messages in #{selectedChannel?.name} yet. Say hello!
          </p>
        ) : (
          messages.map((m) => {
            const isMine = m.senderEmail?.toLowerCase() === data.user.email.toLowerCase();
            return (
              <div key={m.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                <div className="text-[11px] font-medium text-[var(--mp-text-muted)] mb-1 px-1">
                  {isMine ? 'You' : m.senderName} • {m.createdAt}
                </div>
                <div
                  className={`max-w-[82%] px-4 py-2.5 rounded-2xl text-sm whitespace-pre-line ${
                    isMine
                      ? 'bg-[var(--mp-accent)] text-white rounded-br-sm'
                      : 'bg-[var(--mp-surface-subtle)] text-[var(--mp-text)] rounded-bl-sm'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Composer */}
      <form onSubmit={handleSend} className="p-3 border-t border-[var(--mp-border)] flex items-center gap-2 bg-white">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={!canSend || sending}
          placeholder={
            readOnlyPreview
              ? 'Read-only preview mode'
              : canSend
              ? `Message #${selectedChannel?.name}...`
              : 'Sending messages is disabled by Admin'
          }
          className="flex-1 min-h-[44px] px-4 rounded-2xl bg-[var(--mp-surface-subtle)] text-sm text-[var(--mp-text)] border border-[var(--mp-border)]"
        />
        <button
          type="submit"
          disabled={!canSend || sending || !text.trim()}
          aria-label="Send message"
          className="min-h-[44px] min-w-[44px] px-4 rounded-2xl bg-[var(--mp-accent)] text-white flex items-center justify-center disabled:opacity-40 cursor-pointer"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
