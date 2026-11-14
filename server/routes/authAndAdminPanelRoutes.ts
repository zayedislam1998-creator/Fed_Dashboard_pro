import { queueWorkspaceMail } from '../mail/workspaceMailAutomation';
import crypto from 'crypto';
import express from 'express';
import nodemailer from 'nodemailer';
import {
  decryptSecret,
  hashPasswordScrypt,
  prisma,
  verifyPasswordScrypt,
} from '../db/prisma';
import { ensureWorkspaceBootstrap, syncWorkspaceUsersToMembers } from '../db/initEngine';
import { sanitizeAdminUser, toCmhProjectDto, toCmhTaskDto } from '../db/mappers';
import {
  evaluateEffectiveCapabilities,
  MEMBER_MODULE_POOL,
  MEMBER_PRESETS,
  PERMISSION_CATALOG,
  PROJECT_GRANT_ACTIONS,
  recordAuditEvent,
} from '../auth/policy';
import {
  checkLoginRateLimit,
  clearLoginFailure,
  clearSessionCookie,
  createSessionForUser,
  extractSessionTokenFromRequest,
  getUserUsedStorageBytes,
  hashTokenSha256,
  recordLoginFailure,
  requireAdmin,
  requireAuth,
} from '../auth/sessionAuth';
import { asyncHandler, broadcastRealtimeEvent, recordAndBroadcastNotification } from '../realtime';

