import type { PrismaClient } from '@prisma/client';

type Row = Record<string, any>;

const MODEL_DEFAULTS: Record<string, () => Row> = {
  workspaceUser: () => ({
    name: 'Administrator',
    firstName: null,
    lastName: null,
    role: 'MEMBER',
    passwordHash: null,
    passwordSet: false,
    avatarUrl: null,
    phoneCountryCode: null,
    phoneNumber: null,
    countryCode: null,
    countryName: null,
    stateCode: null,
    stateName: null,
    cityName: null,
    addressLine: null,
    zipCode: null,
    memberTheme: 'cloud',
    memberId: null,
    permissionVersion: 1,
    storageQuotaBytes: BigInt(104857600),
    maxFileSizeBytes: BigInt(15728640),
    isActive: true,
    lastLoginAt: null,
    extraFields: {},
  }),
  workspaceSession: () => ({
    userAgent: null,
    ipAddress: null,
    revokedAt: null,
  }),
  workspaceInvitation: () => ({
    firstName: null,
    lastName: null,
    targetRole: 'MEMBER',
    presetKey: 'standard_member',
    memberId: null,
    invitedByName: null,
    invitedByEmail: null,
    emailSent: false,
    acceptedAt: null,
    revokedAt: null,
  }),
  memberAccessPolicy: () => ({
    presetKey: 'standard_member',
    allowedModulesJson: [],
    restrictedModulesJson: [],
    allowedActionsJson: [],
    deniedActionsJson: [],
    updatedById: null,
  }),
  projectPermissionGrant: () => ({
    projectRole: 'PARTICIPANT',
    actionsJson: [],
    expiresAt: null,
  }),
  taskAssignment: () => ({
    canUpdateProgress: true,
  }),
  channelMembership: () => ({
    channelRole: 'MEMBER',
  }),
  resourceShare: () => ({
    accessLevel: 'VIEW',
  }),
  auditEvent: () => ({
    actorUserId: null,
    targetType: null,
    targetId: null,
    detailsJson: {},
  }),
  workspaceSystemSetting: () => ({
    id: 'default',
    workspaceName: 'Workspace Pro',
    organizationName: '',
    adminEmail: 'zayed.islam1998@gmail.com',
    timezone: 'Asia/Dhaka',
    dateFormat: 'MMM DD, YYYY',
    defaultLandingModule: 'gmail',
    autoSyncIntervalSec: 15,
    densityMode: 'comfortable',
    defaultSignatureHtml: '',
    defaultReplyTo: '',
    bulkDelayMs: 400,
    dailySendLimit: 500,
    enableReadReceipts: false,
    autoSaveAttachmentsToFiles: true,
    enablePublicForms: true,
    enablePublicCmhPortal: true,
    incomingWebhookSecret: '',
    outgoingWebhookUrl: '',
    externalIntegrationsJson: [],
    postgresConfigJson: {},
  }),
  serverMailAccount: () => ({
    imapPort: 993,
    imapSecure: true,
    smtpPort: 465,
    smtpSecure: true,
    lastVerifiedAt: null,
    extraFields: {},
  }),
  gmailAccount: () => ({
    username: '',
    authMode: 'app_password',
    imapHost: 'imap.gmail.com',
    imapPort: 993,
    imapSecure: true,
    smtpHost: 'smtp.gmail.com',
    smtpPort: 465,
    smtpSecure: true,
    clientId: null,
    clientSecretEnc: null,
    refreshTokenEnc: null,
    lastVerifiedAt: null,
    extraFields: {},
  }),
  mailMessage: () => ({
    folder: 'inbox',
    cc: null,
    snippet: null,
    bodyHtml: null,
    bodyText: null,
    isUnread: true,
    isStarred: false,
    extraFields: {},
  }),
  mailStarredMessage: () => ({}),
  customMailTab: () => ({
    accentColor: '#0B57D0',
    description: null,
    isBulkShortcut: false,
    timestampMs: BigInt(0),
  }),
  bulkCampaign: () => ({
    status: 'Draft',
    sentCount: 0,
    totalCount: 0,
    recipientsJson: [],
    timestampMs: BigInt(0),
    extraFields: {},
  }),
  workspaceDoc: () => ({
    category: 'General',
    bodyText: '',
    googleDocId: null,
    googleDocUrl: null,
    linkedFileId: null,
    fileUrl: null,
    wordCount: 0,
    ownerUserId: 'user-admin-primary',
    visibility: 'PRIVATE',
    extraFields: {},
  }),
  workspaceSlide: () => ({
    subtitle: null,
    category: 'Presentations',
    themeColor: '#D97706',
    authorName: 'Administrator',
    pagesJson: [],
    linkedFileId: null,
    fileUrl: null,
    slideCount: 1,
    ownerUserId: 'user-admin-primary',
    visibility: 'PRIVATE',
    extraFields: {},
  }),
  workspaceForm: () => ({
    description: null,
    accentColor: '#673AB7',
    isPublic: true,
    identityMode: 'OPTIONAL',
    targetSubmissions: 50,
    autoCloseOnTarget: false,
    confirmationMessage: null,
    googleFormUri: null,
    fieldsJson: [],
    ownerUserId: 'user-admin-primary',
    timestampMs: BigInt(0),
    extraFields: {},
  }),
  formSubmission: () => ({
    answersJson: {},
    extraFields: {},
  }),
  workspaceMeeting: () => ({
    agenda: null,
    durationMins: 30,
    hostEmail: null,
    status: 'Active',
    extraFields: {},
  }),
  workspaceTeamGroup: () => ({
    description: null,
    color: '#0B57D0',
    extraFields: {},
  }),
  workspaceMember: () => ({
    teamId: null,
    teamName: null,
    phone: null,
    bio: null,
    avatarUrl: null,
    status: 'Active',
    inviteSentAt: null,
    extraFields: {},
  }),
  workspacePostCategory: () => ({
    color: '#0B57D0',
    description: null,
  }),
  workspacePostNotice: () => ({
    type: 'POST',
    summary: null,
    categoryId: null,
    categoryName: 'General',
    authorName: 'Administrator',
    authorRole: null,
    ownerUserId: 'user-admin-primary',
    status: 'PUBLISHED',
    coverImageUrl: null,
    attachmentsJson: [],
    isPinned: false,
    pinnedUntil: null,
    priority: 'Normal',
    viewsCount: 0,
    extraFields: {},
  }),
  workspaceFolder: () => ({
    folderType: 'FOLDER',
    parentFolderId: null,
    description: null,
    color: '#0B57D0',
    ownerUserId: 'user-admin-primary',
  }),
  workspaceFile: () => ({
    folderId: 'folder-general',
    folderName: 'General Server Files',
    isImage: false,
    width: null,
    height: null,
    originalSizeBytes: BigInt(0),
    compressedSizeBytes: BigInt(0),
    compressionRatio: 0,
    thumbnailUrl: null,
    slideDeckId: null,
    docId: null,
    bodyText: null,
    ownerUserId: 'user-admin-primary',
    visibility: 'PRIVATE',
    versionCount: 1,
    deletedAt: null,
    deletedTimestampMs: null,
    extraFields: {},
  }),
  workspaceFileVersion: () => ({
    sizeBytes: BigInt(0),
    note: 'Saved revision',
    createdByEmail: 'system',
  }),
  systemNotification: () => ({
    description: null,
    targetId: null,
    accountId: null,
    isRead: false,
    extraFields: {},
  }),
  cmhFormTemplate: () => ({
    description: null,
    formCategory: 'GENERAL',
    accessMode: 'PUBLIC',
    invitedMemberIdsJson: [],
    invitedTeamIdsJson: [],
    submitButtonLabel: 'Submit',
    confirmationMessage: null,
    fieldsJson: [],
    submissionsJson: [],
    extraFields: {},
  }),
  cmhTask: () => ({
    description: null,
    status: 'To Do',
    priority: 'Medium',
    dueDate: null,
    accessMode: 'PUBLIC',
    projectId: null,
    ownerUserId: 'user-admin-primary',
    assignedMemberIdsJson: [],
    assignedTeamIdsJson: [],
    customFieldValuesJson: {},
    submissionsJson: [],
    extraFields: {},
  }),
  cmhProject: () => ({
    description: null,
    status: 'Active',
    priority: 'High',
    deadline: null,
    budget: null,
    accessMode: 'PUBLIC',
    ownerUserId: 'user-admin-primary',
    assignedMemberIdsJson: [],
    assignedTeamIdsJson: [],
    customFieldValuesJson: {},
    submissionsJson: [],
    extraFields: {},
  }),
  cmhNotificationRule: () => ({
    adminEmail: 'zayed.islam1998@gmail.com',
    notifyOnFormSubmit: true,
    notifyOnTaskActivity: true,
    notifyOnProjectActivity: true,
    notifyOnMemberActivity: true,
    autoSendAdminEmail: true,
    injectIntoPrimaryInbox: true,
  }),
  workspaceSheet: () => ({
    category: 'General',
    columnsJson: [],
    rowsJson: [],
    extraFields: {},
  }),
  workspaceCalendarEvent: () => ({
    description: null,
    eventType: 'EVENT',
    startTime: null,
    endTime: null,
    location: null,
    color: '#0B57D0',
    updatedAt: null,
    extraFields: {},
  }),
  workspaceInvoice: () => ({
    docType: 'INVOICE',
    projectTitle: null,
    currency: 'USD',
    itemsJson: [],
    taxPercent: 0,
    discountAmt: 0,
    totalAmount: 0,
    status: 'Unpaid',
    notes: null,
    updatedAt: null,
    extraFields: {},
  }),
  workspaceExpense: () => ({
    category: 'Operations',
    amount: 0,
    currency: 'USD',
    vendor: null,
    projectTitle: null,
    status: 'Approved',
    updatedAt: null,
    extraFields: {},
  }),
  workspaceCrmLead: () => ({
    phone: null,
    stage: 'New Lead',
    dealValue: 0,
    assignedTo: null,
    notes: null,
    updatedAt: null,
    extraFields: {},
  }),
  workspaceSupportTicket: () => ({
    priority: 'Medium',
    status: 'Open',
    assignedTo: null,
    resolution: null,
    updatedAt: null,
    extraFields: {},
  }),
  workspaceHrRecord: () => ({
    detailsJson: {},
    updatedAt: null,
    extraFields: {},
  }),
  workspaceChatChannel: () => ({
    description: null,
    channelType: 'PUBLIC',
    ownerUserId: 'user-admin-primary',
    isWorkspaceWide: false,
    updatedAt: null,
    extraFields: {},
  }),
  workspaceChatMessage: () => ({
    isPinned: false,
    updatedAt: null,
    extraFields: {},
  }),
  workspaceWikiArticle: () => ({
    category: 'SOP & Guidelines',
    summary: null,
    authorName: 'Administrator',
    isPinned: false,
    extraFields: {},
  }),
  workspaceAutomationRule: () => ({
    isActive: true,
    runsCount: 0,
    lastRunAt: null,
    updatedAt: null,
    extraFields: {},
  }),
  communicationConversation: () => ({
    participant1AvatarUrl: null,
    participant2AvatarUrl: null,
    lastMessageText: '',
    lastMessageTimestampMs: BigInt(0),
    unreadCountP1: 0,
    unreadCountP2: 0,
    isPinned: false,
    extraFields: {},
  }),
  communicationMessage: () => ({
    senderAvatarUrl: null,
    attachments: [],
    status: 'SENT',
    isRead: false,
    readAt: null,
    replyToId: null,
    replySnippet: null,
    reactions: {},
    isPinned: false,
    extraFields: {},
  }),
  workspaceResumeProfile: () => ({
    userId: null,
    memberId: null,
    email: '',
    fullName: '',
    professionalTitle: '',
    executiveSummary: '',
    avatarUrl: null,
    coverImageUrl: null,
    verifiedBadge: true,
    statusText: null,
    contactJson: {},
    experienceJson: [],
    educationJson: [],
    skillsJson: [],
    projectsJson: [],
    certificationsJson: [],
    customSectionsJson: [],
    settingsJson: {},
  }),
  workspaceCorporateWebsite: () => ({
    userId: null,
    memberId: null,
    email: '',
    orgName: '',
    tagline: '',
    logoUrl: null,
    brandingJson: {},
    heroSliderJson: [],
    missionVisionJson: {},
    servicesJson: [],
    teamJson: [],
    recentUpdatesJson: [],
    photoGalleryJson: [],
    videoGalleryJson: [],
    testimonialsJson: [],
    contactJson: {},
    settingsJson: {},
  }),
};

