import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { Folder, FolderPlus, Upload, Search, Image as ImageIcon, FileText, FileSpreadsheet, Presentation, Film, Code, Trash2, RotateCcw, Share2, Copy, Edit3, Eye, Mail, Download, MoreHorizontal, Grid, List as ListIcon, CheckSquare, Square, ChevronRight, Home, Sparkles, Layers, X, Check, AlertCircle, RefreshCw, FolderInput, Sliders, FilePlus2, ZoomIn, ZoomOut, Lock, Globe, Users } from 'lucide-react';
import {
  deleteWorkspaceFile,
  deleteWorkspaceFolder,
  duplicateWorkspaceFile,
  emptyFilesTrash,
  fetchFileShares,
  fetchTrashedFiles,
  fetchWorkspaceFiles,
  formatBytes,
  renameOrMoveWorkspaceFile,
  restoreTrashedFile,
  saveFileShares,
  saveWorkspaceFolder,
  uploadFilesBinary,
  WorkspaceFileFolder,
  WorkspaceFileItem,
} from '../../services/workspaceApi';
import { convertViaEngine, prefetchEngineFile } from '../../services/engineCache';
import {
  UniversalDocumentEngineModal,
  UniversalEngineTarget,
} from '../shared/UniversalDocumentEngineModal';
import type { ImageEditorTarget } from '../shared/ImageEditorModal';

const ImageEditorModal = lazy(() =>
  import('../shared/ImageEditorModal').then((m) => ({ default: m.ImageEditorModal }))
);
const BatchImageModal = lazy(() =>
  import('../shared/BatchImageModal').then((m) => ({ default: m.BatchImageModal }))
);

export type FileManagerSubTab = 'all_files' | 'galleries' | 'documents';

interface FileManagerViewProps {
  activeSubTab?: FileManagerSubTab;
  onSelectSubTab?: (tab: FileManagerSubTab) => void;
  onSendFileViaMail?: (file: WorkspaceFileItem) => void;
}

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp', 'avif']);

function isImageFile(file: WorkspaceFileItem): boolean {
  return (
    file.isImage ||
    file.mimeType.startsWith('image/') ||
    IMAGE_EXTENSIONS.has((file.extension || '').toLowerCase())
  );
}

function getFileIcon(file: WorkspaceFileItem) {
  const ext = (file.extension || '').toLowerCase();
  if (isImageFile(file)) return <ImageIcon className="w-5 h-5 text-purple-600" />;
  if (['xlsx', 'xls', 'csv'].includes(ext)) return <FileSpreadsheet className="w-5 h-5 text-emerald-600" />;
  if (['pptx', 'slides'].includes(ext)) return <Presentation className="w-5 h-5 text-amber-600" />;
  if (ext === 'pdf') return <FileText className="w-5 h-5 text-red-600" />;
  if (['mp4', 'webm', 'mov', 'mp3', 'wav', 'ogg'].includes(ext)) return <Film className="w-5 h-5 text-pink-600" />;
  if (['json', 'js', 'ts', 'tsx', 'html', 'css', 'sql', 'py'].includes(ext)) return <Code className="w-5 h-5 text-cyan-600" />;
  return <FileText className="w-5 h-5 text-[#0B57D0]" />;
}

