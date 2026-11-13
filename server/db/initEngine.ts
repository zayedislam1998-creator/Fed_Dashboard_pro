import crypto from 'crypto';
import {
  DEFAULT_ADMIN_NAME,
  DEFAULT_ADMIN_USERNAME,
  hashPasswordScrypt,
  prisma,
} from './prisma';

const DEFAULT_ADMIN_EMAIL = DEFAULT_ADMIN_USERNAME;

export const STRUCTURAL_DEFAULT_FOLDERS = [
  {
    id: 'folder-general',
    name: 'General Server Files',
    folderType: 'SYSTEM',
    parentFolderId: null,
    description: 'Default workspace file storage',
    color: '#0B57D0',
  },
  {
    id: 'folder-images',
    name: 'Workspace Images & Media',
    folderType: 'SYSTEM',
    parentFolderId: null,
    description: 'Compressed images, screenshots, and media assets',
    color: '#137333',
  },
  {
    id: 'folder-documents',
    name: 'Office Documents & PDFs',
    folderType: 'SYSTEM',
    parentFolderId: null,
    description: 'Word, Excel, PowerPoint, and PDF documents',
    color: '#B06000',
  },
];

export const DEFAULT_TEAM_GROUPS = [
  {
    id: 'team-exec',
    name: 'Executive Leadership',
    description: 'Founders, owners, and executive leadership',
    color: '#0B57D0',
  },
  {
    id: 'team-eng',
    name: 'Core Engineering',
    description: 'Platform architecture, backend, and frontend engineering',
    color: '#137333',
  },
  {
    id: 'team-design',
    name: 'Product & Design',
    description: 'UI/UX design, product strategy, and research',
    color: '#7C3AED',
  },
  {
    id: 'team-ops',
    name: 'Operations & Growth',
    description: 'Operations, finance, HR, and client success',
    color: '#D97706',
  },
];

let lastInitTimestamp = 0;