function escapeHtml(raw: string): string {
  return String(raw)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function sendWorkspaceInviteEmail(params: {
  toEmail: string;
  recipientName: string;
  inviterName: string;
  inviterEmail: string;
  role: string;
  inviteUrl: string;
}): Promise<{ sent: boolean; fromEmail?: string; error?: string }> {
  const serverAcc = await prisma.serverMailAccount.findFirst();
  const gmailAcc = serverAcc ? null : await prisma.gmailAccount.findFirst();
  const sender = serverAcc || gmailAcc;
  if (!sender) {
    return {
      sent: false,
      error: 'No Server Mail or Gmail SMTP account configured in Settings.',
    };
  }

  try {
    const pass = decryptSecret(sender.encryptedPassword);
    const transporter = nodemailer.createTransport({
      host: sender.smtpHost,
      port: sender.smtpPort,
      secure: sender.smtpSecure,
      auth: { user: sender.username || sender.email, pass },
      // SECURITY: TLS certificate validation — defaults to true; set MAIL_TLS_STRICT=false to disable
      tls: { rejectUnauthorized: process.env.MAIL_TLS_STRICT !== 'false' },
    });

    const safeName = escapeHtml(params.recipientName);
    const safeInviter = escapeHtml(`${params.inviterName} (${params.inviterEmail})`);
    const safeUrl = escapeHtml(params.inviteUrl);

    await transporter.sendMail({
      from: `"${sender.label}" <${sender.email}>`,
      to: params.toEmail,
      subject: `${params.inviterName} invited you to Workspace Pro`,
      text: [
        `Hello ${params.recipientName},`,
        '',
        `${params.inviterName} (${params.inviterEmail}) invited you to join Workspace Pro as a ${params.role}.`,
        'Open your secure onboarding link below to verify your name, generate your password, and complete your profile:',
        params.inviteUrl,
      ].join('\n'),
      html: `
        <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:24px auto;padding:28px;border:1px solid #e2e8f0;border-radius:16px;background:#ffffff;color:#0f172a;">
          <h2 style="margin:0 0 8px;font-size:20px;color:#0B57D0;">You're Invited to Workspace Pro</h2>
          <p style="margin:0 0 16px;font-size:14px;color:#475569;">Hello <strong>${safeName}</strong>,</p>
          <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#334155;">
            <strong>${safeInviter}</strong> has invited you as a <strong>${escapeHtml(params.role)}</strong>.
            Click below to view your invitation details, generate your secure password, and complete registration:
          </p>
          <p style="margin:0 0 22px;">
            <a href="${safeUrl}" style="display:inline-block;padding:12px 22px;background:#0B57D0;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600;font-size:14px;">
              Complete Account Setup
            </a>
          </p>
          <p style="margin:0;font-size:12px;color:#64748b;word-break:break-all;">Or copy link: ${safeUrl}</p>
        </div>
      `,
    });

    return { sent: true, fromEmail: sender.email };
  } catch (err: any) {
    return {
      sent: false,
      fromEmail: sender.email,
      error: err?.message || 'SMTP delivery failed.',
    };
  }
}

export async function buildScopedMemberPreview(userId: string) {
  const targetUser = await prisma.workspaceUser.findUnique({
    where: { id: userId },
    include: {
      accessPolicy: true,
      projectGrants: true,
    },
  });
  if (!targetUser) return null;

  const caps = evaluateEffectiveCapabilities(
    targetUser,
    targetUser.accessPolicy,
    targetUser.projectGrants
  );
  const usedBytes = await getUserUsedStorageBytes(targetUser.id);

  // Resolve linked directory member & team if connected
  const lowerUserEmail = targetUser.email.trim().toLowerCase();
  const linkedMember = targetUser.memberId
    ? await prisma.workspaceMember.findUnique({ where: { id: targetUser.memberId } })
    : await prisma.workspaceMember.findFirst({
        where: {
          OR: [{ email: targetUser.email }, { email: lowerUserEmail }],
        },
      });

  const canTasks = caps.allowedModules.includes('cmh_tasks');
  const canProjects = caps.allowedModules.includes('cmh_projects');
  const canPosts = caps.allowedModules.includes('posts');
  const canDocs = caps.allowedModules.includes('docs');
  const canForms = caps.allowedModules.includes('forms');
  const canSlides = caps.allowedModules.includes('slides');
  const canFiles = caps.allowedModules.includes('files');
  const canChat = caps.allowedModules.includes('chat');
  const canTeams = caps.allowedModules.includes('teams');

  const [taskAssignments, shares, channelMemberships] = await Promise.all([
    canTasks ? prisma.taskAssignment.findMany({ where: { userId: targetUser.id } }) : Promise.resolve([]),
    canDocs || canForms || canSlides || canFiles
      ? prisma.resourceShare.findMany({ where: { targetUserId: targetUser.id } })
      : Promise.resolve([]),
    canChat ? prisma.channelMembership.findMany({ where: { userId: targetUser.id } }) : Promise.resolve([]),
  ]);
  const ownedByMember = { ownerUserId: targetUser.id };
  const assignmentFilters = [
    ...(linkedMember ? [{ assignedMemberIdsJson: { array_contains: [linkedMember.id] } }] : []),
    ...(linkedMember?.teamId ? [{ assignedTeamIdsJson: { array_contains: [linkedMember.teamId] } }] : []),
  ];
  const sharedIds = (resourceType: string) =>
    shares.filter((share) => share.resourceType === resourceType).map((share) => share.resourceId);
  const ownedOrShared = (resourceType: string) => ({
    OR: [ownedByMember, { id: { in: sharedIds(resourceType) } }],
  });
  const taskProjectIds = caps.projectGrants
    .filter((grant) => grant.actions.includes('project.manage_tasks'))
    .map((grant) => grant.projectId);

  const [allTasks, allProjects, posts, docs, forms, slides, files, folders, channels, members, teamGroups] =
    await Promise.all([
      canTasks ? prisma.cmhTask.findMany({
        where: { OR: [
          ownedByMember,
          { id: { in: taskAssignments.map((assignment) => assignment.taskId) } },
          { projectId: { in: taskProjectIds } },
          ...assignmentFilters,
        ] },
        orderBy: [{ timestampMs: 'desc' }, { id: 'desc' }],
      }) : Promise.resolve([]),
      canProjects ? prisma.cmhProject.findMany({
        where: { OR: [
          ownedByMember,
          { id: { in: caps.projectGrants.map((grant) => grant.projectId) } },
          ...assignmentFilters,
        ] },
        orderBy: [{ timestampMs: 'desc' }, { id: 'desc' }],
      }) : Promise.resolve([]),
      canPosts ? prisma.workspacePostNotice.findMany({
        where: { OR: [ownedByMember, { status: 'PUBLISHED' }] },
        orderBy: [{ timestampMs: 'desc' }, { id: 'desc' }],
      }) : Promise.resolve([]),
      canDocs ? prisma.workspaceDoc.findMany({
        where: ownedOrShared('DOC'),
        orderBy: [{ timestampMs: 'desc' }, { id: 'desc' }],
      }) : Promise.resolve([]),
      canForms ? prisma.workspaceForm.findMany({
        where: ownedOrShared('FORM'),
        include: { submissions: { orderBy: [{ timestampMs: 'desc' }, { id: 'desc' }] } },
        orderBy: [{ timestampMs: 'desc' }, { id: 'desc' }],
      }) : Promise.resolve([]),
      canSlides ? prisma.workspaceSlide.findMany({
        where: ownedOrShared('SLIDE'),
        orderBy: [{ timestampMs: 'desc' }, { id: 'desc' }],
      }) : Promise.resolve([]),
      canFiles ? prisma.workspaceFile.findMany({
        where: {
          deletedAt: null,
          OR: [...ownedOrShared('FILE').OR, { visibility: 'WORKSPACE' }],
        },
        orderBy: [{ timestampMs: 'desc' }, { id: 'desc' }],
      }) : Promise.resolve([]),
      canFiles ? prisma.workspaceFolder.findMany({ orderBy: { timestampMs: 'asc' } }) : Promise.resolve([]),
      canChat ? prisma.workspaceChatChannel.findMany({
        where: {
          isWorkspaceWide: false,
          OR: [ownedByMember, { id: { in: channelMemberships.map((membership) => membership.channelId) } }],
        },
        orderBy: [{ timestampMs: 'desc' }, { id: 'desc' }],
      }) : Promise.resolve([]),
      canTeams ? prisma.workspaceMember.findMany({ orderBy: { timestampMs: 'desc' } }) : Promise.resolve([]),
      canTeams ? prisma.workspaceTeamGroup.findMany({ orderBy: { timestampMs: 'asc' } }) : Promise.resolve([]),
    ]);

  const grantMap = new Map(caps.projectGrants.map((g) => [g.projectId, g]));

  const scopedTasks = caps.allowedModules.includes('cmh_tasks')
    ? allTasks.map(toCmhTaskDto)
    : [];

  const scopedProjects = caps.allowedModules.includes('cmh_projects')
    ? allProjects.map((p) => {
          const dto = toCmhProjectDto(p);
          const grant = grantMap.get(p.id);
          const canSeeBudget = caps.isAdmin || Boolean(grant?.actions.includes('project.edit_details'));
          return {
            ...dto,
            budget: canSeeBudget ? dto.budget : '',
            myProjectRole: grant?.projectRole || 'PARTICIPANT',
            myProjectActions: grant?.actions || ['project.read_assigned'],
          };
        })
    : [];

  const scopedPosts = caps.allowedModules.includes('posts')
    ? posts.map((p) => ({
          id: p.id,
          type: p.type,
          title: p.title,
          summary: p.summary || '',
          content: p.content,
          categoryId: p.categoryId || 'cat-general',
          categoryName: p.categoryName,
          authorName: p.authorName,
          authorRole: p.authorRole || '',
          ownerUserId: p.ownerUserId || undefined,
          status: p.status,
          coverImageUrl: p.coverImageUrl || undefined,
          attachments: Array.isArray(p.attachmentsJson) ? p.attachmentsJson : [],
          isPinned: p.isPinned,
          priority: p.priority,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
          timestamp: Number(p.timestampMs),
        }))
    : [];

  const scopedDocs = caps.allowedModules.includes('docs')
    ? docs.map((d) => ({
          id: d.id,
          title: d.title,
          category: d.category,
          bodyText: d.bodyText,
          wordCount: d.wordCount,
          ownerUserId: d.ownerUserId || undefined,
          visibility: d.visibility,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
          timestamp: Number(d.timestampMs),
        }))
    : [];

  const scopedForms = caps.allowedModules.includes('forms')
    ? forms.map((f) => ({
          id: f.id,
          title: f.title,
          description: f.description || '',
          accentColor: f.accentColor,
          isPublic: f.isPublic,
          identityMode: f.identityMode,
          targetSubmissions: f.targetSubmissions,
          fields: Array.isArray(f.fieldsJson) ? f.fieldsJson : [],
          submissionsCount: f.submissions.length,
          submissions: f.submissions.map((s) => ({
            id: s.id,
            respondentName: s.respondentName,
            respondentEmail: s.respondentEmail,
            submittedAt: s.submittedAt,
            answers: s.answersJson,
          })),
          createdAt: f.createdAt,
          timestamp: Number(f.timestampMs),
        }))
    : [];

  const scopedSlides = caps.allowedModules.includes('slides')
    ? slides.map((s) => ({
          id: s.id,
          title: s.title,
          subtitle: s.subtitle || '',
          category: s.category,
          themeColor: s.themeColor,
          authorName: s.authorName,
          pages: Array.isArray(s.pagesJson) ? s.pagesJson : [],
          slideCount: s.slideCount,
          visibility: s.visibility,
          ownerUserId: s.ownerUserId || undefined,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
          timestamp: Number(s.timestampMs),
        }))
    : [];

  const scopedFiles = caps.allowedModules.includes('files')
    ? files.map((f) => ({
          id: f.id,
          folderId: f.folderId,
          folderName: f.folderName,
          name: f.name,
          mimeType: f.mimeType,
          extension: f.extension,
          isImage: f.isImage,
          compressedSizeBytes: Number(f.compressedSizeBytes),
          url: f.url,
          visibility: f.visibility,
          ownerUserId: f.ownerUserId || undefined,
          uploadedAt: f.uploadedAt,
          timestamp: Number(f.timestampMs),
        }))
    : [];

  const scopedChannels = caps.allowedModules.includes('chat')
    ? channels.map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description || '',
          channelType: c.channelType,
          createdAt: c.createdAt,
          timestamp: Number(c.timestampMs),
        }))
    : [];

  const allowedChannelIds = scopedChannels.map((c) => c.id);
  const scopedMessages =
    caps.allowedModules.includes('chat') && allowedChannelIds.length > 0
      ? (
          await prisma.workspaceChatMessage.findMany({
            where: { channelId: { in: allowedChannelIds } },
            orderBy: { timestampMs: 'asc' },
          })
        ).map((m) => ({
          id: m.id,
          channelId: m.channelId,
          senderName: m.senderName,
          senderEmail: m.senderEmail,
          text: m.text,
          isPinned: m.isPinned,
          createdAt: m.createdAt,
          timestamp: Number(m.timestampMs),
        }))
      : [];

  const scopedTeams = caps.allowedModules.includes('teams')
    ? {
        members: members.map((m) => ({
          id: m.id,
          fullName: m.fullName,
          email: m.email,
          designation: m.designation,
          teamId: m.teamId || '',
          teamName: m.teamName || '',
          avatarUrl: m.avatarUrl || undefined,
          status: m.status,
        })),
        groups: teamGroups.map((g) => ({
          id: g.id,
          name: g.name,
          description: g.description || '',
          color: g.color,
        })),
      }
    : { members: [], groups: [] };

  return {
    user: sanitizeAdminUser(targetUser),
    capabilities: caps,
    storage: {
      usedBytes,
      quotaBytes: Number(targetUser.storageQuotaBytes),
      maxFileSizeBytes: Number(targetUser.maxFileSizeBytes),
    },
    tasks: scopedTasks,
    projects: scopedProjects,
    posts: scopedPosts,
    docs: scopedDocs,
    forms: scopedForms,
    slides: scopedSlides,
    files: scopedFiles,
    folders: folders.map((f) => ({
      id: f.id,
      name: f.name,
      folderType: f.folderType,
      color: f.color,
    })),
    channels: scopedChannels,
    chatMessages: scopedMessages,
    teams: scopedTeams,
  };
}

