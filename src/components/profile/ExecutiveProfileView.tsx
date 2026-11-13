import React, { useEffect, useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Edit3, ArrowRight } from 'lucide-react';
import {
  ResumeProfileData,
  CorporateOrgProfileData,
  fetchUserProfileStudio,
  saveUserProfileResume,
  fetchMemberProfileResume,
  saveMemberProfileResume,
  saveUserCorporateProfile,
  fetchMemberCorporateProfile,
  saveMemberCorporateProfile,
} from '../../services/workspaceApi';
import {
  ProfileModeSwitcher,
  ProfileViewMode,
  CorporateWebsiteMode,
} from './corporate/ProfileModeSwitcher';
import { FloatingScrollSpyDock, DOCK_SECTIONS } from './FloatingScrollSpyDock';
import { ProfileCoverHero } from './ProfileCoverHero';
import { ResumeSummarySection } from './ResumeSummarySection';
import { ResumeExperienceSection } from './ResumeExperienceSection';
import { ResumeEducationSection } from './ResumeEducationSection';
import { ResumeSkillsSection } from './ResumeSkillsSection';
import { ResumeProjectsSection } from './ResumeProjectsSection';
import { ResumeCertificationsSection } from './ResumeCertificationsSection';
import { ResumeContactSection } from './ResumeContactSection';
import { DigitalQrCardModal } from './DigitalQrCardModal';
import { CorporateOrgWebsiteView } from './corporate/CorporateOrgWebsiteView';
import type { ImageEditorTarget, ImageEditorSaveResult } from '../ImageEditorModal';
import type { UniversalEngineTarget } from '../UniversalDocumentEngineModal';

const ImageEditorModal = React.lazy(() =>
  import('../ImageEditorModal').then((m) => ({ default: m.ImageEditorModal }))
);
const UniversalDocumentEngineModal = React.lazy(() =>
  import('../UniversalDocumentEngineModal').then((m) => ({
    default: m.UniversalDocumentEngineModal,
  }))
);

interface StudioUserHint {
  id?: string;
  name?: string;
  email?: string;
  role?: string;
  avatarUrl?: string | null;
  phoneNumber?: string | null;
  cityName?: string | null;
  stateName?: string | null;
  countryName?: string | null;
}

function buildInitialBlankResume(userHint?: StudioUserHint | null): ResumeProfileData {
  return {
    header: {
      fullName: userHint?.name?.trim() || '',
      professionalTitle: '',
      executiveSummary: '',
      avatarUrl: userHint?.avatarUrl || undefined,
      verifiedBadge: false,
      statusText: '',
    },
    contact: {
      email: userHint?.email?.trim() || '',
      phone: userHint?.phoneNumber?.trim() || '',
      city: userHint?.cityName?.trim() || '',
      state: userHint?.stateName?.trim() || '',
      country: userHint?.countryName?.trim() || '',
      postalCode: '',
      linkedInUrl: '',
      githubUrl: '',
      portfolioUrl: '',
      websiteUrl: '',
      timezone: '',
    },
    experience: [],
    education: [],
    skills: [],
    projects: [],
    certifications: [],
    customSections: [],
    settings: {
      privacyMode: 'PUBLIC',
      themeTemplate: 'MODERN_EXECUTIVE',
      showSkillsGauges: true,
      showGeoFlags: true,
    },
  };
}

function buildInitialBlankCorporate(
  userHint?: StudioUserHint | null
): CorporateOrgProfileData {
  const email = userHint?.email?.trim() || '';
  const phone = userHint?.phoneNumber?.trim() || '';
  const address = [userHint?.cityName, userHint?.stateName, userHint?.countryName]
    .filter(Boolean)
    .join(', ');

  return {
    id: 'org-default',
    branding: {
      name: '',
      legalName: '',
      tagline: '',
      establishedYear: '',
      regNumber: '',
      primaryColor: '#0B57D0',
      phone,
      email,
      address,
      websiteUrl: '',
    },
    heroSlider: [],
    missionVision: {
      mission: '',
      vision: '',
      values: [],
    },
    services: [],
    team: [],
    recentUpdates: [],
    photoGallery: [],
    videoGallery: [],
    testimonials: [],
    contact: {
      primaryPhone: phone,
      primaryEmail: email,
      inquiryEmail: '',
      hqAddress: address,
      socialLinks: {},
    },
    settings: {
      themeAccent: 'blue',
      isPublished: true,
      websiteMode: 'CUSTOM',
      embedUrl: '',
    },
  };
}

