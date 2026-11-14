import type {
  BulkCampaign,
  CmhFormTemplate,
  CmhNotificationRule,
  CmhProject,
  CmhTask,
  CustomMailTab,
  FormSubmission,
  GmailAccount,
  MailMessage,
  ServerMailAccount,
  SystemNotification,
  WorkspaceDoc,
  WorkspaceFile,
  WorkspaceFolder,
  WorkspaceForm,
  WorkspaceMeeting,
  WorkspaceMember,
  WorkspacePostCategory,
  WorkspacePostNotice,
  WorkspaceSlide,
  WorkspaceSystemSetting,
  WorkspaceTeamGroup,
  WorkspaceUser,
} from '@prisma/client';

export function sanitizeAdminUser(row: WorkspaceUser) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    name: row.name,
    firstName: row.firstName || undefined,
    lastName: row.lastName || undefined,
    role: row.role,
    passwordSet: row.passwordSet,
    avatarUrl: row.avatarUrl || undefined,
    phoneCountryCode: row.phoneCountryCode || undefined,
    phoneNumber: row.phoneNumber || undefined,
    countryCode: row.countryCode || undefined,
    countryName: row.countryName || undefined,
    stateCode: row.stateCode || undefined,
    stateName: row.stateName || undefined,
    cityName: row.cityName || undefined,
    addressLine: row.addressLine || undefined,
    zipCode: row.zipCode || undefined,
    memberTheme: row.memberTheme || 'cloud',
    memberId: row.memberId || undefined,
    permissionVersion: row.permissionVersion ?? 1,
    storageQuotaBytes: Number(row.storageQuotaBytes ?? BigInt(104857600)),
    maxFileSizeBytes: Number(row.maxFileSizeBytes ?? BigInt(15728640)),
    isActive: row.isActive,
    lastLoginAt: row.lastLoginAt || undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    timestamp: Number(row.timestampMs),
  };
}

export function sanitizeMailAccountForClient(
  acc: ServerMailAccount | GmailAccount
) {
  const isGmail = 'authMode' in acc;
  return {
    id: acc.id,
    label: acc.label,
    email: acc.email,
    username: acc.username || acc.email,
    imapHost: acc.imapHost,
    imapPort: acc.imapPort,
    imapSecure: acc.imapSecure,
    smtpHost: acc.smtpHost,
    smtpPort: acc.smtpPort,
    smtpSecure: acc.smtpSecure,
    ...(isGmail
      ? {
          authMode: (acc.authMode as 'app_password' | 'oauth_secret') || 'app_password',
          clientId: acc.clientId || '',
        }
      : {}),
    passwordHashPreview: acc.passwordHash ? `${acc.passwordHash.slice(0, 28)}...` : '',
    createdAt: acc.createdAt,
    lastVerifiedAt: acc.lastVerifiedAt || undefined,
  };
}

export function toMailMessageDto(row: MailMessage) {
  return {
    id: row.id,
    accountId: row.accountId,
    threadId: row.threadId,
    folder: (row.folder as 'inbox' | 'sent' | 'drafts') || 'inbox',
    subject: row.subject,
    fromName: row.fromName,
    fromEmail: row.fromEmail,
    to: row.toEmail,
    cc: row.cc || undefined,
    date: row.dateStr,
    timestamp: Number(row.timestampMs),
    snippet: row.snippet || '',
    bodyHtml: row.bodyHtml || '',
    bodyText: row.bodyText || '',
    isUnread: row.isUnread,
    isStarred: row.isStarred,
  };
}

export function toCustomMailTabDto(row: CustomMailTab) {
  return {
    id: row.id,
    name: row.name,
    query: row.query,
    accentColor: row.accentColor,
    description: row.description || '',
    isBulkShortcut: row.isBulkShortcut,
  };
}

export function toBulkCampaignDto(row: BulkCampaign) {
  const extra = (row.extraFields && typeof row.extraFields === 'object' ? row.extraFields : {}) as Record<string, any>;
  return {
    ...extra,
    id: row.id,
    name: row.name,
    subject: row.subject,
    bodyHtml: row.bodyHtml,
    status: row.status,
    sentCount: row.sentCount,
    totalCount: row.totalCount,
    updatedAt: row.updatedAt,
    recipients: Array.isArray(row.recipientsJson) ? row.recipientsJson : [],
  };
}

