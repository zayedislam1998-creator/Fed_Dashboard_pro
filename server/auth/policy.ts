import type {
  MemberAccessPolicy,
  ProjectPermissionGrant,
  WorkspaceUser,
} from '@prisma/client';
import { prisma } from '../db/prisma';

export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export const ADMIN_ONLY_MODULES = [
  'admin_panel',
  'gmail',
  'server_mail',
  'bulk',
  'cmh_forms',
  'meet',
  'sheets',
  'calendar',
  'finance',
  'crm',
  'hr',
  'wiki',
  'automations',
  'settings',
] as const;

export const MEMBER_MODULE_POOL = [
  'overview',
  'profile',
  'communication',
  'cmh_tasks',
  'cmh_projects',
  'teams',
  'posts',
  'docs',
  'forms',
  'slides',
  'chat',
  'files',
] as const;

export type MemberModuleKey = (typeof MEMBER_MODULE_POOL)[number];

export interface PermissionCatalogItem {
  key: string;
  label: string;
  category: 'Tasks & Projects' | 'Content & Posts' | 'Chat & Files';
  description: string;
}

export const PERMISSION_CATALOG: PermissionCatalogItem[] = [
  {
    key: 'task.read_assigned',
    label: 'View Assigned Tasks',
    category: 'Tasks & Projects',
    description: 'Read tasks explicitly assigned to member or their team',
  },
  {
    key: 'task.submit_own',
    label: 'Submit Task Updates',
    category: 'Tasks & Projects',
    description: 'Submit task forms, responses, and update own progress',
  },
  {
    key: 'project.read_assigned',
    label: 'View Assigned Projects',
    category: 'Tasks & Projects',
    description: 'View brief and status of assigned projects',
  },
  {
    key: 'post.read_published',
    label: 'Read Posts & Notices',
    category: 'Content & Posts',
    description: 'Read published company announcements and posts',
  },
  {
    key: 'post.create',
    label: 'Create Posts (Draft/Submit)',
    category: 'Content & Posts',
    description: 'Author new posts or notices',
  },
  {
    key: 'post.publish',
    label: 'Publish Posts Directly',
    category: 'Content & Posts',
    description: 'Publish posts immediately without pending review',
  },
  {
    key: 'doc.create',
    label: 'Create & Edit Own Docs',
    category: 'Content & Posts',
    description: 'Author personal workspace documents',
  },
  {
    key: 'form.create',
    label: 'Create Own Forms',
    category: 'Content & Posts',
    description: 'Create standard forms and view own form responses',
  },
  {
    key: 'slide.create',
    label: 'Create Own Slides',
    category: 'Content & Posts',
    description: 'Build and edit own slide decks',
  },
  {
    key: 'channel.read_member',
    label: 'Read Assigned Chat Channels',
    category: 'Chat & Files',
    description: 'View messages in channels this member belongs to',
  },
  {
    key: 'channel.send_member',
    label: 'Send Messages in Channels',
    category: 'Chat & Files',
    description: 'Post messages inside assigned team/project channels',
  },
  {
    key: 'file.upload_own',
    label: 'Upload Files (Within Quota)',
    category: 'Chat & Files',
    description: 'Upload personal files respecting assigned storage quota',
  },
];

export const PROJECT_GRANT_ACTIONS = [
  { key: 'project.read_assigned', label: 'View Project' },
  { key: 'project.edit_details', label: 'Edit Brief & Deadline' },
  { key: 'project.manage_tasks', label: 'Manage Project Tasks' },
  { key: 'project.review_submissions', label: 'Review Member Submissions' },
  { key: 'project.manage_members', label: 'Manage Project Members' },
] as const;

export interface PresetDefinition {
  key: string;
  label: string;
  description: string;
  defaultModules: string[];
  defaultActions: string[];
  defaultQuotaMb: number;
  defaultMaxFileMb: number;
}

export const MEMBER_PRESETS: Record<string, PresetDefinition> = {
  standard_member: {
    key: 'standard_member',
    label: 'Standard Member',
    description: 'Regular member: assigned tasks/projects, own Docs/Forms/Slides, Chat & File quota.',
    defaultModules: [...MEMBER_MODULE_POOL],
    defaultActions: [
      'task.read_assigned',
      'task.submit_own',
      'project.read_assigned',
      'post.read_published',
      'doc.create',
      'form.create',
      'slide.create',
      'channel.read_member',
      'channel.send_member',
      'file.upload_own',
    ],
    defaultQuotaMb: 100,
    defaultMaxFileMb: 15,
  },
  content_contributor: {
    key: 'content_contributor',
    label: 'Content Contributor',
    description: 'Standard member + create posts/notices, docs, forms, slides, and larger storage.',
    defaultModules: [...MEMBER_MODULE_POOL],
    defaultActions: [
      'task.read_assigned',
      'task.submit_own',
      'project.read_assigned',
      'post.read_published',
      'post.create',
      'doc.create',
      'form.create',
      'slide.create',
      'channel.read_member',
      'channel.send_member',
      'file.upload_own',
    ],
    defaultQuotaMb: 250,
    defaultMaxFileMb: 25,
  },
  project_lead: {
    key: 'project_lead',
    label: 'Project Lead',
    description: 'Member enabled for project management responsibilities where explicitly granted.',
    defaultModules: [...MEMBER_MODULE_POOL],
    defaultActions: [
      'task.read_assigned',
      'task.submit_own',
      'project.read_assigned',
      'post.read_published',
      'post.create',
      'doc.create',
      'form.create',
      'slide.create',
      'channel.read_member',
      'channel.send_member',
      'file.upload_own',
    ],
    defaultQuotaMb: 500,
    defaultMaxFileMb: 25,
  },
  read_only_viewer: {
    key: 'read_only_viewer',
    label: 'Restricted Viewer',
    description: 'Read-only access: view assigned tasks, projects, teams, and published notices.',
    defaultModules: ['overview', 'cmh_tasks', 'cmh_projects', 'teams', 'posts'],
    defaultActions: [
      'task.read_assigned',
      'project.read_assigned',
      'post.read_published',
    ],
    defaultQuotaMb: 10,
    defaultMaxFileMb: 5,
  },
};