export const FileManagerView: React.FC<FileManagerViewProps> = ({
  activeSubTab = 'all_files',
  onSelectSubTab,
  onSendFileViaMail,
}) => {
  const [subTab, setSubTab] = useState<FileManagerSubTab>(activeSubTab);
  const [viewMode, setViewMode] = useState<'ALL' | 'TRASH'>('ALL');
  const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>('grid');

  const [files, setFiles] = useState<WorkspaceFileItem[]>([]);
  const [folders, setFolders] = useState<WorkspaceFileFolder[]>([]);
  const [trashedFiles, setTrashedFiles] = useState<WorkspaceFileItem[]>([]);
  const [trashCount, setTrashCount] = useState(0);

  const [activeFolderId, setActiveFolderId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);

  // Multi-select
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modals
  const [engineTarget, setEngineTarget] = useState<UniversalEngineTarget | null>(null);
  const [imageEditorTarget, setImageEditorTarget] = useState<ImageEditorTarget | null>(null);
  const [showBatchImageModal, setShowBatchImageModal] = useState(false);
  const [lightboxFile, setLightboxFile] = useState<WorkspaceFileItem | null>(null);
  const [lightboxZoom, setLightboxZoom] = useState(100);

  // Create Folder / Subfolder Modal
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderType, setNewFolderType] = useState<'FOLDER' | 'GALLERY' | 'DOCUMENT'>('FOLDER');
  const [newFolderParentId, setNewFolderParentId] = useState<string>('');

  // Rename / Move Modal
  const [renameTarget, setRenameTarget] = useState<WorkspaceFileItem | null>(null);
  const [renameNameInput, setRenameNameInput] = useState('');
  const [moveTargetFolderId, setMoveTargetFolderId] = useState('');
  const [showBulkMoveModal, setShowBulkMoveModal] = useState(false);

  // Share Modal
  const [shareTarget, setShareTarget] = useState<WorkspaceFileItem | null>(null);
  const [shareVisibility, setShareVisibility] = useState<'PRIVATE' | 'WORKSPACE' | 'PUBLIC'>('WORKSPACE');
  const [shareGrants, setShareGrants] = useState<Array<{ targetUserId: string; accessLevel: 'VIEW' | 'EDIT' }>>([]);
  const [shareUsers, setShareUsers] = useState<Array<{ id: string; name: string; email: string; role: string }>>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSubTab(activeSubTab);
  }, [activeSubTab]);

  const showNotice = (text: string, ok = true) => {
    setToast({ text, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const loadFiles = async (q = searchQuery) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetchWorkspaceFiles(q);
      setFiles(res.files || []);
      setFolders(res.folders || []);
      setTrashCount(res.trashCount ?? 0);
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not reach Embedded File Manager API.');
    } finally {
      setLoading(false);
    }
  };

  const loadTrash = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const list = await fetchTrashedFiles();
      setTrashedFiles(list);
      setTrashCount(list.length);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load Trash.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => {
      if (viewMode === 'ALL') loadFiles(searchQuery);
    }, searchQuery ? 250 : 0);
    return () => clearTimeout(t);
  }, [searchQuery, viewMode]);

  useEffect(() => {
    if (viewMode === 'TRASH') {
      loadTrash();
    }
  }, [viewMode]);

  const folderMap = useMemo(() => {
    const map = new Map<string, WorkspaceFileFolder>();
    folders.forEach((f) => map.set(f.id, f));
    return map;
  }, [folders]);

  const breadcrumbPath = useMemo(() => {
    if (activeFolderId === 'ALL') return [];
    const chain: WorkspaceFileFolder[] = [];
    let cur = folderMap.get(activeFolderId);
    const seen = new Set<string>();
    while (cur && !seen.has(cur.id)) {
      chain.unshift(cur);
      seen.add(cur.id);
      cur = cur.parentFolderId ? folderMap.get(cur.parentFolderId) : undefined;
    }
    return chain;
  }, [activeFolderId, folderMap]);

  const childFolders = useMemo(() => {
    if (activeFolderId === 'ALL') {
      return folders.filter((f) => !f.parentFolderId);
    }
    return folders.filter((f) => f.parentFolderId === activeFolderId);
  }, [folders, activeFolderId]);

  const descendantFolderIds = useMemo(() => {
    if (activeFolderId === 'ALL') return null;
    const set = new Set<string>([activeFolderId]);
    let added = true;
    while (added) {
      added = false;
      for (const f of folders) {
        if (f.parentFolderId && set.has(f.parentFolderId) && !set.has(f.id)) {
          set.add(f.id);
          added = true;
        }
      }
    }
    return set;
  }, [folders, activeFolderId]);

  const visibleFiles = useMemo(() => {
    if (viewMode === 'TRASH') {
      const q = searchQuery.trim().toLowerCase();
      return trashedFiles.filter((f) => !q || f.name.toLowerCase().includes(q));
    }

    return files.filter((f) => {
      if (descendantFolderIds && !descendantFolderIds.has(f.folderId)) return false;
      if (subTab === 'galleries' && !isImageFile(f)) return false;
      if (subTab === 'documents' && isImageFile(f)) return false;
      return true;
    });
  }, [files, trashedFiles, viewMode, descendantFolderIds, subTab, searchQuery]);

  const selectedFiles = useMemo(
    () => files.filter((f) => selectedIds.includes(f.id)),
    [files, selectedIds]
  );
  const selectedImages = useMemo(() => selectedFiles.filter(isImageFile), [selectedFiles]);
  const selectedPdfs = useMemo(
    () => selectedFiles.filter((f) => (f.extension || '').toLowerCase() === 'pdf'),
    [selectedFiles]
  );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    if (visibleFiles.length > 0 && visibleFiles.every((f) => selectedIds.includes(f.id))) {
      setSelectedIds([]);
    } else {
      setSelectedIds(visibleFiles.map((f) => f.id));
    }
  };

  const handleUploadFiles = async (fileList: FileList | File[]) => {
    const arr = Array.from(fileList);
    if (arr.length === 0) return;
    setUploading(true);
    try {
      const targetFolder = activeFolderId === 'ALL'
        ? subTab === 'galleries'
          ? 'folder-images'
          : subTab === 'documents'
          ? 'folder-documents'
          : 'folder-general'
        : activeFolderId;
      const res = await uploadFilesBinary(arr, targetFolder);
      setFiles(res.files || []);
      setFolders(res.folders || []);
      setTrashCount(res.trashCount ?? trashCount);
      showNotice(`Uploaded ${res.uploadedFiles?.length || arr.length} file(s) with Unicode names & thumbnails!`);
    } catch (err: any) {
      showNotice(err.message || 'Upload failed.', false);
    } finally {
      setUploading(false);
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      const res = await saveWorkspaceFolder({
        name: newFolderName.trim(),
        folderType: newFolderType,
        parentFolderId: newFolderParentId || (activeFolderId !== 'ALL' ? activeFolderId : undefined),
      });
      setFolders(res.folders || []);
      setFiles(res.files || []);
      setNewFolderName('');
      setShowNewFolderModal(false);
      showNotice(`Created folder "${res.folder.name}".`);
    } catch (err: any) {
      showNotice(err.message || 'Failed to create folder.', false);
    }
  };

  const handleDeleteFolder = async (folder: WorkspaceFileFolder) => {
    if (!window.confirm(`Delete folder "${folder.name}"? Files inside will safely move to General Server Files.`)) {
      return;
    }
    try {
      const res = await deleteWorkspaceFolder(folder.id);
      setFolders(res.folders || []);
      setFiles(res.files || []);
      if (activeFolderId === folder.id) setActiveFolderId('ALL');
      showNotice(`Deleted folder "${folder.name}".`);
    } catch (err: any) {
      showNotice(err.message || 'Could not delete folder.', false);
    }
  };

  const openInEngine = (file: WorkspaceFileItem, initialMode: 'VIEW' | 'EDIT' = 'VIEW') => {
    setEngineTarget({
      title: file.name,
      url: file.url,
      mimeType: file.mimeType,
      extension: file.extension,
      fileId: file.id,
      slideDeckId: file.slideDeckId,
      docId: file.docId,
      initialMode,
    });
  };

  const openImageEditor = (file: WorkspaceFileItem) => {
    setImageEditorTarget({
      title: file.name,
      imageUrl: file.url,
      fileId: file.id,
    });
  };

  const handleMoveToTrash = async (file: WorkspaceFileItem) => {
    try {
      const res = await deleteWorkspaceFile(file.id, false);
      setFiles(res.files || []);
      setTrashCount(res.trashCount ?? trashCount + 1);
      setSelectedIds((prev) => prev.filter((id) => id !== file.id));
      showNotice(`Moved "${file.name}" to Trash.`);
    } catch (err: any) {
      showNotice(err.message || 'Failed to delete file.', false);
    }
  };

  const handleRestoreFile = async (file: WorkspaceFileItem) => {
    try {
      const res = await restoreTrashedFile(file.id);
      setFiles(res.files || []);
      setTrashCount(res.trashCount ?? 0);
      setTrashedFiles((prev) => prev.filter((f) => f.id !== file.id));
      showNotice(`Restored "${file.name}".`);
    } catch (err: any) {
      showNotice(err.message || 'Restore failed.', false);
    }
  };

  const handlePermanentDelete = async (file: WorkspaceFileItem) => {
    if (!window.confirm(`Permanently delete "${file.name}"? This cannot be undone.`)) return;
    try {
      const res = await deleteWorkspaceFile(file.id, true);
      setTrashedFiles((prev) => prev.filter((f) => f.id !== file.id));
      setTrashCount(res.trashCount ?? 0);
      showNotice(`Permanently deleted "${file.name}".`);
    } catch (err: any) {
      showNotice(err.message || 'Permanent delete failed.', false);
    }
  };

  const handleEmptyTrash = async () => {
    if (!window.confirm('Permanently delete all files in Trash?')) return;
    try {
      const res = await emptyFilesTrash();
      setFiles(res.files || []);
      setTrashedFiles([]);
      setTrashCount(0);
      showNotice('Trash emptied.');
    } catch (err: any) {
      showNotice(err.message || 'Failed to empty trash.', false);
    }
  };

  const handleDuplicate = async (file: WorkspaceFileItem) => {
    try {
      const res = await duplicateWorkspaceFile(file.id);
      setFiles(res.files || []);
      showNotice(`Created copy "${res.file.name}".`);
    } catch (err: any) {
      showNotice(err.message || 'Duplicate failed.', false);
    }
  };

  const handleSaveRenameMove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameTarget) return;
    try {
      const res = await renameOrMoveWorkspaceFile(renameTarget.id, {
        name: renameNameInput.trim() || renameTarget.name,
        folderId: moveTargetFolderId || renameTarget.folderId,
      });
      setFiles(res.files || []);
      setRenameTarget(null);
      showNotice(`Updated "${res.file.name}".`);
    } catch (err: any) {
      showNotice(err.message || 'Rename/Move failed.', false);
    }
  };

  const openShareDialog = async (file: WorkspaceFileItem) => {
    setShareTarget(file);
    try {
      const data = await fetchFileShares(file.id);
      setShareVisibility(data.visibility);
      setShareGrants(data.shares.map((s) => ({ targetUserId: s.targetUserId, accessLevel: s.accessLevel })));
      setShareUsers(data.users);
    } catch (err: any) {
      showNotice(err.message || 'Failed to load sharing settings.', false);
      setShareTarget(null);
    }
  };

  const handleSaveShareDialog = async () => {
    if (!shareTarget) return;
    try {
      const res = await saveFileShares(shareTarget.id, {
        visibility: shareVisibility,
        grants: shareGrants,
      });
      setFiles(res.files || []);
      setShareTarget(null);
      showNotice('File permissions updated.');
    } catch (err: any) {
      showNotice(err.message || 'Failed to save permissions.', false);
    }
  };

  const handleBatchImagesToPdf = async () => {
    if (selectedImages.length === 0) return;
    try {
      const res = await convertViaEngine({
        action: 'IMAGES_TO_PDF',
        fileIds: selectedImages.map((f) => f.id),
        title: `Images_Combined_${selectedImages.length}pages`,
      });
      setSelectedIds([]);
      await loadFiles();
      showNotice(`Created PDF "${res.file.name}" from ${selectedImages.length} image(s)!`);
    } catch (err: any) {
      showNotice(err.message || 'PDF conversion failed.', false);
    }
  };

  const handleBatchMergePdfs = async () => {
    if (selectedPdfs.length < 2) return;
    try {
      const res = await convertViaEngine({
        action: 'PDF_MERGE',
        fileIds: selectedPdfs.map((f) => f.id),
        title: `Merged_${selectedPdfs.length}_PDFs`,
      });
      setSelectedIds([]);
      await loadFiles();
      showNotice(`Merged ${selectedPdfs.length} PDFs into "${res.file.name}"!`);
    } catch (err: any) {
      showNotice(err.message || 'PDF merge failed.', false);
    }
  };

  const handleBatchMoveFolder = async (folderId: string) => {
    try {
      for (const id of selectedIds) {
        await renameOrMoveWorkspaceFile(id, { folderId });
      }
      setShowBulkMoveModal(false);
      setSelectedIds([]);
      await loadFiles();
      showNotice('Moved selected files.');
    } catch (err: any) {
      showNotice(err.message || 'Batch move failed.', false);
    }
  };

  const handleBatchTrash = async () => {
    try {
      for (const id of selectedIds) {
        await deleteWorkspaceFile(id, false);
      }
      setSelectedIds([]);
      await loadFiles();
      showNotice('Moved selected files to Trash.');
    } catch (err: any) {
      showNotice(err.message || 'Batch trash failed.', false);
    }
  };

  const totalStorageBytes = useMemo(
    () => files.reduce((sum, f) => sum + (f.compressedSizeBytes || 0), 0),
    [files]
  );

  return (
    <div
      className="flex-1 flex flex-col bg-[#F6F8FC] overflow-hidden relative"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDraggingOver(true);
      }}
      onDragLeave={() => setIsDraggingOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDraggingOver(false);
        if (e.dataTransfer?.files?.length) {
          handleUploadFiles(e.dataTransfer.files);
        }
      }}
    >
      {/* Drag-and-Drop Overlay */}
      {isDraggingOver && (
        <div className="absolute inset-0 z-40 bg-blue-600/15 border-4 border-dashed border-[#0B57D0] backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
          <div className="bg-white rounded-2xl px-8 py-6 shadow-xl border border-blue-200 text-center">
            <Upload className="w-10 h-10 text-[#0B57D0] mx-auto mb-2" />
            <p className="text-base font-bold text-slate-900">Drop Files Here to Upload</p>
            <p className="text-xs text-slate-500 mt-1">
              Supports multi-file upload, DOCX, PDF, PPTX, XLSX & Images with Unicode names
            </p>
          </div>
        </div>
      )}

      {/* Top Header Bar */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3.5 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <Folder className="w-5 h-5 text-[#0B57D0]" />
              Workspace Cloud Drive & Universal File Engine
            </h1>
            <p className="text-xs text-slate-500">
              {files.length} active file(s) â€¢ {formatBytes(totalStorageBytes)} used â€¢ Instant LRU cache + Full-text search + Smart Image Editor
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) handleUploadFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0B57D0] hover:bg-blue-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              {<Upload className="w-4 h-4" />}
              Upload Files
            </button>
            <button
              type="button"
              onClick={() => {
                setNewFolderParentId(activeFolderId !== 'ALL' ? activeFolderId : '');
                setShowNewFolderModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer"
            >
              <FolderPlus className="w-4 h-4 text-amber-600" />
              New Folder
            </button>
            <button
              type="button"
              onClick={() => setViewMode(viewMode === 'TRASH' ? 'ALL' : 'TRASH')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold cursor-pointer ${
                viewMode === 'TRASH'
                  ? 'bg-red-600 text-white border-red-600'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Trash2 className="w-4 h-4" />
              Trash {trashCount > 0 ? `(${trashCount})` : ''}
            </button>
          </div>
        </div>

        {/* Subtabs & Full-Text Search Bar */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            {[
              { id: 'all_files', label: 'All Server Files' },
              { id: 'galleries', label: 'Galleries & Images' },
              { id: 'documents', label: 'Docs, PDF, Slides & Sheets' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setViewMode('ALL');
                  setSubTab(t.id as FileManagerSubTab);
                  onSelectSubTab?.(t.id as FileManagerSubTab);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                  viewMode === 'ALL' && subTab === t.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-1 max-w-md justify-end">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search filenames OR text inside DOCX, PDF, PPTX, XLSX..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5">
              <button
                type="button"
                onClick={() => setLayoutMode('grid')}
                className={`p-1.5 rounded-lg cursor-pointer ${layoutMode === 'grid' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}
                title="Grid View"
              >
                <Grid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('list')}
                className={`p-1.5 rounded-lg cursor-pointer ${layoutMode === 'list' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}
                title="List View"
              >
                <ListIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Toast & Connection Error Banners */}
      {toast && (
        <div
          className={`px-4 py-2 text-xs font-semibold flex items-center justify-between border-b ${
            toast.ok
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-700 border-red-200'
          }`}
        >
          <span className="flex items-center gap-2">
            {toast.ok ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {toast.text}
          </span>
          <button type="button" onClick={() => setToast(null)} className="cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="px-4 py-2.5 bg-red-50 border-b border-red-200 flex items-center justify-between text-xs text-red-800">
          <span className="flex items-center gap-2 font-semibold">
            <AlertCircle className="w-4 h-4" />
            {errorMsg}
          </span>
          <button
            type="button"
            onClick={() => (viewMode === 'TRASH' ? loadTrash() : loadFiles())}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-600 text-white font-bold cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      )}

      {/* Multi-Select Batch Toolbar */}
      {selectedIds.length > 0 && viewMode === 'ALL' && (
        <div className="px-4 py-2 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-bold">{selectedIds.length} selected</span>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="text-slate-300 hover:text-white underline cursor-pointer"
            >
              Clear
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {selectedImages.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setShowBatchImageModal(true)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 font-bold cursor-pointer"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  Batch Resize / Optimize ({selectedImages.length})
                </button>
                <button
                  type="button"
                  onClick={handleBatchImagesToPdf}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 font-bold cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Images â†’ PDF ({selectedImages.length})
                </button>
              </>
            )}
            {selectedPdfs.length >= 2 && (
              <button
                type="button"
                onClick={handleBatchMergePdfs}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 font-bold cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5" />
                Merge PDFs ({selectedPdfs.length})
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setMoveTargetFolderId(folders[0]?.id || 'folder-general');
                setShowBulkMoveModal(true);
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 font-semibold cursor-pointer"
            >
              <FolderInput className="w-3.5 h-3.5" />
              Move
            </button>
            <button
              type="button"
              onClick={handleBatchTrash}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-700 hover:bg-red-600 font-semibold cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Trash
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
        {viewMode === 'TRASH' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-white border border-slate-200 rounded-2xl p-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Trash Bin ({trashedFiles.length} item(s))</h2>
                <p className="text-xs text-slate-500">
                  Soft-deleted files can be 1-click restored or permanently erased from disk.
                </p>
              </div>
              {trashedFiles.length > 0 && (
                <button
                  type="button"
                  onClick={handleEmptyTrash}
                  className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer"
                >
                  Empty Trash
                </button>
              )}
            </div>

            {trashedFiles.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-xs text-slate-500">
                Trash is empty.
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
                {visibleFiles.map((f) => (
                  <div key={f.id} className="p-3.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {getFileIcon(f)}
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">{f.name}</p>
                        <p className="text-[11px] text-slate-500">
                          Deleted {f.deletedAt} â€¢ {formatBytes(f.compressedSizeBytes)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleRestoreFile(f)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Restore
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePermanentDelete(f)}
                        className="px-3 py-1.5 rounded-xl border border-red-200 text-red-700 hover:bg-red-50 text-xs font-semibold cursor-pointer"
                      >
                        Erase Forever
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Nested Breadcrumbs & Folder Strip */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1 text-xs font-semibold text-slate-600 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setActiveFolderId('ALL')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg cursor-pointer ${
                      activeFolderId === 'ALL' ? 'bg-slate-900 text-white' : 'hover:bg-slate-200/70'
                    }`}
                  >
                    <Home className="w-3.5 h-3.5" />
                    All Folders
                  </button>
                  {breadcrumbPath.map((bc) => (
                    <React.Fragment key={bc.id}>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                      <button
                        type="button"
                        onClick={() => setActiveFolderId(bc.id)}
                        className={`px-2.5 py-1 rounded-lg cursor-pointer ${
                          activeFolderId === bc.id ? 'bg-[#0B57D0] text-white' : 'hover:bg-slate-200/70'
                        }`}
                      >
                        {bc.name}
                      </button>
                    </React.Fragment>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  {visibleFiles.length > 0 && visibleFiles.every((f) => selectedIds.includes(f.id)) ? (
                    <CheckSquare className="w-4 h-4 text-[#0B57D0]" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                  Select All ({visibleFiles.length})
                </button>
              </div>

              {childFolders.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
                  {childFolders.map((folder) => {
                    const count = files.filter((f) => f.folderId === folder.id).length;
                    return (
                      <div
                        key={folder.id}
                        onClick={() => setActiveFolderId(folder.id)}
                        className="group bg-white border border-slate-200 hover:border-[#0B57D0] rounded-xl p-3 flex items-center justify-between gap-2 cursor-pointer transition-all"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                            style={{ backgroundColor: `${folder.color || '#0B57D0'}18` }}
                          >
                            <Folder className="w-4 h-4" style={{ color: folder.color || '#0B57D0' }} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate">{folder.name}</p>
                            <p className="text-[10px] text-slate-500">{count} file(s)</p>
                          </div>
                        </div>
                        {folder.id !== 'folder-general' && folder.id !== 'folder-documents' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteFolder(folder);
                            }}
                            title="Delete Folder"
                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* File Cards / List */}
            {visibleFiles.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
                <Upload className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-sm font-bold text-slate-800">No files match this view yet</p>
                <p className="text-xs text-slate-500">
                  Drag & drop any DOCX, PDF, PPTX, XLSX, Form, Audio/Video, or Image files here to upload & index.
                </p>
              </div>
            ) : layoutMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {visibleFiles.map((file) => {
                  const selected = selectedIds.includes(file.id);
                  const img = isImageFile(file);
                  return (
                    <div
                      key={file.id}
                      onMouseEnter={() => prefetchEngineFile(file.id)}
                      className={`group bg-white rounded-2xl border overflow-hidden transition-all flex flex-col ${
                        selected ? 'border-[#0B57D0] ring-2 ring-blue-200' : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
                      }`}
                    >
                      {/* Preview Header */}
                      <div
                        onClick={() => (img ? setLightboxFile(file) : openInEngine(file, 'VIEW'))}
                        className="relative h-40 bg-slate-100 flex items-center justify-center overflow-hidden cursor-pointer"
                      >
                        {img ? (
                          <img
                            src={file.thumbnailUrl || file.url}
                            alt={file.name}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-slate-500">
                            <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center">
                              {getFileIcon(file)}
                            </div>
                            <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200 text-[10px] font-bold uppercase text-slate-700">
                              .{file.extension || 'file'}
                            </span>
                          </div>
                        )}

                        {/* Checkbox */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelect(file.id);
                          }}
                          className={`absolute top-2.5 left-2.5 p-1 rounded-lg bg-white/90 shadow-sm border cursor-pointer ${
                            selected ? 'border-[#0B57D0] text-[#0B57D0]' : 'border-slate-200 text-slate-500'
                          }`}
                        >
                          {selected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                        </button>

                        {/* Top Right Badges */}
                        <div className="absolute top-2.5 right-2.5 flex items-center gap-1">
                          {file.versionCount && file.versionCount > 1 && (
                            <span className="px-1.5 py-0.5 rounded-md bg-slate-900/75 text-white text-[10px] font-bold">
                              v{file.versionCount}
                            </span>
                          )}
                          {file.visibility === 'PRIVATE' && (
                            <span className="p-1 rounded-md bg-slate-900/75 text-white" title="Private">
                              <Lock className="w-3 h-3" />
                            </span>
                          )}
                          {file.visibility === 'PUBLIC' && (
                            <span className="p-1 rounded-md bg-emerald-600 text-white" title="Public Link">
                              <Globe className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="p-3.5 flex-1 flex flex-col justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold text-slate-900 truncate" title={file.name}>
                            {file.name}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-1 flex-wrap">
                            <span>{formatBytes(file.compressedSizeBytes)}</span>
                            {file.width && file.height && (
                              <span>
                                â€¢ {file.width}Ã—{file.height}
                              </span>
                            )}
                            {file.hasExtractedText && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold">
                                Indexed
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openInEngine(file, 'VIEW')}
                              title="Open in Universal Engine"
                              className="px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#0B57D0] text-[11px] font-bold cursor-pointer"
                            >
                              Open
                            </button>
                            {img ? (
                              <button
                                type="button"
                                onClick={() => openImageEditor(file)}
                                title="Edit Image (Crop, Resize, Blur, Watermark)"
                                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 text-[11px] font-bold cursor-pointer"
                              >
                                <Edit3 className="w-3 h-3" />
                                Edit
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openInEngine(file, 'EDIT')}
                                title="Edit in Universal Engine"
                                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold cursor-pointer"
                              >
                                <Edit3 className="w-3 h-3" />
                                Edit
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => openShareDialog(file)}
                              title="Share & Permissions"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-[#0B57D0] hover:bg-slate-100 cursor-pointer"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRenameTarget(file);
                                setRenameNameInput(file.name);
                                setMoveTargetFolderId(file.folderId);
                              }}
                              title="Rename / Move"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                            >
                              <FolderInput className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDuplicate(file)}
                              title="Duplicate"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            {onSendFileViaMail && (
                              <button
                                type="button"
                                onClick={() => onSendFileViaMail(file)}
                                title="Send via Email"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                              >
                                <Mail className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleMoveToTrash(file)}
                              title="Move to Trash"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* List View */
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                    <tr>
                      <th className="p-3 w-8"></th>
                      <th className="p-3">File Name</th>
                      <th className="p-3 hidden md:table-cell">Folder</th>
                      <th className="p-3 hidden sm:table-cell">Size</th>
                      <th className="p-3 hidden lg:table-cell">Updated</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {visibleFiles.map((file) => {
                      const selected = selectedIds.includes(file.id);
                      const img = isImageFile(file);
                      return (
                        <tr
                          key={file.id}
                          onMouseEnter={() => prefetchEngineFile(file.id)}
                          className="hover:bg-slate-50"
                        >
                          <td className="p-3">
                            <button type="button" onClick={() => toggleSelect(file.id)} className="cursor-pointer text-slate-500">
                              {selected ? <CheckSquare className="w-4 h-4 text-[#0B57D0]" /> : <Square className="w-4 h-4" />}
                            </button>
                          </td>
                          <td className="p-3">
                            <div
                              onClick={() => (img ? setLightboxFile(file) : openInEngine(file, 'VIEW'))}
                              className="flex items-center gap-2.5 cursor-pointer"
                            >
                              {img ? (
                                <img
                                  src={file.thumbnailUrl || file.url}
                                  alt={file.name}
                                  className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0"
                                />
                              ) : (
                                getFileIcon(file)
                              )}
                              <div className="min-w-0">
                                <p className="font-bold text-slate-900 truncate max-w-xs">{file.name}</p>
                                <p className="text-[10px] text-slate-400">
                                  .{file.extension} {file.versionCount ? `â€¢ v${file.versionCount}` : ''}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="p-3 hidden md:table-cell text-slate-600">{file.folderName}</td>
                          <td className="p-3 hidden sm:table-cell text-slate-600">{formatBytes(file.compressedSizeBytes)}</td>
                          <td className="p-3 hidden lg:table-cell text-slate-500">{file.uploadedAt}</td>
                          <td className="p-3 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => openInEngine(file, 'VIEW')}
                                className="px-2 py-1 rounded-lg bg-blue-50 text-[#0B57D0] text-[11px] font-bold cursor-pointer"
                              >
                                Open
                              </button>
                              {img && (
                                <button
                                  type="button"
                                  onClick={() => openImageEditor(file)}
                                  className="px-2 py-1 rounded-lg bg-purple-50 text-purple-700 text-[11px] font-bold cursor-pointer"
                                >
                                  Edit Image
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => openShareDialog(file)}
                                className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 cursor-pointer"
                              >
                                <Share2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setRenameTarget(file);
                                  setRenameNameInput(file.name);
                                  setMoveTargetFolderId(file.folderId);
                                }}
                                className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 cursor-pointer"
                              >
                                <FolderInput className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveToTrash(file)}
                                className="p-1.5 rounded-lg hover:bg-red-50 text-slate-500 hover:text-red-600 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Image Lightbox Modal with Direct Edit Image Hook */}
      {lightboxFile && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex flex-col">
          <div className="px-5 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-white">
            <div className="min-w-0">
              <p className="text-sm font-bold truncate">{lightboxFile.name}</p>
              <p className="text-[11px] text-slate-400">
                {lightboxFile.width && lightboxFile.height ? `${lightboxFile.width}Ã—${lightboxFile.height} px â€¢ ` : ''}
                {formatBytes(lightboxFile.compressedSizeBytes)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setLightboxZoom((z) => Math.max(50, z - 25))}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 cursor-pointer"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs font-mono">{lightboxZoom}%</span>
              <button
                type="button"
                onClick={() => setLightboxZoom((z) => Math.min(250, z + 25))}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 cursor-pointer"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = lightboxFile;
                  setLightboxFile(null);
                  openImageEditor(target);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Edit Image
              </button>
              <a
                href={lightboxFile.url}
                download={lightboxFile.name}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700"
              >
                <Download className="w-4 h-4" />
              </a>
              <button
                type="button"
                onClick={() => setLightboxFile(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div
            onClick={() => setLightboxFile(null)}
            className="flex-1 overflow-auto flex items-center justify-center p-6"
          >
            <img
              src={lightboxFile.url}
              alt={lightboxFile.name}
              onClick={(e) => e.stopPropagation()}
              style={{ transform: `scale(${lightboxZoom / 100})` }}
              className="max-h-full max-w-full object-contain rounded-xl shadow-2xl transition-transform"
            />
          </div>
        </div>
      )}

      {/* New Folder Modal */}
      {showNewFolderModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateFolder} className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Create New Folder / Subfolder</h3>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Folder Name</label>
              <input
                required
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="e.g., Q4 Invoices or à¦¬à¦¾à¦‚à¦²à¦¾ à¦¨à¦¥à¦¿à¦ªà¦¤à§à¦°"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Type</label>
                <select
                  value={newFolderType}
                  onChange={(e) => setNewFolderType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                >
                  <option value="FOLDER">General Folder</option>
                  <option value="GALLERY">Image Gallery</option>
                  <option value="DOCUMENT">Documents</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Parent Folder</label>
                <select
                  value={newFolderParentId}
                  onChange={(e) => setNewFolderParentId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                >
                  <option value="">Root Level</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNewFolderModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#0B57D0] text-white text-xs font-bold cursor-pointer"
              >
                Create Folder
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Rename / Move File Modal */}
      {renameTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <form onSubmit={handleSaveRenameMove} className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Rename or Move File</h3>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">File Name</label>
              <input
                value={renameNameInput}
                onChange={(e) => setRenameNameInput(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Destination Folder</label>
              <select
                value={moveTargetFolderId}
                onChange={(e) => setMoveTargetFolderId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
              >
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRenameTarget(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#0B57D0] text-white text-xs font-bold cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Bulk Move Modal */}
      {showBulkMoveModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-sm p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Move {selectedIds.length} Selected File(s)</h3>
            <select
              value={moveTargetFolderId}
              onChange={(e) => setMoveTargetFolderId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
            >
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowBulkMoveModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleBatchMoveFolder(moveTargetFolderId)}
                className="px-4 py-2 rounded-xl bg-[#0B57D0] text-white text-xs font-bold cursor-pointer"
              >
                Move All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sharing & Permissions Modal */}
      {shareTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 truncate">Share: {shareTarget.name}</h3>
              <button type="button" onClick={() => setShareTarget(null)} className="text-slate-400 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-1.5">
              {[
                { id: 'PRIVATE', label: 'Private (Owner & Granted Members Only)', icon: Lock },
                { id: 'WORKSPACE', label: 'Workspace (All Signed-In Team Members)', icon: Users },
                { id: 'PUBLIC', label: 'Public Link Access', icon: Globe },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setShareVisibility(opt.id as any)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold cursor-pointer ${
                    shareVisibility === opt.id
                      ? 'bg-blue-50 border-[#0B57D0] text-[#0B57D0]'
                      : 'border-slate-200 text-slate-700'
                  }`}
                >
                  <opt.icon className="w-3.5 h-3.5" />
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1.5">
              {shareUsers.map((u) => {
                const existing = shareGrants.find((g) => g.targetUserId === u.id);
                return (
                  <div key={u.id} className="flex items-center justify-between border border-slate-200 rounded-xl px-3 py-2 text-xs">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 truncate">{u.name}</p>
                      <p className="text-[10px] text-slate-400 truncate">{u.email}</p>
                    </div>
                    <select
                      value={existing ? existing.accessLevel : 'NONE'}
                      onChange={(e) => {
                        const v = e.target.value;
                        setShareGrants((prev) => {
                          const f = prev.filter((g) => g.targetUserId !== u.id);
                          return v === 'VIEW' || v === 'EDIT' ? [...f, { targetUserId: u.id, accessLevel: v }] : f;
                        });
                      }}
                      className="text-[11px] font-semibold border border-slate-200 rounded-lg px-2 py-1"
                    >
                      <option value="NONE">Default</option>
                      <option value="VIEW">Can View</option>
                      <option value="EDIT">Can Edit</option>
                    </select>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShareTarget(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveShareDialog}
                className="px-4 py-2 rounded-xl bg-[#0B57D0] text-white text-xs font-bold cursor-pointer"
              >
                Save Access
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Universal Document & Slide & Sheet Engine Modal */}
      <UniversalDocumentEngineModal
        isOpen={!!engineTarget}
        target={engineTarget}
        onClose={() => setEngineTarget(null)}
        onSavedOrUpdated={() => loadFiles()}
      />

      {/* Smart Image Editor Modal */}
      {imageEditorTarget && (
        <Suspense fallback={null}>
          <ImageEditorModal
            isOpen={!!imageEditorTarget}
            target={imageEditorTarget}
            onClose={() => setImageEditorTarget(null)}
            onSaved={() => {
              setImageEditorTarget(null);
              loadFiles();
              showNotice('Edited image saved to File Manager.');
            }}
          />
        </Suspense>
      )}

      {/* Multi-Image Batch Optimizer & Resizer Modal */}
      {showBatchImageModal && (
        <Suspense fallback={null}>
          <BatchImageModal
            isOpen={showBatchImageModal}
            selectedImages={selectedImages}
            onClose={() => setShowBatchImageModal(false)}
            onDone={(updatedFiles, message) => {
              setShowBatchImageModal(false);
              setSelectedIds([]);
              if (updatedFiles?.length) setFiles(updatedFiles);
              else loadFiles();
              showNotice(message);
            }}
          />
        </Suspense>
      )}
    </div>
  );
};