function formatNowLabel(): string {
  return new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export async function ensureDefaultTeamGroups() {
  const nowLabel = formatNowLabel();
  const nowMs = BigInt(Date.now());
  for (const group of DEFAULT_TEAM_GROUPS) {
    await prisma.workspaceTeamGroup.upsert({
      where: { id: group.id },
      update: {},
      create: {
        id: group.id,
        name: group.name,
        description: group.description,
        color: group.color,
        createdAt: nowLabel,
        timestampMs: nowMs,
      },
    });
  }
}

export async function getPrimaryAdminIdentity(): Promise<{
  id: string;
  username: string;
  email: string;
  name: string;
}> {
  const admin = await prisma.workspaceUser.findFirst({
    where: { role: { in: ['OWNER', 'ADMIN'] } },
    orderBy: { timestampMs: 'asc' },
  });
  if (admin) {
    return {
      id: admin.id,
      username: admin.username,
      email: admin.email,
      name: admin.name,
    };
  }
  return {
    id: 'user-admin-primary',
    username: DEFAULT_ADMIN_USERNAME,
    email: DEFAULT_ADMIN_EMAIL,
    name: DEFAULT_ADMIN_NAME,
  };
}

/**
 * Synchronizes WorkspaceUsers and WorkspaceMembers bidirectionally in PostgreSQL:
 * - Purges any legacy dummy/test member records.
 * - Ensures every active WorkspaceUser with role OWNER, ADMIN, or MEMBER has a linked
 *   WorkspaceMember record with a valid Team Group (teamId & teamName).
 * - Removes WorkspaceMember records for users whose role is downgraded to USER or who are inactive.
 * - Ensures any WorkspaceMember created directly in Teams has a linked active WorkspaceUser
 *   so they automatically appear in the Communication system and can send/receive messages.
 */
export async function syncWorkspaceUsersToMembers(): Promise<void> {
  try {
    await ensureDefaultTeamGroups();

    await prisma.workspaceMember.deleteMany({
      where: {
        OR: [
          { email: 'm.brody@workspace.pro' },
          { fullName: 'Marcus Brody' },
          { id: { startsWith: 'mem-test-' } },
        ],
      },
    });

    const allGroups = await prisma.workspaceTeamGroup.findMany({
      orderBy: { timestampMs: 'asc' },
    });
    const fallbackGroup = allGroups[0] || DEFAULT_TEAM_GROUPS[0];
    const groupById = new Map(allGroups.map((g) => [g.id, g]));

    const [allUsers, existingMembers] = await Promise.all([
      prisma.workspaceUser.findMany({ orderBy: { timestampMs: 'asc' } }),
      prisma.workspaceMember.findMany({ orderBy: { timestampMs: 'asc' } }),
    ]);

    const memberByEmail = new Map<string, (typeof existingMembers)[0]>();
    const memberById = new Map<string, (typeof existingMembers)[0]>();
    for (const m of existingMembers) {
      if (m.email) memberByEmail.set(m.email.toLowerCase(), m);
      memberById.set(m.id, m);
    }

    const userByEmail = new Map<string, (typeof allUsers)[0]>();
    const userById = new Map<string, (typeof allUsers)[0]>();
    for (const u of allUsers) {
      if (u.email) userByEmail.set(u.email.toLowerCase(), u);
      userById.set(u.id, u);
    }

    const nowLabel = formatNowLabel();
    const nowMs = BigInt(Date.now());

    // 1. Sync WorkspaceUser -> WorkspaceMember
    for (const user of allUsers) {
      const emailLower = (user.email || '').trim().toLowerCase();
      if (!emailLower) continue;

      const existingMem =
        (user.memberId ? memberById.get(user.memberId) : undefined) ||
        memberByEmail.get(emailLower) ||
        memberById.get(`mem-${user.id}`);

      const isEligibleMember =
        user.isActive &&
        (user.role === 'OWNER' || user.role === 'ADMIN' || user.role === 'MEMBER');

      if (!isEligibleMember) {
        if (existingMem) {
          await prisma.workspaceMember.delete({ where: { id: existingMem.id } }).catch(() => {});
          memberByEmail.delete(emailLower);
          memberById.delete(existingMem.id);
        }
        if (user.memberId) {
          await prisma.workspaceUser
            .update({ where: { id: user.id }, data: { memberId: null } })
            .catch(() => {});
        }
        continue;
      }

      const nameParts = (user.name || 'Workspace Member').trim().split(/\s+/);
      const firstName = user.firstName || nameParts[0] || 'Workspace';
      const lastName = user.lastName || nameParts.slice(1).join(' ') || '';
      const fullName = user.name || `${firstName} ${lastName}`.trim();

      const defaultDesignation =
        user.role === 'OWNER'
          ? 'Owner & Super Admin'
          : user.role === 'ADMIN'
            ? 'Workspace Administrator'
            : 'Workspace Member';

      const targetTeamId =
        existingMem?.teamId && groupById.has(existingMem.teamId)
          ? existingMem.teamId
          : user.role === 'OWNER' || user.role === 'ADMIN'
            ? 'team-exec'
            : fallbackGroup.id;
      const targetTeamName =
        groupById.get(targetTeamId)?.name || existingMem?.teamName || fallbackGroup.name;

      if (!existingMem) {
        const memberId = user.memberId || `mem-${user.id}`;
        const createdMem = await prisma.workspaceMember.create({
          data: {
            id: memberId,
            firstName,
            lastName,
            fullName,
            email: emailLower,
            designation: defaultDesignation,
            teamId: targetTeamId,
            teamName: targetTeamName,
            phone: user.phoneNumber || '',
            bio: `${fullName} — ${defaultDesignation}`,
            avatarUrl: user.avatarUrl || null,
            status: 'Active',
            inviteToken: `inv-${crypto.randomBytes(8).toString('hex')}`,
            joinedAt: user.createdAt || nowLabel,
            timestampMs: user.timestampMs || nowMs,
          },
        });
        memberByEmail.set(emailLower, createdMem);
        memberById.set(createdMem.id, createdMem);

        if (user.memberId !== createdMem.id) {
          await prisma.workspaceUser.update({
            where: { id: user.id },
            data: { memberId: createdMem.id },
          });
        }
      } else {
        const needsMemberUpdate =
          !existingMem.teamId ||
          !existingMem.teamName ||
          existingMem.fullName !== fullName ||
          (user.avatarUrl && existingMem.avatarUrl !== user.avatarUrl);

        if (needsMemberUpdate) {
          await prisma.workspaceMember.update({
            where: { id: existingMem.id },
            data: {
              firstName: existingMem.firstName || firstName,
              lastName: existingMem.lastName || lastName,
              fullName,
              teamId: targetTeamId,
              teamName: targetTeamName,
              avatarUrl: user.avatarUrl || existingMem.avatarUrl,
            },
          });
        }

        if (user.memberId !== existingMem.id) {
          await prisma.workspaceUser.update({
            where: { id: user.id },
            data: { memberId: existingMem.id },
          });
        }
      }
    }

    // 2. Reverse Sync: WorkspaceMember -> WorkspaceUser
    const refreshedMembers = await prisma.workspaceMember.findMany({
      orderBy: { timestampMs: 'asc' },
    });

    for (const member of refreshedMembers) {
      const emailLower = (member.email || '').trim().toLowerCase();
      if (!emailLower) continue;

      if (!member.teamId || !member.teamName) {
        const resolvedTeamId =
          member.teamId && groupById.has(member.teamId) ? member.teamId : fallbackGroup.id;
        const resolvedTeamName = groupById.get(resolvedTeamId)?.name || fallbackGroup.name;
        await prisma.workspaceMember.update({
          where: { id: member.id },
          data: {
            teamId: resolvedTeamId,
            teamName: resolvedTeamName,
          },
        });
      }

      const linkedUser = userByEmail.get(emailLower);
      if (!linkedUser) {
        const candidateUserId = member.id.startsWith('mem-user-')
          ? member.id.replace(/^mem-/, '')
          : `user-${member.id}`;
        const finalUserId = userById.has(candidateUserId)
          ? `user-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`
          : candidateUserId;

        const createdUser = await prisma.workspaceUser.create({
          data: {
            id: finalUserId,
            username: emailLower,
            email: emailLower,
            name: member.fullName || `${member.firstName} ${member.lastName}`.trim(),
            firstName: member.firstName || null,
            lastName: member.lastName || null,
            role: 'MEMBER',
            passwordHash: null,
            passwordSet: false,
            avatarUrl: member.avatarUrl || null,
            phoneNumber: member.phone || null,
            memberTheme: 'cloud',
            memberId: member.id,
            isActive: member.status !== 'Inactive',
            createdAt: member.joinedAt || nowLabel,
            updatedAt: nowLabel,
            timestampMs: member.timestampMs || nowMs,
          },
        });
        userByEmail.set(emailLower, createdUser);
        userById.set(createdUser.id, createdUser);
      } else if (linkedUser.memberId !== member.id) {
        await prisma.workspaceUser
          .update({
            where: { id: linkedUser.id },
            data: { memberId: member.id },
          })
          .catch(() => {});
      }
    }
  } catch (err) {
    console.error('[InitEngine] Member synchronization warning:', err);
  }
}

export async function initializeDatabaseEngine(force = false): Promise<void> {
  const now = Date.now();
  if (!force && now - lastInitTimestamp < 15_000) {
    return;
  }
  lastInitTimestamp = now;

  const nowLabel = formatNowLabel();
  const nowMs = BigInt(now);

  // 1. Ensure primary Owner account exists in PostgreSQL
  const ownerEmail = DEFAULT_ADMIN_EMAIL;
  const ownerUsername = DEFAULT_ADMIN_USERNAME;
  const ownerName = DEFAULT_ADMIN_NAME;

  const existingAdmin = await prisma.workspaceUser.findFirst({
    where: {
      OR: [
        { id: 'user-admin-primary' },
        { role: 'OWNER' },
        { email: ownerEmail },
      ],
    },
    orderBy: { timestampMs: 'asc' },
  });

  const envAdminPassword = (process.env.ADMIN_PASSWORD || '').trim();
  const hasEnvPassword = envAdminPassword.length >= 6;

  if (!existingAdmin) {
    await prisma.workspaceUser.create({
      data: {
        id: 'user-admin-primary',
        username: ownerUsername,
        email: ownerEmail,
        name: ownerName,
        firstName: ownerName.split(' ')[0] || 'Administrator',
        lastName: ownerName.split(' ').slice(1).join(' '),
        role: 'OWNER',
        passwordHash: hasEnvPassword ? hashPasswordScrypt(envAdminPassword) : null,
        passwordSet: hasEnvPassword,
        isActive: true,
        createdAt: nowLabel,
        updatedAt: nowLabel,
        timestampMs: nowMs,
      },
    });
  } else if (hasEnvPassword && !existingAdmin.passwordSet) {
    await prisma.workspaceUser.update({
      where: { id: existingAdmin.id },
      data: {
        passwordHash: hashPasswordScrypt(envAdminPassword),
        passwordSet: true,
        updatedAt: nowLabel,
      },
    });
  }

  // 2. Ensure default system settings row
  await prisma.workspaceSystemSetting.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      workspaceName: 'Workspace Pro',
      organizationName: 'Enterprise Workspace',
      adminEmail: ownerEmail,
      timezone: 'Asia/Dhaka',
      dateFormat: 'MMM DD, YYYY',
      defaultLandingModule: 'overview',
      autoSyncIntervalSec: 15,
      densityMode: 'comfortable',
      updatedAt: nowLabel,
    },
  });

  // 3. Ensure default CMH notification rule row
  await prisma.cmhNotificationRule.upsert({
    where: { id: 'cmh-rules-default' },
    update: {},
    create: {
      id: 'cmh-rules-default',
      adminEmail: ownerEmail,
      notifyOnFormSubmit: true,
      notifyOnTaskActivity: true,
      notifyOnProjectActivity: true,
      notifyOnMemberActivity: true,
      autoSendAdminEmail: true,
      injectIntoPrimaryInbox: true,
      updatedAt: nowLabel,
    },
  });

  // 4. Ensure structural default file folders
  for (const folder of STRUCTURAL_DEFAULT_FOLDERS) {
    await prisma.workspaceFolder.upsert({
      where: { id: folder.id },
      update: {},
      create: {
        id: folder.id,
        name: folder.name,
        folderType: folder.folderType,
        parentFolderId: folder.parentFolderId,
        description: folder.description,
        color: folder.color,
        createdAt: nowLabel,
        timestampMs: nowMs,
      },
    });
  }

  // 5. Synchronize Team Groups, Users, and Members
  await syncWorkspaceUsersToMembers();
}

export const ensureWorkspaceBootstrap = initializeDatabaseEngine;
