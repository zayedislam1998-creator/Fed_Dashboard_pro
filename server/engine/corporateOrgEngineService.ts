/**
 * Corporate Organization Website Builder & Landing Page Studio Engine
 *
 * Implements:
 * 1. Data schema for full Organization Websites (NGOs, Foundations, Social Enterprises, Corporations).
 * 2. YouTube URL parser for responsive in-place video embeds.
 * 3. Default high-converting organization website template generator.
 * 4. Validation, sanitization, and database persistence synchronization.
 */

export interface CorporateOrgProfileData {
  id: string;
  branding: {
    name: string;
    legalName?: string;
    tagline: string;
    logoUrl?: string;
    regNumber?: string;
    establishedYear?: string;
    primaryColor: string;
    phone: string;
    email: string;
    address: string;
    websiteUrl?: string;
  };
  heroSlider: Array<{
    id: string;
    imageUrl: string;
    title: string;
    subtitle: string;
    buttonText?: string;
    buttonUrl?: string;
  }>;
  missionVision: {
    mission: string;
    vision: string;
    values: string[];
  };
  services: Array<{
    id: string;
    title: string;
    category?: string;
    description: string;
    iconName?: string;
    statusBadge?: string;
  }>;
  team: Array<{
    id: string;
    name: string;
    role: string;
    avatarUrl?: string;
    bio?: string;
    email?: string;
    linkedInUrl?: string;
  }>;
  recentUpdates: Array<{
    id: string;
    title: string;
    date: string;
    summary: string;
    imageUrl?: string;
    linkUrl?: string;
  }>;
  photoGallery: Array<{
    id: string;
    title?: string;
    imageUrl: string;
    caption?: string;
  }>;
  videoGallery: Array<{
    id: string;
    title: string;
    youtubeUrl: string; // YouTube Video Link
    youtubeId?: string;
    description?: string;
  }>;
  testimonials: Array<{
    id: string;
    quote: string;
    authorName: string;
    authorTitle: string;
    authorAvatarUrl?: string;
    organization?: string;
  }>;
  contact: {
    primaryPhone: string;
    secondaryPhone?: string;
    primaryEmail: string;
    inquiryEmail?: string;
    hqAddress: string;
    socialLinks: {
      linkedin?: string;
      youtube?: string;
      facebook?: string;
      twitter?: string;
    };
    googleMapsUrl?: string;
  };
  settings: {
    themeAccent: 'blue' | 'emerald' | 'indigo' | 'amber';
    isPublished: boolean;
    websiteMode?: 'CUSTOM' | 'EMBED';
    embedUrl?: string;
  };
}

/**
 * Strictly validates HTTP/HTTPS URLs (blocks javascript:, data:, vbscript:, etc.).
 */
export function sanitizeHttpUrl(rawUrl?: string | null): string | undefined {
  if (!rawUrl || typeof rawUrl !== 'string') return undefined;
  const trimmed = rawUrl.trim();
  if (!trimmed) return undefined;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Extracts standard 11-character YouTube video ID from various link formats.
 * Supports: watch?v=, youtu.be/, embed/, shorts/, and raw IDs.
 */
export function extractYouTubeVideoId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const cleanUrl = url.trim();

  // Pattern covering youtu.be, youtube.com/watch?v=, youtube.com/embed/, youtube.com/shorts/
  const regex =
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|shorts\/|watch\?v=|watch\?.+&v=))([\w-]{11})/;
  const match = cleanUrl.match(regex);
  if (match && match[1]) {
    return match[1];
  }

  // Fallback: If 11 chars alphanumeric
  if (/^[\w-]{11}$/.test(cleanUrl)) {
    return cleanUrl;
  }

  return null;
}

/**
 * Generates a clean blank-by-default Organization Website state populated ONLY
 * with real user or member details already known.
 */
export function createDefaultOrgProfile(params: {
  orgName?: string;
  leaderName?: string;
  email?: string;
  phone?: string;
  address?: string;
}): CorporateOrgProfileData {
  return {
    id: `org-${Date.now().toString(36)}`,
    branding: {
      name: String(params.orgName || '').trim(),
      legalName: undefined,
      tagline: '',
      logoUrl: undefined,
      regNumber: undefined,
      establishedYear: undefined,
      primaryColor: '#0B57D0',
      phone: String(params.phone || '').trim(),
      email: String(params.email || '').trim(),
      address: String(params.address || '').trim(),
      websiteUrl: undefined,
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
      primaryPhone: String(params.phone || '').trim(),
      secondaryPhone: undefined,
      primaryEmail: String(params.email || '').trim(),
      inquiryEmail: undefined,
      hqAddress: String(params.address || '').trim(),
      socialLinks: {},
      googleMapsUrl: undefined,
    },
    settings: {
      themeAccent: 'blue',
      isPublished: true,
      websiteMode: 'CUSTOM',
      embedUrl: '',
    },
  };
}