export interface EvaluatedCapabilities {
  role: WorkspaceRole;
  isOwner: boolean;
  isAdmin: boolean;
  isMember: boolean;
  presetKey: string;
  allowedModules: string[];
  restrictedModules: string[];
  allowedActions: string[];
  deniedActions: string[];
  projectGrants: Array<{
    projectId: string;
    projectRole: string;
    actions: string[];
    expiresAt?: string;
  }>;
}

function asStringArray(val: unknown): string[] {
  return Array.isArray(val) ? val.map((v) => String(v)) : [];
}

export function evaluateEffectiveCapabilities(
  user: Pick<WorkspaceUser, 'role'>,
  policy?: MemberAccessPolicy | null,
  grants: ProjectPermissionGrant[] = []
): EvaluatedCapabilities {
  const role =
    user.role === 'OWNER' ? 'OWNER' : user.role === 'ADMIN' ? 'ADMIN' : 'MEMBER';
  const isOwner = role === 'OWNER';
  const isAdmin = role === 'OWNER' || role === 'ADMIN';
  const isMember = role === 'MEMBER';

  const activeGrants = grants
    .filter((g) => {
      if (!g.expiresAt) return true;
      const exp = new Date(g.expiresAt).getTime();
      return Number.isNaN(exp) || exp > Date.now();
    })
    .map((g) => ({
      projectId: g.projectId,
      projectRole: g.projectRole,
      actions: asStringArray(g.actionsJson),
      expiresAt: g.expiresAt || undefined,
    }));

  if (isAdmin) {
    const allAdminModules = [...ADMIN_ONLY_MODULES, ...MEMBER_MODULE_POOL];
    return {
      role,
      isOwner,
      isAdmin: true,
      isMember: false,
      presetKey: isOwner ? 'owner_full' : 'admin_full',
      allowedModules: allAdminModules,
      restrictedModules: [],
      allowedActions: ['*'],
      deniedActions: [],
      projectGrants: activeGrants,
    };
  }

  const presetKey =
    policy?.presetKey && MEMBER_PRESETS[policy.presetKey]
      ? policy.presetKey
      : 'standard_member';
  const preset = MEMBER_PRESETS[presetKey] || MEMBER_PRESETS.standard_member;

  const baseModules =
    policy && Array.isArray(policy.allowedModulesJson) && policy.allowedModulesJson.length > 0
      ? asStringArray(policy.allowedModulesJson)
      : preset.defaultModules;

  const restrictedSet = new Set<string>([
    ...ADMIN_ONLY_MODULES,
    ...asStringArray(policy?.restrictedModulesJson),
  ]);

  const combinedBase = Array.from(
    new Set([...baseModules, 'profile', 'communication'])
  );

  const allowedModules = Array.from(
    new Set(
      combinedBase.filter(
        (m) =>
          (MEMBER_MODULE_POOL as readonly string[]).includes(m) && !restrictedSet.has(m)
      )
    )
  );

  // Overview stays visible unless explicitly restricted
  const baseActions =
    policy && Array.isArray(policy.allowedActionsJson) && policy.allowedActionsJson.length > 0
      ? asStringArray(policy.allowedActionsJson)
      : preset.defaultActions;

  const deniedSet = new Set<string>(asStringArray(policy?.deniedActionsJson));
  const allowedActions = Array.from(
    new Set(baseActions.filter((a) => !deniedSet.has(a)))
  );

  return {
    role: 'MEMBER',
    isOwner: false,
    isAdmin: false,
    isMember: true,
    presetKey,
    allowedModules,
    restrictedModules: Array.from(restrictedSet).filter((m) =>
      (MEMBER_MODULE_POOL as readonly string[]).includes(m)
    ),
    allowedActions,
    deniedActions: Array.from(deniedSet),
    projectGrants: activeGrants,
  };
}

export function hasModuleCapability(caps: EvaluatedCapabilities, mod: string): boolean {
  if (caps.isAdmin) return true;
  return caps.allowedModules.includes(mod);
}

export function hasActionCapability(caps: EvaluatedCapabilities, action: string): boolean {
  if (caps.isAdmin) return true;
  if (caps.deniedActions.includes(action)) return false;
  return caps.allowedActions.includes('*') || caps.allowedActions.includes(action);
}

export function hasProjectGrantAction(
  caps: EvaluatedCapabilities,
  projectId: string,
  action: string
): boolean {
  if (caps.isAdmin) return true;
  const grant = caps.projectGrants.find((g) => g.projectId === projectId);
  if (!grant) return false;
  if (action === 'project.read_assigned') return true;
  return grant.actions.includes(action);
}

export async function recordAuditEvent(
  params: {
    actorUserId?: string | null;
    actorEmail: string;
    action: string;
    targetType?: string;
    targetId?: string;
    summary: string;
    details?: Record<string, any>;
  },
  tx?: any
) {
  const client = tx || prisma;
  await client.auditEvent.create({
    data: {
      id: `aud-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      actorUserId: params.actorUserId || null,
      actorEmail: params.actorEmail,
      action: params.action,
      targetType: params.targetType || null,
      targetId: params.targetId || null,
      summary: params.summary,
      detailsJson: params.details || {},
      timestampMs: BigInt(Date.now()),
      createdAt: new Date().toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    },
  });
}