const COMPOUND_KEYS: Record<string, string[]> = {
  projectId_userId: ['projectId', 'userId'],
  taskId_userId: ['taskId', 'userId'],
  channelId_userId: ['channelId', 'userId'],
  resourceType_resourceId_targetUserId: ['resourceType', 'resourceId', 'targetUserId'],
  accountId_messageId: ['accountId', 'messageId'],
};

const CASCADE_DELETES: Array<{
  parentModel: string;
  childModel: string;
  parentField: string;
  childField: string;
}> = [
  { parentModel: 'workspaceUser', childModel: 'workspaceSession', parentField: 'id', childField: 'userId' },
  { parentModel: 'workspaceUser', childModel: 'memberAccessPolicy', parentField: 'id', childField: 'userId' },
  { parentModel: 'workspaceUser', childModel: 'projectPermissionGrant', parentField: 'id', childField: 'userId' },
  { parentModel: 'workspaceUser', childModel: 'taskAssignment', parentField: 'id', childField: 'userId' },
  { parentModel: 'workspaceUser', childModel: 'channelMembership', parentField: 'id', childField: 'userId' },
  { parentModel: 'cmhProject', childModel: 'projectPermissionGrant', parentField: 'id', childField: 'projectId' },
  { parentModel: 'cmhTask', childModel: 'taskAssignment', parentField: 'id', childField: 'taskId' },
  { parentModel: 'workspaceChatChannel', childModel: 'channelMembership', parentField: 'id', childField: 'channelId' },
  { parentModel: 'workspaceForm', childModel: 'formSubmission', parentField: 'id', childField: 'formId' },
  { parentModel: 'communicationConversation', childModel: 'communicationMessage', parentField: 'id', childField: 'conversationId' },
];

