import React, { useEffect, useRef, useState } from 'react';
import { X, Crop, RotateCw, RotateCcw, FlipHorizontal, FlipVertical, Sliders, Type, PenTool, EyeOff, Save, Copy, Undo2, Redo2, Stamp, Download, Check } from 'lucide-react';
import { saveEngineFileEdit } from '../../services/engineCache';
import { formatBytes, WorkspaceFileItem } from '../../services/workspaceApi';

export interface ImageEditorTarget {
  title: string;
  imageUrl: string;
  fileId?: string;
  defaultAspect?: 'free' | '1:1' | '16:9' | '4:3';
}

export interface ImageEditorSaveResult {
  dataUrl: string;
  mimeType: string;
  width: number;
  height: number;
  file?: WorkspaceFileItem;
}

interface ImageEditorModalProps {
  isOpen: boolean;
  target: ImageEditorTarget | null;
  onClose: () => void;
  onSaved?: (result: ImageEditorSaveResult) => void;
}

type ToolMode = 'VIEW' | 'CROP' | 'BRUSH' | 'BLUR_SENSITIVE' | 'TEXT';

export const ImageEditorModal: React.FC<ImageEditorModalProps> = ({
  isOpen,
  target,
  onClose,
  onSaved,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tool, setTool] = useState<ToolMode>('VIEW');
  const [activePanel, setActivePanel] = useState<'TRANSFORM' | 'ADJUST' | 'EXPORT'>('TRANSFORM');

  // Working pixel buffer stored as offscreen canvas
  const workingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);

  const [imgWidth, setImgWidth] = useState(800);
  const [imgHeight, setImgHeight] = useState(600);
  const [resizeW, setResizeW] = useState(800);
  const [resizeH, setResizeH] = useState(600);
  const [lockAspect, setLockAspect] = useState(true);

  // Filters
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturate, setSaturate] = useState(100);
  const [grayscale, setGrayscale] = useState(0);
  const [sepia, setSepia] = useState(0);
  const [blurPx, setBlurPx] = useState(0);

  // Crop box in percentage 0..100
  const [cropRect, setCropRect] = useState<{ x: number; y: number; w: number; h: number }>({
    x: 10,
    y: 10,
    w: 80,
    h: 80,
  });
  const [cropAspect, setCropAspect] = useState<'free' | '1:1' | '16:9' | '4:3' | '3:2'>('free');

  // Drawing / Text / Watermark
  const [brushColor, setBrushColor] = useState('#DC2626');
  const [brushSize, setBrushSize] = useState(6);
  const [overlayText, setOverlayText] = useState('Confidential');
  const [watermarkText, setWatermarkText] = useState('');

  // Export settings
  const [exportFormat, setExportFormat] = useState<'image/jpeg' | 'image/png' | 'image/webp'>('image/jpeg');
  const [exportQuality, setExportQuality] = useState(0.86);
  const [estimatedBytes, setEstimatedBytes] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const isDrawingRef = useRef(false);
  const cropDragRef = useRef<{ startX: number; startY: number } | null>(null);

  const renderPreviewCanvas = () => {
    const src = workingCanvasRef.current;
    const dest = canvasRef.current;
    if (!src || !dest) return;
    dest.width = src.width;
    dest.height = src.height;
    const ctx = dest.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, dest.width, dest.height);
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%) grayscale(${grayscale}%) sepia(${sepia}%) blur(${blurPx}px)`;
    ctx.drawImage(src, 0, 0);
    ctx.filter = 'none';

    const previewUrl = dest.toDataURL(exportFormat, exportQuality);
    const b64 = previewUrl.split(',')[1] || '';
    setEstimatedBytes(Math.round((b64.length * 3) / 4));
  };

  useEffect(() => {
    if (!isOpen || !target) return;
    setLoading(true);
    setUndoStack([]);
    setRedoStack([]);
    setBrightness(100);
    setContrast(100);
    setSaturate(100);
    setGrayscale(0);
    setSepia(0);
    setBlurPx(0);
    setTool(target.defaultAspect ? 'CROP' : 'VIEW');
    setCropAspect(target.defaultAspect || 'free');

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth || img.width;
      c.height = img.naturalHeight || img.height;
      const ctx = c.getContext('2d');
      ctx?.drawImage(img, 0, 0);
      workingCanvasRef.current = c;
      setImgWidth(c.width);
      setImgHeight(c.height);
      setResizeW(c.width);
      setResizeH(c.height);
      if (target.imageUrl.toLowerCase().includes('.png') || target.imageUrl.startsWith('data:image/png')) {
        setExportFormat('image/png');
      } else if (target.imageUrl.toLowerCase().includes('.webp')) {
        setExportFormat('image/webp');
      } else {
        setExportFormat('image/jpeg');
      }
      setLoading(false);
      setTimeout(renderPreviewCanvas, 20);
    };
    img.onerror = () => {
      setLoading(false);
      setToast('Unable to decode image for editing.');
    };
    img.src = target.imageUrl;
  }, [isOpen, target]);

  useEffect(() => {
    if (!loading && isOpen) {
      renderPreviewCanvas();
    }
  }, [brightness, contrast, saturate, grayscale, sepia, blurPx, exportFormat, exportQuality, loading, isOpen]);

  if (!isOpen || !target) return null;

  const pushSnapshot = () => {
    const src = workingCanvasRef.current;
    if (!src) return;
    setUndoStack((prev) => [...prev.slice(-9), src.toDataURL('image/png')]);
    setRedoStack([]);
  };

  const loadSnapshotUrl = (url: string) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      c.getContext('2d')?.drawImage(img, 0, 0);
      workingCanvasRef.current = c;
      setImgWidth(c.width);
      setImgHeight(c.height);
      setResizeW(c.width);
      setResizeH(c.height);
      renderPreviewCanvas();
    };
    img.src = url;
  };

  const handleUndo = () => {
    if (undoStack.length === 0 || !workingCanvasRef.current) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack((r) => [...r, workingCanvasRef.current!.toDataURL('image/png')]);
    setUndoStack((u) => u.slice(0, -1));
    loadSnapshotUrl(prev);
  };

  const handleRedo = () => {
    if (redoStack.length === 0 || !workingCanvasRef.current) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((u) => [...u, workingCanvasRef.current!.toDataURL('image/png')]);
    setRedoStack((r) => r.slice(0, -1));
    loadSnapshotUrl(next);
  };

  const rotateWorking = (deg: 90 | -90) => {
    const src = workingCanvasRef.current;
    if (!src) return;
    pushSnapshot();
    const out = document.createElement('canvas');
    out.width = src.height;
    out.height = src.width;
    const ctx = out.getContext('2d');
    if (!ctx) return;
    ctx.translate(out.width / 2, out.height / 2);
    ctx.rotate((deg * Math.PI) / 180);
    ctx.drawImage(src, -src.width / 2, -src.height / 2);
    workingCanvasRef.current = out;
    setImgWidth(out.width);
    setImgHeight(out.height);
    setResizeW(out.width);
    setResizeH(out.height);
    renderPreviewCanvas();
  };

  const flipWorking = (axis: 'H' | 'V') => {
    const src = workingCanvasRef.current;
    if (!src) return;
    pushSnapshot();
    const out = document.createElement('canvas');
    out.width = src.width;
    out.height = src.height;
    const ctx = out.getContext('2d');
    if (!ctx) return;
    ctx.translate(axis === 'H' ? out.width : 0, axis === 'V' ? out.height : 0);
    ctx.scale(axis === 'H' ? -1 : 1, axis === 'V' ? -1 : 1);
    ctx.drawImage(src, 0, 0);
    workingCanvasRef.current = out;
    renderPreviewCanvas();
  };

  const applyResizeDimensions = (targetW: number, targetH: number) => {
    const src = workingCanvasRef.current;
    if (!src || targetW < 16 || targetH < 16) return;
    pushSnapshot();
    const out = document.createElement('canvas');
    out.width = Math.round(targetW);
    out.height = Math.round(targetH);
    const ctx = out.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, 0, 0, out.width, out.height);
    workingCanvasRef.current = out;
    setImgWidth(out.width);
    setImgHeight(out.height);
    setResizeW(out.width);
    setResizeH(out.height);
    renderPreviewCanvas();
  };

  const applyCropSelection = () => {
    const src = workingCanvasRef.current;
    if (!src) return;
    pushSnapshot();
    const sx = Math.round((cropRect.x / 100) * src.width);
    const sy = Math.round((cropRect.y / 100) * src.height);
    const sw = Math.max(16, Math.round((cropRect.w / 100) * src.width));
    const sh = Math.max(16, Math.round((cropRect.h / 100) * src.height));
    const out = document.createElement('canvas');
    out.width = sw;
    out.height = sh;
    const ctx = out.getContext('2d');
    ctx?.drawImage(src, sx, sy, sw, sh, 0, 0, sw, sh);
    workingCanvasRef.current = out;
    setImgWidth(sw);
    setImgHeight(sh);
    setResizeW(sw);
    setResizeH(sh);
    setTool('VIEW');
    renderPreviewCanvas();
  };

  const stampWatermarkOnCanvas = () => {
    const src = workingCanvasRef.current;
    if (!src || !watermarkText.trim()) return;
    pushSnapshot();
    const ctx = src.getContext('2d');
    if (!ctx) return;
    const fontSize = Math.max(16, Math.round(Math.min(src.width, src.height) * 0.042));
    ctx.font = `bold ${fontSize}px sans-serif`;
    const metrics = ctx.measureText(watermarkText.trim());
    const padX = 14;
    const padY = 8;
    const bw = metrics.width + padX * 2;
    const bh = fontSize + padY * 2;
    const x = src.width - bw - 18;
    const y = src.height - bh - 18;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.58)';
    ctx.fillRect(x, y, bw, bh);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
    ctx.textBaseline = 'middle';
    ctx.fillText(watermarkText.trim(), x + padX, y + bh / 2);
    renderPreviewCanvas();
    setToast('Watermark stamped & preset saved!');
    setTimeout(() => setToast(null), 2500);
  };

  const optimizeToTargetKb = (targetKb: number) => {
    const dest = canvasRef.current;
    if (!dest) return;
    const fmt = exportFormat === 'image/png' ? 'image/webp' : exportFormat;
    if (exportFormat === 'image/png') setExportFormat('image/webp');
    let lo = 0.25;
    let hi = 0.95;
    let bestQ = 0.65;
    for (let iter = 0; iter < 6; iter++) {
      const mid = (lo + hi) / 2;
      const url = dest.toDataURL(fmt, mid);
      const bytes = Math.round(((url.split(',')[1] || '').length * 3) / 4);
      if (bytes <= targetKb * 1024) {
        bestQ = mid;
        lo = mid;
      } else {
        hi = mid;
      }
    }
    setExportQuality(Math.round(bestQ * 100) / 100);
    setToast(`Adjusted quality to target ~${targetKb} KB`);
    setTimeout(() => setToast(null), 2500);
  };

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * c.width,
      y: ((e.clientY - rect.top) / rect.height) * c.height,
      xPct: ((e.clientX - rect.left) / rect.width) * 100,
      yPct: ((e.clientY - rect.top) / rect.height) * 100,
    };
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const src = workingCanvasRef.current;
    if (!src) return;
    const pt = getCanvasCoords(e);

    if (tool === 'CROP') {
      cropDragRef.current = { startX: pt.xPct, startY: pt.yPct };
      setCropRect({ x: pt.xPct, y: pt.yPct, w: 5, h: 5 });
      return;
    }

    if (tool === 'TEXT') {
      pushSnapshot();
      const ctx = src.getContext('2d');
      if (ctx) {
        const fs = Math.max(18, Math.round(src.height * 0.045));
        ctx.font = `bold ${fs}px sans-serif`;
        ctx.fillStyle = brushColor;
        ctx.fillText(overlayText || 'Text', pt.x, pt.y);
        renderPreviewCanvas();
      }
      return;
    }

    if (tool === 'BRUSH' || tool === 'BLUR_SENSITIVE') {
      pushSnapshot();
      isDrawingRef.current = true;
      drawAtPoint(pt.x, pt.y);
    }
  };

  const drawAtPoint = (cx: number, cy: number) => {
    const src = workingCanvasRef.current;
    if (!src) return;
    const ctx = src.getContext('2d');
    if (!ctx) return;

    if (tool === 'BRUSH') {
      ctx.fillStyle = brushColor;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(2, brushSize * (src.width / 600)), 0, Math.PI * 2);
      ctx.fill();
    } else if (tool === 'BLUR_SENSITIVE') {
      // Pixelate sensitive area cleanly
      const radius = Math.max(12, brushSize * 3 * (src.width / 600));
      const x0 = Math.max(0, Math.floor(cx - radius));
      const y0 = Math.max(0, Math.floor(cy - radius));
      const size = Math.floor(radius * 2);
      const block = Math.max(8, Math.round(src.width / 55));
      for (let py = y0; py < Math.min(src.height, y0 + size); py += block) {
        for (let px = x0; px < Math.min(src.width, x0 + size); px += block) {
          const d = ctx.getImageData(px, py, 1, 1).data;
          ctx.fillStyle = `rgb(${d[0]},${d[1]},${d[2]})`;
          ctx.fillRect(px, py, block, block);
        }
      }
    }
    renderPreviewCanvas();
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pt = getCanvasCoords(e);
    if (tool === 'CROP' && cropDragRef.current) {
      const sx = cropDragRef.current.startX;
      const sy = cropDragRef.current.startY;
      let x = Math.min(sx, pt.xPct);
      let y = Math.min(sy, pt.yPct);
      let w = Math.max(5, Math.abs(pt.xPct - sx));
      let h = Math.max(5, Math.abs(pt.yPct - sy));
      if (cropAspect !== 'free' && workingCanvasRef.current) {
        const ratio =
          cropAspect === '1:1'
            ? 1
            : cropAspect === '16:9'
            ? 16 / 9
            : cropAspect === '4:3'
            ? 4 / 3
            : 3 / 2;
        const imgRatio = workingCanvasRef.current.width / workingCanvasRef.current.height;
        h = (w * imgRatio) / ratio;
      }
      setCropRect({ x, y, w: Math.min(100 - x, w), h: Math.min(100 - y, h) });
      return;
    }
    if (isDrawingRef.current && (tool === 'BRUSH' || tool === 'BLUR_SENSITIVE')) {
      drawAtPoint(pt.x, pt.y);
    }
  };

  const handleCanvasMouseUp = () => {
    isDrawingRef.current = false;
    cropDragRef.current = null;
  };

  const handleSave = async (saveAsCopy: boolean) => {
    const dest = canvasRef.current;
    if (!dest) return;
    setSaving(true);
    try {
      const dataUrl = dest.toDataURL(exportFormat, exportQuality);
      let savedFile: WorkspaceFileItem | undefined;
      if (target.fileId) {
        const res = await saveEngineFileEdit(target.fileId, {
          mode: 'IMAGE',
          imageDataUrl: dataUrl,
          imageFormat: exportFormat,
          saveAsCopy,
          note: saveAsCopy ? 'Saved edited image copy' : 'Edited via Image Studio',
        });
        savedFile = res.file;
      }
      onSaved?.({
        dataUrl,
        mimeType: exportFormat,
        width: dest.width,
        height: dest.height,
        file: savedFile,
      });
      onClose();
    } catch (err: any) {
      setToast(err?.message || 'Failed to save image.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[75] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="w-full max-w-6xl h-[92vh] bg-white rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="px-4 py-3 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="px-2 py-0.5 rounded bg-emerald-600 text-[10px] font-extrabold uppercase tracking-wider">
              Image Studio
            </span>
            <h3 className="text-sm font-bold truncate">{target.title}</h3>
            <span className="text-[11px] font-mono text-slate-400">
              {imgWidth} Ã— {imgHeight}px Â· ~{formatBytes(estimatedBytes)}
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button type="button" disabled={undoStack.length === 0} onClick={handleUndo} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 cursor-pointer" title="Undo">
              <Undo2 className="w-4 h-4" />
            </button>
            <button type="button" disabled={redoStack.length === 0} onClick={handleRedo} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 cursor-pointer" title="Redo">
              <Redo2 className="w-4 h-4" />
            </button>

            <a
              href={canvasRef.current?.toDataURL(exportFormat, exportQuality) || target.imageUrl}
              download={target.title}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold"
            >
              <Download className="w-3.5 h-3.5" /> Download
            </a>

            {target.fileId && (
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSave(true)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5 text-sky-400" /> Save as Copy
              </button>
            )}

            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave(false)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
            >
              {<Save className="w-3.5 h-3.5" />}
              {target.fileId ? 'Save & Apply' : 'Apply Edit'}
            </button>

            <button type="button" onClick={onClose} className="p-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {toast && (
          <div className="px-4 py-2 bg-emerald-600 text-white text-xs font-semibold">{toast}</div>
        )}

        {/* Body */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Left Tools Strip */}
          <div className="lg:w-72 bg-slate-50 border-b lg:border-b-0 lg:border-r border-slate-200 p-4 space-y-4 overflow-y-auto shrink-0">
            {/* Tool Mode Selector */}
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Active Tool
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: 'VIEW', label: 'Pan / View', icon: Sliders },
                  { id: 'CROP', label: 'Crop Box', icon: Crop },
                  { id: 'BLUR_SENSITIVE', label: 'Blur Secret', icon: EyeOff },
                  { id: 'BRUSH', label: 'Draw Brush', icon: PenTool },
                  { id: 'TEXT', label: 'Add Text', icon: Type },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setTool(item.id as ToolMode)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer ${
                        tool === item.id
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {tool === 'CROP' && (
              <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-2.5">
                <div className="text-xs font-bold text-slate-800">Crop Aspect Preset</div>
                <div className="flex flex-wrap gap-1">
                  {(['free', '1:1', '16:9', '4:3', '3:2'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setCropAspect(r)}
                      className={`px-2 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                        cropAspect === r ? 'bg-[#0B57D0] text-white' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {r === 'free' ? 'Free' : r}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={applyCropSelection}
                  className="w-full py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" /> Apply Crop
                </button>
              </div>
            )}

            {(tool === 'BRUSH' || tool === 'BLUR_SENSITIVE' || tool === 'TEXT') && (
              <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-2">
                {tool === 'TEXT' ? (
                  <input
                    type="text"
                    value={overlayText}
                    onChange={(e) => setOverlayText(e.target.value)}
                    placeholder="Text to stamp (click image)"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs"
                  />
                ) : (
                  <label className="block text-[11px] font-semibold text-slate-600">
                    Brush Size ({brushSize}px)
                    <input
                      type="range"
                      min={2}
                      max={28}
                      value={brushSize}
                      onChange={(e) => setBrushSize(Number(e.target.value))}
                      className="w-full mt-1"
                    />
                  </label>
                )}
                {tool !== 'BLUR_SENSITIVE' && (
                  <label className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
                    <span>Color</span>
                    <input type="color" value={brushColor} onChange={(e) => setBrushColor(e.target.value)} className="w-7 h-7 rounded border cursor-pointer" />
                  </label>
                )}
              </div>
            )}

            {/* Sub-Tabs */}
            <div className="flex bg-slate-200/70 p-0.5 rounded-xl text-xs font-bold">
              {(['TRANSFORM', 'ADJUST', 'EXPORT'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setActivePanel(p)}
                  className={`flex-1 py-1.5 rounded-lg cursor-pointer ${
                    activePanel === p ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                  }`}
                >
                  {p === 'TRANSFORM' ? 'Size' : p === 'ADJUST' ? 'Color' : 'Optimize'}
                </button>
              ))}
            </div>

            {activePanel === 'TRANSFORM' && (
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-1.5">
                  <button type="button" onClick={() => rotateWorking(-90)} className="py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 flex justify-center cursor-pointer" title="Rotate Left"><RotateCcw className="w-4 h-4" /></button>
                  <button type="button" onClick={() => rotateWorking(90)} className="py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 flex justify-center cursor-pointer" title="Rotate Right"><RotateCw className="w-4 h-4" /></button>
                  <button type="button" onClick={() => flipWorking('H')} className="py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 flex justify-center cursor-pointer" title="Flip Horizontal"><FlipHorizontal className="w-4 h-4" /></button>
                  <button type="button" onClick={() => flipWorking('V')} className="py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 flex justify-center cursor-pointer" title="Flip Vertical"><FlipVertical className="w-4 h-4" /></button>
                </div>

                <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">Resize Pixels</span>
                    <label className="flex items-center gap-1 text-[11px] text-slate-600 cursor-pointer">
                      <input type="checkbox" checked={lockAspect} onChange={(e) => setLockAspect(e.target.checked)} />
                      Lock ratio
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      value={resizeW}
                      onChange={(e) => {
                        const w = Math.max(16, Number(e.target.value));
                        setResizeW(w);
                        if (lockAspect && imgWidth > 0) setResizeH(Math.round((w * imgHeight) / imgWidth));
                      }}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-mono"
                    />
                    <input
                      type="number"
                      value={resizeH}
                      onChange={(e) => {
                        const h = Math.max(16, Number(e.target.value));
                        setResizeH(h);
                        if (lockAspect && imgHeight > 0) setResizeW(Math.round((h * imgWidth) / imgHeight));
                      }}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-mono"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {[1920, 1440, 1080, 800, 512].map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => {
                          const h = lockAspect && imgWidth > 0 ? Math.round((w * imgHeight) / imgWidth) : resizeH;
                          applyResizeDimensions(w, h);
                        }}
                        className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-[10px] font-bold text-slate-700 cursor-pointer"
                      >
                        {w}px
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => applyResizeDimensions(resizeW, resizeH)}
                    className="w-full py-1.5 rounded-lg bg-[#0B57D0] text-white text-xs font-bold cursor-pointer"
                  >
                    Apply Resize
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-2">
                  <div className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <Stamp className="w-3.5 h-3.5 text-amber-600" /> Watermark Preset
                  </div>
                  <input
                    type="text"
                    value={watermarkText}
                    onChange={(e) => setWatermarkText(e.target.value)}
                    placeholder="e.g. Workspace Pro Â© 2026"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs"
                  />
                  <button
                    type="button"
                    onClick={stampWatermarkOnCanvas}
                    className="w-full py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold cursor-pointer"
                  >
                    Stamp Watermark &amp; Save Preset
                  </button>
                </div>
              </div>
            )}

            {activePanel === 'ADJUST' && (
              <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-2.5">
                {[
                  { label: 'Brightness', val: brightness, set: setBrightness, min: 40, max: 180 },
                  { label: 'Contrast', val: contrast, set: setContrast, min: 40, max: 180 },
                  { label: 'Saturation', val: saturate, set: setSaturate, min: 0, max: 200 },
                  { label: 'Grayscale', val: grayscale, set: setGrayscale, min: 0, max: 100 },
                  { label: 'Sepia', val: sepia, set: setSepia, min: 0, max: 100 },
                  { label: 'Soft Blur', val: blurPx, set: setBlurPx, min: 0, max: 12 },
                ].map((sl) => (
                  <label key={sl.label} className="block text-[11px] font-semibold text-slate-700">
                    <div className="flex justify-between">
                      <span>{sl.label}</span>
                      <span>{sl.val}</span>
                    </div>
                    <input
                      type="range"
                      min={sl.min}
                      max={sl.max}
                      value={sl.val}
                      onChange={(e) => sl.set(Number(e.target.value))}
                      className="w-full mt-1"
                    />
                  </label>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setBrightness(100);
                    setContrast(100);
                    setSaturate(100);
                    setGrayscale(0);
                    setSepia(0);
                    setBlurPx(0);
                  }}
                  className="w-full py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 cursor-pointer"
                >
                  Reset Filters
                </button>
              </div>
            )}

            {activePanel === 'EXPORT' && (
              <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Output Format (EXIF Stripped)</label>
                  <select
                    value={exportFormat}
                    onChange={(e) => setExportFormat(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold bg-white"
                  >
                    <option value="image/jpeg">JPEG (.jpg â€” Best Compression)</option>
                    <option value="image/webp">WebP (.webp â€” Ultra Small)</option>
                    <option value="image/png">PNG (.png â€” Lossless/Transparent)</option>
                  </select>
                </div>
                <label className="block text-[11px] font-semibold text-slate-700">
                  Quality ({Math.round(exportQuality * 100)}%)
                  <input
                    type="range"
                    min={0.25}
                    max={1}
                    step={0.01}
                    value={exportQuality}
                    onChange={(e) => setExportQuality(Number(e.target.value))}
                    className="w-full mt-1"
                  />
                </label>
                <div>
                  <div className="text-[11px] font-bold text-slate-600 mb-1">Target File Size Presets</div>
                  <div className="grid grid-cols-3 gap-1">
                    {[100, 250, 500].map((kb) => (
                      <button
                        key={kb}
                        type="button"
                        onClick={() => optimizeToTargetKb(kb)}
                        className="py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold cursor-pointer"
                      >
                        &lt; {kb} KB
                      </button>
                    ))}
                  </div>
                </div>
                <div className="text-xs font-mono text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200 text-center">
                  Estimated: <strong>{formatBytes(estimatedBytes)}</strong>
                </div>
              </div>
            )}
          </div>

          {/* Center Canvas Stage */}
          <div className="flex-1 bg-slate-950/90 flex items-center justify-center p-4 sm:p-8 overflow-auto">
            {(
              <div className="relative inline-block shadow-2xl">
                <canvas
                  ref={canvasRef}
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  onMouseLeave={handleCanvasMouseUp}
                  className={`max-w-full max-h-[76vh] object-contain rounded-lg bg-[repeating-conic-gradient(#1e293b_0%_25%,#0f172a_0%_50%)] bg-[length:20px_20px] ${
                    tool === 'CROP' || tool === 'BRUSH' || tool === 'BLUR_SENSITIVE' || tool === 'TEXT'
                      ? 'cursor-crosshair'
                      : ''
                  }`}
                />
                {tool === 'CROP' && (
                  <div
                    style={{
                      left: `${cropRect.x}%`,
                      top: `${cropRect.y}%`,
                      width: `${cropRect.w}%`,
                      height: `${cropRect.h}%`,
                    }}
                    className="absolute border-2 border-amber-400 bg-amber-400/10 pointer-events-none shadow-[0_0_0_9999px_rgba(2,6,23,0.55)]"
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

