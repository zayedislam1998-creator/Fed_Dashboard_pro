import React, { Suspense, lazy, useState, useEffect } from 'react';
import {
  MessageSquare,
  Hash,
  Plus,
  Send,
  Pin,
  Trash2,
  CheckCircle2,
  X,
  Paperclip,
  FileText,
  Edit3,
} from 'lucide-react';
import {
  WorkspaceChatChannelItem,
  WorkspaceChatMessageItem,
  WorkspaceFileItem,
  fetchEngineCollection,
  saveEngineRecord,
  deleteEngineRecord,
} from '../services/workspaceApi';
import { FileManagerPickerModal } from './FileManagerPickerModal';
import {
  UniversalDocumentEngineModal,
  UniversalEngineTarget,
} from './UniversalDocumentEngineModal';
import type { ImageEditorTarget } from './ImageEditorModal';

const ImageEditorModal = lazy(() =>
  import('./ImageEditorModal').then((m) => ({ default: m.ImageEditorModal }))
);

export type ChatSubTab = 'channels' | 'create_channel';

interface TeamChatViewProps {
  activeSubTab?: ChatSubTab;
  onSubTabChange?: (tab: ChatSubTab) => void;
  currentUserEmail?: string;
}

export const TeamChatView: React.FC<TeamChatViewProps> = ({
  activeSubTab = 'channels',
  onSubTabChange,
  currentUserEmail = 'admin@workspace.local',
}) => {
  const [subTab, setSubTab] = useState<ChatSubTab>(activeSubTab);
  const [channels, setChannels] = useState<WorkspaceChatChannelItem[]>([]);
  const [messages, setMessages] = useState<WorkspaceChatMessageItem[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string>('');
  const [text, setText] = useState('');
  const [senderName, setSenderName] = useState('Workspace Admin');
  const [banner, setBanner] = useState<string | null>(null);

  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDesc, setNewChannelDesc] = useState('');
  const [isFilePickerOpen, setIsFilePickerOpen] = useState(false);
  const [engineTarget, setEngineTarget] = useState<UniversalEngineTarget | null>(null);
  const [editingImageTarget, setEditingImageTarget] = useState<ImageEditorTarget | null>(null);

  useEffect(() => {
    setSubTab(activeSubTab);
  }, [activeSubTab]);

  const switchTab = (tab: ChatSubTab) => {
    setSubTab(tab);
    onSubTabChange?.(tab);
  };

  const loadChat = async () => {
    try {
      const [chList, msgList] = await Promise.all([
        fetchEngineCollection<WorkspaceChatChannelItem>('chatChannels'),
        fetchEngineCollection<WorkspaceChatMessageItem>('chatMessages'),
      ]);
      setChannels(chList);
      setMessages(msgList);
      if (chList.length > 0 && !activeChannelId) {
        setActiveChannelId(chList[0].id);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadChat();
  }, []);

  const handleAttachFileToChat = async (file: WorkspaceFileItem) => {
    setIsFilePickerOpen(false);
    if (!activeChannelId) return;
    const tag = `[FILE::${file.id}::${file.name}::${file.url}::${file.isImage ? 'IMAGE' : 'DOC'}]`;
    const res = await saveEngineRecord<WorkspaceChatMessageItem>('chatMessages', {
      channelId: activeChannelId,
      senderName: senderName.trim() || 'Workspace Admin',
      senderEmail: currentUserEmail,
      text: `${text.trim() ? `${text.trim()}\n` : ''}${tag}`,
      isPinned: false,
    });
    setMessages(res.items);
    setText('');
  };

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;
    const clean = newChannelName.trim().toLowerCase().replace(/\s+/g, '-');
    const res = await saveEngineRecord<WorkspaceChatChannelItem>('chatChannels', {
      name: clean,
      description: newChannelDesc.trim(),
      channelType: 'PUBLIC',
    });
    setChannels(res.items);
    setActiveChannelId(res.item.id);
    setNewChannelName('');
    setNewChannelDesc('');
    setBanner(`Channel #${res.item.name} created.`);
    setTimeout(() => setBanner(null), 2500);
    switchTab('channels');
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !activeChannelId) return;
    const res = await saveEngineRecord<WorkspaceChatMessageItem>('chatMessages', {
      channelId: activeChannelId,
      senderName: senderName.trim() || 'Workspace Admin',
      senderEmail: currentUserEmail,
      text: text.trim(),
      isPinned: false,
    });
    setMessages(res.items);
    setText('');
  };

  const activeChannel = channels.find((c) => c.id === activeChannelId);
  const channelMessages = messages
    .filter((m) => m.channelId === activeChannelId)
    .sort((a, b) => a.timestamp - b.timestamp);

  return (
    <div className="flex-1 flex flex-col bg-[#F8FAFC] overflow-hidden">
      {/* Top Sub-Navigation Bar */}
      <div className="px-4 sm:px-6 py-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => switchTab('channels')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              subTab === 'channels'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Team Channels ({channels.length})
          </button>
          <button
            type="button"
            onClick={() => switchTab('create_channel')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              subTab === 'create_channel'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            Create Channel
          </button>
        </div>
      </div>

      {banner && (
        <div className="px-4 py-2 bg-emerald-50 border-b border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {banner}
          </span>
          <button type="button" onClick={() => setBanner(null)}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {subTab === 'channels' ? (
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Channels Sidebar */}
          <div className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-slate-200 p-3 flex md:flex-col gap-1.5 overflow-x-auto md:overflow-y-auto shrink-0">
            {channels.length === 0 ? (
              <div className="text-xs text-slate-500 p-2">
                No channels yet. Click &ldquo;+ Create Channel&rdquo; above.
              </div>
            ) : (
              channels.map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => setActiveChannelId(ch.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 shrink-0 ${
                    activeChannelId === ch.id
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <Hash className="w-3.5 h-3.5 shrink-0" />
                    {ch.name}
                  </span>
                </button>
              ))
            )}
          </div>

          {/* Chat Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {!activeChannel ? (
              <div className="flex-1 flex items-center justify-center p-6 text-center">
                <div>
                  <p className="text-sm font-semibold text-slate-700">
                    Select or create a channel to start chatting
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Use the &ldquo;+ Create Channel&rdquo; tab above to create #general, #projects, or #support.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="px-4 py-2.5 bg-white border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-slate-900 flex items-center gap-1">
                      <Hash className="w-4 h-4 text-blue-600" />
                      {activeChannel.name}
                    </div>
                    {activeChannel.description && (
                      <div className="text-[11px] text-slate-500">{activeChannel.description}</div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const updated = await deleteEngineRecord<WorkspaceChatChannelItem>(
                        'chatChannels',
                        activeChannel.id
                      );
                      setChannels(updated);
                      setActiveChannelId(updated[0]?.id || '');
                    }}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600"
                    title="Delete Channel"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {channelMessages.length === 0 ? (
                    <div className="text-center py-12 text-xs text-slate-400">
                      No messages in #{activeChannel.name} yet. Send the first message below.
                    </div>
                  ) : (
                    channelMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`p-3 rounded-xl border ${
                          msg.isPinned
                            ? 'bg-amber-50/70 border-amber-200'
                            : 'bg-white border-slate-200'
                        } flex items-start justify-between gap-3`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">
                              {msg.senderName}
                            </span>
                            <span className="text-[10px] text-slate-400">{msg.createdAt}</span>
                            {msg.isPinned && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                                Pinned
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-700 mt-1 whitespace-pre-wrap">
                            {msg.text.replace(/\[FILE::[^\]]+\]/g, '').trim()}
                          </p>
                          {(() => {
                            const match = msg.text.match(/\[FILE::([^:]+)::([^:]+)::([^:]+)::(IMAGE|DOC)\]/);
                            if (!match) return null;
                            const [, fileId, fileName, fileUrl, fileKind] = match;
                            return (
                              <div className="mt-2 inline-flex flex-wrap items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200">
                                {fileKind === 'IMAGE' ? (
                                  <img
                                    src={fileUrl}
                                    alt={fileName}
                                    onClick={() =>
                                      setEngineTarget({ title: fileName, url: fileUrl, fileId, initialMode: 'VIEW' })
                                    }
                                    className="w-16 h-12 rounded-lg object-cover border border-slate-200 cursor-pointer"
                                  />
                                ) : (
                                  <FileText className="w-4 h-4 text-[#0B57D0]" />
                                )}
                                <span className="text-[11px] font-bold text-slate-800">{fileName}</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEngineTarget({ title: fileName, url: fileUrl, fileId, initialMode: 'VIEW' })
                                  }
                                  className="px-2 py-0.5 rounded-lg bg-blue-50 text-[#0B57D0] text-[10px] font-bold cursor-pointer"
                                >
                                  Open
                                </button>
                                {fileKind === 'IMAGE' && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditingImageTarget({ title: fileName, imageUrl: fileUrl, fileId })
                                    }
                                    className="px-2 py-0.5 rounded-lg bg-purple-50 text-purple-700 text-[10px] font-bold cursor-pointer"
                                  >
                                    <Edit3 className="w-3 h-3 inline mr-0.5" />
                                    Edit Image
                                  </button>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={async () => {
                              const res = await saveEngineRecord<WorkspaceChatMessageItem>(
                                'chatMessages',
                                { ...msg, isPinned: !msg.isPinned }
                              );
                              setMessages(res.items);
                            }}
                            className="p-1 rounded text-slate-400 hover:text-amber-600"
                          >
                            <Pin className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              const updated = await deleteEngineRecord<WorkspaceChatMessageItem>(
                                'chatMessages',
                                msg.id
                              );
                              setMessages(updated);
                            }}
                            className="p-1 rounded text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <form
                  onSubmit={handleSendMessage}
                  className="p-3 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
                >
                  <input
                    type="text"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    placeholder="Your Name"
                    className="sm:w-40 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
                  />
                  <input
                    type="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={`Message #${activeChannel.name}... (use @name to mention)`}
                    className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:border-blue-600"
                  />
                  <button
                    type="button"
                    onClick={() => setIsFilePickerOpen(true)}
                    title="Share File or Image from File Manager"
                    className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Paperclip className="w-3.5 h-3.5 text-[#0B57D0]" />
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" /> Send
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-3 sm:p-6">
          <form
            onSubmit={handleCreateChannel}
            className="max-w-lg mx-auto bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4"
          >
            <h3 className="text-base font-bold text-slate-900">Create Team Chat Channel</h3>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Channel Name *</label>
              <input
                type="text"
                required
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                placeholder="e.g., general, engineering, project-updates"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
              <input
                type="text"
                value={newChannelDesc}
                onChange={(e) => setNewChannelDesc(e.target.value)}
                placeholder="Purpose of this channel"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
              >
                Create Channel
              </button>
            </div>
          </form>
        </div>
      )}

      <FileManagerPickerModal
        isOpen={isFilePickerOpen}
        onClose={() => setIsFilePickerOpen(false)}
        title="Share Workspace File or Image to Chat"
        onSelectFile={handleAttachFileToChat}
      />

      <UniversalDocumentEngineModal
        isOpen={Boolean(engineTarget)}
        target={engineTarget}
        onClose={() => setEngineTarget(null)}
        onSavedOrUpdated={loadChat}
      />

      {editingImageTarget && (
        <Suspense fallback={null}>
          <ImageEditorModal
            isOpen={Boolean(editingImageTarget)}
            target={editingImageTarget}
            onClose={() => setEditingImageTarget(null)}
            onSaved={() => {
              setEditingImageTarget(null);
              loadChat();
            }}
          />
        </Suspense>
      )}
    </div>
  );
};