const globalForMemoryStore = globalThis as unknown as {
  __workspaceMemoryStore?: Map<string, Row[]>;
};

function getMemoryTables(): Map<string, Row[]> {
  if (!globalForMemoryStore.__workspaceMemoryStore) {
    globalForMemoryStore.__workspaceMemoryStore = new Map<string, Row[]>();
  }
  return globalForMemoryStore.__workspaceMemoryStore;
}

function getTable(model: string): Row[] {
  const tables = getMemoryTables();
  let rows = tables.get(model);
  if (!rows) {
    rows = [];
    tables.set(model, rows);
  }
  return rows;
}

function cloneRow<T>(val: T): T {
  if (val === null || val === undefined || typeof val !== 'object') return val;
  if (Array.isArray(val)) return val.map((item) => cloneRow(item)) as unknown as T;
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(val as Record<string, any>)) {
    out[k] = cloneRow(v);
  }
  return out as T;
}

function flattenWhere(where?: Row): Row | undefined {
  if (!where || typeof where !== 'object') return where;
  const out: Row = {};
  for (const [k, v] of Object.entries(where)) {
    if (COMPOUND_KEYS[k] && v && typeof v === 'object') {
      for (const subKey of COMPOUND_KEYS[k]) {
        out[subKey] = v[subKey];
      }
    } else {
      out[k] = v;
    }
  }
  return out;
}

