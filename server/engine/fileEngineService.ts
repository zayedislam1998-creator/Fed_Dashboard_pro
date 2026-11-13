import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import { degrees, PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
import PptxGenJS from 'pptxgenjs';
import sharp from 'sharp';
import {
  ensureExternalStorageDirs,
  THUMBS_DIR,
  UPLOADS_DIR,
  VERSIONS_DIR,
  prisma,
} from '../db/prisma';

export interface SlideElementLayer {
  id: string;
  type: 'heading' | 'text' | 'bullets' | 'shape' | 'image' | 'table' | 'metric';
  x: number; // percentage 0..100
  y: number; // percentage 0..100
  w: number; // percentage 5..100
  h: number; // percentage 5..100
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

export interface EngineSlidePage {
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
  elements?: SlideElementLayer[];
}

export interface ParsedEnginePayload {
  fileId: string;
  kind: 'DOCX' | 'DOC' | 'PDF' | 'PPTX' | 'SLIDES' | 'SHEET' | 'IMAGE' | 'MEDIA' | 'CODE' | 'FORM' | 'BINARY';
  name: string;
  extension: string;
  mimeType: string;
  url: string;
  sizeBytes: number;
  updatedAt: string;
  versionCount: number;
  visibility: string;
  // DOCX / DOC / CODE
  html?: string;
  plainText?: string;
  // PDF
  pageCount?: number;
  // SLIDES / PPTX
  slideDeck?: {
    id: string;
    title: string;
    subtitle: string;
    category: string;
    themeColor: string;
    authorName: string;
    pages: EngineSlidePage[];
  };
  // SHEETS / XLSX / CSV
  sheets?: Array<{
    name: string;
    columns: string[];
    rows: string[][];
  }>;
  // IMAGE
  width?: number;
  height?: number;
  thumbnailUrl?: string;
  cachedAt: number;
}

export function invalidateEngineCache(_fileId?: string): void {
  // Manual in-memory caching disabled; all reads go directly through the database and file engine
}

function setCachedPayload(_fileId: string, _payload: ParsedEnginePayload): void {
  // No-op: manual in-memory caching disabled
}

/**
 * Unicode-preserving filename sanitizer: preserves Bengali/CJK/Arabic/Latin letters,
 * spaces, dots, hyphens, underscores, parentheses while removing dangerous FS chars.
 */
export function sanitizeUnicodeFilename(rawName: string, fallback = 'file'): string {
  const cleaned = String(rawName || '')
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, '_')
    .replace(/\.\.+/g, '.')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  return cleaned || fallback;
}

export function resolveDiskPathFromUrl(urlOrPath: string): string {
  const raw = String(urlOrPath || '').trim();
  const decoded = (() => {
    try {
      return decodeURIComponent(path.basename(raw));
    } catch {
      return path.basename(raw);
    }
  })();
  if (raw.includes('/.versions/')) {
    return path.join(VERSIONS_DIR, decoded);
  }
  if (raw.includes('/.thumbs/')) {
    return path.join(THUMBS_DIR, decoded);
  }
  return path.join(UPLOADS_DIR, decoded);
}

/**
 * Converts legacy slide pages (title + subtitle + bullets) into visual SlideElementLayers
 * if `elements` are not yet present, enabling full PowerPoint-style canvas editing.
 */
export function ensureVisualSlideElements(page: EngineSlidePage, themeColor = '#D97706'): SlideElementLayer[] {
  if (Array.isArray(page.elements) && page.elements.length > 0) {
    return page.elements;
  }
  const isCover = page.layout === 'TITLE_COVER';
  const layers: SlideElementLayer[] = [
    {
      id: `${page.id}-el-title`,
      type: 'heading',
      x: 7,
      y: isCover ? 28 : 8,
      w: 86,
      h: 16,
      text: page.title || `Slide ${page.slideNumber}`,
      fontSize: isCover ? 34 : 26,
      fontWeight: 'extrabold',
      textAlign: isCover ? 'center' : 'left',
      color: isCover ? '#FFFFFF' : '#0F172A',
      zIndex: 2,
    },
  ];
  if (page.subtitle) {
    layers.push({
      id: `${page.id}-el-sub`,
      type: 'text',
      x: 7,
      y: isCover ? 48 : 23,
      w: 86,
      h: 10,
      text: page.subtitle,
      fontSize: isCover ? 17 : 14,
      fontWeight: 'normal',
      textAlign: isCover ? 'center' : 'left',
      color: isCover ? '#CBD5E1' : '#475569',
      zIndex: 3,
    });
  }
  if (Array.isArray(page.bullets) && page.bullets.length > 0) {
    layers.push({
      id: `${page.id}-el-bullets`,
      type: 'bullets',
      x: 7,
      y: isCover ? 63 : 36,
      w: page.imageUrl ? 50 : 86,
      h: 48,
      items: page.bullets,
      fontSize: 15,
      color: isCover ? '#F1F5F9' : '#1E293B',
      bgColor: isCover ? 'rgba(255,255,255,0.08)' : '#F8FAFC',
      borderColor: isCover ? 'rgba(255,255,255,0.16)' : '#E2E8F0',
      borderRadius: 12,
      zIndex: 4,
    });
  }
  if (page.imageUrl) {
    layers.push({
      id: `${page.id}-el-img`,
      type: 'image',
      x: 60,
      y: 36,
      w: 33,
      h: 48,
      imageUrl: page.imageUrl,
      borderRadius: 12,
      zIndex: 5,
    });
  }
  layers.push({
    id: `${page.id}-el-accent`,
    type: 'shape',
    shapeKind: 'rect',
    x: 0,
    y: 0,
    w: 100,
    h: 2,
    bgColor: page.accentColor || themeColor,
    zIndex: 1,
  });
  return layers;
}

function collectXmlTextNodes(node: any, out: string[]): void {
  if (node === null || node === undefined) return;
  if (typeof node === 'string' || typeof node === 'number') {
    const s = String(node).trim();
    if (s) out.push(s);
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) collectXmlTextNodes(item, out);
    return;
  }
  if (typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (k.startsWith('@_')) continue;
      if (k === 'a:t' || k === 't') {
        if (typeof v === 'string' || typeof v === 'number') {
          const s = String(v).trim();
          if (s) out.push(s);
        } else {
          collectXmlTextNodes(v, out);
        }
      } else {
        collectXmlTextNodes(v, out);
      }
    }
  }
}

