import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { X, Search, Upload, Folder, Image as ImageIcon, FileText, Edit3, Check } from 'lucide-react';
import {
  fetchWorkspaceFiles,
  formatBytes,
  uploadFilesBinary,
  WorkspaceFileFolder,
  WorkspaceFileItem,
} from '../../services/workspaceApi';
import type { ImageEditorTarget } from '../shared/ImageEditorModal';

const ImageEditorModal = lazy(() =>
  import('../shared/ImageEditorModal').then((m) => ({ default: m.ImageEditorModal }))
);

interface FileManagerPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFile: (file: WorkspaceFileItem) => void;
  title?: string;
  defaultFolderId?: string;
  imagesOnly?: boolean;
}

export const FileManagerPickerModal: React.FC<FileManagerPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectFile,
  title = 'Select File or Image from Server File Manager',
  defaultFolderId,
  imagesOnly = false,
}) => {
  const [files, setFiles] = useState<WorkspaceFileItem[]>([]);
  const [folders, setFolders] = useState<WorkspaceFileFolder[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string>(defaultFolderId || 'ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editTarget, setEditTarget] = useState<ImageEditorTarget | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const loadData = async (q = '') => {
    setLoading(true);
    try {
      const res = await fetchWorkspaceFiles(q);
      setFiles(res.files || []);
      setFolders(res.folders || []);
    } catch {
      // keep existing items if transient
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setActiveFolderId(defaultFolderId || 'ALL');
    loadData('');
  }, [isOpen, defaultFolderId]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return files.filter((f) => {
      if (imagesOnly && !f.isImage && !f.mimeType.startsWith('image/')) return false;
      if (activeFolderId !== 'ALL' && f.folderId !== activeFolderId) return false;
      if (q && !f.name.toLowerCase().includes(q) && !f.folderName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [files, imagesOnly, activeFolderId, searchQuery]);

  const handleQuickUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    try {
      const targetFolder =
        activeFolderId !== 'ALL'
          ? activeFolderId
          : imagesOnly
          ? 'folder-images'
          : 'folder-general';
      const res = await uploadFilesBinary(fileList, targetFolder);
      setFiles(res.files || []);
      setFolders(res.folders || []);
      if (res.file) {
        onSelectFile(res.file);
      }
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl h-[82vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">{title}</h3>
            <p className="text-[11px] text-slate-500">
              Click a file to select, or click Edit Image to crop, resize & optimize before inserting
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={uploadInputRef}
              type="file"
              accept={imagesOnly ? 'image/*' : '*/*'}
              className="hidden"
              onChange={(e) => {
                handleQuickUpload(e.target.files);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => uploadInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0B57D0] text-white text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              {<Upload className="w-3.5 h-3.5" />}
              Quick Upload
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-200/70 hover:bg-slate-300 text-slate-700 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search & Folder Strip */}
        <div className="px-5 py-2.5 border-b border-slate-200 flex flex-wrap items-center gap-2 bg-white">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search server files..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveFolderId('ALL')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer shrink-0 ${
                activeFolderId === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              All Folders
            </button>
            {folders.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setActiveFolderId(f.id)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer shrink-0 ${
                  activeFolderId === f.id ? 'bg-[#0B57D0] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Folder className="w-3 h-3" />
                {f.name}
              </button>
            ))}
          </div>
        </div>

        {/* Items Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {filtered.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs gap-2">
              <ImageIcon className="w-8 h-8" />
              <p>No matching files found in this folder.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filtered.map((file) => {
                const isImg = file.isImage || file.mimeType.startsWith('image/');
                return (
                  <div
                    key={file.id}
                    className="group border border-slate-200 hover:border-[#0B57D0] rounded-xl overflow-hidden bg-white flex flex-col transition-all"
                  >
                    <div
                      onClick={() => onSelectFile(file)}
                      className="h-28 bg-slate-100 flex items-center justify-center overflow-hidden cursor-pointer relative"
                    >
                      {isImg ? (
                        <img
                          src={file.thumbnailUrl || file.url}
                          alt={file.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <FileText className="w-8 h-8 text-[#0B57D0]" />
                      )}
                      {isImg && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditTarget({
                              title: file.name,
                              imageUrl: file.url,
                              fileId: file.id,
                            });
                          }}
                          className="absolute bottom-1.5 right-1.5 flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-600/95 hover:bg-purple-500 text-white text-[10px] font-bold shadow cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" />
                          Edit
                        </button>
                      )}
                    </div>
                    <div
                      onClick={() => onSelectFile(file)}
                      className="p-2.5 cursor-pointer flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-slate-900 truncate">{file.name}</p>
                        <p className="text-[10px] text-slate-400">{formatBytes(file.compressedSizeBytes)}</p>
                      </div>
                      <Check className="w-4 h-4 text-[#0B57D0] opacity-0 group-hover:opacity-100 shrink-0" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {editTarget && (
        <Suspense fallback={null}>
          <ImageEditorModal
            isOpen={!!editTarget}
            target={editTarget}
            onClose={() => setEditTarget(null)}
            onSaved={(res) => {
              setEditTarget(null);
              if (res.file) {
                loadData(searchQuery);
                onSelectFile(res.file);
              }
            }}
          />
        </Suspense>
      )}
    </div>
  );
};


