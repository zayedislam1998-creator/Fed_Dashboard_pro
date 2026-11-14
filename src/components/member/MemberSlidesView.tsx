import React, { Suspense, lazy, useMemo, useState } from 'react';
import { ChevronLeft, Plus, Presentation } from 'lucide-react';
import { ensureClientSlideElements } from '../../services/engineCache';
import { saveMemberSlide } from '../../services/workspaceAuth';
import {
  canMemberAction,
  EmptyAppCard,
  filterBySearch,
  MemberBootstrapData,
  StatusPill,
} from './shared';

const SlideCanvasStudio = lazy(() =>
  import('../engines/SlideCanvasStudio').then((m) => ({ default: m.SlideCanvasStudio }))
);

export function MemberSlidesView({
  data,
  searchQuery = '',
  readOnlyPreview,
  onReload,
  onNotify,
}: {
  data: MemberBootstrapData;
  searchQuery?: string;
  readOnlyPreview?: boolean;
  onReload: () => Promise<void>;
  onNotify: (msg: string, isError?: boolean) => void;
}) {
  const [activeDeck, setActiveDeck] = useState<any | null>(null);
  const [pageIdx, setPageIdx] = useState(0);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [saving, setSaving] = useState(false);

  const canCreate = !readOnlyPreview && canMemberAction(data.capabilities, 'slide.create');
  const visibleSlides = useMemo(
    () => filterBySearch(data.slides, searchQuery, ['title', 'subtitle', 'category']),
    [data.slides, searchQuery]
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await saveMemberSlide({
        title: title.trim(),
        subtitle,
        pages: [
          {
            id: `sp-${Date.now()}-1`,
            slideNumber: 1,
            title: title.trim(),
            subtitle: subtitle || 'Presentation Overview',
            bullets: subtitle ? subtitle.split('\n').filter(Boolean) : ['Key highlights & talking points'],
          },
        ],
      });
      setTitle('');
      setSubtitle('');
      setCreating(false);
      await onReload();
      onNotify('Slide deck saved.');
    } catch (err: any) {
      onNotify(err.message || 'Could not create slide deck.', true);
    } finally {
      setSaving(false);
    }
  };

  if (activeDeck) {
    const rawPages: any[] = Array.isArray(activeDeck.pages) && activeDeck.pages.length > 0
      ? activeDeck.pages
      : [{ id: 'sp-1', slideNumber: 1, layout: 'TITLE_COVER', title: activeDeck.title, subtitle: activeDeck.subtitle || 'Presentation slide', bullets: [], speakerNotes: '' }];
    const studioPages = rawPages.map((p: any, i: number) =>
      ensureClientSlideElements(
        {
          id: p.id || `mp-sp-${i}`,
          slideNumber: p.slideNumber || i + 1,
          layout: p.layout || (i === 0 ? 'TITLE_COVER' : 'BULLETS_AND_INSIGHTS'),
          title: p.title || p.heading || activeDeck.title,
          subtitle: p.subtitle || p.body || '',
          bullets: Array.isArray(p.bullets) ? p.bullets : [],
          speakerNotes: p.speakerNotes || '',
          imageUrl: p.imageUrl,
          accentColor: p.accentColor || activeDeck.themeColor,
          bgColor: p.bgColor,
          elements: p.elements,
        },
        activeDeck.themeColor || '#D97706'
      )
    );

    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => {
            setActiveDeck(null);
            setPageIdx(0);
          }}
          className="min-h-[40px] px-3.5 rounded-2xl mp-card-soft text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" /> Back to Decks
        </button>

        <div className="mp-card rounded-3xl overflow-hidden min-h-[460px] flex flex-col">
          <Suspense fallback={null}>
            <SlideCanvasStudio
              title={activeDeck.title}
              themeColor={activeDeck.themeColor || '#D97706'}
              pages={studioPages}
              mode="VIEW"
              onChangePages={() => {}}
            />
          </Suspense>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {canCreate && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setCreating((v) => !v)}
            className="min-h-[44px] px-4 rounded-2xl text-sm font-semibold text-white bg-[var(--mp-accent)] inline-flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" /> New Slide Deck
          </button>
        </div>
      )}

      {creating && canCreate && (
        <form onSubmit={handleCreate} className="mp-card rounded-3xl p-5 space-y-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Deck title..."
            required
            className="w-full min-h-[44px] px-4 rounded-2xl border border-[var(--mp-border)] bg-[var(--mp-surface-subtle)] text-sm font-semibold"
          />
          <textarea
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            rows={3}
            placeholder="Intro slide bullet points..."
            className="w-full p-4 rounded-2xl border border-[var(--mp-border)] bg-[var(--mp-surface-subtle)] text-sm"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setCreating(false)} className="min-h-[42px] px-4 text-sm text-[var(--mp-text-muted)] cursor-pointer">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="min-h-[42px] px-5 rounded-2xl text-sm font-semibold text-white bg-[var(--mp-accent)] cursor-pointer">
              Create Deck
            </button>
          </div>
        </form>
      )}

      {visibleSlides.length === 0 ? (
        <EmptyAppCard
          icon={Presentation}
          title="No slide decks found"
          subtitle="Decks you create or decks shared with you appear here."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {visibleSlides.map((deck) => (
            <button
              key={deck.id}
              type="button"
              onClick={() => {
                setActiveDeck(deck);
                setPageIdx(0);
              }}
              className="text-left mp-card-soft rounded-3xl p-5 hover:opacity-95 transition cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2">
                <StatusPill label={`${deck.slideCount || 1} Slides`} tone="accent" />
                <span className="text-xs text-[var(--mp-text-muted)]">{deck.updatedAt}</span>
              </div>
              <h3 className="text-base font-bold text-[var(--mp-text)] mt-2.5">{deck.title}</h3>
              {deck.subtitle && <p className="text-sm text-[var(--mp-text-muted)] mt-1 line-clamp-2">{deck.subtitle}</p>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
