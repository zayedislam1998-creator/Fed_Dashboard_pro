import React, { useMemo, useState } from 'react';
import { Eye, FileText, Plus, Trash2 } from 'lucide-react';
import {
  UniversalDocumentEngineModal,
  UniversalEngineTarget,
} from '../shared/UniversalDocumentEngineModal';
import {
  deleteMemberDoc,
  saveMemberDoc,
} from '../../services/workspaceAuth';
import {
  canMemberAction,
  EmptyAppCard,
  filterBySearch,
  MemberBootstrapData,
  StatusPill,
} from './shared';

export function MemberDocsView({
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
  const [selected, setSelected] = useState<any | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Personal');
  const [bodyText, setBodyText] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [engineTarget, setEngineTarget] = useState<UniversalEngineTarget | null>(null);

  const canCreate = !readOnlyPreview && canMemberAction(data.capabilities, 'doc.create');
  const canEditOwn = canCreate;
  const canDeleteOwn = canCreate;
  const visibleDocs = useMemo(
    () => filterBySearch(data.docs, searchQuery, ['title', 'category', 'bodyText']),
    [data.docs, searchQuery]
  );

  const openEditor = (doc?: any) => {
    if (doc) {
      setSelected(doc);
      setTitle(doc.title);
      setCategory(doc.category || 'General');
      setBodyText(doc.bodyText || '');
    } else {
      setSelected(null);
      setTitle('');
      setCategory('Personal');
      setBodyText('');
    }
    setEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await saveMemberDoc({
        id: selected?.id,
        title: title.trim(),
        category,
        bodyText,
      });
      setEditing(false);
      await onReload();
      onNotify('Document saved.');
    } catch (err: any) {
      onNotify(err.message || 'Could not save document.', true);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (docId: string) => {
    try {
      await deleteMemberDoc(docId);
      setSelected(null);
      setEditing(false);
      await onReload();
      onNotify('Document deleted.');
    } catch (err: any) {
      onNotify(err.message || 'Delete failed.', true);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--mp-text-muted)]">{data.docs.length} personal & shared notes</p>
        {canCreate && !editing && (
          <button
            type="button"
            onClick={() => openEditor()}
            className="min-h-[44px] px-4 rounded-2xl text-sm font-semibold text-white bg-[var(--mp-accent)] inline-flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" /> New Doc
          </button>
        )}
      </div>

      {editing ? (
        <form onSubmit={handleSave} className="mp-card rounded-3xl p-5 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Document title..."
              required
              className="flex-1 min-h-[44px] px-4 rounded-2xl border border-[var(--mp-border)] bg-[var(--mp-surface-subtle)] text-sm font-semibold"
            />
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Category"
              className="sm:w-40 min-h-[44px] px-4 rounded-2xl border border-[var(--mp-border)] bg-[var(--mp-surface-subtle)] text-sm"
            />
          </div>
          <textarea
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
            rows={8}
            placeholder="Start typing cleanly..."
            className="w-full p-4 rounded-2xl border border-[var(--mp-border)] bg-[var(--mp-surface-subtle)] text-sm leading-relaxed"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="min-h-[42px] px-4 rounded-2xl text-sm text-[var(--mp-text-muted)] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[42px] px-5 rounded-2xl text-sm font-semibold text-white bg-[var(--mp-accent)] cursor-pointer"
            >
              {'Save Document'}
            </button>
          </div>
        </form>
      ) : visibleDocs.length === 0 ? (
        <EmptyAppCard
          icon={FileText}
          title="No documents found"
          subtitle="Create a personal note or wait for someone to share a document with you."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {visibleDocs.map((doc) => {
            const isMine = doc.ownerUserId === data.user.id || data.capabilities.isAdmin;
            return (
              <div key={doc.id} className="mp-card-soft rounded-3xl p-5 flex flex-col justify-between gap-3">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <StatusPill label={doc.category || 'General'} tone="neutral" />
                    <StatusPill label={isMine ? 'Personal' : 'Shared with you'} tone={isMine ? 'accent' : 'success'} />
                  </div>
                  <h3 className="text-base font-bold text-[var(--mp-text)] mt-2.5">{doc.title}</h3>
                  <p className="text-sm text-[var(--mp-text-muted)] mt-1 line-clamp-3 whitespace-pre-line">
                    {doc.bodyText || 'Empty document'}
                  </p>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-[var(--mp-border)]">
                  <span className="text-xs text-[var(--mp-text-muted)]">{doc.wordCount || 0} words</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setEngineTarget({
                          title: `${doc.title}.docx`,
                          docId: doc.id,
                          fileId: doc.linkedFileId,
                          bodyText: doc.bodyText,
                          initialMode: isMine && canEditOwn ? 'EDIT' : 'VIEW',
                        })
                      }
                      className="min-h-[38px] px-3 rounded-xl text-xs font-semibold bg-blue-50 text-[#0B57D0] cursor-pointer inline-flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" /> Engine
                    </button>
                    {isMine && canEditOwn && (
                      <button
                        type="button"
                        onClick={() => openEditor(doc)}
                        className="min-h-[38px] px-3.5 rounded-xl text-xs font-semibold bg-[var(--mp-accent-soft)] text-[var(--mp-accent-text)] cursor-pointer"
                      >
                        Edit
                      </button>
                    )}
                    {isMine && canDeleteOwn && (
                      <button
                        type="button"
                        onClick={() => handleDelete(doc.id)}
                        aria-label={`Delete ${doc.title}`}
                        className="min-h-[38px] px-2.5 rounded-xl text-rose-600 hover:bg-rose-50 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <UniversalDocumentEngineModal
        isOpen={Boolean(engineTarget)}
        target={engineTarget}
        onClose={() => setEngineTarget(null)}
        onSavedOrUpdated={onReload}
      />
    </div>
  );
}

