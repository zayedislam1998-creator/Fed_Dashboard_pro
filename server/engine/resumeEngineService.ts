/**
 * Executive Portfolio & US-Standard CV Builder Engine Service
 *
 * Implements:
 * 1. Typed schema definition for US Executive & ATS-compliant resumes (STAR/XYZ methodology).
 * 2. Intelligent default generator for any user or member.
 * 3. Bidirectional data synchronization between WorkspaceUser and WorkspaceMember.
 * 4. High-fidelity vector PDF generation for executive print and sharing.
 */

export interface ResumeProfileData {
  header: {
    fullName: string;
    professionalTitle: string;
    executiveSummary: string;
    coverImageUrl?: string;
    avatarUrl?: string;
    verifiedBadge: boolean;
    statusText?: string;
  };
  contact: {
    email: string;
    phone: string;
    city: string;
    state: string;
    country: string;
    postalCode?: string;
    linkedInUrl?: string;
    githubUrl?: string;
    portfolioUrl?: string;
    websiteUrl?: string;
    timezone: string;
  };
  experience: Array<{
    id: string;
    company: string;
    position: string;
    employmentType: 'Full-time' | 'Contract' | 'Executive' | 'Advisory' | 'Part-time';
    location: string;
    startDate: string;
    endDate: string;
    isCurrent: boolean;
    bullets: string[];
    technologies: string[];
  }>;
  education: Array<{
    id: string;
    institution: string;
    degree: string;
    fieldOfStudy: string;
    location: string;
    graduationDate: string;
    gpaOrHonors?: string;
    highlights: string[];
  }>;
  skills: Array<{
    category: string;
    items: Array<{
      name: string;
      levelPercent: number; // 0 - 100
      levelBadge: 'Expert' | 'Advanced' | 'Intermediate';
    }>;
  }>;
  projects: Array<{
    id: string;
    title: string;
    role: string;
    period?: string;
    description: string;
    bullets: string[];
    liveUrl?: string;
    githubUrl?: string;
    technologies: string[];
    documentId?: string; // Links to platform file engine
  }>;
  certifications: Array<{
    id: string;
    title: string;
    issuingOrganization: string;
    issueDate: string;
    expiryDate?: string;
    credentialId?: string;
    verificationUrl?: string;
    attachedFileId?: string; // Integrated with Universal File Engine
  }>;
  customSections: Array<{
    id: string;
    title: string;
    items: Array<{
      heading: string;
      subHeading?: string;
      date?: string;
      description: string;
    }>;
  }>;
  settings: {
    privacyMode: 'PUBLIC' | 'TEAM_ONLY' | 'PRIVATE';
    themeTemplate: 'MODERN_EXECUTIVE' | 'TECH_ATS' | 'MINIMAL_ELEGANT';
    showSkillsGauges: boolean;
    showGeoFlags: boolean;
  };
}

/**
 * Creates a clean blank-by-default resume profile populated ONLY
 * with real user or member fields already present.
 */
