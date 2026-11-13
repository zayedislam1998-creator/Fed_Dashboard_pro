import React, { Suspense, lazy, useState, useEffect } from 'react';
import {
  Megaphone,
  FileText,
  Pin,
  Plus,
  Edit3,
  Trash2,
  Search,
  Tag,
  Image as ImageIcon,
  Paperclip,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Check,
  Copy,
  X,
  AlertTriangle,
  Calendar,
  Clock,
  Presentation,
  Eye,
} from 'lucide-react';
import {
  WorkspacePostNoticeItem,
  WorkspacePostCategory,
  WorkspacePostAttachment,
  fetchPostsAndNotices,
  savePostOrNotice,
  togglePinPostOrNotice,
  deletePostOrNotice,
  savePostCategory,
  deletePostCategory,
  formatBytes,
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

export type PostsNoticesSubTab = 'feed' | 'create_post' | 'categories';

interface PostsNoticesViewProps {
  activeSubTab?: PostsNoticesSubTab;
  onSelectSubTab?: (tab: PostsNoticesSubTab) => void;
  defaultAuthorName?: string;
}

export const PostsNoticesView: React.FC<PostsNoticesViewProps> = ({
  activeSubTab = 'feed',
  onSelectSubTab,
  defaultAuthorName = 'Workspace Admin',
}) => {
  const [subTab, setSubTab] = useState<PostsNoticesSubTab>(activeSubTab);
  const [items, setItems] = useState<WorkspacePostNoticeItem[]>([]);
  const [categories, setCategories] = useState<WorkspacePostCategory[]>([]);
  const [feedFilterType, setFeedFilterType] = useState<'ALL' | 'POST' | 'NOTICE'>('ALL');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedItem, setSelectedItem] = useState<WorkspacePostNoticeItem | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Pagination State (5 or 10 per page as requested)
  const [pageSize, setPageSize] = useState<number>(5);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Composer State (Post or Notice)
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [postType, setPostType] = useState<'POST' | 'NOTICE'>('POST');
  const [title, setTitle] = useState<string>('');
  const [summary, setSummary] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('cat-general');
  const [priority, setPriority] = useState<'Normal' | 'Important' | 'Urgent'>('Normal');
  const [authorName, setAuthorName] = useState<string>(defaultAuthorName);
  const [authorRole, setAuthorRole] = useState<string>('Founder & Chief Architect');
  const [coverImageUrl, setCoverImageUrl] = useState<string>('');
  const [attachments, setAttachments] = useState<WorkspacePostAttachment[]>([]);
  const [isPinned, setIsPinned] = useState<boolean>(false);
  const [pinDurationPreset, setPinDurationPreset] = useState<string>('FOREVER');
  const [pinnedUntilDate, setPinnedUntilDate] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // File Manager Picker State & Universal Document Engine State
  const [filePickerTarget, setFilePickerTarget] = useState<'cover' | 'attachment' | null>(null);
  const [engineTarget, setEngineTarget] = useState<UniversalEngineTarget | null>(null);
  const [editingCoverTarget, setEditingCoverTarget] = useState<ImageEditorTarget | null>(null);

  // Category Form State
  const [editingCatId, setEditingCatId] = useState<string | undefined>(undefined);
  const [catName, setCatName] = useState<string>('');
  const [catDesc, setCatDesc] = useState<string>('');
  const [catColor, setCatColor] = useState<string>('#0B57D0');

  useEffect(() => {
    setSubTab(activeSubTab);
  }, [activeSubTab]);

  const selectTab = (next: PostsNoticesSubTab) => {
    setSubTab(next);
    setSelectedItem(null);
    onSelectSubTab?.(next);
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await fetchPostsAndNotices();
      setItems(data.postsNotices);
      setCategories(data.categories);
      if (data.categories.length > 0 && !data.categories.some((c) => c.id === categoryId)) {
        setCategoryId(data.categories[0].id);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to load posts and notices.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [feedFilterType, selectedCategoryId, searchQuery, pageSize]);

  const resetComposer = (defaultType: 'POST' | 'NOTICE' = 'POST') => {
    setEditingId(undefined);
    setPostType(defaultType);
    setTitle('');
    setSummary('');
    setContent('');
    setCategoryId(
      defaultType === 'NOTICE'
        ? categories.find((c) => c.slug.includes('notice'))?.id || categories[0]?.id || 'cat-official'
        : categories[0]?.id || 'cat-general'
    );
    setPriority(defaultType === 'NOTICE' ? 'Important' : 'Normal');
    setAuthorName(defaultAuthorName);
    setAuthorRole('Workspace Admin');
    setCoverImageUrl('');
    setAttachments([]);
    setIsPinned(defaultType === 'NOTICE');
    setPinDurationPreset('FOREVER');
    setPinnedUntilDate('');
  };

  const handleOpenEdit = (item: WorkspacePostNoticeItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingId(item.id);
    setPostType(item.type);
    setTitle(item.title);
    setSummary(item.summary || '');
    setContent(item.content);
    setCategoryId(item.categoryId);
    setPriority(item.priority);
    setAuthorName(item.authorName);
    setAuthorRole(item.authorRole);
    setCoverImageUrl(item.coverImageUrl || '');
    setAttachments(item.attachments || []);
    setIsPinned(item.isPinned);
    if (item.pinnedUntil) {
      setPinDurationPreset('CUSTOM');
      setPinnedUntilDate(item.pinnedUntil);
    } else {
      setPinDurationPreset('FOREVER');
      setPinnedUntilDate('');
    }
    selectTab('create_post');
  };

  const computePinnedUntilString = (): string => {
    if (!isPinned) return '';
    if (pinDurationPreset === 'FOREVER') return '';
    if (pinDurationPreset === '7_DAYS') {
      return new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    }
    if (pinDurationPreset === '15_DAYS') {
      return new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10);
    }
    if (pinDurationPreset === '30_DAYS') {
      return new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    }
    return pinnedUntilDate;
  };

  const handleSavePostOrNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setIsSaving(true);
    setErrorMsg(null);

    try {
      const cat = categories.find((c) => c.id === categoryId);
      const res = await savePostOrNotice({
        id: editingId,
        type: postType,
        title: title.trim(),
        summary: summary.trim(),
        content,
        categoryId,
        categoryName: cat?.name || 'General Update',
        authorName: authorName.trim() || 'Workspace Admin',
        authorRole: authorRole.trim(),
        coverImageUrl: coverImageUrl.trim() || undefined,
        attachments,
        isPinned,
        pinnedUntil: computePinnedUntilString(),
        priority,
      });

      setItems(res.postsNotices);
      setToastMsg(
        editingId
          ? `${postType === 'NOTICE' ? 'Notice' : 'Post'} "${res.item.title}" updated.`
          : `New ${postType === 'NOTICE' ? 'Notice' : 'Post'} published and saved in database.`
      );
      setTimeout(() => setToastMsg(null), 3500);
      resetComposer();
      selectTab('feed');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTogglePin = async (item: WorkspacePostNoticeItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const res = await togglePinPostOrNotice(item.id, {
        isPinned: !item.isPinned,
        pinnedUntil: !item.isPinned ? '' : undefined,
      });
      setItems(res.postsNotices);
      if (selectedItem?.id === item.id) {
        setSelectedItem(res.item);
      }
      setToastMsg(
        res.item.isPinned
          ? `Pinned "${res.item.title}" to the top of the feed.`
          : `Unpinned "${res.item.title}".`
      );
      setTimeout(() => setToastMsg(null), 2500);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not toggle pin.');
    }
  };

  const handleDeleteItem = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const updated = await deletePostOrNotice(id);
      setItems(updated);
      if (selectedItem?.id === id) setSelectedItem(null);
      setToastMsg('Item deleted.');
      setTimeout(() => setToastMsg(null), 2500);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to delete item.');
    }
  };

  const handleCopyItemLink = (item: WorkspacePostNoticeItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const text = `${item.title}\n\n${item.summary}\n\nCategory: ${item.categoryName}`;
    navigator.clipboard.writeText(text);
    setCopiedId(item.id);
    setToastMsg(`Copied "${item.title}"`);
    setTimeout(() => {
      setCopiedId(null);
      setToastMsg(null);
    }, 2500);
  };

  const handleSaveCategoryForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    try {
      const res = await savePostCategory({
        id: editingCatId,
        name: catName.trim(),
        description: catDesc.trim(),
        color: catColor,
      });
      setCategories(res.categories);
      if (res.postsNotices) setItems(res.postsNotices);
      setEditingCatId(undefined);
      setCatName('');
      setCatDesc('');
      setToastMsg(`Category "${res.category.name}" saved.`);
      setTimeout(() => setToastMsg(null), 2500);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save category.');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      const updated = await deletePostCategory(id);
      setCategories(updated);
      if (selectedCategoryId === id) setSelectedCategoryId('ALL');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not delete category.');
    }
  };

  // Filter & Sort Logic:
  // 1. Pinned items always stay at the very top, followed by Recent Notices, then newest items
  const filteredItems = items
    .filter((item) => {
      if (feedFilterType !== 'ALL' && item.type !== feedFilterType) return false;
      if (selectedCategoryId !== 'ALL' && item.categoryId !== selectedCategoryId) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.title.toLowerCase().includes(q) ||
          item.content.toLowerCase().includes(q) ||
          item.categoryName.toLowerCase().includes(q) ||
          item.authorName.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      // Pinned items always come first
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      // Among non-pinned items, urgent/recent notices come before regular posts
      if (a.type === 'NOTICE' && b.type !== 'NOTICE') return -1;
      if (a.type !== 'NOTICE' && b.type === 'NOTICE') return 1;
      return b.timestamp - a.timestamp;
    });

  const pinnedItems = filteredItems.filter((i) => i.isPinned);
  const totalItems = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIdx = (safePage - 1) * pageSize;
  const paginatedItems = filteredItems.slice(startIdx, startIdx + pageSize);

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 md:rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
      {/* Top Navigation Bar: 3 Clean Tabs (Posts & Notices | Create Post / Notice | Categories) */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-200/80 dark:border-slate-800 bg-[#F8FAFD] dark:bg-slate-900 shrink-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => selectTab('feed')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              subTab === 'feed'
                ? 'bg-[#0B57D0] text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
            }`}
          >
            <Megaphone className="w-3.5 h-3.5" />
            <span>Posts & Notices ({items.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (subTab !== 'create_post') resetComposer('POST');
              selectTab('create_post');
            }}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              subTab === 'create_post'
                ? 'bg-[#0B57D0] text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{editingId ? 'Edit Item' : 'Create Post / Notice'}</span>
          </button>

          <button
            type="button"
            onClick={() => selectTab('categories')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              subTab === 'categories'
                ? 'bg-[#0B57D0] text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>Categories ({categories.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (subTab !== 'feed') selectTab('feed');
              }}
              placeholder="Search posts & notices..."
              className="pl-8 pr-3 py-1.5 text-xs rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-600 w-48 sm:w-60"
            />
          </div>
        </div>
      </div>

      {/* Banners */}
      {toastMsg && (
        <div className="flex items-center justify-between px-4 py-2 bg-emerald-50 dark:bg-emerald-950/60 border-b border-emerald-200 text-xs font-medium text-emerald-800 dark:text-emerald-200">
          <span className="flex items-center gap-2">
            <Check className="w-4 h-4" />
            {toastMsg}
          </span>
          <button type="button" onClick={() => setToastMsg(null)}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center justify-between px-4 py-2 bg-red-50 dark:bg-red-950/60 border-b border-red-200 text-xs text-red-700 dark:text-red-300">
          <span>{errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg(null)}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* TAB 1: UNIFIED POSTS & NOTICES FEED WITH PINNED TOP & PAGINATION */}
      {subTab === 'feed' && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Filter Bar: All | All Notices | All Posts + Clean Category Dropdown (<select>) + Page Size */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 shrink-0">
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { id: 'ALL', label: `All (${items.length})` },
                {
                  id: 'NOTICE',
                  label: `All Notices (${items.filter((i) => i.type === 'NOTICE').length})`,
                },
                {
                  id: 'POST',
                  label: `All Posts (${items.filter((i) => i.type === 'POST').length})`,
                },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setFeedFilterType(t.id as any);
                    setSelectedItem(null);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                    feedFilterType === t.id
                      ? 'bg-[#0B57D0] text-white shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {t.label}
                </button>
              ))}

              <span className="text-slate-300 hidden sm:inline">|</span>

              {/* Clean Category Dropdown with Exact Item Counts */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 hidden sm:inline">
                  Category:
                </span>
                <select
                  value={selectedCategoryId}
                  onChange={(e) => {
                    setSelectedCategoryId(e.target.value);
                    setSelectedItem(null);
                  }}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#0B57D0]"
                >
                  <option value="ALL">All Categories ({items.length})</option>
                  {categories.map((cat) => {
                    const catCount = items.filter((i) => i.categoryId === cat.id).length;
                    return (
                      <option key={cat.id} value={cat.id}>
                        {cat.name} ({catCount})
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500 shrink-0">
              <span>Show:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                <option value={5}>5 per page</option>
                <option value={10}>10 per page</option>
              </select>
            </div>
          </div>

          {/* Main Reader or Paginated List */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6">
            {selectedItem ? (
              /* Full Post / Notice Reader View */
              <div className="max-w-4xl mx-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-b border-slate-100 dark:border-slate-800 bg-[#F8FAFD] dark:bg-slate-800/60">
                  <button
                    type="button"
                    onClick={() => setSelectedItem(null)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back to Feed</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => handleTogglePin(selectedItem, e)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                        selectedItem.isPinned
                          ? 'bg-amber-50 border-amber-300 text-amber-800'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Pin className="w-3.5 h-3.5" />
                      <span>{selectedItem.isPinned ? 'Pinned to Top' : 'Pin to Top'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleOpenEdit(selectedItem, e)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleDeleteItem(selectedItem.id, e)}
                      className="p-1.5 rounded-full text-slate-400 hover:text-red-600 hover:bg-red-50"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {selectedItem.coverImageUrl && (
                  <div className="max-h-80 overflow-hidden bg-slate-100 border-b border-slate-100">
                    <img
                      src={selectedItem.coverImageUrl}
                      alt={selectedItem.title}
                      className="w-full h-72 object-cover"
                    />
                  </div>
                )}

                <div className="p-6 md:p-8 space-y-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                        selectedItem.type === 'NOTICE'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-blue-100 text-[#0B57D0]'
                      }`}
                    >
                      {selectedItem.type === 'NOTICE' ? 'Official Notice' : 'Workspace Post'}
                    </span>

                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {selectedItem.categoryName}
                    </span>

                    {selectedItem.priority !== 'Normal' && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                        {selectedItem.priority} Priority
                      </span>
                    )}

                    {selectedItem.isPinned && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        <Pin className="w-3 h-3" />
                        Pinned {selectedItem.pinnedUntil ? `until ${selectedItem.pinnedUntil}` : 'Indefinitely'}
                      </span>
                    )}
                  </div>

                  <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100 leading-snug">
                    {selectedItem.title}
                  </h1>

                  <div className="flex items-center justify-between text-xs text-slate-500 pb-4 border-b border-slate-100 dark:border-slate-800">
                    <div>
                      Published by <strong>{selectedItem.authorName}</strong> ({selectedItem.authorRole})
                    </div>
                    <div>
                      {selectedItem.createdAt} · Updated {selectedItem.updatedAt}
                    </div>
                  </div>

                  <div className="whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                    {selectedItem.content}
                  </div>

                  {selectedItem.attachments && selectedItem.attachments.length > 0 && (
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                      <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <Paperclip className="w-3.5 h-3.5 text-[#0B57D0]" />
                        <span>
                          Attached Documents, Slides & PDFs ({selectedItem.attachments.length}) — Click to Open Instantly in App
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2.5">
                        {selectedItem.attachments.map((att) => {
                          const ext = (
                            att.extension ||
                            att.name.split('.').pop() ||
                            ''
                          ).toLowerCase();
                          const isSlide =
                            Boolean(att.slideDeckId) || ext === 'slides' || ext === 'pptx';
                          const isPdf = ext === 'pdf' || att.mimeType.includes('pdf');

                          return (
                            <button
                              key={att.id}
                              type="button"
                              onClick={() =>
                                setEngineTarget({
                                  title: att.name,
                                  url: att.url,
                                  mimeType: att.mimeType,
                                  extension: ext,
                                  fileId: att.fileId || att.id,
                                  slideDeckId: att.slideDeckId,
                                  docId: att.docId,
                                  initialMode: 'VIEW',
                                })
                              }
                              className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-[#0B57D0] hover:bg-blue-50/40 text-xs font-semibold text-slate-800 dark:text-slate-200 transition-all cursor-pointer"
                            >
                              {isSlide ? (
                                <Presentation className="w-4 h-4 text-amber-600 shrink-0" />
                              ) : isPdf ? (
                                <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-extrabold shrink-0">
                                  PDF
                                </span>
                              ) : (
                                <FileText className="w-4 h-4 text-[#0B57D0] shrink-0" />
                              )}
                              <span>{att.name}</span>
                              <span className="text-[10px] text-slate-400">
                                ({formatBytes(att.sizeBytes)})
                              </span>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#0B57D0] text-white text-[10px] font-bold">
                                <Eye className="w-3 h-3" />
                                View Instantly
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : isLoading ? (
              <div className="text-center py-12 text-xs text-slate-400">
                Loading posts and notices...
              </div>
            ) : paginatedItems.length === 0 ? (
              <div className="text-center py-14 space-y-2">
                <Megaphone className="w-10 h-10 text-slate-300 mx-auto" />
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  No posts or notices found
                </div>
                <p className="text-xs text-slate-500">
                  Use the &ldquo;+ Create Post / Notice&rdquo; tab above to publish an update.
                </p>
              </div>
            ) : (
              <div className="max-w-5xl mx-auto space-y-5">
                {/* Summary Banner for Pinned & Recent Notices */}
                {pinnedItems.length > 0 && safePage === 1 && (
                  <div className="flex items-center justify-between px-4 py-2 rounded-xl bg-amber-50/90 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200">
                    <span className="flex items-center gap-2 font-semibold">
                      <Pin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>
                        {pinnedItems.length} Pinned Post(s) & Notice(s) kept at the top of your workspace feed
                      </span>
                    </span>
                    <span className="text-[11px] opacity-80">
                      Click the pin icon on any row to pin or unpin
                    </span>
                  </div>
                )}

                {/* Paginated Posts & Notices List */}
                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200/90 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-2xs">
                  {paginatedItems.map((item) => {
                    const cat = categories.find((c) => c.id === item.categoryId);
                    const isCopied = copiedId === item.id;

                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedItem(item)}
                        className={`group flex items-center justify-between gap-3 px-4 py-3 cursor-pointer transition-colors ${
                          item.isPinned
                            ? 'bg-amber-50/35 dark:bg-amber-950/15 hover:bg-amber-50/70'
                            : 'hover:bg-blue-50/40 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {item.coverImageUrl ? (
                            <img
                              src={item.coverImageUrl}
                              alt={item.title}
                              className="w-10 h-10 rounded-xl object-cover shrink-0 border border-slate-200"
                            />
                          ) : (
                            <div
                              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                item.type === 'NOTICE'
                                  ? 'bg-red-50 text-red-600 dark:bg-red-950/60'
                                  : 'bg-blue-50 text-[#0B57D0] dark:bg-blue-950/60'
                              }`}
                            >
                              {item.type === 'NOTICE' ? (
                                <Megaphone className="w-4 h-4" />
                              ) : (
                                <FileText className="w-4 h-4" />
                              )}
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 min-w-0">
                              {item.isPinned && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 shrink-0">
                                  <Pin className="w-2.5 h-2.5" />
                                  Pinned
                                  {item.pinnedUntil ? ` (${item.pinnedUntil})` : ''}
                                </span>
                              )}

                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                                  item.type === 'NOTICE'
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-blue-100 text-[#0B57D0]'
                                }`}
                              >
                                {item.type}
                              </span>

                              <span
                                className="px-2 py-0.5 rounded-full text-[10px] font-semibold text-white shrink-0"
                                style={{ backgroundColor: cat?.color || '#0B57D0' }}
                              >
                                {item.categoryName}
                              </span>

                              <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                                {item.title}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-xs text-slate-500 truncate mt-0.5">
                              <span className="truncate">{item.summary}</span>
                              <span className="shrink-0">· {item.authorName}</span>
                              <span className="shrink-0">· {item.createdAt}</span>
                            </div>

                            {item.attachments && item.attachments.length > 0 && (
                              <div
                                className="flex flex-wrap items-center gap-1.5 mt-2"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {item.attachments.map((att) => {
                                  const ext = (
                                    att.extension ||
                                    att.name.split('.').pop() ||
                                    ''
                                  ).toLowerCase();
                                  const isSlide =
                                    Boolean(att.slideDeckId) || ext === 'slides' || ext === 'pptx';
                                  const isPdf = ext === 'pdf' || att.mimeType.includes('pdf');
                                  return (
                                    <button
                                      key={att.id}
                                      type="button"
                                      onClick={() =>
                                        setEngineTarget({
                                          title: att.name,
                                          url: att.url,
                                          mimeType: att.mimeType,
                                          extension: ext,
                                          fileId: att.fileId || att.id,
                                          slideDeckId: att.slideDeckId,
                                          docId: att.docId,
                                          initialMode: 'VIEW',
                                        })
                                      }
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-[#0B57D0] text-[11px] font-semibold text-slate-700 cursor-pointer"
                                    >
                                      {isSlide ? (
                                        <Presentation className="w-3 h-3 text-amber-600" />
                                      ) : isPdf ? (
                                        <span className="text-[9px] font-extrabold text-red-600">
                                          PDF
                                        </span>
                                      ) : (
                                        <FileText className="w-3 h-3 text-[#0B57D0]" />
                                      )}
                                      <span className="truncate max-w-[180px]">{att.name}</span>
                                      <span className="text-[10px] text-[#0B57D0] font-bold">
                                        View
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Right: Single-Line Actions (Pin/Unpin, Copy, Edit, Delete) */}
                        <div
                          className="flex items-center gap-1.5 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={(e) => handleTogglePin(item, e)}
                            className={`p-1.5 rounded-lg border transition-colors ${
                              item.isPinned
                                ? 'bg-amber-100 border-amber-300 text-amber-800'
                                : 'border-slate-200 dark:border-slate-700 text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                            }`}
                            title={item.isPinned ? 'Unpin from Top' : 'Pin to Top'}
                          >
                            <Pin className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleCopyItemLink(item, e)}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                            title="Copy Summary"
                          >
                            {isCopied ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleOpenEdit(item, e)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                            title="Edit Post / Notice"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleDeleteItem(item.id, e)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 px-1 text-xs text-slate-600 dark:text-slate-300">
                  <div>
                    Showing <strong>{startIdx + 1}</strong>–
                    <strong>{Math.min(startIdx + pageSize, totalItems)}</strong> of{' '}
                    <strong>{totalItems}</strong> Posts & Notices
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={safePage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40 hover:bg-slate-50 font-semibold"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Prev</span>
                    </button>

                    {Array.from({ length: totalPages }).map((_, idx) => {
                      const pNum = idx + 1;
                      return (
                        <button
                          key={pNum}
                          type="button"
                          onClick={() => setCurrentPage(pNum)}
                          className={`w-8 h-8 rounded-xl font-bold transition-colors ${
                            safePage === pNum
                              ? 'bg-[#0B57D0] text-white'
                              : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50'
                          }`}
                        >
                          {pNum}
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      disabled={safePage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40 hover:bg-slate-50 font-semibold"
                    >
                      <span>Next</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: CREATE / EDIT POST OR NOTICE */}
      {subTab === 'create_post' && (
        <div className="flex-1 overflow-y-auto p-5 md:p-8">
          <div className="max-w-3xl mx-auto">
            <form
              onSubmit={handleSavePostOrNotice}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5 shadow-2xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {editingId
                      ? `Update ${postType === 'NOTICE' ? 'Notice' : 'Post'}`
                      : `Publish Professional ${postType === 'NOTICE' ? 'Notice' : 'Post'}`}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Full database persistence with top pinning, categories, and compressed server media.
                  </p>
                </div>

                {/* Switch between Post and Notice */}
                <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-full">
                  <button
                    type="button"
                    onClick={() => setPostType('POST')}
                    className={`px-3.5 py-1 rounded-full text-xs font-bold transition-colors ${
                      postType === 'POST'
                        ? 'bg-[#0B57D0] text-white'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    Post / Article
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPostType('NOTICE');
                      setIsPinned(true);
                    }}
                    className={`px-3.5 py-1 rounded-full text-xs font-bold transition-colors ${
                      postType === 'NOTICE'
                        ? 'bg-red-600 text-white'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    Official Notice
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {postType === 'NOTICE' ? 'Notice Headline / Title *' : 'Post Title *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={
                      postType === 'NOTICE'
                        ? 'e.g. Urgent Server Maintenance & Security Notice'
                        : 'e.g. Q4 Product Architecture & Team Roadmap'
                    }
                    className="w-full px-3.5 py-2 text-sm font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Category *
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Pin to Top & Duration Controls */}
              <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/50 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="flex items-center gap-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isPinned}
                      onChange={(e) => setIsPinned(e.target.checked)}
                      className="rounded accent-[#0B57D0] w-4 h-4"
                    />
                    <Pin className="w-4 h-4 text-amber-600" />
                    <span>Pin this {postType === 'NOTICE' ? 'Notice' : 'Post'} to the Top of Feed</span>
                  </label>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Priority:</span>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as any)}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    >
                      <option value="Normal">Normal</option>
                      <option value="Important">Important</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </div>
                </div>

                {isPinned && (
                  <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-amber-200/60 text-xs">
                    <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300 font-medium">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      Keep Pinned Duration:
                    </span>
                    <select
                      value={pinDurationPreset}
                      onChange={(e) => setPinDurationPreset(e.target.value)}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
                    >
                      <option value="FOREVER">Keep Pinned Indefinitely (As long as I want)</option>
                      <option value="7_DAYS">Keep Pinned for 7 Days</option>
                      <option value="15_DAYS">Keep Pinned for 15 Days</option>
                      <option value="30_DAYS">Keep Pinned for 30 Days</option>
                      <option value="CUSTOM">Pin Until Specific Date...</option>
                    </select>

                    {pinDurationPreset === 'CUSTOM' && (
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        <input
                          type="date"
                          value={pinnedUntilDate}
                          onChange={(e) => setPinnedUntilDate(e.target.value)}
                          className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-xs"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Short Summary / Excerpt (Optional)
                </label>
                <input
                  type="text"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Brief one-line summary shown in the feed list..."
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Full {postType === 'NOTICE' ? 'Notice' : 'Post'} Content *
                </label>
                <textarea
                  rows={9}
                  required
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write full post details, announcements, action items, or policy guidelines..."
                  className="w-full p-3.5 text-sm leading-relaxed rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              {/* Cover Image & Attachments Linked to Server File Manager */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    Cover Banner / Featured Photo
                  </div>
                  {coverImageUrl ? (
                    <div className="relative rounded-xl overflow-hidden border border-slate-200 h-28 bg-white">
                      <img
                        src={coverImageUrl}
                        alt="Cover"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setEditingCoverTarget({
                              title: title || 'Post Cover Banner',
                              imageUrl: coverImageUrl,
                              defaultAspect: '16:9',
                            })
                          }
                          className="px-2 py-1 rounded-full bg-purple-600/90 hover:bg-purple-500 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer shadow"
                        >
                          <Edit3 className="w-3 h-3" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setCoverImageUrl('')}
                          className="p-1 rounded-full bg-slate-900/70 text-white hover:bg-red-600 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setFilePickerTarget('cover')}
                      className="w-full py-4 px-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-[#0B57D0] text-xs font-semibold text-[#0B57D0] flex items-center justify-center gap-2 bg-white dark:bg-slate-900"
                    >
                      <ImageIcon className="w-4 h-4" />
                      <span>Select / Upload Cover Photo from File Manager</span>
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      Attachments ({attachments.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => setFilePickerTarget('attachment')}
                      className="text-xs font-semibold text-[#0B57D0] hover:underline flex items-center gap-1"
                    >
                      <Paperclip className="w-3.5 h-3.5" />
                      <span>+ Attach from File Manager</span>
                    </button>
                  </div>

                  {attachments.length === 0 ? (
                    <div className="text-[11px] text-slate-400 py-4 text-center border border-dashed border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900">
                      No files attached yet
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-28 overflow-y-auto">
                      {attachments.map((att) => (
                        <div
                          key={att.id}
                          className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
                        >
                          <span className="truncate font-medium">{att.name}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setAttachments((prev) => prev.filter((a) => a.id !== att.id))
                            }
                            className="text-slate-400 hover:text-red-600 ml-2"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Author Name
                  </label>
                  <input
                    type="text"
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Author Role / Department
                  </label>
                  <input
                    type="text"
                    value={authorRole}
                    onChange={(e) => setAuthorRole(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => selectTab('feed')}
                  className="px-4 py-2 text-xs font-medium text-slate-600 rounded-full hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className={`px-6 py-2.5 rounded-full text-white text-xs font-bold shadow-sm transition-all ${
                    postType === 'NOTICE'
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-[#0B57D0] hover:bg-blue-700'
                  }`}
                >
                  {isSaving
                    ? 'Saving...'
                    : editingId
                    ? 'Save Changes'
                    : `Publish ${postType === 'NOTICE' ? 'Official Notice' : 'Post'}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 3: CATEGORIES MANAGEMENT */}
      {subTab === 'categories' && (
        <div className="flex-1 overflow-y-auto p-5 md:p-8">
          <div className="max-w-4xl mx-auto space-y-6">
            <form
              onSubmit={handleSaveCategoryForm}
              className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {editingCatId ? 'Edit Category' : 'Create New Post / Notice Category'}
                </h3>
                {editingCatId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCatId(undefined);
                      setCatName('');
                      setCatDesc('');
                    }}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    + Add New Instead
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  required
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  placeholder="Category Name *"
                  className="px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
                <input
                  type="text"
                  value={catDesc}
                  onChange={(e) => setCatDesc(e.target.value)}
                  placeholder="Category Description"
                  className="px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={catColor}
                    onChange={(e) => setCatColor(e.target.value)}
                    className="w-9 h-9 rounded-lg border border-slate-200 cursor-pointer shrink-0"
                  />
                  <button
                    type="submit"
                    className="flex-1 py-2 px-4 rounded-xl bg-[#0B57D0] hover:bg-blue-700 text-white text-xs font-semibold"
                  >
                    {editingCatId ? 'Update Category' : '+ Save Category'}
                  </button>
                </div>
              </div>
            </form>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
              {categories.map((cat) => {
                const count = items.filter((i) => i.categoryId === cat.id).length;
                return (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between gap-3 px-4 py-3 text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className="w-3.5 h-3.5 rounded-full shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      <div>
                        <div className="font-bold text-slate-900 dark:text-slate-100">
                          {cat.name}{' '}
                          <span className="font-normal text-slate-400">({count} items)</span>
                        </div>
                        <div className="text-slate-500">{cat.description}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCatId(cat.id);
                          setCatName(cat.name);
                          setCatDesc(cat.description);
                          setCatColor(cat.color);
                        }}
                        className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(cat.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Server File Manager Picker Modal */}
      <FileManagerPickerModal
        isOpen={filePickerTarget !== null}
        onClose={() => setFilePickerTarget(null)}
        defaultFolderId={filePickerTarget === 'cover' ? 'folder-posts' : 'folder-documents'}
        imagesOnly={filePickerTarget === 'cover'}
        title={
          filePickerTarget === 'cover'
            ? 'Select or Upload Cover Photo from Server File Manager'
            : 'Attach PDF, Google Slide, Document or Media from Server File Manager'
        }
        onSelectFile={(file) => {
          if (filePickerTarget === 'cover') {
            setCoverImageUrl(file.url);
          } else {
            setAttachments((prev) => [
              ...prev,
              {
                id: file.id,
                name: file.name,
                url: file.url,
                mimeType: file.mimeType,
                sizeBytes: file.compressedSizeBytes,
                fileId: file.id,
                slideDeckId: file.slideDeckId,
                docId: file.docId,
                extension: file.extension,
              },
            ]);
          }
        }}
      />

      {/* Universal Document, Slide & PDF Instant Engine Modal */}
      <UniversalDocumentEngineModal
        isOpen={Boolean(engineTarget)}
        target={engineTarget}
        onClose={() => setEngineTarget(null)}
        onSavedOrUpdated={loadData}
      />

      {editingCoverTarget && (
        <Suspense fallback={null}>
          <ImageEditorModal
            isOpen={Boolean(editingCoverTarget)}
            target={editingCoverTarget}
            onClose={() => setEditingCoverTarget(null)}
            onSaved={(res) => {
              setCoverImageUrl(res.file?.url || res.dataUrl);
              setEditingCoverTarget(null);
            }}
          />
        </Suspense>
      )}
    </div>
  );
};
