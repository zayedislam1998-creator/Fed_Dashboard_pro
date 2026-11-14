import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { FileText, Plus, Search, Trash2, Edit3, Copy, Check, AlertCircle, ArrowLeft, Save, Eye, ExternalLink, X, FolderOpen } from 'lucide-react';
import {
  deleteWorkspaceDoc,
  fetchWorkspaceDocs,
  getGoogleDoc,
  saveWorkspaceDoc,
  WorkspaceDocItem,
} from '../../services/workspaceApi';
import { convertViaEngine } from '../../services/engineCache';
import { FileManagerPickerModal } from '../filemanager/FileManagerPickerModal';
import {
  UniversalDocumentEngineModal,
  UniversalEngineTarget,
} from '../shared/UniversalDocumentEngineModal';
import type { ImageEditorTarget } from '../shared/ImageEditorModal';

const RichDocEditorPane = lazy(() =>
  import('../engines/RichDocEditorPane').then((m) => ({ default: m.RichDocEditorPane }))
);
const ImageEditorModal = lazy(() =>
  import('../shared/ImageEditorModal').then((m) => ({ default: m.ImageEditorModal }))
);

export type DocsSubTab = 'all_docs' | 'add_doc';

interface DocsViewProps {
  isAuthenticated: boolean;
  onRequireAuth: () => void;
  initialItemId?: string;
  onInitialItemOpened?: () => void;
  activeSubTab?: DocsSubTab;
  onSelectSubTab?: (tab: DocsSubTab) => void;
}