function compareValues(a: any, b: any): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  if (typeof a === 'bigint' || typeof b === 'bigint') {
    const ba = BigInt(a);
    const bb = BigInt(b);
    return ba < bb ? -1 : ba > bb ? 1 : 0;
  }
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }
  return String(a).localeCompare(String(b));
}

function matchesFieldCondition(rowVal: any, cond: any): boolean {
  if (cond === undefined) return true;
  if (cond === null) return rowVal === null || rowVal === undefined;
  if (typeof cond !== 'object' || Array.isArray(cond) || typeof cond === 'bigint') {
    return rowVal === cond;
  }

  const insensitive = cond.mode === 'insensitive';
  const norm = (v: any) => (insensitive ? String(v ?? '').toLowerCase() : String(v ?? ''));

  if ('equals' in cond && rowVal !== cond.equals) {
    if (!(insensitive && norm(rowVal) === norm(cond.equals))) return false;
  }
  if ('not' in cond) {
    if (cond.not === null) {
      if (rowVal === null || rowVal === undefined) return false;
    } else if (matchesFieldCondition(rowVal, cond.not)) {
      return false;
    }
  }
  if ('in' in cond && Array.isArray(cond.in)) {
    if (!cond.in.includes(rowVal)) return false;
  }
  if ('notIn' in cond && Array.isArray(cond.notIn)) {
    if (cond.notIn.includes(rowVal)) return false;
  }
  if ('startsWith' in cond) {
    if (!norm(rowVal).startsWith(norm(cond.startsWith))) return false;
  }
  if ('endsWith' in cond) {
    if (!norm(rowVal).endsWith(norm(cond.endsWith))) return false;
  }
  if ('contains' in cond) {
    if (!norm(rowVal).includes(norm(cond.contains))) return false;
  }
  if ('gt' in cond && !(compareValues(rowVal, cond.gt) > 0)) return false;
  if ('gte' in cond && !(compareValues(rowVal, cond.gte) >= 0)) return false;
  if ('lt' in cond && !(compareValues(rowVal, cond.lt) < 0)) return false;
  if ('lte' in cond && !(compareValues(rowVal, cond.lte) <= 0)) return false;

  return true;
}

