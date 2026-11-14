import React, { useEffect, useRef, useState } from 'react';
import {
  Plus,
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
  Type,
  Heading1,
  List,
  Square,
  Image as ImageIcon,
  Table,
  BarChart3,
  Play,
  X,
  ChevronLeft,
  ChevronRight,
  Layers,
  Edit3,
  Download,
  Save,
  Undo2,
  Maximize2,
  FileText,
} from 'lucide-react';
import type { EngineSlidePageClient, SlideElementLayerClient } from '../../services/engineCache';

interface SlideCanvasStudioProps {
  title: string;
  themeColor: string;
  pages: EngineSlidePageClient[];
  mode: 'VIEW' | 'EDIT';
  onChangePages: (nextPages: EngineSlidePageClient[]) => void;
  onChangeThemeColor?: (hex: string) => void;
  onInsertImageRequest?: (onChosen: (url: string) => void) => void;
  onEditImageRequest?: (imageUrl: string, onUpdated: (newUrl: string) => void) => void;
  onExportPptx?: () => void;
  onExportPdf?: () => void;
  onSave?: () => Promise<void>;
}

const SLIDE_TEMPLATES: Array<{
  id: string;
  label: string;
  build: (num: number, theme: string) => EngineSlidePageClient;
}> = [
  {
    id: 'cover',
    label: 'Title Cover',
    build: (num, theme) => ({
      id: `sp-${Date.now()}-${num}`,
      slideNumber: num,
      layout: 'TITLE_COVER',
      title: 'Presentation Headline',
      subtitle: 'Executive Overview & Strategic Goals',
      bullets: [],
      speakerNotes: 'Introduce key presentation objectives.',
      bgColor: '#0F172A',
      elements: [
        { id: `el-bar-${Date.now()}`, type: 'shape', shapeKind: 'rect', x: 0, y: 0, w: 100, h: 2.5, bgColor: theme, zIndex: 1 },
        { id: `el-h-${Date.now()}`, type: 'heading', x: 8, y: 30, w: 84, h: 18, text: 'Presentation Headline', fontSize: 36, fontWeight: 'extrabold', textAlign: 'center', color: '#FFFFFF', zIndex: 2 },
        { id: `el-s-${Date.now()}`, type: 'text', x: 12, y: 51, w: 76, h: 12, text: 'Executive Overview & Strategic Goals', fontSize: 18, textAlign: 'center', color: '#CBD5E1', zIndex: 3 },
      ],
    }),
  },
  {
    id: 'content',
    label: 'Title + Bullets',
    build: (num, theme) => ({
      id: `sp-${Date.now()}-${num}`,
      slideNumber: num,
      layout: 'BULLETS_AND_INSIGHTS',
      title: `Slide ${num} Key Insights`,
      subtitle: 'Core deliverables and timeline',
      bullets: ['Key milestone or strategic point 1', 'Supporting metric or evidence 2', 'Next action item 3'],
      speakerNotes: '',
      bgColor: '#FFFFFF',
      elements: [
        { id: `el-bar-${Date.now()}`, type: 'shape', shapeKind: 'rect', x: 0, y: 0, w: 100, h: 2, bgColor: theme, zIndex: 1 },
        { id: `el-h-${Date.now()}`, type: 'heading', x: 7, y: 8, w: 86, h: 14, text: `Slide ${num} Key Insights`, fontSize: 26, fontWeight: 'extrabold', color: '#0F172A', zIndex: 2 },
        { id: `el-s-${Date.now()}`, type: 'text', x: 7, y: 22, w: 86, h: 9, text: 'Core deliverables and timeline', fontSize: 14, color: '#64748B', zIndex: 3 },
        { id: `el-b-${Date.now()}`, type: 'bullets', x: 7, y: 34, w: 86, h: 52, items: ['Key milestone or strategic point 1', 'Supporting metric or evidence 2', 'Next action item 3'], fontSize: 15, color: '#1E293B', bgColor: '#F8FAFC', borderColor: '#E2E8F0', borderRadius: 12, zIndex: 4 },
      ],
    }),
  },
  {
    id: 'metrics',
    label: 'KPI Metrics Grid',
    build: (num, theme) => ({
      id: `sp-${Date.now()}-${num}`,
      slideNumber: num,
      layout: 'METRICS_GRID',
      title: 'Performance Highlights',
      subtitle: '',
      bullets: [],
      speakerNotes: '',
      bgColor: '#FFFFFF',
      elements: [
        { id: `el-bar-${Date.now()}`, type: 'shape', shapeKind: 'rect', x: 0, y: 0, w: 100, h: 2, bgColor: theme, zIndex: 1 },
        { id: `el-h-${Date.now()}`, type: 'heading', x: 7, y: 8, w: 86, h: 14, text: 'Performance Highlights', fontSize: 26, fontWeight: 'extrabold', color: '#0F172A', zIndex: 2 },
        { id: `el-m1-${Date.now()}`, type: 'metric', x: 7, y: 30, w: 27, h: 32, metricValue: '99.9%', metricLabel: 'System Uptime', color: '#0F172A', bgColor: '#EFF6FF', borderColor: '#BFDBFE', borderRadius: 14, zIndex: 3 },
        { id: `el-m2-${Date.now()}`, type: 'metric', x: 37, y: 30, w: 27, h: 32, metricValue: '< 10ms', metricLabel: 'Cache Latency', color: '#0F172A', bgColor: '#ECFDF5', borderColor: '#A7F3D0', borderRadius: 14, zIndex: 4 },
        { id: `el-m3-${Date.now()}`, type: 'metric', x: 67, y: 30, w: 26, h: 32, metricValue: '24+', metricLabel: 'Integrated Apps', color: '#0F172A', bgColor: '#FFFBEB', borderColor: '#FDE68A', borderRadius: 14, zIndex: 5 },
      ],
    }),
  },
  {
    id: 'blank',
    label: 'Blank Canvas',
    build: (num, theme) => ({
      id: `sp-${Date.now()}-${num}`,
      slideNumber: num,
      layout: 'FREEFORM_CANVAS',
      title: `Slide ${num}`,
      subtitle: '',
      bullets: [],
      speakerNotes: '',
      bgColor: '#FFFFFF',
      elements: [
        { id: `el-bar-${Date.now()}`, type: 'shape', shapeKind: 'rect', x: 0, y: 0, w: 100, h: 2, bgColor: theme, zIndex: 1 },
      ],
    }),
  },
];

