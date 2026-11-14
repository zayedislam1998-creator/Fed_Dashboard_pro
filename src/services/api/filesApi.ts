import { fetchWithRetry, invalidateClientEngineCache } from '../engineCache';
import { wsFetch as fetch } from '../sessionFetch';

export interface WorkspaceFileFolder {
  id: string;
  name: string;
  folderType: 'FOLDER' | 'GALLERY' | 'DOCUMENT';
  parentFolderId?: string;
  description: string;
  color: string;
  createdAt: string;
  timestamp: number;
}

export interface WorkspaceFileItem {
  id: string;
  folderId: string;
  folderName: string;
  name: string;
  originalName: string;
  mimeType: string;
  extension: string;
  isImage: boolean;
  width?: number;
  height?: number;
  originalSizeBytes: number;
  compressedSizeBytes: number;
  compressionRatio: number;
  url: string;
  storagePath: string;
  thumbnailUrl?: string;
  slideDeckId?: string;
  docId?: string;
  bodyText?: string;
  hasExtractedText?: boolean;
  ownerUserId?: string;
  visibility?: 'PRIVATE' | 'WORKSPACE' | 'PUBLIC';
  versionCount?: number;
  deletedAt?: string;
  deletedTimestamp?: number;
  uploadedAt: string;
  timestamp: number;
}

export function isDocumentOrSlideFile(file: WorkspaceFileItem): boolean {
  if (file.isImage) return false;
  if (file.folderId === 'folder-documents') return true;
  if (file.slideDeckId || file.docId) return true;
  const ext = (file.extension || '').toLowerCase();
  return [
    'pdf',
    'slides',
    'ppt',
    'pptx',
    'doc',
    'docx',
    'txt',
    'md',
    'csv',
    'xls',
    'xlsx',
    'json',
  ].includes(ext);
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

/**
 * Automatically compresses an uploaded image while strictly preserving its original format
 * (e.g., JPEG stays image/jpeg, PNG stays image/png, WebP stays image/webp).
 */
export async function compressFileForServerUpload(
  file: File,
  maxDimension = 1440,
  quality = 0.72
): Promise<{
  dataUrl: string;
  mimeType: string;
  originalSizeBytes: number;
  compressedSizeBytes: number;
  width?: number;
  height?: number;
}> {
  const originalSizeBytes = file.size;
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });

  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    return {
      dataUrl: rawDataUrl,
      mimeType: file.type || 'application/octet-stream',
      originalSizeBytes,
      compressedSizeBytes: originalSizeBytes,
    };
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        let targetW = img.naturalWidth || img.width;
        let targetH = img.naturalHeight || img.height;

        // Scale down large dimensions to drastically reduce file size while keeping sharpness
        if (targetW > maxDimension || targetH > maxDimension) {
          if (targetW >= targetH) {
            targetH = Math.round((targetH * maxDimension) / targetW);
            targetW = maxDimension;
          } else {
            targetW = Math.round((targetW * maxDimension) / targetH);
            targetH = maxDimension;
          }
        } else if (originalSizeBytes > 150 * 1024) {
          targetW = Math.max(320, Math.round(targetW * 0.85));
          targetH = Math.max(320, Math.round(targetH * 0.85));
        }

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({
            dataUrl: rawDataUrl,
            mimeType: file.type,
            originalSizeBytes,
            compressedSizeBytes: originalSizeBytes,
            width: img.naturalWidth,
            height: img.naturalHeight,
          });
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, targetW, targetH);

        const preserveMime =
          file.type === 'image/png'
            ? 'image/png'
            : file.type === 'image/webp'
            ? 'image/webp'
            : 'image/jpeg';

        if (preserveMime === 'image/png' && originalSizeBytes > 80 * 1024) {
          const imgData = ctx.getImageData(0, 0, targetW, targetH);
          const d = imgData.data;
          for (let i = 0; i < d.length; i += 4) {
            d[i] = d[i] & 0xf8;
            d[i + 1] = d[i + 1] & 0xf8;
            d[i + 2] = d[i + 2] & 0xf8;
          }
          ctx.putImageData(imgData, 0, 0);
        }

        const compressedDataUrl = canvas.toDataURL(preserveMime, quality);
        const base64Part = compressedDataUrl.split(',')[1] || '';
        const estimatedBytes = Math.round((base64Part.length * 3) / 4);

        if (estimatedBytes < originalSizeBytes) {
          resolve({
            dataUrl: compressedDataUrl,
            mimeType: preserveMime,
            originalSizeBytes,
            compressedSizeBytes: estimatedBytes,
            width: targetW,
            height: targetH,
          });
        } else {
          resolve({
            dataUrl: compressedDataUrl,
            mimeType: preserveMime,
            originalSizeBytes,
            compressedSizeBytes: Math.min(originalSizeBytes, estimatedBytes),
            width: targetW,
            height: targetH,
          });
        }
      } catch {
        resolve({
          dataUrl: rawDataUrl,
          mimeType: file.type,
          originalSizeBytes,
          compressedSizeBytes: originalSizeBytes,
        });
      }
    };
    img.onerror = () => {
      resolve({
        dataUrl: rawDataUrl,
        mimeType: file.type,
        originalSizeBytes,
        compressedSizeBytes: originalSizeBytes,
      });
    };
    img.src = rawDataUrl;
  });
}

