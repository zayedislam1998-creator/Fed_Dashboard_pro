import React, { Suspense, lazy, useState, useEffect } from 'react';
import DOMPurify from 'dompurify';
import {
  BookOpen,
  Plus,
  Search,
  Pin,
  Trash2,
  Edit3,
  ArrowLeft,
  CheckCircle2,
  X,
  FileText,
  Download,
} from 'lucide-react';
import {
  WorkspaceWikiArticleItem,
  fetchEngineCollection,
  saveEngineRecord,
  deleteEngineRecord,
} from '../services/workspaceApi';
import { convertViaEngine } from '../services/engineCache';
import { FileManagerPickerModal } from './FileManagerPickerModal';
import type { ImageEditorTarget } from './ImageEditorModal';

const RichDocEditorPane = lazy(() =>
  import('./engines/RichDocEditorPane').then((m) => ({ default: m.RichDocEditorPane }))
);
const ImageEditorModal = lazy(() =>
  import('./ImageEditorModal').then((m) => ({ default: m.ImageEditorModal }))
);

function stripHtmlTags(raw: string): string {
  return String(raw || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export type WikiSubTab = 'articles' | 'create_article';

interface WikiKnowledgeViewProps {
  activeSubTab?: WikiSubTab;
  onSubTabChange?: (tab: WikiSubTab) => void;
}

export const WikiKnowledgeView: React.FC<WikiKnowledgeViewProps> = ({
  activeSubTab = 'articles',
  onSubTabChange,
}) => {
  const [subTab, setSubTab] = useState<WikiSubTab>(activeSubTab);
  const [articles, setArticles] = useState<WorkspaceWikiArticleItem[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<WorkspaceWikiArticleItem | null>(null);
  const [search, setSearch] = useState('');
  const [banner, setBanner] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('SOP & Guidelines');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [imageEditorTarget, setImageEditorTarget] = useState<ImageEditorTarget | null>(null);
  const [editingImgSrc, setEditingImgSrc] = useState<string | null>(null);

  useEffect(() => {
    setSubTab(activeSubTab);
  }, [activeSubTab]);

  const switchTab = (tab: WikiSubTab) => {
    setSubTab(tab);
    onSubTabChange?.(tab);
  };

  useEffect(() => {
    fetchEngineCollection<WorkspaceWikiArticleItem>('wikiArticles')
      .then(setArticles)
      .catch(() => {});
  }, []);

  const resetForm = () => {
    setEditingId(undefined);
    setTitle('');
    setCategory('SOP & Guidelines');
    setSummary('');
    setContent('');
    setIsPinned(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const res = await saveEngineRecord<WorkspaceWikiArticleItem>('wikiArticles', {
      id: editingId,
      title: title.trim(),
      category,
      summary: summary.trim(),
      content,
      authorName: 'Workspace Admin',
      isPinned,
    });
    setArticles(res.items);
    setBanner(`Knowledge Base article "${res.item.title}" saved.`);
    setTimeout(() => setBanner(null), 3000);
    resetForm();
    switchTab('articles');
  };

  const filtered = articles
    .filter(
      (a) =>
        !search.trim() ||
        a.title.toLowerCase().includes(search.toLowerCase()) ||
        a.category.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => (a.isPinned === b.isPinned ? b.timestamp - a.timestamp : a.isPinned ? -1 : 1));

  return (
    <div className="flex-1 flex flex-col bg-[#F8FAFC] overflow-hidden">
      {/* Top Sub-Navigation Bar */}
      <div className="px-4 sm:px-6 py-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setSelectedArticle(null);
              switchTab('articles');
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              subTab === 'articles'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Knowledge Base & SOPs ({articles.length})
          </button>
          <button
            type="button"
            onClick={() => {
              resetForm();
              switchTab('create_article');
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              subTab === 'create_article'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            {editingId ? 'Edit SOP / Article' : 'Write Article / SOP'}
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

      {subTab === 'articles' && (
        <div className="flex-1 overflow-y-auto p-3 sm:p-6">
          <div className="max-w-6xl mx-auto space-y-4">
            {selectedArticle ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <button
                    type="button"
                    onClick={() => setSelectedArticle(null)}
                    className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back to Articles
                  </button>
                  <span className="px-2.5 py-0.5 rounded bg-amber-50 text-amber-800 text-xs font-bold">
                    {selectedArticle.category}
                  </span>
                </div>
                <h1 className="text-xl font-extrabold text-slate-900">{selectedArticle.title}</h1>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-slate-400">
                    Last updated {selectedArticle.updatedAt} by {selectedArticle.authorName}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        const res = await convertViaEngine({
                          action: 'DOC_TO_DOCX',
                          title: selectedArticle.title,
                          lines: selectedArticle.content,
                          folderId: 'folder-documents',
                        });
                        setBanner(`Exported "${res.file.name}" to File Manager!`);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-[#0B57D0] text-[11px] font-bold cursor-pointer"
                    >
                      <FileText className="w-3 h-3" /> Save .docx
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const res = await convertViaEngine({
                          action: 'TEXT_TO_PDF',
                          title: selectedArticle.title,
                          lines: stripHtmlTags(selectedArticle.content).split(/\n/),
                          folderId: 'folder-documents',
                        });
                        setBanner(`Exported PDF "${res.file.name}" to File Manager!`);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 text-red-700 text-[11px] font-bold cursor-pointer"
                    >
                      <Download className="w-3 h-3" /> Save PDF
                    </button>
                  </div>
                </div>
                <div
                  className="prose prose-sm max-w-none text-slate-800 leading-relaxed pt-3 border-t border-slate-100"
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(
                      selectedArticle.content.includes('<')
                        ? selectedArticle.content
                        : `<p>${selectedArticle.content.replace(/\n/g, '<br/>')}</p>`,
                      {
                        ADD_TAGS: ['table', 'thead', 'tbody', 'tr', 'th', 'td', 'img', 'blockquote', 'pre', 'code'],
                        ADD_ATTR: ['src', 'alt', 'style', 'class', 'colspan', 'rowspan'],
                      }
                    ),
                  }}
                />
              </div>
            ) : (
              <>
                <div className="bg-white rounded-xl border border-slate-200 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs">
                  <span className="text-xs font-bold text-slate-600">
                    Company Wiki, Onboarding Guides & Standard Operating Procedures (SOP)
                  </span>
                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search SOPs & Wiki..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-amber-600"
                    />
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                  {filtered.length === 0 ? (
                    <div className="py-12 px-4 text-center">
                      <p className="text-sm font-medium text-slate-700">
                        No Wiki articles or SOPs published yet.
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Use the &ldquo;+ Write Article / SOP&rdquo; tab above to create documentation.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {filtered.map((art) => (
                        <div
                          key={art.id}
                          onClick={() => setSelectedArticle(art)}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3.5 hover:bg-slate-50 cursor-pointer"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 text-[10px] font-bold">
                                {art.category}
                              </span>
                              {art.isPinned && (
                                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold flex items-center gap-1">
                                  <Pin className="w-2.5 h-2.5" /> Pinned
                                </span>
                              )}
                              <p className="text-sm font-semibold text-slate-900 truncate">
                                {art.title}
                              </p>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5 truncate">
                              {art.summary || stripHtmlTags(art.content).slice(0, 120)}
                            </p>
                          </div>
                          <div
                            className="flex items-center gap-1.5 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(art.id);
                                setTitle(art.title);
                                setCategory(art.category);
                                setSummary(art.summary);
                                setContent(art.content);
                                setIsPinned(art.isPinned);
                                switchTab('create_article');
                              }}
                              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                const updated = await deleteEngineRecord<WorkspaceWikiArticleItem>(
                                  'wikiArticles',
                                  art.id
                                );
                                setArticles(updated);
                              }}
                              className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {subTab === 'create_article' && (
        <div className="flex-1 overflow-y-auto p-3 sm:p-6">
          <form
            onSubmit={handleSave}
            className="max-w-3xl mx-auto bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4"
          >
            <h3 className="text-base font-bold text-slate-900">
              {editingId ? 'Edit Wiki / SOP Article' : 'Write New Wiki / SOP Guide'}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Employee Onboarding & Security SOP"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs bg-white"
                >
                  <option value="SOP & Guidelines">SOP & Guidelines</option>
                  <option value="Onboarding">Onboarding</option>
                  <option value="Engineering & Architecture">Engineering & Architecture</option>
                  <option value="HR & Company Policy">HR & Company Policy</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Short Summary</label>
              <input
                type="text"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Rich SOP / Documentation Content *
              </label>
              <div className="border border-slate-200 rounded-xl overflow-hidden min-h-[420px] flex flex-col">
                <Suspense fallback={<div className="p-8 text-xs text-slate-500">Loading Rich Editor...</div>}>
                  <RichDocEditorPane
                    title={title || 'Wiki Article'}
                    html={content.includes('<') ? content : `<p>${content.replace(/\n/g, '<br/>')}</p>`}
                    plainText={stripHtmlTags(content)}
                    mode="EDIT"
                    onChange={({ html }) => setContent(html)}
                    onInsertImageRequest={() => setShowImagePicker(true)}
                    onEditSelectedImage={(imgUrl) => {
                      setEditingImgSrc(imgUrl);
                      setImageEditorTarget({ title: `${title || 'Wiki'} Image`, imageUrl: imgUrl });
                    }}
                  />
                </Suspense>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                />
                Pin this guide to top of Knowledge Base
              </label>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold"
              >
                Publish Article
              </button>
            </div>
          </form>
        </div>
      )}

      <FileManagerPickerModal
        isOpen={showImagePicker}
        onClose={() => setShowImagePicker(false)}
        defaultFolderId="folder-images"
        imagesOnly
        title="Insert Diagram or Image into Wiki SOP"
        onSelectFile={(file) => {
          setShowImagePicker(false);
          setContent((prev) => `${prev}<p><img src="${file.url}" alt="${file.name}" style="max-width:100%;border-radius:10px;margin:8px 0;" /></p>`);
        }}
      />

      {imageEditorTarget && (
        <Suspense fallback={null}>
          <ImageEditorModal
            isOpen={Boolean(imageEditorTarget)}
            target={imageEditorTarget}
            onClose={() => setImageEditorTarget(null)}
            onSaved={(res) => {
              const newUrl = res.file?.url || res.dataUrl;
              if (editingImgSrc) {
                setContent((prev) => prev.split(editingImgSrc).join(newUrl));
              }
              setImageEditorTarget(null);
              setEditingImgSrc(null);
            }}
          />
        </Suspense>
      )}
    </div>
  );
};
