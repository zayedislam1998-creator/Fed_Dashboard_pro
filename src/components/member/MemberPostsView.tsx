import React, { useMemo, useState } from 'react';
import { Megaphone, Pin, Plus } from 'lucide-react';
import { saveMemberPost } from '../../services/workspaceAuth';
import {
  canMemberAction,
  EmptyAppCard,
  filterBySearch,
  MemberBootstrapData,
  StatusPill,
} from './shared';

export function MemberPostsView({
  data,
  searchQuery = '',
  readOnlyPreview,
  onReload,
  onNotify,
}: {
  data: MemberBootstrapData;
  searchQuery?: string;
  readOnlyPreview?: boolean;
  onReload: () => Promise<void>;
  onNotify: (msg: string, isError?: boolean) => void;
}) {
  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const canDraft = !readOnlyPreview && canMemberAction(data.capabilities, 'post.create');
  const canPublish = !readOnlyPreview && canMemberAction(data.capabilities, 'post.publish');
  const visiblePosts = useMemo(
    () => filterBySearch(data.posts, searchQuery, ['title', 'summary', 'content', 'authorName']),
    [data.posts, searchQuery]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    try {
      await saveMemberPost({
        title: title.trim(),
        content: content.trim(),
        publishNow: canPublish,
      });
      setTitle('');
      setContent('');
      setComposerOpen(false);
      await onReload();
      onNotify(canPublish ? 'Announcement published.' : 'Draft submitted for review.');
    } catch (err: any) {
      onNotify(err.message || 'Could not save post.', true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {canDraft && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setComposerOpen((v) => !v)}
            className="min-h-[44px] px-4 rounded-2xl text-sm font-semibold text-white bg-[var(--mp-accent)] hover:bg-[var(--mp-accent-hover)] inline-flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {canPublish ? 'New Announcement' : 'Submit Draft Post'}
          </button>
        </div>
      )}

      {composerOpen && canDraft && (
        <form onSubmit={handleSubmit} className="mp-card rounded-3xl p-5 space-y-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Headline..."
            required
            className="w-full min-h-[44px] px-4 rounded-2xl border border-[var(--mp-border)] bg-[var(--mp-surface-subtle)] text-sm font-semibold"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            placeholder="Write your update clearly for the team..."
            required
            className="w-full p-4 rounded-2xl border border-[var(--mp-border)] bg-[var(--mp-surface-subtle)] text-sm"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setComposerOpen(false)}
              className="min-h-[42px] px-4 rounded-2xl text-sm text-[var(--mp-text-muted)] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[42px] px-5 rounded-2xl text-sm font-semibold text-white bg-[var(--mp-accent)] cursor-pointer"
            >
              {canPublish ? 'Publish Now' : 'Send Draft'}
            </button>
          </div>
        </form>
      )}

      {visiblePosts.length === 0 ? (
        <EmptyAppCard
          icon={Megaphone}
          title="No notices found"
          subtitle="Published announcements and important workspace news will appear here."
        />
      ) : (
        <div className="space-y-3">
          {visiblePosts.map((post) => (
            <article key={post.id} className="mp-card-soft rounded-3xl p-5">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <StatusPill label={post.type || 'POST'} tone={post.type === 'NOTICE' ? 'accent' : 'neutral'} />
                {post.priority && post.priority !== 'Normal' && (
                  <StatusPill label={post.priority} tone={post.priority === 'Urgent' ? 'danger' : 'warn'} />
                )}
                {post.status === 'DRAFT' && <StatusPill label="Pending Review" tone="warn" />}
                {post.isPinned && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--mp-accent-text)]">
                    <Pin className="w-3.5 h-3.5" /> Pinned
                  </span>
                )}
              </div>
              <h3 className="text-base sm:text-lg font-bold text-[var(--mp-text)]">{post.title}</h3>
              <p className="text-sm text-[var(--mp-text-muted)] mt-2 whitespace-pre-line">{post.content}</p>
              <div className="text-xs text-[var(--mp-text-muted)] mt-3 pt-2 border-t border-[var(--mp-border)]">
                {post.authorName} • {post.createdAt}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