function matchesWhere(row: Row, rawWhere?: Row): boolean {
  const where = flattenWhere(rawWhere);
  if (!where || Object.keys(where).length === 0) return true;

  for (const [key, val] of Object.entries(where)) {
    if (val === undefined) continue;
    if (key === 'OR' && Array.isArray(val)) {
      if (!val.some((clause) => matchesWhere(row, clause))) return false;
      continue;
    }
    if (key === 'AND' && Array.isArray(val)) {
      if (!val.every((clause) => matchesWhere(row, clause))) return false;
      continue;
    }
    if (key === 'NOT') {
      const clauses = Array.isArray(val) ? val : [val];
      if (clauses.some((clause) => matchesWhere(row, clause))) return false;
      continue;
    }
    if (!matchesFieldCondition(row[key], val)) return false;
  }
  return true;
}

function applyOrderBy(rows: Row[], orderBy?: any): Row[] {
  if (!orderBy) return rows;
  const specs = Array.isArray(orderBy) ? orderBy : [orderBy];
  return [...rows].sort((a, b) => {
    for (const spec of specs) {
      for (const [field, dir] of Object.entries(spec)) {
        const cmp = compareValues(a[field], b[field]);
        if (cmp !== 0) {
          return dir === 'desc' ? -cmp : cmp;
        }
      }
    }
    return 0;
  });
}

function applySelect(row: Row, select?: Row): Row {
  if (!select) return row;
  const out: Row = {};
  for (const [k, v] of Object.entries(select)) {
    if (v) out[k] = row[k];
  }
  return out;
}