export async function parsePptxFileToPages(buffer: Buffer, deckTitle: string): Promise<EngineSlidePage[]> {
  const zip = await JSZip.loadAsync(buffer);
  const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: false });

  const slideNames = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => {
      const na = Number(a.match(/slide(\d+)\.xml/i)?.[1] || 0);
      const nb = Number(b.match(/slide(\d+)\.xml/i)?.[1] || 0);
      return na - nb;
    });

  if (slideNames.length === 0) {
    return [
      {
        id: `sp-empty-${Date.now()}`,
        slideNumber: 1,
        layout: 'TITLE_COVER',
        title: deckTitle,
        subtitle: 'Presentation Slide',
        bullets: ['Edit slide content in Visual Canvas Studio'],
        speakerNotes: '',
      },
    ];
  }

  const pages: EngineSlidePage[] = [];
  for (let idx = 0; idx < slideNames.length; idx++) {
    const slideXml = await zip.files[slideNames[idx]].async('string');
    const parsed = parser.parse(slideXml);
    const texts: string[] = [];
    collectXmlTextNodes(parsed, texts);

    const slideNum = idx + 1;
    const notesPath = `ppt/notesSlides/notesSlide${slideNum}.xml`;
    let speakerNotes = '';
    if (zip.files[notesPath]) {
      const notesXml = await zip.files[notesPath].async('string');
      const notesTexts: string[] = [];
      collectXmlTextNodes(parser.parse(notesXml), notesTexts);
      speakerNotes = notesTexts.filter((t) => t !== String(slideNum)).join(' ');
    }

    const cleanTexts = Array.from(new Set(texts.map((t) => t.trim()).filter(Boolean)));
    const title = cleanTexts[0] || `Slide ${slideNum}`;
    const subtitle = cleanTexts.length > 2 ? cleanTexts[1] : '';
    const bullets = cleanTexts.slice(subtitle ? 2 : 1);

    const page: EngineSlidePage = {
      id: `sp-pptx-${slideNum}-${Date.now()}`,
      slideNumber: slideNum,
      layout: idx === 0 ? 'TITLE_COVER' : 'BULLETS_AND_INSIGHTS',
      title,
      subtitle,
      bullets: bullets.length > 0 ? bullets : [],
      speakerNotes,
    };
    page.elements = ensureVisualSlideElements(page, '#D97706');
    pages.push(page);
  }
  return pages;
}

