import express from 'express';
import fs from 'fs';
import path from 'path';
import { ensureExternalStorageDirs, prisma, UPLOADS_DIR } from '../db/prisma';
import {
  hasActionCapability,
  hasModuleCapability,
  hasProjectGrantAction,
  recordAuditEvent,
} from '../auth/policy';
import {
  getUserUsedStorageBytes,
  requireActionAccess,
  requireAuth,
  requireModuleAccess,
} from '../auth/sessionAuth';
import { buildScopedMemberPreview } from './authAndAdminPanelRoutes';
import { asyncHandler, broadcastRealtimeEvent, recordAndBroadcastNotification } from '../realtime';
import { toCmhProjectDto, toCmhTaskDto } from '../db/mappers';
import {
  buildEnginePayloadForFile,
  extractSearchableTextFromFile,
  generateImageThumbnailForFile,
  invalidateEngineCache,
  sanitizeUnicodeFilename,
} from '../engine/fileEngineService';
import {
  deleteWorkspaceFileAssets,
  optimizeUploadedImageBuffer,
} from '../services/storageService';

function stripBigIntTimestamp<T extends { timestampMs: bigint }>(row: T) {
  const { timestampMs, ...rest } = row;
  return { ...rest, timestamp: Number(timestampMs) };
}

export function registerMemberPortalRoutes(app: express.Express) {
  // Single fast scoped bootstrap returning ONLY authorized items for the signed-in user
  app.get(
    '/api/member/bootstrap',
    requireAuth,
    asyncHandler(async (req, res) => {
      const payload = await buildScopedMemberPreview(req.auth!.user.id);
      if (!payload) {
        res.status(404).json({ error: 'Account not found.' });
        return;
      }
      res.json(payload);
    })
  );

  // Scoped Task Progress / Submission by assigned Member
  app.post(
    '/api/member/tasks/:id/submit',
    requireAuth,
    requireModuleAccess('cmh_tasks'),
    requireActionAccess('task.submit_own'),
    asyncHandler(async (req, res) => {
      const taskId = req.params.id;
      const { statusUpdate, note, values } = req.body || {};
      const user = req.auth!.user;

      const task = await prisma.cmhTask.findUnique({ where: { id: taskId } });
      if (!task) {
        res.status(404).json({ error: 'Task not found.' });
        return;
      }

      const assigned = await prisma.taskAssignment.findUnique({
        where: { taskId_userId: { taskId, userId: user.id } },
      });
      const linkedMember = user.memberId
        ? await prisma.workspaceMember.findUnique({ where: { id: user.memberId } })
        : null;
      const mIds = Array.isArray(task.assignedMemberIdsJson) ? (task.assignedMemberIdsJson as string[]) : [];
      const tIds = Array.isArray(task.assignedTeamIdsJson) ? (task.assignedTeamIdsJson as string[]) : [];
      const hasProjectMgr =
        task.projectId &&
        hasProjectGrantAction(req.auth!.capabilities, task.projectId, 'project.manage_tasks');

      const isAllowed =
        req.auth!.capabilities.isAdmin ||
        task.ownerUserId === user.id ||
        Boolean(assigned) ||
        (linkedMember &&
          (mIds.includes(linkedMember.id) || (linkedMember.teamId && tIds.includes(linkedMember.teamId)))) ||
        hasProjectMgr;

      if (!isAllowed) {
        res.status(403).json({ error: 'You are not assigned to this task.' });
        return;
      }

      const submission = {
        id: `cmh-sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        targetType: 'TASK',
        targetId: task.id,
        targetTitle: task.title,
        submitterName: user.name,
        submitterEmail: user.email,
        submittedAt: new Date().toLocaleString([], {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        timestamp: Date.now(),
        values: {
          ...(values || {}),
          ...(note ? { ProgressNote: String(note) } : {}),
          ...(statusUpdate ? { Status: String(statusUpdate) } : {}),
        },
      };

      const prevSubs = Array.isArray(task.submissionsJson) ? (task.submissionsJson as any[]) : [];
      const updated = await prisma.cmhTask.update({
        where: { id: task.id },
        data: {
          ...(statusUpdate ? { status: String(statusUpdate) } : {}),
          submissionsJson: [submission, ...prevSubs],
          updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      });

      await recordAndBroadcastNotification({
        type: 'cmh_activity',
        title: `Task Update by ${user.name}: ${task.title}`,
        description: statusUpdate
          ? `Moved to "${statusUpdate}"${note ? ` — ${String(note).slice(0, 80)}` : ''}`
          : String(note || 'Submitted progress update'),
        module: 'cmh_tasks',
        targetId: task.id,
      });

      broadcastRealtimeEvent('cmh:updated', { type: 'task', item: toCmhTaskDto(updated) });
      res.json({ ok: true, task: toCmhTaskDto(updated), submission });
    })
  );

  // Scoped Project Update by Project Manager Grant
  app.patch(
    '/api/member/projects/:id',
    requireAuth,
    requireModuleAccess('cmh_projects'),
    asyncHandler(async (req, res) => {
      const projectId = req.params.id;
      if (
        !req.auth!.capabilities.isAdmin &&
        !hasProjectGrantAction(req.auth!.capabilities, projectId, 'project.edit_details')
      ) {
        res.status(403).json({
          error: 'You do not have Project Manager edit rights on this project.',
        });
        return;
      }

      const { description, status, deadline } = req.body || {};
      const existing = await prisma.cmhProject.findUnique({ where: { id: projectId } });
      if (!existing) {
        res.status(404).json({ error: 'Project not found.' });
        return;
      }

      const updated = await prisma.cmhProject.update({
        where: { id: projectId },
        data: {
          ...(description !== undefined ? { description: String(description) } : {}),
          ...(status !== undefined ? { status: String(status) } : {}),
          ...(deadline !== undefined ? { deadline: String(deadline) } : {}),
          updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      });

      await recordAuditEvent({
        actorUserId: req.auth!.user.id,
        actorEmail: req.auth!.user.email,
        action: 'project.manager_edit',
        targetType: 'project',
        targetId: projectId,
        summary: `Project "${updated.title}" updated by manager ${req.auth!.user.email}`,
      });

      res.json({ ok: true, project: toCmhProjectDto(updated) });
    })
  );

  // Scoped Member Docs (Create/Update/Delete own docs ONLY)
  app.post(
    '/api/member/docs',
    requireAuth,
    requireModuleAccess('docs'),
    requireActionAccess('doc.create'),
    asyncHandler(async (req, res) => {
      const { id, title, category, bodyText } = req.body || {};
      if (!title || !String(title).trim()) {
        res.status(400).json({ error: 'Document title is required.' });
        return;
      }
      const userId = req.auth!.user.id;
      const docId =
        id ? String(id) : `doc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const existing = id ? await prisma.workspaceDoc.findUnique({ where: { id: docId } }) : null;
      if (existing && existing.ownerUserId !== userId && !req.auth!.capabilities.isAdmin) {
        res.status(403).json({ error: 'Cannot edit another member document.' });
        return;
      }

      const text = String(bodyText || '');
      const words = text.trim() ? text.trim().split(/\s+/).length : 0;
      const saved = await prisma.workspaceDoc.upsert({
        where: { id: docId },
        update: {
          title: String(title).trim(),
          category: String(category || 'General').trim(),
          bodyText: text,
          wordCount: words,
          updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          timestampMs: BigInt(Date.now()),
        },
        create: {
          id: docId,
          title: String(title).trim(),
          category: String(category || 'General').trim(),
          bodyText: text,
          wordCount: words,
          ownerUserId: userId,
          visibility: 'PRIVATE',
          createdAt: new Date().toLocaleDateString([], {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
          updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          timestampMs: BigInt(Date.now()),
        },
      });

      res.json({
        ok: true,
        doc: stripBigIntTimestamp(saved),
      });
    })
  );

  app.delete(
    '/api/member/docs/:id',
    requireAuth,
    requireModuleAccess('docs'),
    asyncHandler(async (req, res) => {
      const existing = await prisma.workspaceDoc.findUnique({ where: { id: req.params.id } });
      if (!existing) {
        res.status(404).json({ error: 'Document not found.' });
        return;
      }
      if (existing.ownerUserId !== req.auth!.user.id && !req.auth!.capabilities.isAdmin) {
        res.status(403).json({ error: 'Cannot delete another member document.' });
        return;
      }
      await prisma.workspaceDoc.delete({ where: { id: existing.id } });
      res.json({ ok: true });
    })
  );

  // Scoped Member Forms
  app.post(
    '/api/member/forms',
    requireAuth,
    requireModuleAccess('forms'),
    requireActionAccess('form.create'),
    asyncHandler(async (req, res) => {
      const { id, title, description, accentColor, fields, confirmationMessage } = req.body || {};
      if (!title || !String(title).trim() || !Array.isArray(fields)) {
        res.status(400).json({ error: 'Form title and fields are required.' });
        return;
      }
      const userId = req.auth!.user.id;
      const formId =
        id ? String(id) : `form-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const existing = id ? await prisma.workspaceForm.findUnique({ where: { id: formId } }) : null;
      if (existing && existing.ownerUserId !== userId && !req.auth!.capabilities.isAdmin) {
        res.status(403).json({ error: 'Cannot modify another member form.' });
        return;
      }

      const saved = await prisma.workspaceForm.upsert({
        where: { id: formId },
        update: {
          title: String(title).trim(),
          description: String(description || '').trim(),
          accentColor: String(accentColor || '#0D9488'),
          fieldsJson: fields,
          confirmationMessage:
            String(confirmationMessage || '').trim() || 'Thank you! Your response has been saved.',
        },
        create: {
          id: formId,
          title: String(title).trim(),
          description: String(description || '').trim(),
          accentColor: String(accentColor || '#0D9488'),
          isPublic: false,
          identityMode: 'OPTIONAL',
          targetSubmissions: 50,
          autoCloseOnTarget: false,
          confirmationMessage:
            String(confirmationMessage || '').trim() || 'Thank you! Your response has been saved.',
          fieldsJson: fields,
          ownerUserId: userId,
          createdAt: new Date().toLocaleDateString([], {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
          timestampMs: BigInt(Date.now()),
        },
      });

      res.json({ ok: true, form: stripBigIntTimestamp(saved) });
    })
  );

  // Scoped Member Posts (only if post.create is permitted; publish requires post.publish!)
  app.post(
    '/api/member/posts',
    requireAuth,
    requireModuleAccess('posts'),
    requireActionAccess('post.create'),
    asyncHandler(async (req, res) => {
      const { title, summary, content, type, publishNow } = req.body || {};
      if (!title || !String(title).trim() || !content || !String(content).trim()) {
        res.status(400).json({ error: 'Title and content are required.' });
        return;
      }

      const canPublish = hasActionCapability(req.auth!.capabilities, 'post.publish');
      const status = publishNow && canPublish ? 'PUBLISHED' : 'DRAFT';
      const user = req.auth!.user;
      const nowStr = new Date().toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      const saved = await prisma.workspacePostNotice.create({
        data: {
          id: `pn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          type: type === 'NOTICE' ? 'NOTICE' : 'POST',
          title: String(title).trim(),
          summary: String(summary || content).replace(/\s+/g, ' ').trim().slice(0, 140),
          content: String(content),
          categoryId: 'cat-general',
          categoryName: 'General',
          authorName: user.name,
          authorRole: user.role,
          ownerUserId: user.id,
          status,
          isPinned: false,
          priority: 'Normal',
          createdAt: nowStr,
          updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          timestampMs: BigInt(Date.now()),
        },
      });

      res.json({
        ok: true,
        item: stripBigIntTimestamp(saved),
        status,
      });
    })
  );

  // Scoped Member Channel Messages (checks ChannelMembership + channel.send_member!)
  app.post(
    '/api/member/chat/:channelId/messages',
    requireAuth,
    requireModuleAccess('chat'),
    requireActionAccess('channel.send_member'),
    asyncHandler(async (req, res) => {
      const channelId = req.params.channelId;
      const { text } = req.body || {};
      if (!text || !String(text).trim()) {
        res.status(400).json({ error: 'Message text is required.' });
        return;
      }

      const user = req.auth!.user;
      const channel = await prisma.workspaceChatChannel.findUnique({ where: { id: channelId } });
      if (!channel) {
        res.status(404).json({ error: 'Channel not found.' });
        return;
      }
      if (!req.auth!.capabilities.isAdmin) {
        if (channel.isWorkspaceWide) {
          res.status(403).json({ error: 'Workspace-wide channels are restricted to Admins.' });
          return;
        }
        const membership = await prisma.channelMembership.findUnique({
          where: { channelId_userId: { channelId, userId: user.id } },
        });
        if (!membership && channel.ownerUserId !== user.id) {
          res.status(403).json({ error: 'You are not a member of this channel.' });
          return;
        }
      }

      const created = await prisma.workspaceChatMessage.create({
        data: {
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          channelId,
          senderName: user.name,
          senderEmail: user.email,
          text: String(text).trim(),
          isPinned: false,
          createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          timestampMs: BigInt(Date.now()),
        },
      });

      const msgDto = stripBigIntTimestamp(created);
      broadcastRealtimeEvent('chat:message', msgDto);
      res.json({
        ok: true,
        message: msgDto,
      });
    })
  );

  // Scoped Member File Upload with Strict Quota & Max-File-Size Enforcement
  app.post(
    '/api/member/files/upload',
    requireAuth,
    requireModuleAccess('files'),
    requireActionAccess('file.upload_own'),
    asyncHandler(async (req, res) => {
      const { originalName, mimeType, dataUrl } = req.body || {};
      if (!dataUrl || !originalName) {
        res.status(400).json({ error: 'File payload and file name are required.' });
        return;
      }
      const matches = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) {
        res.status(400).json({ error: 'Invalid base64 file payload.' });
        return;
      }

      const rawBuffer = Buffer.from(matches[2], 'base64');
      const user = req.auth!.user;

      if (rawBuffer.byteLength > user.maxFileSizeBytes) {
        res.status(413).json({
          error: `File exceeds your per-file upload limit (${Math.round(
            user.maxFileSizeBytes / (1024 * 1024)
          )} MB max).`,
        });
        return;
      }

      const rawMime = String(mimeType || matches[1] || 'application/octet-stream');
      const cleanOrig = sanitizeUnicodeFilename(String(originalName), 'member-file');
      const optimized = await optimizeUploadedImageBuffer(rawBuffer, rawMime, cleanOrig);
      const fileBuffer = optimized.buffer;
      const byteLength = fileBuffer.byteLength;
      const originalBytes = optimized.originalBytes;
      const compressionRatio =
        originalBytes > byteLength
          ? Math.round(((originalBytes - byteLength) / originalBytes) * 100)
          : 0;

      const currentUsed = await getUserUsedStorageBytes(user.id);
      if (currentUsed + byteLength > user.storageQuotaBytes) {
        res.status(413).json({
          error: `Storage quota exceeded. Please delete older files or ask Admin for more space.`,
          usedBytes: currentUsed,
          quotaBytes: user.storageQuotaBytes,
        });
        return;
      }

      const detectedMime = optimized.mimeType || rawMime;
      const ext =
        (optimized.optimized ? optimized.extension : path.extname(cleanOrig).replace('.', '').toLowerCase()) ||
        'bin';
      const baseOnly = path.basename(cleanOrig, path.extname(cleanOrig));
      const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${baseOnly.replace(/[?#%&]/g, '_').slice(0, 60)}.${ext}`;
      ensureExternalStorageDirs();
      const diskPath = path.join(UPLOADS_DIR, uniqueName);
      fs.writeFileSync(diskPath, fileBuffer);

      try {
        const fileId = `file-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
        const isImg = detectedMime.startsWith('image/') && !detectedMime.includes('svg');
        const thumbInfo = isImg ? await generateImageThumbnailForFile(diskPath, fileId) : {};
        const extracted = await extractSearchableTextFromFile(diskPath, ext);

        const saved = await prisma.$transaction(async (tx) => {
          const freshAgg = await tx.workspaceFile.aggregate({
            where: { ownerUserId: user.id, deletedAt: null },
            _sum: { compressedSizeBytes: true },
          });
          const freshUsed = Number(freshAgg._sum.compressedSizeBytes || BigInt(0));
          if (freshUsed + byteLength > user.storageQuotaBytes) {
            throw Object.assign(new Error('Storage quota exceeded during concurrent upload.'), {
              statusCode: 413,
            });
          }

          return tx.workspaceFile.create({
            data: {
              id: fileId,
              folderId: 'folder-general',
              folderName: 'My Personal Files',
              name: `${baseOnly}.${ext}`,
              originalName: cleanOrig,
              mimeType: detectedMime,
              extension: ext,
              isImage: detectedMime.startsWith('image/'),
              width: optimized.width ?? thumbInfo.width ?? null,
              height: optimized.height ?? thumbInfo.height ?? null,
              originalSizeBytes: BigInt(originalBytes),
              compressedSizeBytes: BigInt(byteLength),
              compressionRatio,
              url: `/uploads/${encodeURIComponent(uniqueName)}`,
              storagePath: `external/uploads/${uniqueName}`,
              thumbnailUrl: thumbInfo.thumbnailUrl || null,
              bodyText: extracted.text || null,
              ownerUserId: user.id,
              visibility: 'PRIVATE',
              versionCount: 1,
              uploadedAt: new Date().toLocaleString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              }),
              timestampMs: BigInt(Date.now()),
            },
          });
        });

        buildEnginePayloadForFile(saved.id).catch(() => {});

        const nextUsed = await getUserUsedStorageBytes(user.id);
        res.json({
          ok: true,
          file: {
            ...stripBigIntTimestamp(saved),
            originalSizeBytes: Number(saved.originalSizeBytes),
            compressedSizeBytes: Number(saved.compressedSizeBytes),
          },
          usedBytes: nextUsed,
        });
      } catch (err: any) {
        if (fs.existsSync(diskPath)) fs.unlinkSync(diskPath);
        if (err?.statusCode === 413) {
          res.status(413).json({ error: err.message });
          return;
        }
        throw err;
      }
    })
  );

  app.delete(
    '/api/member/files/:id',
    requireAuth,
    requireModuleAccess('files'),
    asyncHandler(async (req, res) => {
      const target = await prisma.workspaceFile.findUnique({ where: { id: req.params.id } });
      if (!target) {
        res.status(404).json({ error: 'File not found.' });
        return;
      }
      if (target.ownerUserId !== req.auth!.user.id && !req.auth!.capabilities.isAdmin) {
        res.status(403).json({ error: 'You can only delete files you own.' });
        return;
      }
      await deleteWorkspaceFileAssets(target.id, target);
      const nextUsed = await getUserUsedStorageBytes(req.auth!.user.id);
      res.json({ ok: true, usedBytes: nextUsed });
    })
  );

  // Scoped Member Slides (Create/Update/Delete own decks)
  app.post(
    '/api/member/slides',
    requireAuth,
    requireModuleAccess('slides'),
    requireActionAccess('slide.create'),
    asyncHandler(async (req, res) => {
      const { id, title, subtitle, category, themeColor, pages } = req.body || {};
      if (!title || !String(title).trim()) {
        res.status(400).json({ error: 'Presentation title is required.' });
        return;
      }
      const user = req.auth!.user;
      const slideId =
        id ? String(id) : `slide-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const existing = id ? await prisma.workspaceSlide.findUnique({ where: { id: slideId } }) : null;
      if (existing && existing.ownerUserId !== user.id && !req.auth!.capabilities.isAdmin) {
        res.status(403).json({ error: 'Cannot edit another member slide deck.' });
        return;
      }

      const normalizedPages =
        Array.isArray(pages) && pages.length > 0
          ? pages
          : [
              {
                id: `sp-${Date.now()}-1`,
                slideNumber: 1,
                layout: 'TITLE_COVER',
                title: String(title).trim(),
                subtitle: String(subtitle || 'Presentation').trim(),
                bullets: ['Key points'],
                speakerNotes: '',
              },
            ];

      const saved = await prisma.workspaceSlide.upsert({
        where: { id: slideId },
        update: {
          title: String(title).trim(),
          subtitle: String(subtitle || '').trim(),
          category: String(category || 'Presentations').trim(),
          themeColor: String(themeColor || '#0D9488'),
          pagesJson: normalizedPages,
          slideCount: normalizedPages.length,
          updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          timestampMs: BigInt(Date.now()),
        },
        create: {
          id: slideId,
          title: String(title).trim(),
          subtitle: String(subtitle || '').trim(),
          category: String(category || 'Presentations').trim(),
          themeColor: String(themeColor || '#0D9488'),
          authorName: user.name,
          pagesJson: normalizedPages,
          slideCount: normalizedPages.length,
          ownerUserId: user.id,
          visibility: 'PRIVATE',
          createdAt: new Date().toLocaleDateString([], {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
          updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          timestampMs: BigInt(Date.now()),
        },
      });

      res.json({
        ok: true,
        slide: { ...stripBigIntTimestamp(saved), pages: saved.pagesJson },
      });
    })
  );
}
