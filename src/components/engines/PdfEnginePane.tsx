import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  Trash2,
  ArrowUp,
  ArrowDown,
  Search,
  Scissors,
  Save,
  Type,
  Image as ImageIcon,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Eye,
} from 'lucide-react';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface PdfAnnotationDraft {
  id: string;
  pageIndex: number; // 0-based original page index
  text: string;
  xPct: number;
  yPct: number;
  fontSize: number;
  colorHex: string;
}

interface PdfEnginePaneProps {
  url: string;
  title: string;
  onSaveTransform: (payload: {
    pageOrder: number[];
    rotations: Record<number, number>;
    annotations: PdfAnnotationDraft[];
    saveAsCopy?: boolean;
  }) => Promise<void>;
  onSplitExtractPages: (pageNumbers1Based: number[]) => Promise<void>;
  onExportPageAsImage?: (dataUrl: string, pageNumber: number) => void;
}

export const PdfEnginePane: React.FC<PdfEnginePaneProps> = ({
  url,
  title,
  onSaveTransform,
  onSplitExtractPages,
  onExportPageAsImage,
}) => {
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(115);
  const [activePos, setActivePos] = useState(0); // index into pageOrder
  const [pageOrder, setPageOrder] = useState<number[]>([]);
  const [rotations, setRotations] = useState<Record<number, number>>({});
  const [annotations, setAnnotations] = useState<PdfAnnotationDraft[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [placingAnnotation, setPlacingAnnotation] = useState(false);
  const [annotationText, setAnnotationText] = useState('Approved / Verified');
  const [annotationColor, setAnnotationColor] = useState('#0B57D0');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchMatches, setSearchMatches] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [splitRangeInput, setSplitRangeInput] = useState('1');
  const [thumbs, setThumbs] = useState<Record<number, string>>({});

  const mainCanvasRef = useRef<HTMLCanvasElement>(null);

  // Load real PDF binary via PDF.js
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setThumbs({});

    (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = await res.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buf) });
        const doc = await loadingTask.promise;
        if (cancelled) return;
        setPdfDoc(doc);
        const order = Array.from({ length: doc.numPages }, (_, i) => i);
        setPageOrder(order);
        setActivePos(0);
        setRotations({});
        setAnnotations([]);
        setSplitRangeInput(doc.numPages > 1 ? `1-${doc.numPages}` : '1');
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Unable to parse PDF file.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url]);

  // Progressive thumbnail generation
  useEffect(() => {
    if (!pdfDoc) return;
    let cancelled = false;
    (async () => {
      const limit = Math.min(pdfDoc.numPages, 25);
      for (let i = 1; i <= limit; i++) {
        if (cancelled) return;
        try {
          const page = await pdfDoc.getPage(i);
          const vp = page.getViewport({ scale: 0.24 });
          const c = document.createElement('canvas');
          c.width = vp.width;
          c.height = vp.height;
          const ctx = c.getContext('2d');
          if (ctx) {
            await page.render({ canvasContext: ctx, viewport: vp }).promise;
            if (!cancelled) {
              setThumbs((prev) => ({ ...prev, [i - 1]: c.toDataURL('image/jpeg', 0.7) }));
            }
          }
        } catch {
          // ignore thumb err
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pdfDoc]);

  const currentOrigPageIdx = pageOrder[activePos] ?? 0;

  // Render active high-DPI page
  useEffect(() => {
    if (!pdfDoc || !mainCanvasRef.current || pageOrder.length === 0) return;
    let cancelled = false;
    let renderTask: any = null;

    (async () => {
      try {
        const pageNum1Based = currentOrigPageIdx + 1;
        const page = await pdfDoc.getPage(pageNum1Based);
        if (cancelled) return;

        const baseScale = (zoom / 100) * 1.35;
        const extraRot = rotations[currentOrigPageIdx] || 0;
        const viewport = page.getViewport({
          scale: baseScale,
          rotation: (page.rotate + extraRot) % 360,
        });

        const canvas = mainCanvasRef.current;
        if (!canvas) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        renderTask = page.render({ canvasContext: ctx, viewport });
        await renderTask.promise;
      } catch {
        // ignore cancel
      }
    })();

    return () => {
      cancelled = true;
      try {
        renderTask?.cancel?.();
      } catch {
        // ignore
      }
    };
  }, [pdfDoc, currentOrigPageIdx, zoom, rotations, pageOrder.length]);

  // Search inside PDF pages
  useEffect(() => {
    if (!pdfDoc || !searchTerm.trim()) {
      setSearchMatches([]);
      return;
    }
    let cancelled = false;
    const q = searchTerm.trim().toLowerCase();
    (async () => {
      const hits: number[] = [];
      for (let pos = 0; pos < pageOrder.length; pos++) {
        if (cancelled) return;
        const page = await pdfDoc.getPage(pageOrder[pos] + 1);
        const content = await page.getTextContent();
        const text = (content.items || []).map((it: any) => it.str || '').join(' ').toLowerCase();
        if (text.includes(q)) hits.push(pos);
      }
      if (!cancelled) {
        setSearchMatches(hits);
        if (hits.length > 0 && !hits.includes(activePos)) {
          setActivePos(hits[0]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pdfDoc, searchTerm, pageOrder]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!editMode || !placingAnnotation || !mainCanvasRef.current) return;
    const rect = mainCanvasRef.current.getBoundingClientRect();
    const xPct = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const yPct = Math.round(((e.clientY - rect.top) / rect.height) * 100);
    setAnnotations((prev) => [
      ...prev,
      {
        id: `ann-${Date.now()}`,
        pageIndex: currentOrigPageIdx,
        text: annotationText.trim() || 'Note',
        xPct,
        yPct,
        fontSize: 13,
        colorHex: annotationColor,
      },
    ]);
    setPlacingAnnotation(false);
  };

  const handleRotatePage = () => {
    setRotations((prev) => ({
      ...prev,
      [currentOrigPageIdx]: ((prev[currentOrigPageIdx] || 0) + 90) % 360,
    }));
  };

  const handleMovePage = (pos: number, dir: -1 | 1) => {
    const target = pos + dir;
    if (target < 0 || target >= pageOrder.length) return;
    const next = [...pageOrder];
    [next[pos], next[target]] = [next[target], next[pos]];
    setPageOrder(next);
    setActivePos(target);
  };

  const handleDeletePage = (pos: number) => {
    if (pageOrder.length <= 1) return;
    const next = pageOrder.filter((_, i) => i !== pos);
    setPageOrder(next);
    setActivePos((p) => Math.max(0, Math.min(p, next.length - 1)));
  };

  const parseSplitPages = (): number[] => {
    const out = new Set<number>();
    const total = pageOrder.length;
    for (const part of splitRangeInput.split(',')) {
      const trimmed = part.trim();
      if (trimmed.includes('-')) {
        const [a, b] = trimmed.split('-').map((n) => parseInt(n.trim(), 10));
        if (Number.isInteger(a) && Number.isInteger(b)) {
          for (let i = Math.max(1, a); i <= Math.min(total, b); i++) out.add(pageOrder[i - 1] + 1);
        }
      } else {
        const single = parseInt(trimmed, 10);
        if (Number.isInteger(single) && single >= 1 && single <= total) {
          out.add(pageOrder[single - 1] + 1);
        }
      }
    }
    return Array.from(out);
  };

  const handleExportCurrentPagePng = () => {
    if (!mainCanvasRef.current || !onExportPageAsImage) return;
    onExportPageAsImage(mainCanvasRef.current.toDataURL('image/png'), activePos + 1);
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-slate-100">
        <Loader2 className="w-8 h-8 text-rose-600 animate-spin" />
        <p className="text-xs font-semibold text-slate-600">Rendering PDF pages via PDF.js Engine...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-100">
        <div className="max-w-lg w-full bg-white rounded-2xl border border-slate-200 p-6 text-center space-y-3">
          <p className="text-sm font-bold text-rose-700">Direct Canvas Fallback ({error})</p>
          <iframe src={url} title={title} className="w-full h-[60vh] rounded-xl border border-slate-200" />
        </div>
      </div>
    );
  }

  const pageAnnotations = annotations.filter((a) => a.pageIndex === currentOrigPageIdx);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-100">
      {/* PDF Engine Top Toolbar */}
      <div className="px-3 sm:px-4 py-2 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setEditMode((v) => !v)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer ${
              editMode ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {editMode ? <Edit3 className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {editMode ? 'PDF Toolkit Active' : 'Edit / Toolkit'}
          </button>

          <div className="flex items-center gap-1 border border-slate-200 rounded-lg px-2 py-1 bg-slate-50">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search inside PDF..."
              className="text-xs bg-transparent outline-none w-32 sm:w-44"
            />
            {searchTerm && (
              <span className="text-[10px] font-bold text-blue-700">
                {searchMatches.length} pg
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={activePos === 0}
              onClick={() => setActivePos((p) => Math.max(0, p - 1))}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-bold text-slate-700 px-1.5">
              {activePos + 1} / {pageOrder.length}
            </span>
            <button
              type="button"
              disabled={activePos >= pageOrder.length - 1}
              onClick={() => setActivePos((p) => Math.min(pageOrder.length - 1, p + 1))}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button type="button" onClick={() => setZoom((z) => Math.max(60, z - 15))} className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs font-bold text-slate-700 w-11 text-center">{zoom}%</span>
          <button type="button" onClick={() => setZoom((z) => Math.min(200, z + 15))} className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          {onExportPageAsImage && (
            <button
              type="button"
              onClick={handleExportCurrentPagePng}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
              title="Render current page as editable PNG image"
            >
              <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Page → Image</span>
            </button>
          )}
        </div>
      </div>

      {/* Toolkit Sub-bar when Edit Mode Active */}
      {editMode && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              value={annotationText}
              onChange={(e) => setAnnotationText(e.target.value)}
              placeholder="Stamp / note text..."
              className="px-2.5 py-1 text-xs rounded-lg border border-amber-300 bg-white w-44"
            />
            <input
              type="color"
              value={annotationColor}
              onChange={(e) => setAnnotationColor(e.target.value)}
              className="w-6 h-6 rounded border border-amber-300 cursor-pointer"
            />
            <button
              type="button"
              onClick={() => setPlacingAnnotation((v) => !v)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                placingAnnotation ? 'bg-blue-600 text-white' : 'bg-white border border-amber-300 text-amber-900'
              }`}
            >
              <Type className="w-3.5 h-3.5" />
              {placingAnnotation ? 'Click anywhere on PDF page...' : 'Place Text Stamp'}
            </button>
            <button
              type="button"
              onClick={handleRotatePage}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-xs font-semibold text-slate-800 cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5" /> Rotate 90°
            </button>

            <div className="flex items-center gap-1 border-l border-amber-300 pl-2">
              <input
                type="text"
                value={splitRangeInput}
                onChange={(e) => setSplitRangeInput(e.target.value)}
                placeholder="e.g. 1-2"
                className="px-2 py-1 text-xs rounded-lg border border-amber-300 bg-white w-20"
              />
              <button
                type="button"
                onClick={async () => {
                  const nums = parseSplitPages();
                  if (nums.length > 0) await onSplitExtractPages(nums);
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-xs font-semibold text-slate-800 cursor-pointer"
              >
                <Scissors className="w-3.5 h-3.5 text-rose-600" /> Split / Extract
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  await onSaveTransform({ pageOrder, rotations, annotations, saveAsCopy: true });
                } finally {
                  setSaving(false);
                }
              }}
              className="px-3 py-1 rounded-lg border border-emerald-600 text-emerald-700 bg-white text-xs font-bold cursor-pointer"
            >
              Save Copy
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  await onSaveTransform({ pageOrder, rotations, annotations, saveAsCopy: false });
                } finally {
                  setSaving(false);
                }
              }}
              className="flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-600 text-white text-xs font-bold cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Saving...' : 'Save PDF'}
            </button>
          </div>
        </div>
      )}

      {/* Main Split: Page Thumbnails + Canvas Stage */}
      <div className="flex-1 flex overflow-hidden">
        <aside className="hidden sm:flex w-44 bg-white border-r border-slate-200 flex-col p-2.5 gap-2 overflow-y-auto shrink-0">
          {pageOrder.map((origIdx, pos) => (
            <div
              key={`${origIdx}-${pos}`}
              onClick={() => setActivePos(pos)}
              className={`group rounded-xl border p-1.5 cursor-pointer transition-all ${
                pos === activePos
                  ? 'border-rose-600 bg-rose-50/40 ring-2 ring-rose-500/20'
                  : searchMatches.includes(pos)
                  ? 'border-blue-500 bg-blue-50/30'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="aspect-[3/4] bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center">
                {thumbs[origIdx] ? (
                  <img
                    src={thumbs[origIdx]}
                    alt={`Page ${pos + 1}`}
                    className="w-full h-full object-contain"
                    style={{ transform: `rotate(${rotations[origIdx] || 0}deg)` }}
                  />
                ) : (
                  <span className="text-[10px] text-slate-400">Page {pos + 1}</span>
                )}
              </div>
              <div className="flex items-center justify-between mt-1 px-1">
                <span className="text-[10px] font-bold text-slate-600">Pg {pos + 1}</span>
                {editMode && (
                  <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                    <button type="button" onClick={() => handleMovePage(pos, -1)} className="p-0.5 text-slate-400 hover:text-slate-700"><ArrowUp className="w-3 h-3" /></button>
                    <button type="button" onClick={() => handleMovePage(pos, 1)} className="p-0.5 text-slate-400 hover:text-slate-700"><ArrowDown className="w-3 h-3" /></button>
                    {pageOrder.length > 1 && (
                      <button type="button" onClick={() => handleDeletePage(pos)} className="p-0.5 text-slate-400 hover:text-rose-600"><Trash2 className="w-3 h-3" /></button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </aside>

        <div className="flex-1 overflow-auto p-4 sm:p-8 flex justify-center items-start bg-slate-200/70">
          <div className="relative inline-block shadow-xl rounded-lg overflow-hidden bg-white">
            <canvas
              ref={mainCanvasRef}
              onClick={handleCanvasClick}
              className={placingAnnotation ? 'cursor-crosshair block' : 'block'}
            />
            {pageAnnotations.map((ann) => (
              <div
                key={ann.id}
                style={{ left: `${ann.xPct}%`, top: `${ann.yPct}%`, color: ann.colorHex }}
                className="absolute -translate-y-1/2 px-2 py-0.5 rounded bg-white/85 border border-slate-300 shadow-xs text-xs font-bold flex items-center gap-1.5"
              >
                <span>{ann.text}</span>
                {editMode && (
                  <button
                    type="button"
                    onClick={() => setAnnotations((prev) => prev.filter((x) => x.id !== ann.id))}
                    className="text-rose-500 hover:text-rose-700"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