export async function extractSearchableTextFromFile(
  diskPath: string,
  ext: string
): Promise<{ text: string; pageCount?: number }> {
  if (!fs.existsSync(diskPath)) return { text: '' };
  try {
    const lower = ext.toLowerCase();
    if (lower === 'docx') {
      const res = await mammoth.extractRawText({ path: diskPath });
      return { text: (res.value || '').trim().slice(0, 200_000) };
    }
    if (['txt', 'md', 'csv', 'json', 'log', 'html', 'htm', 'xml', 'ts', 'js', 'css', 'doc'].includes(lower)) {
      const raw = fs.readFileSync(diskPath, 'utf-8');
      return { text: raw.replace(/<[^>]+>/g, ' ').slice(0, 200_000) };
    }
    if (lower === 'pdf') {
      const buf = fs.readFileSync(diskPath);
      let pageCount: number | undefined;
      try {
        const pdfDoc = await PDFDocument.load(buf, { ignoreEncryption: true });
        pageCount = pdfDoc.getPageCount();
      } catch {
        // ignore
      }
      try {
        const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs');
        const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: true });
        const doc = await loadingTask.promise;
        pageCount = doc.numPages;
        const maxPages = Math.min(doc.numPages, 40);
        const parts: string[] = [];
        for (let p = 1; p <= maxPages; p++) {
          const page = await doc.getPage(p);
          const content = await page.getTextContent();
          const line = (content.items || []).map((it: any) => it.str || '').join(' ');
          if (line.trim()) parts.push(line.trim());
        }
        return { text: parts.join('\n').slice(0, 200_000), pageCount };
      } catch {
        return { text: '', pageCount };
      }
    }
    if (lower === 'pptx') {
      const buf = fs.readFileSync(diskPath);
      const pages = await parsePptxFileToPages(buf, path.basename(diskPath));
      const combined = pages
        .map((p) => [p.title, p.subtitle, ...p.bullets, p.speakerNotes].filter(Boolean).join('\n'))
        .join('\n\n');
      return { text: combined.slice(0, 200_000) };
    }
    if (lower === 'slides') {
      const raw = JSON.parse(fs.readFileSync(diskPath, 'utf-8'));
      const pages = Array.isArray(raw.pages) ? raw.pages : [];
      const combined = pages
        .map((p: any) => [p.title, p.subtitle, ...(p.bullets || []), p.speakerNotes].filter(Boolean).join('\n'))
        .join('\n\n');
      return { text: [raw.title, raw.subtitle, combined].filter(Boolean).join('\n').slice(0, 200_000) };
    }
    if (lower === 'xlsx' || lower === 'xls') {
      const wb = XLSX.read(fs.readFileSync(diskPath), { type: 'buffer' });
      const textParts: string[] = [];
      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        textParts.push(XLSX.utils.sheet_to_csv(ws));
      }
      return { text: textParts.join('\n').slice(0, 200_000) };
    }
  } catch {
    // non-fatal extraction error
  }
  return { text: '' };
}

export async function generateImageThumbnailForFile(
  sourceDiskPath: string,
  fileId: string
): Promise<{ thumbnailUrl?: string; width?: number; height?: number }> {
  if (!fs.existsSync(sourceDiskPath)) return {};
  try {
    ensureExternalStorageDirs();
    const meta = await sharp(sourceDiskPath).metadata();
    const thumbName = `thumb-${fileId}.webp`;
    const thumbPath = path.join(THUMBS_DIR, thumbName);
    await sharp(sourceDiskPath)
      .rotate()
      .resize({ width: 380, height: 380, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 78 })
      .toFile(thumbPath);
    return {
      thumbnailUrl: `/uploads/.thumbs/${thumbName}`,
      width: meta.width,
      height: meta.height,
    };
  } catch {
    return {};
  }
}