export function createDefaultResumeProfile(params: {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  designation?: string;
  role?: string;
  phone?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  avatarUrl?: string;
  bio?: string;
}): ResumeProfileData {
  const name =
    String(
      params.fullName ||
        [params.firstName, params.lastName].filter(Boolean).join(' ') ||
        ''
    ).trim();

  const title = String(params.designation || '').trim();
  const summary = String(params.bio || '').trim();

  return {
    header: {
      fullName: name,
      professionalTitle: title,
      executiveSummary: summary,
      avatarUrl: params.avatarUrl || undefined,
      coverImageUrl: undefined,
      verifiedBadge: false,
      statusText: undefined,
    },
    contact: {
      email: String(params.email || '').trim(),
      phone: String(params.phone || '').trim(),
      city: String(params.city || '').trim(),
      state: String(params.state || '').trim(),
      country: String(params.country || '').trim(),
      postalCode: params.postalCode ? String(params.postalCode).trim() : undefined,
      linkedInUrl: undefined,
      githubUrl: undefined,
      portfolioUrl: undefined,
      websiteUrl: undefined,
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

/**
 * Validates and sanitizes incoming resume profile payload without injecting fake placeholders.
 */
export function sanitizeResumeProfile(
  raw: any,
  fallbackParams?: Parameters<typeof createDefaultResumeProfile>[0]
): ResumeProfileData {
  const base = createDefaultResumeProfile(fallbackParams || {});
  if (!raw || typeof raw !== 'object') return base;

  const pickStr = (val: unknown, fallback: string) =>
    val !== undefined && val !== null ? String(val).trim() : fallback;

  const pickOptStr = (val: unknown, fallback?: string) => {
    if (val === undefined || val === null) return fallback;
    const s = String(val).trim();
    return s ? s : undefined;
  };

  return {
    header: {
      fullName: pickStr(raw.header?.fullName, base.header.fullName),
      professionalTitle: pickStr(raw.header?.professionalTitle, base.header.professionalTitle),
      executiveSummary: pickStr(raw.header?.executiveSummary, base.header.executiveSummary),
      coverImageUrl: pickOptStr(raw.header?.coverImageUrl, base.header.coverImageUrl),
      avatarUrl: pickOptStr(raw.header?.avatarUrl, base.header.avatarUrl),
      verifiedBadge: Boolean(raw.header?.verifiedBadge ?? base.header.verifiedBadge),
      statusText: pickOptStr(raw.header?.statusText, base.header.statusText),
    },
    contact: {
      email: pickStr(raw.contact?.email, base.contact.email),
      phone: pickStr(raw.contact?.phone, base.contact.phone),
      city: pickStr(raw.contact?.city, base.contact.city),
      state: pickStr(raw.contact?.state, base.contact.state),
      country: pickStr(raw.contact?.country, base.contact.country),
      postalCode: pickOptStr(raw.contact?.postalCode, base.contact.postalCode),
      linkedInUrl: pickOptStr(raw.contact?.linkedInUrl, base.contact.linkedInUrl),
      githubUrl: pickOptStr(raw.contact?.githubUrl, base.contact.githubUrl),
      portfolioUrl: pickOptStr(raw.contact?.portfolioUrl, base.contact.portfolioUrl),
      websiteUrl: pickOptStr(raw.contact?.websiteUrl, base.contact.websiteUrl),
      timezone: pickStr(raw.contact?.timezone, base.contact.timezone),
    },
    experience: Array.isArray(raw.experience)
      ? raw.experience.map((exp: any, i: number) => ({
          id: String(exp.id || `exp-${i + 1}`),
          company: String(exp.company || '').trim(),
          position: String(exp.position || '').trim(),
          employmentType: exp.employmentType || 'Full-time',
          location: String(exp.location || '').trim(),
          startDate: String(exp.startDate || '').trim(),
          endDate: String(exp.endDate || '').trim(),
          isCurrent: Boolean(exp.isCurrent),
          bullets: Array.isArray(exp.bullets)
            ? exp.bullets.map(String).filter((b: string) => b.trim())
            : [],
          technologies: Array.isArray(exp.technologies)
            ? exp.technologies.map(String).filter((t: string) => t.trim())
            : [],
        }))
      : base.experience,
    education: Array.isArray(raw.education)
      ? raw.education.map((edu: any, i: number) => ({
          id: String(edu.id || `edu-${i + 1}`),
          institution: String(edu.institution || '').trim(),
          degree: String(edu.degree || '').trim(),
          fieldOfStudy: String(edu.fieldOfStudy || '').trim(),
          location: String(edu.location || '').trim(),
          graduationDate: String(edu.graduationDate || '').trim(),
          gpaOrHonors: edu.gpaOrHonors ? String(edu.gpaOrHonors).trim() : undefined,
          highlights: Array.isArray(edu.highlights)
            ? edu.highlights.map(String).filter((h: string) => h.trim())
            : [],
        }))
      : base.education,
    skills: Array.isArray(raw.skills)
      ? raw.skills.map((grp: any) => ({
          category: String(grp.category || 'Core Skills').trim(),
          items: Array.isArray(grp.items)
            ? grp.items.map((item: any) => ({
                name: String(item.name || '').trim(),
                levelPercent: Math.max(0, Math.min(100, Number(item.levelPercent) || 80)),
                levelBadge: (item.levelBadge as any) || 'Advanced',
              }))
            : [],
        }))
      : base.skills,
    projects: Array.isArray(raw.projects)
      ? raw.projects.map((proj: any, i: number) => ({
          id: String(proj.id || `proj-${i + 1}`),
          title: String(proj.title || '').trim(),
          role: String(proj.role || '').trim(),
          period: proj.period ? String(proj.period).trim() : undefined,
          description: String(proj.description || '').trim(),
          bullets: Array.isArray(proj.bullets)
            ? proj.bullets.map(String).filter((b: string) => b.trim())
            : [],
          liveUrl: proj.liveUrl ? String(proj.liveUrl).trim() : undefined,
          githubUrl: proj.githubUrl ? String(proj.githubUrl).trim() : undefined,
          technologies: Array.isArray(proj.technologies)
            ? proj.technologies.map(String).filter((t: string) => t.trim())
            : [],
          documentId: proj.documentId ? String(proj.documentId).trim() : undefined,
        }))
      : base.projects,
    certifications: Array.isArray(raw.certifications)
      ? raw.certifications.map((cert: any, i: number) => ({
          id: String(cert.id || `cert-${i + 1}`),
          title: String(cert.title || '').trim(),
          issuingOrganization: String(cert.issuingOrganization || '').trim(),
          issueDate: String(cert.issueDate || '').trim(),
          expiryDate: cert.expiryDate ? String(cert.expiryDate).trim() : undefined,
          credentialId: cert.credentialId ? String(cert.credentialId).trim() : undefined,
          verificationUrl: cert.verificationUrl ? String(cert.verificationUrl).trim() : undefined,
          attachedFileId: cert.attachedFileId ? String(cert.attachedFileId).trim() : undefined,
        }))
      : base.certifications,
    customSections: Array.isArray(raw.customSections)
      ? raw.customSections.map((sec: any, i: number) => ({
          id: String(sec.id || `sec-${i + 1}`),
          title: String(sec.title || 'Section').trim(),
          items: Array.isArray(sec.items)
            ? sec.items.map((item: any) => ({
                heading: String(item.heading || '').trim(),
                subHeading: item.subHeading ? String(item.subHeading).trim() : undefined,
                date: item.date ? String(item.date).trim() : undefined,
                description: String(item.description || '').trim(),
              }))
            : [],
        }))
      : [],
    settings: {
      privacyMode: raw.settings?.privacyMode || 'PUBLIC',
      themeTemplate: raw.settings?.themeTemplate || 'MODERN_EXECUTIVE',
      showSkillsGauges: raw.settings?.showSkillsGauges ?? true,
      showGeoFlags: raw.settings?.showGeoFlags ?? true,
    },
  };
}

export function rowToResumeProfileData(
  row: any,
  fallbackParams?: Parameters<typeof createDefaultResumeProfile>[0]
): ResumeProfileData {
  return sanitizeResumeProfile(
    {
      header: {
        fullName: row.fullName,
        professionalTitle: row.professionalTitle,
        executiveSummary: row.executiveSummary,
        avatarUrl: row.avatarUrl || undefined,
        coverImageUrl: row.coverImageUrl || undefined,
        verifiedBadge: row.verifiedBadge ?? false,
        statusText: row.statusText || undefined,
      },
      contact: row.contactJson,
      experience: row.experienceJson,
      education: row.educationJson,
      skills: row.skillsJson,
      projects: row.projectsJson,
      certifications: row.certificationsJson,
      customSections: row.customSectionsJson,
      settings: row.settingsJson,
    },
    fallbackParams
  );
}

