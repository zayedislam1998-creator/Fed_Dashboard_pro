import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'motion/react';
import {
  Globe,
  Link2,
  LayoutTemplate,
  ExternalLink,
  RefreshCw,
  Check,
  AlertCircle,
  Edit3,
  Trash2,
} from 'lucide-react';
import {
  CorporateOrgProfileData,
  sanitizeHttpUrlClient,
} from '../../../services/workspaceApi';
import {
  CorporateScrollSpyDock,
  CORPORATE_DOCK_SECTIONS,
} from './CorporateScrollSpyDock';
import { CorporateWebsiteHeader } from './CorporateWebsiteHeader';
import { CorporateHeroSlider } from './CorporateHeroSlider';
import { CorporateMissionVision } from './CorporateMissionVision';
import { CorporateServicesGrid } from './CorporateServicesGrid';
import { CorporateTeamSection } from './CorporateTeamSection';
import { CorporateUpdatesSection } from './CorporateUpdatesSection';
import { CorporatePhotoGallery } from './CorporatePhotoGallery';
import { CorporateVideoGallery } from './CorporateVideoGallery';
import { CorporateTestimonialsSection } from './CorporateTestimonialsSection';
import { CorporateFooterSection } from './CorporateFooterSection';

interface CorporateOrgWebsiteViewProps {
  corporate: CorporateOrgProfileData;
  isEditing: boolean;
  canEdit?: boolean;
  isSaving?: boolean;
  isLivePreview?: boolean;
  onChangeCorporate: (data: CorporateOrgProfileData) => void;
  onStartCustomize?: () => void;
  onSelectWebsiteMode?: (mode: 'CUSTOM' | 'EMBED') => void;
  onSaveEmbedUrl?: (embedUrl: string) => Promise<void> | void;
  onRequestEditImage: (
    title: string,
    imageUrl: string,
    defaultAspect: '1:1' | '16:9' | '4:3',
    onSaved: (url: string) => void
  ) => void;
}

