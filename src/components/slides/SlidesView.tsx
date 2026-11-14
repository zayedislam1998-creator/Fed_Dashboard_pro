import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Presentation, Plus, Search, Trash2, Edit3, Eye, Upload, Sparkles, Download, Mail, Check, AlertCircle, ArrowLeft, Save } from 'lucide-react';
import {
  deleteWorkspaceSlideDeck,
  fetchWorkspaceSlides,
  saveWorkspaceSlideDeck,
  uploadFilesBinary,
  WorkspaceSlideDeck,
} from '../../services/workspaceApi';
import {
  convertViaEngine,
  EngineSlidePageClient,
  ensureClientSlideElements,
  fetchEngineFileFast,
} from '../../services/engineCache';
import { FileManagerPickerModal } from '../filemanager/FileManagerPickerModal';
import {
  UniversalDocumentEngineModal,
  UniversalEngineTarget,
} from '../shared/UniversalDocumentEngineModal';
import type { ImageEditorTarget } from '../shared/ImageEditorModal';

const SlideCanvasStudio = lazy(() =>
  import('../engines/SlideCanvasStudio').then((m) => ({ default: m.SlideCanvasStudio }))
);
const ImageEditorModal = lazy(() =>
  import('../shared/ImageEditorModal').then((m) => ({ default: m.ImageEditorModal }))
);

export type SlidesSubTab = 'all_slides' | 'add_slide';

interface SlidesViewProps {
  subTab?: SlidesSubTab;
  onSubTabChange?: (tab: SlidesSubTab) => void;
  globalSearchQuery?: string;
  onComposeShare?: (payload: { to: string; subject: string; bodyText: string }) => void;
}

function makeDefaultDeckPages(themeColor = '#D97706'): EngineSlidePageClient[] {
  return [
    ensureClientSlideElements(
      {
        id: `sp-init-${Date.now()}-1`,
        slideNumber: 1,
        layout: 'TITLE_COVER',
        title: 'Untitled Presentation',
        subtitle: 'Quarterly Strategy, Metrics & Execution Plan',
        bullets: [],
        speakerNotes: 'Open with the primary goal and executive agenda.',
      },
      themeColor
    ),
    ensureClientSlideElements(
      {
        id: `sp-init-${Date.now()}-2`,
        slideNumber: 2,
        layout: 'BULLETS_AND_INSIGHTS',
        title: 'Key Pillars & Deliverables',
        subtitle: 'Execution roadmap for the upcoming cycle',
        bullets: [
          'Align cross-functional stakeholders on milestones',
          'Automate operational reporting & document workflows',
          'Track weekly KPI progress via real-time dashboards',
        ],
        speakerNotes: 'Walk through each deliverable.',
      },
      themeColor
    ),
  ];
}