// ============================================================================
// SECTION: Authentication
// ============================================================================
function registerAuthRoutes(app: express.Express) {
  // ============================================================================
  // AUTHENTICATION, OWNER ONBOARDING & MEMBER INVITATION ACCEPTANCE
  // ============================================================================

  app.get(
    '/api/auth/session',
    asyncHandler(
      async (req, res) => {
        if (!req.auth) {
          res.json({
            authenticated: false,
            user: null,
            capabilities: null,
          });
          return;
        }

        res.json({
          authenticated: true,
          user: req.auth.user,
          capabilities: req.auth.capabilities,
          storage: {
            usedBytes: req.auth.user.usedStorageBytes,
            quotaBytes: req.auth.user.storageQuotaBytes,
            maxFileSizeBytes: req.auth.user.maxFileSizeBytes,
          },
        });
      },
      { skipPrecheck: true }
    )
  );

  app.post(
    '/api/auth/login',
    asyncHandler(async (req, res) => {
      await ensureWorkspaceBootstrap();
      const { email, username, password } = req.body || {};
      const identifier = String(email || username || '').trim().toLowerCase();
      if (!identifier || !password) {
        res.status(400).json({ error: 'Email/username and password are required.' });
        return;
      }

      const rateKey = `${req.ip || 'local'}:${identifier}`;
      const rate = checkLoginRateLimit(rateKey);
      if (!rate.allowed) {
        res.status(429).json({
          error: `Too many failed sign-in attempts. Try again in ${rate.retryAfterSec}s.`,
        });
        return;
      }

      const lowerId = identifier.trim().toLowerCase();
      const user = await prisma.workspaceUser.findFirst({
        where: {
          OR: [
            { email: identifier },
            { email: lowerId },
            { username: identifier },
            { username: lowerId },
          ],
        },
        include: {
          accessPolicy: true,
          projectGrants: true,
        },
      });

      if (!user || !user.passwordHash || !verifyPasswordScrypt(String(password), user.passwordHash)) {
        recordLoginFailure(rateKey);
        res.status(401).json({ error: 'Invalid email or password.' });
        return;
      }

      if (!user.isActive) {
        res.status(403).json({
          error: 'This account has been suspended by the Workspace Administrator.',
        });
        return;
      }

      clearLoginFailure(rateKey);
      await createSessionForUser(user.id, req, res);
      await recordAuditEvent({
        actorUserId: user.id,
        actorEmail: user.email,
        action: 'auth.login',
        targetType: 'user',
        targetId: user.id,
        summary: `${user.name} (${user.role}) signed in`,
      });

      const capabilities = evaluateEffectiveCapabilities(
        user,
        user.accessPolicy,
        user.projectGrants
      );
      const usedBytes = await getUserUsedStorageBytes(user.id);

      res.json({
        ok: true,
        user: {
          ...sanitizeAdminUser(user),
          usedStorageBytes: usedBytes,
        },
        capabilities,
      });
    })
  );

  // Public Member Self-Registration (Always creates a scoped MEMBER + triggers Admin notification)
  app.post(
    '/api/auth/register',
    asyncHandler(async (req, res) => {
      await ensureWorkspaceBootstrap();
      const {
        firstName,
        lastName,
        email,
        password,
        phoneCountryCode,
        phoneNumber,
        countryCode,
        countryName,
        stateCode,
        stateName,
        cityName,
        addressLine,
        zipCode,
      } = req.body || {};

      const cleanFirst = String(firstName || '').trim();
      const cleanLast = String(lastName || '').trim();
      const cleanEmail = String(email || '').trim().toLowerCase();
      const cleanPhone = String(phoneNumber || '').trim();
      const cleanCountryName = String(countryName || '').trim();
      const cleanAddress = String(addressLine || '').trim();
      const cleanZip = String(zipCode || '').trim();

      if (!cleanFirst || !cleanLast) {
        res.status(400).json({ error: 'First name and last name are required.' });
        return;
      }
      if (!cleanEmail || !cleanEmail.includes('@')) {
        res.status(400).json({ error: 'A valid email address is required.' });
        return;
      }
      if (!password || String(password).length < 6) {
        res.status(400).json({ error: 'Password must be at least 6 characters.' });
        return;
      }
      if (!cleanPhone) {
        res.status(400).json({ error: 'Phone number is required.' });
        return;
      }
      if (!countryCode && !cleanCountryName) {
        res.status(400).json({ error: 'Country selection is required.' });
        return;
      }
      if (!cleanAddress) {
        res.status(400).json({ error: 'Street address is required.' });
        return;
      }

      const fullName = `${cleanFirst} ${cleanLast}`.trim();
      const preset = MEMBER_PRESETS.standard_member;
      const nowStr = new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      const createdUser = await prisma.$transaction(async (tx) => {
        const existing = await tx.workspaceUser.findFirst({
          where: {
            OR: [{ email: cleanEmail }, { username: cleanEmail }],
          },
        });
        if (existing) {
          throw Object.assign(new Error('An account with this email already exists. Please sign in.'), {
            statusCode: 409,
          });
        }

        const dirMember = await tx.workspaceMember.findFirst({
          where: { email: cleanEmail },
        });

        const userId = `usr-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
        await tx.workspaceUser.create({
          data: {
            id: userId,
            username: cleanEmail,
            email: cleanEmail,
            name: fullName,
            firstName: cleanFirst,
            lastName: cleanLast,
            role: 'MEMBER',
            passwordHash: hashPasswordScrypt(String(password)),
            passwordSet: true,
            phoneCountryCode: String(phoneCountryCode || '').trim() || null,
            phoneNumber: cleanPhone,
            countryCode: String(countryCode || '').trim().toUpperCase() || null,
            countryName: cleanCountryName || null,
            stateCode: String(stateCode || '').trim() || null,
            stateName: String(stateName || '').trim() || null,
            cityName: String(cityName || '').trim() || null,
            addressLine: cleanAddress,
            zipCode: cleanZip || null,
            memberTheme: 'cloud',
            memberId: dirMember?.id || null,
            storageQuotaBytes: BigInt(preset.defaultQuotaMb * 1024 * 1024),
            maxFileSizeBytes: BigInt(preset.defaultMaxFileMb * 1024 * 1024),
            isActive: true,
            createdAt: nowStr,
            updatedAt: nowStr,
            timestampMs: BigInt(Date.now()),
          },
        });

        await tx.memberAccessPolicy.create({
          data: {
            id: `pol-${userId}`,
            userId,
            presetKey: preset.key,
            allowedModulesJson: preset.defaultModules,
            restrictedModulesJson: [],
            allowedActionsJson: preset.defaultActions,
            deniedActionsJson: [],
            updatedAt: nowStr,
          },
        });

        if (dirMember) {
          await tx.workspaceMember
            .update({
              where: { id: dirMember.id },
              data: { status: 'Active' },
            })
            .catch(() => {});
        }

        await recordAuditEvent(
          {
            actorUserId: userId,
            actorEmail: cleanEmail,
            action: 'auth.register',
            targetType: 'user',
            targetId: userId,
            summary: `${fullName} (${cleanEmail}) registered from ${[
              String(cityName || '').trim(),
              String(stateName || '').trim(),
              cleanCountryName,
            ]
              .filter(Boolean)
              .join(', ')}`,
          },
          tx
        );

        return tx.workspaceUser.findUniqueOrThrow({
          where: { id: userId },
          include: { accessPolicy: true, projectGrants: true },
        });
      });

      const locationLabel = [
        String(cityName || '').trim(),
        String(stateName || '').trim(),
        cleanCountryName,
      ]
        .filter(Boolean)
        .join(', ');

      await recordAndBroadcastNotification({
        type: 'auth_activity',
        title: `New Member Registered: ${fullName}`,
        description: `${cleanEmail}${locationLabel ? ` • ${locationLabel}` : ''}`,
        module: 'admin_panel',
        targetId: createdUser.id,
      });

      await syncWorkspaceUsersToMembers();
      broadcastRealtimeEvent('members:updated', { userId: createdUser.id, ts: Date.now() });

      await createSessionForUser(createdUser.id, req, res);
      const capabilities = evaluateEffectiveCapabilities(
        createdUser,
        createdUser.accessPolicy,
        createdUser.projectGrants
      );

      res.status(201).json({
        ok: true,
        user: sanitizeAdminUser(createdUser),
        capabilities,
      });
    })
  );

  app.post(
    '/api/auth/logout',
    asyncHandler(async (req, res) => {
      const rawToken = extractSessionTokenFromRequest(req);
      if (rawToken) {
        await prisma.workspaceSession
          .updateMany({
            where: { tokenHash: hashTokenSha256(rawToken) },
            data: {
              revokedAt: new Date().toISOString(),
            },
          })
          .catch(() => {});
      }
      clearSessionCookie(req, res);
      res.json({ ok: true });
    })
  );

  app.post(
    '/api/auth/me/password',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { currentPassword, newPassword } = req.body || {};
      if (!newPassword || String(newPassword).length < 6) {
        res.status(400).json({ error: 'New password must be at least 6 characters.' });
        return;
      }

      const user = await prisma.workspaceUser.findUniqueOrThrow({
        where: { id: req.auth!.user.id },
      });

      if (user.passwordSet && user.passwordHash) {
        if (!currentPassword || !verifyPasswordScrypt(String(currentPassword), user.passwordHash)) {
          res.status(403).json({ error: 'Current password is incorrect.' });
          return;
        }
      }

      const nowStr = new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      const newHash = hashPasswordScrypt(String(newPassword));
      await prisma.workspaceUser.update({
        where: { id: user.id },
        data: {
          passwordHash: newHash,
          passwordSet: true,
          updatedAt: nowStr,
        },
      });

      await recordAuditEvent({
        actorUserId: user.id,
        actorEmail: user.email,
        action: 'auth.password_change',
        targetType: 'user',
        targetId: user.id,
        summary: `Password updated for ${user.email}`,
      });

      res.json({ ok: true });
    })
  );

  app.patch(
    '/api/auth/me/preferences',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { memberTheme, name } = req.body || {};
      const validTheme =
        memberTheme === 'mint' || memberTheme === 'lavender' || memberTheme === 'cloud'
          ? memberTheme
          : undefined;

      const updated = await prisma.workspaceUser.update({
        where: { id: req.auth!.user.id },
        data: {
          ...(validTheme ? { memberTheme: validTheme } : {}),
          ...(name && String(name).trim() ? { name: String(name).trim() } : {}),
          updatedAt: new Date().toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
        },
      });

      res.json({
        ok: true,
        user: sanitizeAdminUser(updated),
      });
    })
  );

  // One-time Invitation Verification & Account Onboarding (?app-invite=...)
  app.get(
    '/api/auth/invite/:token',
    asyncHandler(async (req, res) => {
      const tokenHash = hashTokenSha256(req.params.token);
      const invite = await prisma.workspaceInvitation.findUnique({ where: { tokenHash } });
      if (!invite || invite.revokedAt || invite.acceptedAt || Number(invite.expiresAt) < Date.now()) {
        res.status(404).json({ error: 'Invitation link is invalid, already used, or expired.' });
        return;
      }
      const nameParts = invite.name.trim().split(/\s+/);
      res.json({
        invitation: {
          email: invite.email,
          name: invite.name,
          firstName: invite.firstName || nameParts[0] || '',
          lastName: invite.lastName || nameParts.slice(1).join(' ') || '',
          targetRole: invite.targetRole,
          presetKey: invite.presetKey,
          invitedByName: invite.invitedByName || 'Workspace Administrator',
          invitedByEmail: invite.invitedByEmail || '',
          expiresAt: Number(invite.expiresAt),
        },
      });
    })
  );

  app.post(
    '/api/auth/invite/:token/accept',
    asyncHandler(async (req, res) => {
      const {
        name,
        firstName,
        lastName,
        password,
        phoneCountryCode,
        phoneNumber,
        countryCode,
        countryName,
        stateCode,
        stateName,
        cityName,
        addressLine,
        zipCode,
      } = req.body || {};
      if (!password || String(password).length < 6) {
        res.status(400).json({ error: 'Password must be at least 6 characters.' });
        return;
      }
      const tokenHash = hashTokenSha256(req.params.token);
      const invite = await prisma.workspaceInvitation.findUnique({ where: { tokenHash } });
      if (!invite || invite.revokedAt || invite.acceptedAt || Number(invite.expiresAt) < Date.now()) {
        res.status(400).json({ error: 'Invitation link is invalid, already used, or expired.' });
        return;
      }

      const preset = MEMBER_PRESETS[invite.presetKey] || MEMBER_PRESETS.standard_member;
      const nowStr = new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      const cleanFirst = String(firstName || invite.firstName || '').trim();
      const cleanLast = String(lastName || invite.lastName || '').trim();
      const combinedName = [cleanFirst, cleanLast].filter(Boolean).join(' ');
      const cleanName = combinedName || String(name || invite.name || invite.email.split('@')[0]).trim();

      const profileFields = {
        firstName: cleanFirst || null,
        lastName: cleanLast || null,
        ...(phoneCountryCode ? { phoneCountryCode: String(phoneCountryCode).trim() } : {}),
        ...(phoneNumber ? { phoneNumber: String(phoneNumber).trim() } : {}),
        ...(countryCode ? { countryCode: String(countryCode).trim().toUpperCase() } : {}),
        ...(countryName ? { countryName: String(countryName).trim() } : {}),
        ...(stateCode ? { stateCode: String(stateCode).trim() } : {}),
        ...(stateName ? { stateName: String(stateName).trim() } : {}),
        ...(cityName ? { cityName: String(cityName).trim() } : {}),
        ...(addressLine ? { addressLine: String(addressLine).trim() } : {}),
        ...(zipCode ? { zipCode: String(zipCode).trim() } : {}),
      };

      const createdOrUpdated = await prisma.$transaction(async (tx) => {
        const inviteLower = invite.email.trim().toLowerCase();
        const existingUser = await tx.workspaceUser.findFirst({
          where: { OR: [{ email: invite.email }, { email: inviteLower }] },
        });
        const userId =
          existingUser?.id || `usr-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;

        const userRow = await tx.workspaceUser.upsert({
          where: { id: userId },
          update: {
            name: cleanName,
            ...profileFields,
            passwordHash: hashPasswordScrypt(String(password)),
            passwordSet: true,
            isActive: true,
            ...(invite.memberId ? { memberId: invite.memberId } : {}),
            updatedAt: nowStr,
          },
          create: {
            id: userId,
            username: invite.email.toLowerCase(),
            email: invite.email.toLowerCase(),
            name: cleanName,
            ...profileFields,
            role: invite.targetRole === 'ADMIN' ? 'ADMIN' : 'MEMBER',
            passwordHash: hashPasswordScrypt(String(password)),
            passwordSet: true,
            memberTheme: 'cloud',
            memberId: invite.memberId || null,
            storageQuotaBytes: BigInt(preset.defaultQuotaMb * 1024 * 1024),
            maxFileSizeBytes: BigInt(preset.defaultMaxFileMb * 1024 * 1024),
            isActive: true,
            createdAt: nowStr,
            updatedAt: nowStr,
            timestampMs: BigInt(Date.now()),
          },
          include: { accessPolicy: true, projectGrants: true },
        });

        if (userRow.role === 'MEMBER' && !userRow.accessPolicy) {
          await tx.memberAccessPolicy.create({
            data: {
              id: `pol-${userRow.id}`,
              userId: userRow.id,
              presetKey: preset.key,
              allowedModulesJson: preset.defaultModules,
              restrictedModulesJson: [],
              allowedActionsJson: preset.defaultActions,
              deniedActionsJson: [],
              updatedById: invite.invitedById,
              updatedAt: nowStr,
            },
          });
        }

        if (invite.memberId) {
          await tx.workspaceMember
            .update({
              where: { id: invite.memberId },
              data: { status: 'Active' },
            })
            .catch(() => {});
        }

        await tx.workspaceInvitation.update({
          where: { id: invite.id },
          data: { acceptedAt: nowStr },
        });

        await recordAuditEvent(
          {
            actorUserId: userRow.id,
            actorEmail: userRow.email,
            action: 'invite.accept',
            targetType: 'user',
            targetId: userRow.id,
            summary: `${cleanName} (${userRow.email}) completed invitation & registration`,
          },
          tx
        );

        return tx.workspaceUser.findUniqueOrThrow({
          where: { id: userRow.id },
          include: { accessPolicy: true, projectGrants: true },
        });
      });

      await recordAndBroadcastNotification({
        type: 'auth_activity',
        title: `Invitation Completed: ${cleanName}`,
        description: `${createdOrUpdated.email} activated their account and set their password.`,
        module: 'admin_panel',
        targetId: createdOrUpdated.id,
      });

      await syncWorkspaceUsersToMembers();
      broadcastRealtimeEvent('members:updated', { userId: createdOrUpdated.id, ts: Date.now() });

      await createSessionForUser(createdOrUpdated.id, req, res);
      const capabilities = evaluateEffectiveCapabilities(
        createdOrUpdated,
        createdOrUpdated.accessPolicy,
        createdOrUpdated.projectGrants
      );
      res.json({
        ok: true,
        user: sanitizeAdminUser(createdOrUpdated),
        capabilities,
      });
    })
  );
}

