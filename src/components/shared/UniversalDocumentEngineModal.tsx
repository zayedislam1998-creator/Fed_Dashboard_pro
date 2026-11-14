import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { X, FileText, FileSpreadsheet, Presentation, Image as ImageIcon, Film, Code, ClipboardList, Download, Save, Copy, History, Share2, Mail, Edit3, Eye, Zap, RotateCcw, FilePlus2, ExternalLink, Check, AlertCircle, Lock, Globe, Users, Sparkles } from 'lucide-react';
import {
  EngineSlidePageClient,
  FileVersionItem,
  ParsedEnginePayloadClient,
  convertViaEngine,
  ensureClientSlideElements,
  fetchEngineFileFast,
  fetchFileVersions,
  getCachedEnginePayload,
  restoreFileVersion,
  saveEngineFileEdit,
} from '../../services/engineCache';
import {
  formatBytes,
  fetchFileShares,
  fetchWorkspaceDocs,
  fetchWorkspaceSlides,
  saveFileShares,
  saveMailAttachmentToServerFiles,
  saveWorkspaceDoc,
  saveWorkspaceSlideDeck,
  WorkspaceFileItem,
} from '../../services/workspaceApi';
import type { SheetTabModel } from '../engines/SpreadsheetGridEngine';
import type { PdfAnnotationDraft } from '../engines/PdfEnginePane';
import type { ImageEditorTarget } from '../shared/ImageEditorModal';
import { FileManagerPickerModal } from '../filemanager/FileManagerPickerModal';

const RichDocEditorPane = lazy(() =>
  import('../engines/RichDocEditorPane').then((m) => ({ default: m.RichDocEditorPane }))
);
const PdfEnginePane = lazy(() =>
  import('../engines/PdfEnginePane').then((m) => ({ default: m.PdfEnginePane }))
);
const SpreadsheetGridEngine = lazy(() =>
  import('../engines/SpreadsheetGridEngine').then((m) => ({ default: m.SpreadsheetGridEngine }))
);
const SlideCanvasStudio = lazy(() =>
  import('../engines/SlideCanvasStudio').then((m) => ({ default: m.SlideCanvasStudio }))
);
const FormEnginePane = lazy(() =>
  import('../engines/FormEnginePane').then((m) => ({ default: m.FormEnginePane }))
);
const ImageEditorModal = lazy(() =>
  import('../shared/ImageEditorModal').then((m) => ({ default: m.ImageEditorModal }))
);

export interface UniversalEngineTarget {
  title: string;
  url?: string;
  mimeType?: string;
  extension?: string;
  fileId?: string;
  slideDeckId?: string;
  docId?: string;
  formId?: string;
  sheetId?: string;
  bodyText?: string;
  htmlContent?: string;
  initialMode?: 'VIEW' | 'EDIT';
  fromMailAttachment?: boolean;
}

interface UniversalDocumentEngineModalProps {
  isOpen: boolean;
  target: UniversalEngineTarget | null;
  onClose: () => void;
  onSavedOrUpdated?: () => void;
  onComposeShare?: (payload: { to: string; subject: string; bodyText: string }) => void;
}

type EngineKind =
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

function inferExtension(target: UniversalEngineTarget): string {
  if (target.extension) return target.extension.toLowerCase().replace(/^\./, '');
  const titleMatch = String(target.title || '').match(/\.([a-zA-Z0-9]+)$/);
  if (titleMatch) return titleMatch[1].toLowerCase();
  const urlClean = String(target.url || '').split('?')[0];
  const urlMatch = urlClean.match(/\.([a-zA-Z0-9]+)$/);
  if (urlMatch) return urlMatch[1].toLowerCase();
  return '';
}

function inferKind(target: UniversalEngineTarget): EngineKind {
  if (target.formId) return 'FORM';
  if (target.slideDeckId) return 'SLIDES';
  if (target.sheetId) return 'SHEET';
  const ext = inferExtension(target);
  const mime = String(target.mimeType || '').toLowerCase();

  if (ext === 'pdf' || mime.includes('pdf')) return 'PDF';
  if (ext === 'docx' || mime.includes('wordprocessingml')) return 'DOCX';
  if (ext === 'pptx' || mime.includes('presentationml')) return 'PPTX';
  if (ext === 'slides' || ext === 'gslides') return 'SLIDES';
  if (ext === 'form' || ext === 'gforms') return 'FORM';
  if (['xlsx', 'xls', 'csv', 'tsv', 'gsheet'].includes(ext) || mime.includes('spreadsheet') || mime.includes('csv')) {
    return 'SHEET';
  }
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp', 'avif'].includes(ext) || mime.startsWith('image/')) {
    return 'IMAGE';
  }
  if (['mp4', 'webm', 'mov', 'mp3', 'wav', 'ogg', 'm4a'].includes(ext) || mime.startsWith('video/') || mime.startsWith('audio/')) {
    return 'MEDIA';
  }
  if (['json', 'js', 'ts', 'tsx', 'jsx', 'html', 'css', 'xml', 'yaml', 'yml', 'sql', 'py', 'sh', 'log'].includes(ext)) {
    return 'CODE';
  }
  if (target.docId || ['doc', 'txt', 'md', 'rtf', 'gdoc'].includes(ext) || mime.startsWith('text/')) {
    return 'DOC';
  }
  return 'BINARY';
}

function stripExt(name: string): string {
  return String(name || 'Untitled').replace(/\.[^.]+$/, '');
}

