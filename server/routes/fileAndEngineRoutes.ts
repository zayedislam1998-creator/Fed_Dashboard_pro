import express from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import sharp from 'sharp';
import {
  ensureExternalStorageDirs,
  prisma,
  THUMBS_DIR,
  UPLOADS_DIR,
} from '../db/prisma';
import { ensureWorkspaceBootstrap, STRUCTURAL_DEFAULT_FOLDERS } from '../db/initEngine';
import { toWorkspaceFileDto, toWorkspaceFolderDto } from '../db/mappers';
import { getUserUsedStorageBytes, requireAdmin, requireAuth } from '../auth/sessionAuth';
import { asyncHandler, recordAndBroadcastNotification } from '../realtime';
import {
  buildEnginePayloadForFile,
  buildPdfFromImages,
  extractSearchableTextFromFile,
  generateDocxBuffer,
  generateImageThumbnailForFile,
  generatePdfFromLines,
  generatePptxBuffer,
  generateXlsxBuffer,
  htmlToPlainText,
  invalidateEngineCache,
  mergePdfs,
  processSingleImageWithSharp,
  resolveDiskPathFromUrl,
  sanitizeUnicodeFilename,
  saveFileVersionSnapshot,
  transformPdfBuffer,
} from '../engine/fileEngineService';
import { deleteWorkspaceFileAssets } from '../services/storageService';

const uploadStorage = multer.memoryStorage();
const uploadMiddleware = multer({
  storage: uploadStorage,
  limits: { fileSize: 55 * 1024 * 1024, files: 10 },
});

function formatNowLabel(): string {
  return new Date().toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function listActiveFilesAndFolders(searchQ?: string) {
  const [rawFiles, folders, trashCount] = await Promise.all([
    prisma.workspaceFile.findMany({
      where: { deletedAt: null },
      orderBy: { timestampMs: 'desc' },
    }),
    prisma.workspaceFolder.findMany({ orderBy: { timestampMs: 'asc' } }),
    prisma.workspaceFile.count({ where: { deletedAt: { not: null } } }),
  ]);

  const q = String(searchQ || '').trim().toLowerCase();
  const filtered = q
    ? rawFiles.filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          f.folderName.toLowerCase().includes(q) ||
          f.extension.toLowerCase().includes(q) ||
          (f.bodyText && f.bodyText.toLowerCase().includes(q))
      )
    : rawFiles;

  return {
    files: filtered.map((f) => toWorkspaceFileDto(f)),
    folders: folders.map(toWorkspaceFolderDto),
    trashCount,
  };
}

async function checkUserCanAccessFile(
  req: express.Request,
  fileId: string,
  requireEdit = false
): Promise<{
  allowed: boolean;
  status: 200 | 401 | 403 | 404;
  error?: string;
  file?: any;
}> {
  if (!req.auth) {
    return { allowed: false, status: 401, error: 'Sign in required.' };
  }
  const file = await prisma.workspaceFile.findUnique({ where: { id: fileId } });
  if (!file) {
    return { allowed: false, status: 404, error: 'File not found.' };
  }
  if (req.auth.capabilities.isAdmin || file.ownerUserId === req.auth.user.id) {
    return { allowed: true, status: 200, file };
  }
  if (!requireEdit && (file.visibility === 'WORKSPACE' || file.visibility === 'PUBLIC')) {
    return { allowed: true, status: 200, file };
  }
  const share = await prisma.resourceShare.findUnique({
    where: {
      resourceType_resourceId_targetUserId: {
        resourceType: 'FILE',
        resourceId: file.id,
        targetUserId: req.auth.user.id,
      },
    },
  });
  if (share && (!requireEdit || share.accessLevel === 'EDIT')) {
    return { allowed: true, status: 200, file };
  }
  return {
    allowed: false,
    status: 403,
    error: requireEdit
      ? 'You do not have edit permission for this file.'
      : 'You do not have access to this file.',
  };
}

