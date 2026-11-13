import React, { useState } from 'react';
import { X, Layers, Check, Loader2 } from 'lucide-react';
import { batchProcessImages, WorkspaceFileItem } from '../services/workspaceApi';

interface BatchImageModalProps {
  isOpen: boolean;
  selectedImages: WorkspaceFileItem[];
  onClose: () => void;
  onDone: (files: WorkspaceFileItem[], msg: string) => void;
}

export const BatchImageModal: React.FC<BatchImageModalProps> = ({
  isOpen,
  selectedImages,
  onClose,
  onDone,
}) => {
  const [width, setWidth] = useState<number>(1080);
  const [height, setHeight] = useState<number>(1080);
  const [useUniformBox, setUseUniformBox] = useState(true);
  const [fit, setFit] = useState<'cover' | 'contain' | 'inside'>('inside');
  const [format, setFormat] = useState<'webp' | 'jpeg' | 'png'>('webp');
  const [quality, setQuality] = useState<number>(0.8);
  const [watermarkText, setWatermarkText] = useState<string>('');
  const [overwrite, setOverwrite] = useState<boolean>(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRunBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);
    setError(null);
    try {
      const res = await batchProcessImages({
        fileIds: selectedImages.map((f) => f.id),
        width: width > 0 ? width : undefined,
        height: useUniformBox && height > 0 ? height : undefined,
        fit,
        format,
        quality,
        watermarkText: watermarkText.trim() || undefined,
        stripMetadata: true,
        overwrite,
      });
      onDone(
        res.files,
        `Processed ${res.processedCount} image(s) uniformly (${width}px${useUniformBox ? ` × ${height}px` : ''}, ${format.toUpperCase()}).`
      );
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Batch image processing failed.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[75] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold">
              Batch Resize &amp; Optimize ({selectedImages.length} Images)
            </h3>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleRunBatch} className="p-5 space-y-4">
          {error && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
              {error}
            </div>
          )}

          <div className="flex flex-wrap gap-1.5">
            {[
              { label: 'Square 1080×1080', w: 1080, h: 1080, fit: 'cover' as const },
              { label: 'Banner 1600×900', w: 1600, h: 900, fit: 'cover' as const },
              { label: 'HD Max 1440px', w: 1440, h: 1440, fit: 'inside' as const },
              { label: 'Thumb 512×512', w: 512, h: 512, fit: 'cover' as const },
            ].map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  setWidth(p.w);
                  setHeight(p.h);
                  setUseUniformBox(true);
                  setFit(p.fit);
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-[#0B57D0] text-[11px] font-bold text-slate-700 cursor-pointer"
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Target Width (px)</label>
              <input
                type="number"
                min={32}
                max={4096}
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Target Height (px)
              </label>
              <input
                type="number"
                min={32}
                max={4096}
                disabled={!useUniformBox}
                value={height}
                onChange={(e) => setHeight(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono disabled:opacity-40"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Fit Mode</label>
              <select
                value={fit}
                onChange={(e) => setFit(e.target.value as any)}
                className="w-full px-2.5 py-2 rounded-xl border border-slate-200 text-xs bg-white"
              >
                <option value="inside">Keep Ratio</option>
                <option value="cover">Crop Exact</option>
                <option value="contain">Pad / Fit</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Format</label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as any)}
                className="w-full px-2.5 py-2 rounded-xl border border-slate-200 text-xs bg-white"
              >
                <option value="webp">WebP (Smallest)</option>
                <option value="jpeg">JPEG</option>
                <option value="png">PNG</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Quality ({Math.round(quality * 100)}%)
              </label>
              <input
                type="range"
                min={0.3}
                max={0.95}
                step={0.05}
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="w-full mt-2"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Optional Watermark Text (applied to all)
            </label>
            <input
              type="text"
              value={watermarkText}
              onChange={(e) => setWatermarkText(e.target.value)}
              placeholder="Leave empty for no watermark..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
            />
          </div>

          <div className="flex items-center justify-between text-xs text-slate-700">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />
              <span>Overwrite originals (keeps Version History backup)</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100">
              Cancel
            </button>
            <button
              type="submit"
              disabled={processing}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
            >
              {processing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              {processing ? 'Processing...' : `Process ${selectedImages.length} Images`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