export async function fetchWorkspaceFiles(query?: string): Promise<{
  files: WorkspaceFileItem[];
  folders: WorkspaceFileFolder[];
  trashCount?: number;
}> {
  const qs = query && query.trim() ? `?q=${encodeURIComponent(query.trim())}` : '';
  const res = await fetchWithRetry(`/api/files${qs}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Server files unavailable (HTTP ${res.status}).`);
  }
  return {
    files: data.files || [],
    folders: data.folders || [],
    trashCount: data.trashCount ?? 0,
  };
}

export async function uploadFilesBinary(
  files: FileList | File[],
  folderId: string
): Promise<{
  file: WorkspaceFileItem;
  uploadedFiles: WorkspaceFileItem[];
  files: WorkspaceFileItem[];
  folders: WorkspaceFileFolder[];
  trashCount?: number;
}> {
  const form = new FormData();
  form.append('folderId', folderId);
  const arr = Array.from(files);
  for (const f of arr) {
    form.append('files', f, f.name);
  }
  const res = await fetchWithRetry('/api/files/upload-binary', {
    method: 'POST',
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to upload files.');
  }
  return data;
}

export async function uploadCompressedServerFile(
  file: File,
  folderId: string,
  options?: { customName?: string; maxDimension?: number; quality?: number }
): Promise<{ file: WorkspaceFileItem; files: WorkspaceFileItem[] }> {
  const compressed = await compressFileForServerUpload(
    file,
    options?.maxDimension ?? 1440,
    options?.quality ?? 0.72
  );

  const res = await fetchWithRetry('/api/files/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      folderId,
      name: options?.customName || file.name,
      originalName: file.name,
      mimeType: compressed.mimeType,
      dataUrl: compressed.dataUrl,
      originalSizeBytes: compressed.originalSizeBytes,
      compressedSizeBytes: compressed.compressedSizeBytes,
      width: compressed.width,
      height: compressed.height,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to upload file to server.');
  }
  return data;
}

export async function saveWorkspaceFolder(payload: {
  id?: string;
  name: string;
  folderType: 'FOLDER' | 'GALLERY' | 'DOCUMENT';
  parentFolderId?: string;
  description?: string;
  color?: string;
}): Promise<{
  folder: WorkspaceFileFolder;
  folders: WorkspaceFileFolder[];
  files: WorkspaceFileItem[];
  trashCount?: number;
}> {
  const res = await fetchWithRetry('/api/files/folders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to save folder.');
  }
  return data;
}