function attachIncludes(model: string, row: Row, include?: Row): Row {
  const out = cloneRow(row);
  if (!include) return out;

  if (model === 'workspaceUser') {
    if (include.accessPolicy) {
      out.accessPolicy =
        cloneRow(getTable('memberAccessPolicy').find((p) => p.userId === row.id)) || null;
    }
    if (include.projectGrants) {
      out.projectGrants = cloneRow(
        getTable('projectPermissionGrant').filter((g) => g.userId === row.id)
      );
    }
    if (include.taskAssignments) {
      out.taskAssignments = cloneRow(
        getTable('taskAssignment').filter((t) => t.userId === row.id)
      );
    }
    if (include.channelMembers) {
      out.channelMembers = cloneRow(
        getTable('channelMembership').filter((c) => c.userId === row.id)
      );
    }
    if (include.sessions) {
      out.sessions = cloneRow(
        getTable('workspaceSession').filter((s) => s.userId === row.id)
      );
    }
  } else if (model === 'workspaceSession') {
    if (include.user) {
      const u = getTable('workspaceUser').find((usr) => usr.id === row.userId);
      if (u) {
        const nestedInclude =
          typeof include.user === 'object' ? include.user.include : undefined;
        out.user = attachIncludes('workspaceUser', u, nestedInclude);
      } else {
        out.user = null;
      }
    }
  } else if (model === 'workspaceForm') {
    if (include.submissions) {
      let subs = getTable('formSubmission').filter((s) => s.formId === row.id);
      if (typeof include.submissions === 'object' && include.submissions.orderBy) {
        subs = applyOrderBy(subs, include.submissions.orderBy);
      }
      out.submissions = cloneRow(subs);
    }
  } else if (model === 'cmhTask') {
    if (include.assignments) {
      out.assignments = cloneRow(
        getTable('taskAssignment').filter((a) => a.taskId === row.id)
      );
    }
  } else if (model === 'cmhProject') {
    if (include.permissionGrants) {
      out.permissionGrants = cloneRow(
        getTable('projectPermissionGrant').filter((g) => g.projectId === row.id)
      );
    }
  } else if (model === 'workspaceChatChannel') {
    if (include.members) {
      out.members = cloneRow(
        getTable('channelMembership').filter((m) => m.channelId === row.id)
      );
    }
  } else if (model === 'communicationConversation') {
    if (include.messages) {
      let msgs = getTable('communicationMessage').filter(
        (m) => m.conversationId === row.id
      );
      if (typeof include.messages === 'object' && include.messages.where) {
        msgs = msgs.filter((m) => matchesWhere(m, include.messages.where));
      }
      if (typeof include.messages === 'object' && include.messages.orderBy) {
        msgs = applyOrderBy(msgs, include.messages.orderBy);
      }
      if (typeof include.messages === 'object' && typeof include.messages.take === 'number') {
        msgs = msgs.slice(0, include.messages.take);
      }
      out.messages = cloneRow(msgs);
    }
  }

  return out;
}

function applyCreateData(model: string, data: Row): Row {
  const defaults = MODEL_DEFAULTS[model] ? MODEL_DEFAULTS[model]() : {};
  const row: Row = { ...defaults };
  for (const [k, v] of Object.entries(data || {})) {
    if (v !== undefined) {
      row[k] = cloneRow(v);
    }
  }
  return row;
}

function applyUpdateData(existing: Row, data: Row): Row {
  const next = cloneRow(existing);
  for (const [k, v] of Object.entries(data || {})) {
    if (v === undefined) continue;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      if ('increment' in v) {
        const cur = next[k] ?? 0;
        next[k] =
          typeof cur === 'bigint' ? cur + BigInt(v.increment) : Number(cur) + Number(v.increment);
        continue;
      }
      if ('decrement' in v) {
        const cur = next[k] ?? 0;
        next[k] =
          typeof cur === 'bigint' ? cur - BigInt(v.decrement) : Number(cur) - Number(v.decrement);
        continue;
      }
      if ('set' in v) {
        next[k] = cloneRow(v.set);
        continue;
      }
    }
    next[k] = cloneRow(v);
  }
  return next;
}

function cascadeDeleteIds(model: string, deletedRows: Row[]): void {
  if (deletedRows.length === 0) return;
  for (const rule of CASCADE_DELETES) {
    if (rule.parentModel !== model) continue;
    const parentValues = new Set(deletedRows.map((r) => r[rule.parentField]));
    const childTable = getTable(rule.childModel);
    const removedChildren: Row[] = [];
    for (let i = childTable.length - 1; i >= 0; i--) {
      if (parentValues.has(childTable[i][rule.childField])) {
        removedChildren.push(childTable[i]);
        childTable.splice(i, 1);
      }
    }
    if (removedChildren.length > 0) {
      cascadeDeleteIds(rule.childModel, removedChildren);
    }
  }
}