export async function saveFileVersionSnapshot(
  fileRow: {
    id: string;
    storagePath: string;
    url: string;
    mimeType: string;
    compressedSizeBytes: bigint;
    versionCount: number;
  },
  actorEmail: string,
  note: string
): Promise<number> {
  const srcDisk = resolveDiskPathFromUrl(fileRow.storagePath || fileRow.url);
  const nextVersion = (fileRow.versionCount || 1) + 1;
  if (!fs.existsSync(srcDisk)) {
    return nextVersion;
  }

  ensureExternalStorageDirs();
  const ext = path.extname(srcDisk) || '.bin';
  const snapFileName = `v${fileRow.versionCount || 1}-${fileRow.id}-${Date.now()}${ext}`;
  const snapDisk = path.join(VERSIONS_DIR, snapFileName);
  fs.copyFileSync(srcDisk, snapDisk);

  const nowStr = new Date().toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  await prisma.workspaceFileVersion.create({
    data: {
      id: `ver-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      fileId: fileRow.id,
      versionNumber: fileRow.versionCount || 1,
      storagePath: `external/uploads/.versions/${snapFileName}`,
      url: `/uploads/.versions/${snapFileName}`,
      mimeType: fileRow.mimeType,
      sizeBytes: BigInt(fs.statSync(snapDisk).size),
      note: note || 'Saved revision',
      createdByEmail: actorEmail || 'system',
      createdAt: nowStr,
      timestampMs: BigInt(Date.now()),
    },
  });

  // Prune beyond last 10 versions to keep disk lean
  const allVers = await prisma.workspaceFileVersion.findMany({
    where: { fileId: fileRow.id },
    orderBy: { versionNumber: 'desc' },
  });
  if (allVers.length > 10) {
    const stale = allVers.slice(10);
    for (const old of stale) {
      const oldPath = resolveDiskPathFromUrl(old.storagePath || old.url);
      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
        } catch {
          // ignore
        }
      }
      await prisma.workspaceFileVersion.delete({ where: { id: old.id } }).catch(() => {});
    }
  }

  return nextVersion;
}

export async function buildEnginePayloadForFile(fileId: string): Promise<ParsedEnginePayload | null> {
  const fileRow = await prisma.workspaceFile.findUnique({ where: { id: fileId } });
  if (!fileRow) return null;

  const ext = (fileRow.extension || path.extname(fileRow.name).replace('.', '') || '').toLowerCase();
  const mime = (fileRow.mimeType || '').toLowerCase();
  const diskPath = resolveDiskPathFromUrl(fileRow.storagePath || fileRow.url);

  const base: ParsedEnginePayload = {
    fileId: fileRow.id,
    kind: 'BINARY',
    name: fileRow.name,
    extension: ext,
    mimeType: fileRow.mimeType,
    url: fileRow.url,
    sizeBytes: Number(fileRow.compressedSizeBytes || 0),
    updatedAt: fileRow.uploadedAt,
    versionCount: fileRow.versionCount ?? 1,
    visibility: fileRow.visibility || 'PRIVATE',
    width: fileRow.width ?? undefined,
    height: fileRow.height ?? undefined,
    thumbnailUrl: fileRow.thumbnailUrl || undefined,
    cachedAt: Date.now(),
  };

  if (fileRow.isImage || mime.startsWith('image/')) {
    base.kind = 'IMAGE';
    setCachedPayload(fileId, base);
    return base;
  }

  if (mime.startsWith('audio/') || mime.startsWith('video/') || ['mp4', 'webm', 'mp3', 'wav', 'ogg', 'm4a'].includes(ext)) {
    base.kind = 'MEDIA';
    setCachedPayload(fileId, base);
    return base;
  }

  if (fileRow.slideDeckId || ext === 'slides' || ext === 'pptx' || mime.includes('presentation') || mime.includes('slides')) {
    let deckRecord = fileRow.slideDeckId
      ? await prisma.workspaceSlide.findUnique({ where: { id: fileRow.slideDeckId } })
      : null;

    if (deckRecord) {
      const rawPages = Array.isArray(deckRecord.pagesJson) ? (deckRecord.pagesJson as any[]) : [];
      base.kind = ext === 'pptx' ? 'PPTX' : 'SLIDES';
      base.slideDeck = {
        id: deckRecord.id,
        title: deckRecord.title,
        subtitle: deckRecord.subtitle || '',
        category: deckRecord.category,
        themeColor: deckRecord.themeColor,
        authorName: deckRecord.authorName,
        pages: rawPages.map((p, i) => ({
          ...p,
          slideNumber: i + 1,
          elements: ensureVisualSlideElements(p, deckRecord!.themeColor),
        })),
      };
      setCachedPayload(fileId, base);
      return base;
    }

    if (ext === 'pptx' && fs.existsSync(diskPath)) {
      const pages = await parsePptxFileToPages(fs.readFileSync(diskPath), fileRow.name.replace(/\.pptx$/i, ''));
      base.kind = 'PPTX';
      base.slideDeck = {
        id: `pptx-${fileRow.id}`,
        title: fileRow.name.replace(/\.pptx$/i, ''),
        subtitle: 'PowerPoint Presentation (.pptx)',
        category: 'Presentations',
        themeColor: '#D97706',
        authorName: 'Workspace Author',
        pages,
      };
      setCachedPayload(fileId, base);
      return base;
    }

    if (fs.existsSync(diskPath) && (ext === 'slides' || ext === 'json')) {
      try {
        const parsed = JSON.parse(fs.readFileSync(diskPath, 'utf-8'));
        const pages = Array.isArray(parsed.pages) ? parsed.pages : [];
        base.kind = 'SLIDES';
        base.slideDeck = {
          id: parsed.id || fileRow.slideDeckId || fileRow.id,
          title: parsed.title || fileRow.name.replace(/\.slides$/i, ''),
          subtitle: parsed.subtitle || '',
          category: parsed.category || 'Presentations',
          themeColor: parsed.themeColor || '#D97706',
          authorName: parsed.authorName || 'Administrator',
          pages: pages.map((p: any, i: number) => ({
            ...p,
            slideNumber: i + 1,
            elements: ensureVisualSlideElements(p, parsed.themeColor || '#D97706'),
          })),
        };
        setCachedPayload(fileId, base);
        return base;
      } catch {
        // fallback below
      }
    }
  }

  if (ext === 'pdf' || mime.includes('pdf')) {
    base.kind = 'PDF';
    if (fs.existsSync(diskPath)) {
      try {
        const pdfDoc = await PDFDocument.load(fs.readFileSync(diskPath), { ignoreEncryption: true });
        base.pageCount = pdfDoc.getPageCount();
      } catch {
        base.pageCount = 1;
      }
    }
    base.plainText = fileRow.bodyText || '';
    setCachedPayload(fileId, base);
    return base;
  }

  if (['xlsx', 'xls', 'csv'].includes(ext) || mime.includes('spreadsheet') || mime.includes('csv')) {
    base.kind = 'SHEET';
    if (fs.existsSync(diskPath)) {
      const wb =
        ext === 'csv'
          ? XLSX.read(fs.readFileSync(diskPath, 'utf-8'), { type: 'string' })
          : XLSX.read(fs.readFileSync(diskPath), { type: 'buffer' });
      base.sheets = wb.SheetNames.map((sheetName) => {
        const ws = wb.Sheets[sheetName];
        const aoa = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' }) as any[][];
        const firstRow = Array.isArray(aoa[0]) ? aoa[0].map((v) => String(v ?? '')) : [];
        const maxCols = Math.max(4, firstRow.length, ...aoa.map((r) => (Array.isArray(r) ? r.length : 0)));
        const columns = Array.from({ length: maxCols }, (_, i) => firstRow[i] || `Column ${String.fromCharCode(65 + (i % 26))}`);
        const dataRows = (aoa.length > 1 ? aoa.slice(1) : [['']]).map((r) =>
          Array.from({ length: maxCols }, (_, i) => String((Array.isArray(r) ? r[i] : '') ?? ''))
        );
        return { name: sheetName, columns, rows: dataRows };
      });
    } else {
      base.sheets = [{ name: 'Sheet1', columns: ['Column A', 'Column B', 'Column C', 'Column D'], rows: [['', '', '', '']] }];
    }
    setCachedPayload(fileId, base);
    return base;
  }

  if (ext === 'docx' && fs.existsSync(diskPath)) {
    base.kind = 'DOCX';
    const [htmlRes, textRes] = await Promise.all([
      mammoth.convertToHtml({ path: diskPath }),
      mammoth.extractRawText({ path: diskPath }),
    ]);
    base.html = htmlRes.value || '<p></p>';
    base.plainText = textRes.value || '';
    setCachedPayload(fileId, base);
    return base;
  }

  if (['json', 'ts', 'tsx', 'js', 'jsx', 'css', 'xml', 'yaml', 'yml', 'log', 'sql'].includes(ext)) {
    base.kind = 'CODE';
    base.plainText = fs.existsSync(diskPath) ? fs.readFileSync(diskPath, 'utf-8') : fileRow.bodyText || '';
    setCachedPayload(fileId, base);
    return base;
  }

  // DOC / TXT / MD / HTML / Linked WorkspaceDoc
  const linkedDoc = fileRow.docId
    ? await prisma.workspaceDoc.findUnique({ where: { id: fileRow.docId } })
    : null;
  if (linkedDoc || ['doc', 'txt', 'md', 'html', 'htm', 'rtf'].includes(ext) || mime.startsWith('text/')) {
    base.kind = 'DOC';
    const text =
      linkedDoc?.bodyText ||
      (fs.existsSync(diskPath) ? fs.readFileSync(diskPath, 'utf-8') : fileRow.bodyText || '');
    base.plainText = text;
    if (ext === 'html' || ext === 'htm') {
      base.html = text;
    } else if (linkedDoc?.extraFields && typeof linkedDoc.extraFields === 'object' && (linkedDoc.extraFields as any).htmlContent) {
      base.html = String((linkedDoc.extraFields as any).htmlContent);
    } else {
      base.html = textToSimpleHtml(text);
    }
    setCachedPayload(fileId, base);
    return base;
  }

  setCachedPayload(fileId, base);
  return base;
}

export function textToSimpleHtml(text: string): string {
  const escaped = String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped
    .split(/\r?\n\r?\n/)
    .map((block) => `<p>${block.replace(/\r?\n/g, '<br />')}</p>`)
    .join('');
}

export function htmlToPlainText(html: string): string {
  return String(html || '')
    .replace(/<\/(p|div|h1|h2|h3|h4|li|tr|blockquote)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function generateDocxBuffer(title: string, htmlOrText: string): Promise<Buffer> {
  const plain = /<[a-z][\s\S]*>/i.test(htmlOrText) ? htmlToPlainText(htmlOrText) : htmlOrText;
  const lines = plain.split(/\r?\n/);

  const children: Paragraph[] = [
    new Paragraph({
      text: title,
      heading: HeadingLevel.TITLE,
      spacing: { after: 200 },
    }),
  ];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      children.push(new Paragraph({ text: '' }));
      continue;
    }
    if (line.startsWith('# ')) {
      children.push(new Paragraph({ text: line.slice(2), heading: HeadingLevel.HEADING_1, spacing: { before: 160, after: 80 } }));
    } else if (line.startsWith('## ')) {
      children.push(new Paragraph({ text: line.slice(3), heading: HeadingLevel.HEADING_2, spacing: { before: 120, after: 60 } }));
    } else if (line.startsWith('• ') || line.startsWith('- ')) {
      children.push(new Paragraph({ text: line.slice(2), bullet: { level: 0 } }));
    } else {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: line, size: 22 })],
          spacing: { after: 100 },
        })
      );
    }
  }

  const doc = new Document({
    sections: [{ children }],
  });
  return Packer.toBuffer(doc);
}

export async function generatePptxBuffer(deck: {
  title: string;
  subtitle?: string;
  themeColor?: string;
  pages: EngineSlidePage[];
}): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.title = deck.title || 'Workspace Presentation';

  const accentHex = (deck.themeColor || '#D97706').replace('#', '');
  const pages = Array.isArray(deck.pages) && deck.pages.length > 0 ? deck.pages : [];

  for (const page of pages) {
    const slide = pptx.addSlide();
    const isCover = page.layout === 'TITLE_COVER';
    if (isCover) {
      slide.background = { color: '0F172A' };
    } else if (page.bgColor && /^#[0-9A-Fa-f]{6}$/.test(page.bgColor)) {
      slide.background = { color: page.bgColor.replace('#', '') };
    } else {
      slide.background = { color: 'FFFFFF' };
    }

    if (Array.isArray(page.elements) && page.elements.length > 0) {
      for (const el of page.elements) {
        const x = (el.x / 100) * 10;
        const y = (el.y / 100) * 5.625;
        const w = (el.w / 100) * 10;
        const h = (el.h / 100) * 5.625;
        const colorHex = (el.color || (isCover ? '#FFFFFF' : '#0F172A')).replace('#', '');

        if (el.type === 'shape') {
          slide.addShape(pptx.ShapeType.rect, {
            x,
            y,
            w,
            h,
            fill: { color: (el.bgColor || `#${accentHex}`).replace('#', '').slice(0, 6) },
          });
        } else if (el.type === 'heading' || el.type === 'text') {
          slide.addText(el.text || '', {
            x,
            y,
            w,
            h,
            fontSize: Math.max(10, Math.round((el.fontSize || 18) * 0.8)),
            bold: el.fontWeight === 'bold' || el.fontWeight === 'extrabold',
            italic: el.fontStyle === 'italic',
            align: el.textAlign || 'left',
            color: colorHex.slice(0, 6),
          });
        } else if (el.type === 'bullets' && Array.isArray(el.items)) {
          slide.addText(
            el.items.map((item) => ({ text: item, options: { bullet: true } })),
            {
              x,
              y,
              w,
              h,
              fontSize: Math.max(10, Math.round((el.fontSize || 14) * 0.85)),
              color: colorHex.slice(0, 6),
              valign: 'top',
            }
          );
        } else if (el.type === 'metric') {
          slide.addText(`${el.metricValue || ''}\n${el.metricLabel || ''}`, {
            x,
            y,
            w,
            h,
            fontSize: 16,
            bold: true,
            align: 'center',
            color: colorHex.slice(0, 6),
            fill: { color: (el.bgColor || '#F1F5F9').replace('#', '').slice(0, 6) },
          });
        } else if (el.type === 'table' && Array.isArray(el.tableRows) && el.tableRows.length > 0) {
          slide.addTable(
            el.tableRows.map((row) => row.map((cell) => ({ text: String(cell || '') }))),
            { x, y, w, h, fontSize: 11 }
          );
        } else if (el.type === 'image' && el.imageUrl && el.imageUrl.startsWith('/uploads/')) {
          const imgPath = resolveDiskPathFromUrl(el.imageUrl);
          if (fs.existsSync(imgPath)) {
            slide.addImage({ path: imgPath, x, y, w, h });
          }
        }
      }
    } else {
      slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 10, h: 0.12, fill: { color: accentHex } });
      slide.addText(page.title || '', {
        x: 0.7,
        y: 0.6,
        w: 8.6,
        h: 0.9,
        fontSize: 26,
        bold: true,
        color: isCover ? 'FFFFFF' : '0F172A',
      });
      if (page.subtitle) {
        slide.addText(page.subtitle, {
          x: 0.7,
          y: 1.5,
          w: 8.6,
          h: 0.6,
          fontSize: 14,
          color: isCover ? 'CBD5E1' : '475569',
        });
      }
      if (page.bullets?.length) {
        slide.addText(
          page.bullets.map((b) => ({ text: b, options: { bullet: true } })),
          {
            x: 0.7,
            y: 2.3,
            w: 8.6,
            h: 2.8,
            fontSize: 14,
            color: isCover ? 'F1F5F9' : '1E293B',
          }
        );
      }
    }

    if (page.speakerNotes) {
      slide.addNotes(page.speakerNotes);
    }
  }

  const out = await pptx.write({ outputType: 'nodebuffer' });
  return Buffer.isBuffer(out) ? out : Buffer.from(out as Uint8Array);
}