export async function deleteWorkspaceFolder(id: string): Promise<{
  folders: WorkspaceFileFolder[];
  files: WorkspaceFileItem[];
  trashCount?: number;
}> {
  const res = await fetchWithRetry(`/api/files/folders/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to delete folder.');
  }
  return data;
}

export async function renameOrMoveWorkspaceFile(
  id: string,
  patch: { name?: string; folderId?: string; visibility?: 'PRIVATE' | 'WORKSPACE' | 'PUBLIC' }
): Promise<{ file: WorkspaceFileItem; files: WorkspaceFileItem[]; folders: WorkspaceFileFolder[] }> {
  const res = await fetchWithRetry(`/api/files/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update file.');
  invalidateClientEngineCache(id);
  return data;
}

export async function duplicateWorkspaceFile(
  id: string
): Promise<{ file: WorkspaceFileItem; files: WorkspaceFileItem[]; folders: WorkspaceFileFolder[] }> {
  const res = await fetchWithRetry(`/api/files/${encodeURIComponent(id)}/duplicate`, {
    method: 'POST',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to duplicate file.');
  return data;
}

export async function deleteWorkspaceFile(
  id: string,
  permanent = false
): Promise<{ files: WorkspaceFileItem[]; trashCount?: number }> {
  const res = await fetchWithRetry(
    `/api/files/${encodeURIComponent(id)}${permanent ? '?permanent=true' : ''}`,
    { method: 'DELETE' }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to delete file.');
  invalidateClientEngineCache(id);
  return { files: data.files || [], trashCount: data.trashCount ?? 0 };
}

export async function fetchTrashedFiles(): Promise<WorkspaceFileItem[]> {
  const res = await fetchWithRetry('/api/files/trash');
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load trash.');
  return data.files || [];
}

export async function restoreTrashedFile(
  id: string
): Promise<{ files: WorkspaceFileItem[]; folders: WorkspaceFileFolder[]; trashCount?: number }> {
  const res = await fetchWithRetry(`/api/files/${encodeURIComponent(id)}/restore`, {
    method: 'POST',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to restore file.');
  return data;
}

export async function emptyFilesTrash(): Promise<{
  files: WorkspaceFileItem[];
  folders: WorkspaceFileFolder[];
  trashCount?: number;
}> {
  const res = await fetchWithRetry('/api/files/trash/empty', { method: 'DELETE' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to empty trash.');
  return data;
}

export async function fetchFileShares(fileId: string): Promise<{
  visibility: 'PRIVATE' | 'WORKSPACE' | 'PUBLIC';
  shares: Array<{ id: string; targetUserId: string; accessLevel: 'VIEW' | 'EDIT' }>;
  users: Array<{ id: string; name: string; email: string; role: string }>;
}> {
  const res = await fetchWithRetry(`/api/files/${encodeURIComponent(fileId)}/shares`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load sharing settings.');
  return data;
}

export async function saveFileShares(
  fileId: string,
  payload: {
    visibility: 'PRIVATE' | 'WORKSPACE' | 'PUBLIC';
    grants: Array<{ targetUserId: string; accessLevel: 'VIEW' | 'EDIT' }>;
  }
): Promise<{ files: WorkspaceFileItem[]; folders: WorkspaceFileFolder[] }> {
  const res = await fetchWithRetry(`/api/files/${encodeURIComponent(fileId)}/share`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update file sharing.');
  invalidateClientEngineCache(fileId);
  return data;
}

export async function batchProcessImages(payload: {
  fileIds: string[];
  width?: number;
  height?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside';
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
  watermarkText?: string;
  stripMetadata?: boolean;
  overwrite?: boolean;
  targetFolderId?: string;
}): Promise<{
  ok: boolean;
  processedCount: number;
  files: WorkspaceFileItem[];
  folders: WorkspaceFileFolder[];
}> {
  const res = await fetchWithRetry('/api/files/batch-image-process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Batch image processing failed.');
  for (const id of payload.fileIds) invalidateClientEngineCache(id);
  return data;
}

export async function saveMailAttachmentToServerFiles(payload: {
  name: string;
  url?: string;
  mimeType?: string;
  extension?: string;
  slideDeckId?: string;
  docId?: string;
  bodyText?: string;
  folderId?: string;
}): Promise<{ file: WorkspaceFileItem; files: WorkspaceFileItem[]; alreadySaved: boolean }> {
  const res = await fetch('/api/files/save-from-mail', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to save attachment to File Manager.');
  }
  return data;
}
