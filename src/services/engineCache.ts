import { wsFetch as fetch } from './sessionFetch';
import type { WorkspaceFileItem } from './workspaceApi';

export interface SlideElementLayerClient {
  id: string;
  type: 'heading' | 'text' | 'bullets' | 'shape' | 'image' | 'table' | 'metric';
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
  zIndex?: number;
  text?: string;
  items?: string[];
  tableRows?: string[][];
  shapeKind?: 'rect' | 'rounded' | 'circle' | 'pill' | 'line';
  imageUrl?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold' | 'extrabold';
  fontStyle?: 'normal' | 'italic';
  textAlign?: 'left' | 'center' | 'right';
  color?: string;
  bgColor?: string;
  borderColor?: string;
  borderRadius?: number;
  opacity?: number;
  metricValue?: string;
  metricLabel?: string;
}

export interface EngineSlidePageClient {
  id: string;
  slideNumber: number;
  layout:
    | 'TITLE_COVER'
    | 'BULLETS_AND_INSIGHTS'
    | 'SPLIT_IMAGE'
    | 'METRICS_GRID'
    | 'EXECUTIVE_SUMMARY'
    | 'FREEFORM_CANVAS';
  title: string;
  subtitle: string;
  bullets: string[];
  speakerNotes: string;
  imageUrl?: string;
  accentColor?: string;
  bgColor?: string;
  bgGradient?: string;
  transition?: 'none' | 'fade' | 'slide';
  elements?: SlideElementLayerClient[];
}

export interface ParsedEnginePayloadClient {
  fileId: string;
  kind:
    | 'DOCX'
    | 'DOC'
    | 'PDF'
    | 'PPTX'
    | 'SLIDES'
    | 'SHEET'
    | 'IMAGE'
    | 'MEDIA'
    | 'CODE'
    | 'FORM'
    | 'BINARY';
  name: string;
  extension: string;
  mimeType: string;
  url: string;
  sizeBytes: number;
  updatedAt: string;
  versionCount: number;
  visibility: string;
  html?: string;
  plainText?: string;
  pageCount?: number;
  slideDeck?: {
    id: string;
    title: string;
    subtitle: string;
    category: string;
    themeColor: string;
    authorName: string;
    pages: EngineSlidePageClient[];
  };
  sheets?: Array<{
    name: string;
    columns: string[];
    rows: string[][];
  }>;
  width?: number;
  height?: number;
  thumbnailUrl?: string;
  cachedAt: number;
}

export interface FileVersionItem {
  id: string;
  fileId: string;
  versionNumber: number;
  sizeBytes: number;
  mimeType: string;
  note: string;
  createdByEmail: string;
  createdAt: string;
  timestamp: number;
  url: string;
}

export function getCachedEnginePayload(_fileId: string): ParsedEnginePayloadClient | undefined {
  return undefined;
}

export function setCachedEnginePayload(_fileId: string, _payload: ParsedEnginePayloadClient): void {
  // Manual client-side caching disabled; all reads/writes go directly through the database engine
}

export function invalidateClientEngineCache(_fileId?: string): void {
  // No-op: manual client-side caching disabled
}

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  attempts = 2
): Promise<Response> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(input, init);
      if (res.status === 503 && i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 150 * (i + 1)));
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (i === attempts - 1) throw err;
      await new Promise((r) => setTimeout(r, 150 * (i + 1)));
    }
  }
  throw lastErr;
}

export async function fetchEngineFileFast(
  fileId: string,
  _forceRefresh = false
): Promise<ParsedEnginePayloadClient> {
  const res = await fetchWithRetry(`/api/engine/file/${encodeURIComponent(fileId)}`);
  const data = await res.json();
  if (!res.ok || !data.payload) {
    throw new Error(data.error || 'Failed to load file in Universal Engine.');
  }
  return data.payload as ParsedEnginePayloadClient;
}

export function prefetchEngineFile(_fileId?: string): void {
  // Manual prefetch caching disabled
}