// ============================================================================
// SECTION: Admin Panel
// ============================================================================
function registerAdminPanelRoutes(app: express.Express) {
  // ============================================================================
  // ADMIN PANEL CONTROL CENTER ROUTES (/api/admin/* — Strictly Admin Only)
  // ============================================================================

  app.get(
    '/api/admin/overview',
    requireAuth,
    requireAdmin,
    asyncHandler(async (_req, res) => {
      const [
        users,
        invitations,
        projects,
        tasks,
        channels,
        auditEvents,
        fileUsageRows,
        activeSessionsRows,
      ] = await Promise.all([
        prisma.workspaceUser.findMany({
          include: {
            accessPolicy: true,
            projectGrants: true,
            taskAssignments: true,
            channelMembers: true,
          },
          orderBy: { timestampMs: 'asc' },
        }),
        prisma.workspaceInvitation.findMany({
          orderBy: { expiresAt: 'desc' },
          take: 50,
        }),
        prisma.cmhProject.findMany({ orderBy: { timestampMs: 'desc' } }),
        prisma.cmhTask.findMany({ orderBy: { timestampMs: 'desc' } }),
        prisma.workspaceChatChannel.findMany({ orderBy: { timestampMs: 'desc' } }),
        prisma.auditEvent.findMany({ orderBy: { timestampMs: 'desc' }, take: 80 }),
        prisma.workspaceFile.groupBy({
          by: ['ownerUserId'],
          _sum: { compressedSizeBytes: true },
          _count: { id: true },
        }),
        prisma.workspaceSession.groupBy({
          by: ['userId'],
          where: { revokedAt: null, expiresAt: { gt: BigInt(Date.now()) } },
          _count: { id: true },
        }),
      ]);

      const usageMap = new Map(
        fileUsageRows.map((r) => [
          r.ownerUserId || '',
          {
            usedBytes: Number(r._sum.compressedSizeBytes || BigInt(0)),
            fileCount: r._count.id,
          },
        ])
      );
      const sessCountMap = new Map(activeSessionsRows.map((s) => [s.userId, s._count.id]));

      res.json({
        users: users.map((u) => {
          const caps = evaluateEffectiveCapabilities(u, u.accessPolicy, u.projectGrants);
          const usage = usageMap.get(u.id) || { usedBytes: 0, fileCount: 0 };
          return {
            ...sanitizeAdminUser(u),
            usedStorageBytes: usage.usedBytes,
            fileCount: usage.fileCount,
            activeSessionCount: sessCountMap.get(u.id) || 0,
            policy: u.accessPolicy
              ? {
                  presetKey: u.accessPolicy.presetKey,
                  allowedModules: u.accessPolicy.allowedModulesJson,
                  restrictedModules: u.accessPolicy.restrictedModulesJson,
                  allowedActions: u.accessPolicy.allowedActionsJson,
                  deniedActions: u.accessPolicy.deniedActionsJson,
                  updatedAt: u.accessPolicy.updatedAt,
                }
              : null,
            effectiveCapabilities: caps,
            assignedTaskIds: u.taskAssignments.map((a) => a.taskId),
            channelIds: u.channelMembers.map((c) => c.channelId),
          };
        }),
        invitations: invitations.map((inv) => ({
          id: inv.id,
          email: inv.email,
          name: inv.name,
          firstName: inv.firstName || undefined,
          lastName: inv.lastName || undefined,
          invitedByName: inv.invitedByName || undefined,
          invitedByEmail: inv.invitedByEmail || undefined,
          emailSent: inv.emailSent,
          targetRole: inv.targetRole,
          presetKey: inv.presetKey,
          expiresAt: Number(inv.expiresAt),
          acceptedAt: inv.acceptedAt || undefined,
          revokedAt: inv.revokedAt || undefined,
          createdAt: inv.createdAt,
        })),
        projects: projects.map(toCmhProjectDto),
        tasks: tasks.map(toCmhTaskDto),
        channels: channels.map((c) => ({
          id: c.id,
          name: c.name,
          channelType: c.channelType,
          isWorkspaceWide: c.isWorkspaceWide,
        })),
        presets: Object.values(MEMBER_PRESETS),
        memberModulePool: MEMBER_MODULE_POOL,
        permissionCatalog: PERMISSION_CATALOG,
        projectGrantActions: PROJECT_GRANT_ACTIONS,
        auditEvents: auditEvents.map((ev) => ({
          id: ev.id,
          actorEmail: ev.actorEmail,
          action: ev.action,
          targetType: ev.targetType || undefined,
          targetId: ev.targetId || undefined,
          summary: ev.summary,
          details: ev.detailsJson,
          createdAt: ev.createdAt,
          timestamp: Number(ev.timestampMs),
        })),
      });
    })
  );

  // Create Member or Admin Account + Smart Email & Link Invitation Flow
  app.post(
    '/api/admin/users',
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const {
        name,
        firstName,
        lastName,
        email,
        targetRole = 'MEMBER',
        presetKey = 'standard_member',
        storageQuotaMb,
        maxFileSizeMb,
        initialPassword,
        sendInvite = true,
        memberId,
        originUrl,
      } = req.body || {};

      const cleanEmail = String(email || '').trim().toLowerCase();
      if (!cleanEmail || !cleanEmail.includes('@')) {
        res.status(400).json({ error: 'Valid email address is required.' });
        return;
      }

      const resolvedRole =
        targetRole === 'ADMIN' && req.auth!.capabilities.isOwner ? 'ADMIN' : 'MEMBER';
      if (targetRole === 'ADMIN' && !req.auth!.capabilities.isOwner) {
        res.status(403).json({
          error: 'Only the Workspace Owner can appoint additional Administrators.',
        });
        return;
      }

      const preset = MEMBER_PRESETS[String(presetKey)] || MEMBER_PRESETS.standard_member;
      const quotaMb = Math.max(10, Number(storageQuotaMb) || preset.defaultQuotaMb);
      const maxFileMb = Math.max(1, Number(maxFileSizeMb) || preset.defaultMaxFileMb);
      const cleanFirst = String(firstName || '').trim();
      const cleanLast = String(lastName || '').trim();
      const fullFromParts = [cleanFirst, cleanLast].filter(Boolean).join(' ');
      const cleanName = fullFromParts || String(name || cleanEmail.split('@')[0]).trim();
      const nowStr = new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      const hasInitialPassword = Boolean(initialPassword && String(initialPassword).length >= 6);
      const shouldCreateInvite = sendInvite !== false || !hasInitialPassword;
      const rawInviteToken = crypto.randomBytes(24).toString('hex');
      const tokenHash = hashTokenSha256(rawInviteToken);

      const created = await prisma.$transaction(async (tx) => {
        const existing = await tx.workspaceUser.findFirst({
          where: { OR: [{ email: cleanEmail }, { username: cleanEmail }] },
        });
        if (existing) {
          throw Object.assign(new Error('An account with this email already exists.'), {
            statusCode: 409,
          });
        }

        const dirMember = memberId
          ? await tx.workspaceMember.findUnique({ where: { id: String(memberId) } })
          : await tx.workspaceMember.findFirst({
              where: { email: cleanEmail },
            });

        const userId = `usr-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
        const userRow = await tx.workspaceUser.create({
          data: {
            id: userId,
            username: cleanEmail,
            email: cleanEmail,
            name: cleanName,
            firstName: cleanFirst || null,
            lastName: cleanLast || null,
            role: resolvedRole,
            passwordHash: hasInitialPassword ? hashPasswordScrypt(String(initialPassword)) : null,
            passwordSet: hasInitialPassword,
            memberTheme: 'cloud',
            memberId: dirMember?.id || null,
            storageQuotaBytes: BigInt(quotaMb * 1024 * 1024),
            maxFileSizeBytes: BigInt(maxFileMb * 1024 * 1024),
            isActive: true,
            createdAt: nowStr,
            updatedAt: nowStr,
            timestampMs: BigInt(Date.now()),
          },
        });

        if (resolvedRole === 'MEMBER') {
          await tx.memberAccessPolicy.create({
            data: {
              id: `pol-${userRow.id}`,
              userId: userRow.id,
              presetKey: preset.key,
              allowedModulesJson: preset.defaultModules,
              restrictedModulesJson: [],
              allowedActionsJson: preset.defaultActions,
              deniedActionsJson: [],
              updatedById: req.auth!.user.id,
              updatedAt: nowStr,
            },
          });
        }

        let inviteRecord = null;
        if (shouldCreateInvite) {
          inviteRecord = await tx.workspaceInvitation.create({
            data: {
              id: `inv-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
              tokenHash,
              email: cleanEmail,
              name: cleanName,
              firstName: cleanFirst || null,
              lastName: cleanLast || null,
              targetRole: resolvedRole,
              presetKey: preset.key,
              memberId: dirMember?.id || null,
              invitedById: req.auth!.user.id,
              invitedByName: req.auth!.user.name,
              invitedByEmail: req.auth!.user.email,
              emailSent: false,
              expiresAt: BigInt(Date.now() + 7 * 24 * 60 * 60 * 1000),
              createdAt: nowStr,
            },
          });
        }

        await recordAuditEvent(
          {
            actorUserId: req.auth!.user.id,
            actorEmail: req.auth!.user.email,
            action: 'user.create',
            targetType: 'user',
            targetId: userRow.id,
            summary: `Created ${resolvedRole} account for ${cleanName} (${cleanEmail}, ${preset.label}, ${quotaMb}MB quota)`,
            details: {
              role: resolvedRole,
              presetKey: preset.key,
              quotaMb,
              hasInitialPassword,
              shouldCreateInvite,
            },
          },
          tx
        );

        return { userRow, inviteRecord };
      });

      const inviteUrl = shouldCreateInvite
        ? `${originUrl || 'http://127.0.0.1:3000'}/?app-invite=${encodeURIComponent(rawInviteToken)}`
        : undefined;

      let emailResult: { sent: boolean; fromEmail?: string; error?: string } = { sent: false };
      if (inviteUrl) {
        emailResult = await sendWorkspaceInviteEmail({
          toEmail: cleanEmail,
          recipientName: cleanName,
          inviterName: req.auth!.user.name,
          inviterEmail: req.auth!.user.email,
          role: resolvedRole,
          inviteUrl,
        });
        if (emailResult.sent && created.inviteRecord) {
          await prisma.workspaceInvitation
            .update({
              where: { id: created.inviteRecord.id },
              data: { emailSent: true },
            })
            .catch(() => {});
        }
      }

      await syncWorkspaceUsersToMembers();
      broadcastRealtimeEvent('members:updated', { userId: created.userRow.id, ts: Date.now() });

      res.json({
        ok: true,
        user: sanitizeAdminUser(created.userRow),
        inviteUrl,
        emailSent: emailResult.sent,
        emailFrom: emailResult.fromEmail,
        emailError: emailResult.error,
      });
    })
  );

  // Update User Role, Active/Suspended State, Module Restrictions, Action Overrides & Quota
  app.patch(
    '/api/admin/users/:id/access',
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const targetId = req.params.id;
      const {
        isActive,
        role,
        presetKey,
        allowedModules,
        restrictedModules,
        allowedActions,
        deniedActions,
        storageQuotaMb,
        maxFileSizeMb,
        memberId,
      } = req.body || {};

      const target = await prisma.workspaceUser.findUnique({
        where: { id: targetId },
        include: { accessPolicy: true },
      });
      if (!target) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }

      // Protect last active OWNER and restrict ADMIN promotion/demotion to OWNER
      if (target.role === 'OWNER') {
        const otherOwners = await prisma.workspaceUser.count({
          where: { role: 'OWNER', isActive: true, NOT: { id: target.id } },
        });
        if (otherOwners === 0) {
          if (isActive === false || (role && role !== 'OWNER')) {
            res.status(400).json({
              error: 'Cannot suspend or demote the last active Workspace Owner.',
            });
            return;
          }
        }
      }

      if (role && role !== target.role) {
        if (!req.auth!.capabilities.isOwner) {
          res.status(403).json({ error: 'Only Workspace Owner can change Admin/Owner roles.' });
          return;
        }
        if (target.id === req.auth!.user.id && role !== 'OWNER') {
          res.status(400).json({ error: 'Cannot demote your own Owner role.' });
          return;
        }
      }

      const nextRole =
        role === 'OWNER' || role === 'ADMIN' || role === 'MEMBER' ? role : target.role;
      const nextActive = typeof isActive === 'boolean' ? isActive : target.isActive;
      const nowStr = new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      const beforeSnapshot = {
        role: target.role,
        isActive: target.isActive,
        presetKey: target.accessPolicy?.presetKey,
        restrictedModules: target.accessPolicy?.restrictedModulesJson,
        deniedActions: target.accessPolicy?.deniedActionsJson,
        quotaMb: Math.round(Number(target.storageQuotaBytes) / (1024 * 1024)),
      };

      const updated = await prisma.$transaction(async (tx) => {
        const userRow = await tx.workspaceUser.update({
          where: { id: target.id },
          data: {
            role: nextRole,
            isActive: nextActive,
            permissionVersion: { increment: 1 },
            ...(typeof storageQuotaMb === 'number'
              ? { storageQuotaBytes: BigInt(Math.max(5, storageQuotaMb) * 1024 * 1024) }
              : {}),
            ...(typeof maxFileSizeMb === 'number'
              ? { maxFileSizeBytes: BigInt(Math.max(1, maxFileSizeMb) * 1024 * 1024) }
              : {}),
            ...(memberId !== undefined ? { memberId: memberId ? String(memberId) : null } : {}),
            updatedAt: nowStr,
          },
        });

        if (!nextActive) {
          await tx.workspaceSession.updateMany({
            where: { userId: target.id, revokedAt: null },
            data: { revokedAt: new Date().toISOString() },
          });
        }

        const preset = MEMBER_PRESETS[String(presetKey)] || MEMBER_PRESETS.standard_member;
        const nextAllowedModules = Array.isArray(allowedModules)
          ? allowedModules
          : Array.isArray(target.accessPolicy?.allowedModulesJson)
          ? target.accessPolicy!.allowedModulesJson
          : preset.defaultModules;
        const nextRestrictedModules = Array.isArray(restrictedModules)
          ? restrictedModules
          : Array.isArray(target.accessPolicy?.restrictedModulesJson)
          ? target.accessPolicy!.restrictedModulesJson
          : [];
        const nextAllowedActions = Array.isArray(allowedActions)
          ? allowedActions
          : Array.isArray(target.accessPolicy?.allowedActionsJson)
          ? target.accessPolicy!.allowedActionsJson
          : preset.defaultActions;
        const nextDeniedActions = Array.isArray(deniedActions)
          ? deniedActions
          : Array.isArray(target.accessPolicy?.deniedActionsJson)
          ? target.accessPolicy!.deniedActionsJson
          : [];

        await tx.memberAccessPolicy.upsert({
          where: { userId: target.id },
          update: {
            presetKey: String(presetKey || target.accessPolicy?.presetKey || 'custom'),
            allowedModulesJson: nextAllowedModules,
            restrictedModulesJson: nextRestrictedModules,
            allowedActionsJson: nextAllowedActions,
            deniedActionsJson: nextDeniedActions,
            updatedById: req.auth!.user.id,
            updatedAt: nowStr,
          },
          create: {
            id: `pol-${target.id}`,
            userId: target.id,
            presetKey: String(presetKey || preset.key),
            allowedModulesJson: nextAllowedModules,
            restrictedModulesJson: nextRestrictedModules,
            allowedActionsJson: nextAllowedActions,
            deniedActionsJson: nextDeniedActions,
            updatedById: req.auth!.user.id,
            updatedAt: nowStr,
          },
        });

        await recordAuditEvent(
          {
            actorUserId: req.auth!.user.id,
            actorEmail: req.auth!.user.email,
            action: nextActive ? 'user.access_update' : 'user.suspend',
            targetType: 'user',
            targetId: target.id,
            summary: `Updated access/restrictions for ${target.email} (${nextRole})`,
            details: {
              before: beforeSnapshot,
              after: {
                role: nextRole,
                isActive: nextActive,
                presetKey: presetKey || target.accessPolicy?.presetKey,
                restrictedModules: nextRestrictedModules,
                deniedActions: nextDeniedActions,
                quotaMb: Math.round(Number(userRow.storageQuotaBytes) / (1024 * 1024)),
              },
            },
          },
          tx
        );

        return userRow;
      });

      await syncWorkspaceUsersToMembers();
      broadcastRealtimeEvent('members:updated', { userId: updated.id, ts: Date.now() });
      broadcastRealtimeEvent('auth:permissions_updated', { userId: updated.id, ts: Date.now() });

      res.json({ ok: true, user: sanitizeAdminUser(updated) });
    })
  );

  // Fast direct role switcher from Admin Access & Users list
  app.patch(
    '/api/admin/users/:id/role',
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const targetId = req.params.id;
      const { role } = req.body || {};
      const validRoles = ['USER', 'MEMBER', 'ADMIN', 'OWNER'];
      if (!role || !validRoles.includes(role)) {
        res.status(400).json({ error: 'Valid role must be one of: USER, MEMBER, ADMIN, OWNER.' });
        return;
      }

      const target = await prisma.workspaceUser.findUnique({ where: { id: targetId } });
      if (!target) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }

      // Protect last active OWNER
      if (target.role === 'OWNER' && role !== 'OWNER') {
        const otherOwners = await prisma.workspaceUser.count({
          where: { role: 'OWNER', isActive: true, NOT: { id: target.id } },
        });
        if (otherOwners === 0) {
          res.status(400).json({ error: 'Cannot demote the last active Workspace Owner.' });
          return;
        }
      }

      // Restrict non-owners from elevating to OWNER
      if (role === 'OWNER' && !req.auth!.capabilities.isOwner) {
        res.status(403).json({ error: 'Only Workspace Owner can assign the OWNER role.' });
        return;
      }

      const updated = await prisma.workspaceUser.update({
        where: { id: targetId },
        data: {
          role,
          permissionVersion: { increment: 1 },
          updatedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        },
      });

      await syncWorkspaceUsersToMembers();
      broadcastRealtimeEvent('members:updated', { userId: updated.id, role, ts: Date.now() });
      broadcastRealtimeEvent('auth:permissions_updated', { userId: updated.id, role, ts: Date.now() });

      res.json({ ok: true, user: sanitizeAdminUser(updated) });
    })
  );

  // Assign Scoped Project Manager / Participant Grants + Task Assignments
  app.put(
    '/api/admin/users/:id/project-grants',
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const targetId = req.params.id;
      const { grants, assignedTaskIds, channelIds } = req.body || {};
      const target = await prisma.workspaceUser.findUnique({ where: { id: targetId } });
      if (!target) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }

      const nowStr = new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      await prisma.$transaction(async (tx) => {
        if (Array.isArray(grants)) {
          const previous = new Set((await tx.projectPermissionGrant.findMany({ where: { userId: targetId }, select: { projectId: true } })).map((row) => row.projectId));
          await tx.projectPermissionGrant.deleteMany({ where: { userId: targetId } });
          for (const g of grants) {
            if (!g?.projectId) continue;
            await tx.projectPermissionGrant.create({
              data: {
                id: `pgr-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
                projectId: String(g.projectId),
                userId: targetId,
                projectRole: g.projectRole === 'MANAGER' ? 'MANAGER' : 'PARTICIPANT',
                actionsJson: Array.isArray(g.actions) ? g.actions : ['project.read_assigned'],
                grantedById: req.auth!.user.id,
                expiresAt: g.expiresAt ? String(g.expiresAt) : null,
                createdAt: nowStr,
                updatedAt: nowStr,
              },
            });
            if (target.isActive && !previous.has(String(g.projectId))) {
              const item = await tx.cmhProject.findUnique({ where: { id: String(g.projectId) }, select: { id: true, title: true } });
              if (item) await queueWorkspaceMail('admin-assignment:' + item.id, [target.email], 'Assigned to you: ' + item.title,
                'Sign in to Workspace Pro to open the assigned item.', tx);
            }
          }
        }

        if (Array.isArray(assignedTaskIds)) {
          const previous = new Set((await tx.taskAssignment.findMany({ where: { userId: targetId }, select: { taskId: true } })).map((row) => row.taskId));
          await tx.taskAssignment.deleteMany({ where: { userId: targetId } });
          for (const tId of assignedTaskIds) {
            if (!tId) continue;
            await tx.taskAssignment.create({
              data: {
                id: `tas-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
                taskId: String(tId),
                userId: targetId,
                canUpdateProgress: true,
                createdAt: nowStr,
              },
            });
            if (target.isActive && !previous.has(String(tId))) {
              const item = await tx.cmhTask.findUnique({ where: { id: String(tId) }, select: { id: true, title: true } });
              if (item) await queueWorkspaceMail('admin-assignment:' + item.id, [target.email], 'Assigned to you: ' + item.title,
                'Sign in to Workspace Pro to open the assigned item.', tx);
            }
          }
        }

        if (Array.isArray(channelIds)) {
          await tx.channelMembership.deleteMany({ where: { userId: targetId } });
          for (const cId of channelIds) {
            if (!cId) continue;
            await tx.channelMembership.create({
              data: {
                id: `chm-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
                channelId: String(cId),
                userId: targetId,
                channelRole: 'MEMBER',
                createdAt: nowStr,
              },
            });
          }
        }

        await tx.workspaceUser.update({
          where: { id: targetId },
          data: { permissionVersion: { increment: 1 } },
        });

        await recordAuditEvent(
          {
            actorUserId: req.auth!.user.id,
            actorEmail: req.auth!.user.email,
            action: 'project.grants_update',
            targetType: 'user',
            targetId,
            summary: `Updated project grants, task assignments & channels for ${target.email}`,
            details: { grants, assignedTaskIds, channelIds },
          },
          tx
        );
      });

      broadcastRealtimeEvent('auth:permissions_updated', { userId: targetId });
      res.json({ ok: true });
    })
  );

  app.get(
    '/api/admin/users/:id/sessions',
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const sessions = await prisma.workspaceSession.findMany({
        where: { userId: req.params.id },
        orderBy: { lastSeenAt: 'desc' },
        take: 25,
      });
      res.json({
        sessions: sessions.map((s) => ({
          id: s.id,
          userAgent: s.userAgent || 'Browser Session',
          ipAddress: s.ipAddress || 'localhost',
          createdAt: s.createdAt,
          lastSeenAt: Number(s.lastSeenAt),
          expiresAt: Number(s.expiresAt),
          revokedAt: s.revokedAt || undefined,
        })),
      });
    })
  );

  app.post(
    '/api/admin/users/:id/revoke-sessions',
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const targetId = req.params.id;
      await prisma.$transaction(async (tx) => {
        await tx.workspaceSession.updateMany({
          where: { userId: targetId, revokedAt: null },
          data: { revokedAt: new Date().toISOString() },
        });
        await tx.workspaceUser.update({
          where: { id: targetId },
          data: { permissionVersion: { increment: 1 } },
        });
        await recordAuditEvent(
          {
            actorUserId: req.auth!.user.id,
            actorEmail: req.auth!.user.email,
            action: 'session.revoke_all',
            targetType: 'user',
            targetId,
            summary: `Force-revoked all active sessions for user ${targetId}`,
          },
          tx
        );
      });

      broadcastRealtimeEvent('auth:permissions_updated', { userId: targetId, revoked: true });
      res.json({ ok: true });
    })
  );

  app.delete(
    '/api/admin/invitations/:id',
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      await prisma.workspaceInvitation.updateMany({
        where: { id: req.params.id },
        data: { revokedAt: new Date().toISOString() },
      });
      res.json({ ok: true });
    })
  );

  // Read-Only "Preview As Member" (Audit logged, never creates member session)
  app.get(
    '/api/admin/preview-member/:userId',
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const preview = await buildScopedMemberPreview(req.params.userId);
      if (!preview) {
        res.status(404).json({ error: 'Member account not found.' });
        return;
      }
      await recordAuditEvent({
        actorUserId: req.auth!.user.id,
        actorEmail: req.auth!.user.email,
        action: 'admin.preview_member',
        targetType: 'user',
        targetId: req.params.userId,
        summary: `Read-only Member Portal preview for ${preview.user.email}`,
      });
      res.json(preview);
    })
  );
}

// ============================================================================
// MAIN ORCHESTRATOR
// ============================================================================
export function registerAuthAndAdminPanelRoutes(app: express.Express) {
  registerAuthRoutes(app);
  registerAdminPanelRoutes(app);
}