export function generateXlsxBuffer(
  sheets: Array<{ name: string; columns: string[]; rows: string[][] }>,
  asCsv = false
): Buffer {
  const wb = XLSX.utils.book_new();
  for (let i = 0; i < sheets.length; i++) {
    const s = sheets[i];
    const aoa = [s.columns || [], ...(s.rows || [])];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(wb, ws, (s.name || `Sheet${i + 1}`).slice(0, 31));
  }
  if (asCsv && sheets[0]) {
    const csv = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]);
    return Buffer.from(csv, 'utf-8');
  }
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

function toAsciiPdfSafe(str: string): string {
  // Standard Helvetica WinAnsi only covers Latin-1; keep ASCII/Latin-1 cleanly and replace unsupported glyphs safely
  return String(str || '').replace(/[^\x20-\x7E\xA0-\xFF]/g, '?');
}

export async function generatePdfFromLines(title: string, lines: string[]): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28; // A4
  const pageHeight = 841.89;
  const margin = 48;
  const maxWidth = pageWidth - margin * 2;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  page.drawText(toAsciiPdfSafe(title), {
    x: margin,
    y,
    size: 16,
    font: fontBold,
    color: rgb(0.06, 0.1, 0.2),
  });
  y -= 26;
  page.drawLine({
    start: { x: margin, y: y + 6 },
    end: { x: pageWidth - margin, y: y + 6 },
    thickness: 1,
    color: rgb(0.8, 0.84, 0.9),
  });
  y -= 12;

  for (const rawLine of lines) {
    const safe = toAsciiPdfSafe(rawLine);
    const words = safe.split(/\s+/);
    let current = '';
    const wrapped: string[] = [];
    for (const w of words) {
      const test = current ? `${current} ${w}` : w;
      if (fontRegular.widthOfTextAtSize(test, 10.5) > maxWidth) {
        if (current) wrapped.push(current);
        current = w;
      } else {
        current = test;
      }
    }
    if (current || safe === '') wrapped.push(current);

    for (const line of wrapped) {
      if (y < margin + 20) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }
      if (line) {
        page.drawText(line, {
          x: margin,
          y,
          size: 10.5,
          font: fontRegular,
          color: rgb(0.15, 0.2, 0.28),
        });
      }
      y -= 15;
    }
  }

  return Buffer.from(await pdfDoc.save());
}