async function storeUploadedBufferAsWorkspaceFile(params: {
  buffer: Buffer;
  originalName: string;
  customName?: string;
  mimeType: string;
  folderId?: string;
  ownerUserId: string;
  originalSizeBytes?: number;
  width?: number;
  height?: number;
}) {
  const matchedFolder =
    (params.folderId
      ? await prisma.workspaceFolder.findUnique({ where: { id: String(params.folderId) } })
      : null) ||
    (await prisma.workspaceFolder.findFirst()) ||
    null;

  const resolvedFolderId = matchedFolder?.id || 'folder-general';
  const resolvedFolderName = matchedFolder?.name || 'General Server Files';

  const cleanOrig = sanitizeUnicodeFilename(params.originalName, 'uploaded-file');
  const rawExt = path.extname(cleanOrig).replace('.', '').toLowerCase();
  const detectedMime = String(params.mimeType || 'application/octet-stream');
  const ext =
    rawExt ||
    (detectedMime.includes('jpeg') || detectedMime.includes('jpg')
      ? 'jpg'
      : detectedMime.includes('png')
      ? 'png'
      : detectedMime.includes('webp')
      ? 'webp'
      : detectedMime.includes('gif')
      ? 'gif'
      : detectedMime.includes('pdf')
      ? 'pdf'
      : 'bin');

  const displayTitle = sanitizeUnicodeFilename(
    params.customName || cleanOrig,
    `file.${ext}`
  );
  const baseOnly = path.basename(displayTitle, path.extname(displayTitle));
  const safeDisplayName = `${baseOnly}.${ext}`;
  const diskSlug = baseOnly.replace(/[?#%&]/g, '_').slice(0, 75) || 'file';
  const uniqueDiskName = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${diskSlug}.${ext}`;
  ensureExternalStorageDirs();
  const diskPath = path.join(UPLOADS_DIR, uniqueDiskName);

  fs.writeFileSync(diskPath, params.buffer);

  const fileId = `file-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const isImage = detectedMime.startsWith('image/') && !detectedMime.includes('svg');

  try {
    let width = params.width;
    let height = params.height;
    let thumbnailUrl: string | undefined;

    if (isImage) {
      const thumbInfo = await generateImageThumbnailForFile(diskPath, fileId);
      thumbnailUrl = thumbInfo.thumbnailUrl;
      if (!width && thumbInfo.width) width = thumbInfo.width;
      if (!height && thumbInfo.height) height = thumbInfo.height;
    }

    const extracted = await extractSearchableTextFromFile(diskPath, ext);
    const actualBytes = params.buffer.byteLength;
    const origBytes = Math.max(Number(params.originalSizeBytes) || actualBytes, actualBytes);
    const savedRatio =
      origBytes > actualBytes ? Math.round(((origBytes - actualBytes) / origBytes) * 100) : 0;

    const saved = await prisma.workspaceFile.create({
      data: {
        id: fileId,
        folderId: resolvedFolderId,
        folderName: resolvedFolderName,
        name: safeDisplayName,
        originalName: cleanOrig,
        mimeType: detectedMime,
        extension: ext,
        isImage: detectedMime.startsWith('image/'),
        width: width ? Number(width) : null,
        height: height ? Number(height) : null,
        originalSizeBytes: BigInt(origBytes),
        compressedSizeBytes: BigInt(actualBytes),
        compressionRatio: savedRatio,
        url: `/uploads/${encodeURIComponent(uniqueDiskName)}`,
        storagePath: `external/uploads/${uniqueDiskName}`,
        thumbnailUrl: thumbnailUrl || null,
        bodyText: extracted.text || null,
        ownerUserId: params.ownerUserId,
        visibility: 'PRIVATE',
        versionCount: 1,
        uploadedAt: formatNowLabel(),
        timestampMs: BigInt(Date.now()),
        extraFields: extracted.pageCount ? { pageCount: extracted.pageCount } : {},
      },
    });

    // Pre-warm Engine LRU cache immediately after upload
    buildEnginePayloadForFile(saved.id).catch(() => {});

    return saved;
  } catch (err) {
    if (fs.existsSync(diskPath)) fs.unlinkSync(diskPath);
    throw err;
  }
}

export function registerFileAndEngineRoutes(app: express.Express) {
  // ============================================================================
  // ADMIN SERVER FILE MANAGER ROUTES (/api/files/*)
  // ============================================================================

  app.get(
    '/api/files',
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      await ensureWorkspaceBootstrap();
      const q = typeof req.query.q === 'string' ? req.query.q : undefined;
      res.json(await listActiveFilesAndFolders(q));
    })
  );

  app.get(
    '/api/files/trash',
    requireAuth,
    requireAdmin,
    asyncHandler(async (_req, res) => {
      await ensureWorkspaceBootstrap();
      const rows = await prisma.workspaceFile.findMany({
        where: { deletedAt: { not: null } },
        orderBy: { deletedTimestampMs: 'desc' },
      });
      res.json({ files: rows.map((r) => toWorkspaceFileDto(r)) });
    })
  );

  app.post(
    '/api/files/folders',
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      await ensureWorkspaceBootstrap();
      const { id, name, folderType, parentFolderId, description, color } = req.body || {};
      if (!name || !String(name).trim()) {
        res.status(400).json({ error: 'Folder or Gallery name is required.' });
        return;
      }

      const folderId = id
        ? String(id)
        : `folder-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const cleanName = String(name).trim();
      const resolvedType =
        folderType === 'GALLERY' ? 'GALLERY' : folderType === 'DOCUMENT' ? 'DOCUMENT' : 'FOLDER';
      const nowDate = new Date().toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      const resolvedParentId =
        parentFolderId && parentFolderId !== folderId ? String(parentFolderId) : null;

      const folderRow = await prisma.$transaction(async (tx) => {
        const row = await tx.workspaceFolder.upsert({
          where: { id: folderId },
          update: {
            name: cleanName,
            folderType: resolvedType,
            parentFolderId: resolvedParentId,
            description: String(description || '').trim(),
            color: String(color || '#0B57D0'),
            timestampMs: BigInt(Date.now()),
          },
          create: {
            id: folderId,
            name: cleanName,
            folderType: resolvedType,
            parentFolderId: resolvedParentId,
            description: String(description || '').trim(),
            color: String(color || '#0B57D0'),
            createdAt: nowDate,
            timestampMs: BigInt(Date.now()),
          },
        });
        await tx.workspaceFile.updateMany({
          where: { folderId },
          data: { folderName: cleanName },
        });
        return row;
      });

      const list = await listActiveFilesAndFolders();
      res.json({
        folder: toWorkspaceFolderDto(folderRow),
        ...list,
      });
    })
  );

  app.delete(
    '/api/files/folders/:id',
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      if (id === 'folder-general' || id === 'folder-documents') {
        res.status(400).json({ error: 'Default system folders cannot be deleted.' });
        return;
      }

      await prisma.$transaction(async (tx) => {
        await tx.workspaceFolder.updateMany({
          where: { parentFolderId: id },
          data: { parentFolderId: null },
        });
        await tx.workspaceFile.updateMany({
          where: { folderId: id },
          data: { folderId: 'folder-general', folderName: 'General Server Files' },
        });
        await tx.workspaceFolder.deleteMany({ where: { id } });
      });

      res.json(await listActiveFilesAndFolders());
    })
  );

  // Fast Binary Multipart Upload (Drag-and-drop / Multi-file)
  app.post(
    '/api/files/upload-binary',
    requireAuth,
    requireAdmin,
    uploadMiddleware.array('files', 20),
    asyncHandler(async (req, res) => {
      await ensureWorkspaceBootstrap();
      const uploaded = ((req as any).files || []) as Express.Multer.File[];
      if (!uploaded.length) {
        res.status(400).json({ error: 'No files attached.' });
        return;
      }

      const folderId = String(req.body?.folderId || 'folder-general');
      const createdFiles = [];
      for (const item of uploaded) {
        const originalName = Buffer.from(item.originalname, 'latin1').toString('utf8');
        const saved = await storeUploadedBufferAsWorkspaceFile({
          buffer: item.buffer,
          originalName,
          mimeType: item.mimetype,
          folderId,
          ownerUserId: req.auth!.user.id,
          originalSizeBytes: item.size,
        });
        createdFiles.push(toWorkspaceFileDto(saved));
      }

      const list = await listActiveFilesAndFolders();
      res.json({
        file: createdFiles[0],
        uploadedFiles: createdFiles,
        ...list,
      });
    })
  );

  // Legacy-compatible JSON Base64 Upload (with Unicode names & thumbnails)
  app.post(
    '/api/files/upload',
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      await ensureWorkspaceBootstrap();
      const {
        folderId,
        name,
        originalName,
        mimeType,
        dataUrl,
        originalSizeBytes,
        width,
        height,
      } = req.body || {};

      if (!dataUrl || !originalName) {
        res.status(400).json({ error: 'File payload (dataUrl) and file name are required.' });
        return;
      }

      const matches = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) {
        res.status(400).json({ error: 'Invalid base64 file encoding.' });
        return;
      }

      const buffer = Buffer.from(matches[2], 'base64');
      const saved = await storeUploadedBufferAsWorkspaceFile({
        buffer,
        originalName: String(originalName),
        customName: name ? String(name) : undefined,
        mimeType: String(mimeType || matches[1] || 'application/octet-stream'),
        folderId: folderId ? String(folderId) : undefined,
        ownerUserId: req.auth!.user.id,
        originalSizeBytes: originalSizeBytes ? Number(originalSizeBytes) : buffer.byteLength,
        width: width ? Number(width) : undefined,
        height: height ? Number(height) : undefined,
      });

      const list = await listActiveFilesAndFolders();
      res.json({
        file: toWorkspaceFileDto(saved),
        ...list,
      });
    })
  );

  app.patch(
    '/api/files/:id',
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      const { name, folderId, visibility } = req.body || {};
      const existing = await prisma.workspaceFile.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ error: 'File not found.' });
        return;
      }

      const matchedFolder = folderId
        ? await prisma.workspaceFolder.findUnique({ where: { id: String(folderId) } })
        : null;

      const updated = await prisma.workspaceFile.update({
        where: { id },
        data: {
          ...(name ? { name: sanitizeUnicodeFilename(String(name), existing.name) } : {}),
          ...(matchedFolder ? { folderId: matchedFolder.id, folderName: matchedFolder.name } : {}),
          ...(visibility && ['PRIVATE', 'WORKSPACE', 'PUBLIC'].includes(String(visibility))
            ? { visibility: String(visibility) }
            : {}),
        },
      });
      invalidateEngineCache(id);
      const list = await listActiveFilesAndFolders();
      res.json({
        file: toWorkspaceFileDto(updated),
        ...list,
      });
    })
  );

  app.post(
    '/api/files/:id/duplicate',
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const existing = await prisma.workspaceFile.findUnique({ where: { id: req.params.id } });
      if (!existing) {
        res.status(404).json({ error: 'File not found.' });
        return;
      }
      const srcDisk = resolveDiskPathFromUrl(existing.storagePath || existing.url);
      if (!fs.existsSync(srcDisk)) {
        res.status(404).json({ error: 'Source file bytes not found on disk.' });
        return;
      }
      const buf = fs.readFileSync(srcDisk);
      const ext = path.extname(existing.name);
      const copyName = `${path.basename(existing.name, ext)} (Copy)${ext}`;
      const duplicated = await storeUploadedBufferAsWorkspaceFile({
        buffer: buf,
        originalName: copyName,
        customName: copyName,
        mimeType: existing.mimeType,
        folderId: existing.folderId,
        ownerUserId: req.auth!.user.id,
        originalSizeBytes: buf.byteLength,
        width: existing.width ?? undefined,
        height: existing.height ?? undefined,
      });
      const list = await listActiveFilesAndFolders();
      res.json({
        file: toWorkspaceFileDto(duplicated),
        ...list,
      });
    })
  );

  // Soft-Delete (Trash) by default; `?permanent=true` removes from disk & DB
  app.delete(
    '/api/files/:id',
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      const permanent = req.query.permanent === 'true';
      const target = await prisma.workspaceFile.findUnique({ where: { id } });

      if (!target) {
        res.json(await listActiveFilesAndFolders());
        return;
      }

      if (!permanent && !target.deletedAt) {
        await prisma.workspaceFile.update({
          where: { id },
          data: {
            deletedAt: formatNowLabel(),
            deletedTimestampMs: BigInt(Date.now()),
          },
        });
        invalidateEngineCache(id);
        res.json(await listActiveFilesAndFolders());
        return;
      }

      // Permanent removal via unified storage service (binary + thumbnail + versions + shares)
      await deleteWorkspaceFileAssets(id, target);
      res.json(await listActiveFilesAndFolders());
    })
  );

  app.post(
    '/api/files/:id/restore',
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      await prisma.workspaceFile.update({
        where: { id },
        data: { deletedAt: null, deletedTimestampMs: null },
      });
      res.json(await listActiveFilesAndFolders());
    })
  );

  app.delete(
    '/api/files/trash/empty',
    requireAuth,
    requireAdmin,
    asyncHandler(async (_req, res) => {
      const trashed = await prisma.workspaceFile.findMany({
        where: { deletedAt: { not: null } },
      });
      for (const target of trashed) {
        await deleteWorkspaceFileAssets(target.id, target);
      }
      res.json({ ok: true, ...(await listActiveFilesAndFolders()) });
    })
  );

  // ============================================================================
  // VERSION HISTORY & FILE SHARING
  // ============================================================================

  app.get(
    '/api/files/:id/versions',
    requireAuth,
    asyncHandler(async (req, res) => {
      const access = await checkUserCanAccessFile(req, req.params.id, false);
      if (!access.allowed) {
        res.status(access.status).json({ error: access.error });
        return;
      }
      const versions = await prisma.workspaceFileVersion.findMany({
        where: { fileId: req.params.id },
        orderBy: { versionNumber: 'desc' },
      });
      res.json({
        versions: versions.map((v) => ({
          id: v.id,
          fileId: v.fileId,
          versionNumber: v.versionNumber,
          sizeBytes: Number(v.sizeBytes),
          mimeType: v.mimeType,
          note: v.note,
          createdByEmail: v.createdByEmail,
          createdAt: v.createdAt,
          timestamp: Number(v.timestampMs),
          url: v.url,
        })),
      });
    })
  );

  app.post(
    '/api/files/:id/versions/:versionId/restore',
    requireAuth,
    asyncHandler(async (req, res) => {
      const access = await checkUserCanAccessFile(req, req.params.id, true);
      if (!access.allowed || !access.file) {
        res.status(access.status).json({ error: access.error });
        return;
      }
      const ver = await prisma.workspaceFileVersion.findUnique({
        where: { id: req.params.versionId },
      });
      if (!ver || ver.fileId !== access.file.id) {
        res.status(404).json({ error: 'Version snapshot not found.' });
        return;
      }
      const verDisk = resolveDiskPathFromUrl(ver.storagePath || ver.url);
      if (!fs.existsSync(verDisk)) {
        res.status(404).json({ error: 'Version file missing from disk.' });
        return;
      }

      const nextVersion = await saveFileVersionSnapshot(
        access.file,
        req.auth!.user.email,
        `Before restoring v${ver.versionNumber}`
      );
      ensureExternalStorageDirs();
      const curDisk = resolveDiskPathFromUrl(access.file.storagePath || access.file.url);
      fs.copyFileSync(verDisk, curDisk);

      const extracted = await extractSearchableTextFromFile(curDisk, access.file.extension);
      const updated = await prisma.workspaceFile.update({
        where: { id: access.file.id },
        data: {
          compressedSizeBytes: BigInt(fs.statSync(curDisk).size),
          versionCount: nextVersion,
          bodyText: extracted.text || access.file.bodyText,
          uploadedAt: formatNowLabel(),
          timestampMs: BigInt(Date.now()),
        },
      });
      invalidateEngineCache(updated.id);
      const payload = await buildEnginePayloadForFile(updated.id);
      res.json({ ok: true, file: toWorkspaceFileDto(updated), payload });
    })
  );

  app.get(
    '/api/files/:id/shares',
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const file = await prisma.workspaceFile.findUnique({ where: { id: req.params.id } });
      if (!file) {
        res.status(404).json({ error: 'File not found.' });
        return;
      }
      const [shares, users] = await Promise.all([
        prisma.resourceShare.findMany({
          where: { resourceType: 'FILE', resourceId: file.id },
        }),
        prisma.workspaceUser.findMany({
          where: { isActive: true },
          select: { id: true, name: true, email: true, role: true },
        }),
      ]);
      res.json({
        visibility: file.visibility,
        shares,
        users,
      });
    })
  );

  app.post(
    '/api/files/:id/share',
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const file = await prisma.workspaceFile.findUnique({ where: { id: req.params.id } });
      if (!file) {
        res.status(404).json({ error: 'File not found.' });
        return;
      }
      const { visibility, grants } = req.body || {};
      const nextVis = ['PRIVATE', 'WORKSPACE', 'PUBLIC'].includes(String(visibility))
        ? String(visibility)
        : file.visibility;

      await prisma.$transaction(async (tx) => {
        await tx.workspaceFile.update({
          where: { id: file.id },
          data: { visibility: nextVis },
        });
        if (Array.isArray(grants)) {
          await tx.resourceShare.deleteMany({
            where: { resourceType: 'FILE', resourceId: file.id },
          });
          for (const g of grants) {
            if (!g?.targetUserId) continue;
            await tx.resourceShare.create({
              data: {
                id: `shr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
                resourceType: 'FILE',
                resourceId: file.id,
                targetUserId: String(g.targetUserId),
                accessLevel: g.accessLevel === 'EDIT' ? 'EDIT' : 'VIEW',
                sharedById: req.auth!.user.id,
                createdAt: formatNowLabel(),
              },
            });
          }
        }
      });

      invalidateEngineCache(file.id);
      res.json({ ok: true, ...(await listActiveFilesAndFolders()) });
    })
  );

  // ============================================================================
  // BATCH MULTI-IMAGE PROCESSOR (RESIZE, COMPRESS, CONVERT, WATERMARK)
  // ============================================================================

  app.post(
    '/api/files/batch-image-process',
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const {
        fileIds,
        width,
        height,
        fit = 'inside',
        quality = 0.82,
        format,
        watermarkText,
        stripMetadata = true,
        overwrite = true,
        targetFolderId,
      } = req.body || {};

      if (!Array.isArray(fileIds) || fileIds.length === 0) {
        res.status(400).json({ error: 'Select at least one image to process.' });
        return;
      }

      const processed: any[] = [];
      for (const fid of fileIds.slice(0, 50)) {
        const file = await prisma.workspaceFile.findUnique({ where: { id: String(fid) } });
        if (!file || !file.isImage) continue;
        const diskPath = resolveDiskPathFromUrl(file.storagePath || file.url);
        if (!fs.existsSync(diskPath)) continue;

        const srcBuf = fs.readFileSync(diskPath);
        const out = await processSingleImageWithSharp(srcBuf, {
          width: width ? Number(width) : undefined,
          height: height ? Number(height) : undefined,
          fit,
          quality: Number(quality) || 0.82,
          format,
          watermarkText,
          stripMetadata: Boolean(stripMetadata),
        });

        if (overwrite) {
          const nextVer = await saveFileVersionSnapshot(
            file,
            req.auth!.user.email,
            `Batch edit (${out.width}x${out.height})`
          );
          ensureExternalStorageDirs();
          const newSlug = `${Date.now()}-${Math.random().toString(36).slice(2, 5)}-${sanitizeUnicodeFilename(
            path.basename(file.name, path.extname(file.name)),
            'image'
          )}.${out.extension}`;
          const newDisk = path.join(UPLOADS_DIR, newSlug);
          fs.writeFileSync(newDisk, out.buffer);
          const thumbInfo = await generateImageThumbnailForFile(newDisk, file.id);
          const origBytes = Math.max(Number(file.originalSizeBytes || out.buffer.byteLength), out.buffer.byteLength);
          const ratio = origBytes > out.buffer.byteLength
            ? Math.round(((origBytes - out.buffer.byteLength) / origBytes) * 100)
            : 0;

          const updated = await prisma.workspaceFile.update({
            where: { id: file.id },
            data: {
              name: `${path.basename(file.name, path.extname(file.name))}.${out.extension}`,
              mimeType: out.mimeType,
              extension: out.extension,
              width: out.width,
              height: out.height,
              compressedSizeBytes: BigInt(out.buffer.byteLength),
              compressionRatio: ratio,
              url: `/uploads/${encodeURIComponent(newSlug)}`,
              storagePath: `external/uploads/${newSlug}`,
              thumbnailUrl: thumbInfo.thumbnailUrl || file.thumbnailUrl,
              versionCount: nextVer,
              uploadedAt: formatNowLabel(),
              timestampMs: BigInt(Date.now()),
            },
          });
          invalidateEngineCache(updated.id);
          processed.push(toWorkspaceFileDto(updated));
        } else {
          const created = await storeUploadedBufferAsWorkspaceFile({
            buffer: out.buffer,
            originalName: `${path.basename(file.name, path.extname(file.name))}_edited.${out.extension}`,
            mimeType: out.mimeType,
            folderId: targetFolderId || file.folderId,
            ownerUserId: req.auth!.user.id,
            originalSizeBytes: srcBuf.byteLength,
            width: out.width,
            height: out.height,
          });
          processed.push(toWorkspaceFileDto(created));
        }
      }

      const list = await listActiveFilesAndFolders();
      res.json({
        ok: true,
        processedCount: processed.length,
        processed,
        ...list,
      });
    })
  );

  // Save From Mail Attachment
  app.post(
    '/api/files/save-from-mail',
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      await ensureWorkspaceBootstrap();
      const { name, url, mimeType, extension, slideDeckId, docId, bodyText, folderId } = req.body || {};
      if (!name) {
        res.status(400).json({ error: 'Attachment name is required.' });
        return;
      }

      const targetFolderId = folderId || 'folder-documents';
      const matchedFolder =
        (await prisma.workspaceFolder.findUnique({ where: { id: String(targetFolderId) } })) ||
        (await prisma.workspaceFolder.findUnique({ where: { id: 'folder-documents' } })) ||
        (await prisma.workspaceFolder.findFirst());

      const resolvedFolderId = matchedFolder?.id || 'folder-documents';
      const resolvedFolderName = matchedFolder?.name || 'Workspace Documents & Slides';

      const existing = await prisma.workspaceFile.findFirst({
        where: {
          deletedAt: null,
          OR: [
            ...(slideDeckId ? [{ slideDeckId: String(slideDeckId) }] : []),
            ...(docId ? [{ docId: String(docId) }] : []),
            ...(url ? [{ url: String(url), folderId: resolvedFolderId }] : []),
          ],
        },
      });

      if (existing) {
        const list = await listActiveFilesAndFolders();
        res.json({
          file: toWorkspaceFileDto(existing),
          ...list,
          alreadySaved: true,
        });
        return;
      }

      const ext = String(extension || path.extname(String(name)).replace('.', '') || 'pdf').toLowerCase();
      const safeName = sanitizeUnicodeFilename(String(name), `attachment.${ext}`);
      const contentBuf = Buffer.from(
        bodyText || `Saved from Email Attachment: ${safeName}\nSaved at: ${new Date().toISOString()}`,
        'utf-8'
      );
      const diskFileName = `${Date.now()}-mail-${safeName.replace(/[?#%&]/g, '_')}`;
      const resolvedUrl =
        url && String(url).startsWith('/uploads/')
          ? String(url)
          : `/uploads/${encodeURIComponent(diskFileName)}`;

      if (!url || !String(url).startsWith('/uploads/')) {
        ensureExternalStorageDirs();
        fs.writeFileSync(path.join(UPLOADS_DIR, diskFileName), contentBuf);
      }

      const saved = await prisma.workspaceFile.create({
        data: {
          id: `file-mail-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          folderId: resolvedFolderId,
          folderName: resolvedFolderName,
          name: safeName,
          originalName: safeName,
          mimeType: String(mimeType || (ext === 'pdf' ? 'application/pdf' : 'application/octet-stream')),
          extension: ext,
          isImage: String(mimeType || '').startsWith('image/'),
          originalSizeBytes: BigInt(contentBuf.byteLength),
          compressedSizeBytes: BigInt(contentBuf.byteLength),
          compressionRatio: 0,
          url: resolvedUrl,
          storagePath: `external/uploads/${path.basename(decodeURIComponent(resolvedUrl))}`,
          slideDeckId: slideDeckId ? String(slideDeckId) : null,
          docId: docId ? String(docId) : null,
          bodyText: bodyText ? String(bodyText) : null,
          ownerUserId: req.auth!.user.id,
          visibility: 'PRIVATE',
          versionCount: 1,
          uploadedAt: formatNowLabel(),
          timestampMs: BigInt(Date.now()),
        },
      });

      const list = await listActiveFilesAndFolders();
      res.json({
        file: toWorkspaceFileDto(saved),
        ...list,
        alreadySaved: false,
      });
    })
  );

  // Register Decoupled External Object Storage URL (S3 / R2 / CDN / VPS Storage) in PostgreSQL Metadata
  app.post(
    '/api/files/register-external',
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      await ensureWorkspaceBootstrap();
      const {
        name,
        externalUrl,
        mimeType,
        sizeBytes,
        folderId,
        visibility,
        description,
      } = req.body || {};

      const cleanUrl = String(externalUrl || '').trim();
      if (!name || !cleanUrl || !/^https?:\/\//i.test(cleanUrl)) {
        res.status(400).json({
          error: 'Valid file name and external HTTPS/HTTP URL (S3/R2/CDN/VPS) are required.',
        });
        return;
      }

      const matchedFolder =
        (folderId
          ? await prisma.workspaceFolder.findUnique({ where: { id: String(folderId) } })
          : null) ||
        (await prisma.workspaceFolder.findFirst()) ||
        null;

      const resolvedFolderId = matchedFolder?.id || 'folder-general';
      const resolvedFolderName = matchedFolder?.name || 'General Server Files';
      const cleanName = sanitizeUnicodeFilename(String(name), 'external-asset');
      const ext =
        path.extname(cleanName).replace('.', '').toLowerCase() ||
        path.extname(cleanUrl.split('?')[0]).replace('.', '').toLowerCase() ||
        'bin';
      const resolvedMime = String(mimeType || 'application/octet-stream');
      const numericBytes = Math.max(0, Number(sizeBytes) || 0);
      const nextVis = ['PRIVATE', 'WORKSPACE', 'PUBLIC'].includes(String(visibility))
        ? String(visibility)
        : 'PRIVATE';

      const saved = await prisma.workspaceFile.create({
        data: {
          id: `file-ext-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          folderId: resolvedFolderId,
          folderName: resolvedFolderName,
          name: cleanName,
          originalName: cleanName,
          mimeType: resolvedMime,
          extension: ext,
          isImage: resolvedMime.startsWith('image/'),
          originalSizeBytes: BigInt(numericBytes),
          compressedSizeBytes: BigInt(numericBytes),
          compressionRatio: 0,
          url: cleanUrl,
          storagePath: cleanUrl,
          thumbnailUrl: resolvedMime.startsWith('image/') ? cleanUrl : null,
          bodyText: description ? String(description).trim() : null,
          ownerUserId: req.auth!.user.id,
          visibility: nextVis,
          versionCount: 1,
          uploadedAt: formatNowLabel(),
          timestampMs: BigInt(Date.now()),
          extraFields: { externalStorage: true },
        },
      });

      const list = await listActiveFilesAndFolders();
      res.json({
        ok: true,
        file: toWorkspaceFileDto(saved),
        ...list,
      });
    })
  );

  // ============================================================================
  // MILLISECOND UNIVERSAL ENGINE ROUTES (/api/engine/file/:id & /api/engine/convert)
  // Works for Admin AND authorized / shared Members!
  // ============================================================================

  app.get(
    '/api/engine/file/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const access = await checkUserCanAccessFile(req, req.params.id, false);
      if (!access.allowed) {
        res.status(access.status).json({ error: access.error });
        return;
      }
      const payload = await buildEnginePayloadForFile(req.params.id);
      if (!payload) {
        res.status(404).json({ error: 'File payload not found.' });
        return;
      }
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.json({ ok: true, payload });
    })
  );

  app.put(
    '/api/engine/file/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const access = await checkUserCanAccessFile(req, req.params.id, true);
      if (!access.allowed || !access.file) {
        res.status(access.status).json({ error: access.error });
        return;
      }
      const file = access.file;
      const user = req.auth!.user;
      const {
        mode, // 'DOCX' | 'DOC' | 'CODE' | 'SLIDES' | 'SHEET' | 'PDF_TRANSFORM' | 'IMAGE'
        title,
        html,
        plainText,
        slideDeck,
        sheets,
        pdfTransform,
        imageDataUrl,
        imageFormat,
        saveAsCopy,
        note,
      } = req.body || {};

      let newBuffer: Buffer | null = null;
      let nextMime = file.mimeType;
      let nextExt = file.extension;
      let nextName = title ? sanitizeUnicodeFilename(String(title), file.name) : file.name;
      if (path.extname(nextName).toLowerCase() !== `.${nextExt.toLowerCase()}`) {
        nextName = `${path.basename(nextName, path.extname(nextName))}.${nextExt}`;
      }
      let nextBodyText: string | null = file.bodyText;
      let nextWidth: number | null = file.width;
      let nextHeight: number | null = file.height;

      if (mode === 'DOCX') {
        const cleanTitle = path.basename(nextName, path.extname(nextName));
        newBuffer = await generateDocxBuffer(cleanTitle, String(html || plainText || ''));
        nextBodyText = html ? htmlToPlainText(String(html)) : String(plainText || '');
      } else if (mode === 'DOC' || mode === 'CODE') {
        const content = String(plainText ?? (html ? htmlToPlainText(String(html)) : ''));
        newBuffer = Buffer.from(content, 'utf-8');
        nextBodyText = content;
        if (file.docId) {
          const words = content.trim() ? content.trim().split(/\s+/).length : 0;
          await prisma.workspaceDoc.update({
            where: { id: file.docId },
            data: {
              title: path.basename(nextName, path.extname(nextName)),
              bodyText: content,
              wordCount: words,
              updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              timestampMs: BigInt(Date.now()),
              ...(html ? { extraFields: { htmlContent: String(html) } } : {}),
            },
          }).catch(() => {});
        }
      } else if (mode === 'SLIDES' && slideDeck) {
        const deckPages = Array.isArray(slideDeck.pages) ? slideDeck.pages : [];
        if (nextExt === 'pptx') {
          newBuffer = await generatePptxBuffer({
            title: slideDeck.title || path.basename(nextName, '.pptx'),
            subtitle: slideDeck.subtitle,
            themeColor: slideDeck.themeColor,
            pages: deckPages,
          });
        } else {
          newBuffer = Buffer.from(JSON.stringify({ ...slideDeck, pages: deckPages }, null, 2), 'utf-8');
        }
        nextBodyText = deckPages
          .map((p: any) => [p.title, p.subtitle, ...(p.bullets || []), p.speakerNotes].filter(Boolean).join('\n'))
          .join('\n\n');

        if (file.slideDeckId) {
          await prisma.workspaceSlide.update({
            where: { id: file.slideDeckId },
            data: {
              title: String(slideDeck.title || path.basename(nextName, path.extname(nextName))),
              subtitle: String(slideDeck.subtitle || ''),
              themeColor: String(slideDeck.themeColor || '#D97706'),
              pagesJson: deckPages,
              slideCount: deckPages.length,
              updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              timestampMs: BigInt(Date.now()),
            },
          }).catch(() => {});
        }
      } else if (mode === 'SHEET' && Array.isArray(sheets)) {
        const isCsv = nextExt === 'csv';
        newBuffer = generateXlsxBuffer(sheets, isCsv);
        nextBodyText = sheets
          .map((s: any) => [s.columns.join(','), ...s.rows.map((r: any[]) => r.join(','))].join('\n'))
          .join('\n\n');
      } else if (mode === 'PDF_TRANSFORM' && pdfTransform) {
        const curDisk = resolveDiskPathFromUrl(file.storagePath || file.url);
        if (!fs.existsSync(curDisk)) {
          res.status(404).json({ error: 'PDF bytes not found.' });
          return;
        }
        newBuffer = await transformPdfBuffer(fs.readFileSync(curDisk), pdfTransform);
        const extracted = await extractSearchableTextFromFile(curDisk, 'pdf');
        nextBodyText = extracted.text || file.bodyText;
      } else if (mode === 'IMAGE' && imageDataUrl) {
        const m = String(imageDataUrl).match(/^data:([^;]+);base64,(.+)$/);
        if (!m) {
          res.status(400).json({ error: 'Invalid image data payload.' });
          return;
        }
        newBuffer = Buffer.from(m[2], 'base64');
        nextMime = String(imageFormat || m[1] || file.mimeType);
        nextExt =
          nextMime.includes('png')
            ? 'png'
            : nextMime.includes('webp')
            ? 'webp'
            : 'jpg';
        nextName = `${path.basename(nextName, path.extname(nextName))}.${nextExt}`;
        const meta = await sharp(newBuffer).metadata().catch(() => ({ width: undefined, height: undefined }));
        nextWidth = meta.width ?? file.width;
        nextHeight = meta.height ?? file.height;
      }

      if (!newBuffer) {
        res.status(400).json({ error: 'Unsupported or empty edit payload.' });
        return;
      }

      // Enforce per-file & total storage quota for non-admin Members
      if (!req.auth!.capabilities.isAdmin) {
        if (newBuffer.byteLength > user.maxFileSizeBytes) {
          res.status(413).json({ error: 'Edited file exceeds your per-file upload limit.' });
          return;
        }
        const used = await getUserUsedStorageBytes(user.id);
        const delta = Math.max(0, newBuffer.byteLength - Number(file.compressedSizeBytes));
        if (used + (saveAsCopy ? newBuffer.byteLength : delta) > user.storageQuotaBytes) {
          res.status(413).json({ error: 'Storage quota exceeded.' });
          return;
        }
      }

      if (saveAsCopy) {
        const base = path.basename(nextName, path.extname(nextName));
        const copyFile = await storeUploadedBufferAsWorkspaceFile({
          buffer: newBuffer,
          originalName: `${base} (Edited).${nextExt}`,
          mimeType: nextMime,
          folderId: file.folderId,
          ownerUserId: user.id,
          originalSizeBytes: newBuffer.byteLength,
          width: nextWidth ?? undefined,
          height: nextHeight ?? undefined,
        });
        const payload = await buildEnginePayloadForFile(copyFile.id);
        res.json({ ok: true, file: toWorkspaceFileDto(copyFile), payload });
        return;
      }

      // Save version snapshot before overwriting
      const nextVersion = await saveFileVersionSnapshot(
        file,
        user.email,
        String(note || `Edited via Universal ${mode} Engine`)
      );

      ensureExternalStorageDirs();
      const newDiskName = `${Date.now()}-${Math.random().toString(36).slice(2, 5)}-${sanitizeUnicodeFilename(
        path.basename(nextName, path.extname(nextName)),
        'file'
      ).replace(/[?#%&]/g, '_')}.${nextExt}`;
      const newDiskPath = path.join(UPLOADS_DIR, newDiskName);
      fs.writeFileSync(newDiskPath, newBuffer);

      let thumbnailUrl = file.thumbnailUrl;
      if (mode === 'IMAGE') {
        const thumbInfo = await generateImageThumbnailForFile(newDiskPath, file.id);
        if (thumbInfo.thumbnailUrl) thumbnailUrl = thumbInfo.thumbnailUrl;
      }

      const origBytes = Math.max(Number(file.originalSizeBytes || newBuffer.byteLength), newBuffer.byteLength);
      const ratio = origBytes > newBuffer.byteLength
        ? Math.round(((origBytes - newBuffer.byteLength) / origBytes) * 100)
        : 0;

      const updated = await prisma.workspaceFile.update({
        where: { id: file.id },
        data: {
          name: nextName,
          mimeType: nextMime,
          extension: nextExt,
          width: nextWidth,
          height: nextHeight,
          compressedSizeBytes: BigInt(newBuffer.byteLength),
          compressionRatio: ratio,
          url: `/uploads/${encodeURIComponent(newDiskName)}`,
          storagePath: `external/uploads/${newDiskName}`,
          thumbnailUrl,
          bodyText: nextBodyText,
          versionCount: nextVersion,
          uploadedAt: formatNowLabel(),
          timestampMs: BigInt(Date.now()),
        },
      });

      invalidateEngineCache(updated.id);
      const payload = await buildEnginePayloadForFile(updated.id);
      res.json({ ok: true, file: toWorkspaceFileDto(updated), payload });
    })
  );

  // Cross-Format Conversion & PDF Merge/Split/Images-to-PDF
  app.post(
    '/api/engine/convert',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { action, fileIds, fileId, title, lines, pages, sheets, pageRange, folderId } = req.body || {};
      const user = req.auth!.user;
      let outBuffer: Buffer | null = null;
      let outName = 'converted.pdf';
      let outMime = 'application/pdf';
      let targetFolder = folderId || 'folder-documents';

      if (action === 'IMAGES_TO_PDF') {
        if (!Array.isArray(fileIds) || fileIds.length === 0) {
          res.status(400).json({ error: 'Select one or more images to convert to PDF.' });
          return;
        }
        const bufs: Array<{ buffer: Buffer; mimeType?: string }> = [];
        for (const id of fileIds) {
          const access = await checkUserCanAccessFile(req, String(id), false);
          if (!access.allowed || !access.file) continue;
          const disk = resolveDiskPathFromUrl(access.file.storagePath || access.file.url);
          if (fs.existsSync(disk)) {
            bufs.push({ buffer: fs.readFileSync(disk), mimeType: access.file.mimeType });
          }
        }
        if (bufs.length === 0) {
          res.status(400).json({ error: 'No readable images found.' });
          return;
        }
        outBuffer = await buildPdfFromImages(bufs);
        outName = `${sanitizeUnicodeFilename(String(title || `Images_Combined_${Date.now()}`), 'Images_PDF')}.pdf`;
      } else if (action === 'PDF_MERGE') {
        if (!Array.isArray(fileIds) || fileIds.length < 2) {
          res.status(400).json({ error: 'Select at least 2 PDFs to merge.' });
          return;
        }
        const pdfBufs: Buffer[] = [];
        for (const id of fileIds) {
          const access = await checkUserCanAccessFile(req, String(id), false);
          if (!access.allowed || !access.file) continue;
          const disk = resolveDiskPathFromUrl(access.file.storagePath || access.file.url);
          if (fs.existsSync(disk)) pdfBufs.push(fs.readFileSync(disk));
        }
        if (pdfBufs.length < 2) {
          res.status(400).json({ error: 'Could not read at least 2 PDF files.' });
          return;
        }
        outBuffer = await mergePdfs(pdfBufs);
        outName = `${sanitizeUnicodeFilename(String(title || `Merged_Document_${Date.now()}`), 'Merged')}.pdf`;
      } else if (action === 'PDF_SPLIT' && fileId) {
        const access = await checkUserCanAccessFile(req, String(fileId), false);
        if (!access.allowed || !access.file) {
          res.status(access.status).json({ error: access.error });
          return;
        }
        const disk = resolveDiskPathFromUrl(access.file.storagePath || access.file.url);
        const srcBuf = fs.readFileSync(disk);
        const indices = Array.isArray(pageRange)
          ? pageRange.map((n: any) => Number(n) - 1).filter((n: number) => Number.isInteger(n) && n >= 0)
          : [0];
        outBuffer = await transformPdfBuffer(srcBuf, { pageOrder: indices });
        outName = `${sanitizeUnicodeFilename(String(title || `${path.basename(access.file.name, '.pdf')}_extract`), 'Split')}.pdf`;
        targetFolder = access.file.folderId;
      } else if (action === 'TEXT_TO_PDF') {
        const textLines = Array.isArray(lines)
          ? lines.map((l: any) => String(l))
          : String(lines || '').split(/\r?\n/);
        outBuffer = await generatePdfFromLines(String(title || 'Workspace Document'), textLines);
        outName = `${sanitizeUnicodeFilename(String(title || 'Document'), 'Document')}.pdf`;
      } else if (action === 'SLIDES_TO_PPTX' && Array.isArray(pages)) {
        outBuffer = await generatePptxBuffer({
          title: String(title || 'Workspace Presentation'),
          pages,
        });
        outName = `${sanitizeUnicodeFilename(String(title || 'Presentation'), 'Presentation')}.pptx`;
        outMime = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
      } else if (action === 'DOC_TO_DOCX') {
        outBuffer = await generateDocxBuffer(String(title || 'Document'), String(lines || ''));
        outName = `${sanitizeUnicodeFilename(String(title || 'Document'), 'Document')}.docx`;
        outMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      } else if (action === 'SHEETS_TO_XLSX' && Array.isArray(sheets)) {
        outBuffer = generateXlsxBuffer(sheets, false);
        outName = `${sanitizeUnicodeFilename(String(title || 'Spreadsheet'), 'Spreadsheet')}.xlsx`;
        outMime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      }

      if (!outBuffer) {
        res.status(400).json({ error: 'Unsupported conversion action or missing input.' });
        return;
      }

      const created = await storeUploadedBufferAsWorkspaceFile({
        buffer: outBuffer,
        originalName: outName,
        mimeType: outMime,
        folderId: targetFolder,
        ownerUserId: user.id,
        originalSizeBytes: outBuffer.byteLength,
      });

      await recordAndBroadcastNotification({
        type: 'db_event',
        title: `Converted & Saved: ${created.name}`,
        description: `Created via Universal Engine (${action}) in File Manager.`,
        module: 'files',
        targetId: created.id,
      });

      const list = req.auth!.capabilities.isAdmin ? await listActiveFilesAndFolders() : undefined;
      res.json({
        ok: true,
        file: toWorkspaceFileDto(created),
        ...(list || {}),
      });
    })
  );

  // ============================================================================
  // UNIFIED IN-PLACE FILE SEARCH (ACROSS FILE NAMES + EXTRACTED DOC/PDF/PPTX/XLSX)
  // ============================================================================

  app.get(
    '/api/files/search',
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const q = String(req.query.q || '').trim();
      res.json(await listActiveFilesAndFolders(q));
    })
  );
}

// Re-export structural defaults check helper
export { STRUCTURAL_DEFAULT_FOLDERS };