export function toWorkspaceDocDto(row: WorkspaceDoc) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    bodyText: row.bodyText,
    googleDocId: row.googleDocId || undefined,
    googleDocUrl: row.googleDocUrl || undefined,
    linkedFileId: row.linkedFileId || undefined,
    fileUrl: row.fileUrl || undefined,
    wordCount: row.wordCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    timestamp: Number(row.timestampMs),
  };
}

export function toWorkspaceSlideDto(row: WorkspaceSlide) {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle || '',
    category: row.category,
    themeColor: row.themeColor,
    authorName: row.authorName,
    pages: Array.isArray(row.pagesJson) ? row.pagesJson : [],
    linkedFileId: row.linkedFileId || undefined,
    fileUrl: row.fileUrl || undefined,
    slideCount: row.slideCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    timestamp: Number(row.timestampMs),
  };
}

export function toFormSubmissionDto(row: FormSubmission) {
  return {
    id: row.id,
    formId: row.formId,
    respondentName: row.respondentName,
    respondentEmail: row.respondentEmail,
    submittedAt: row.submittedAt,
    timestamp: Number(row.timestampMs),
    answers:
      row.answersJson && typeof row.answersJson === 'object'
        ? (row.answersJson as Record<string, string | string[]>)
        : {},
  };
}

export function toWorkspaceFormDto(
  row: WorkspaceForm & { submissions?: FormSubmission[] }
) {
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    accentColor: row.accentColor,
    isPublic: row.isPublic,
    identityMode: (row.identityMode as 'OPTIONAL' | 'REQUIRED' | 'ANONYMOUS') || 'OPTIONAL',
    targetSubmissions: row.targetSubmissions,
    autoCloseOnTarget: row.autoCloseOnTarget,
    confirmationMessage: row.confirmationMessage || '',
    googleFormUri: row.googleFormUri || undefined,
    fields: Array.isArray(row.fieldsJson) ? row.fieldsJson : [],
    createdAt: row.createdAt,
    submissions: Array.isArray(row.submissions)
      ? row.submissions
          .map(toFormSubmissionDto)
          .sort((a, b) => b.timestamp - a.timestamp)
      : [],
  };
}

export function toWorkspaceMeetingDto(row: WorkspaceMeeting) {
  return {
    id: row.id,
    title: row.title,
    agenda: row.agenda || '',
    meetingCode: row.meetingCode,
    meetingUri: row.meetingUri,
    scheduledFor: row.scheduledFor,
    durationMins: row.durationMins,
    hostEmail: row.hostEmail || undefined,
    status: (row.status as 'Active' | 'Scheduled' | 'Instant') || 'Active',
    createdAt: row.createdAt,
    timestamp: Number(row.timestampMs),
  };
}

export function toWorkspaceTeamGroupDto(row: WorkspaceTeamGroup) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    color: row.color,
    createdAt: row.createdAt,
    timestamp: Number(row.timestampMs),
  };
}

export function toWorkspaceMemberDto(row: WorkspaceMember) {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    fullName: row.fullName,
    email: row.email,
    designation: row.designation,
    teamId: row.teamId || '',
    teamName: row.teamName || '',
    phone: row.phone || undefined,
    bio: row.bio || undefined,
    avatarUrl: row.avatarUrl || undefined,
    status: (row.status as 'Active' | 'Invited') || 'Active',
    inviteToken: row.inviteToken,
    inviteSentAt: row.inviteSentAt || undefined,
    joinedAt: row.joinedAt,
    timestamp: Number(row.timestampMs),
    extraFields: row.extraFields,
  };
}

export function toWorkspacePostCategoryDto(row: WorkspacePostCategory) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    color: row.color,
    description: row.description || '',
    createdAt: row.createdAt,
  };
}