export const CorporateOrgWebsiteView: React.FC<CorporateOrgWebsiteViewProps> = ({
  corporate,
  isEditing,
  canEdit = false,
  isSaving = false,
  isLivePreview = false,
  onChangeCorporate,
  onStartCustomize,
  onSelectWebsiteMode,
  onSaveEmbedUrl,
  onRequestEditImage,
}) => {
  const [activeSectionId, setActiveSectionId] = useState<string>(
    CORPORATE_DOCK_SECTIONS[0].id
  );
  const containerRef = useRef<HTMLDivElement>(null);

  const websiteMode: 'CUSTOM' | 'EMBED' =
    corporate.settings?.websiteMode === 'EMBED' ? 'EMBED' : 'CUSTOM';

  const savedEmbedUrl = sanitizeHttpUrlClient(corporate.settings?.embedUrl).normalizedUrl;
  const [embedUrlInput, setEmbedUrlInput] = useState<string>(savedEmbedUrl);
  const [embedUrlError, setEmbedUrlError] = useState<string | null>(null);
  const [frameKey, setFrameKey] = useState<number>(1);
  const [iframeLoaded, setIframeLoaded] = useState<boolean>(false);

  useEffect(() => {
    setEmbedUrlInput(savedEmbedUrl);
    setEmbedUrlError(null);
    setIframeLoaded(false);
  }, [savedEmbedUrl, websiteMode]);

  useEffect(() => {
    if (websiteMode !== 'CUSTOM') return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSectionId(entry.target.id);
          }
        });
      },
      {
        root: null,
        rootMargin: '-20% 0px -60% 0px',
        threshold: 0,
      }
    );

    CORPORATE_DOCK_SECTIONS.forEach((sec) => {
      const el = document.getElementById(sec.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [websiteMode, isEditing, corporate]);

  const handleScrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSectionId(sectionId);
    }
  };

  const handleApplyEmbedUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    const check = sanitizeHttpUrlClient(embedUrlInput);
    if (!check.valid) {
      setEmbedUrlError(check.error || 'Invalid website URL.');
      return;
    }
    if (!check.normalizedUrl) {
      setEmbedUrlError('Please enter your website URL to embed.');
      return;
    }
    setEmbedUrlError(null);
    setIframeLoaded(false);
    setFrameKey((k) => k + 1);
    if (onSaveEmbedUrl) {
      await onSaveEmbedUrl(check.normalizedUrl);
    } else {
      onChangeCorporate({
        ...corporate,
        settings: {
          ...corporate.settings,
          websiteMode: 'EMBED',
          embedUrl: check.normalizedUrl,
        },
      });
    }
  };

  const handleClearEmbedUrl = async () => {
    setEmbedUrlInput('');
    setEmbedUrlError(null);
    setIframeLoaded(false);
    if (onSaveEmbedUrl) {
      await onSaveEmbedUrl('');
    }
  };

  const effectiveEditing = isEditing && !isLivePreview;

  // =========================================================================
  // EMBED WEBSITE MODE: Live on-page iframe integration (zero page reload)
  // =========================================================================
  if (websiteMode === 'EMBED') {
    let parsedHost = '';
    if (savedEmbedUrl) {
      try {
        parsedHost = new URL(savedEmbedUrl).hostname;
      } catch {
        parsedHost = savedEmbedUrl;
      }
    }

    return (
      <motion.div
        ref={containerRef}
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        className="max-w-6xl mx-auto px-3 sm:px-8 py-5 sm:py-7 pb-20 space-y-5 text-slate-900 dark:text-slate-100"
      >
        {/* Embed Website Control Panel */}
        <div className="rounded-[24px] p-5 sm:p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-[0_14px_40px_-15px_rgba(15,23,42,0.06)] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Link2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  Embed External Organization Website
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Connect your own domain or web app directly inside this workspace without leaving the dashboard.
                </p>
              </div>
            </div>

            {canEdit && onSelectWebsiteMode && (
              <button
                type="button"
                onClick={() => onSelectWebsiteMode('CUSTOM')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer shrink-0 self-start sm:self-auto"
              >
                <LayoutTemplate className="w-3.5 h-3.5 text-blue-600" />
                <span>Switch to Customize Website</span>
              </button>
            )}
          </div>

          {canEdit && (
            <form onSubmit={handleApplyEmbedUrl} className="space-y-2.5">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <div className="relative flex-1">
                  <Globe className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={embedUrlInput}
                    onChange={(e) => {
                      setEmbedUrlInput(e.target.value);
                      if (embedUrlError) setEmbedUrlError(null);
                    }}
                    placeholder="https://your-organization.com"
                    aria-label="External website URL"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-bold shadow-xs cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>{'Save & Embed URL'}</span>
                  </button>

                  {savedEmbedUrl && (
                    <button
                      type="button"
                      onClick={handleClearEmbedUrl}
                      disabled={isSaving}
                      title="Remove embedded URL"
                      className="inline-flex items-center justify-center p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 border border-rose-200/70 dark:border-rose-900 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {embedUrlError && (
                <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{embedUrlError}</span>
                </p>
              )}
            </form>
          )}
        </div>

        {/* Live Embedded Viewport */}
        {savedEmbedUrl ? (
          <div className="rounded-[24px] overflow-hidden bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-lg">
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border-b border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <Globe className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                  {parsedHost}
                </span>
                <span className="text-[11px] text-slate-400 truncate hidden sm:inline max-w-md">
                  {savedEmbedUrl}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setIframeLoaded(false);
                    setFrameKey((k) => k + 1);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-[11px] font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Reload Frame</span>
                </button>
                <a
                  href={savedEmbedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold"
                >
                  <span>Open in New Tab</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            <div className="relative w-full h-[640px] sm:h-[760px] bg-slate-100 dark:bg-slate-950">
              {!iframeLoaded && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-xs text-slate-500 pointer-events-none">
                  {null}
                  <span></span>
                </div>
              )}
              <iframe
                key={`${savedEmbedUrl}-${frameKey}`}
                src={savedEmbedUrl}
                title={corporate.branding.name || `${parsedHost} Organization Website`}
                onLoad={() => setIframeLoaded(true)}
                className="relative z-10 w-full h-full border-0 bg-white"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>

            <div className="px-4 py-2 bg-slate-50/90 dark:bg-slate-950/90 border-t border-slate-200/70 dark:border-slate-800 text-[11px] text-slate-500 flex flex-wrap items-center justify-between gap-2">
              <span>
                If your website host blocks embedded frames, use “Open in New Tab” above.
              </span>
              <span className="font-mono">{parsedHost}</span>
            </div>
          </div>
        ) : (
          <div className="rounded-[24px] p-10 sm:p-14 bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 mx-auto flex items-center justify-center text-slate-400">
              <Globe className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              No Website URL Embedded Yet
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              {canEdit
                ? 'Paste your organization website URL (https://...) in the box above and save to display it right here.'
                : 'This member has not embedded an external organization website yet.'}
            </p>
          </div>
        )}
      </motion.div>
    );
  }

  // =========================================================================
  // CUSTOMIZE WEBSITE MODE: Clean starter choice when unconfigured + full sections
  // =========================================================================
  const hasBranding =
    Boolean(corporate.branding.name.trim()) ||
    Boolean(corporate.branding.tagline.trim()) ||
    Boolean(corporate.branding.logoUrl);
  const hasSlides = (corporate.heroSlider || []).length > 0;
  const hasMission =
    Boolean(corporate.missionVision.mission.trim()) ||
    Boolean(corporate.missionVision.vision.trim()) ||
    (corporate.missionVision.values || []).length > 0;
  const hasServices = (corporate.services || []).length > 0;
  const hasTeam = (corporate.team || []).length > 0;
  const hasUpdates = (corporate.recentUpdates || []).length > 0;
  const hasPhotos = (corporate.photoGallery || []).length > 0;
  const hasVideos = (corporate.videoGallery || []).length > 0;
  const hasTestimonials = (corporate.testimonials || []).length > 0;
  const hasContactInfo =
    Boolean(corporate.contact.hqAddress.trim()) ||
    Boolean(corporate.contact.primaryEmail.trim()) ||
    Boolean(corporate.contact.primaryPhone.trim());

  const isBlankSite =
    !hasBranding &&
    !hasSlides &&
    !hasMission &&
    !hasServices &&
    !hasTeam &&
    !hasUpdates &&
    !hasPhotos &&
    !hasVideos &&
    !hasTestimonials;

  if (isBlankSite && !effectiveEditing) {
    return (
      <motion.div
        ref={containerRef}
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        className="max-w-5xl mx-auto px-3 sm:px-8 py-6 sm:py-10 pb-20 space-y-6 text-slate-900 dark:text-slate-100"
      >
        <div className="rounded-[28px] p-6 sm:p-10 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-[0_18px_50px_-15px_rgba(15,23,42,0.08)] space-y-6">
          <div className="space-y-1.5 text-center sm:text-left">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Organization Website Setup
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
              {canEdit
                ? 'Choose how you want to present your organization website — build it directly here or embed your existing website URL.'
                : 'This member has not configured their organization website yet.'}
            </p>
          </div>

          {canEdit && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex flex-col justify-between gap-4">
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <Edit3 className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Customize Website
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    Add your organization name, logo, mission, services, leadership team, photo/video galleries, and contact details directly inside this studio.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onStartCustomize?.()}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm cursor-pointer w-full sm:w-fit"
                >
                  <LayoutTemplate className="w-4 h-4" />
                  <span>Customize Website</span>
                </button>
              </div>

              <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex flex-col justify-between gap-4">
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <Link2 className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Embed External Website
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    Already have your own organization website? Enter your https:// link to load and display it right inside this workspace without reloading.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectWebsiteMode?.('EMBED')}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 text-xs font-bold shadow-sm cursor-pointer w-full sm:w-fit"
                >
                  <Globe className="w-4 h-4" />
                  <span>Embed Website</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      ref={containerRef}
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="relative flex-1 min-h-full pb-20 sm:pb-16 text-slate-900 dark:text-slate-100"
    >
      {/* Section Quick-Jump Bar */}
      {!isLivePreview && (
        <CorporateScrollSpyDock
          activeSectionId={activeSectionId}
          onSelectSection={handleScrollToSection}
          websiteUrl={corporate.branding.websiteUrl}
        />
      )}

      {/* Main Corporate Website Landing Page Stream */}
      <div className="max-w-6xl mx-auto px-3 sm:px-8 py-4 sm:py-6 space-y-6 sm:space-y-10">
        {/* 1. Official Corporate Header */}
        <CorporateWebsiteHeader
          branding={corporate.branding}
          themeAccent={corporate.settings?.themeAccent || 'blue'}
          isEditing={effectiveEditing}
          onChangeBranding={(branding) =>
            onChangeCorporate({ ...corporate, branding })
          }
          onEditLogo={() => {
            onRequestEditImage(
              `${corporate.branding.name || 'Organization'} Logo`,
              corporate.branding.logoUrl || '',
              '1:1',
              (url) =>
                onChangeCorporate({
                  ...corporate,
                  branding: { ...corporate.branding, logoUrl: url },
                })
            );
          }}
          onScrollToContact={() => handleScrollToSection('sec-org-contact')}
          onNavigateSection={handleScrollToSection}
        />

        {/* 2. Hero Carousel / Slider */}
        {(effectiveEditing || hasSlides) && (
          <CorporateHeroSlider
            slides={corporate.heroSlider}
            isEditing={effectiveEditing}
            onChangeSlides={(heroSlider) =>
              onChangeCorporate({ ...corporate, heroSlider })
            }
            onEditSlideImage={(slideId, currentUrl) => {
              onRequestEditImage('Hero Slide Image', currentUrl, '16:9', (url) => {
                const updated = (corporate.heroSlider || []).map((s) =>
                  s.id === slideId ? { ...s, imageUrl: url } : s
                );
                onChangeCorporate({ ...corporate, heroSlider: updated });
              });
            }}
          />
        )}

        {/* 3. Strategic Pillars: Mission, Vision & Core Values */}
        {(effectiveEditing || hasMission) && (
          <CorporateMissionVision
            missionVision={corporate.missionVision}
            isEditing={effectiveEditing}
            onChangeMissionVision={(missionVision) =>
              onChangeCorporate({ ...corporate, missionVision })
            }
          />
        )}

        {/* 4. Services, Programs & Key Offerings */}
        {(effectiveEditing || hasServices) && (
          <CorporateServicesGrid
            services={corporate.services}
            isEditing={effectiveEditing}
            onChangeServices={(services) =>
              onChangeCorporate({ ...corporate, services })
            }
          />
        )}

        {/* 5. Executive Leadership & Governance Roster */}
        {(effectiveEditing || hasTeam) && (
          <CorporateTeamSection
            team={corporate.team}
            isEditing={effectiveEditing}
            onChangeTeam={(team) => onChangeCorporate({ ...corporate, team })}
            onEditMemberAvatar={(memberId, currentUrl) => {
              onRequestEditImage('Member Avatar', currentUrl, '1:1', (url) => {
                const updated = (corporate.team || []).map((m) =>
                  m.id === memberId ? { ...m, avatarUrl: url } : m
                );
                onChangeCorporate({ ...corporate, team: updated });
              });
            }}
          />
        )}

        {/* 6. Institutional News & Updates */}
        {(effectiveEditing || hasUpdates) && (
          <CorporateUpdatesSection
            updates={corporate.recentUpdates}
            isEditing={effectiveEditing}
            onChangeUpdates={(recentUpdates) =>
              onChangeCorporate({ ...corporate, recentUpdates })
            }
          />
        )}

        {/* 7. Field Operations & Photo Gallery */}
        {(effectiveEditing || hasPhotos) && (
          <CorporatePhotoGallery
            photos={corporate.photoGallery}
            isEditing={effectiveEditing}
            onChangePhotos={(photoGallery) =>
              onChangeCorporate({ ...corporate, photoGallery })
            }
            onEditPhotoImage={(photoId, currentUrl) => {
              onRequestEditImage('Gallery Photo', currentUrl, '4:3', (url) => {
                const updated = (corporate.photoGallery || []).map((p) =>
                  p.id === photoId ? { ...p, imageUrl: url } : p
                );
                onChangeCorporate({ ...corporate, photoGallery: updated });
              });
            }}
          />
        )}

        {/* 8. Video Showcase & Field Documentaries */}
        {(effectiveEditing || hasVideos) && (
          <CorporateVideoGallery
            videos={corporate.videoGallery}
            isEditing={effectiveEditing}
            onChangeVideos={(videoGallery) =>
              onChangeCorporate({ ...corporate, videoGallery })
            }
          />
        )}

        {/* 9. Institutional Endorsements & Stakeholder Feedback */}
        {(effectiveEditing || hasTestimonials) && (
          <CorporateTestimonialsSection
            testimonials={corporate.testimonials}
            isEditing={effectiveEditing}
            onChangeTestimonials={(testimonials) =>
              onChangeCorporate({ ...corporate, testimonials })
            }
          />
        )}

        {/* 10. Corporate Headquarters, Comms & Global Footer */}
        {(effectiveEditing || hasContactInfo || hasBranding) && (
          <CorporateFooterSection
            contact={corporate.contact}
            branding={corporate.branding}
            isEditing={effectiveEditing}
            onChangeContact={(contact) =>
              onChangeCorporate({ ...corporate, contact })
            }
          />
        )}
      </div>
    </motion.div>
  );
};