export async function buildPdfFromImages(imageBuffers: Array<{ buffer: Buffer; mimeType?: string }>): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  for (const item of imageBuffers) {
    // Normalize any WebP/GIF/BMP/PNG/JPEG to PNG or JPEG for pdf-lib
    const meta = await sharp(item.buffer).metadata();
    const isJpg = meta.format === 'jpeg';
    const normBuf = isJpg
      ? await sharp(item.buffer).rotate().jpeg({ quality: 90 }).toBuffer()
      : await sharp(item.buffer).rotate().png().toBuffer();

    const embedded = isJpg ? await pdfDoc.embedJpg(normBuf) : await pdfDoc.embedPng(normBuf);
    const imgW = embedded.width;
    const imgH = embedded.height;
    const pageW = Math.max(300, Math.min(842, imgW));
    const pageH = Math.round((imgH / imgW) * pageW);
    const page = pdfDoc.addPage([pageW, pageH]);
    page.drawImage(embedded, { x: 0, y: 0, width: pageW, height: pageH });
  }
  return Buffer.from(await pdfDoc.save());
}

export async function mergePdfs(buffers: Buffer[]): Promise<Buffer> {
  const merged = await PDFDocument.create();
  for (const buf of buffers) {
    const src = await PDFDocument.load(buf, { ignoreEncryption: true });
    const copied = await merged.copyPages(src, src.getPageIndices());
    for (const p of copied) merged.addPage(p);
  }
  return Buffer.from(await merged.save());
}