export const DocsView: React.FC<DocsViewProps> = ({
  isAuthenticated: _isAuthenticated,
  onRequireAuth: _onRequireAuth,
  initialItemId,
  onInitialItemOpened,
  activeSubTab = 'all_docs',
  onSelectSubTab,
}) => {
  const [tab, setTab] = useState<DocsSubTab>(activeSubTab);
  const [docs, setDocs] = useState<WorkspaceDocItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);

  // Editor state
  const [editingDocId, setEditingDocId] = useState<string | undefined>(undefined);
  const [docTitle, setDocTitle] = useState('Untitled Document');
  const [docCategory, setDocCategory] = useState('General');
  const [docPlain, setDocPlain] = useState('');
  const [docHtml, setDocHtml] = useState('');

  // Modals
  const [isOpenModalVisible, setIsOpenModalVisible] = useState(false);
  const [docIdInput, setDocIdInput] = useState('');
  const [engineTarget, setEngineTarget] = useState<UniversalEngineTarget | null>(null);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [imageEditorTarget, setImageEditorTarget] = useState<ImageEditorTarget | null>(null);
  const [editingImgSrc, setEditingImgSrc] = useState<string | null>(null);

  useEffect(() => {
    setTab(activeSubTab);
  }, [activeSubTab]);

  const showNotice = (text: string, ok = true) => {
    setToast({ text, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const loadDocs = async () => {
    setLoading(true);
    try {
      const list = await fetchWorkspaceDocs();
      setDocs(list);
    } catch (err: any) {
      showNotice(err.message || 'Failed to load workspace documents.', false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocs();
  }, []);

  const switchTab = (next: DocsSubTab) => {
    setTab(next);
    onSelectSubTab?.(next);
  };

  const handleStartNewDoc = () => {
    setEditingDocId(undefined);
    setDocTitle('Untitled Document');
    setDocCategory('General');
    setDocPlain('');
    setDocHtml('<h1>Untitled Document</h1><p>Start writing rich formatted workspace documentation here...</p>');
    switchTab('add_doc');
  };

  const handleOpenDocForEdit = (doc: WorkspaceDocItem) => {
    setEditingDocId(doc.id);
    setDocTitle(doc.title);
    setDocCategory(doc.category || 'General');
    setDocPlain(doc.bodyText || '');
    const savedHtml = (doc as any).htmlContent || '';
    setDocHtml(
      savedHtml ||
        `<h1>${doc.title}</h1><p>${String(doc.bodyText || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\n/g, '<br/>')}</p>`
    );
    switchTab('add_doc');
  };
  useEffect(() => {
    if (!initialItemId) return;
    const item = docs.find((entry) => entry.id === initialItemId);
    if (!item) return;
    handleOpenDocForEdit(item);
    onInitialItemOpened?.();
  }, [initialItemId, docs, onInitialItemOpened]);


  const handleSaveDoc = async () => {
    setIsSaving(true);
    try {
      const res = await saveWorkspaceDoc({
        id: editingDocId,
        title: docTitle.trim() || 'Untitled Document',
        category: docCategory.trim() || 'General',
        bodyText: docPlain,
        htmlContent: docHtml,
      });
      setDocs(res.docs);
      setEditingDocId(res.doc.id);
      showNotice(`Saved "${res.doc.title}" & synced to File Manager!`);
    } catch (err: any) {
      showNotice(err.message || 'Failed to save document.', false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteDoc = async (doc: WorkspaceDocItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Delete document "${doc.title}"?`)) return;
    try {
      const list = await deleteWorkspaceDoc(doc.id);
      setDocs(list);
      showNotice(`Deleted "${doc.title}".`);
    } catch (err: any) {
      showNotice(err.message || 'Delete failed.', false);
    }
  };

  const handleCopyDocLink = (doc: WorkspaceDocItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const link = doc.googleDocUrl || `${window.location.origin}${doc.fileUrl || `/?doc=${doc.id}`}`;
    navigator.clipboard?.writeText(link);
    setCopiedId(doc.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleLoadById = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const cleanId = docIdInput.trim().match(/\/document\/d\/([a-zA-Z0-9-_]+)/)?.[1] || docIdInput.trim();
      const loaded = await getGoogleDoc(cleanId);
      setEditingDocId(loaded.documentId);
      setDocTitle(loaded.title);
      setDocPlain(loaded.bodyText);
      setDocHtml(`<h1>${loaded.title}</h1><p>${loaded.bodyText.replace(/\n/g, '<br/>')}</p>`);
      setIsOpenModalVisible(false);
      setDocIdInput('');
      switchTab('add_doc');
      showNotice(`Opened "${loaded.title}".`);
    } catch (err: any) {
      showNotice(err.message || 'Document not found.', false);
    }
  };

  const handleExportFormat = async (action: 'DOC_TO_DOCX' | 'TEXT_TO_PDF') => {
    try {
      const res = await convertViaEngine({
        action,
        title: docTitle || 'Document',
        lines: action === 'DOC_TO_DOCX' ? docHtml || docPlain : docPlain.split(/\r?\n/),
        folderId: 'folder-documents',
      });
      showNotice(`Saved "${res.file.name}" to Server File Manager!`);
    } catch (err: any) {
      showNotice(err.message || 'Export failed.', false);
    }
  };

  const filteredDocs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return docs.filter(
      (d) =>
        !q ||
        d.title.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q) ||
        d.bodyText.toLowerCase().includes(q)
    );
  }, [docs, search]);

  return (
    <div className="flex-1 flex flex-col bg-[#F6F8FC] overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 shrink-0 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#0B57D0]">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-extrabold text-slate-900">
              Docs Studio (Rich A4 Editor, DOCX & PDF Engine)
            </h1>
            <p className="text-[11px] text-slate-500">
              Live headings outline, tables, checklists, inline image editing & 1-click DOCX/PDF export
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsOpenModalVisible(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5 text-[#0B57D0]" />
            Open by ID
          </button>
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-0.5">
            <button
              type="button"
              onClick={() => switchTab('all_docs')}
              className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                tab === 'all_docs' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              All Docs ({docs.length})
            </button>
            <button
              type="button"
              onClick={() => (tab === 'add_doc' ? switchTab('add_doc') : handleStartNewDoc())}
              className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                tab === 'add_doc' ? 'bg-[#0B57D0] text-white shadow-xs' : 'text-slate-600'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              Rich Editor
            </button>
          </div>
        </div>
      </div>

      {toast && (
        <div
          className={`px-4 py-2 text-xs font-semibold flex items-center gap-2 border-b ${
            toast.ok ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
          }`}
        >
          {toast.ok ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.text}
        </div>
      )}

      {tab === 'all_docs' ? (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search workspace documents..."
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-xs outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="button"
              onClick={handleStartNewDoc}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0B57D0] hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              New Rich Document
            </button>
          </div>

          {loading && docs.length === 0 ? null : filteredDocs.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
              <FileText className="w-10 h-10 text-blue-300 mx-auto" />
              <p className="text-sm font-bold text-slate-900">No documents found</p>
              <p className="text-xs text-slate-500">Create a formatted document with inline tables, outlines, and images.</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
              {filteredDocs.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => handleOpenDocForEdit(doc)}
                  className="p-3.5 sm:px-5 flex items-center justify-between gap-3 hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#0B57D0] flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 truncate">{doc.title}</span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 text-[#0B57D0]">
                          {doc.category || 'General'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 truncate mt-0.5">
                        {doc.wordCount} words Â· Updated {doc.updatedAt} â€” {doc.bodyText.slice(0, 90)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() =>
                        setEngineTarget({
                          title: `${doc.title}.docx`,
                          docId: doc.id,
                          fileId: doc.linkedFileId,
                          bodyText: doc.bodyText,
                          htmlContent: (doc as any).htmlContent,
                          initialMode: 'VIEW',
                        })
                      }
                      title="Open in Universal Document Engine"
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleCopyDocLink(doc, e)}
                      className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 cursor-pointer"
                      title="Copy Link"
                    >
                      {copiedId === doc.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    {doc.googleDocUrl && (
                      <a
                        href={doc.googleDocUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg text-[#0B57D0] hover:bg-blue-50"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => handleOpenDocForEdit(doc)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-[#0B57D0] text-[11px] font-bold cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteDoc(doc, e)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
              <button
                type="button"
                onClick={() => switchTab('all_docs')}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Docs
              </button>
              <input
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                placeholder="Document title..."
                className="px-3 py-1 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-900 min-w-[200px]"
              />
              <input
                value={docCategory}
                onChange={(e) => setDocCategory(e.target.value)}
                placeholder="Category"
                className="hidden sm:block w-28 px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs text-slate-600"
              />
            </div>

            <button
              type="button"
              disabled={isSaving}
              onClick={handleSaveDoc}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#0B57D0] hover:bg-blue-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              {<Save className="w-3.5 h-3.5" />}
              {editingDocId ? 'Save Changes' : 'Save Doc'}
            </button>
          </div>

          <Suspense
            fallback={null}
          >
            <RichDocEditorPane
              title={docTitle}
              html={docHtml}
              plainText={docPlain}
              mode="EDIT"
              onChange={({ html, plainText }) => {
                setDocHtml(html);
                setDocPlain(plainText);
              }}
              onInsertImageRequest={() => setShowImagePicker(true)}
              onEditSelectedImage={(imgUrl) => {
                setEditingImgSrc(imgUrl);
                setImageEditorTarget({ title: `${docTitle} - Inline Image`, imageUrl: imgUrl });
              }}
              onExportDocx={() => handleExportFormat('DOC_TO_DOCX')}
              onExportPdf={() => handleExportFormat('TEXT_TO_PDF')}
            />
          </Suspense>
        </div>
      )}

      {/* Open by ID Modal */}
      {isOpenModalVisible && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <form onSubmit={handleLoadById} className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Open Document by ID / URL</h3>
              <button type="button" onClick={() => setIsOpenModalVisible(false)} className="cursor-pointer">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <input
              required
              value={docIdInput}
              onChange={(e) => setDocIdInput(e.target.value)}
              placeholder="Paste Document ID or URL..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setIsOpenModalVisible(false)} className="px-4 py-2 text-xs font-semibold text-slate-600 cursor-pointer">
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 rounded-xl bg-[#0B57D0] text-white text-xs font-bold cursor-pointer">
                Open Document
              </button>
            </div>
          </form>
        </div>
      )}

      <UniversalDocumentEngineModal
        isOpen={!!engineTarget}
        target={engineTarget}
        onClose={() => setEngineTarget(null)}
        onSavedOrUpdated={loadDocs}
      />

      <FileManagerPickerModal
        isOpen={showImagePicker}
        onClose={() => setShowImagePicker(false)}
        defaultFolderId="folder-images"
        imagesOnly
        title="Insert Image into Document"
        onSelectFile={(file) => {
          setShowImagePicker(false);
          setDocHtml((prev) => `${prev}<p><img src="${file.url}" alt="${file.name}" style="max-width:100%;border-radius:10px;margin:8px 0;" /></p>`);
        }}
      />

      {imageEditorTarget && (
        <Suspense fallback={null}>
          <ImageEditorModal
            isOpen={!!imageEditorTarget}
            target={imageEditorTarget}
            onClose={() => setImageEditorTarget(null)}
            onSaved={(res) => {
              const newUrl = res.file?.url || res.dataUrl;
              if (editingImgSrc) {
                setDocHtml((prev) => prev.split(editingImgSrc).join(newUrl));
              }
              setImageEditorTarget(null);
              setEditingImgSrc(null);
              showNotice('Updated inline document image!');
            }}
          />
        </Suspense>
      )}
    </div>
  );
};