/**
 * Validates, cleanses, and preserves empty fields without injecting fake stock content.
 */
export function sanitizeCorporateOrgProfile(
  raw: any,
  fallbackParams?: Parameters<typeof createDefaultOrgProfile>[0]
): CorporateOrgProfileData {
  const base = createDefaultOrgProfile(fallbackParams || {});
  if (!raw || typeof raw !== 'object') return base;

  const pickStr = (val: unknown, fallback: string) =>
    val !== undefined && val !== null ? String(val).trim() : fallback;

  const pickOptStr = (val: unknown, fallback?: string) => {
    if (val === undefined || val === null) return fallback;
    const s = String(val).trim();
    return s ? s : undefined;
  };

  const rawVideos = Array.isArray(raw.videoGallery) ? raw.videoGallery : base.videoGallery;
  const sanitizedVideos = rawVideos.map((v: any, idx: number) => {
    const rawUrl = String(v.youtubeUrl || '').trim();
    const id = extractYouTubeVideoId(rawUrl) || v.youtubeId || '';
    return {
      id: String(v.id || `vid-${idx + 1}`),
      title: String(v.title || '').trim(),
      youtubeUrl: rawUrl,
      youtubeId: id || undefined,
      description: v.description ? String(v.description).trim() : undefined,
    };
  });

  const websiteMode: 'CUSTOM' | 'EMBED' =
    raw.settings?.websiteMode === 'EMBED' ? 'EMBED' : 'CUSTOM';
  const safeEmbedUrl = sanitizeHttpUrl(raw.settings?.embedUrl) || '';

  return {
    id: String(raw.id || base.id),
    branding: {
      name: pickStr(raw.branding?.name, base.branding.name),
      legalName: pickOptStr(raw.branding?.legalName, base.branding.legalName),
      tagline: pickStr(raw.branding?.tagline, base.branding.tagline),
      logoUrl: pickOptStr(raw.branding?.logoUrl, base.branding.logoUrl),
      regNumber: pickOptStr(raw.branding?.regNumber, base.branding.regNumber),
      establishedYear: pickOptStr(raw.branding?.establishedYear, base.branding.establishedYear),
      primaryColor: raw.branding?.primaryColor || base.branding.primaryColor,
      phone: pickStr(raw.branding?.phone, base.branding.phone),
      email: pickStr(raw.branding?.email, base.branding.email),
      address: pickStr(raw.branding?.address, base.branding.address),
      websiteUrl: pickOptStr(raw.branding?.websiteUrl, base.branding.websiteUrl),
    },
    heroSlider: Array.isArray(raw.heroSlider)
      ? raw.heroSlider.map((slide: any, idx: number) => ({
          id: String(slide.id || `slide-${idx + 1}`),
          imageUrl: String(slide.imageUrl || ''),
          title: String(slide.title || '').trim(),
          subtitle: String(slide.subtitle || '').trim(),
          buttonText: slide.buttonText ? String(slide.buttonText).trim() : undefined,
          buttonUrl: slide.buttonUrl ? String(slide.buttonUrl).trim() : undefined,
        }))
      : base.heroSlider,
    missionVision: {
      mission: pickStr(raw.missionVision?.mission, base.missionVision.mission),
      vision: pickStr(raw.missionVision?.vision, base.missionVision.vision),
      values: Array.isArray(raw.missionVision?.values)
        ? raw.missionVision.values.map(String).filter((val: string) => val.trim())
        : base.missionVision.values,
    },
    services: Array.isArray(raw.services)
      ? raw.services.map((srv: any, idx: number) => ({
          id: String(srv.id || `srv-${idx + 1}`),
          title: String(srv.title || '').trim(),
          category: srv.category ? String(srv.category).trim() : undefined,
          description: String(srv.description || '').trim(),
          iconName: srv.iconName ? String(srv.iconName).trim() : undefined,
          statusBadge: srv.statusBadge ? String(srv.statusBadge).trim() : undefined,
        }))
      : base.services,
    team: Array.isArray(raw.team)
      ? raw.team.map((t: any, idx: number) => ({
          id: String(t.id || `team-${idx + 1}`),
          name: String(t.name || '').trim(),
          role: String(t.role || '').trim(),
          avatarUrl: t.avatarUrl ? String(t.avatarUrl) : undefined,
          bio: t.bio ? String(t.bio).trim() : undefined,
          email: t.email ? String(t.email).trim() : undefined,
          linkedInUrl: t.linkedInUrl ? String(t.linkedInUrl).trim() : undefined,
        }))
      : base.team,
    recentUpdates: Array.isArray(raw.recentUpdates)
      ? raw.recentUpdates.map((u: any, idx: number) => ({
          id: String(u.id || `upd-${idx + 1}`),
          title: String(u.title || '').trim(),
          date: String(u.date || '').trim(),
          summary: String(u.summary || '').trim(),
          imageUrl: u.imageUrl ? String(u.imageUrl) : undefined,
          linkUrl: u.linkUrl ? String(u.linkUrl).trim() : undefined,
        }))
      : base.recentUpdates,
    photoGallery: Array.isArray(raw.photoGallery)
      ? raw.photoGallery.map((p: any, idx: number) => ({
          id: String(p.id || `photo-${idx + 1}`),
          title: p.title ? String(p.title).trim() : undefined,
          imageUrl: String(p.imageUrl || ''),
          caption: p.caption ? String(p.caption).trim() : undefined,
        }))
      : base.photoGallery,
    videoGallery: sanitizedVideos,
    testimonials: Array.isArray(raw.testimonials)
      ? raw.testimonials.map((t: any, idx: number) => ({
          id: String(t.id || `test-${idx + 1}`),
          quote: String(t.quote || '').trim(),
          authorName: String(t.authorName || '').trim(),
          authorTitle: String(t.authorTitle || '').trim(),
          authorAvatarUrl: t.authorAvatarUrl ? String(t.authorAvatarUrl) : undefined,
          organization: t.organization ? String(t.organization).trim() : undefined,
        }))
      : base.testimonials,
    contact: {
      primaryPhone: pickStr(raw.contact?.primaryPhone, base.contact.primaryPhone),
      secondaryPhone: pickOptStr(raw.contact?.secondaryPhone, base.contact.secondaryPhone),
      primaryEmail: pickStr(raw.contact?.primaryEmail, base.contact.primaryEmail),
      inquiryEmail: pickOptStr(raw.contact?.inquiryEmail, base.contact.inquiryEmail),
      hqAddress: pickStr(raw.contact?.hqAddress, base.contact.hqAddress),
      socialLinks: {
        linkedin: pickOptStr(raw.contact?.socialLinks?.linkedin, undefined),
        youtube: pickOptStr(raw.contact?.socialLinks?.youtube, undefined),
        facebook: pickOptStr(raw.contact?.socialLinks?.facebook, undefined),
        twitter: pickOptStr(raw.contact?.socialLinks?.twitter, undefined),
      },
      googleMapsUrl: pickOptStr(raw.contact?.googleMapsUrl, base.contact.googleMapsUrl),
    },
    settings: {
      themeAccent: raw.settings?.themeAccent || 'blue',
      isPublished: Boolean(raw.settings?.isPublished ?? true),
      websiteMode,
      embedUrl: safeEmbedUrl,
    },
  };
}

export function rowToCorporateOrgProfileData(
  row: any,
  fallbackParams?: Parameters<typeof createDefaultOrgProfile>[0]
): CorporateOrgProfileData {
  return sanitizeCorporateOrgProfile(
    {
      id: row.id,
      branding: {
        ...(typeof row.brandingJson === 'object' && row.brandingJson ? row.brandingJson : {}),
        name: row.orgName !== undefined && row.orgName !== null ? row.orgName : row.brandingJson?.name,
        tagline: row.tagline !== undefined && row.tagline !== null ? row.tagline : row.brandingJson?.tagline,
        logoUrl: row.logoUrl || row.brandingJson?.logoUrl,
      },
      heroSlider: row.heroSliderJson,
      missionVision: row.missionVisionJson,
      services: row.servicesJson,
      team: row.teamJson,
      recentUpdates: row.recentUpdatesJson,
      photoGallery: row.photoGalleryJson,
      videoGallery: row.videoGalleryJson,
      testimonials: row.testimonialsJson,
      contact: row.contactJson,
      settings: row.settingsJson,
    },
    fallbackParams
  );
}