export async function transformPdfBuffer(
  srcBuf: Buffer,
  options: {
    pageOrder?: number[]; // 0-based indices to keep/reorder
    rotations?: Record<number, number>; // pageIdx -> additional degrees
    annotations?: Array<{
      pageIndex: number;
      text: string;
      xPct: number;
      yPct: number;
      fontSize?: number;
      colorHex?: string;
    }>;
  }
): Promise<Buffer> {
  const srcDoc = await PDFDocument.load(srcBuf, { ignoreEncryption: true });
  const total = srcDoc.getPageCount();
  const order =
    Array.isArray(options.pageOrder) && options.pageOrder.length > 0
      ? options.pageOrder.filter((idx) => idx >= 0 && idx < total)
      : Array.from({ length: total }, (_, i) => i);

  const outDoc = await PDFDocument.create();
  const font = await outDoc.embedFont(StandardFonts.HelveticaBold);
  const copiedPages = await outDoc.copyPages(srcDoc, order);

  copiedPages.forEach((page, outIdx) => {
    const origIdx = order[outIdx];
    const extraDeg = options.rotations?.[origIdx] || 0;
    if (extraDeg) {
      const currentDeg = page.getRotation().angle;
      page.setRotation(degrees((currentDeg + extraDeg) % 360));
    }
    const anns = (options.annotations || []).filter((a) => a.pageIndex === outIdx || a.pageIndex === origIdx);
    const { width, height } = page.getSize();
    for (const ann of anns) {
      const x = Math.max(12, Math.min(width - 40, (ann.xPct / 100) * width));
      const y = Math.max(18, Math.min(height - 18, height - (ann.yPct / 100) * height));
      const hex = (ann.colorHex || '#0B57D0').replace('#', '');
      const r = parseInt(hex.slice(0, 2), 16) / 255 || 0.04;
      const g = parseInt(hex.slice(2, 4), 16) / 255 || 0.34;
      const b = parseInt(hex.slice(4, 6), 16) / 255 || 0.82;
      page.drawText(toAsciiPdfSafe(ann.text), {
        x,
        y,
        size: ann.fontSize || 12,
        font,
        color: rgb(r, g, b),
      });
    }
    outDoc.addPage(page);
  });

  return Buffer.from(await outDoc.save());
}