const THEME_SWATCHES = ['#D97706', '#0B57D0', '#00897B', '#673AB7', '#DC2626', '#1E293B'];

export const SlideCanvasStudio: React.FC<SlideCanvasStudioProps> = ({
  title,
  themeColor,
  pages,
  mode,
  onChangePages,
  onChangeThemeColor,
  onInsertImageRequest,
  onEditImageRequest,
  onExportPptx,
  onExportPdf,
  onSave,
}) => {
  const [activeIdx, setActiveIdx] = useState(0);
  const [selectedElId, setSelectedElId] = useState<string | null>(null);
  const [editingElId, setEditingElId] = useState<string | null>(null);
  const [isPresenting, setIsPresenting] = useState(false);
  const [presentSeconds, setPresentSeconds] = useState(0);
  const [showTemplates, setShowTemplates] = useState(false);
  const [undoStack, setUndoStack] = useState<EngineSlidePageClient[][]>([]);
  const [saving, setSaving] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    kind: 'move' | 'resize';
    elId: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
  } | null>(null);

  const activeSlide = pages[activeIdx] || pages[0];
  const layers = activeSlide?.elements || [];
  const selectedLayer = layers.find((l) => l.id === selectedElId) || null;

  useEffect(() => {
    if (!isPresenting) {
      setPresentSeconds(0);
      return;
    }
    const timer = setInterval(() => setPresentSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [isPresenting]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isPresenting) {
        if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
          e.preventDefault();
          setActiveIdx((i) => Math.min(pages.length - 1, i + 1));
        } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
          e.preventDefault();
          setActiveIdx((i) => Math.max(0, i - 1));
        } else if (e.key === 'Escape') {
          setIsPresenting(false);
        }
      } else if (mode === 'EDIT' && selectedElId && !editingElId && (e.key === 'Delete' || e.key === 'Backspace')) {
        const tag = (document.activeElement?.tagName || '').toLowerCase();
        if (tag !== 'input' && tag !== 'textarea' && tag !== 'select') {
          e.preventDefault();
          removeElement(selectedElId);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isPresenting, mode, selectedElId, editingElId, pages.length]);

  const commitPages = (next: EngineSlidePageClient[], recordUndo = true) => {
    if (recordUndo) {
      setUndoStack((u) => [...u.slice(-14), pages]);
    }
    onChangePages(next);
  };

  const updateSlide = (patch: Partial<EngineSlidePageClient>, recordUndo = true) => {
    commitPages(
      pages.map((p, idx) => (idx === activeIdx ? { ...p, ...patch } : p)),
      recordUndo
    );
  };

  const updateElement = (elId: string, patch: Partial<SlideElementLayerClient>, recordUndo = true) => {
    const nextLayers = layers.map((l) => (l.id === elId ? { ...l, ...patch } : l));
    const headingLayer = nextLayers.find((l) => l.type === 'heading');
    const bulletLayer = nextLayers.find((l) => l.type === 'bullets');
    updateSlide(
      {
        elements: nextLayers,
        ...(headingLayer?.text ? { title: headingLayer.text } : {}),
        ...(bulletLayer?.items ? { bullets: bulletLayer.items } : {}),
      },
      recordUndo
    );
  };

  const addElement = (el: SlideElementLayerClient) => {
    const nextLayers = [...layers, { ...el, zIndex: layers.length + 2 }];
    updateSlide({ elements: nextLayers });
    setSelectedElId(el.id);
  };

  const removeElement = (elId: string) => {
    updateSlide({ elements: layers.filter((l) => l.id !== elId) });
    if (selectedElId === elId) setSelectedElId(null);
  };

  // Drag & resize pointer listeners
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current || !stageRef.current) return;
      const rect = stageRef.current.getBoundingClientRect();
      const dxPct = ((e.clientX - dragRef.current.startX) / rect.width) * 100;
      const dyPct = ((e.clientY - dragRef.current.startY) / rect.height) * 100;
      const d = dragRef.current;

      if (d.kind === 'move') {
        const nx = Math.max(0, Math.min(96, Math.round((d.origX + dxPct) * 10) / 10));
        const ny = Math.max(0, Math.min(96, Math.round((d.origY + dyPct) * 10) / 10));
        updateElement(d.elId, { x: nx, y: ny }, false);
      } else {
        const nw = Math.max(6, Math.min(100 - d.origX, Math.round((d.origW + dxPct) * 10) / 10));
        const nh = Math.max(4, Math.min(100 - d.origY, Math.round((d.origH + dyPct) * 10) / 10));
        updateElement(d.elId, { w: nw, h: nh }, false);
      }
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [activeSlide, activeIdx, pages]);

  const renderSlideStage = (slide: EngineSlidePageClient, interactive: boolean) => {
    const isCover = slide.layout === 'TITLE_COVER';
    const bg = slide.bgColor || (isCover ? '#0F172A' : '#FFFFFF');
    const slideLayers = [...(slide.elements || [])].sort((a, b) => (a.zIndex || 1) - (b.zIndex || 1));

    return (
      <div
        ref={interactive ? stageRef : undefined}
        onClick={() => interactive && (setSelectedElId(null), setEditingElId(null))}
        style={{ backgroundColor: bg }}
        className="relative w-full aspect-[16/9] rounded-2xl shadow-xl border border-slate-200 overflow-hidden select-none"
      >
        {slideLayers.map((el) => {
          const isSel = interactive && mode === 'EDIT' && selectedElId === el.id;
          const isEd = interactive && mode === 'EDIT' && editingElId === el.id;

          return (
            <div
              key={el.id}
              onClick={(e) => {
                if (!interactive || mode !== 'EDIT') return;
                e.stopPropagation();
                setSelectedElId(el.id);
              }}
              onDoubleClick={(e) => {
                if (!interactive || mode !== 'EDIT') return;
                e.stopPropagation();
                if (el.type === 'heading' || el.type === 'text' || el.type === 'bullets' || el.type === 'metric') {
                  setEditingElId(el.id);
                }
              }}
              onMouseDown={(e) => {
                if (!interactive || mode !== 'EDIT' || isEd) return;
                e.stopPropagation();
                setSelectedElId(el.id);
                setUndoStack((u) => [...u.slice(-14), pages]);
                dragRef.current = {
                  kind: 'move',
                  elId: el.id,
                  startX: e.clientX,
                  startY: e.clientY,
                  origX: el.x,
                  origY: el.y,
                  origW: el.w,
                  origH: el.h,
                };
              }}
              style={{
                left: `${el.x}%`,
                top: `${el.y}%`,
                width: `${el.w}%`,
                height: `${el.h}%`,
                zIndex: el.zIndex || 1,
                transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
                opacity: el.opacity ?? 1,
                backgroundColor: el.bgColor || undefined,
                borderColor: el.borderColor || undefined,
                borderWidth: el.borderColor ? '1px' : undefined,
                borderStyle: el.borderColor ? 'solid' : undefined,
                borderRadius: el.shapeKind === 'circle' ? '9999px' : el.borderRadius ? `${el.borderRadius}px` : undefined,
              }}
              className={`absolute ${
                interactive && mode === 'EDIT' ? 'cursor-move' : ''
              } ${isSel ? 'ring-2 ring-amber-500 shadow-sm' : ''}`}
            >
              {el.type === 'shape' ? (
                <div className="w-full h-full flex items-center justify-center p-2 text-xs font-semibold" style={{ color: el.color || '#FFF' }}>
                  {el.text || ''}
                </div>
              ) : el.type === 'image' ? (
                <div className="w-full h-full relative group overflow-hidden" style={{ borderRadius: el.borderRadius ? `${el.borderRadius}px` : '8px' }}>
                  <img src={el.imageUrl} alt="Slide visual" className="w-full h-full object-cover pointer-events-none" />
                  {isSel && onEditImageRequest && el.imageUrl && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditImageRequest(el.imageUrl!, (newUrl) => updateElement(el.id, { imageUrl: newUrl }));
                      }}
                      className="absolute bottom-2 right-2 px-2 py-1 rounded-lg bg-slate-900/85 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" /> Edit Image
                    </button>
                  )}
                </div>
              ) : el.type === 'metric' ? (
                <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center">
                  <div className="text-2xl sm:text-3xl font-extrabold" style={{ color: el.color || '#0F172A' }}>
                    {el.metricValue || '0'}
                  </div>
                  <div className="text-xs font-semibold opacity-75 mt-1" style={{ color: el.color || '#475569' }}>
                    {el.metricLabel || 'Metric'}
                  </div>
                </div>
              ) : el.type === 'table' ? (
                <div className="w-full h-full overflow-auto p-1">
                  <table className="w-full h-full border-collapse text-xs bg-white/95 text-slate-800">
                    <tbody>
                      {(el.tableRows || [['Header A', 'Header B'], ['Value 1', 'Value 2']]).map((r, ri) => (
                        <tr key={ri} className={ri === 0 ? 'bg-slate-100 font-bold' : ''}>
                          {r.map((c, ci) => (
                            <td key={ci} className="border border-slate-300 px-2 py-1">
                              {c}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : el.type === 'bullets' ? (
                isEd ? (
                  <textarea
                    autoFocus
                    value={(el.items || []).join('\n')}
                    onChange={(e) => updateElement(el.id, { items: e.target.value.split('\n') }, false)}
                    onBlur={() => setEditingElId(null)}
                    className="w-full h-full p-3 bg-white/95 text-slate-900 text-xs rounded-lg border border-amber-400 outline-none resize-none"
                  />
                ) : (
                  <div className="w-full h-full p-3 sm:p-4 overflow-hidden space-y-2">
                    {(el.items || []).map((b, bi) => (
                      <div key={bi} className="flex items-start gap-2.5" style={{ color: el.color || '#1E293B', fontSize: `${el.fontSize || 15}px` }}>
                        <span className="w-5 h-5 rounded-full text-[11px] font-bold text-white flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: themeColor }}>
                          {bi + 1}
                        </span>
                        <span className="leading-snug font-medium">{b}</span>
                      </div>
                    ))}
                  </div>
                )
              ) : isEd ? (
                <textarea
                  autoFocus
                  value={el.text || ''}
                  onChange={(e) => updateElement(el.id, { text: e.target.value }, false)}
                  onBlur={() => setEditingElId(null)}
                  style={{ fontSize: `${el.fontSize || 18}px`, textAlign: el.textAlign || 'left' }}
                  className="w-full h-full p-2 bg-white/95 text-slate-900 rounded-lg border border-amber-400 outline-none resize-none"
                />
              ) : (
                <div
                  style={{
                    color: el.color || '#0F172A',
                    fontSize: `${el.fontSize || 18}px`,
                    fontWeight: el.fontWeight || 'normal',
                    fontStyle: el.fontStyle || 'normal',
                    textAlign: el.textAlign || 'left',
                  }}
                  className="w-full h-full px-2 py-1 flex items-center overflow-hidden leading-tight whitespace-pre-wrap"
                >
                  <span className="w-full">{el.text || 'Double-click to edit'}</span>
                </div>
              )}

              {/* Bottom-Right Resize Handle */}
              {isSel && (
                <div
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    dragRef.current = {
                      kind: 'resize',
                      elId: el.id,
                      startX: e.clientX,
                      startY: e.clientY,
                      origX: el.x,
                      origY: el.y,
                      origW: el.w,
                      origH: el.h,
                    };
                  }}
                  className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-amber-500 border-2 border-white shadow cursor-nwse-resize"
                  title="Drag to resize"
                />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  if (!activeSlide) return null;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-100">
      {/* PowerPoint / Google Slides Top Studio Toolbar */}
      <div className="px-3 py-2 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1 flex-wrap">
          {mode === 'EDIT' && (
            <>
              <button
                type="button"
                disabled={undoStack.length === 0}
                onClick={() => {
                  const prev = undoStack[undoStack.length - 1];
                  if (!prev) return;
                  setUndoStack((u) => u.slice(0, -1));
                  onChangePages(prev);
                }}
                className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-35 cursor-pointer"
                title="Undo"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <span className="h-4 w-px bg-slate-200 mx-1" />

              <button
                type="button"
                onClick={() =>
                  addElement({
                    id: `el-h-${Date.now()}`,
                    type: 'heading',
                    x: 10,
                    y: 12,
                    w: 80,
                    h: 14,
                    text: 'New Slide Heading',
                    fontSize: 26,
                    fontWeight: 'extrabold',
                    color: activeSlide.layout === 'TITLE_COVER' ? '#FFFFFF' : '#0F172A',
                  })
                }
                className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                <Heading1 className="w-3.5 h-3.5 text-amber-600" /> Heading
              </button>
              <button
                type="button"
                onClick={() =>
                  addElement({
                    id: `el-t-${Date.now()}`,
                    type: 'text',
                    x: 12,
                    y: 30,
                    w: 60,
                    h: 16,
                    text: 'Double-click to type text...',
                    fontSize: 16,
                    color: activeSlide.layout === 'TITLE_COVER' ? '#E2E8F0' : '#334155',
                  })
                }
                className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                <Type className="w-3.5 h-3.5" /> Text Box
              </button>
              <button
                type="button"
                onClick={() =>
                  addElement({
                    id: `el-b-${Date.now()}`,
                    type: 'bullets',
                    x: 10,
                    y: 34,
                    w: 75,
                    h: 42,
                    items: ['Point 1', 'Point 2', 'Point 3'],
                    fontSize: 15,
                    color: '#1E293B',
                    bgColor: '#F8FAFC',
                    borderColor: '#E2E8F0',
                    borderRadius: 12,
                  })
                }
                className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                <List className="w-3.5 h-3.5" /> Bullets
              </button>
              <button
                type="button"
                onClick={() =>
                  addElement({
                    id: `el-sh-${Date.now()}`,
                    type: 'shape',
                    shapeKind: 'rounded',
                    x: 25,
                    y: 35,
                    w: 28,
                    h: 22,
                    text: 'Callout',
                    bgColor: themeColor,
                    color: '#FFFFFF',
                    borderRadius: 14,
                  })
                }
                className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                <Square className="w-3.5 h-3.5" /> Shape
              </button>
              <button
                type="button"
                onClick={() =>
                  addElement({
                    id: `el-mt-${Date.now()}`,
                    type: 'metric',
                    x: 15,
                    y: 36,
                    w: 26,
                    h: 28,
                    metricValue: '98%',
                    metricLabel: 'Target Score',
                    bgColor: '#EFF6FF',
                    borderColor: '#BFDBFE',
                    color: '#0F172A',
                    borderRadius: 14,
                  })
                }
                className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                <BarChart3 className="w-3.5 h-3.5" /> KPI Card
              </button>
              <button
                type="button"
                onClick={() =>
                  addElement({
                    id: `el-tb-${Date.now()}`,
                    type: 'table',
                    x: 12,
                    y: 35,
                    w: 76,
                    h: 36,
                    tableRows: [
                      ['Deliverable', 'Owner', 'Status'],
                      ['Phase 1', 'Team A', 'Done'],
                      ['Phase 2', 'Team B', 'In Progress'],
                    ],
                  })
                }
                className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                <Table className="w-3.5 h-3.5" /> Table
              </button>
              {onInsertImageRequest && (
                <button
                  type="button"
                  onClick={() =>
                    onInsertImageRequest((imgUrl) => {
                      addElement({
                        id: `el-im-${Date.now()}`,
                        type: 'image',
                        x: 54,
                        y: 26,
                        w: 38,
                        h: 52,
                        imageUrl: imgUrl,
                        borderRadius: 12,
                      });
                    })
                  }
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold cursor-pointer"
                >
                  <ImageIcon className="w-3.5 h-3.5" /> Image
                </button>
              )}
            </>
          )}
          {mode === 'VIEW' && (
            <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-amber-600" />
              Slide {activeIdx + 1} of {pages.length} · Double-click or switch to Edit to customize layers
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setIsPresenting(true)}
            className="flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 text-amber-400" /> Present
          </button>
          {onExportPptx && (
            <button
              type="button"
              onClick={onExportPptx}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-xs font-semibold hover:bg-amber-100 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> .PPTX
            </button>
          )}
          {onExportPdf && (
            <button
              type="button"
              onClick={onExportPdf}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-xs font-semibold hover:bg-rose-100 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" /> PDF
            </button>
          )}
          {onSave && mode === 'EDIT' && (
            <button
              type="button"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  await onSave();
                } finally {
                  setSaving(false);
                }
              }}
              className="flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              {'Save'}
            </button>
          )}
        </div>
      </div>

      {/* Main Workspace: Left Sorter | Center 16:9 Stage | Right Layer Inspector */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Slide Sorter Filmstrip */}
        <aside className="w-52 bg-white border-r border-slate-200 flex flex-col p-2.5 gap-2 overflow-y-auto shrink-0">
          {mode === 'EDIT' && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowTemplates((v) => !v)}
                className="w-full py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> New Slide
              </button>
              {showTemplates && (
                <div className="mt-1.5 p-1.5 rounded-xl border border-slate-200 bg-white shadow-lg space-y-1">
                  {SLIDE_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => {
                        const created = tpl.build(pages.length + 1, themeColor);
                        const next = [...pages, created].map((p, i) => ({ ...p, slideNumber: i + 1 }));
                        commitPages(next);
                        setActiveIdx(next.length - 1);
                        setShowTemplates(false);
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-amber-50 hover:text-amber-800 cursor-pointer"
                    >
                      {tpl.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {pages.map((p, idx) => (
            <div
              key={p.id}
              onClick={() => {
                setActiveIdx(idx);
                setSelectedElId(null);
              }}
              className={`group rounded-xl border p-2 cursor-pointer transition-all ${
                idx === activeIdx
                  ? 'border-amber-500 bg-amber-50/40 ring-2 ring-amber-500/20'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: themeColor }}>
                  {idx + 1}
                </span>
                {mode === 'EDIT' && (
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => {
                        const copy: EngineSlidePageClient = {
                          ...JSON.parse(JSON.stringify(p)),
                          id: `sp-copy-${Date.now()}`,
                        };
                        const next = [...pages.slice(0, idx + 1), copy, ...pages.slice(idx + 1)].map((x, i) => ({
                          ...x,
                          slideNumber: i + 1,
                        }));
                        commitPages(next);
                        setActiveIdx(idx + 1);
                      }}
                      className="p-0.5 text-slate-400 hover:text-blue-600"
                      title="Duplicate slide"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (idx === 0) return;
                        const copy = [...pages];
                        [copy[idx - 1], copy[idx]] = [copy[idx], copy[idx - 1]];
                        commitPages(copy.map((x, i) => ({ ...x, slideNumber: i + 1 })));
                        setActiveIdx(idx - 1);
                      }}
                      className="p-0.5 text-slate-400 hover:text-slate-700"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (idx >= pages.length - 1) return;
                        const copy = [...pages];
                        [copy[idx + 1], copy[idx]] = [copy[idx], copy[idx + 1]];
                        commitPages(copy.map((x, i) => ({ ...x, slideNumber: i + 1 })));
                        setActiveIdx(idx + 1);
                      }}
                      className="p-0.5 text-slate-400 hover:text-slate-700"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                    {pages.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const next = pages.filter((_, i) => i !== idx).map((x, i) => ({ ...x, slideNumber: i + 1 }));
                          commitPages(next);
                          setActiveIdx((cur) => Math.max(0, Math.min(cur, next.length - 1)));
                        }}
                        className="p-0.5 text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div
                style={{ backgroundColor: p.bgColor || (p.layout === 'TITLE_COVER' ? '#0F172A' : '#FFFFFF') }}
                className="aspect-[16/9] rounded-lg border border-slate-200 p-2 flex flex-col justify-center overflow-hidden"
              >
                <p className={`text-[10px] font-bold truncate ${p.layout === 'TITLE_COVER' ? 'text-white' : 'text-slate-800'}`}>
                  {p.title}
                </p>
                <p className={`text-[8px] truncate ${p.layout === 'TITLE_COVER' ? 'text-slate-300' : 'text-slate-500'}`}>
                  {p.subtitle || `${(p.elements || []).length} layers`}
                </p>
              </div>
            </div>
          ))}
        </aside>

        {/* Center Interactive Stage + Speaker Notes */}
        <div className="flex-1 flex flex-col overflow-y-auto p-4 sm:p-6 gap-4">
          <div className="max-w-4xl w-full mx-auto">
            {renderSlideStage(activeSlide, true)}
          </div>

          <div className="max-w-4xl w-full mx-auto bg-white rounded-xl border border-slate-200 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex-1">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Speaker Notes (Slide {activeIdx + 1})
              </label>
              <input
                type="text"
                readOnly={mode !== 'EDIT'}
                value={activeSlide.speakerNotes || ''}
                onChange={(e) => updateSlide({ speakerNotes: e.target.value }, false)}
                placeholder="Add presenter speaker notes..."
                className="w-full text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:border-amber-500"
              />
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                disabled={activeIdx === 0}
                onClick={() => setActiveIdx((i) => Math.max(0, i - 1))}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={activeIdx >= pages.length - 1}
                onClick={() => setActiveIdx((i) => Math.min(pages.length - 1, i + 1))}
                className="px-2.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Layer & Slide Inspector (When Editing) */}
        {mode === 'EDIT' && (
          <aside className="hidden lg:flex w-64 bg-white border-l border-slate-200 flex-col p-4 gap-4 overflow-y-auto shrink-0">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Slide Background & Theme
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-slate-600">Bg:</span>
                <input
                  type="color"
                  value={activeSlide.bgColor || (activeSlide.layout === 'TITLE_COVER' ? '#0F172A' : '#FFFFFF')}
                  onChange={(e) => updateSlide({ bgColor: e.target.value })}
                  className="w-7 h-7 rounded border border-slate-200 cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => updateSlide({ bgColor: '#FFFFFF', layout: 'FREEFORM_CANVAS' })}
                  className="px-2 py-1 text-[10px] font-semibold rounded border border-slate-200 hover:bg-slate-50"
                >
                  White
                </button>
                <button
                  type="button"
                  onClick={() => updateSlide({ bgColor: '#0F172A', layout: 'TITLE_COVER' })}
                  className="px-2 py-1 text-[10px] font-semibold rounded border border-slate-200 hover:bg-slate-50"
                >
                  Dark
                </button>
              </div>
              {onChangeThemeColor && (
                <div className="flex items-center gap-1.5 mt-2">
                  {THEME_SWATCHES.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => onChangeThemeColor(hex)}
                      style={{ backgroundColor: hex }}
                      className={`w-5 h-5 rounded-full border-2 ${
                        themeColor === hex ? 'border-slate-900 scale-110' : 'border-transparent'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>

            {selectedLayer ? (
              <div className="border-t border-slate-100 pt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600">
                    Layer: {selectedLayer.type}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeElement(selectedLayer.id)}
                    className="p-1 rounded text-rose-500 hover:bg-rose-50 cursor-pointer"
                    title="Delete selected layer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {(selectedLayer.type === 'heading' || selectedLayer.type === 'text' || selectedLayer.type === 'shape') && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Text</label>
                    <textarea
                      rows={3}
                      value={selectedLayer.text || ''}
                      onChange={(e) => updateElement(selectedLayer.id, { text: e.target.value }, false)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs"
                    />
                  </div>
                )}

                {selectedLayer.type === 'bullets' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Bullets (1 per line)</label>
                    <textarea
                      rows={4}
                      value={(selectedLayer.items || []).join('\n')}
                      onChange={(e) => updateElement(selectedLayer.id, { items: e.target.value.split('\n') }, false)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs"
                    />
                  </div>
                )}

                {selectedLayer.type === 'metric' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600">Value</label>
                      <input
                        type="text"
                        value={selectedLayer.metricValue || ''}
                        onChange={(e) => updateElement(selectedLayer.id, { metricValue: e.target.value }, false)}
                        className="w-full px-2 py-1 rounded border border-slate-200 text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600">Label</label>
                      <input
                        type="text"
                        value={selectedLayer.metricLabel || ''}
                        onChange={(e) => updateElement(selectedLayer.id, { metricLabel: e.target.value }, false)}
                        className="w-full px-2 py-1 rounded border border-slate-200 text-xs"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600">Font Size</label>
                    <input
                      type="number"
                      min={10}
                      max={64}
                      value={selectedLayer.fontSize || 16}
                      onChange={(e) => updateElement(selectedLayer.id, { fontSize: Number(e.target.value) })}
                      className="w-full px-2 py-1 rounded border border-slate-200 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600">Align</label>
                    <select
                      value={selectedLayer.textAlign || 'left'}
                      onChange={(e) => updateElement(selectedLayer.id, { textAlign: e.target.value as any })}
                      className="w-full px-2 py-1 rounded border border-slate-200 text-xs bg-white"
                    >
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <label className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                    Text:
                    <input
                      type="color"
                      value={selectedLayer.color || '#0F172A'}
                      onChange={(e) => updateElement(selectedLayer.id, { color: e.target.value })}
                      className="w-6 h-6 rounded border border-slate-200 cursor-pointer"
                    />
                  </label>
                  <label className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                    Fill:
                    <input
                      type="color"
                      value={selectedLayer.bgColor || '#FFFFFF'}
                      onChange={(e) => updateElement(selectedLayer.id, { bgColor: e.target.value })}
                      className="w-6 h-6 rounded border border-slate-200 cursor-pointer"
                    />
                  </label>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => updateElement(selectedLayer.id, { zIndex: (selectedLayer.zIndex || 1) + 1 })}
                    className="flex-1 py-1 rounded border border-slate-200 text-[11px] font-semibold hover:bg-slate-50"
                  >
                    Bring Front
                  </button>
                  <button
                    type="button"
                    onClick={() => updateElement(selectedLayer.id, { zIndex: Math.max(1, (selectedLayer.zIndex || 1) - 1) })}
                    className="flex-1 py-1 rounded border border-slate-200 text-[11px] font-semibold hover:bg-slate-50"
                  >
                    Send Back
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 border-t border-slate-100 pt-3">
                Click any element on the 16:9 canvas to drag, resize, or customize its properties. Double-click text to edit inline.
              </p>
            )}
          </aside>
        )}
      </div>

      {/* Fullscreen Presenter Overlay */}
      {isPresenting && (
        <div className="fixed inset-0 z-[70] bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-8">
          <div className="w-full max-w-6xl mb-3 flex items-center justify-between text-white">
            <div className="flex items-center gap-3 text-xs">
              <span className="px-2.5 py-1 rounded-full bg-amber-500 font-bold">
                Presenting · Slide {activeIdx + 1}/{pages.length}
              </span>
              <span className="font-mono text-slate-300">
                {String(Math.floor(presentSeconds / 60)).padStart(2, '0')}:
                {String(presentSeconds % 60).padStart(2, '0')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={activeIdx === 0}
                onClick={() => setActiveIdx((i) => Math.max(0, i - 1))}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={activeIdx >= pages.length - 1}
                onClick={() => setActiveIdx((i) => Math.min(pages.length - 1, i + 1))}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsPresenting(false)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-bold"
              >
                <X className="w-4 h-4" /> Exit (Esc)
              </button>
            </div>
          </div>

          <div className="w-full max-w-6xl">{renderSlideStage(activeSlide, false)}</div>

          {activeSlide.speakerNotes && (
            <div className="mt-4 max-w-4xl w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300">
              <strong className="text-amber-400">Speaker Notes:</strong> {activeSlide.speakerNotes}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