export function toWorkspacePostNoticeDto(row: WorkspacePostNotice) {
  return {
    id: row.id,
    type: (row.type as 'POST' | 'NOTICE') || 'POST',
    title: row.title,
    summary: row.summary || '',
    content: row.content,
    categoryId: row.categoryId || 'cat-general',
    categoryName: row.categoryName,
    authorName: row.authorName,
    authorRole: row.authorRole || '',
    coverImageUrl: row.coverImageUrl || undefined,
    attachments: Array.isArray(row.attachmentsJson) ? (row.attachmentsJson as any[]) : [],
    isPinned: row.isPinned,
    pinnedUntil: row.pinnedUntil || '',
    priority: (row.priority as 'Normal' | 'Important' | 'Urgent') || 'Normal',
    viewsCount: row.viewsCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    timestamp: Number(row.timestampMs),
  };
}

export function toWorkspaceFolderDto(row: WorkspaceFolder) {
  return {
    id: row.id,
    name: row.name,
    folderType: (row.folderType as 'FOLDER' | 'GALLERY' | 'DOCUMENT') || 'FOLDER',
    parentFolderId: row.parentFolderId || undefined,
    description: row.description || '',
    color: row.color,
    createdAt: row.createdAt,
    timestamp: Number(row.timestampMs),
  };
}

export function toWorkspaceFileDto(row: WorkspaceFile) {
  return {
    id: row.id,
    folderId: row.folderId,
    folderName: row.folderName,
    name: row.name,
    originalName: row.originalName,
    mimeType: row.mimeType,
    extension: row.extension,
    isImage: row.isImage,
    width: row.width ?? undefined,
    height: row.height ?? undefined,
    originalSizeBytes: Number(row.originalSizeBytes),
    compressedSizeBytes: Number(row.compressedSizeBytes),
    compressionRatio: row.compressionRatio,
    url: row.url,
    storagePath: row.storagePath,
    thumbnailUrl: row.thumbnailUrl || undefined,
    slideDeckId: row.slideDeckId || undefined,
    docId: row.docId || undefined,
    hasExtractedText: Boolean(row.bodyText && row.bodyText.length > 0),
    ownerUserId: row.ownerUserId || undefined,
    visibility: (row.visibility as 'PRIVATE' | 'WORKSPACE' | 'PUBLIC') || 'PRIVATE',
    versionCount: row.versionCount ?? 1,
    deletedAt: row.deletedAt || undefined,
    deletedTimestamp: row.deletedTimestampMs ? Number(row.deletedTimestampMs) : undefined,
    uploadedAt: row.uploadedAt,
    timestamp: Number(row.timestampMs),
  };
}

export function toNotificationDto(row: SystemNotification) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    description: row.description || '',
    module: row.module,
    targetId: row.targetId || undefined,
    accountId: row.accountId || undefined,
    timestamp: Number(row.timestampMs),
    timeLabel: row.timeLabel,
    isRead: row.isRead,
  };
}

export function toCmhFormDto(row: CmhFormTemplate) {
  const rawSubs = Array.isArray(row.submissionsJson) ? (row.submissionsJson as any[]) : [];
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    formCategory: row.formCategory,
    accessMode: (row.accessMode as 'PUBLIC' | 'PRIVATE') || 'PUBLIC',
    invitedMemberIds: Array.isArray(row.invitedMemberIdsJson) ? (row.invitedMemberIdsJson as string[]) : [],
    invitedTeamIds: Array.isArray(row.invitedTeamIdsJson) ? (row.invitedTeamIdsJson as string[]) : [],
    submitButtonLabel: row.submitButtonLabel,
    confirmationMessage: row.confirmationMessage || '',
    fields: Array.isArray(row.fieldsJson) ? (row.fieldsJson as any[]) : [],
    submissionsCount: rawSubs.length,
    submissions: rawSubs,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    timestamp: Number(row.timestampMs),
  };
}

