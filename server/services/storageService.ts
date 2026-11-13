import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import {
  EXTERNAL_STORAGE_BASE,
  IS_EPHEMERAL_STORAGE,
  THUMBS_DIR,
  UPLOADS_DIR,
  VERSIONS_DIR,
  prisma,
} from '../db/prisma';
import { invalidateEngineCache, resolveDiskPathFromUrl } from '../engine/fileEngineService';

export interface SmartImageOptimizationResult {
  buffer: Buffer;
  mimeType: string;
  extension: string;
  width?: number;
  height?: number;
  originalBytes: number;
  finalBytes: number;
  optimized: boolean;
}

/**
 * Optimizes heavy raster images on upload for VPS disk efficiency.
 * Never enlarges small images, skips SVG/GIF, and keeps the original if compressed output is larger.
 */
export async function optimizeUploadedImageBuffer(
  inputBuffer: Buffer,
  mimeType: string,
  originalName: string
): Promise<SmartImageOptimizationResult> {
  const originalBytes = inputBuffer.byteLength;
  const extFromName = path.extname(originalName).replace('.', '').toLowerCase();
  const lowerMime = String(mimeType || '').toLowerCase();

  const isRasterImage =
    lowerMime.startsWith('image/') &&
    !lowerMime.includes('svg') &&
    !lowerMime.includes('gif') &&
    !['svg', 'gif', 'ico'].includes(extFromName);

  if (!isRasterImage) {
    return {
      buffer: inputBuffer,
      mimeType,
      extension: extFromName || 'bin',
      originalBytes,
      finalBytes: originalBytes,
      optimized: false,
    };
  }

  try {
    const meta = await sharp(inputBuffer).metadata();
    const width = meta.width;
    const height = meta.height;

    // Only re-encode if large (> 180 KB) or oversized dimensions (> 1920px)
    const needsResize = (width && width > 1920) || (height && height > 1920);
    if (originalBytes <= 180 * 1024 && !needsResize) {
      return {
        buffer: inputBuffer,
        mimeType,
        extension: extFromName || (meta.format === 'jpeg' ? 'jpg' : meta.format || 'png'),
        width,
        height,
        originalBytes,
        finalBytes: originalBytes,
        optimized: false,
      };
    }

    let pipeline = sharp(inputBuffer).rotate();
    if (needsResize) {
      pipeline = pipeline.resize({
        width: 1920,
        height: 1920,
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    let outBuffer: Buffer;
    let outMime = mimeType;
    let outExt = extFromName;

    if (lowerMime.includes('png') || extFromName === 'png') {
      if (meta.hasAlpha) {
        outBuffer = await pipeline.png({ compressionLevel: 9, palette: true }).toBuffer();
        outMime = 'image/png';
        outExt = 'png';
      } else {
        outBuffer = await pipeline.webp({ quality: 84 }).toBuffer();
        outMime = 'image/webp';
        outExt = 'webp';
      }
    } else if (lowerMime.includes('webp') || extFromName === 'webp') {
      outBuffer = await pipeline.webp({ quality: 84 }).toBuffer();
      outMime = 'image/webp';
      outExt = 'webp';
    } else {
      outBuffer = await pipeline.jpeg({ quality: 84, mozjpeg: true }).toBuffer();
      outMime = 'image/jpeg';
      outExt = 'jpg';
    }

    if (outBuffer.byteLength < originalBytes) {
      const outMeta = await sharp(outBuffer).metadata().catch(() => ({ width, height }));
      return {
        buffer: outBuffer,
        mimeType: outMime,
        extension: outExt,
        width: outMeta.width ?? width,
        height: outMeta.height ?? height,
        originalBytes,
        finalBytes: outBuffer.byteLength,
        optimized: true,
      };
    }

    return {
      buffer: inputBuffer,
      mimeType,
      extension: extFromName || 'jpg',
      width,
      height,
      originalBytes,
      finalBytes: originalBytes,
      optimized: false,
    };
  } catch {
    return {
      buffer: inputBuffer,
      mimeType,
      extension: extFromName || 'bin',
      originalBytes,
      finalBytes: originalBytes,
      optimized: false,
    };
  }
}

/**
 * Permanently removes a WorkspaceFile, its thumbnail, all saved version snapshots, and share records.
 */
export async function deleteWorkspaceFileAssets(
  fileId: string,
  preloadedFile?: any
): Promise<boolean> {
  const target =
    preloadedFile || (await prisma.workspaceFile.findUnique({ where: { id: fileId } }));
  if (!target) return false;

  const versions = await prisma.workspaceFileVersion.findMany({ where: { fileId } });

  await prisma.$transaction(async (tx) => {
    await tx.workspaceFileVersion.deleteMany({ where: { fileId } });
    await tx.resourceShare.deleteMany({ where: { resourceType: 'FILE', resourceId: fileId } });
    await tx.workspaceFile.deleteMany({ where: { id: fileId } });
  });

  for (const v of versions) {
    const vPath = resolveDiskPathFromUrl(v.storagePath || v.url);
    if (fs.existsSync(vPath)) {
      try {
        fs.unlinkSync(vPath);
      } catch {
        // ignore
      }
    }
  }

  const mainPath = resolveDiskPathFromUrl(target.storagePath || target.url);
  if (fs.existsSync(mainPath)) {
    try {
      fs.unlinkSync(mainPath);
    } catch {
      // ignore
    }
  }

  if (target.thumbnailUrl) {
    const thumbPath = path.join(THUMBS_DIR, path.basename(target.thumbnailUrl));
    if (fs.existsSync(thumbPath)) {
      try {
        fs.unlinkSync(thumbPath);
      } catch {
        // ignore
      }
    }
  }

  invalidateEngineCache(fileId);
  return true;
}

function listFilesInDirSafe(dirPath: string): Array<{
  name: string;
  fullPath: string;
  sizeBytes: number;
  mtimeMs: number;
}> {
  if (!fs.existsSync(dirPath)) return [];
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const out: Array<{ name: string; fullPath: string; sizeBytes: number; mtimeMs: number }> = [];
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const fullPath = path.join(dirPath, entry.name);
      try {
        const stat = fs.statSync(fullPath);
        out.push({
          name: entry.name,
          fullPath,
          sizeBytes: stat.size,
          mtimeMs: stat.mtimeMs,
        });
      } catch {
        // ignore unreadable file
      }
    }
    return out;
  } catch {
    return [];
  }
}

function extractFileBasename(urlOrPath?: string | null): string | null {
  if (!urlOrPath) return null;
  const raw = String(urlOrPath).trim();
  if (!raw || raw.startsWith('data:') || raw.startsWith('http://') || raw.startsWith('https://')) {
    return null;
  }
  const clean = raw.split('?')[0].split('#')[0];
  try {
    return path.basename(decodeURIComponent(clean));
  } catch {
    return path.basename(clean);
  }
}

async function collectReferencedDiskBasenames(): Promise<{
  uploadNames: Set<string>;
  versionNames: Set<string>;
  thumbNames: Set<string>;
}> {
  const uploadNames = new Set<string>();
  const versionNames = new Set<string>();
  const thumbNames = new Set<string>();

  const addRef = (val?: string | null) => {
    if (!val) return;
    const str = String(val);
    const base = extractFileBasename(str);
    if (!base) return;
    if (str.includes('/.versions/')) {
      versionNames.add(base);
    } else if (str.includes('/.thumbs/')) {
      thumbNames.add(base);
    } else {
      uploadNames.add(base);
    }
  };

  const [files, versions, commMessages, users, members, resumes, websites] = await Promise.all([
    prisma.workspaceFile.findMany({
      select: { url: true, storagePath: true, thumbnailUrl: true },
    }),
    prisma.workspaceFileVersion.findMany({
      select: { url: true, storagePath: true },
    }),
    prisma.communicationMessage.findMany({
      select: { attachments: true },
    }),
    prisma.workspaceUser.findMany({
      select: { avatarUrl: true },
    }),
    prisma.workspaceMember.findMany({
      select: { avatarUrl: true },
    }),
    prisma.workspaceResumeProfile.findMany({
      select: { avatarUrl: true, coverImageUrl: true },
    }),
    prisma.workspaceCorporateWebsite.findMany({
      select: { logoUrl: true },
    }),
  ]);

  for (const f of files) {
    addRef(f.url);
    addRef(f.storagePath);
    addRef(f.thumbnailUrl);
  }
  for (const v of versions) {
    addRef(v.url);
    addRef(v.storagePath);
  }
  for (const m of commMessages) {
    if (Array.isArray(m.attachments)) {
      for (const att of m.attachments as any[]) {
        addRef(att?.url);
      }
    }
  }
  for (const u of users) addRef(u.avatarUrl);
  for (const m of members) addRef(m.avatarUrl);
  for (const r of resumes) {
    addRef(r.avatarUrl);
    addRef(r.coverImageUrl);
  }
  for (const w of websites) addRef(w.logoUrl);

  return { uploadNames, versionNames, thumbNames };
}

export interface VpsStorageDiagnostics {
  storageBasePath: string;
  isEphemeralTmp: boolean;
  browserCacheEnabled: boolean;
  diskTotalBytes: number;
  diskFreeBytes: number;
  uploadsBytes: number;
  versionsBytes: number;
  thumbsBytes: number;
  totalUsedBytes: number;
  activeFilesCount: number;
  trashedFilesCount: number;
  trashedBytes: number;
  versionsCount: number;
  orphanFilesCount: number;
  orphanBytes: number;
}

export async function getVpsStorageDiagnostics(): Promise<VpsStorageDiagnostics> {
  const [refs, activeCount, trashedRows, versionsCount] = await Promise.all([
    collectReferencedDiskBasenames(),
    prisma.workspaceFile.count({ where: { deletedAt: null } }),
    prisma.workspaceFile.findMany({
      where: { deletedAt: { not: null } },
      select: { compressedSizeBytes: true },
    }),
    prisma.workspaceFileVersion.count(),
  ]);

  const uploadEntries = listFilesInDirSafe(UPLOADS_DIR);
  const versionEntries = listFilesInDirSafe(VERSIONS_DIR);
  const thumbEntries = listFilesInDirSafe(THUMBS_DIR);

  const uploadsBytes = uploadEntries.reduce((acc, f) => acc + f.sizeBytes, 0);
  const versionsBytes = versionEntries.reduce((acc, f) => acc + f.sizeBytes, 0);
  const thumbsBytes = thumbEntries.reduce((acc, f) => acc + f.sizeBytes, 0);

  let orphanFilesCount = 0;
  let orphanBytes = 0;
  const graceCutoff = Date.now() - 10 * 60 * 1000;

  for (const f of uploadEntries) {
    if (!refs.uploadNames.has(f.name) && f.mtimeMs < graceCutoff) {
      orphanFilesCount++;
      orphanBytes += f.sizeBytes;
    }
  }
  for (const f of versionEntries) {
    if (!refs.versionNames.has(f.name) && f.mtimeMs < graceCutoff) {
      orphanFilesCount++;
      orphanBytes += f.sizeBytes;
    }
  }
  for (const f of thumbEntries) {
    if (!refs.thumbNames.has(f.name) && f.mtimeMs < graceCutoff) {
      orphanFilesCount++;
      orphanBytes += f.sizeBytes;
    }
  }

  let diskTotalBytes = 0;
  let diskFreeBytes = 0;
  try {
    const statTarget = fs.existsSync(EXTERNAL_STORAGE_BASE)
      ? EXTERNAL_STORAGE_BASE
      : process.cwd();
    const fsStats = fs.statfsSync(statTarget);
    diskTotalBytes = Number(fsStats.blocks) * Number(fsStats.bsize);
    diskFreeBytes = Number(fsStats.bavail) * Number(fsStats.bsize);
  } catch {
    // ignore if unsupported
  }

  const trashedBytes = trashedRows.reduce(
    (acc, r) => acc + Number(r.compressedSizeBytes || BigInt(0)),
    0
  );

  return {
    storageBasePath: EXTERNAL_STORAGE_BASE,
    isEphemeralTmp: IS_EPHEMERAL_STORAGE,
    browserCacheEnabled: false,
    diskTotalBytes,
    diskFreeBytes,
    uploadsBytes,
    versionsBytes,
    thumbsBytes,
    totalUsedBytes: uploadsBytes + versionsBytes + thumbsBytes,
    activeFilesCount: activeCount,
    trashedFilesCount: trashedRows.length,
    trashedBytes,
    versionsCount,
    orphanFilesCount,
    orphanBytes,
  };
}

export async function runSmartStorageCleanup(options?: {
  pruneOrphans?: boolean;
  purgeTrashOlderThanDays?: number;
}): Promise<{
  removedOrphans: number;
  removedTrashedFiles: number;
  reclaimedBytes: number;
}> {
  const pruneOrphans = options?.pruneOrphans !== false;
  const purgeDays = Number(options?.purgeTrashOlderThanDays ?? 0);

  let removedOrphans = 0;
  let removedTrashedFiles = 0;
  let reclaimedBytes = 0;

  if (purgeDays > 0) {
    const cutoffMs = BigInt(Date.now() - purgeDays * 24 * 60 * 60 * 1000);
    const expiredTrash = await prisma.workspaceFile.findMany({
      where: {
        deletedAt: { not: null },
        deletedTimestampMs: { lt: cutoffMs },
      },
    });
    for (const row of expiredTrash) {
      const sz = Number(row.compressedSizeBytes || BigInt(0));
      const deleted = await deleteWorkspaceFileAssets(row.id, row);
      if (deleted) {
        removedTrashedFiles++;
        reclaimedBytes += sz;
      }
    }
  }

  if (pruneOrphans) {
    const refs = await collectReferencedDiskBasenames();
    const graceCutoff = Date.now() - 10 * 60 * 1000;

    const sweep = (
      entries: Array<{ name: string; fullPath: string; sizeBytes: number; mtimeMs: number }>,
      validSet: Set<string>
    ) => {
      for (const entry of entries) {
        if (!validSet.has(entry.name) && entry.mtimeMs < graceCutoff) {
          try {
            fs.unlinkSync(entry.fullPath);
            removedOrphans++;
            reclaimedBytes += entry.sizeBytes;
          } catch {
            // ignore
          }
        }
      }
    };

    sweep(listFilesInDirSafe(UPLOADS_DIR), refs.uploadNames);
    sweep(listFilesInDirSafe(VERSIONS_DIR), refs.versionNames);
    sweep(listFilesInDirSafe(THUMBS_DIR), refs.thumbNames);
  }

  return { removedOrphans, removedTrashedFiles, reclaimedBytes };
}
