import { normalizeMailAddress, queueAdminSubmission, queueWorkspaceMail } from '../mail/workspaceMailAutomation';
import express from 'express';
import fs from 'fs';
import nodemailer from 'nodemailer';
import path from 'path';
import {
  decryptSecret,
  ensureExternalStorageDirs,
  prisma,
  UPLOADS_DIR,
} from '../db/prisma';
import {
  ensureWorkspaceBootstrap,
  getPrimaryAdminIdentity,
  STRUCTURAL_DEFAULT_FOLDERS,
  syncWorkspaceUsersToMembers,
} from '../db/initEngine';
import {
  toFormSubmissionDto,
  toWorkspaceDocDto,
  toWorkspaceFileDto,
  toWorkspaceFolderDto,
  toWorkspaceFormDto,
  toWorkspaceMeetingDto,
  toWorkspaceMemberDto,
  toWorkspacePostCategoryDto,
  toWorkspacePostNoticeDto,
  toWorkspaceSlideDto,
  toWorkspaceTeamGroupDto,
} from '../db/mappers';
import { requireAdmin, requireAuth } from '../auth/sessionAuth';
import { hasModuleCapability } from '../auth/policy';
import {
  asyncHandler,
  broadcastRealtimeEvent,
  recordAndBroadcastNotification,
} from '../realtime';
import {
  ensureVisualSlideElements,
  invalidateEngineCache,
  sanitizeUnicodeFilename,
} from '../engine/fileEngineService';
import {
  createDefaultResumeProfile,
  rowToResumeProfileData,
  sanitizeResumeProfile,
  ResumeProfileData,
} from '../engine/resumeEngineService';
import {
  createDefaultOrgProfile,
  rowToCorporateOrgProfileData,
  sanitizeCorporateOrgProfile,
  CorporateOrgProfileData,
} from '../engine/corporateOrgEngineService';