export function toCmhTaskDto(row: CmhTask) {
  const rawSubs = Array.isArray(row.submissionsJson) ? (row.submissionsJson as any[]) : [];
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    formTemplateId: row.formTemplateId,
    formTemplateTitle: row.formTemplateTitle,
    status: row.status as 'To Do' | 'In Progress' | 'Review' | 'Completed',
    priority: row.priority as 'Low' | 'Medium' | 'High' | 'Critical',
    dueDate: row.dueDate || '',
    accessMode: (row.accessMode as 'PUBLIC' | 'PRIVATE') || 'PUBLIC',
    assignedMemberIds: Array.isArray(row.assignedMemberIdsJson) ? (row.assignedMemberIdsJson as string[]) : [],
    assignedTeamIds: Array.isArray(row.assignedTeamIdsJson) ? (row.assignedTeamIdsJson as string[]) : [],
    customFieldValues:
      row.customFieldValuesJson && typeof row.customFieldValuesJson === 'object'
        ? (row.customFieldValuesJson as Record<string, any>)
        : {},
    submissionsCount: rawSubs.length,
    submissions: rawSubs,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    timestamp: Number(row.timestampMs),
  };
}

export function toCmhProjectDto(row: CmhProject) {
  const rawSubs = Array.isArray(row.submissionsJson) ? (row.submissionsJson as any[]) : [];
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    formTemplateId: row.formTemplateId,
    formTemplateTitle: row.formTemplateTitle,
    status: row.status as 'Planning' | 'Active' | 'On Hold' | 'Completed',
    priority: row.priority as 'Low' | 'Medium' | 'High' | 'Critical',
    deadline: row.deadline || '',
    budget: row.budget || '',
    accessMode: (row.accessMode as 'PUBLIC' | 'PRIVATE') || 'PUBLIC',
    assignedMemberIds: Array.isArray(row.assignedMemberIdsJson) ? (row.assignedMemberIdsJson as string[]) : [],
    assignedTeamIds: Array.isArray(row.assignedTeamIdsJson) ? (row.assignedTeamIdsJson as string[]) : [],
    customFieldValues:
      row.customFieldValuesJson && typeof row.customFieldValuesJson === 'object'
        ? (row.customFieldValuesJson as Record<string, any>)
        : {},
    submissionsCount: rawSubs.length,
    submissions: rawSubs,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    timestamp: Number(row.timestampMs),
  };
}

export function toSystemSettingsDto(row: WorkspaceSystemSetting) {
  const integrations = Array.isArray(row.externalIntegrationsJson)
    ? (row.externalIntegrationsJson as any[]).map((ext) => ({
        ...ext,
        encryptedSecret: undefined,
      }))
    : [];

  return {
    workspaceName: row.workspaceName,
    organizationName: row.organizationName,
    adminEmail: row.adminEmail,
    timezone: row.timezone,
    dateFormat: row.dateFormat,
    defaultLandingModule: row.defaultLandingModule,
    autoSyncIntervalSec: row.autoSyncIntervalSec,
    densityMode: row.densityMode === 'compact' ? 'compact' : 'comfortable',
    defaultSignatureHtml: row.defaultSignatureHtml,
    defaultReplyTo: row.defaultReplyTo,
    bulkDelayMs: row.bulkDelayMs,
    dailySendLimit: row.dailySendLimit,
    enableReadReceipts: row.enableReadReceipts,
    autoSaveAttachmentsToFiles: row.autoSaveAttachmentsToFiles,
    enablePublicForms: row.enablePublicForms,
    enablePublicCmhPortal: row.enablePublicCmhPortal,
    incomingWebhookSecret: row.incomingWebhookSecret,
    outgoingWebhookUrl: row.outgoingWebhookUrl,
    externalIntegrations: integrations,
    updatedAt: row.updatedAt,
  };
}

export function toCmhRulesDto(row: CmhNotificationRule) {
  return {
    id: row.id,
    adminEmail: row.adminEmail,
    notifyOnFormSubmit: row.notifyOnFormSubmit,
    notifyOnTaskActivity: row.notifyOnTaskActivity,
    notifyOnProjectActivity: row.notifyOnProjectActivity,
    notifyOnMemberActivity: row.notifyOnMemberActivity,
    autoSendAdminEmail: row.autoSendAdminEmail,
    injectIntoPrimaryInbox: row.injectIntoPrimaryInbox,
    updatedAt: row.updatedAt,
  };
}