function createModelDelegate(model: string) {
  return {
    async findMany(args: Row = {}) {
      let rows = getTable(model).filter((r) => matchesWhere(r, args.where));
      rows = applyOrderBy(rows, args.orderBy);
      if (typeof args.skip === 'number' && args.skip > 0) {
        rows = rows.slice(args.skip);
      }
      if (typeof args.take === 'number') {
        rows = rows.slice(0, args.take);
      }
      return rows.map((r) => {
        const withInc = attachIncludes(model, r, args.include);
        return args.select ? applySelect(withInc, args.select) : withInc;
      });
    },

    async findFirst(args: Row = {}) {
      let rows = getTable(model).filter((r) => matchesWhere(r, args.where));
      rows = applyOrderBy(rows, args.orderBy);
      const found = rows[0];
      if (!found) return null;
      const withInc = attachIncludes(model, found, args.include);
      return args.select ? applySelect(withInc, args.select) : withInc;
    },

    async findUnique(args: Row) {
      const table = getTable(model);
      const found = table.find((r) => matchesWhere(r, args?.where));
      if (!found) return null;
      const withInc = attachIncludes(model, found, args?.include);
      return args?.select ? applySelect(withInc, args.select) : withInc;
    },

    async findUniqueOrThrow(args: Row) {
      const found = await this.findUnique(args);
      if (!found) {
        throw Object.assign(new Error(`No ${model} found`), { code: 'P2025' });
      }
      return found;
    },

    async create(args: Row) {
      const table = getTable(model);
      const row = applyCreateData(model, args.data || {});
      table.push(row);
      const withInc = attachIncludes(model, row, args.include);
      return args.select ? applySelect(withInc, args.select) : withInc;
    },

    async update(args: Row) {
      const table = getTable(model);
      const idx = table.findIndex((r) => matchesWhere(r, args.where));
      if (idx === -1) {
        throw Object.assign(new Error(`Record to update not found in ${model}`), { code: 'P2025' });
      }
      table[idx] = applyUpdateData(table[idx], args.data || {});
      const withInc = attachIncludes(model, table[idx], args.include);
      return args.select ? applySelect(withInc, args.select) : withInc;
    },

    async updateMany(args: Row = {}) {
      const table = getTable(model);
      let count = 0;
      for (let i = 0; i < table.length; i++) {
        if (matchesWhere(table[i], args.where)) {
          table[i] = applyUpdateData(table[i], args.data || {});
          count++;
        }
      }
      return { count };
    },

    async upsert(args: Row) {
      const table = getTable(model);
      const idx = table.findIndex((r) => matchesWhere(r, args.where));
      if (idx !== -1) {
        table[idx] = applyUpdateData(table[idx], args.update || {});
        const withInc = attachIncludes(model, table[idx], args.include);
        return args.select ? applySelect(withInc, args.select) : withInc;
      }
      const row = applyCreateData(model, args.create || {});
      table.push(row);
      const withInc = attachIncludes(model, row, args.include);
      return args.select ? applySelect(withInc, args.select) : withInc;
    },

    async delete(args: Row) {
      const table = getTable(model);
      const idx = table.findIndex((r) => matchesWhere(r, args.where));
      if (idx === -1) {
        throw Object.assign(new Error(`Record to delete not found in ${model}`), { code: 'P2025' });
      }
      const [removed] = table.splice(idx, 1);
      cascadeDeleteIds(model, [removed]);
      return cloneRow(removed);
    },

    async deleteMany(args: Row = {}) {
      const table = getTable(model);
      const removed: Row[] = [];
      for (let i = table.length - 1; i >= 0; i--) {
        if (matchesWhere(table[i], args.where)) {
          removed.push(table[i]);
          table.splice(i, 1);
        }
      }
      cascadeDeleteIds(model, removed);
      return { count: removed.length };
    },

    async count(args: Row = {}) {
      return getTable(model).filter((r) => matchesWhere(r, args.where)).length;
    },

    async aggregate(args: Row = {}) {
      const rows = getTable(model).filter((r) => matchesWhere(r, args.where));
      const result: Row = {};
      if (args._count) {
        result._count = rows.length;
      }
      if (args._sum && typeof args._sum === 'object') {
        const sums: Row = {};
        for (const [field, enabled] of Object.entries(args._sum)) {
          if (!enabled) continue;
          const hasBigInt = rows.some((r) => typeof r[field] === 'bigint');
          if (hasBigInt) {
            sums[field] = rows.reduce((acc, r) => acc + BigInt(r[field] || 0), BigInt(0));
          } else {
            sums[field] = rows.reduce((acc, r) => acc + Number(r[field] || 0), 0);
          }
        }
        result._sum = sums;
      }
      return result;
    },

    async groupBy(args: Row) {
      const byFields: string[] = Array.isArray(args.by) ? args.by : [args.by];
      const rows = getTable(model).filter((r) => matchesWhere(r, args.where));
      const groups = new Map<string, Row[]>();

      for (const r of rows) {
        const key = JSON.stringify(byFields.map((f) => r[f] ?? null));
        const list = groups.get(key) || [];
        list.push(r);
        groups.set(key, list);
      }

      const out: Row[] = [];
      for (const list of groups.values()) {
        const entry: Row = {};
        for (const f of byFields) {
          entry[f] = list[0][f];
        }
        if (args._count && typeof args._count === 'object') {
          const counts: Row = {};
          for (const [f, enabled] of Object.entries(args._count)) {
            if (enabled) counts[f] = list.length;
          }
          entry._count = counts;
        }
        if (args._sum && typeof args._sum === 'object') {
          const sums: Row = {};
          for (const [f, enabled] of Object.entries(args._sum)) {
            if (!enabled) continue;
            const hasBigInt = list.some((r) => typeof r[f] === 'bigint');
            sums[f] = hasBigInt
              ? list.reduce((acc, r) => acc + BigInt(r[f] || 0), BigInt(0))
              : list.reduce((acc, r) => acc + Number(r[f] || 0), 0);
          }
          entry._sum = sums;
        }
        out.push(entry);
      }
      return out;
    },
  };
}