async function syncWorkspaceDocFileInTx(
  tx: any,
  doc: {
    id: string;
    title: string;
    category: string;
    bodyText: string;
    linkedFileId: string | null;
    updatedAt: string;
    createdAt: string;
    timestampMs: bigint;
  }
) {
  let docsFolder = await tx.workspaceFolder.findUnique({ where: { id: 'folder-documents' } });
  if (!docsFolder) {
    const def = STRUCTURAL_DEFAULT_FOLDERS.find((f) => f.id === 'folder-documents')!;
    docsFolder = await tx.workspaceFolder.create({
      data: {
        ...def,
        createdAt: doc.createdAt,
        timestampMs: doc.timestampMs,
      },
    });
  }

  ensureExternalStorageDirs();
  const safeSlug = sanitizeUnicodeFilename(doc.title, 'doc').replace(/[?#%&]/g, '_').slice(0, 55);
  const diskFileName = `doc-${doc.id}-${safeSlug}.doc.txt`;
  const diskPath = path.join(UPLOADS_DIR, diskFileName);
  const contentStr = `${doc.title}\nCategory: ${doc.category}\nUpdated: ${doc.updatedAt}\n\n${doc.bodyText}`;
  try {
    fs.writeFileSync(diskPath, contentStr, 'utf-8');
  } catch {
    // ignore disk error
  }
  const byteSize = BigInt(Buffer.byteLength(contentStr, 'utf-8'));

  const existingFile = await tx.workspaceFile.findFirst({
    where: {
      OR: [
        { docId: doc.id },
        ...(doc.linkedFileId ? [{ id: doc.linkedFileId }] : []),
      ],
    },
  });

  const fileId = existingFile?.id || `file-doc-${doc.id}`;
  const fileUrl = `/uploads/${encodeURIComponent(diskFileName)}`;

  const savedFile = await tx.workspaceFile.upsert({
    where: { id: fileId },
    update: {
      folderId: docsFolder.id,
      folderName: docsFolder.name,
      name: `${doc.title}.doc`,
      originalName: `${doc.title}.doc`,
      originalSizeBytes: byteSize,
      compressedSizeBytes: byteSize,
      url: fileUrl,
      storagePath: `external/uploads/${diskFileName}`,
      docId: doc.id,
      bodyText: doc.bodyText,
      uploadedAt: doc.updatedAt || doc.createdAt,
      timestampMs: doc.timestampMs,
    },
    create: {
      id: fileId,
      folderId: docsFolder.id,
      folderName: docsFolder.name,
      name: `${doc.title}.doc`,
      originalName: `${doc.title}.doc`,
      mimeType: 'application/vnd.workspace.doc+text',
      extension: 'doc',
      isImage: false,
      originalSizeBytes: byteSize,
      compressedSizeBytes: byteSize,
      compressionRatio: 0,
      url: fileUrl,
      storagePath: `external/uploads/${diskFileName}`,
      docId: doc.id,
      bodyText: doc.bodyText,
      uploadedAt: doc.updatedAt || doc.createdAt,
      timestampMs: doc.timestampMs,
    },
  });

  await tx.workspaceDoc.update({
    where: { id: doc.id },
    data: { linkedFileId: savedFile.id, fileUrl: savedFile.url },
  });
  invalidateEngineCache(savedFile.id);

  return savedFile;
}

async function syncSlideDeckFileInTx(
  tx: any,
  deck: {
    id: string;
    title: string;
    subtitle: string | null;
    category: string;
    themeColor: string;
    authorName: string;
    pagesJson: any;
    linkedFileId: string | null;
    slideCount: number;
    createdAt: string;
    updatedAt: string;
    timestampMs: bigint;
  }
) {
  let docsFolder = await tx.workspaceFolder.findUnique({ where: { id: 'folder-documents' } });
  if (!docsFolder) {
    const def = STRUCTURAL_DEFAULT_FOLDERS.find((f) => f.id === 'folder-documents')!;
    docsFolder = await tx.workspaceFolder.create({
      data: {
        ...def,
        createdAt: deck.createdAt,
        timestampMs: deck.timestampMs,
      },
    });
  }

  ensureExternalStorageDirs();
  const safeSlug = sanitizeUnicodeFilename(deck.title, 'slide').replace(/[?#%&]/g, '_').slice(0, 55);
  const diskFileName = `slide-${deck.id}-${safeSlug}.slide.json`;
  const diskPath = path.join(UPLOADS_DIR, diskFileName);
  const fileUrl = `/uploads/${encodeURIComponent(diskFileName)}`;
  const dto = toWorkspaceSlideDto({ ...deck, fileUrl, extraFields: {} } as any);
  const payloadStr = JSON.stringify(dto, null, 2);
  try {
    fs.writeFileSync(diskPath, payloadStr, 'utf-8');
  } catch {
    // ignore disk error
  }
  const byteSize = BigInt(Buffer.byteLength(payloadStr, 'utf-8'));

  const existingFile = await tx.workspaceFile.findFirst({
    where: {
      OR: [
        { slideDeckId: deck.id },
        ...(deck.linkedFileId ? [{ id: deck.linkedFileId }] : []),
      ],
    },
  });

  const fileId = existingFile?.id || `file-slide-${deck.id}`;

  const savedFile = await tx.workspaceFile.upsert({
    where: { id: fileId },
    update: {
      folderId: docsFolder.id,
      folderName: docsFolder.name,
      name: `${deck.title}.slides`,
      originalName: `${deck.title}.slides`,
      originalSizeBytes: byteSize,
      compressedSizeBytes: byteSize,
      url: fileUrl,
      storagePath: `external/uploads/${diskFileName}`,
      slideDeckId: deck.id,
      uploadedAt: deck.updatedAt || deck.createdAt,
      timestampMs: deck.timestampMs,
    },
    create: {
      id: fileId,
      folderId: docsFolder.id,
      folderName: docsFolder.name,
      name: `${deck.title}.slides`,
      originalName: `${deck.title}.slides`,
      mimeType: 'application/vnd.workspace.slides+json',
      extension: 'slides',
      isImage: false,
      originalSizeBytes: byteSize,
      compressedSizeBytes: byteSize,
      compressionRatio: 0,
      url: fileUrl,
      storagePath: `external/uploads/${diskFileName}`,
      slideDeckId: deck.id,
      uploadedAt: deck.updatedAt || deck.createdAt,
      timestampMs: deck.timestampMs,
    },
  });

  await tx.workspaceSlide.update({
    where: { id: deck.id },
    data: { linkedFileId: savedFile.id, fileUrl: savedFile.url },
  });
  invalidateEngineCache(savedFile.id);

  return savedFile;
}

export function registerWorkspaceContentRoutes(app: express.Express) {
  // Enforce Admin boundaries on unscoped Admin module endpoints
  // (Public form/invite links remain public; Member Dashboard uses scoped /api/member/* routes)
  app.use('/api/forms', requireAuth, requireAdmin);
  app.use('/api/docs', requireAuth, requireAdmin);
  app.use('/api/slides', requireAuth, requireAdmin);
  app.use('/api/meetings', requireAuth, requireAdmin);
  app.use('/api/teams', requireAuth, requireAdmin);
  app.use('/api/posts-notices', requireAuth, requireAdmin);

  // ============================================================================
  // FORMS & PUBLIC SUBMISSIONS
  // ============================================================================

  app.get(
    '/api/forms',
    asyncHandler(async (_req, res) => {
      const forms = await prisma.workspaceForm.findMany({
        include: { submissions: { orderBy: { timestampMs: 'desc' } } },
        orderBy: { timestampMs: 'desc' },
      });
      res.json({ forms: forms.map(toWorkspaceFormDto) });
    })
  );

  app.post(
    '/api/forms',
    asyncHandler(async (req, res) => {
      const {
        id,
        title,
        description,
        accentColor,
        isPublic,
        identityMode,
        targetSubmissions,
        autoCloseOnTarget,
        confirmationMessage,
        googleFormUri,
        fields,
      } = req.body || {};

      if (!title || !Array.isArray(fields)) {
        res.status(400).json({ error: 'Form title and fields are required.' });
        return;
      }

      const existing = id
        ? await prisma.workspaceForm.findUnique({ where: { id: String(id) } })
        : null;
      const formId =
        existing?.id || `form-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const createdAt =
        existing?.createdAt ||
        new Date().toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

      const saved = await prisma.workspaceForm.upsert({
        where: { id: formId },
        update: {
          title: String(title).trim(),
          description: String(description || '').trim(),
          accentColor: accentColor || '#673AB7',
          isPublic: Boolean(isPublic ?? true),
          identityMode: identityMode || 'OPTIONAL',
          targetSubmissions: Math.max(1, Number(targetSubmissions) || 50),
          autoCloseOnTarget: Boolean(autoCloseOnTarget ?? false),
          confirmationMessage:
            String(confirmationMessage || '').trim() ||
            'Thank you! Your response has been submitted successfully.',
          googleFormUri: googleFormUri || existing?.googleFormUri || null,
          fieldsJson: fields,
        },
        create: {
          id: formId,
          title: String(title).trim(),
          description: String(description || '').trim(),
          accentColor: accentColor || '#673AB7',
          isPublic: Boolean(isPublic ?? true),
          identityMode: identityMode || 'OPTIONAL',
          targetSubmissions: Math.max(1, Number(targetSubmissions) || 50),
          autoCloseOnTarget: Boolean(autoCloseOnTarget ?? false),
          confirmationMessage:
            String(confirmationMessage || '').trim() ||
            'Thank you! Your response has been submitted successfully.',
          googleFormUri: googleFormUri || null,
          fieldsJson: fields,
          createdAt,
          timestampMs: BigInt(Date.now()),
        },
        include: { submissions: { orderBy: { timestampMs: 'desc' } } },
      });

      const allForms = await prisma.workspaceForm.findMany({
        include: { submissions: { orderBy: { timestampMs: 'desc' } } },
        orderBy: { timestampMs: 'desc' },
      });

      res.json({
        form: toWorkspaceFormDto(saved),
        forms: allForms.map(toWorkspaceFormDto),
      });
    })
  );

  app.patch(
    '/api/forms/:id',
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      const existing = await prisma.workspaceForm.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ error: 'Form not found.' });
        return;
      }

      const patch = req.body || {};
      const updated = await prisma.workspaceForm.update({
        where: { id },
        data: {
          ...(typeof patch.isPublic === 'boolean' ? { isPublic: patch.isPublic } : {}),
          ...(typeof patch.targetSubmissions === 'number'
            ? { targetSubmissions: Math.max(1, patch.targetSubmissions) }
            : {}),
          ...(typeof patch.identityMode === 'string' ? { identityMode: patch.identityMode } : {}),
          ...(typeof patch.autoCloseOnTarget === 'boolean'
            ? { autoCloseOnTarget: patch.autoCloseOnTarget }
            : {}),
        },
        include: { submissions: { orderBy: { timestampMs: 'desc' } } },
      });

      const allForms = await prisma.workspaceForm.findMany({
        include: { submissions: { orderBy: { timestampMs: 'desc' } } },
        orderBy: { timestampMs: 'desc' },
      });

      res.json({
        form: toWorkspaceFormDto(updated),
        forms: allForms.map(toWorkspaceFormDto),
      });
    })
  );

  app.delete(
    '/api/forms/:id',
    asyncHandler(async (req, res) => {
      await prisma.workspaceForm.deleteMany({ where: { id: req.params.id } });
      const allForms = await prisma.workspaceForm.findMany({
        include: { submissions: { orderBy: { timestampMs: 'desc' } } },
        orderBy: { timestampMs: 'desc' },
      });
      res.json({ forms: allForms.map(toWorkspaceFormDto) });
    })
  );

  app.get(
    '/api/public-forms/:id',
    asyncHandler(async (req, res) => {
      const form = await prisma.workspaceForm.findUnique({
        where: { id: req.params.id },
        include: { _count: { select: { submissions: true } } },
      });
      if (!form) {
        res.status(404).json({ error: 'This form does not exist or has been removed.' });
        return;
      }

      const isTargetReached =
        form.autoCloseOnTarget && form._count.submissions >= form.targetSubmissions;
      if (!form.isPublic || isTargetReached) {
        res.status(403).json({
          error: isTargetReached
            ? 'This form has reached its maximum target number of submissions and is now closed.'
            : 'This form is currently private and not accepting public responses.',
          isClosed: true,
          title: form.title,
        });
        return;
      }

      res.json({
        form: {
          id: form.id,
          title: form.title,
          description: form.description || '',
          accentColor: form.accentColor,
          identityMode: form.identityMode,
          confirmationMessage: form.confirmationMessage || '',
          fields: Array.isArray(form.fieldsJson) ? form.fieldsJson : [],
        },
      });
    })
  );

  app.post(
    '/api/public-forms/:id/submit',
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      const { respondentName, respondentEmail, answers } = req.body || {};

      const outcome = await prisma.$transaction(async (tx) => {
        const form = await tx.workspaceForm.findUnique({
          where: { id },
          include: { _count: { select: { submissions: true } } },
        });
        if (!form) {
          return { status: 404 as const, error: 'Form not found.' };
        }
        if (!form.isPublic) {
          return { status: 403 as const, error: 'This form is currently closed for public submissions.' };
        }
        if (form.autoCloseOnTarget && form._count.submissions >= form.targetSubmissions) {
          return { status: 403 as const, error: 'Target submission limit has already been reached.' };
        }
        if (
          form.identityMode === 'REQUIRED' &&
          !String(respondentName || '').trim() &&
          !String(respondentEmail || '').trim()
        ) {
          return { status: 400 as const, error: 'Please provide your Name or Email to submit this form.' };
        }

        const subRow = await tx.formSubmission.create({
          data: {
            id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            formId: form.id,
            respondentName: String(respondentName || '').trim() || 'Anonymous Respondent',
            respondentEmail: String(respondentEmail || '').trim() || 'Not provided',
            submittedAt: new Date().toLocaleString([], {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            }),
            timestampMs: BigInt(Date.now()),
            answersJson: answers || {},
          },
        });

        await queueAdminSubmission('form', subRow.id, form.title, tx);
        return { status: 200 as const, form, submission: toFormSubmissionDto(subRow) };
      });

      if (outcome.status !== 200) {
        res.status(outcome.status).json({ error: outcome.error });
        return;
      }

      broadcastRealtimeEvent('form:submitted', {
        formId: outcome.form.id,
        formTitle: outcome.form.title,
        submission: outcome.submission,
      });

      await recordAndBroadcastNotification({
        type: 'form_submitted',
        title: `New Form Response: ${outcome.form.title}`,
        description: `Submitted by ${outcome.submission.respondentName} (${outcome.submission.respondentEmail})`,
        module: 'forms',
        targetId: outcome.form.id,
      });

      res.json({
        ok: true,
        confirmationMessage: outcome.form.confirmationMessage || '',
        submission: outcome.submission,
      });
    })
  );

  // ============================================================================
  // WORKSPACE DOCS
  // ============================================================================

  app.get(
    '/api/docs',
    asyncHandler(async (_req, res) => {
      const rows = await prisma.workspaceDoc.findMany({ orderBy: { timestampMs: 'desc' } });
      res.json({ docs: rows.map(toWorkspaceDocDto) });
    })
  );

  app.post(
    '/api/docs',
    asyncHandler(async (req, res) => {
      await ensureWorkspaceBootstrap();
      const { id, title, category, bodyText, htmlContent, googleDocId, googleDocUrl } = req.body || {};
      if (!title || !String(title).trim()) {
        res.status(400).json({ error: 'Document title is required.' });
        return;
      }

      const textContent = String(bodyText || '');
      const words = textContent.trim() ? textContent.trim().split(/\s+/).length : 0;
      const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const nowDate = new Date().toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      const docId =
        id ? String(id) : `doc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const existing = id ? await prisma.workspaceDoc.findUnique({ where: { id: docId } }) : null;
      const prevExtra =
        existing?.extraFields && typeof existing.extraFields === 'object'
          ? (existing.extraFields as Record<string, any>)
          : {};
      const nextExtra =
        htmlContent !== undefined
          ? { ...prevExtra, htmlContent: String(htmlContent) }
          : prevExtra;

      const result = await prisma.$transaction(async (tx) => {
        const docRow = await tx.workspaceDoc.upsert({
          where: { id: docId },
          update: {
            title: String(title).trim(),
            category: String(category || 'General').trim(),
            bodyText: textContent,
            googleDocId: googleDocId ?? existing?.googleDocId ?? null,
            googleDocUrl: googleDocUrl ?? existing?.googleDocUrl ?? null,
            wordCount: words,
            updatedAt: nowTime,
            timestampMs: BigInt(Date.now()),
            extraFields: nextExtra,
          },
          create: {
            id: docId,
            title: String(title).trim(),
            category: String(category || 'General').trim(),
            bodyText: textContent,
            googleDocId: googleDocId || null,
            googleDocUrl: googleDocUrl || null,
            wordCount: words,
            createdAt: nowDate,
            updatedAt: nowTime,
            timestampMs: BigInt(Date.now()),
            extraFields: nextExtra,
          },
        });

        await syncWorkspaceDocFileInTx(tx, docRow);
        const refreshed = await tx.workspaceDoc.findUniqueOrThrow({ where: { id: docId } });
        const allDocs = await tx.workspaceDoc.findMany({ orderBy: { timestampMs: 'desc' } });
        const allFiles = await tx.workspaceFile.findMany({
          where: { deletedAt: null },
          orderBy: { timestampMs: 'desc' },
        });
        return { refreshed, allDocs, allFiles };
      });

      res.json({
        doc: toWorkspaceDocDto(result.refreshed),
        docs: result.allDocs.map(toWorkspaceDocDto),
        files: result.allFiles.map(toWorkspaceFileDto),
      });
    })
  );

  app.delete(
    '/api/docs/:id',
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      await prisma.$transaction(async (tx) => {
        await tx.workspaceDoc.deleteMany({ where: { id } });
        await tx.workspaceFile.deleteMany({ where: { docId: id } });
      });
      const [docs, files] = await Promise.all([
        prisma.workspaceDoc.findMany({ orderBy: { timestampMs: 'desc' } }),
        prisma.workspaceFile.findMany({ orderBy: { timestampMs: 'desc' } }),
      ]);
      res.json({ docs: docs.map(toWorkspaceDocDto), files: files.map(toWorkspaceFileDto) });
    })
  );

  // ============================================================================
  // WORKSPACE SLIDES
  // ============================================================================

  app.get(
    '/api/slides',
    asyncHandler(async (_req, res) => {
      const [slides, files] = await Promise.all([
        prisma.workspaceSlide.findMany({ orderBy: { timestampMs: 'desc' } }),
        prisma.workspaceFile.findMany({ orderBy: { timestampMs: 'desc' } }),
      ]);
      res.json({
        slides: slides.map(toWorkspaceSlideDto),
        files: files.map(toWorkspaceFileDto),
      });
    })
  );

  app.post(
    '/api/slides',
    asyncHandler(async (req, res) => {
      await ensureWorkspaceBootstrap();
      const { id, title, subtitle, category, themeColor, authorName, pages } = req.body || {};
      if (!title || !String(title).trim()) {
        res.status(400).json({ error: 'Presentation title is required.' });
        return;
      }

      const admin = await getPrimaryAdminIdentity();
      const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const nowDate = new Date().toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      const normalizedPages =
        Array.isArray(pages) && pages.length > 0
          ? pages.map((p: any, idx: number) => {
              const basePage: any = {
                id: String(p.id || `sp-${Date.now()}-${idx + 1}`),
                slideNumber: idx + 1,
                layout:
                  p.layout === 'TITLE_COVER' ||
                  p.layout === 'BULLETS_AND_INSIGHTS' ||
                  p.layout === 'SPLIT_IMAGE' ||
                  p.layout === 'METRICS_GRID' ||
                  p.layout === 'EXECUTIVE_SUMMARY' ||
                  p.layout === 'FREEFORM_CANVAS'
                    ? p.layout
                    : idx === 0
                    ? 'TITLE_COVER'
                    : 'BULLETS_AND_INSIGHTS',
                title: String(p.title || `Slide ${idx + 1}`).trim(),
                subtitle: String(p.subtitle || '').trim(),
                bullets: Array.isArray(p.bullets)
                  ? p.bullets.map((b: any) => String(b)).filter((b: string) => b.trim().length > 0)
                  : [],
                speakerNotes: String(p.speakerNotes || '').trim(),
                imageUrl: p.imageUrl ? String(p.imageUrl).trim() : undefined,
                accentColor: p.accentColor ? String(p.accentColor) : undefined,
                bgColor: p.bgColor ? String(p.bgColor) : undefined,
                bgGradient: p.bgGradient ? String(p.bgGradient) : undefined,
                transition: p.transition || 'none',
                elements: Array.isArray(p.elements) ? p.elements : undefined,
              };
              if (!basePage.elements || basePage.elements.length === 0) {
                basePage.elements = ensureVisualSlideElements(basePage, String(themeColor || '#D97706'));
              }
              return basePage;
            })
          : [
              {
                id: `sp-${Date.now()}-1`,
                slideNumber: 1,
                layout: 'TITLE_COVER',
                title: String(title).trim(),
                subtitle: String(subtitle || 'Executive Presentation').trim(),
                bullets: ['Key objective and overview'],
                speakerNotes: '',
                elements: ensureVisualSlideElements(
                  {
                    id: `sp-${Date.now()}-1`,
                    slideNumber: 1,
                    layout: 'TITLE_COVER',
                    title: String(title).trim(),
                    subtitle: String(subtitle || 'Executive Presentation').trim(),
                    bullets: ['Key objective and overview'],
                    speakerNotes: '',
                  },
                  String(themeColor || '#D97706')
                ),
              },
            ];

      const slideId =
        id ? String(id) : `slide-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

      const result = await prisma.$transaction(async (tx) => {
        const deckRow = await tx.workspaceSlide.upsert({
          where: { id: slideId },
          update: {
            title: String(title).trim(),
            subtitle: String(subtitle || '').trim(),
            category: String(category || 'Presentations').trim(),
            themeColor: String(themeColor || '#D97706'),
            authorName: String(authorName || admin.name).trim(),
            pagesJson: normalizedPages,
            slideCount: normalizedPages.length,
            updatedAt: nowTime,
            timestampMs: BigInt(Date.now()),
          },
          create: {
            id: slideId,
            title: String(title).trim(),
            subtitle: String(subtitle || '').trim(),
            category: String(category || 'Presentations').trim(),
            themeColor: String(themeColor || '#D97706'),
            authorName: String(authorName || admin.name).trim(),
            pagesJson: normalizedPages,
            slideCount: normalizedPages.length,
            createdAt: nowDate,
            updatedAt: nowTime,
            timestampMs: BigInt(Date.now()),
          },
        });

        const syncedFile = await syncSlideDeckFileInTx(tx, deckRow);
        const refreshed = await tx.workspaceSlide.findUniqueOrThrow({ where: { id: slideId } });
        const allSlides = await tx.workspaceSlide.findMany({ orderBy: { timestampMs: 'desc' } });
        const allFiles = await tx.workspaceFile.findMany({ orderBy: { timestampMs: 'desc' } });
        return { refreshed, syncedFile, allSlides, allFiles };
      });

      res.json({
        slide: toWorkspaceSlideDto(result.refreshed),
        slides: result.allSlides.map(toWorkspaceSlideDto),
        file: toWorkspaceFileDto(result.syncedFile),
        files: result.allFiles.map(toWorkspaceFileDto),
      });
    })
  );

  app.delete(
    '/api/slides/:id',
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      await prisma.$transaction(async (tx) => {
        await tx.workspaceSlide.deleteMany({ where: { id } });
        await tx.workspaceFile.deleteMany({ where: { slideDeckId: id } });
      });
      const [slides, files] = await Promise.all([
        prisma.workspaceSlide.findMany({ orderBy: { timestampMs: 'desc' } }),
        prisma.workspaceFile.findMany({ orderBy: { timestampMs: 'desc' } }),
      ]);
      res.json({
        slides: slides.map(toWorkspaceSlideDto),
        files: files.map(toWorkspaceFileDto),
      });
    })
  );

  // ============================================================================
  // MEETINGS
  // ============================================================================

  app.get(
    '/api/meetings',
    asyncHandler(async (_req, res) => {
      const rows = await prisma.workspaceMeeting.findMany({ orderBy: { timestampMs: 'desc' } });
      res.json({ meetings: rows.map(toWorkspaceMeetingDto) });
    })
  );

  app.post(
    '/api/meetings',
    asyncHandler(async (req, res) => {
      const {
        id,
        title,
        agenda,
        meetingCode,
        meetingUri,
        scheduledFor,
        durationMins,
        hostEmail,
        status,
      } = req.body || {};

      if (!title || !String(title).trim()) {
        res.status(400).json({ error: 'Meeting title is required.' });
        return;
      }

      const generatedCode =
        String(meetingCode || '').trim() ||
        `${Math.random().toString(36).slice(2, 5)}-${Math.random()
          .toString(36)
          .slice(2, 6)}-${Math.random().toString(36).slice(2, 5)}`;
      const resolvedUri =
        String(meetingUri || '').trim() || `https://meet.google.com/${generatedCode}`;
      const meetId =
        id ? String(id) : `meet-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const nowDate = new Date().toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      const saved = await prisma.workspaceMeeting.upsert({
        where: { id: meetId },
        update: {
          title: String(title).trim(),
          agenda: String(agenda || '').trim(),
          meetingCode: generatedCode,
          meetingUri: resolvedUri,
          scheduledFor: String(scheduledFor || 'Instant Meeting').trim(),
          durationMins: Number(durationMins) || 30,
          hostEmail: hostEmail ? String(hostEmail).trim() : null,
          status: status || 'Active',
          timestampMs: BigInt(Date.now()),
        },
        create: {
          id: meetId,
          title: String(title).trim(),
          agenda: String(agenda || '').trim(),
          meetingCode: generatedCode,
          meetingUri: resolvedUri,
          scheduledFor: String(scheduledFor || 'Instant Meeting').trim(),
          durationMins: Number(durationMins) || 30,
          hostEmail: hostEmail ? String(hostEmail).trim() : null,
          status: status || 'Active',
          createdAt: nowDate,
          timestampMs: BigInt(Date.now()),
        },
      });

      const all = await prisma.workspaceMeeting.findMany({ orderBy: { timestampMs: 'desc' } });
      res.json({
        meeting: toWorkspaceMeetingDto(saved),
        meetings: all.map(toWorkspaceMeetingDto),
      });
    })
  );

  app.delete(
    '/api/meetings/:id',
    asyncHandler(async (req, res) => {
      await prisma.workspaceMeeting.deleteMany({ where: { id: req.params.id } });
      const all = await prisma.workspaceMeeting.findMany({ orderBy: { timestampMs: 'desc' } });
      res.json({ meetings: all.map(toWorkspaceMeetingDto) });
    })
  );

  // ============================================================================
  // TEAMS & MEMBERS
  // ============================================================================

  app.get(
    '/api/teams/members',
    asyncHandler(async (_req, res) => {
      const [members, groups] = await Promise.all([
        prisma.workspaceMember.findMany({ orderBy: { timestampMs: 'desc' } }),
        prisma.workspaceTeamGroup.findMany({ orderBy: { timestampMs: 'asc' } }),
      ]);
      res.json({
        members: members.map(toWorkspaceMemberDto),
        groups: groups.map(toWorkspaceTeamGroupDto),
      });
    })
  );

  app.post(
    '/api/teams/members',
    asyncHandler(async (req, res) => {
      const {
        id,
        firstName,
        lastName,
        email,
        designation,
        teamId,
        teamName,
        phone,
        bio,
        avatarUrl,
        status,
      } = req.body || {};

      if (!firstName || !email || !designation) {
        res.status(400).json({ error: 'First Name, Email, and Designation are required.' });
        return;
      }

      const fName = String(firstName).trim();
      const lName = String(lastName || '').trim();
      const fullName = `${fName} ${lName}`.trim();
      const cleanEmail = String(email).trim().toLowerCase();

      const matchedGroup =
        teamId || teamName
          ? await prisma.workspaceTeamGroup.findFirst({
              where: {
                OR: [
                  ...(teamId ? [{ id: String(teamId) }] : []),
                  ...(teamName ? [{ name: String(teamName) }] : []),
                ],
              },
            })
          : null;

      const resolvedTeamId = matchedGroup ? matchedGroup.id : String(teamId || 'team-exec');
      const resolvedTeamName = matchedGroup
        ? matchedGroup.name
        : String(teamName || 'Executive Leadership');

      const memberId =
        id ? String(id) : `mem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const existing = id ? await prisma.workspaceMember.findUnique({ where: { id: memberId } }) : null;

      const saved = await prisma.workspaceMember.upsert({
        where: { id: memberId },
        update: {
          firstName: fName,
          lastName: lName,
          fullName,
          email: cleanEmail,
          designation: String(designation).trim(),
          teamId: resolvedTeamId,
          teamName: resolvedTeamName,
          phone: phone ? String(phone).trim() : null,
          bio: bio ? String(bio).trim() : null,
          ...(avatarUrl !== undefined ? { avatarUrl: avatarUrl || null } : {}),
          status: status || existing?.status || 'Active',
          timestampMs: BigInt(Date.now()),
        },
        create: {
          id: memberId,
          firstName: fName,
          lastName: lName,
          fullName,
          email: cleanEmail,
          designation: String(designation).trim(),
          teamId: resolvedTeamId,
          teamName: resolvedTeamName,
          phone: phone ? String(phone).trim() : null,
          bio: bio ? String(bio).trim() : null,
          avatarUrl: avatarUrl || null,
          status: status || 'Active',
          inviteToken: `inv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
          joinedAt: new Date().toLocaleDateString([], {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
          timestampMs: BigInt(Date.now()),
        },
      });

      await syncWorkspaceUsersToMembers();
      broadcastRealtimeEvent('members:updated', { memberId: saved.id, ts: Date.now() });

      const all = await prisma.workspaceMember.findMany({ orderBy: { timestampMs: 'desc' } });
      res.json({
        member: toWorkspaceMemberDto(saved),
        members: all.map(toWorkspaceMemberDto),
      });
    })
  );

  app.delete(
    '/api/teams/members/:id',
    asyncHandler(async (req, res) => {
      const targetMem = await prisma.workspaceMember.findUnique({ where: { id: req.params.id } });
      if (targetMem) {
        await prisma.workspaceUser
          .updateMany({
            where: {
              OR: [{ memberId: targetMem.id }, { email: targetMem.email }],
              NOT: { role: 'OWNER' },
            },
            data: { role: 'USER', memberId: null },
          })
          .catch(() => {});
      }
      await prisma.workspaceMember.deleteMany({ where: { id: req.params.id } });
      broadcastRealtimeEvent('members:updated', { deletedId: req.params.id, ts: Date.now() });
      const all = await prisma.workspaceMember.findMany({ orderBy: { timestampMs: 'desc' } });
      res.json({ members: all.map(toWorkspaceMemberDto) });
    })
  );

  app.post(
    '/api/teams/members/:id/send-invite',
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      const { inviteUrl, serverAccountId } = req.body || {};

      const member = await prisma.workspaceMember.findUnique({ where: { id } });
      if (!member) {
        res.status(404).json({ error: 'Member not found.' });
        return;
      }

      const resolvedLink =
        inviteUrl || `https://workspace.local/?invite=${encodeURIComponent(member.id)}`;

      const targetServerAcc = serverAccountId
        ? await prisma.serverMailAccount.findUnique({ where: { id: String(serverAccountId) } })
        : await prisma.serverMailAccount.findFirst();

      let sentViaServerSmtp = false;
      let smtpWarning: string | undefined;

      if (targetServerAcc) {
        try {
          const pass = decryptSecret(targetServerAcc.encryptedPassword);
          const transporter = nodemailer.createTransport({
            host: targetServerAcc.smtpHost,
            port: targetServerAcc.smtpPort,
            secure: targetServerAcc.smtpSecure,
            auth: { user: targetServerAcc.username, pass },
            connectionTimeout: 10000,
            tls: { rejectUnauthorized: false },
          });

          const subject = `Workspace Invitation: ${member.fullName} (${member.designation} — ${member.teamName || 'Team'})`;
          const html = `
            <div style="max-width:580px;margin:0 auto;padding:24px;font-family:sans-serif;border:1px solid #e2e8f0;border-radius:16px;">
              <h2 style="margin:0 0 12px 0;color:#0f172a;">You're Invited to Workspace Pro</h2>
              <p style="font-size:14px;color:#334155;line-height:1.6;">
                Hello <strong>${member.fullName}</strong>,
              </p>
              <p style="font-size:14px;color:#334155;line-height:1.6;">
                You have been added to <strong>${member.teamName || 'Workspace'}</strong> as <strong>${member.designation}</strong>.
              </p>
              <div style="margin:24px 0;">
                <a href="${resolvedLink}" style="display:inline-block;padding:12px 24px;background:#0B57D0;color:#ffffff;text-decoration:none;border-radius:999px;font-weight:600;font-size:14px;">
                  View My Member Profile
                </a>
              </div>
              <p style="font-size:12px;color:#64748b;">Or open this link directly: <a href="${resolvedLink}">${resolvedLink}</a></p>
            </div>
          `;

          await transporter.sendMail({
            from: `"${targetServerAcc.label}" <${targetServerAcc.email}>`,
            to: member.email,
            subject,
            text: `Hello ${member.fullName},\n\nYou have been invited to ${member.teamName} as ${member.designation}.\nView your profile: ${resolvedLink}`,
            html,
          });
          sentViaServerSmtp = true;
        } catch (err: any) {
          smtpWarning = err?.message;
        }
      }

      const nowTime = new Date().toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const updatedMember = await prisma.workspaceMember.update({
        where: { id: member.id },
        data: { inviteSentAt: nowTime },
      });

      await recordAndBroadcastNotification({
        type: 'mail_sent',
        title: `Invitation Sent to ${member.fullName}`,
        description: `${member.email} · ${member.designation} (${member.teamName || 'Team'})`,
        module: 'teams',
        targetId: member.id,
      });

      const allMembers = await prisma.workspaceMember.findMany({ orderBy: { timestampMs: 'desc' } });
      res.json({
        ok: true,
        sentViaServerSmtp,
        smtpWarning,
        member: toWorkspaceMemberDto(updatedMember),
        members: allMembers.map(toWorkspaceMemberDto),
      });
    })
  );

  app.get(
    '/api/teams/groups',
    asyncHandler(async (_req, res) => {
      const groups = await prisma.workspaceTeamGroup.findMany({ orderBy: { timestampMs: 'asc' } });
      res.json({ groups: groups.map(toWorkspaceTeamGroupDto) });
    })
  );

  app.post(
    '/api/teams/groups',
    asyncHandler(async (req, res) => {
      const { id, name, description, color } = req.body || {};
      if (!name || !String(name).trim()) {
        res.status(400).json({ error: 'Team group name is required.' });
        return;
      }

      const cleanName = String(name).trim();
      const groupId =
        id ? String(id) : `team-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const nowDate = new Date().toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      const result = await prisma.$transaction(async (tx) => {
        const groupRow = await tx.workspaceTeamGroup.upsert({
          where: { id: groupId },
          update: {
            name: cleanName,
            description: String(description || '').trim(),
            color: String(color || '#0B57D0'),
            timestampMs: BigInt(Date.now()),
          },
          create: {
            id: groupId,
            name: cleanName,
            description: String(description || '').trim(),
            color: String(color || '#0B57D0'),
            createdAt: nowDate,
            timestampMs: BigInt(Date.now()),
          },
        });
        await tx.workspaceMember.updateMany({
          where: { teamId: groupId },
          data: { teamName: cleanName },
        });
        const [groups, members] = await Promise.all([
          tx.workspaceTeamGroup.findMany({ orderBy: { timestampMs: 'asc' } }),
          tx.workspaceMember.findMany({ orderBy: { timestampMs: 'desc' } }),
        ]);
        return { groupRow, groups, members };
      });

      broadcastRealtimeEvent('members:updated', { groupId: result.groupRow.id, ts: Date.now() });

      res.json({
        group: toWorkspaceTeamGroupDto(result.groupRow),
        groups: result.groups.map(toWorkspaceTeamGroupDto),
        members: result.members.map(toWorkspaceMemberDto),
      });
    })
  );

  app.delete(
    '/api/teams/groups/:id',
    asyncHandler(async (req, res) => {
      await prisma.workspaceTeamGroup.deleteMany({ where: { id: req.params.id } });
      broadcastRealtimeEvent('members:updated', { deletedGroupId: req.params.id, ts: Date.now() });
      const groups = await prisma.workspaceTeamGroup.findMany({ orderBy: { timestampMs: 'asc' } });
      res.json({ groups: groups.map(toWorkspaceTeamGroupDto) });
    })
  );

  app.get(
    '/api/public-invite/:id',
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      const member = await prisma.workspaceMember.findFirst({
        where: { OR: [{ id }, { inviteToken: id }] },
      });
      if (!member) {
        res.status(404).json({ error: 'Invitation link is invalid or member profile was removed.' });
        return;
      }

      const [group, peers] = await Promise.all([
        member.teamId
          ? prisma.workspaceTeamGroup.findUnique({ where: { id: member.teamId } })
          : null,
        member.teamId
          ? prisma.workspaceMember.findMany({
              where: { teamId: member.teamId, NOT: { id: member.id } },
              select: { id: true, fullName: true, designation: true, avatarUrl: true },
            })
          : [],
      ]);

      res.json({
        member: toWorkspaceMemberDto(member),
        group: group
          ? toWorkspaceTeamGroupDto(group)
          : {
              id: member.teamId || '',
              name: member.teamName || 'Workspace Team',
              description: 'Official Workspace Team',
              color: '#0B57D0',
            },
        teamPeers: peers.map((p) => ({
          id: p.id,
          fullName: p.fullName,
          designation: p.designation,
          avatarUrl: p.avatarUrl || undefined,
        })),
      });
    })
  );

  app.post(
    '/api/public-invite/:id/accept',
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      const { bio, phone } = req.body || {};
      const existing = await prisma.workspaceMember.findFirst({
        where: { OR: [{ id }, { inviteToken: id }] },
      });
      if (!existing) {
        res.status(404).json({ error: 'Member profile not found.' });
        return;
      }
      const updated = await prisma.workspaceMember.update({
        where: { id: existing.id },
        data: {
          status: 'Active',
          ...(bio !== undefined ? { bio: String(bio).trim() } : {}),
          ...(phone !== undefined ? { phone: String(phone).trim() } : {}),
        },
      });
      res.json({ ok: true, member: toWorkspaceMemberDto(updated) });
    })
  );

  // ============================================================================
  // POSTS & NOTICES
  // ============================================================================

  app.get(
    '/api/posts-notices',
    asyncHandler(async (_req, res) => {
      const nowMs = Date.now();
      const [rows, categories] = await Promise.all([
        prisma.workspacePostNotice.findMany({ orderBy: { timestampMs: 'desc' } }),
        prisma.workspacePostCategory.findMany({ orderBy: { id: 'asc' } }),
      ]);

      const expiredIds: string[] = [];
      const items = rows.map((row) => {
        if (row.isPinned && row.pinnedUntil && row.pinnedUntil.trim()) {
          const expiryMs = new Date(row.pinnedUntil).getTime();
          if (!Number.isNaN(expiryMs) && expiryMs < nowMs) {
            expiredIds.push(row.id);
            return toWorkspacePostNoticeDto({ ...row, isPinned: false });
          }
        }
        return toWorkspacePostNoticeDto(row);
      });

      if (expiredIds.length > 0) {
        await prisma.workspacePostNotice.updateMany({
          where: { id: { in: expiredIds } },
          data: { isPinned: false },
        });
      }

      res.json({
        postsNotices: items,
        categories: categories.map(toWorkspacePostCategoryDto),
      });
    })
  );

  app.post(
    '/api/posts-notices',
    asyncHandler(async (req, res) => {
      await ensureWorkspaceBootstrap();
      const {
        id,
        type,
        title,
        summary,
        content,
        categoryId,
        categoryName,
        authorName,
        authorRole,
        coverImageUrl,
        attachments,
        isPinned,
        pinnedUntil,
        priority,
      } = req.body || {};

      if (!title || !String(title).trim() || !content || !String(content).trim()) {
        res.status(400).json({ error: 'Title and content are required.' });
        return;
      }

      const admin = await getPrimaryAdminIdentity();
      const matchedCat =
        categoryId || categoryName
          ? await prisma.workspacePostCategory.findFirst({
              where: {
                OR: [
                  ...(categoryId ? [{ id: String(categoryId) }] : []),
                  ...(categoryName ? [{ name: String(categoryName) }] : []),
                ],
              },
            })
          : null;

      const postId =
        id ? String(id) : `pn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const existing = id ? await prisma.workspacePostNotice.findUnique({ where: { id: postId } }) : null;
      const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const nowDate = new Date().toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      const resolvedSummary =
        String(summary || '').trim() ||
        String(content).replace(/\s+/g, ' ').trim().slice(0, 160);

      const saved = await prisma.workspacePostNotice.upsert({
        where: { id: postId },
        update: {
          type: type === 'NOTICE' ? 'NOTICE' : 'POST',
          title: String(title).trim(),
          summary: resolvedSummary,
          content: String(content),
          categoryId: matchedCat ? matchedCat.id : String(categoryId || 'cat-general'),
          categoryName: matchedCat ? matchedCat.name : String(categoryName || 'General Update'),
          authorName: String(authorName || admin.name).trim(),
          authorRole: String(authorRole || 'Administrator').trim(),
          coverImageUrl: coverImageUrl ? String(coverImageUrl).trim() : null,
          attachmentsJson: Array.isArray(attachments) ? attachments : [],
          isPinned: Boolean(isPinned ?? false),
          pinnedUntil: pinnedUntil ? String(pinnedUntil).trim() : '',
          priority: priority === 'Urgent' || priority === 'Important' ? priority : 'Normal',
          updatedAt: nowTime,
        },
        create: {
          id: postId,
          type: type === 'NOTICE' ? 'NOTICE' : 'POST',
          title: String(title).trim(),
          summary: resolvedSummary,
          content: String(content),
          categoryId: matchedCat ? matchedCat.id : String(categoryId || 'cat-general'),
          categoryName: matchedCat ? matchedCat.name : String(categoryName || 'General Update'),
          authorName: String(authorName || admin.name).trim(),
          authorRole: String(authorRole || 'Administrator').trim(),
          coverImageUrl: coverImageUrl ? String(coverImageUrl).trim() : null,
          attachmentsJson: Array.isArray(attachments) ? attachments : [],
          isPinned: Boolean(isPinned ?? false),
          pinnedUntil: pinnedUntil ? String(pinnedUntil).trim() : '',
          priority: priority === 'Urgent' || priority === 'Important' ? priority : 'Normal',
          viewsCount: existing?.viewsCount || 1,
          createdAt: nowDate,
          updatedAt: nowTime,
          timestampMs: BigInt(Date.now()),
        },
      });

      const all = await prisma.workspacePostNotice.findMany({ orderBy: { timestampMs: 'desc' } });
      res.json({
        item: toWorkspacePostNoticeDto(saved),
        postsNotices: all.map(toWorkspacePostNoticeDto),
      });
    })
  );

  app.post(
    '/api/posts-notices/:id/email',
    asyncHandler(async (req, res) => {
      const post = await prisma.workspacePostNotice.findUnique({ where: { id: req.params.id } });
      if (!post || post.type !== 'NOTICE' || post.status !== 'PUBLISHED') {
        res.status(404).json({ error: 'Published notice not found.' }); return;
      }
      const ids = Array.isArray(req.body?.memberIds) ? [...new Set<string>(req.body.memberIds.filter((id: unknown) => typeof id === 'string'))] : [];
      if (!ids.length || ids.length > 200) {
        res.status(400).json({ error: 'Select between 1 and 200 members.' }); return;
      }
      const members = await prisma.workspaceMember.findMany({ where: { id: { in: ids } }, select: { email: true } });
      const recipients = members.map((member) => normalizeMailAddress(member.email)).filter(Boolean);
      if (!recipients.length) {
        res.status(400).json({ error: 'Selected members have no valid email addresses.' }); return;
      }
      const queued = await queueWorkspaceMail('notice:' + post.id, recipients,
        'Notice: ' + post.title, 'A notice has been shared with you. Sign in to Workspace Pro to read it.');
      res.status(202).json({ queued });
    })
  );

  app.patch(
    '/api/posts-notices/:id/pin',
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      const { isPinned, pinnedUntil } = req.body || {};
      const existing = await prisma.workspacePostNotice.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ error: 'Post or Notice not found.' });
        return;
      }

      const updated = await prisma.workspacePostNotice.update({
        where: { id },
        data: {
          isPinned: typeof isPinned === 'boolean' ? isPinned : !existing.isPinned,
          ...(pinnedUntil !== undefined ? { pinnedUntil: String(pinnedUntil) } : {}),
        },
      });
      const all = await prisma.workspacePostNotice.findMany({ orderBy: { timestampMs: 'desc' } });
      res.json({
        item: toWorkspacePostNoticeDto(updated),
        postsNotices: all.map(toWorkspacePostNoticeDto),
      });
    })
  );

  app.delete(
    '/api/posts-notices/:id',
    asyncHandler(async (req, res) => {
      await prisma.workspacePostNotice.deleteMany({ where: { id: req.params.id } });
      const all = await prisma.workspacePostNotice.findMany({ orderBy: { timestampMs: 'desc' } });
      res.json({ postsNotices: all.map(toWorkspacePostNoticeDto) });
    })
  );

  app.get(
    '/api/posts-notices/categories',
    asyncHandler(async (_req, res) => {
      const cats = await prisma.workspacePostCategory.findMany({ orderBy: { id: 'asc' } });
      res.json({ categories: cats.map(toWorkspacePostCategoryDto) });
    })
  );

  app.post(
    '/api/posts-notices/categories',
    asyncHandler(async (req, res) => {
      const { id, name, color, description } = req.body || {};
      if (!name || !String(name).trim()) {
        res.status(400).json({ error: 'Category name is required.' });
        return;
      }

      const cleanName = String(name).trim();
      const slug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const catId =
        id ? String(id) : `cat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
      const nowDate = new Date().toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      const result = await prisma.$transaction(async (tx) => {
        const catRow = await tx.workspacePostCategory.upsert({
          where: { id: catId },
          update: {
            name: cleanName,
            slug,
            color: String(color || '#0B57D0'),
            description: String(description || '').trim(),
          },
          create: {
            id: catId,
            name: cleanName,
            slug,
            color: String(color || '#0B57D0'),
            description: String(description || '').trim(),
            createdAt: nowDate,
          },
        });
        await tx.workspacePostNotice.updateMany({
          where: { categoryId: catId },
          data: { categoryName: cleanName },
        });
        const [categories, posts] = await Promise.all([
          tx.workspacePostCategory.findMany({ orderBy: { id: 'asc' } }),
          tx.workspacePostNotice.findMany({ orderBy: { timestampMs: 'desc' } }),
        ]);
        return { catRow, categories, posts };
      });

      res.json({
        category: toWorkspacePostCategoryDto(result.catRow),
        categories: result.categories.map(toWorkspacePostCategoryDto),
        postsNotices: result.posts.map(toWorkspacePostNoticeDto),
      });
    })
  );

  app.delete(
    '/api/posts-notices/categories/:id',
    asyncHandler(async (req, res) => {
      await prisma.workspacePostCategory.deleteMany({ where: { id: req.params.id } });
      const categories = await prisma.workspacePostCategory.findMany({ orderBy: { id: 'asc' } });
      res.json({ categories: categories.map(toWorkspacePostCategoryDto) });
    })
  );

  // ============================================================================
  // ISOLATED EXECUTIVE RESUME BUILDER & CORPORATE WEBSITE STUDIO ENGINE
  // ============================================================================

  async function resolveActiveUser(req: express.Request) {
    const currentUserId = req.auth?.user?.id;
    if (!currentUserId) return null;
    return prisma.workspaceUser.findUnique({ where: { id: currentUserId } });
  }

  function isOwnMemberRecord(req: express.Request, member: { id: string; email: string }) {
    if (!req.auth) return false;
    return (
      (Boolean(req.auth.user.memberId) && req.auth.user.memberId === member.id) ||
      req.auth.user.email.toLowerCase() === String(member.email || '').toLowerCase()
    );
  }

  function canViewMemberProfile(req: express.Request, member: { id: string; email: string }) {
    if (!req.auth) return false;
    return (
      req.auth.capabilities.isAdmin ||
      isOwnMemberRecord(req, member) ||
      hasModuleCapability(req.auth.capabilities, 'teams')
    );
  }

  function canEditMemberProfile(req: express.Request, member: { id: string; email: string }) {
    if (!req.auth) return false;
    return req.auth.capabilities.isAdmin || isOwnMemberRecord(req, member);
  }

  async function upsertIsolatedResumeRow(params: {
    ownerKey: string;
    userId?: string | null;
    memberId?: string | null;
    email: string;
    resume: ResumeProfileData;
  }) {
    const nowLabel = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const nowMs = BigInt(Date.now());
    const r = params.resume;
    return prisma.workspaceResumeProfile.upsert({
      where: { ownerKey: params.ownerKey },
      update: {
        userId: params.userId || null,
        memberId: params.memberId || null,
        email: params.email,
        fullName: r.header.fullName,
        professionalTitle: r.header.professionalTitle,
        executiveSummary: r.header.executiveSummary,
        avatarUrl: r.header.avatarUrl || null,
        coverImageUrl: r.header.coverImageUrl || null,
        verifiedBadge: Boolean(r.header.verifiedBadge),
        statusText: r.header.statusText || null,
        contactJson: r.contact as any,
        experienceJson: r.experience as any,
        educationJson: r.education as any,
        skillsJson: r.skills as any,
        projectsJson: r.projects as any,
        certificationsJson: r.certifications as any,
        customSectionsJson: (r.customSections || []) as any,
        settingsJson: r.settings as any,
        updatedAt: nowLabel,
        timestampMs: nowMs,
      },
      create: {
        id: `res-${params.ownerKey.replace(/[^a-zA-Z0-9_-]/g, '-')}`,
        ownerKey: params.ownerKey,
        userId: params.userId || null,
        memberId: params.memberId || null,
        email: params.email,
        fullName: r.header.fullName,
        professionalTitle: r.header.professionalTitle,
        executiveSummary: r.header.executiveSummary,
        avatarUrl: r.header.avatarUrl || null,
        coverImageUrl: r.header.coverImageUrl || null,
        verifiedBadge: Boolean(r.header.verifiedBadge),
        statusText: r.header.statusText || null,
        contactJson: r.contact as any,
        experienceJson: r.experience as any,
        educationJson: r.education as any,
        skillsJson: r.skills as any,
        projectsJson: r.projects as any,
        certificationsJson: r.certifications as any,
        customSectionsJson: (r.customSections || []) as any,
        settingsJson: r.settings as any,
        updatedAt: nowLabel,
        timestampMs: nowMs,
      },
    });
  }

  async function upsertIsolatedCorporateRow(params: {
    ownerKey: string;
    userId?: string | null;
    memberId?: string | null;
    email: string;
    corporate: CorporateOrgProfileData;
  }) {
    const nowLabel = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const nowMs = BigInt(Date.now());
    const c = params.corporate;
    return prisma.workspaceCorporateWebsite.upsert({
      where: { ownerKey: params.ownerKey },
      update: {
        userId: params.userId || null,
        memberId: params.memberId || null,
        email: params.email,
        orgName: c.branding.name,
        tagline: c.branding.tagline,
        logoUrl: c.branding.logoUrl || null,
        brandingJson: c.branding as any,
        heroSliderJson: c.heroSlider as any,
        missionVisionJson: c.missionVision as any,
        servicesJson: c.services as any,
        teamJson: c.team as any,
        recentUpdatesJson: c.recentUpdates as any,
        photoGalleryJson: c.photoGallery as any,
        videoGalleryJson: c.videoGallery as any,
        testimonialsJson: c.testimonials as any,
        contactJson: c.contact as any,
        settingsJson: c.settings as any,
        updatedAt: nowLabel,
        timestampMs: nowMs,
      },
      create: {
        id: `corp-${params.ownerKey.replace(/[^a-zA-Z0-9_-]/g, '-')}`,
        ownerKey: params.ownerKey,
        userId: params.userId || null,
        memberId: params.memberId || null,
        email: params.email,
        orgName: c.branding.name,
        tagline: c.branding.tagline,
        logoUrl: c.branding.logoUrl || null,
        brandingJson: c.branding as any,
        heroSliderJson: c.heroSlider as any,
        missionVisionJson: c.missionVision as any,
        servicesJson: c.services as any,
        teamJson: c.team as any,
        recentUpdatesJson: c.recentUpdates as any,
        photoGalleryJson: c.photoGallery as any,
        videoGalleryJson: c.videoGallery as any,
        testimonialsJson: c.testimonials as any,
        contactJson: c.contact as any,
        settingsJson: c.settings as any,
        updatedAt: nowLabel,
        timestampMs: nowMs,
      },
    });
  }

  async function buildRealUserFallbackParams(user: any) {
    const linkedMember =
      user.memberId || user.email
        ? await prisma.workspaceMember.findFirst({
            where: {
              OR: [
                ...(user.memberId ? [{ id: user.memberId }] : []),
                ...(user.email ? [{ email: user.email }] : []),
              ],
            },
          })
        : null;

    const fullPhone =
      user.phoneNumber
        ? [user.phoneCountryCode, user.phoneNumber].filter(Boolean).join(' ').trim()
        : linkedMember?.phone || undefined;

    const fullAddress = [
      user.addressLine,
      user.cityName,
      user.stateName,
      user.zipCode,
      user.countryName,
    ]
      .filter(Boolean)
      .join(', ');

    return {
      resume: {
        fullName: user.name || linkedMember?.fullName || '',
        firstName: user.firstName || linkedMember?.firstName || undefined,
        lastName: user.lastName || linkedMember?.lastName || undefined,
        email: user.email || linkedMember?.email || '',
        designation: linkedMember?.designation || undefined,
        role: user.role,
        phone: fullPhone,
        city: user.cityName || undefined,
        state: user.stateName || undefined,
        country: user.countryName || undefined,
        postalCode: user.zipCode || undefined,
        avatarUrl: user.avatarUrl || linkedMember?.avatarUrl || undefined,
        bio: linkedMember?.bio || undefined,
      },
      corporate: {
        orgName: '',
        leaderName: user.name || linkedMember?.fullName || '',
        email: user.email || linkedMember?.email || '',
        phone: fullPhone,
        address: fullAddress || undefined,
      },
    };
  }

  async function loadOrInitUserResume(user: any): Promise<ResumeProfileData> {
    const ownerKey = `user:${user.id}`;
    const fallbacks = await buildRealUserFallbackParams(user);
    const fallbackParams = fallbacks.resume;

    const existingRow = await prisma.workspaceResumeProfile.findFirst({
      where: {
        OR: [
          { ownerKey },
          { userId: user.id },
          ...(user.memberId ? [{ memberId: user.memberId }] : []),
          ...(user.email ? [{ email: user.email }] : []),
        ],
      },
    });

    if (existingRow) {
      return rowToResumeProfileData(existingRow, fallbackParams);
    }

    const extra = (user.extraFields as any) || {};
    const resume = sanitizeResumeProfile(extra.resumeProfile, fallbackParams);
    await upsertIsolatedResumeRow({
      ownerKey,
      userId: user.id,
      memberId: user.memberId || null,
      email: user.email,
      resume,
    });

    if (extra.resumeProfile) {
      const cleaned = { ...extra };
      delete cleaned.resumeProfile;
      await prisma.workspaceUser
        .update({ where: { id: user.id }, data: { extraFields: cleaned } })
        .catch(() => {});
    }

    return resume;
  }

  async function loadOrInitUserCorporate(user: any): Promise<CorporateOrgProfileData> {
    const ownerKey = `user:${user.id}`;
    const fallbacks = await buildRealUserFallbackParams(user);
    const fallbackParams = fallbacks.corporate;

    const existingRow = await prisma.workspaceCorporateWebsite.findFirst({
      where: {
        OR: [
          { ownerKey },
          { userId: user.id },
          ...(user.memberId ? [{ memberId: user.memberId }] : []),
          ...(user.email ? [{ email: user.email }] : []),
        ],
      },
    });

    if (existingRow) {
      return rowToCorporateOrgProfileData(existingRow, fallbackParams);
    }

    const extra = (user.extraFields as any) || {};
    const corporate = sanitizeCorporateOrgProfile(extra.orgProfile, fallbackParams);
    await upsertIsolatedCorporateRow({
      ownerKey,
      userId: user.id,
      memberId: user.memberId || null,
      email: user.email,
      corporate,
    });

    if (extra.orgProfile) {
      const cleaned = { ...extra };
      delete cleaned.orgProfile;
      await prisma.workspaceUser
        .update({ where: { id: user.id }, data: { extraFields: cleaned } })
        .catch(() => {});
    }

    return corporate;
  }

  // Unified Studio Load Endpoint (fetches both isolated Resume & Corporate Website in parallel)
  app.get(
    '/api/user/profile/studio',
    requireAuth,
    asyncHandler(async (req, res) => {
      const user = await resolveActiveUser(req);
      if (!user) {
        res.status(401).json({ error: 'Authentication required.' });
        return;
      }

      const [resume, corporate] = await Promise.all([
        loadOrInitUserResume(user),
        loadOrInitUserCorporate(user),
      ]);

      res.json({
        resume,
        corporate,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
          email: user.email,
          avatarUrl: user.avatarUrl,
        },
      });
    })
  );

  app.get(
    '/api/user/profile/resume',
    requireAuth,
    asyncHandler(async (req, res) => {
      const user = await resolveActiveUser(req);
      if (!user) {
        res.status(401).json({ error: 'Authentication required.' });
        return;
      }

      const resume = await loadOrInitUserResume(user);
      res.json({
        resume,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
          email: user.email,
          avatarUrl: user.avatarUrl,
        },
      });
    })
  );

  app.put(
    '/api/user/profile/resume',
    requireAuth,
    asyncHandler(async (req, res) => {
      const user = await resolveActiveUser(req);
      if (!user) {
        res.status(401).json({ error: 'Authentication required.' });
        return;
      }

      const fallbacks = await buildRealUserFallbackParams(user);
      const sanitized = sanitizeResumeProfile(req.body?.resume, fallbacks.resume);

      const nextName = sanitized.header.fullName || user.name;
      const nextAvatar = sanitized.header.avatarUrl || user.avatarUrl;

      await upsertIsolatedResumeRow({
        ownerKey: `user:${user.id}`,
        userId: user.id,
        memberId: user.memberId || null,
        email: user.email,
        resume: sanitized,
      });

      await prisma.$transaction(async (tx) => {
        await tx.workspaceUser.update({
          where: { id: user.id },
          data: {
            name: nextName,
            avatarUrl: nextAvatar,
          },
        });

        await tx.workspaceMember.updateMany({
          where: {
            OR: [
              ...(user.memberId ? [{ id: user.memberId }] : []),
              { email: user.email },
            ],
          },
          data: {
            fullName: nextName,
            avatarUrl: nextAvatar,
            designation: sanitized.header.professionalTitle,
            bio: sanitized.header.executiveSummary,
            phone: sanitized.contact.phone,
          },
        });
      });

      broadcastRealtimeEvent('profile:updated', { userId: user.id, mode: 'PERSONAL' });
      res.json({ success: true, resume: sanitized });
    })
  );

  app.get(
    '/api/members/:id/resume',
    requireAuth,
    asyncHandler(async (req, res) => {
      const memberId = req.params.id;
      const member = await prisma.workspaceMember.findUnique({ where: { id: memberId } });
      if (!member) {
        res.status(404).json({ error: 'Team member not found.' });
        return;
      }
      if (!canViewMemberProfile(req, member)) {
        res.status(403).json({ error: 'You do not have permission to view this profile.' });
        return;
      }

      const fallbackParams = {
        fullName: member.fullName,
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email,
        designation: member.designation,
        phone: member.phone || undefined,
        avatarUrl: member.avatarUrl || undefined,
        bio: member.bio || undefined,
      };

      const existingRow = await prisma.workspaceResumeProfile.findFirst({
        where: {
          OR: [
            { ownerKey: `member:${member.id}` },
            { memberId: member.id },
            ...(member.email ? [{ email: member.email }] : []),
          ],
        },
      });

      let resume: ResumeProfileData;
      if (existingRow) {
        resume = rowToResumeProfileData(existingRow, fallbackParams);
      } else {
        const memberExtra = (member.extraFields as any) || {};
        resume = sanitizeResumeProfile(memberExtra.resumeProfile, fallbackParams);
        await upsertIsolatedResumeRow({
          ownerKey: `member:${member.id}`,
          memberId: member.id,
          email: member.email,
          resume,
        });
      }

      res.json({
        resume,
        member: toWorkspaceMemberDto(member),
      });
    })
  );

  app.put(
    '/api/members/:id/resume',
    requireAuth,
    asyncHandler(async (req, res) => {
      const memberId = req.params.id;
      const member = await prisma.workspaceMember.findUnique({ where: { id: memberId } });
      if (!member) {
        res.status(404).json({ error: 'Team member not found.' });
        return;
      }
      if (!canEditMemberProfile(req, member)) {
        res.status(403).json({ error: 'You can only edit your own resume profile.' });
        return;
      }

      const sanitized = sanitizeResumeProfile(req.body?.resume, {
        fullName: member.fullName,
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email,
        designation: member.designation,
        phone: member.phone || undefined,
        avatarUrl: member.avatarUrl || undefined,
        bio: member.bio || undefined,
      });

      const nextName = sanitized.header.fullName || member.fullName;
      const nextAvatar = sanitized.header.avatarUrl || member.avatarUrl;

      const existingRow = await prisma.workspaceResumeProfile.findFirst({
        where: {
          OR: [
            { ownerKey: `member:${member.id}` },
            { memberId: member.id },
            ...(member.email ? [{ email: member.email }] : []),
          ],
        },
      });

      await upsertIsolatedResumeRow({
        ownerKey: existingRow?.ownerKey || `member:${member.id}`,
        userId: existingRow?.userId || null,
        memberId: member.id,
        email: member.email,
        resume: sanitized,
      });

      await prisma.$transaction(async (tx) => {
        await tx.workspaceMember.update({
          where: { id: memberId },
          data: {
            fullName: nextName,
            designation: sanitized.header.professionalTitle || member.designation,
            bio: sanitized.header.executiveSummary || member.bio,
            phone: sanitized.contact.phone || member.phone,
            avatarUrl: nextAvatar,
          },
        });

        await tx.workspaceUser.updateMany({
          where: {
            OR: [{ memberId }, { email: member.email }],
          },
          data: {
            name: nextName,
            avatarUrl: nextAvatar,
          },
        });
      });

      broadcastRealtimeEvent('profile:updated', { memberId, mode: 'PERSONAL' });
      res.json({ success: true, resume: sanitized });
    })
  );

  app.get(
    '/api/user/profile/corporate',
    requireAuth,
    asyncHandler(async (req, res) => {
      const user = await resolveActiveUser(req);
      if (!user) {
        res.status(401).json({ error: 'Authentication required.' });
        return;
      }

      const corporate = await loadOrInitUserCorporate(user);
      res.json({
        corporate,
        user: {
          id: user.id,
          name: user.name,
          role: user.role,
          email: user.email,
        },
      });
    })
  );

  app.put(
    '/api/user/profile/corporate',
    requireAuth,
    asyncHandler(async (req, res) => {
      const user = await resolveActiveUser(req);
      if (!user) {
        res.status(401).json({ error: 'Authentication required.' });
        return;
      }

      const fallbacks = await buildRealUserFallbackParams(user);
      const sanitized = sanitizeCorporateOrgProfile(req.body?.corporate, fallbacks.corporate);

      await upsertIsolatedCorporateRow({
        ownerKey: `user:${user.id}`,
        userId: user.id,
        memberId: user.memberId || null,
        email: user.email,
        corporate: sanitized,
      });

      broadcastRealtimeEvent('profile:updated', { userId: user.id, mode: 'CORPORATE' });
      res.json({ success: true, corporate: sanitized });
    })
  );

  app.get(
    '/api/members/:id/corporate',
    requireAuth,
    asyncHandler(async (req, res) => {
      const memberId = req.params.id;
      const member = await prisma.workspaceMember.findUnique({ where: { id: memberId } });
      if (!member) {
        res.status(404).json({ error: 'Team member not found.' });
        return;
      }
      if (!canViewMemberProfile(req, member)) {
        res.status(403).json({ error: 'You do not have permission to view this corporate site.' });
        return;
      }

      const fallbackParams = {
        orgName: '',
        leaderName: member.fullName,
        email: member.email,
        phone: member.phone || undefined,
      };

      const existingRow = await prisma.workspaceCorporateWebsite.findFirst({
        where: {
          OR: [
            { ownerKey: `member:${member.id}` },
            { memberId: member.id },
            ...(member.email ? [{ email: member.email }] : []),
          ],
        },
      });

      let corporate: CorporateOrgProfileData;
      if (existingRow) {
        corporate = rowToCorporateOrgProfileData(existingRow, fallbackParams);
      } else {
        const memberExtra = (member.extraFields as any) || {};
        corporate = sanitizeCorporateOrgProfile(memberExtra.orgProfile, fallbackParams);
        await upsertIsolatedCorporateRow({
          ownerKey: `member:${member.id}`,
          memberId: member.id,
          email: member.email,
          corporate,
        });
      }

      res.json({
        corporate,
        member: toWorkspaceMemberDto(member),
      });
    })
  );

  app.put(
    '/api/members/:id/corporate',
    requireAuth,
    asyncHandler(async (req, res) => {
      const memberId = req.params.id;
      const member = await prisma.workspaceMember.findUnique({ where: { id: memberId } });
      if (!member) {
        res.status(404).json({ error: 'Team member not found.' });
        return;
      }
      if (!canEditMemberProfile(req, member)) {
        res.status(403).json({ error: 'You can only edit your own corporate website.' });
        return;
      }

      const sanitized = sanitizeCorporateOrgProfile(req.body?.corporate, {
        orgName: '',
        leaderName: member.fullName,
        email: member.email,
        phone: member.phone || undefined,
      });

      const existingRow = await prisma.workspaceCorporateWebsite.findFirst({
        where: {
          OR: [
            { ownerKey: `member:${member.id}` },
            { memberId: member.id },
            ...(member.email ? [{ email: member.email }] : []),
          ],
        },
      });

      await upsertIsolatedCorporateRow({
        ownerKey: existingRow?.ownerKey || `member:${member.id}`,
        userId: existingRow?.userId || null,
        memberId: member.id,
        email: member.email,
        corporate: sanitized,
      });

      broadcastRealtimeEvent('profile:updated', { memberId, mode: 'CORPORATE' });
      res.json({ success: true, corporate: sanitized });
    })
  );
}