const CODE_EXTENSIONS_SET = new Set(['json', 'js', 'ts', 'tsx', 'jsx', 'html', 'css', 'xml', 'yaml', 'yml', 'sql', 'py', 'sh', 'log']);

export const UniversalDocumentEngineModal: React.FC<UniversalDocumentEngineModalProps> = ({
  isOpen,
  target,
  onClose,
  onSavedOrUpdated,
  onComposeShare,
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);
  const [loadLatencyMs, setLoadLatencyMs] = useState<number | null>(null);
  const [fromCache, setFromCache] = useState(false);

  const [mode, setMode] = useState<'VIEW' | 'EDIT'>('VIEW');
  const [kind, setKind] = useState<EngineKind>('DOC');
  const [title, setTitle] = useState('');
  const [resolvedUrl, setResolvedUrl] = useState('');
  const [mimeType, setMimeType] = useState('');
  const [extension, setExtension] = useState('');
  const [sizeBytes, setSizeBytes] = useState(0);
  const [versionCount, setVersionCount] = useState(1);
  const [visibility, setVisibility] = useState<'PRIVATE' | 'WORKSPACE' | 'PUBLIC'>('WORKSPACE');
  const [payloadRef, setPayloadRef] = useState<ParsedEnginePayloadClient | null>(null);

  // Content states
  const [docHtml, setDocHtml] = useState('');
  const [docPlain, setDocPlain] = useState('');
  const [codeText, setCodeText] = useState('');
  const [slideTitle, setSlideTitle] = useState('');
  const [slideTheme, setSlideTheme] = useState('#D97706');
  const [slidePages, setSlidePages] = useState<EngineSlidePageClient[]>([]);
  const [sheets, setSheets] = useState<SheetTabModel[]>([]);
  const [imageZoom, setImageZoom] = useState(100);
  const [mediaRate, setMediaRate] = useState(1);

  // Image insertion & editing inside Universal Engine
  const [imageEditorTarget, setImageEditorTarget] = useState<ImageEditorTarget | null>(null);
  const imageEditCallbackRef = useRef<((newUrl: string) => void) | null>(null);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const imageInsertCallbackRef = useRef<((url: string) => void) | null>(null);

  // Side drawers: Version History & Share
  const [activeDrawer, setActiveDrawer] = useState<'NONE' | 'HISTORY' | 'SHARE'>('NONE');
  const [versions, setVersions] = useState<FileVersionItem[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [shareUsers, setShareUsers] = useState<Array<{ id: string; name: string; email: string; role: string }>>([]);
  const [shareGrants, setShareGrants] = useState<Array<{ targetUserId: string; accessLevel: 'VIEW' | 'EDIT' }>>([]);
  const [loadingShares, setLoadingShares] = useState(false);

  const showToast = (text: string, ok = true) => {
    setToast({ text, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const applyServerPayload = (p: ParsedEnginePayloadClient) => {
    setPayloadRef(p);
    setKind(p.kind);
    setTitle(p.name);
    setResolvedUrl(p.url);
    setMimeType(p.mimeType);
    setExtension(p.extension);
    setSizeBytes(p.sizeBytes);
    setVersionCount(p.versionCount || 1);
    setVisibility((p.visibility as any) || 'WORKSPACE');

    if (p.kind === 'DOCX' || p.kind === 'DOC') {
      setDocHtml(p.html || '');
      setDocPlain(p.plainText || '');
    } else if (p.kind === 'CODE') {
      setCodeText(p.plainText || '');
    } else if (p.kind === 'SLIDES' || p.kind === 'PPTX') {
      const theme = p.slideDeck?.themeColor || '#D97706';
      setSlideTitle(p.slideDeck?.title || stripExt(p.name));
      setSlideTheme(theme);
      setSlidePages(
        (p.slideDeck?.pages || []).map((pg) => ensureClientSlideElements(pg, theme))
      );
    } else if (p.kind === 'SHEET') {
      setSheets(p.sheets && p.sheets.length > 0 ? p.sheets : [{ name: 'Sheet1', columns: ['A', 'B', 'C', 'D'], rows: [['', '', '', ''], ['', '', '', '']] }]);
    }
  };

  useEffect(() => {
    if (!isOpen || !target) return;
    const t0 = performance.now();
    setError(null);
    setActiveDrawer('NONE');
    setImageZoom(100);
    setMediaRate(1);
    setMode(target.initialMode || 'VIEW');

    // Immediate client-side cache check for server files (<1ms!)
    if (target.fileId) {
      const cached = getCachedEnginePayload(target.fileId);
      if (cached) {
        applyServerPayload(cached);
        setFromCache(true);
        setLoadLatencyMs(Number((performance.now() - t0).toFixed(2)));
        setLoading(false);
        return;
      }

      setLoading(true);
      setFromCache(false);
      fetchEngineFileFast(target.fileId)
        .then((payload) => {
          applyServerPayload(payload);
          setLoadLatencyMs(Number((performance.now() - t0).toFixed(1)));
        })
        .catch((err: any) => {
          setError(err.message || 'Unable to parse file in Universal Engine.');
        })
        .finally(() => setLoading(false));
      return;
    }

    // Non-fileId targets: Slide Deck ID, Doc ID, Form ID, or Mail Attachment URL
    const detected = inferKind(target);
    const ext = inferExtension(target);
    setKind(detected);
    setTitle(target.title || 'Untitled');
    setResolvedUrl(target.url || '');
    setMimeType(target.mimeType || '');
    setExtension(ext);
    setPayloadRef(null);
    setFromCache(false);

    if (target.slideDeckId) {
      setLoading(true);
      fetchWorkspaceSlides()
        .then((res) => {
          const deck = res.slides.find((d) => d.id === target.slideDeckId);
          if (!deck) throw new Error('Slide deck not found.');
          const theme = deck.themeColor || '#D97706';
          setTitle(deck.title);
          setSlideTitle(deck.title);
          setSlideTheme(theme);
          setSlidePages((deck.pages || []).map((pg) => ensureClientSlideElements(pg as any, theme)));
          setLoadLatencyMs(Number((performance.now() - t0).toFixed(1)));
        })
        .catch((err: any) => setError(err.message || 'Failed to load slide deck.'))
        .finally(() => setLoading(false));
      return;
    }

    if (target.docId) {
      setLoading(true);
      fetchWorkspaceDocs()
        .then((docs) => {
          const doc = docs.find((d) => d.id === target.docId);
          if (!doc) throw new Error('Document not found.');
          setTitle(doc.title);
          setDocPlain(doc.bodyText || '');
          setDocHtml((doc as any).htmlContent || '');
          setLoadLatencyMs(Number((performance.now() - t0).toFixed(1)));
        })
        .catch((err: any) => setError(err.message || 'Failed to load document.'))
        .finally(() => setLoading(false));
      return;
    }

    if (detected === 'DOC' || detected === 'CODE') {
      if (target.bodyText !== undefined || target.htmlContent !== undefined) {
        setDocHtml(target.htmlContent || '');
        setDocPlain(target.bodyText || '');
        setCodeText(target.bodyText || '');
        setLoadLatencyMs(Number((performance.now() - t0).toFixed(2)));
        setLoading(false);
        return;
      }
      if (target.url) {
        setLoading(true);
        fetch(target.url)
          .then((r) => r.text())
          .then((txt) => {
            setDocPlain(txt);
            setCodeText(txt);
            setLoadLatencyMs(Number((performance.now() - t0).toFixed(1)));
          })
          .catch(() => setError('Could not fetch text preview from attachment URL.'))
          .finally(() => setLoading(false));
        return;
      }
    }

    if (detected === 'SHEET' && target.url) {
      setLoading(true);
      fetch(target.url)
        .then((r) => r.arrayBuffer())
        .then((buf) => {
          const wb = XLSX.read(buf, { type: 'array' });
          const parsedSheets: SheetTabModel[] = wb.SheetNames.map((sn) => {
            const ws = wb.Sheets[sn];
            const aoa = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 }) || [];
            const maxCols = Math.max(4, ...aoa.map((r) => (Array.isArray(r) ? r.length : 0)));
            const firstRow = Array.isArray(aoa[0]) ? aoa[0] : [];
            const columns = Array.from({ length: maxCols }, (_, i) =>
              String(firstRow[i] ?? `Col ${i + 1}`)
            );
            const rows = (aoa.length > 1 ? aoa.slice(1) : [['', '', '', '']]).map((r) =>
              Array.from({ length: maxCols }, (_, i) => String((Array.isArray(r) ? r[i] : '') ?? ''))
            );
            return { name: sn, columns, rows };
          });
          setSheets(parsedSheets);
          setLoadLatencyMs(Number((performance.now() - t0).toFixed(1)));
        })
        .catch(() => setError('Failed to parse spreadsheet attachment.'))
        .finally(() => setLoading(false));
      return;
    }

    setLoadLatencyMs(Number((performance.now() - t0).toFixed(2)));
    setLoading(false);
  }, [isOpen, target]);

  // Keyboard shortcuts (Ctrl+S & Esc)
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !imageEditorTarget && !showImagePicker) {
        onClose();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSavePrimary(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const isEditableKind = useMemo(() => {
    return ['DOCX', 'DOC', 'CODE', 'SLIDES', 'PPTX', 'SHEET', 'PDF', 'IMAGE', 'FORM'].includes(kind);
  }, [kind]);

  const handleSavePrimary = async (saveAsCopy = false) => {
    if (!target) return;
    setSaving(true);
    try {
      if (target.fileId) {
        let resPayload: { file: WorkspaceFileItem; payload: ParsedEnginePayloadClient } | null = null;
        if (kind === 'DOCX' || kind === 'DOC') {
          resPayload = await saveEngineFileEdit(target.fileId, {
            mode: kind,
            title,
            html: docHtml,
            plainText: docPlain,
            saveAsCopy,
          });
        } else if (kind === 'CODE') {
          resPayload = await saveEngineFileEdit(target.fileId, {
            mode: 'CODE',
            title,
            plainText: codeText,
            saveAsCopy,
          });
        } else if (kind === 'SLIDES' || kind === 'PPTX') {
          resPayload = await saveEngineFileEdit(target.fileId, {
            mode: 'SLIDES',
            title,
            slideDeck: {
              title: slideTitle || stripExt(title),
              themeColor: slideTheme,
              pages: slidePages,
            },
            saveAsCopy,
          });
        } else if (kind === 'SHEET') {
          resPayload = await saveEngineFileEdit(target.fileId, {
            mode: 'SHEET',
            title,
            sheets,
            saveAsCopy,
          });
        }
        if (resPayload?.payload && !saveAsCopy) {
          applyServerPayload(resPayload.payload);
        }
        showToast(saveAsCopy ? 'Saved edited copy to File Manager.' : 'Saved & indexed new file version.');
        onSavedOrUpdated?.();
        return;
      }

      if (target.slideDeckId) {
        await saveWorkspaceSlideDeck({
          id: target.slideDeckId,
          title: slideTitle || stripExt(title),
          themeColor: slideTheme,
          pages: slidePages as any,
        });
        showToast('Presentation saved & synced.');
        onSavedOrUpdated?.();
        return;
      }

      if (target.docId) {
        await saveWorkspaceDoc({
          id: target.docId,
          title: stripExt(title),
          bodyText: docPlain,
          htmlContent: docHtml,
        });
        showToast('Document saved & synced.');
        onSavedOrUpdated?.();
        return;
      }

      showToast('Use Download or Save to File Manager for standalone attachments.', false);
    } catch (err: any) {
      showToast(err.message || 'Save failed.', false);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAttachmentToFiles = async () => {
    if (!resolvedUrl) return;
    setSaving(true);
    try {
      await saveMailAttachmentToServerFiles({
        name: title,
        url: resolvedUrl,
        mimeType,
        folderId: kind === 'IMAGE' ? 'folder-images' : 'folder-documents',
      });
      showToast('Saved to Server File Manager!');
      onSavedOrUpdated?.();
    } catch (err: any) {
      showToast(err.message || 'Failed to save to File Manager.', false);
    } finally {
      setSaving(false);
    }
  };

  const handleConvertAction = async (
    action: 'TEXT_TO_PDF' | 'DOC_TO_DOCX' | 'SLIDES_TO_PPTX' | 'SHEETS_TO_XLSX' | 'IMAGES_TO_PDF'
  ) => {
    setSaving(true);
    try {
      let res;
      if (action === 'IMAGES_TO_PDF' && target?.fileId) {
        res = await convertViaEngine({
          action: 'IMAGES_TO_PDF',
          fileIds: [target.fileId],
          title: stripExt(title),
        });
      } else if (action === 'SLIDES_TO_PPTX') {
        res = await convertViaEngine({
          action: 'SLIDES_TO_PPTX',
          title: slideTitle || stripExt(title),
          pages: slidePages,
        });
      } else if (action === 'DOC_TO_DOCX') {
        res = await convertViaEngine({
          action: 'DOC_TO_DOCX',
          title: stripExt(title),
          lines: docHtml || docPlain || codeText,
        });
      } else if (action === 'SHEETS_TO_XLSX') {
        res = await convertViaEngine({
          action: 'SHEETS_TO_XLSX',
          title: stripExt(title),
          sheets,
        });
      } else {
        const lines =
          kind === 'SLIDES' || kind === 'PPTX'
            ? slidePages.flatMap((p) => [`# Slide ${p.slideNumber}: ${p.title}`, p.subtitle || '', ...(p.bullets || []), ''])
            : kind === 'SHEET'
            ? sheets.flatMap((s) => [`[${s.name}]`, s.columns.join(' | '), ...s.rows.map((r) => r.join(' | ')), ''])
            : (docPlain || codeText || '').split(/\r?\n/);
        res = await convertViaEngine({
          action: 'TEXT_TO_PDF',
          title: stripExt(title),
          lines,
        });
      }
      showToast(`Converted & saved "${res.file.name}" to File Manager!`);
      onSavedOrUpdated?.();
    } catch (err: any) {
      showToast(err.message || 'Conversion failed.', false);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenHistory = async () => {
    if (!target?.fileId) return;
    if (activeDrawer === 'HISTORY') {
      setActiveDrawer('NONE');
      return;
    }
    setActiveDrawer('HISTORY');
    setLoadingVersions(true);
    try {
      const list = await fetchFileVersions(target.fileId);
      setVersions(list);
    } catch (err: any) {
      showToast(err.message || 'Could not load version history.', false);
    } finally {
      setLoadingVersions(false);
    }
  };

  const handleRestoreVersion = async (versionId: string) => {
    if (!target?.fileId) return;
    setSaving(true);
    try {
      const res = await restoreFileVersion(target.fileId, versionId);
      if (res.payload) applyServerPayload(res.payload);
      const list = await fetchFileVersions(target.fileId);
      setVersions(list);
      showToast('Restored file to selected version!');
      onSavedOrUpdated?.();
    } catch (err: any) {
      showToast(err.message || 'Restore failed.', false);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenShare = async () => {
    if (!target?.fileId) return;
    if (activeDrawer === 'SHARE') {
      setActiveDrawer('NONE');
      return;
    }
    setActiveDrawer('SHARE');
    setLoadingShares(true);
    try {
      const data = await fetchFileShares(target.fileId);
      setVisibility(data.visibility);
      setShareGrants(data.shares.map((s) => ({ targetUserId: s.targetUserId, accessLevel: s.accessLevel })));
      setShareUsers(data.users);
    } catch (err: any) {
      showToast(err.message || 'Could not load sharing settings.', false);
    } finally {
      setLoadingShares(false);
    }
  };

  const handleSaveShares = async () => {
    if (!target?.fileId) return;
    setSaving(true);
    try {
      await saveFileShares(target.fileId, { visibility, grants: shareGrants });
      showToast('Sharing permissions updated!');
      onSavedOrUpdated?.();
    } catch (err: any) {
      showToast(err.message || 'Failed to update shares.', false);
    } finally {
      setSaving(false);
    }
  };

  const handlePdfSaveTransform = async ({
    pageOrder,
    rotations,
    annotations,
    saveAsCopy,
  }: {
    pageOrder: number[];
    rotations: Record<number, number>;
    annotations: PdfAnnotationDraft[];
    saveAsCopy?: boolean;
  }) => {
    if (!target?.fileId) {
      showToast('Save this PDF attachment to Server File Manager first to save edits.', false);
      return;
    }
    setSaving(true);
    try {
      const res = await saveEngineFileEdit(target.fileId, {
        mode: 'PDF_TRANSFORM',
        pdfTransform: { pageOrder, rotations, annotations },
        saveAsCopy,
      });
      if (!saveAsCopy && res.payload) applyServerPayload(res.payload);
      showToast(saveAsCopy ? 'Saved PDF copy to File Manager.' : 'Updated PDF & created version snapshot!');
      onSavedOrUpdated?.();
    } catch (err: any) {
      showToast(err.message || 'PDF transform failed.', false);
    } finally {
      setSaving(false);
    }
  };

  const handlePdfSplitExtract = async (pageNumbers1Based: number[]) => {
    if (!target?.fileId) return;
    setSaving(true);
    try {
      const res = await convertViaEngine({
        action: 'PDF_SPLIT',
        fileId: target.fileId,
        pageRange: pageNumbers1Based,
        title: `${stripExt(title)}_Pages_${pageNumbers1Based.join('-')}`,
      });
      showToast(`Extracted ${pageNumbers1Based.length} page(s) to "${res.file.name}"!`);
      onSavedOrUpdated?.();
    } catch (err: any) {
      showToast(err.message || 'PDF split failed.', false);
    } finally {
      setSaving(false);
    }
  };

  const triggerDocInsertImage = () => {
    imageInsertCallbackRef.current = (pickedUrl) => {
      const imgTag = `<p><img src="${pickedUrl}" alt="Inserted image" style="max-width:100%;border-radius:10px;margin:8px 0;" /></p>`;
      const nextHtml = `${docHtml || `<p>${docPlain}</p>`}${imgTag}`;
      setDocHtml(nextHtml);
    };
    setShowImagePicker(true);
  };

  const triggerDocEditSelectedImage = (imgUrl: string) => {
    imageEditCallbackRef.current = (newUrl) => {
      setDocHtml((prev) => prev.split(imgUrl).join(newUrl));
    };
    setImageEditorTarget({ title: `${stripExt(title)} - Inline Image`, imageUrl: imgUrl });
  };

  const handleSaveSheetViaEngine = async (nextSheets: SheetTabModel[]) => {
    setSheets(nextSheets);
    if (target?.fileId) {
      await handleSavePrimary(false);
    } else {
      await handleConvertAction('SHEETS_TO_XLSX');
    }
  };

  if (!isOpen || !target) return null;

  const kindColor =
    kind === 'PDF'
      ? 'bg-red-50 text-red-700 border-red-200'
      : kind === 'PPTX' || kind === 'SLIDES'
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : kind === 'SHEET'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : kind === 'IMAGE'
      ? 'bg-purple-50 text-purple-700 border-purple-200'
      : kind === 'FORM'
      ? 'bg-teal-50 text-teal-700 border-teal-200'
      : 'bg-blue-50 text-[#0B57D0] border-blue-200';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-[2px] flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white w-full max-w-[1440px] h-[94vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden relative">
        {/* Top Unified Engine Bar */}
        <div className="px-3 sm:px-5 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${kindColor}`}>
              {kind === 'SHEET' ? (
                <FileSpreadsheet className="w-4 h-4" />
              ) : kind === 'SLIDES' || kind === 'PPTX' ? (
                <Presentation className="w-4 h-4" />
              ) : kind === 'IMAGE' ? (
                <ImageIcon className="w-4 h-4" />
              ) : kind === 'MEDIA' ? (
                <Film className="w-4 h-4" />
              ) : kind === 'CODE' ? (
                <Code className="w-4 h-4" />
              ) : kind === 'FORM' ? (
                <ClipboardList className="w-4 h-4" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                {mode === 'EDIT' && target.fileId ? (
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="text-sm font-bold text-slate-900 bg-white border border-slate-300 rounded-lg px-2 py-0.5 max-w-xs sm:max-w-md outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <h3 className="text-sm font-bold text-slate-900 truncate max-w-xs sm:max-w-md">
                    {title}
                  </h3>
                )}
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${kindColor}`}>
                  {kind}
                </span>
                {loadLatencyMs !== null && (
                  <span
                    title={fromCache ? 'Served instantly from in-memory client LRU cache' : 'Parsed by server Universal Engine'}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"
                  >
                    <Zap className="w-2.5 h-2.5" />
                    {loadLatencyMs}ms {fromCache ? 'cache' : ''}
                  </span>
                )}
                {target.fileId && (
                  <button
                    type="button"
                    onClick={handleOpenHistory}
                    className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200/70 hover:bg-slate-200 text-slate-700 cursor-pointer"
                  >
                    v{versionCount}
                  </button>
                )}
                {sizeBytes > 0 && (
                  <span className="text-[11px] text-slate-500 hidden md:inline">{formatBytes(sizeBytes)}</span>
                )}
              </div>
            </div>
          </div>

          {/* Right Toolbar Actions */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {isEditableKind && (
              <div className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5">
                <button
                  type="button"
                  onClick={() => setMode('VIEW')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                    mode === 'VIEW' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  View
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (kind === 'IMAGE') {
                      imageEditCallbackRef.current = (newUrl) => {
                        setResolvedUrl(newUrl);
                        onSavedOrUpdated?.();
                      };
                      setImageEditorTarget({
                        title,
                        imageUrl: resolvedUrl,
                        fileId: target.fileId,
                      });
                    } else {
                      setMode('EDIT');
                    }
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                    mode === 'EDIT' ? 'bg-[#0B57D0] text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit
                </button>
              </div>
            )}

            {/* Save Buttons */}
            {(target.fileId || target.docId || target.slideDeckId) &&
              ['DOCX', 'DOC', 'CODE', 'SLIDES', 'PPTX', 'SHEET'].includes(kind) && (
                <>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleSavePrimary(false)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    {<Save className="w-3.5 h-3.5" />}
                    Save
                  </button>
                  {target.fileId && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleSavePrimary(true)}
                      title="Save edited copy without overwriting original"
                      className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Copy
                    </button>
                  )}
                </>
              )}

            {/* Cross-Format Convert to PDF */}
            {kind !== 'PDF' && kind !== 'MEDIA' && kind !== 'BINARY' && (
              <button
                type="button"
                disabled={saving}
                onClick={() => handleConvertAction(kind === 'IMAGE' ? 'IMAGES_TO_PDF' : 'TEXT_TO_PDF')}
                title="Convert & save PDF copy into File Manager"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Save PDF
              </button>
            )}

            {target.fromMailAttachment && resolvedUrl && !target.fileId && (
              <button
                type="button"
                disabled={saving}
                onClick={handleSaveAttachmentToFiles}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#0B57D0] text-white text-xs font-bold cursor-pointer"
              >
                <FilePlus2 className="w-3.5 h-3.5" />
                Save to Drive
              </button>
            )}

            {target.fileId && (
              <>
                <button
                  type="button"
                  onClick={handleOpenHistory}
                  title="Version History & 1-Click Restore"
                  className={`p-1.5 rounded-xl border cursor-pointer ${
                    activeDrawer === 'HISTORY'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <History className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleOpenShare}
                  title="Sharing & Access Control"
                  className={`p-1.5 rounded-xl border cursor-pointer ${
                    activeDrawer === 'SHARE'
                      ? 'bg-[#0B57D0] text-white border-[#0B57D0]'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Share2 className="w-4 h-4" />
                </button>
              </>
            )}

            {onComposeShare && (
              <button
                type="button"
                onClick={() =>
                  onComposeShare({
                    to: '',
                    subject: `Shared: ${title}`,
                    bodyText: `Please review "${title}".\n${resolvedUrl ? `Link: ${window.location.origin}${resolvedUrl}` : ''}\n\n${docPlain.slice(0, 600)}`,
                  })
                }
                title="Share via Email"
                className="p-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <Mail className="w-4 h-4" />
              </button>
            )}

            {resolvedUrl && (
              <a
                href={resolvedUrl}
                download={title}
                title="Download original file"
                className="p-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
              >
                <Download className="w-4 h-4" />
              </a>
            )}

            <button
              type="button"
              onClick={onClose}
              title="Close (Esc)"
              className="p-1.5 rounded-xl bg-slate-200/70 hover:bg-slate-300 text-slate-700 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Toast Banner */}
        {toast && (
          <div
            className={`px-4 py-2 text-xs font-semibold flex items-center gap-2 border-b ${
              toast.ok
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-red-50 text-red-700 border-red-200'
            }`}
          >
            {toast.ok ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {toast.text}
          </div>
        )}

        {/* Main Workspace + Optional Right Drawer */}
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 flex flex-col overflow-hidden">
            {loading ? null : error ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
                <AlertCircle className="w-10 h-10 text-red-500" />
                <p className="text-sm font-bold text-slate-900">{error}</p>
                {resolvedUrl && (
                  <a
                    href={resolvedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0B57D0] text-white text-xs font-bold"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open Raw File
                  </a>
                )}
              </div>
            ) : (
              <Suspense
                fallback={null}
              >
                {(kind === 'DOCX' || kind === 'DOC') && (
                  <RichDocEditorPane
                    title={title}
                    html={docHtml}
                    plainText={docPlain}
                    mode={mode}
                    onChange={({ html, plainText }) => {
                      setDocHtml(html);
                      setDocPlain(plainText);
                    }}
                    onInsertImageRequest={triggerDocInsertImage}
                    onEditSelectedImage={triggerDocEditSelectedImage}
                    onExportPdf={() => handleConvertAction('TEXT_TO_PDF')}
                    onExportDocx={() => handleConvertAction('DOC_TO_DOCX')}
                  />
                )}

                {kind === 'PDF' && resolvedUrl && (
                  <PdfEnginePane
                    url={resolvedUrl}
                    title={title}
                    onSaveTransform={handlePdfSaveTransform}
                    onSplitExtractPages={handlePdfSplitExtract}
                    onExportPageAsImage={(dataUrl, pageNum) => {
                      imageEditCallbackRef.current = () => {
                        onSavedOrUpdated?.();
                      };
                      setImageEditorTarget({
                        title: `${stripExt(title)}_Page_${pageNum}.png`,
                        imageUrl: dataUrl,
                      });
                    }}
                  />
                )}

                {(kind === 'SLIDES' || kind === 'PPTX') && (
                  <SlideCanvasStudio
                    title={slideTitle || stripExt(title)}
                    themeColor={slideTheme}
                    pages={slidePages}
                    mode={mode}
                    onChangePages={setSlidePages}
                    onChangeThemeColor={setSlideTheme}
                    onInsertImageRequest={(onChosen) => {
                      imageInsertCallbackRef.current = onChosen;
                      setShowImagePicker(true);
                    }}
                    onEditImageRequest={(imgUrl, onUpdated) => {
                      imageEditCallbackRef.current = onUpdated;
                      setImageEditorTarget({
                        title: `${stripExt(title)} - Slide Image`,
                        imageUrl: imgUrl,
                      });
                    }}
                    onExportPptx={() => handleConvertAction('SLIDES_TO_PPTX')}
                    onExportPdf={() => handleConvertAction('TEXT_TO_PDF')}
                    onSave={() => handleSavePrimary(false)}
                  />
                )}

                {kind === 'SHEET' && (
                  <SpreadsheetGridEngine
                    title={stripExt(title)}
                    initialSheets={sheets}
                    readOnly={mode === 'VIEW'}
                    onChange={setSheets}
                    onSave={handleSaveSheetViaEngine}
                    onExportPdf={() => handleConvertAction('TEXT_TO_PDF')}
                  />
                )}

                {kind === 'FORM' && (
                  <FormEnginePane
                    formId={target.formId}
                    title={title}
                    mode={mode}
                    onSaved={onSavedOrUpdated}
                  />
                )}

                {kind === 'IMAGE' && (
                  <div className="flex-1 flex flex-col bg-slate-900 overflow-hidden">
                    <div className="px-4 py-2 bg-slate-800 border-b border-slate-700 flex items-center justify-between text-xs text-slate-200">
                      <div className="flex items-center gap-3">
                        <span>
                          {payloadRef?.width && payloadRef?.height
                            ? `${payloadRef.width} Ã— ${payloadRef.height} px`
                            : 'Image Preview'}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setImageZoom((z) => Math.max(25, z - 25))}
                            className="px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 cursor-pointer"
                          >
                            -
                          </button>
                          <span className="w-12 text-center font-mono">{imageZoom}%</span>
                          <button
                            type="button"
                            onClick={() => setImageZoom((z) => Math.min(250, z + 25))}
                            className="px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          imageEditCallbackRef.current = (newUrl) => {
                            setResolvedUrl(newUrl);
                            onSavedOrUpdated?.();
                          };
                          setImageEditorTarget({
                            title,
                            imageUrl: resolvedUrl,
                            fileId: target.fileId,
                          });
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Open Smart Image Editor
                      </button>
                    </div>
                    <div className="flex-1 overflow-auto flex items-center justify-center p-6">
                      {resolvedUrl ? (
                        <img
                          src={resolvedUrl}
                          alt={title}
                          style={{ transform: `scale(${imageZoom / 100})` }}
                          className="max-h-full max-w-full object-contain rounded-lg shadow-2xl transition-transform"
                        />
                      ) : (
                        <p className="text-slate-400 text-sm">No image URL available.</p>
                      )}
                    </div>
                  </div>
                )}

                {kind === 'MEDIA' && (
                  <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 p-6 gap-4">
                    {mimeType.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a'].includes(extension) ? (
                      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl p-6 text-center space-y-4">
                        <Film className="w-10 h-10 text-blue-400 mx-auto" />
                        <p className="text-sm font-bold text-white">{title}</p>
                        <audio
                          controls
                          src={resolvedUrl}
                          className="w-full"
                          ref={(el) => {
                            if (el) el.playbackRate = mediaRate;
                          }}
                        />
                      </div>
                    ) : (
                      <video
                        controls
                        src={resolvedUrl}
                        className="max-h-[70vh] max-w-full rounded-xl shadow-2xl"
                        ref={(el) => {
                          if (el) el.playbackRate = mediaRate;
                        }}
                      />
                    )}
                    <div className="flex items-center gap-2 text-xs text-slate-300">
                      <span>Speed:</span>
                      {[0.75, 1, 1.25, 1.5, 2].map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setMediaRate(r)}
                          className={`px-2.5 py-1 rounded-lg cursor-pointer ${
                            mediaRate === r ? 'bg-[#0B57D0] text-white font-bold' : 'bg-slate-800 hover:bg-slate-700'
                          }`}
                        >
                          {r}x
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {kind === 'CODE' && (
                  <div className="flex-1 flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
                    <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs">
                      <span className="font-mono text-slate-400">
                        {extension.toUpperCase() || 'CODE'} â€¢ {codeText.split('\n').length} lines
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(codeText);
                          showToast('Code copied to clipboard.');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold cursor-pointer"
                      >
                        Copy Code
                      </button>
                    </div>
                    {mode === 'EDIT' ? (
                      <textarea
                        value={codeText}
                        onChange={(e) => setCodeText(e.target.value)}
                        spellCheck={false}
                        className="flex-1 w-full bg-slate-950 text-emerald-300 font-mono text-xs p-4 outline-none resize-none leading-relaxed"
                      />
                    ) : (
                      <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed">
                        {codeText.split('\n').map((line, i) => (
                          <div key={i} className="flex gap-4 hover:bg-slate-900/70 px-1 rounded">
                            <span className="w-10 text-right select-none text-slate-500 shrink-0">{i + 1}</span>
                            <span className="whitespace-pre-wrap break-all text-slate-200">{line || ' '}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {kind === 'BINARY' && (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4 bg-slate-50">
                    <div className="w-16 h-16 rounded-2xl bg-slate-200 flex items-center justify-center text-slate-600">
                      <FileText className="w-8 h-8" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-slate-900">{title}</h4>
                      <p className="text-xs text-slate-500 mt-1">
                        {mimeType || 'Binary File'} {sizeBytes ? `â€¢ ${formatBytes(sizeBytes)}` : ''}
                      </p>
                    </div>
                    {resolvedUrl && (
                      <a
                        href={resolvedUrl}
                        download={title}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0B57D0] text-white text-xs font-bold"
                      >
                        <Download className="w-4 h-4" />
                        Download File
                      </a>
                    )}
                  </div>
                )}
              </Suspense>
            )}
          </div>

          {/* Right Slide-Over Drawer: Version History */}
          {activeDrawer === 'HISTORY' && target.fileId && (
            <aside className="w-80 border-l border-slate-200 bg-slate-50 flex flex-col shrink-0">
              <div className="p-3.5 bg-white border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <History className="w-4 h-4 text-[#0B57D0]" />
                  Version History ({versions.length})
                </span>
                <button
                  type="button"
                  onClick={() => setActiveDrawer('NONE')}
                  className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                {versions.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-8">
                    No prior snapshots yet. Every Save automatically snapshots the previous version here.
                  </p>
                ) : (
                  versions.map((v) => (
                    <div key={v.id} className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">Version {v.versionNumber}</span>
                        <span className="text-[10px] text-slate-500">{formatBytes(v.sizeBytes)}</span>
                      </div>
                      <p className="text-[11px] text-slate-600">{v.note}</p>
                      <p className="text-[10px] text-slate-400">
                        {v.createdAt} â€¢ {v.createdByEmail}
                      </p>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => handleRestoreVersion(v.id)}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Restore This Version
                      </button>
                    </div>
                  ))
                )}
              </div>
            </aside>
          )}

          {/* Right Slide-Over Drawer: Sharing & Permissions */}
          {activeDrawer === 'SHARE' && target.fileId && (
            <aside className="w-80 border-l border-slate-200 bg-slate-50 flex flex-col shrink-0">
              <div className="p-3.5 bg-white border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Share2 className="w-4 h-4 text-[#0B57D0]" />
                  Sharing & Access
                </span>
                <button
                  type="button"
                  onClick={() => setActiveDrawer('NONE')}
                  className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
                {(
                  <>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1.5">
                        Visibility Scope
                      </label>
                      <div className="space-y-1.5">
                        {[
                          { id: 'PRIVATE', label: 'Private (Owner + Granted Users)', icon: Lock },
                          { id: 'WORKSPACE', label: 'Workspace (All Signed-In Members)', icon: Users },
                          { id: 'PUBLIC', label: 'Public Link Access', icon: Globe },
                        ].map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setVisibility(opt.id as any)}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-left text-xs font-semibold cursor-pointer ${
                              visibility === opt.id
                                ? 'bg-blue-50 border-[#0B57D0] text-[#0B57D0]'
                                : 'bg-white border-slate-200 text-slate-700'
                            }`}
                          >
                            <opt.icon className="w-3.5 h-3.5 shrink-0" />
                            <span>{opt.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1.5">
                        Member Grants
                      </label>
                      <div className="space-y-1.5 max-h-60 overflow-y-auto">
                        {shareUsers.map((u) => {
                          const existing = shareGrants.find((g) => g.targetUserId === u.id);
                          return (
                            <div
                              key={u.id}
                              className="bg-white border border-slate-200 rounded-xl p-2 flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-800 truncate">{u.name}</p>
                                <p className="text-[10px] text-slate-400 truncate">{u.email}</p>
                              </div>
                              <select
                                value={existing ? existing.accessLevel : 'NONE'}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setShareGrants((prev) => {
                                    const filtered = prev.filter((g) => g.targetUserId !== u.id);
                                    if (val === 'VIEW' || val === 'EDIT') {
                                      return [...filtered, { targetUserId: u.id, accessLevel: val }];
                                    }
                                    return filtered;
                                  });
                                }}
                                className="text-[11px] font-semibold border border-slate-200 rounded-lg px-2 py-1 bg-white"
                              >
                                <option value="NONE">Default</option>
                                <option value="VIEW">Can View</option>
                                <option value="EDIT">Can Edit</option>
                              </select>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={saving}
                      onClick={handleSaveShares}
                      className="w-full py-2 rounded-xl bg-[#0B57D0] hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
                    >
                      Apply Permissions
                    </button>
                  </>
                )}
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* Embedded Image Picker for Rich Docs / Slides */}
      <FileManagerPickerModal
        isOpen={showImagePicker}
        onClose={() => setShowImagePicker(false)}
        defaultFolderId="folder-images"
        imagesOnly
        title="Insert Image into Document or Slide"
        onSelectFile={(file) => {
          setShowImagePicker(false);
          imageInsertCallbackRef.current?.(file.url);
        }}
      />

      {/* Embedded Smart Image Editor */}
      {imageEditorTarget && (
        <Suspense fallback={null}>
          <ImageEditorModal
            isOpen={!!imageEditorTarget}
            target={imageEditorTarget}
            onClose={() => setImageEditorTarget(null)}
            onSaved={(res) => {
              const finalUrl = res.file?.url || res.dataUrl;
              imageEditCallbackRef.current?.(finalUrl);
              setImageEditorTarget(null);
              showToast('Image updated!');
            }}
          />
        </Suspense>
      )}
    </div>
  );
};