let cachedMemoryClient: PrismaClient | null = null;

export function getMemoryPrismaClient(): PrismaClient {
  if (cachedMemoryClient) return cachedMemoryClient;

  const delegates = new Map<string, ReturnType<typeof createModelDelegate>>();

  const baseObj: Record<string, any> = {
    $disconnect: async () => {},
    $connect: async () => {},
    $queryRawUnsafe: async () => [],
    $executeRawUnsafe: async () => 0,
    $transaction: async (input: any) => {
      if (typeof input === 'function') {
        return input(cachedMemoryClient);
      }
      if (Array.isArray(input)) {
        return Promise.all(input);
      }
      return [];
    },
  };

  cachedMemoryClient = new Proxy(baseObj, {
    get(target, prop) {
      if (prop === 'then') return undefined;
      if (typeof prop === 'string' && prop in target) {
        return target[prop];
      }
      if (typeof prop === 'string') {
        let del = delegates.get(prop);
        if (!del) {
          del = createModelDelegate(prop);
          delegates.set(prop, del);
        }
        return del;
      }
      return undefined;
    },
  }) as unknown as PrismaClient;

  return cachedMemoryClient;
}

/**
 * Captures staging users & active sessions from memory before switching to a newly connected PostgreSQL DB,
 * so the logged-in administrator keeps their session and password seamlessly when attaching PostgreSQL later.
 */
export function snapshotStagingAuthData(): {
  users: Row[];
  sessions: Row[];
  members: Row[];
  teamGroups: Row[];
} {
  return {
    users: cloneRow(getTable('workspaceUser')),
    sessions: cloneRow(getTable('workspaceSession')),
    members: cloneRow(getTable('workspaceMember')),
    teamGroups: cloneRow(getTable('workspaceTeamGroup')),
  };
}
