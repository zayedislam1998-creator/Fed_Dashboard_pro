import React, { Suspense, lazy, useMemo, useRef, useState } from 'react';
import {
  Download,
  Edit3,
  Eye,
  FolderOpen,
  Paperclip,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  UniversalDocumentEngineModal,
  UniversalEngineTarget,
} from '../shared/UniversalDocumentEngineModal';
import type { ImageEditorTarget } from '../shared/ImageEditorModal';
import { prefetchEngineFile } from '../../services/engineCache';
import {
  deleteMemberFile,
  uploadMemberFile,
} from '../../services/workspaceAuth';
import {
  canMemberAction,
  EmptyAppCard,
  filterBySearch,
  formatBytesCompact,
  MemberBootstrapData,
  StatusPill,
} from './shared';

const ImageEditorModal = lazy(() =>
  import('../shared/ImageEditorModal').then((m) => ({ default: m.ImageEditorModal }))
);

export function MemberFilesView({
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
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [engineTarget, setEngineTarget] = useState<UniversalEngineTarget | null>(null);
  const [editingImageTarget, setEditingImageTarget] = useState<ImageEditorTarget | null>(null);

  const canUpload = !readOnlyPreview && canMemberAction(data.capabilities, 'file.upload_own');
  const canDelete = !readOnlyPreview && canMemberAction(data.capabilities, 'file.upload_own');
  const visibleFiles = useMemo(
    () => filterBySearch(data.files, searchQuery, ['name', 'folderName', 'extension']),
    [data.files, searchQuery]
  );

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Could not read selected file.'));
        reader.readAsDataURL(file);
      });
      await uploadMemberFile({
        originalName: file.name,
        mimeType: file.type || 'application/octet-stream',
        dataUrl,
      });
      await onReload();
      onNotify(`Uploaded "${file.name}".`);
    } catch {
      onNotify('Unable to upload this file. Please try another file or contact your administrator.', true);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (fileId: string, name: string) => {
    try {
      await deleteMemberFile(fileId);
      await onReload();
      onNotify(`Deleted "${name}".`);
    } catch (err: any) {
      onNotify(err.message || 'Delete failed.', true);
    }
  };

  return (
    <div className="space-y-4">
      {/* Clean Files Header Bar */}
      <div className="mp-card rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 text-sm font-bold text-[var(--mp-text)]">
            <FolderOpen className="w-4 h-4 text-[var(--mp-accent)]" />
            My Files &amp; Shared Documents
          </div>
          <p className="text-xs text-[var(--mp-text-muted)] mt-1">
            Upload files or open documents shared directly with your workspace.
          </p>
        </div>

        {canUpload ? (
          <>
            <input
              ref={fileRef}
              type="file"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="min-h-[46px] px-5 rounded-2xl text-sm font-semibold text-white bg-[var(--mp-accent)] hover:bg-[var(--mp-accent-hover)] inline-flex items-center justify-center gap-2 shadow-sm shrink-0 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              {'Upload File'}
            </button>
          </>
        ) : (
          <StatusPill label="Upload Disabled" tone="neutral" />
        )}
      </div>

      {visibleFiles.length === 0 ? (
        <EmptyAppCard
          icon={FolderOpen}
          title="No files found"
          subtitle="Upload files or view documents shared directly with you here."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {visibleFiles.map((file) => {
            const isMine = file.ownerUserId === data.user.id || data.capabilities.isAdmin;
            const isImg = Boolean(file.isImage || String(file.mimeType || '').startsWith('image/'));
            return (
              <div
                key={file.id}
                onMouseEnter={() => prefetchEngineFile(file.id)}
                className="mp-card-soft rounded-3xl p-4 flex flex-col justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  {isImg ? (
                    <img
                      src={file.thumbnailUrl || file.url}
                      alt={file.name}
                      onClick={() =>
                        setEngineTarget({
                          title: file.name,
                          url: file.url,
                          mimeType: file.mimeType,
                          extension: file.extension,
                          fileId: file.id,
                          initialMode: 'VIEW',
                        })
                      }
                      className="w-12 h-12 rounded-2xl object-cover border border-[var(--mp-border)] shrink-0 cursor-pointer"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-2xl bg-[var(--mp-accent-soft)] text-[var(--mp-accent-text)] flex items-center justify-center shrink-0">
                      <Paperclip className="w-5 h-5" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-[var(--mp-text)] truncate">{file.name}</div>
                    <div className="text-xs text-[var(--mp-text-muted)] mt-0.5">
                      {formatBytesCompact(file.compressedSizeBytes)} â€¢ {file.uploadedAt}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-[var(--mp-border)]">
                  <StatusPill label={isMine ? 'My File' : 'Shared'} tone={isMine ? 'accent' : 'success'} />
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() =>
                        setEngineTarget({
                          title: file.name,
                          url: file.url,
                          mimeType: file.mimeType,
                          extension: file.extension,
                          fileId: file.id,
                          slideDeckId: file.slideDeckId,
                          docId: file.docId,
                          initialMode: 'VIEW',
                        })
                      }
                      className="min-h-[38px] px-3 rounded-xl text-xs font-semibold bg-blue-50 text-[#0B57D0] inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" /> Engine
                    </button>
                    {isImg && isMine && (
                      <button
                        type="button"
                        onClick={() =>
                          setEditingImageTarget({
                            title: file.name,
                            imageUrl: file.url,
                            fileId: file.id,
                          })
                        }
                        className="min-h-[38px] px-2.5 rounded-xl text-xs font-semibold bg-purple-50 text-purple-700 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Edit
                      </button>
                    )}
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Download ${file.name}`}
                      className="min-h-[38px] px-2.5 rounded-xl text-xs font-semibold bg-[var(--mp-surface-subtle)] text-[var(--mp-text)] inline-flex items-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                    {isMine && canDelete && (
                      <button
                        type="button"
                        onClick={() => handleDelete(file.id, file.name)}
                        aria-label={`Delete ${file.name}`}
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

      {editingImageTarget && (
        <Suspense fallback={null}>
          <ImageEditorModal
            isOpen={Boolean(editingImageTarget)}
            target={editingImageTarget}
            onClose={() => setEditingImageTarget(null)}
            onSaved={async () => {
              setEditingImageTarget(null);
              await onReload();
              onNotify('Edited image saved!');
            }}
          />
        </Suspense>
      )}
    </div>
  );
}