export const SlidesView: React.FC<SlidesViewProps> = ({
  subTab = 'all_slides',
  onSubTabChange,
  globalSearchQuery = '',
  onComposeShare,
}) => {
  const [activeTab, setActiveTab] = useState<SlidesSubTab>(subTab);
  const [decks, setDecks] = useState<WorkspaceSlideDeck[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [search, setSearch] = useState(globalSearchQuery);
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);

  // Active Deck Builder State
  const [editingDeckId, setEditingDeckId] = useState<string | undefined>(undefined);
  const [deckTitle, setDeckTitle] = useState('New Workspace Presentation');
  const [deckSubtitle, setDeckSubtitle] = useState('Executive Deck');
  const [deckCategory, setDeckCategory] = useState('Executive');
  const [deckThemeColor, setDeckThemeColor] = useState('#D97706');
  const [pages, setPages] = useState<EngineSlidePageClient[]>(() => makeDefaultDeckPages('#D97706'));

  // Modals
  const [engineTarget, setEngineTarget] = useState<UniversalEngineTarget | null>(null);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const imageChosenCbRef = useRef<((url: string) => void) | null>(null);
  const [imageEditorTarget, setImageEditorTarget] = useState<ImageEditorTarget | null>(null);
  const imageEditedCbRef = useRef<((url: string) => void) | null>(null);
  const pptxInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setActiveTab(subTab);
  }, [subTab]);

  useEffect(() => {
    setSearch(globalSearchQuery);
  }, [globalSearchQuery]);

  const showNotice = (text: string, ok = true) => {
    setToast({ text, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const loadDecks = async () => {
    setLoading(true);
    try {
      const res = await fetchWorkspaceSlides();
      setDecks(res.slides || []);
    } catch (err: any) {
      showNotice(err.message || 'Failed to load slide decks.', false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDecks();
  }, []);

  const switchTab = (next: SlidesSubTab) => {
    setActiveTab(next);
    onSubTabChange?.(next);
  };

  const handleStartNewDeck = () => {
    setEditingDeckId(undefined);
    setDeckTitle('New Workspace Presentation');
    setDeckSubtitle('Executive Strategy & Visual Roadmap');
    setDeckCategory('Executive');
    setDeckThemeColor('#D97706');
    setPages(makeDefaultDeckPages('#D97706'));
    switchTab('add_slide');
  };

  const handleOpenDeckInStudio = (deck: WorkspaceSlideDeck) => {
    const theme = deck.themeColor || '#D97706';
    setEditingDeckId(deck.id);
    setDeckTitle(deck.title);
    setDeckSubtitle(deck.subtitle || '');
    setDeckCategory(deck.category || 'Executive');
    setDeckThemeColor(theme);
    const normalized =
      deck.pages && deck.pages.length > 0
        ? deck.pages.map((p) => ensureClientSlideElements(p as any, theme))
        : makeDefaultDeckPages(theme);
    setPages(normalized);
    switchTab('add_slide');
  };

  const handleSaveDeck = async () => {
    setSaving(true);
    try {
      const res = await saveWorkspaceSlideDeck({
        id: editingDeckId,
        title: deckTitle.trim() || 'Untitled Presentation',
        subtitle: deckSubtitle.trim(),
        category: deckCategory.trim() || 'Executive',
        themeColor: deckThemeColor,
        pages: pages as any,
      });
      setDecks(res.slides || []);
      setEditingDeckId(res.slide.id);
      showNotice(`Saved & synced "${res.slide.title}" to Slides & File Manager!`);
    } catch (err: any) {
      showNotice(err.message || 'Failed to save presentation.', false);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDeck = async (deck: WorkspaceSlideDeck) => {
    if (!window.confirm(`Delete presentation "${deck.title}"?`)) return;
    try {
      const res = await deleteWorkspaceSlideDeck(deck.id);
      setDecks(res.slides || []);
      showNotice(`Deleted "${deck.title}".`);
    } catch (err: any) {
      showNotice(err.message || 'Failed to delete presentation.', false);
    }
  };

  const handleImportPptx = async (file: File | undefined) => {
    if (!file) return;
    setImporting(true);
    try {
      const up = await uploadFilesBinary([file], 'folder-slides');
      if (!up.file?.id) throw new Error('PPTX upload failed.');
      const parsed = await fetchEngineFileFast(up.file.id, true);
      const importedPages =
        parsed.slideDeck?.pages?.length
          ? parsed.slideDeck.pages.map((p) => ensureClientSlideElements(p, deckThemeColor))
          : makeDefaultDeckPages('#D97706');
      const cleanName = file.name.replace(/\.pptx$/i, '');
      const saved = await saveWorkspaceSlideDeck({
        title: cleanName,
        subtitle: `Imported from ${file.name}`,
        category: 'Imported PPTX',
        themeColor: '#D97706',
        pages: importedPages as any,
      });
      setDecks(saved.slides || []);
      setEditingDeckId(saved.slide.id);
      setDeckTitle(saved.slide.title);
      setDeckSubtitle(saved.slide.subtitle);
      setDeckCategory(saved.slide.category);
      setPages(importedPages);
      switchTab('add_slide');
      showNotice(`Imported "${file.name}" (${importedPages.length} slides) into Visual Studio!`);
    } catch (err: any) {
      showNotice(err.message || 'Failed to import PPTX file.', false);
    } finally {
      setImporting(false);
    }
  };

  const handleExportPptx = async (targetTitle = deckTitle, targetPages = pages) => {
    try {
      const res = await convertViaEngine({
        action: 'SLIDES_TO_PPTX',
        title: targetTitle || 'Presentation',
        pages: targetPages,
        folderId: 'folder-slides',
      });
      showNotice(`Exported "${res.file.name}" to Server File Manager!`);
    } catch (err: any) {
      showNotice(err.message || 'PPTX export failed.', false);
    }
  };

  const handleExportPdf = async (targetTitle = deckTitle, targetPages = pages) => {
    try {
      const lines = targetPages.flatMap((p) => [
        `Slide ${p.slideNumber}: ${p.title}`,
        p.subtitle || '',
        ...(p.bullets || []).map((b) => `â€¢ ${b}`),
        p.speakerNotes ? `Notes: ${p.speakerNotes}` : '',
        '',
      ]);
      const res = await convertViaEngine({
        action: 'TEXT_TO_PDF',
        title: targetTitle || 'Presentation',
        lines,
        folderId: 'folder-slides',
      });
      showNotice(`Exported PDF "${res.file.name}" to File Manager!`);
    } catch (err: any) {
      showNotice(err.message || 'PDF export failed.', false);
    }
  };

  const filteredDecks = decks.filter((d) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      d.title.toLowerCase().includes(q) ||
      d.subtitle.toLowerCase().includes(q) ||
      d.category.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex-1 flex flex-col bg-[#F6F8FC] overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 shrink-0 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
            <Presentation className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-extrabold text-slate-900">
              Slides Studio (PowerPoint & PPTX Visual Engine)
            </h1>
            <p className="text-[11px] text-slate-500">
              16:9 drag-and-drop canvas layers, templates, speaker notes, presenter timer, PPTX import & export
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <input
            ref={pptxInputRef}
            type="file"
            accept=".pptx,.ppt"
            className="hidden"
            onChange={(e) => {
              handleImportPptx(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            disabled={importing}
            onClick={() => pptxInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer disabled:opacity-50"
          >
            {<Upload className="w-3.5 h-3.5 text-amber-600" />}
            Import .pptx
          </button>

          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-0.5">
            <button
              type="button"
              onClick={() => switchTab('all_slides')}
              className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                activeTab === 'all_slides' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              All Decks ({decks.length})
            </button>
            <button
              type="button"
              onClick={() => (activeTab === 'add_slide' ? switchTab('add_slide') : handleStartNewDeck())}
              className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                activeTab === 'add_slide' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              Slide Studio
            </button>
          </div>
        </div>
      </div>

      {toast && (
        <div
          className={`px-4 py-2 text-xs font-semibold flex items-center gap-2 border-b ${
            toast.ok ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
          }`}
        >
          {toast.ok ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.text}
        </div>
      )}

      {activeTab === 'all_slides' ? (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search presentations..."
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-xs outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <button
              type="button"
              onClick={handleStartNewDeck}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              New 16:9 Presentation
            </button>
          </div>

          {filteredDecks.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
              <Presentation className="w-10 h-10 text-amber-300 mx-auto" />
              <p className="text-sm font-bold text-slate-900">No presentations yet</p>
              <p className="text-xs text-slate-500">
                Create a visual slide deck or import an existing PowerPoint (.pptx) file.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDecks.map((deck) => {
                const firstSlide = deck.pages?.[0];
                return (
                  <div
                    key={deck.id}
                    className="bg-white rounded-2xl border border-slate-200 hover:border-amber-400 hover:shadow-md transition-all overflow-hidden flex flex-col"
                  >
                    {/* 16:9 Miniature Cover */}
                    <div
                      onClick={() => handleOpenDeckInStudio(deck)}
                      className="aspect-video p-5 flex flex-col justify-between cursor-pointer relative"
                      style={{
                        background: firstSlide?.bgColor || '#0F172A',
                        borderTop: `4px solid ${deck.themeColor || '#D97706'}`,
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
                          style={{ backgroundColor: deck.themeColor || '#D97706' }}
                        >
                          {deck.slideCount} slide(s)
                        </span>
                        <span className="text-[10px] font-semibold text-slate-300">{deck.category}</span>
                      </div>
                      <div>
                        <h3 className="text-sm font-extrabold text-white line-clamp-2">{deck.title}</h3>
                        <p className="text-[11px] text-slate-300 line-clamp-1 mt-0.5">{deck.subtitle}</p>
                      </div>
                    </div>

                    {/* Footer Controls */}
                    <div className="p-3.5 flex items-center justify-between gap-2 bg-white">
                      <span className="text-[11px] text-slate-400">Updated {deck.updatedAt}</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setEngineTarget({
                              title: `${deck.title}.slides`,
                              slideDeckId: deck.id,
                              fileId: deck.linkedFileId,
                              initialMode: 'VIEW',
                            })
                          }
                          title="Present / Open in Universal Engine"
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenDeckInStudio(deck)}
                          title="Edit in Visual Canvas Studio"
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 text-[11px] font-bold cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" />
                          Studio
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExportPptx(deck.title, (deck.pages || []) as any)}
                          title="Export .pptx to File Manager"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-amber-700 hover:bg-amber-50 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        {onComposeShare && (
                          <button
                            type="button"
                            onClick={() =>
                              onComposeShare({
                                to: '',
                                subject: `Presentation: ${deck.title}`,
                                bodyText: `Sharing presentation "${deck.title}" (${deck.slideCount} slides).\n${deck.subtitle}`,
                              })
                            }
                            title="Share via Mail"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-[#0B57D0] hover:bg-blue-50 cursor-pointer"
                          >
                            <Mail className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteDeck(deck)}
                          title="Delete Deck"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Full PowerPoint-Grade Canvas Studio Tab */
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Deck Metadata Header */}
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
              <button
                type="button"
                onClick={() => switchTab('all_slides')}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Decks
              </button>
              <input
                value={deckTitle}
                onChange={(e) => setDeckTitle(e.target.value)}
                placeholder="Presentation Title..."
                className="px-3 py-1 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-900 min-w-[200px]"
              />
              <input
                value={deckSubtitle}
                onChange={(e) => setDeckSubtitle(e.target.value)}
                placeholder="Subtitle..."
                className="hidden md:block px-3 py-1 rounded-lg border border-slate-200 bg-white text-xs text-slate-600 min-w-[180px]"
              />
              <input
                value={deckCategory}
                onChange={(e) => setDeckCategory(e.target.value)}
                placeholder="Category"
                className="hidden lg:block w-28 px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs text-slate-600"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={handleSaveDeck}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {<Save className="w-3.5 h-3.5" />}
                Save Deck
              </button>
            </div>
          </div>

          <Suspense
            fallback={null}
          >
            <SlideCanvasStudio
              title={deckTitle}
              themeColor={deckThemeColor}
              pages={pages}
              mode="EDIT"
              onChangePages={setPages}
              onChangeThemeColor={setDeckThemeColor}
              onInsertImageRequest={(onChosen) => {
                imageChosenCbRef.current = onChosen;
                setShowImagePicker(true);
              }}
              onEditImageRequest={(imgUrl, onUpdated) => {
                imageEditedCbRef.current = onUpdated;
                setImageEditorTarget({
                  title: `${deckTitle} - Slide Image`,
                  imageUrl: imgUrl,
                });
              }}
              onExportPptx={() => handleExportPptx(deckTitle, pages)}
              onExportPdf={() => handleExportPdf(deckTitle, pages)}
              onSave={handleSaveDeck}
            />
          </Suspense>
        </div>
      )}

      <UniversalDocumentEngineModal
        isOpen={!!engineTarget}
        target={engineTarget}
        onClose={() => setEngineTarget(null)}
        onSavedOrUpdated={loadDecks}
        onComposeShare={onComposeShare}
      />

      <FileManagerPickerModal
        isOpen={showImagePicker}
        onClose={() => setShowImagePicker(false)}
        defaultFolderId="folder-images"
        imagesOnly
        title="Insert Image into Slide"
        onSelectFile={(file) => {
          setShowImagePicker(false);
          imageChosenCbRef.current?.(file.url);
        }}
      />

      {imageEditorTarget && (
        <Suspense fallback={null}>
          <ImageEditorModal
            isOpen={!!imageEditorTarget}
            target={imageEditorTarget}
            onClose={() => setImageEditorTarget(null)}
            onSaved={(res) => {
              const url = res.file?.url || res.dataUrl;
              imageEditedCbRef.current?.(url);
              setImageEditorTarget(null);
              showNotice('Slide image updated!');
            }}
          />
        </Suspense>
      )}
    </div>
  );
};