interface ExecutiveProfileViewProps {
  viewingMemberId?: string | null;
  onBackToTeams?: () => void;
  currentUserRole?: string;
  currentUser?: StudioUserHint | null;
  onOpenUniversalDocument?: (fileId: string) => void;
}

export const ExecutiveProfileView: React.FC<ExecutiveProfileViewProps> = ({
  viewingMemberId,
  onBackToTeams,
  currentUserRole = 'ADMIN',
  currentUser,
  onOpenUniversalDocument,
}) => {
  const [profileMode, setProfileMode] = useState<ProfileViewMode>('PERSONAL');
  const [isLivePreview, setIsLivePreview] = useState<boolean>(false);

  const [resume, setResume] = useState<ResumeProfileData>(() =>
    buildInitialBlankResume(viewingMemberId ? null : currentUser)
  );
  const [corporateData, setCorporateData] = useState<CorporateOrgProfileData>(() =>
    buildInitialBlankCorporate(viewingMemberId ? null : currentUser)
  );

  const [isSyncing, setIsSyncing] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const isSelf = !viewingMemberId;
  const canEdit =
    isSelf || currentUserRole === 'OWNER' || currentUserRole === 'ADMIN';
  const [isEditing, setIsEditing] = useState<boolean>(false);

  const [activePersonalSectionId, setActivePersonalSectionId] = useState<string>(
    DOCK_SECTIONS[0].id
  );

  const [isQrModalOpen, setIsQrModalOpen] = useState<boolean>(false);
  const [editingImageTarget, setEditingImageTarget] =
    useState<ImageEditorTarget | null>(null);
  const [onImageSavedCallback, setOnImageSavedCallback] = useState<
    ((url: string) => void) | null
  >(null);
  const [previewTarget, setPreviewTarget] =
    useState<UniversalEngineTarget | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Hydrate both Resume & Corporate Website from isolated database tables
  useEffect(() => {
    let isMounted = true;
    setErrorMsg(null);
    setIsSyncing(true);

    const loadIsolatedStudioData = async () => {
      try {
        if (viewingMemberId) {
          const [resResume, resCorp] = await Promise.all([
            fetchMemberProfileResume(viewingMemberId),
            fetchMemberCorporateProfile(viewingMemberId),
          ]);
          if (isMounted) {
            if (resResume?.resume) setResume(resResume.resume);
            if (resCorp?.corporate) setCorporateData(resCorp.corporate);
          }
        } else {
          const studio = await fetchUserProfileStudio();
          if (isMounted) {
            if (studio?.resume) setResume(studio.resume);
            if (studio?.corporate) setCorporateData(studio.corporate);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setErrorMsg(err.message || 'Could not sync studio profile from database.');
        }
      } finally {
        if (isMounted) setIsSyncing(false);
      }
    };

    loadIsolatedStudioData();
    return () => {
      isMounted = false;
    };
  }, [viewingMemberId]);

  // Setup IntersectionObserver for Personal Resume sections
  useEffect(() => {
    if (profileMode !== 'PERSONAL') return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActivePersonalSectionId(entry.target.id);
          }
        });
      },
      {
        root: null,
        rootMargin: '-20% 0px -60% 0px',
        threshold: 0,
      }
    );

    DOCK_SECTIONS.forEach((sec) => {
      const el = document.getElementById(sec.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [profileMode]);

  const handleScrollToPersonalSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActivePersonalSectionId(sectionId);
    }
  };

  // Real dynamic profile completion calculation
  const profileCompletion = useMemo(() => {
    const milestones = [
      {
        key: 'identity',
        label: 'Name & Headline',
        sectionId: 'sec-summary',
        done: Boolean(
          resume.header.fullName.trim() && resume.header.professionalTitle.trim()
        ),
      },
      {
        key: 'summary',
        label: 'Executive Summary',
        sectionId: 'sec-summary',
        done: Boolean(resume.header.executiveSummary.trim()),
      },
      {
        key: 'photo',
        label: 'Profile Photo',
        sectionId: 'sec-summary',
        done: Boolean(resume.header.avatarUrl),
      },
      {
        key: 'contact',
        label: 'Contact & Location',
        sectionId: 'sec-contact',
        done: Boolean(
          resume.contact.email.trim() &&
            (resume.contact.phone.trim() ||
              resume.contact.city.trim() ||
              resume.contact.country.trim())
        ),
      },
      {
        key: 'experience',
        label: 'Experience',
        sectionId: 'sec-experience',
        done: resume.experience.length > 0,
      },
      {
        key: 'education',
        label: 'Education',
        sectionId: 'sec-education',
        done: resume.education.length > 0,
      },
      {
        key: 'skills',
        label: 'Core Skills',
        sectionId: 'sec-skills',
        done: resume.skills.some((g) => g.items.length > 0),
      },
      {
        key: 'credentials',
        label: 'Projects / Credentials',
        sectionId: 'sec-projects',
        done: resume.projects.length > 0 || resume.certifications.length > 0,
      },
    ];

    const completedCount = milestones.filter((m) => m.done).length;
    const percent = Math.round((completedCount / milestones.length) * 100);
    const missing = milestones.filter((m) => !m.done);

    return {
      completedCount,
      totalCount: milestones.length,
      percent,
      missing,
    };
  }, [resume]);

  const handleSaveResume = async (overrideResume?: ResumeProfileData) => {
    const payload = overrideResume || resume;
    if (!payload) return;
    setIsSaving(true);
    setErrorMsg(null);
    setSaveSuccessMsg(null);

    try {
      if (viewingMemberId) {
        const res = await saveMemberProfileResume(viewingMemberId, payload);
        setResume(res.resume);
      } else {
        const res = await saveUserProfileResume(payload);
        setResume(res.resume);
      }
      setIsEditing(false);
      setSaveSuccessMsg('Profile changes saved.');
      setTimeout(() => setSaveSuccessMsg(null), 3500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save resume.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveCorporate = async (
    overrideCorp?: CorporateOrgProfileData,
    options?: { message?: string; keepEditing?: boolean }
  ) => {
    const payload = overrideCorp || corporateData;
    if (!payload) return;
    setIsSaving(true);
    setErrorMsg(null);
    setSaveSuccessMsg(null);

    try {
      if (viewingMemberId) {
        const res = await saveMemberCorporateProfile(viewingMemberId, payload);
        setCorporateData(res.corporate);
      } else {
        const res = await saveUserCorporateProfile(payload);
        setCorporateData(res.corporate);
      }
      if (!options?.keepEditing) {
        setIsEditing(false);
      }
      setSaveSuccessMsg(options?.message || 'Organization website saved.');
      setTimeout(() => setSaveSuccessMsg(null), 3500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save corporate website.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectWebsiteMode = (nextMode: CorporateWebsiteMode) => {
    setIsEditing(false);
    setIsLivePreview(false);
    const next: CorporateOrgProfileData = {
      ...corporateData,
      settings: {
        ...corporateData.settings,
        websiteMode: nextMode,
      },
    };
    setCorporateData(next);
    if (canEdit && (nextMode === 'CUSTOM' || next.settings?.embedUrl)) {
      void handleSaveCorporate(next, {
        message:
          nextMode === 'EMBED'
            ? 'Switched to Embed Website mode.'
            : 'Switched to Custom Website Builder mode.',
      });
    }
  };

  const handleSaveEmbedUrl = async (embedUrl: string) => {
    const next: CorporateOrgProfileData = {
      ...corporateData,
      settings: {
        ...corporateData.settings,
        websiteMode: 'EMBED',
        embedUrl,
      },
    };
    setCorporateData(next);
    await handleSaveCorporate(next, {
      message: embedUrl
        ? 'External organization website embedded successfully.'
        : 'Embedded website URL removed.',
    });
  };

  const handleToggleEdit = () => {
    if (isEditing) {
      if (profileMode === 'PERSONAL') {
        void handleSaveResume();
      } else {
        void handleSaveCorporate();
      }
    } else {
      setIsLivePreview(false);
      setIsEditing(true);
    }
  };

  const handleRequestEditImage = (
    title: string,
    imageUrl: string,
    defaultAspect: '1:1' | '16:9' | '4:3',
    onSaved: (url: string) => void
  ) => {
    setOnImageSavedCallback(() => onSaved);
    setEditingImageTarget({
      title,
      imageUrl,
      defaultAspect,
    });
  };

  const handleExportPdf = () => {
    window.print();
  };

  const resumeTemplate = resume.settings?.themeTemplate || 'MODERN_EXECUTIVE';
  const corporateTheme = corporateData.settings?.themeAccent || 'blue';
  const websiteMode: CorporateWebsiteMode =
    corporateData.settings?.websiteMode === 'EMBED' ? 'EMBED' : 'CUSTOM';

  return (
    <div
      ref={containerRef}
      className="relative flex-1 min-h-full overflow-y-auto bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 selection:bg-blue-500/20"
    >
      {/* Top Sticky Studio Switcher & Builder Toolbar */}
      <ProfileModeSwitcher
        mode={profileMode}
        onSelectMode={(m) => {
          setIsEditing(false);
          setIsLivePreview(false);
          setProfileMode(m);
        }}
        isEditing={isEditing}
        canEdit={canEdit}
        onToggleEdit={handleToggleEdit}
        onBackToTeams={onBackToTeams}
        isSaving={isSaving}
        resumeTemplate={resumeTemplate}
        onChangeResumeTemplate={(tpl) => {
          const next: ResumeProfileData = {
            ...resume,
            settings: { ...resume.settings, themeTemplate: tpl },
          };
          setResume(next);
          if (!isEditing) {
            void handleSaveResume(next);
          }
        }}
        websiteMode={websiteMode}
        onChangeWebsiteMode={handleSelectWebsiteMode}
        corporateTheme={corporateTheme}
        onChangeCorporateTheme={(themeAccent) => {
          const colorMap: Record<string, string> = {
            blue: '#0B57D0',
            emerald: '#059669',
            indigo: '#4F46E5',
            amber: '#D97706',
          };
          const next: CorporateOrgProfileData = {
            ...corporateData,
            branding: {
              ...corporateData.branding,
              primaryColor: colorMap[themeAccent] || '#0B57D0',
            },
            settings: { ...corporateData.settings, themeAccent },
          };
          setCorporateData(next);
          if (!isEditing) {
            void handleSaveCorporate(next);
          }
        }}
        isLivePreview={isLivePreview}
        onToggleLivePreview={() => {
          setIsLivePreview((prev) => !prev);
          if (!isLivePreview) setIsEditing(false);
        }}
        onExportPdf={handleExportPdf}
        onOpenQrCard={() => setIsQrModalOpen(true)}
      />

      {/* Global Alerts */}
      <AnimatePresence>
        {(saveSuccessMsg || errorMsg) && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="max-w-5xl mx-auto px-3 sm:px-8 pt-3 sm:pt-4 space-y-2 print:hidden"
          >
            {saveSuccessMsg && (
              <div className="px-4 py-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-800 dark:text-emerald-300 shadow-2xs flex items-center justify-between">
                <span>{saveSuccessMsg}</span>
                <button
                  type="button"
                  onClick={() => setSaveSuccessMsg(null)}
                  className="underline text-[11px] cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            {errorMsg && (
              <div className="px-4 py-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs font-bold text-rose-800 dark:text-rose-300 shadow-2xs flex items-center justify-between">
                <span>{errorMsg}</span>
                <button
                  type="button"
                  onClick={() => setErrorMsg(null)}
                  className="underline text-[11px] cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================================================================== */}
      {/* 1. PERSONAL MODE vs 2. CORPORATE MODE                                */}
      {/* ==================================================================== */}
      <AnimatePresence mode="wait">
        {profileMode === 'PERSONAL' ? (
          <motion.div
            key="personal-resume-studio"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
          >
            <FloatingScrollSpyDock
              activeSectionId={activePersonalSectionId}
              onSelectSection={handleScrollToPersonalSection}
            />

            <div
              className={`max-w-6xl mx-auto px-3 sm:px-8 py-4 sm:py-6 space-y-5 sm:space-y-6 pb-20 sm:pb-12 print:p-0 print:max-w-none ${
                resumeTemplate === 'TECH_ATS'
                  ? 'font-mono'
                  : resumeTemplate === 'MINIMAL_ELEGANT'
                    ? 'tracking-wide'
                    : ''
              }`}
            >
              {/* Profile Completion Progress Card */}
              {!isSyncing && (
                <div className="rounded-[24px] p-4 sm:p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-[0_10px_30px_-15px_rgba(15,23,42,0.06)] space-y-3 print:hidden">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          profileCompletion.percent === 100
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                        }`}
                      >
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-sm font-black text-slate-900 dark:text-white">
                            {profileCompletion.percent === 100
                              ? 'Profile Complete'
                              : 'Complete Your Profile'}
                          </h2>
                          <span
                            className={`text-xs font-black tabular-nums ${
                              profileCompletion.percent === 100
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-blue-600 dark:text-blue-400'
                            }`}
                          >
                            {profileCompletion.percent}% Complete
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                          {profileCompletion.completedCount} of {profileCompletion.totalCount} profile sections filled
                        </p>
                      </div>
                    </div>

                    {canEdit && !isEditing && profileCompletion.percent < 100 && (
                      <button
                        type="button"
                        onClick={() => setIsEditing(true)}
                        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs cursor-pointer shrink-0 w-full sm:w-auto"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Complete Profile</span>
                      </button>
                    )}
                  </div>

                  {/* Progress Track */}
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        profileCompletion.percent === 100
                          ? 'bg-emerald-500'
                          : 'bg-gradient-to-r from-blue-600 to-indigo-500'
                      }`}
                      style={{ width: `${profileCompletion.percent}%` }}
                    />
                  </div>

                  {/* Missing sections quick guide */}
                  {profileCompletion.missing.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[11px]">
                      <span className="text-slate-400 font-semibold mr-1">
                        Remaining:
                      </span>
                      {profileCompletion.missing.map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => {
                            if (canEdit && !isEditing) setIsEditing(true);
                            handleScrollToPersonalSection(item.sectionId);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-slate-700 dark:text-slate-300 hover:text-blue-600 font-medium transition-colors cursor-pointer"
                        >
                          <span>{item.label}</span>
                          <ArrowRight className="w-3 h-3 opacity-60" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 1. Hero Cover Banner & Executive Identity */}
              <ProfileCoverHero
                resume={resume}
                isEditing={isEditing}
                canEdit={canEdit}
                onToggleEdit={handleToggleEdit}
                onChangeHeader={(header) =>
                  setResume((prev) => ({ ...prev, header }))
                }
                onEditAvatar={() => {
                  handleRequestEditImage(
                    `${resume.header.fullName || 'User'} Profile Photo`,
                    resume.header.avatarUrl || '',
                    '1:1',
                    (url) => {
                      setResume((prev) => ({
                        ...prev,
                        header: { ...prev.header, avatarUrl: url },
                      }));
                    }
                  );
                }}
                onEditCover={() => {
                  handleRequestEditImage(
                    `${resume.header.fullName || 'User'} Cover Banner`,
                    resume.header.coverImageUrl || '',
                    '16:9',
                    (url) => {
                      setResume((prev) => ({
                        ...prev,
                        header: { ...prev.header, coverImageUrl: url },
                      }));
                    }
                  );
                }}
                onExportPdf={handleExportPdf}
                onOpenQrCard={() => setIsQrModalOpen(true)}
                onBackToTeams={onBackToTeams}
                isSaving={isSaving}
              />

              {/* Modern 2-Column Executive Bento Architecture */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
                {/* Left / Primary Column */}
                <div className="lg:col-span-8 space-y-5 sm:space-y-6">
                  {/* 2. Executive Summary & Mission */}
                  <ResumeSummarySection
                    summary={resume.header.executiveSummary}
                    isEditing={isEditing}
                    onChangeSummary={(val) =>
                      setResume((prev) => ({
                        ...prev,
                        header: { ...prev.header, executiveSummary: val },
                      }))
                    }
                  />

                  {/* 3. Professional Career Timeline */}
                  <ResumeExperienceSection
                    experience={resume.experience}
                    isEditing={isEditing}
                    onChangeExperience={(exp) =>
                      setResume((prev) => ({ ...prev, experience: exp }))
                    }
                  />

                  {/* 6. Key Projects & Systems Portfolio */}
                  <ResumeProjectsSection
                    projects={resume.projects}
                    isEditing={isEditing}
                    onChangeProjects={(projects) =>
                      setResume((prev) => ({ ...prev, projects }))
                    }
                    onOpenDocument={(docId) => {
                      if (onOpenUniversalDocument) {
                        onOpenUniversalDocument(docId);
                      } else {
                        setPreviewTarget({ title: 'Project Document', fileId: docId });
                      }
                    }}
                  />
                </div>

                {/* Right / Executive Sidebar Column */}
                <div className="lg:col-span-4 space-y-5 sm:space-y-6">
                  {/* 5. Core Competencies & Skills Gauges */}
                  <ResumeSkillsSection
                    skills={resume.skills}
                    isEditing={isEditing}
                    onChangeSkills={(skills) =>
                      setResume((prev) => ({ ...prev, skills }))
                    }
                  />

                  {/* 4. Education & Academic Background */}
                  <ResumeEducationSection
                    education={resume.education}
                    isEditing={isEditing}
                    onChangeEducation={(edu) =>
                      setResume((prev) => ({ ...prev, education: edu }))
                    }
                  />

                  {/* 7. Licenses, Certifications & Credentials */}
                  <ResumeCertificationsSection
                    certifications={resume.certifications}
                    isEditing={isEditing}
                    onChangeCertifications={(certs) =>
                      setResume((prev) => ({ ...prev, certifications: certs }))
                    }
                    onPreviewCredentialFile={(fileId) => {
                      if (onOpenUniversalDocument) {
                        onOpenUniversalDocument(fileId);
                      } else {
                        setPreviewTarget({
                          title: 'Verified Credential Document',
                          fileId,
                        });
                      }
                    }}
                  />

                  {/* 8. Global Contact & Professional Network */}
                  <ResumeContactSection
                    contact={resume.contact}
                    isEditing={isEditing}
                    onChangeContact={(contact) =>
                      setResume((prev) => ({ ...prev, contact }))
                    }
                  />
                </div>
              </div>

              <div className="pt-4 pb-10 text-center text-xs text-slate-400 border-t border-slate-200/60 dark:border-slate-800">
                Resume &amp; Profile Studio ({resumeTemplate})
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="corporate-website-studio"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
          >
            <CorporateOrgWebsiteView
              corporate={corporateData}
              isEditing={isEditing}
              canEdit={canEdit}
              isSaving={isSaving}
              isLivePreview={isLivePreview}
              onChangeCorporate={setCorporateData}
              onStartCustomize={() => {
                setIsLivePreview(false);
                setIsEditing(true);
              }}
              onSelectWebsiteMode={handleSelectWebsiteMode}
              onSaveEmbedUrl={handleSaveEmbedUrl}
              onRequestEditImage={handleRequestEditImage}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dynamic QR Code Modal */}
      <DigitalQrCardModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        resume={resume}
      />

      {/* Shared On-Demand Modals */}
      <React.Suspense fallback={null}>
        {editingImageTarget && (
          <ImageEditorModal
            isOpen={true}
            onClose={() => setEditingImageTarget(null)}
            target={editingImageTarget}
            onSaved={(res: ImageEditorSaveResult) => {
              if (onImageSavedCallback) {
                onImageSavedCallback(res.dataUrl);
              }
              setEditingImageTarget(null);
            }}
          />
        )}

        {previewTarget && (
          <UniversalDocumentEngineModal
            isOpen={true}
            onClose={() => setPreviewTarget(null)}
            target={previewTarget}
          />
        )}
      </React.Suspense>
    </div>
  );
};
