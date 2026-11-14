import { wsFetch as fetch } from '../sessionFetch';
import { CmhNotificationRules } from '../workspaceApi';

export interface ExternalIntegrationClient {
  id: string;
  providerType: 'WEBHOOK' | 'SMTP_RELAY' | 'CUSTOM_API' | 'STORAGE_S3';
  label: string;
  endpointOrHost: string;
  clientIdOrKey: string;
  secretPreview: string;
  isActive: boolean;
  createdAt: string;
}

export interface WorkspaceSystemSettingsClient {
  workspaceName: string;
  organizationName: string;
  adminEmail: string;
  timezone: string;
  dateFormat: string;
  defaultLandingModule: string;
  autoSyncIntervalSec: number;
  densityMode: 'comfortable' | 'compact';
  defaultSignatureHtml: string;
  defaultReplyTo: string;
  bulkDelayMs: number;
  dailySendLimit: number;
  enableReadReceipts: boolean;
  autoSaveAttachmentsToFiles: boolean;
  enablePublicForms: boolean;
  enablePublicCmhPortal: boolean;
  incomingWebhookSecret: string;
  outgoingWebhookUrl: string;
  externalIntegrations: ExternalIntegrationClient[];
  updatedAt: string;
}

export interface WorkspaceSystemStats {
  gmailAccounts: number;
  serverAccounts: number;
  messages: number;
  docs: number;
  slides: number;
  forms: number;
  meetings: number;
  members: number;
  tasks: number;
  projects: number;
  files: number;
}

export async function fetchSystemSettings(): Promise<{
  settings: WorkspaceSystemSettingsClient;
  cmhRules: CmhNotificationRules;
  stats: WorkspaceSystemStats;
}> {
  const res = await fetch('/api/settings/system');
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to load workspace settings.');
  }
  return data;
}

export async function saveSystemSettings(
  settings: Partial<WorkspaceSystemSettingsClient>,
  cmhRules?: Partial<CmhNotificationRules>
): Promise<{
  ok: boolean;
  settings: WorkspaceSystemSettingsClient;
  cmhRules: CmhNotificationRules;
}> {
  const res = await fetch('/api/settings/system', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ settings, cmhRules }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to save workspace settings.');
  }
  return data;
}

export async function addExternalIntegration(payload: {
  providerType: ExternalIntegrationClient['providerType'];
  label: string;
  endpointOrHost: string;
  clientIdOrKey: string;
  secretKey: string;
}): Promise<ExternalIntegrationClient[]> {
  const res = await fetch('/api/settings/integrations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to add integration.');
  }
  return data.integrations || [];
}

export async function deleteExternalIntegration(id: string): Promise<ExternalIntegrationClient[]> {
  const res = await fetch(`/api/settings/integrations/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to remove integration.');
  }
  return data.integrations || [];
}

export async function fetchFinanceBrandLogo(): Promise<string> {
  try {
    const res = await fetch('/api/settings/finance-branding');
    if (!res.ok) return '';
    const data = await res.json();
    return String(data.brandLogoUrl || '');
  } catch {
    return '';
  }
}

export async function saveFinanceBrandLogo(brandLogoUrl: string): Promise<string> {
  const res = await fetch('/api/settings/finance-branding', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ brandLogoUrl }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to save finance brand logo.');
  }
  return String(data.brandLogoUrl || '');
}