export async function processSingleImageWithSharp(
  inputBuffer: Buffer,
  opts: {
    width?: number;
    height?: number;
    fit?: 'cover' | 'contain' | 'fill' | 'inside';
    quality?: number;
    format?: 'jpeg' | 'png' | 'webp';
    watermarkText?: string;
    stripMetadata?: boolean;
  }
): Promise<{ buffer: Buffer; mimeType: string; extension: string; width: number; height: number }> {
  let pipeline = sharp(inputBuffer).rotate();
  if (opts.width || opts.height) {
    pipeline = pipeline.resize({
      width: opts.width || undefined,
      height: opts.height || undefined,
      fit: opts.fit || 'inside',
      withoutEnlargement: false,
      background: { r: 255, g: 255, b: 255, alpha: opts.format === 'png' ? 0 : 1 },
    });
  }

  const resizedBuf = await pipeline.toBuffer();
  const meta = await sharp(resizedBuf).metadata();
  const w = meta.width || opts.width || 800;
  const h = meta.height || opts.height || 600;

  let finalPipeline = sharp(resizedBuf);
  if (opts.watermarkText && opts.watermarkText.trim()) {
    const safeWm = opts.watermarkText
      .trim()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const fontSize = Math.max(14, Math.round(Math.min(w, h) * 0.04));
    const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${Math.max(8, w - safeWm.length * fontSize * 0.65 - 28)}" y="${Math.max(8, h - fontSize - 24)}" width="${safeWm.length * fontSize * 0.65 + 16}" height="${fontSize + 14}" rx="6" fill="rgba(15,23,42,0.55)" />
      <text x="${w - 18}" y="${h - 18}" text-anchor="end" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="bold" fill="rgba(255,255,255,0.92)">${safeWm}</text>
    </svg>`;
    finalPipeline = finalPipeline.composite([{ input: Buffer.from(svg), gravity: 'southeast' }]);
  }

  if (!opts.stripMetadata) {
    finalPipeline = finalPipeline.keepMetadata();
  }

  const fmt = opts.format || (meta.format === 'png' ? 'png' : meta.format === 'webp' ? 'webp' : 'jpeg');
  const q = Math.max(25, Math.min(100, Math.round((opts.quality ?? 0.82) * (opts.quality && opts.quality <= 1 ? 100 : 1))));

  if (fmt === 'png') {
    const out = await finalPipeline.png({ compressionLevel: 9, palette: q < 85 }).toBuffer();
    return { buffer: out, mimeType: 'image/png', extension: 'png', width: w, height: h };
  }
  if (fmt === 'webp') {
    const out = await finalPipeline.webp({ quality: q }).toBuffer();
    return { buffer: out, mimeType: 'image/webp', extension: 'webp', width: w, height: h };
  }
  const out = await finalPipeline.jpeg({ quality: q, mozjpeg: true }).toBuffer();
  return { buffer: out, mimeType: 'image/jpeg', extension: 'jpg', width: w, height: h };
}