export async function saveEngineFileEdit(
  fileId: string,
  body: Record<string, any>
): Promise<{ file: WorkspaceFileItem; payload: ParsedEnginePayloadClient }> {
  const res = await fetchWithRetry(`/api/engine/file/${encodeURIComponent(fileId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to save changes.');
  }
  return { file: data.file, payload: data.payload };
}

export async function convertViaEngine(payload: {
  action:
    | 'IMAGES_TO_PDF'
    | 'PDF_MERGE'
    | 'PDF_SPLIT'
    | 'TEXT_TO_PDF'
    | 'SLIDES_TO_PPTX'
    | 'DOC_TO_DOCX'
    | 'SHEETS_TO_XLSX';
  fileIds?: string[];
  fileId?: string;
  title?: string;
  lines?: string[] | string;
  pages?: any[];
  sheets?: any[];
  pageRange?: number[];
  folderId?: string;
}): Promise<{ file: WorkspaceFileItem; files?: WorkspaceFileItem[] }> {
  const res = await fetchWithRetry('/api/engine/convert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Conversion failed.');
  }
  return data;
}

export async function fetchFileVersions(fileId: string): Promise<FileVersionItem[]> {
  const res = await fetchWithRetry(`/api/files/${encodeURIComponent(fileId)}/versions`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Unable to load version history.');
  return data.versions || [];
}

export async function restoreFileVersion(
  fileId: string,
  versionId: string
): Promise<{ file: WorkspaceFileItem; payload: ParsedEnginePayloadClient }> {
  const res = await fetchWithRetry(
    `/api/files/${encodeURIComponent(fileId)}/versions/${encodeURIComponent(versionId)}/restore`,
    { method: 'POST' }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Unable to restore version.');
  if (data.payload) setCachedEnginePayload(fileId, data.payload);
  return data;
}

export function ensureClientSlideElements(
  page: EngineSlidePageClient,
  themeColor = '#D97706'
): EngineSlidePageClient {
  if (Array.isArray(page.elements) && page.elements.length > 0) {
    return page;
  }
  const elements: SlideElementLayerClient[] = [];
  const accent = page.accentColor || themeColor || '#D97706';
  const isCover = page.layout === 'TITLE_COVER';
  elements.push({
    id: `${page.id}-bar`,
    type: 'shape',
    shapeKind: 'rect',
    x: 0,
    y: 0,
    w: 100,
    h: isCover ? 3 : 2,
    bgColor: accent,
    zIndex: 1,
  });
  elements.push({
    id: `${page.id}-title`,
    type: 'heading',
    x: 6,
    y: isCover ? 28 : 8,
    w: page.imageUrl && page.layout === 'SPLIT_IMAGE' ? 50 : 88,
    h: isCover ? 18 : 13,
    text: page.title || `Slide ${page.slideNumber}`,
    fontSize: isCover ? 34 : 26,
    fontWeight: 'extrabold',
    color: isCover ? '#FFFFFF' : '#0F172A',
    zIndex: 2,
  });
  if (page.subtitle) {
    elements.push({
      id: `${page.id}-sub`,
      type: 'text',
      x: 6,
      y: isCover ? 49 : 22,
      w: page.imageUrl && page.layout === 'SPLIT_IMAGE' ? 50 : 86,
      h: 10,
      text: page.subtitle,
      fontSize: isCover ? 16 : 14,
      color: isCover ? '#CBD5E1' : '#64748B',
      zIndex: 3,
    });
  }
  if (Array.isArray(page.bullets) && page.bullets.length > 0) {
    elements.push({
      id: `${page.id}-bullets`,
      type: 'bullets',
      x: 6,
      y: page.subtitle ? 35 : 26,
      w: page.imageUrl ? 50 : 86,
      h: 50,
      items: page.bullets,
      fontSize: 15,
      color: isCover ? '#F1F5F9' : '#1E293B',
      zIndex: 4,
    });
  }
  if (page.imageUrl) {
    elements.push({
      id: `${page.id}-img`,
      type: 'image',
      x: 60,
      y: 24,
      w: 34,
      h: 62,
      imageUrl: page.imageUrl,
      borderRadius: 12,
      zIndex: 5,
    });
  }
  return {
    ...page,
    bgColor: page.bgColor || (isCover ? '#0F172A' : '#FFFFFF'),
    elements,
  };
}
