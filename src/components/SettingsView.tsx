import React, { useState, useEffect, useRef } from 'react';
import {
  Settings,
  Mail,
  Server,
  KeyRound,
  ShieldCheck,
  Database,
  Sliders,
  Plus,
  Trash2,
  Edit3,
  Check,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Download,
  Upload,
  Copy,
  Lock,
  Globe,
  BellRing,
  Layers,
  Sparkles,
  ExternalLink,
  Webhook,
  HardDrive,
} from 'lucide-react';
import {
  ConnectedGmailAccount,
  saveGmailAccountOnServer,
  verifyGmailConnectionOnServer,
  removeGmailAccount,
  switchActiveGmailAccount,
} from '../services/auth';
import {
  ServerMailAccount,
  ServerMailVerifyResult,
  CustomMailTab,
  WorkspaceSystemSettingsClient,
  WorkspaceSystemStats,
  CmhNotificationRules,
  PostgresConfigClient,
  ExternalIntegrationClient,
  VpsStorageDiagnosticsClient,
  verifyServerMailConnection,
  saveServerMailAccount,
  deleteServerMailAccount,
  saveCustomMailTab,
  deleteCustomMailTab,
  fetchSystemSettings,
  saveSystemSettings,
  addExternalIntegration,
  deleteExternalIntegration,
  fetchDatabaseConfig,
  saveDatabaseConfig,
  fetchVpsStorageDiagnostics,
  runVpsStorageCleanup,
  formatBytes,
  exportWorkspaceBackupJson,
  restoreWorkspaceBackupJson,
} from '../services/workspaceApi';

export type SettingsSubTab = 'accounts' | 'general' | 'mail_rules' | 'database' | 'security';
export type AccountSetupType = 'gmail' | 'server_mail' | 'smtp_relay' | 'api_webhook';

interface SettingsViewProps {
  activeSubTab: SettingsSubTab;
  onSelectSubTab: (tab: SettingsSubTab) => void;
  gmailAccounts: ConnectedGmailAccount[];
  activeGmailEmail: string | null;
  onGmailAccountsChanged: (accounts: ConnectedGmailAccount[], activeEmail?: string | null) => void;
  serverAccounts: ServerMailAccount[];
  activeServerAccountId: string | null;
  onSelectServerAccount: (id: string) => void;
  onServerAccountsChanged: (accounts: ServerMailAccount[], newActiveId?: string) => void;
  customTabs: CustomMailTab[];
  onCustomTabsChanged: (tabs: CustomMailTab[]) => void;
  onOpenModule: (module: 'gmail' | 'server_mail' | 'bulk') => void;
  onWorkspaceNameChanged?: (name: string) => void;
}

const SMTP_RELAY_PRESETS = [
  {
    id: 'preset-cpanel',
    name: 'cPanel / Custom Domain',
    imapHost: 'mail.yourdomain.com',
    imapPort: 993,
    smtpHost: 'mail.yourdomain.com',
    smtpPort: 465,
  },
  {
    id: 'preset-outlook',
    name: 'Microsoft 365 / Outlook',
    imapHost: 'outlook.office365.com',
    imapPort: 993,
    smtpHost: 'smtp.office365.com',
    smtpPort: 587,
  },
  {
    id: 'preset-zoho',
    name: 'Zoho Mail Pro',
    imapHost: 'imappro.zoho.com',
    imapPort: 993,
    smtpHost: 'smtppro.zoho.com',
    smtpPort: 465,
  },
  {
    id: 'preset-sendgrid',
    name: 'SendGrid / SES Relay',
    imapHost: 'imap.yourdomain.com',
    imapPort: 993,
    smtpHost: 'smtp.sendgrid.net',
    smtpPort: 465,
  },
];

export const SettingsView: React.FC<SettingsViewProps> = ({
  activeSubTab,
  onSelectSubTab,
  gmailAccounts,
  activeGmailEmail,
  onGmailAccountsChanged,
  serverAccounts,
  activeServerAccountId,
  onSelectServerAccount,
  onServerAccountsChanged,
  customTabs,
  onCustomTabsChanged,
  onOpenModule,
  onWorkspaceNameChanged,
}) => {
  const [accountType, setAccountType] = useState<AccountSetupType>('gmail');
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 4500);
  };

  // ============================================================================
  // 1. GMAIL ACCOUNT FORM STATE
  // ============================================================================
  const [gmailEditingId, setGmailEditingId] = useState<string | undefined>(undefined);
  const [gmailLabel, setGmailLabel] = useState<string>('');
  const [gmailEmail, setGmailEmail] = useState<string>('');
  const [gmailAuthMode, setGmailAuthMode] = useState<'app_password' | 'oauth_secret'>(
    'app_password'
  );
  const [gmailPassword, setGmailPassword] = useState<string>('');
  const [gmailClientId, setGmailClientId] = useState<string>('');
  const [gmailClientSecret, setGmailClientSecret] = useState<string>('');
  const [gmailRefreshToken, setGmailRefreshToken] = useState<string>('');
  const [gmailImapHost, setGmailImapHost] = useState<string>('imap.gmail.com');
  const [gmailImapPort, setGmailImapPort] = useState<number>(993);
  const [gmailSmtpHost, setGmailSmtpHost] = useState<string>('smtp.gmail.com');
  const [gmailSmtpPort, setGmailSmtpPort] = useState<number>(465);
  const [isVerifyingGmail, setIsVerifyingGmail] = useState<boolean>(false);
  const [isSavingGmail, setIsSavingGmail] = useState<boolean>(false);
  const [gmailVerifyResult, setGmailVerifyResult] = useState<ServerMailVerifyResult | null>(null);

  // ============================================================================
  // 2. SERVER MAIL / SMTP RELAY FORM STATE
  // ============================================================================
  const [serverEditingId, setServerEditingId] = useState<string | undefined>(undefined);
  const [serverLabel, setServerLabel] = useState<string>('');
  const [serverEmail, setServerEmail] = useState<string>('');
  const [serverUsername, setServerUsername] = useState<string>('');
  const [serverPassword, setServerPassword] = useState<string>('');
  const [serverImapHost, setServerImapHost] = useState<string>('');
  const [serverImapPort, setServerImapPort] = useState<number>(993);
  const [serverImapSecure, setServerImapSecure] = useState<boolean>(true);
  const [serverSmtpHost, setServerSmtpHost] = useState<string>('');
  const [serverSmtpPort, setServerSmtpPort] = useState<number>(465);
  const [serverSmtpSecure, setServerSmtpSecure] = useState<boolean>(true);
  const [isVerifyingServer, setIsVerifyingServer] = useState<boolean>(false);
  const [isSavingServer, setIsSavingServer] = useState<boolean>(false);
  const [serverVerifyResult, setServerVerifyResult] = useState<ServerMailVerifyResult | null>(
    null
  );

  // ============================================================================
  // 3. EXTERNAL API / WEBHOOK CONNECTOR FORM STATE
  // ============================================================================
  const [extType, setExtType] = useState<ExternalIntegrationClient['providerType']>('CUSTOM_API');
  const [extLabel, setExtLabel] = useState<string>('');
  const [extEndpoint, setExtEndpoint] = useState<string>('');
  const [extClientId, setExtClientId] = useState<string>('');
  const [extSecretKey, setExtSecretKey] = useState<string>('');
  const [isSavingExt, setIsSavingExt] = useState<boolean>(false);

  // ============================================================================
  // 4. SYSTEM SETTINGS, MAIL RULES & DATABASE CONFIG STATE
  // ============================================================================
  const [sysSettings, setSysSettings] = useState<WorkspaceSystemSettingsClient>({
    workspaceName: 'Workspace Pro',
    organizationName: '',
    adminEmail: '',
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
    externalIntegrations: [],
    updatedAt: '',
  });
  const [cmhRules, setCmhRules] = useState<CmhNotificationRules>({
    id: 'cmh-rules-default',
    adminEmail: '',
    notifyOnFormSubmit: true,
    notifyOnTaskActivity: true,
    notifyOnProjectActivity: true,
    notifyOnMemberActivity: true,
    autoSendAdminEmail: false,
    injectIntoPrimaryInbox: true,
    updatedAt: '',
  });
  const [sysStats, setSysStats] = useState<WorkspaceSystemStats>({
    gmailAccounts: 0,
    serverAccounts: 0,
    messages: 0,
    docs: 0,
    slides: 0,
    forms: 0,
    meetings: 0,
    members: 0,
    tasks: 0,
    projects: 0,
    files: 0,
  });
  const [isSavingSys, setIsSavingSys] = useState<boolean>(false);

  // Custom Mail Tab Form inside Mail Rules
  const [newTabName, setNewTabName] = useState<string>('');
  const [newTabQuery, setNewTabQuery] = useState<string>('');

  const [embeddedInfo, setEmbeddedInfo] = useState<{
    mode?: string;
    port?: number;
    dbPath?: string;
    walPath?: string;
    sizeBytes?: number;
    walSizeBytes?: number;
    journalMode?: string;
  } | null>(null);
  const [pgConfig, setPgConfig] = useState<PostgresConfigClient>({
    enabled: false,
    connectionString: '',
    host: 'localhost',
    port: 5432,
    database: 'workspace_pro',
    user: 'postgres',
    ssl: false,
    autoMigrateOnStartup: true,
  });
  const [pgPassword, setPgPassword] = useState<string>('');
  const [prismaSchemaText, setPrismaSchemaText] = useState<string>('');
  const [sqlSchemaText, setSqlSchemaText] = useState<string>('');
  const [schemaViewMode, setSchemaViewMode] = useState<'prisma' | 'sql'>('prisma');
  const [isSavingPg, setIsSavingPg] = useState<boolean>(false);
  const [pgMigrationFeedback, setPgMigrationFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [copiedSchema, setCopiedSchema] = useState<boolean>(false);
  const [vpsStorage, setVpsStorage] = useState<VpsStorageDiagnosticsClient | null>(null);
  const [isCleaningStorage, setIsCleaningStorage] = useState<boolean>(false);
  const backupFileInputRef = useRef<HTMLInputElement>(null);

  const loadAllSettingsData = async () => {
    try {
      const [sysRes, dbRes, storageRes] = await Promise.all([
        fetchSystemSettings(),
        fetchDatabaseConfig(),
        fetchVpsStorageDiagnostics().catch(() => null),
      ]);
      setSysSettings(sysRes.settings);
      setCmhRules(sysRes.cmhRules);
      setSysStats(sysRes.stats);
      setPgConfig(dbRes.config);
      if ((dbRes as any).embedded) {
        setEmbeddedInfo((dbRes as any).embedded);
      }
      setPrismaSchemaText(dbRes.prismaSchema || '');
      setSqlSchemaText(dbRes.schemaSql || '');
      if (storageRes) {
        setVpsStorage(storageRes);
      }
    } catch {
      // ignore initial load error
    }
  };

  useEffect(() => {
    loadAllSettingsData();
  }, []);

  // ============================================================================
  // GMAIL ACCOUNT HANDLERS
  // ============================================================================
  const resetGmailForm = () => {
    setGmailEditingId(undefined);
    setGmailLabel('');
    setGmailEmail('');
    setGmailPassword('');
    setGmailClientId('');
    setGmailClientSecret('');
    setGmailRefreshToken('');
    setGmailImapHost('imap.gmail.com');
    setGmailImapPort(993);
    setGmailSmtpHost('smtp.gmail.com');
    setGmailSmtpPort(465);
    setGmailVerifyResult(null);
  };

  const handleEditGmailAccount = (acc: ConnectedGmailAccount) => {
    setAccountType('gmail');
    setGmailEditingId(acc.id);
    setGmailLabel(acc.displayName);
    setGmailEmail(acc.email);
    setGmailAuthMode(acc.authMode || 'app_password');
    setGmailClientId(acc.clientId || '');
    setGmailPassword('');
    setGmailImapHost(acc.imapHost || 'imap.gmail.com');
    setGmailImapPort(acc.imapPort || 993);
    setGmailSmtpHost(acc.smtpHost || 'smtp.gmail.com');
    setGmailSmtpPort(acc.smtpPort || 465);
    setGmailVerifyResult(null);
  };

  const handleTestGmail = async (targetAcc?: ConnectedGmailAccount) => {
    setIsVerifyingGmail(true);
    setGmailVerifyResult(null);
    try {
      const res = await verifyGmailConnectionOnServer(
        targetAcc
          ? {
              accountId: targetAcc.id,
              email: targetAcc.email,
              username: targetAcc.email,
              imapHost: targetAcc.imapHost || 'imap.gmail.com',
              imapPort: targetAcc.imapPort || 993,
              imapSecure: true,
              smtpHost: targetAcc.smtpHost || 'smtp.gmail.com',
              smtpPort: targetAcc.smtpPort || 465,
              smtpSecure: true,
            }
          : {
              accountId: gmailEditingId,
              email: gmailEmail.trim(),
              username: gmailEmail.trim(),
              password: gmailPassword.trim(),
              imapHost: gmailImapHost.trim() || 'imap.gmail.com',
              imapPort: Number(gmailImapPort) || 993,
              imapSecure: true,
              smtpHost: gmailSmtpHost.trim() || 'smtp.gmail.com',
              smtpPort: Number(gmailSmtpPort) || 465,
              smtpSecure: true,
            }
      );
      setGmailVerifyResult(res);
    } catch (err: any) {
      showToast('error', err?.message || 'Gmail connection test failed.');
    } finally {
      setIsVerifyingGmail(false);
    }
  };

  const handleSaveGmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gmailEmail.trim()) {
      showToast('error', 'Please enter a valid Gmail address.');
      return;
    }
    setIsSavingGmail(true);
    try {
      const { account, accounts } = await saveGmailAccountOnServer({
        id: gmailEditingId,
        label: gmailLabel.trim() || gmailEmail.split('@')[0],
        email: gmailEmail.trim(),
        username: gmailEmail.trim(),
        password: gmailPassword.trim() || undefined,
        authMode: gmailAuthMode,
        clientId: gmailClientId.trim() || undefined,
        clientSecret: gmailClientSecret.trim() || undefined,
        refreshToken: gmailRefreshToken.trim() || undefined,
        imapHost: gmailImapHost.trim() || 'imap.gmail.com',
        imapPort: Number(gmailImapPort) || 993,
        imapSecure: true,
        smtpHost: gmailSmtpHost.trim() || 'smtp.gmail.com',
        smtpPort: Number(gmailSmtpPort) || 465,
        smtpSecure: true,
      });
      onGmailAccountsChanged(accounts, account.email);
      showToast('success', `Gmail account "${account.email}" saved & encrypted in database!`);
      resetGmailForm();
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to save Gmail account.');
    } finally {
      setIsSavingGmail(false);
    }
  };

  // ============================================================================
  // SERVER MAIL / SMTP RELAY HANDLERS
  // ============================================================================
  const handleServerEmailChange = (val: string) => {
    setServerEmail(val);
    if (!serverUsername || serverUsername === serverEmail) {
      setServerUsername(val);
    }
    const domain = val.split('@')[1];
    if (domain && domain.includes('.') && !serverEditingId && accountType === 'server_mail') {
      if (!serverImapHost || serverImapHost.startsWith('mail.')) {
        setServerImapHost(`mail.${domain}`);
      }
      if (!serverSmtpHost || serverSmtpHost.startsWith('mail.')) {
        setServerSmtpHost(`mail.${domain}`);
      }
    }
  };

  const resetServerForm = () => {
    setServerEditingId(undefined);
    setServerLabel('');
    setServerEmail('');
    setServerUsername('');
    setServerPassword('');
    setServerImapHost('');
    setServerImapPort(993);
    setServerImapSecure(true);
    setServerSmtpHost('');
    setServerSmtpPort(465);
    setServerSmtpSecure(true);
    setServerVerifyResult(null);
  };

  const handleEditServerAccount = (acc: ServerMailAccount) => {
    setAccountType('server_mail');
    setServerEditingId(acc.id);
    setServerLabel(acc.label);
    setServerEmail(acc.email);
    setServerUsername(acc.username);
    setServerPassword('');
    setServerImapHost(acc.imapHost);
    setServerImapPort(acc.imapPort);
    setServerImapSecure(acc.imapSecure);
    setServerSmtpHost(acc.smtpHost);
    setServerSmtpPort(acc.smtpPort);
    setServerSmtpSecure(acc.smtpSecure);
    setServerVerifyResult(null);
  };

  const handleTestServerMail = async (targetAcc?: ServerMailAccount) => {
    setIsVerifyingServer(true);
    setServerVerifyResult(null);
    try {
      const res = await verifyServerMailConnection(
        targetAcc
          ? {
              accountId: targetAcc.id,
              email: targetAcc.email,
              username: targetAcc.username,
              imapHost: targetAcc.imapHost,
              imapPort: targetAcc.imapPort,
              imapSecure: targetAcc.imapSecure,
              smtpHost: targetAcc.smtpHost,
              smtpPort: targetAcc.smtpPort,
              smtpSecure: targetAcc.smtpSecure,
            }
          : {
              accountId: serverEditingId,
              email: serverEmail.trim(),
              username: (serverUsername || serverEmail).trim(),
              password: serverPassword,
              imapHost: serverImapHost.trim(),
              imapPort: Number(serverImapPort) || 993,
              imapSecure: serverImapSecure,
              smtpHost: serverSmtpHost.trim(),
              smtpPort: Number(serverSmtpPort) || 465,
              smtpSecure: serverSmtpSecure,
            }
      );
      setServerVerifyResult(res);
    } catch (err: any) {
      showToast('error', err?.message || 'Server Mail connection test failed.');
    } finally {
      setIsVerifyingServer(false);
    }
  };

  const handleSaveServerMail = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingServer(true);
    try {
      const result = await saveServerMailAccount({
        id: serverEditingId,
        label: serverLabel.trim() || serverEmail.split('@')[0],
        email: serverEmail.trim(),
        username: (serverUsername || serverEmail).trim(),
        password: serverPassword || undefined,
        imapHost: serverImapHost.trim(),
        imapPort: Number(serverImapPort) || 993,
        imapSecure: serverImapSecure,
        smtpHost: serverSmtpHost.trim(),
        smtpPort: Number(serverSmtpPort) || 465,
        smtpSecure: serverSmtpSecure,
      });
      onServerAccountsChanged(result.accounts, result.account.id);
      showToast('success', `Server Mail "${result.account.email}" saved & encrypted in database!`);
      resetServerForm();
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to save Server Mail account.');
    } finally {
      setIsSavingServer(false);
    }
  };

  const handleAddExternalConnector = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extLabel.trim() || !extSecretKey.trim()) {
      showToast('error', 'Label and Secret Key / API Token are required.');
      return;
    }
    setIsSavingExt(true);
    try {
      const updated = await addExternalIntegration({
        providerType: extType,
        label: extLabel.trim(),
        endpointOrHost: extEndpoint.trim(),
        clientIdOrKey: extClientId.trim(),
        secretKey: extSecretKey.trim(),
      });
      setSysSettings((prev) => ({ ...prev, externalIntegrations: updated }));
      setExtLabel('');
      setExtEndpoint('');
      setExtClientId('');
      setExtSecretKey('');
      showToast('success', 'External API / Webhook credential encrypted and saved!');
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to save external integration.');
    } finally {
      setIsSavingExt(false);
    }
  };

  const handleSaveSystemSettingsForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSys(true);
    try {
      const res = await saveSystemSettings(sysSettings, cmhRules);
      setSysSettings(res.settings);
      setCmhRules(res.cmhRules);
      onWorkspaceNameChanged?.(res.settings.workspaceName);
      showToast('success', 'Workspace settings saved to database!');
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to save settings.');
    } finally {
      setIsSavingSys(false);
    }
  };

  const handleSavePostgresAndMigrate = async (testNow: boolean) => {
    setIsSavingPg(true);
    setPgMigrationFeedback(null);
    try {
      const res = await saveDatabaseConfig({
        enabled: true,
        connectionString: pgConfig.connectionString?.trim() || undefined,
        host: pgConfig.host,
        port: Number(pgConfig.port) || 5432,
        database: pgConfig.database,
        user: pgConfig.user,
        password: pgPassword || undefined,
        ssl: pgConfig.ssl,
        autoMigrateOnStartup: pgConfig.autoMigrateOnStartup,
        testAndMigrateNow: testNow,
      });
      setPgConfig(res.config);
      setPgPassword('');
      if (res.migration) {
        setPgMigrationFeedback({
          ok: res.migration.ok,
          message: res.migration.message,
        });
      }
      showToast(
        'success',
        testNow
          ? 'PostgreSQL connected & Prisma schema synchronized!'
          : 'PostgreSQL configuration saved to .env!'
      );
    } catch (err: any) {
      setPgMigrationFeedback({
        ok: false,
        message: err?.message || 'Unable to connect to PostgreSQL.',
      });
      showToast('error', err?.message || 'PostgreSQL connection failed.');
    } finally {
      setIsSavingPg(false);
    }
  };

  const handleExportBackup = async () => {
    try {
      const backup = await exportWorkspaceBackupJson();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `workspace-pro-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('success', 'Full Workspace database backup downloaded!');
    } catch (err: any) {
      showToast('error', err?.message || 'Backup export failed.');
    }
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const res = await restoreWorkspaceBackupJson(parsed);
      showToast('success', res.message);
      loadAllSettingsData();
    } catch (err: any) {
      showToast('error', err?.message || 'Invalid backup JSON file.');
    } finally {
      if (backupFileInputRef.current) backupFileInputRef.current.value = '';
    }
  };

  const handleRunSmartStorageCleanup = async (purgeDays = 30) => {
    setIsCleaningStorage(true);
    try {
      const res = await runVpsStorageCleanup({
        pruneOrphans: true,
        purgeTrashOlderThanDays: purgeDays,
      });
      setVpsStorage(res.storage);
      showToast(
        'success',
        `Smart cleanup complete: removed ${res.cleanup.removedOrphans} orphan files & ${res.cleanup.removedTrashedFiles} expired trash items (${formatBytes(res.cleanup.reclaimedBytes)} freed).`
      );
    } catch (err: any) {
      showToast('error', err?.message || 'Storage cleanup failed.');
    } finally {
      setIsCleaningStorage(false);
    }
  };

  const navItems: Array<{
    id: SettingsSubTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'accounts', label: 'Accounts & Connections', icon: KeyRound },
    { id: 'general', label: 'General & Branding', icon: Sliders },
    { id: 'mail_rules', label: 'Mail, Signatures & Tabs', icon: Mail },
    { id: 'database', label: 'PostgreSQL & Backup', icon: Database },
    { id: 'security', label: 'Security, Webhooks & Access', icon: ShieldCheck },
  ];

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 md:rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
      {/* Top Settings Sub-Navigation Header */}
      <div className="px-4 sm:px-6 py-3 bg-[#F8FAFD] dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#0B57D0]/10 border border-[#0B57D0]/20 flex items-center justify-center text-[#0B57D0]">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Settings &amp; Account Control Center
            </h1>
            <p className="text-xs text-slate-500">
              Centralized management for Gmail, Server Mail, SMTP Relays, PostgreSQL Database, and External Storage
            </p>
          </div>
        </div>

        {/* Sub-Tab Selector Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeSubTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectSubTab(item.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-[#0B57D0] text-white shadow-2xs'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Toast Feedback Banner */}
      {toastMsg && (
        <div
          className={`mx-4 sm:mx-6 mt-3 px-4 py-2.5 rounded-xl border flex items-center justify-between text-xs font-semibold ${
            toastMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <span className="flex items-center gap-2">
            {toastMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            {toastMsg.text}
          </span>
          <button
            type="button"
            onClick={() => setToastMsg(null)}
            className="text-slate-400 hover:text-slate-700"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Scrollable Settings Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* ===================================================================
              TAB 1: ACCOUNTS & CONNECTIONS HUB
          =================================================================== */}
          {activeSubTab === 'accounts' && (
            <div className="space-y-6">
              {/* Connected Accounts Overview Directory */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Connected Gmail Accounts Card */}
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-[#EA4335]" />
                      <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                        Connected Gmail Accounts ({gmailAccounts.length})
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        resetGmailForm();
                        setAccountType('gmail');
                      }}
                      className="text-xs font-semibold text-[#0B57D0] hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Gmail</span>
                    </button>
                  </div>

                  {gmailAccounts.length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-500 text-center">
                      No Gmail accounts added yet. Use the form below to connect your Gmail via App Password or Secret Key.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {gmailAccounts.map((acc) => {
                        const isCurrent = activeGmailEmail === acc.email;
                        return (
                          <div
                            key={acc.id || acc.email}
                            className={`flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl border ${
                              isCurrent
                                ? 'border-[#0B57D0] bg-blue-50/40 dark:bg-blue-950/30'
                                : 'border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/40'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100">
                                <span className="truncate">{acc.displayName}</span>
                                {isCurrent && (
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-semibold">
                                    Active
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] font-mono text-slate-500 truncate">
                                {acc.email} · {acc.imapHost || 'imap.gmail.com'}:
                                {acc.imapPort || 993}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {!isCurrent && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const switched = switchActiveGmailAccount(acc.email);
                                    if (switched) {
                                      onGmailAccountsChanged(gmailAccounts, switched.email);
                                      showToast('success', `Active Gmail switched to ${switched.email}`);
                                    }
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-[#0B57D0] text-white text-[11px] font-semibold"
                                >
                                  Set Active
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  switchActiveGmailAccount(acc.email);
                                  onGmailAccountsChanged(gmailAccounts, acc.email);
                                  onOpenModule('gmail');
                                }}
                                className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[11px] font-semibold hover:bg-slate-50"
                              >
                                Inbox
                              </button>
                              <button
                                type="button"
                                onClick={() => handleTestGmail(acc)}
                                className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-medium hover:bg-slate-200"
                              >
                                Test
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEditGmailAccount(acc)}
                                className="p-1.5 text-slate-500 hover:text-[#0B57D0]"
                                title="Edit Gmail Account"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  const remaining = await removeGmailAccount(acc.id || acc.email);
                                  onGmailAccountsChanged(remaining, remaining[0]?.email || null);
                                  showToast('success', `Removed Gmail account ${acc.email}`);
                                }}
                                className="p-1.5 text-slate-400 hover:text-red-600"
                                title="Remove Gmail Account"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Connected Server Mail / Domain Accounts Card */}
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Server className="w-4 h-4 text-[#0B57D0]" />
                      <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                        Connected Server Mail Accounts ({serverAccounts.length})
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        resetServerForm();
                        setAccountType('server_mail');
                      }}
                      className="text-xs font-semibold text-[#0B57D0] hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Server Mail</span>
                    </button>
                  </div>

                  {serverAccounts.length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-500 text-center">
                      No Server Mail / Domain accounts added yet. Select "Server Mail (Domain)" below to add your cPanel or custom IMAP/SMTP account.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {serverAccounts.map((acc) => {
                        const isCurrent = activeServerAccountId === acc.id;
                        return (
                          <div
                            key={acc.id}
                            className={`flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl border ${
                              isCurrent
                                ? 'border-[#0B57D0] bg-blue-50/40 dark:bg-blue-950/30'
                                : 'border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/40'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100">
                                <span className="truncate">{acc.label}</span>
                                {isCurrent && (
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-semibold">
                                    Active
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] font-mono text-slate-500 truncate">
                                {acc.email} · {acc.imapHost}:{acc.imapPort}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {!isCurrent && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onSelectServerAccount(acc.id);
                                    showToast('success', `Active Server Mail set to ${acc.email}`);
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-[#0B57D0] text-white text-[11px] font-semibold"
                                >
                                  Set Active
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectServerAccount(acc.id);
                                  onOpenModule('server_mail');
                                }}
                                className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[11px] font-semibold hover:bg-slate-50"
                              >
                                Inbox
                              </button>
                              <button
                                type="button"
                                onClick={() => handleTestServerMail(acc)}
                                className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-medium hover:bg-slate-200"
                              >
                                Test
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEditServerAccount(acc)}
                                className="p-1.5 text-slate-500 hover:text-[#0B57D0]"
                                title="Edit Server Mail Account"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  const next = await deleteServerMailAccount(acc.id);
                                  onServerAccountsChanged(next, next[0]?.id);
                                  showToast('success', `Removed Server Mail ${acc.email}`);
                                }}
                                className="p-1.5 text-slate-400 hover:text-red-600"
                                title="Remove Server Mail Account"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Add / Configure Account Selector Box */}
              <div className="p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Add or Update Account Connection
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-emerald-600" />
                      <span>
                        Choose the account type below. All passwords and secret keys are encrypted with AES-256-GCM.
                      </span>
                    </p>
                  </div>

                  {/* Account Type Selector Tabs */}
                  <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                    {[
                      { id: 'gmail', label: 'Gmail Account', icon: Mail },
                      { id: 'server_mail', label: 'Server Mail (Domain)', icon: Server },
                      { id: 'smtp_relay', label: 'Transactional SMTP Relay', icon: Layers },
                      { id: 'api_webhook', label: 'API Key / Webhook', icon: Webhook },
                    ].map((t) => {
                      const Icon = t.icon;
                      const active = accountType === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setAccountType(t.id as AccountSetupType)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            active
                              ? 'bg-white dark:bg-slate-900 text-[#0B57D0] shadow-xs'
                              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{t.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* FORM A: GMAIL ACCOUNT */}
                {accountType === 'gmail' && (
                  <form onSubmit={handleSaveGmail} className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#EA4335] flex items-center gap-1.5">
                        <Mail className="w-4 h-4" />
                        {gmailEditingId
                          ? `Editing Gmail Account (${gmailEmail})`
                          : 'Connect Gmail via App Password or OAuth Client Secret'}
                      </span>
                      <div className="flex items-center gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => setGmailAuthMode('app_password')}
                          className={`px-3 py-1 rounded-full font-semibold ${
                            gmailAuthMode === 'app_password'
                              ? 'bg-[#EA4335]/10 text-[#EA4335] border border-[#EA4335]/30'
                              : 'text-slate-500 hover:bg-slate-100'
                          }`}
                        >
                          App Password / Secret Key
                        </button>
                        <button
                          type="button"
                          onClick={() => setGmailAuthMode('oauth_secret')}
                          className={`px-3 py-1 rounded-full font-semibold ${
                            gmailAuthMode === 'oauth_secret'
                              ? 'bg-[#EA4335]/10 text-[#EA4335] border border-[#EA4335]/30'
                              : 'text-slate-500 hover:bg-slate-100'
                          }`}
                        >
                          OAuth Client ID &amp; Secret
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Display Name / Label
                        </label>
                        <input
                          type="text"
                          value={gmailLabel}
                          onChange={(e) => setGmailLabel(e.target.value)}
                          placeholder="e.g. Executive Gmail or Support"
                          className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Gmail Address *
                        </label>
                        <input
                          type="email"
                          required
                          value={gmailEmail}
                          onChange={(e) => setGmailEmail(e.target.value)}
                          placeholder="yourname@gmail.com"
                          className="w-full px-3 py-2 text-sm font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                        />
                      </div>
                    </div>

                    {gmailAuthMode === 'app_password' ? (
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          {gmailEditingId
                            ? 'Google App Password / Secret Key (leave blank to keep existing)'
                            : 'Google App Password / Secret Key *'}
                        </label>
                        <input
                          type="password"
                          required={!gmailEditingId}
                          value={gmailPassword}
                          onChange={(e) => setGmailPassword(e.target.value)}
                          placeholder="16-character Google App Password (e.g. abcd efgh ijkl mnop)"
                          className="w-full px-3 py-2 text-sm font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                        />
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Google Client ID
                          </label>
                          <input
                            type="text"
                            value={gmailClientId}
                            onChange={(e) => setGmailClientId(e.target.value)}
                            placeholder="xxxx.apps.googleusercontent.com"
                            className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Client Secret
                          </label>
                          <input
                            type="password"
                            value={gmailClientSecret}
                            onChange={(e) => setGmailClientSecret(e.target.value)}
                            placeholder="GOCSPX-..."
                            className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            App Password / Refresh Token *
                          </label>
                          <input
                            type="password"
                            required={!gmailEditingId}
                            value={gmailPassword || gmailRefreshToken}
                            onChange={(e) => {
                              setGmailPassword(e.target.value);
                              setGmailRefreshToken(e.target.value);
                            }}
                            placeholder="1//04... or App Password"
                            className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                          />
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                          IMAP Host
                        </label>
                        <input
                          type="text"
                          value={gmailImapHost}
                          onChange={(e) => setGmailImapHost(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                          IMAP Port (SSL)
                        </label>
                        <input
                          type="number"
                          value={gmailImapPort}
                          onChange={(e) => setGmailImapPort(Number(e.target.value))}
                          className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                          SMTP Host
                        </label>
                        <input
                          type="text"
                          value={gmailSmtpHost}
                          onChange={(e) => setGmailSmtpHost(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                          SMTP Port (SSL)
                        </label>
                        <input
                          type="number"
                          value={gmailSmtpPort}
                          onChange={(e) => setGmailSmtpPort(Number(e.target.value))}
                          className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                        />
                      </div>
                    </div>

                    {gmailVerifyResult && (
                      <div
                        className={`p-3.5 rounded-xl border text-xs space-y-1 ${
                          gmailVerifyResult.ok
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                            : 'bg-amber-50 border-amber-200 text-amber-900'
                        }`}
                      >
                        <div className="font-semibold">
                          • Incoming IMAP: {gmailVerifyResult.imapMessage}
                        </div>
                        <div className="font-semibold">
                          • Outgoing SMTP: {gmailVerifyResult.smtpMessage}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
                      {gmailEditingId && (
                        <button
                          type="button"
                          onClick={resetGmailForm}
                          className="px-4 py-2 rounded-full text-xs font-semibold text-slate-600 hover:bg-slate-100"
                        >
                          Cancel Edit
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleTestGmail()}
                        disabled={isVerifyingGmail || !gmailEmail}
                        className="px-4 py-2 rounded-full border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50"
                      >
                        {isVerifyingGmail ? 'Testing Gmail...' : 'Test IMAP & SMTP'}
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingGmail}
                        className="px-5 py-2 rounded-full bg-[#0B57D0] hover:bg-blue-700 text-white text-xs font-semibold"
                      >
                        {isSavingGmail
                          ? 'Saving...'
                          : gmailEditingId
                          ? 'Update Gmail Account'
                          : 'Save Gmail Account'}
                      </button>
                    </div>
                  </form>
                )}

                {/* FORM B & C: SERVER MAIL (cPANEL / DOMAIN) OR TRANSACTIONAL SMTP RELAY */}
                {(accountType === 'server_mail' || accountType === 'smtp_relay') && (
                  <form onSubmit={handleSaveServerMail} className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#0B57D0] flex items-center gap-1.5">
                        <Server className="w-4 h-4" />
                        {serverEditingId
                          ? `Editing Server Mail (${serverEmail})`
                          : accountType === 'smtp_relay'
                          ? 'Add Transactional SMTP / Relay Account'
                          : 'Add cPanel / Custom Domain IMAP & SMTP Account'}
                      </span>

                      {/* Quick Provider Presets */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] text-slate-400">Quick Preset:</span>
                        {SMTP_RELAY_PRESETS.map((preset) => (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => {
                              setServerImapHost(preset.imapHost);
                              setServerImapPort(preset.imapPort);
                              setServerImapSecure(preset.imapPort === 993);
                              setServerSmtpHost(preset.smtpHost);
                              setServerSmtpPort(preset.smtpPort);
                              setServerSmtpSecure(preset.smtpPort === 465);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 text-[11px] font-semibold text-slate-700 dark:text-slate-300"
                          >
                            {preset.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Account Label / Department Name
                        </label>
                        <input
                          type="text"
                          value={serverLabel}
                          onChange={(e) => setServerLabel(e.target.value)}
                          placeholder="e.g. Official Domain Support"
                          className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Sender / Domain Email Address *
                        </label>
                        <input
                          type="email"
                          required
                          value={serverEmail}
                          onChange={(e) => handleServerEmailChange(e.target.value)}
                          placeholder="admin@yourdomain.com"
                          className="w-full px-3 py-2 text-sm font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          SMTP / IMAP Username *
                        </label>
                        <input
                          type="text"
                          required
                          value={serverUsername}
                          onChange={(e) => setServerUsername(e.target.value)}
                          placeholder="admin@yourdomain.com or API username"
                          className="w-full px-3 py-2 text-sm font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          {serverEditingId
                            ? 'Password / SMTP Key (leave blank to keep existing)'
                            : 'Password / SMTP Secret Key *'}
                        </label>
                        <input
                          type="password"
                          required={!serverEditingId}
                          value={serverPassword}
                          onChange={(e) => setServerPassword(e.target.value)}
                          placeholder="••••••••••••"
                          className="w-full px-3 py-2 text-sm font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3">
                        <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                          Incoming Server (IMAP)
                        </div>
                        <div className="grid grid-cols-3 gap-2.5">
                          <div className="col-span-2">
                            <label className="block text-[11px] text-slate-500 mb-1">
                              IMAP Host *
                            </label>
                            <input
                              type="text"
                              required
                              value={serverImapHost}
                              onChange={(e) => setServerImapHost(e.target.value)}
                              placeholder="mail.yourdomain.com"
                              className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] text-slate-500 mb-1">
                              Port *
                            </label>
                            <input
                              type="number"
                              required
                              value={serverImapPort}
                              onChange={(e) => setServerImapPort(Number(e.target.value))}
                              className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                            />
                          </div>
                        </div>
                        <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={serverImapSecure}
                            onChange={(e) => setServerImapSecure(e.target.checked)}
                            className="rounded accent-[#0B57D0]"
                          />
                          <span>Use SSL/TLS (Port 993)</span>
                        </label>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3">
                        <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                          Outgoing Server (SMTP)
                        </div>
                        <div className="grid grid-cols-3 gap-2.5">
                          <div className="col-span-2">
                            <label className="block text-[11px] text-slate-500 mb-1">
                              SMTP Host *
                            </label>
                            <input
                              type="text"
                              required
                              value={serverSmtpHost}
                              onChange={(e) => setServerSmtpHost(e.target.value)}
                              placeholder="mail.yourdomain.com"
                              className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] text-slate-500 mb-1">
                              Port *
                            </label>
                            <input
                              type="number"
                              required
                              value={serverSmtpPort}
                              onChange={(e) => setServerSmtpPort(Number(e.target.value))}
                              className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                            />
                          </div>
                        </div>
                        <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={serverSmtpSecure}
                            onChange={(e) => setServerSmtpSecure(e.target.checked)}
                            className="rounded accent-[#0B57D0]"
                          />
                          <span>Use SSL/TLS (Port 465)</span>
                        </label>
                      </div>
                    </div>

                    {serverVerifyResult && (
                      <div
                        className={`p-3.5 rounded-xl border text-xs space-y-1 ${
                          serverVerifyResult.ok
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                            : 'bg-amber-50 border-amber-200 text-amber-900'
                        }`}
                      >
                        <div className="font-semibold">
                          • Incoming IMAP: {serverVerifyResult.imapMessage}
                        </div>
                        <div className="font-semibold">
                          • Outgoing SMTP: {serverVerifyResult.smtpMessage}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
                      {serverEditingId && (
                        <button
                          type="button"
                          onClick={resetServerForm}
                          className="px-4 py-2 rounded-full text-xs font-semibold text-slate-600 hover:bg-slate-100"
                        >
                          Cancel Edit
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleTestServerMail()}
                        disabled={isVerifyingServer || !serverEmail || !serverImapHost || !serverSmtpHost}
                        className="px-4 py-2 rounded-full border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50"
                      >
                        {isVerifyingServer ? 'Checking Server...' : 'Test IMAP & SMTP'}
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingServer}
                        className="px-5 py-2 rounded-full bg-[#0B57D0] hover:bg-blue-700 text-white text-xs font-semibold"
                      >
                        {isSavingServer
                          ? 'Saving...'
                          : serverEditingId
                          ? 'Update Server Mail'
                          : 'Save Server Mail Account'}
                      </button>
                    </div>
                  </form>
                )}

                {/* FORM D: EXTERNAL API KEY / WEBHOOK CONNECTOR */}
                {accountType === 'api_webhook' && (
                  <div className="space-y-4">
                    <form onSubmit={handleAddExternalConnector} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Connector Type
                          </label>
                          <select
                            value={extType}
                            onChange={(e) =>
                              setExtType(e.target.value as ExternalIntegrationClient['providerType'])
                            }
                            className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                          >
                            <option value="CUSTOM_API">External App / REST API Key</option>
                            <option value="WEBHOOK">Outgoing / Incoming Webhook Endpoint</option>
                            <option value="STORAGE_S3">Cloud Object Storage (S3 / R2) Key</option>
                            <option value="SMTP_RELAY">API Mail Token (SendGrid / Resend / Mailgun)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Connection Label *
                          </label>
                          <input
                            type="text"
                            required
                            value={extLabel}
                            onChange={(e) => setExtLabel(e.target.value)}
                            placeholder="e.g. CRM Webhook or Production API Key"
                            className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Endpoint URL / Host (Optional)
                          </label>
                          <input
                            type="text"
                            value={extEndpoint}
                            onChange={(e) => setExtEndpoint(e.target.value)}
                            placeholder="https://api.yourdomain.com/v1/webhook"
                            className="w-full px-3 py-2 text-sm font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Client ID / App Key (Optional)
                          </label>
                          <input
                            type="text"
                            value={extClientId}
                            onChange={(e) => setExtClientId(e.target.value)}
                            placeholder="app_id_..."
                            className="w-full px-3 py-2 text-sm font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Secret Key / Bearer Token *
                          </label>
                          <input
                            type="password"
                            required
                            value={extSecretKey}
                            onChange={(e) => setExtSecretKey(e.target.value)}
                            placeholder="sk_live_••••••••••••••••••••••••"
                            className="w-full px-3 py-2 text-sm font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={isSavingExt}
                          className="px-5 py-2 rounded-full bg-[#0B57D0] hover:bg-blue-700 text-white text-xs font-semibold"
                        >
                          {isSavingExt ? 'Encrypting & Saving...' : 'Save API / Webhook Key'}
                        </button>
                      </div>
                    </form>

                    {sysSettings.externalIntegrations.length > 0 && (
                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                        <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                          Saved API &amp; Webhook Keys ({sysSettings.externalIntegrations.length})
                        </div>
                        <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                          {sysSettings.externalIntegrations.map((ext) => (
                            <div
                              key={ext.id}
                              className="flex items-center justify-between px-4 py-2.5 bg-slate-50/50 dark:bg-slate-800/40 text-xs"
                            >
                              <div>
                                <div className="font-bold text-slate-900 dark:text-slate-100">
                                  {ext.label}{' '}
                                  <span className="ml-1.5 px-2 py-0.5 rounded bg-blue-50 text-[#0B57D0] text-[10px]">
                                    {ext.providerType}
                                  </span>
                                </div>
                                <div className="text-[11px] font-mono text-slate-500">
                                  {ext.endpointOrHost || 'Local Engine'} · Key: {ext.secretPreview}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={async () => {
                                  const next = await deleteExternalIntegration(ext.id);
                                  setSysSettings((prev) => ({
                                    ...prev,
                                    externalIntegrations: next,
                                  }));
                                  showToast('success', 'Removed external integration key.');
                                }}
                                className="p-1.5 text-slate-400 hover:text-red-600"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===================================================================
              TAB 2: GENERAL & BRANDING SETTINGS
          =================================================================== */}
          {activeSubTab === 'general' && (
            <form
              onSubmit={handleSaveSystemSettingsForm}
              className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-5"
            >
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Workspace Identity, Branding &amp; Preferences
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Customize your application title, organization branding, default startup module, and real-time sync intervals.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Application / Workspace Title
                  </label>
                  <input
                    type="text"
                    value={sysSettings.workspaceName}
                    onChange={(e) =>
                      setSysSettings((s) => ({ ...s, workspaceName: e.target.value }))
                    }
                    placeholder="Workspace Pro"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Organization / Company Name
                  </label>
                  <input
                    type="text"
                    value={sysSettings.organizationName}
                    onChange={(e) =>
                      setSysSettings((s) => ({ ...s, organizationName: e.target.value }))
                    }
                    placeholder="Your Company Name"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Primary Admin Contact Email
                  </label>
                  <input
                    type="email"
                    value={sysSettings.adminEmail}
                    onChange={(e) =>
                      setSysSettings((s) => ({ ...s, adminEmail: e.target.value }))
                    }
                    placeholder="admin@yourdomain.com"
                    className="w-full px-3 py-2 text-sm font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Default Module on Startup
                  </label>
                  <select
                    value={sysSettings.defaultLandingModule}
                    onChange={(e) =>
                      setSysSettings((s) => ({ ...s, defaultLandingModule: e.target.value }))
                    }
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    <option value="gmail">Gmail Inbox</option>
                    <option value="server_mail">Server Mail Inbox</option>
                    <option value="bulk">Bulk Mail Studio</option>
                    <option value="docs">Docs</option>
                    <option value="slides">Slides</option>
                    <option value="forms">Forms</option>
                    <option value="meet">Meet</option>
                    <option value="teams">Teams &amp; Members</option>
                    <option value="files">File Manager</option>
                    <option value="cmh_tasks">CMH Tasks</option>
                    <option value="cmh_projects">CMH Projects</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Default Timezone
                  </label>
                  <select
                    value={sysSettings.timezone}
                    onChange={(e) =>
                      setSysSettings((s) => ({ ...s, timezone: e.target.value }))
                    }
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    <option value="Asia/Dhaka">Asia/Dhaka (GMT+6)</option>
                    <option value="UTC">UTC (GMT+0)</option>
                    <option value="America/New_York">America/New_York (EST/EDT)</option>
                    <option value="Europe/London">Europe/London (GMT/BST)</option>
                    <option value="Asia/Dubai">Asia/Dubai (GMT+4)</option>
                    <option value="Asia/Singapore">Asia/Singapore (GMT+8)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Background Mail Sync Interval (Seconds)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={300}
                    value={sysSettings.autoSyncIntervalSec}
                    onChange={(e) =>
                      setSysSettings((s) => ({
                        ...s,
                        autoSyncIntervalSec: Number(e.target.value),
                      }))
                    }
                    className="w-full px-3 py-2 text-sm font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSavingSys}
                  className="px-5 py-2 rounded-full bg-[#0B57D0] hover:bg-blue-700 text-white text-xs font-semibold"
                >
                  {isSavingSys ? 'Saving...' : 'Save General Settings'}
                </button>
              </div>
            </form>
          )}

          {/* ===================================================================
              TAB 3: MAIL ENGINE, SIGNATURES & CUSTOM TABS
          =================================================================== */}
          {activeSubTab === 'mail_rules' && (
            <div className="space-y-6">
              <form
                onSubmit={handleSaveSystemSettingsForm}
                className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-5"
              >
                <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Mail Engine, Global Signature &amp; Automation Rules
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Configure default email signatures, reply-to headers, bulk mail throttling, and CMH notification delivery rules.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Default Reply-To Address
                    </label>
                    <input
                      type="email"
                      value={sysSettings.defaultReplyTo}
                      onChange={(e) =>
                        setSysSettings((s) => ({ ...s, defaultReplyTo: e.target.value }))
                      }
                      placeholder="reply@yourdomain.com"
                      className="w-full px-3 py-2 text-sm font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Bulk Mail Throttle Delay (ms)
                    </label>
                    <input
                      type="number"
                      min={100}
                      max={10000}
                      value={sysSettings.bulkDelayMs}
                      onChange={(e) =>
                        setSysSettings((s) => ({ ...s, bulkDelayMs: Number(e.target.value) }))
                      }
                      className="w-full px-3 py-2 text-sm font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Daily Outgoing Send Limit
                    </label>
                    <input
                      type="number"
                      min={10}
                      max={50000}
                      value={sysSettings.dailySendLimit}
                      onChange={(e) =>
                        setSysSettings((s) => ({ ...s, dailySendLimit: Number(e.target.value) }))
                      }
                      className="w-full px-3 py-2 text-sm font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Global Email Signature (Appended to outgoing messages)
                  </label>
                  <textarea
                    rows={3}
                    value={sysSettings.defaultSignatureHtml}
                    onChange={(e) =>
                      setSysSettings((s) => ({ ...s, defaultSignatureHtml: e.target.value }))
                    }
                    placeholder="Best regards,&#10;Your Name | Organization"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sysSettings.autoSaveAttachmentsToFiles}
                      onChange={(e) =>
                        setSysSettings((s) => ({
                          ...s,
                          autoSaveAttachmentsToFiles: e.target.checked,
                        }))
                      }
                      className="rounded accent-[#0B57D0]"
                    />
                    <span>Automatically index email attachments in Server File Manager</span>
                  </label>

                  <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cmhRules.injectIntoPrimaryInbox}
                      onChange={(e) =>
                        setCmhRules((r) => ({ ...r, injectIntoPrimaryInbox: e.target.checked }))
                      }
                      className="rounded accent-[#0B57D0]"
                    />
                    <span>Deliver Form &amp; Task submissions directly to Primary Inbox</span>
                  </label>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSavingSys}
                    className="px-5 py-2 rounded-full bg-[#0B57D0] hover:bg-blue-700 text-white text-xs font-semibold"
                  >
                    {isSavingSys ? 'Saving...' : 'Save Mail & Signature Settings'}
                  </button>
                </div>
              </form>

              {/* Custom Inbox Filter Tabs Manager */}
              <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Custom Inbox Filter Tabs ({customTabs.length})
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Create custom filter tabs that appear across your Inbox bar (e.g., Invoices, Clients, Urgent).
                  </p>
                </div>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!newTabName.trim() || !newTabQuery.trim()) return;
                    const created = await saveCustomMailTab({
                      id: `custom-${Date.now()}`,
                      name: newTabName.trim(),
                      query: newTabQuery.trim(),
                      accentColor: '#0B57D0',
                      description: `Filter: ${newTabQuery.trim()}`,
                    });
                    onCustomTabsChanged(created);
                    setNewTabName('');
                    setNewTabQuery('');
                    showToast('success', 'Added custom mail tab!');
                  }}
                  className="grid grid-cols-1 sm:grid-cols-3 gap-3"
                >
                  <input
                    type="text"
                    required
                    value={newTabName}
                    onChange={(e) => setNewTabName(e.target.value)}
                    placeholder="Tab Name (e.g. Invoices)"
                    className="px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                  <input
                    type="text"
                    required
                    value={newTabQuery}
                    onChange={(e) => setNewTabQuery(e.target.value)}
                    placeholder="Filter Query (e.g. subject:invoice)"
                    className="px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-[#0B57D0] text-white text-xs font-semibold hover:bg-blue-700"
                  >
                    + Add Custom Tab
                  </button>
                </form>

                {customTabs.length > 0 && (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                    {customTabs.map((tab) => (
                      <div
                        key={tab.id}
                        className="flex items-center justify-between px-4 py-2.5 text-xs"
                      >
                        <div>
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            {tab.name}
                          </span>
                          <span className="ml-2 font-mono text-slate-500">{tab.query}</span>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            const updated = await deleteCustomMailTab(tab.id);
                            onCustomTabsChanged(updated);
                            showToast('success', `Removed tab "${tab.name}"`);
                          }}
                          className="p-1 text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===================================================================
              TAB 4: PURE POSTGRESQL ENGINE, PRISMA SCHEMA & DECOUPLED STORAGE
          =================================================================== */}
          {activeSubTab === 'database' && (
            <div className="space-y-6">
              <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <Database className="w-4 h-4 text-emerald-600" />
                      <span>PostgreSQL Connection (`DATABASE_URL`) &amp; Prisma ORM</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      100% backed by standard PostgreSQL ({pgConfig.host}:{pgConfig.port}/{pgConfig.database}). File binaries and external S3/R2/CDN assets remain decoupled from database tables.
                    </p>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                      pgConfig.enabled
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}
                  >
                    {pgConfig.enabled ? 'PostgreSQL Connected' : 'Setup Pending'}
                  </span>
                </div>

                {/* Standard DATABASE_URL Connection String Input */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    PostgreSQL Connection URL (`DATABASE_URL`)
                  </label>
                  <input
                    type="text"
                    value={pgConfig.connectionString || ''}
                    onChange={(e) =>
                      setPgConfig((p) => ({ ...p, connectionString: e.target.value }))
                    }
                    placeholder="postgresql://postgres:password@localhost:5432/workspace_pro?schema=public"
                    className="w-full px-3.5 py-2.5 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                  <p className="text-[11px] text-slate-500">
                    Works with any standard PostgreSQL server (VPS Postgres, Docker, Neon, Supabase, Railway). Updating this updates `.env` and runs Prisma `db push`.
                  </p>
                </div>

                {/* Structured Host / Port / DB / User / Password Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Host
                    </label>
                    <input
                      type="text"
                      value={pgConfig.host}
                      onChange={(e) => setPgConfig((p) => ({ ...p, host: e.target.value }))}
                      placeholder="localhost"
                      className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Port
                    </label>
                    <input
                      type="number"
                      value={pgConfig.port}
                      onChange={(e) =>
                        setPgConfig((p) => ({ ...p, port: Number(e.target.value) || 5432 }))
                      }
                      placeholder="5432"
                      className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Database Name
                    </label>
                    <input
                      type="text"
                      value={pgConfig.database}
                      onChange={(e) => setPgConfig((p) => ({ ...p, database: e.target.value }))}
                      placeholder="workspace_pro"
                      className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Username
                    </label>
                    <input
                      type="text"
                      value={pgConfig.user}
                      onChange={(e) => setPgConfig((p) => ({ ...p, user: e.target.value }))}
                      placeholder="postgres"
                      className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Password
                    </label>
                    <input
                      type="password"
                      value={pgPassword}
                      onChange={(e) => setPgPassword(e.target.value)}
                      placeholder="Leave blank if using URL above"
                      className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div className="flex items-end pb-1.5">
                    <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pgConfig.ssl}
                        onChange={(e) => setPgConfig((p) => ({ ...p, ssl: e.target.checked }))}
                        className="rounded accent-[#0B57D0]"
                      />
                      <span>Require SSL (`sslmode=require`)</span>
                    </label>
                  </div>
                </div>

                {pgConfig.statusMessage && (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 flex items-center justify-between gap-3">
                    <span>{pgConfig.statusMessage}</span>
                    {pgConfig.lastMigratedAt && (
                      <span className="text-[11px] text-slate-500 shrink-0">
                        Last synced: {pgConfig.lastMigratedAt}
                      </span>
                    )}
                  </div>
                )}

                {pgMigrationFeedback && (
                  <div
                    className={`p-3.5 rounded-xl border text-xs font-medium whitespace-pre-wrap ${
                      pgMigrationFeedback.ok
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-amber-50 border-amber-200 text-amber-800'
                    }`}
                  >
                    {pgMigrationFeedback.message}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-end gap-2.5">
                  <button
                    type="button"
                    disabled={isSavingPg}
                    onClick={() => handleSavePostgresAndMigrate(false)}
                    className="px-4 py-2 rounded-full border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    Save Config
                  </button>
                  <button
                    type="button"
                    disabled={isSavingPg}
                    onClick={() => handleSavePostgresAndMigrate(true)}
                    className="px-5 py-2 rounded-full bg-[#0B57D0] hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
                  >
                    {isSavingPg ? 'Connecting & Pushing Schema...' : 'Test & Push Prisma Schema'}
                  </button>
                </div>
              </div>

              {/* VPS Smart Storage & Zero Browser Cache Monitor */}
              <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <HardDrive className="w-4 h-4 text-[#0B57D0]" />
                      <span>VPS Disk Storage &amp; Zero Browser Cache</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Binary uploads, thumbnails, and file revisions persist on VPS disk outside PostgreSQL. Browser caching is strictly disabled (`no-store`).
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Browser Cache: Disabled
                    </span>
                    {vpsStorage && (
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                          vpsStorage.isEphemeralTmp
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-blue-50 text-[#0B57D0] border-blue-200'
                        }`}
                      >
                        {vpsStorage.isEphemeralTmp ? 'Temp Fallback' : 'Persistent VPS Disk'}
                      </span>
                    )}
                  </div>
                </div>

                {vpsStorage ? (
                  <>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700 text-xs flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-slate-700 dark:text-slate-200 break-all">
                        Path: {vpsStorage.storageBasePath}
                      </span>
                      {vpsStorage.diskTotalBytes > 0 && (
                        <span className="text-slate-600 dark:text-slate-300 font-semibold shrink-0">
                          VPS Disk Free: {formatBytes(vpsStorage.diskFreeBytes)} /{' '}
                          {formatBytes(vpsStorage.diskTotalBytes)}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-center">
                      {[
                        {
                          label: 'Total Stored',
                          value: formatBytes(vpsStorage.totalUsedBytes),
                          sub: `${vpsStorage.activeFilesCount} active files`,
                        },
                        {
                          label: 'Uploads Folder',
                          value: formatBytes(vpsStorage.uploadsBytes),
                          sub: 'Auto-optimized',
                        },
                        {
                          label: 'Revisions (.versions)',
                          value: formatBytes(vpsStorage.versionsBytes),
                          sub: `${vpsStorage.versionsCount} snapshots`,
                        },
                        {
                          label: 'Thumbnails (.thumbs)',
                          value: formatBytes(vpsStorage.thumbsBytes),
                          sub: 'WebP previews',
                        },
                        {
                          label: 'Trash Bin',
                          value: formatBytes(vpsStorage.trashedBytes),
                          sub: `${vpsStorage.trashedFilesCount} trashed`,
                        },
                        {
                          label: 'Orphan Bytes',
                          value: formatBytes(vpsStorage.orphanBytes),
                          sub: `${vpsStorage.orphanFilesCount} unreferenced`,
                        },
                      ].map((card) => (
                        <div
                          key={card.label}
                          className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800"
                        >
                          <div className="text-xs font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                            {card.value}
                          </div>
                          <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 mt-0.5">
                            {card.label}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{card.sub}</div>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      <p className="text-[11px] text-slate-500">
                        Smart Cleanup safely deletes unreferenced orphan disk files and purges trashed files older than 30 days.
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              setVpsStorage(await fetchVpsStorageDiagnostics());
                              showToast('success', 'Storage metrics refreshed.');
                            } catch (err: any) {
                              showToast('error', err?.message || 'Unable to refresh storage metrics.');
                            }
                          }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Refresh</span>
                        </button>
                        <button
                          type="button"
                          disabled={isCleaningStorage}
                          onClick={() => handleRunSmartStorageCleanup(30)}
                          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#0B57D0] hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-semibold cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>{isCleaningStorage ? 'Cleaning...' : 'Run Smart Cleanup'}</span>
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-slate-500">Loading VPS storage diagnostics...</div>
                )}
              </div>

              {/* Portable JSON Backup & Restore + Prisma Schema Viewer */}
              <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Prisma Schema (`prisma/schema.prisma`) &amp; Full JSON Backup
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Inspect PostgreSQL models and indexes, or export/restore a complete JSON snapshot across servers.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleExportBackup}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export Backup JSON</span>
                    </button>

                    <input
                      ref={backupFileInputRef}
                      type="file"
                      accept=".json"
                      onChange={handleImportBackup}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => backupFileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Restore Backup JSON</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSchemaViewMode('prisma')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                        schemaViewMode === 'prisma'
                          ? 'bg-[#0B57D0] text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      prisma/schema.prisma
                    </button>
                    <button
                      type="button"
                      onClick={() => setSchemaViewMode('sql')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                        schemaViewMode === 'sql'
                          ? 'bg-[#0B57D0] text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      Connection Info
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        schemaViewMode === 'prisma' ? prismaSchemaText : sqlSchemaText
                      );
                      setCopiedSchema(true);
                      setTimeout(() => setCopiedSchema(false), 2000);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
                  >
                    {copiedSchema ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>

                <pre className="p-4 rounded-xl bg-slate-950 text-slate-100 text-[11px] font-mono overflow-x-auto max-h-80 leading-relaxed">
                  {schemaViewMode === 'prisma'
                    ? prismaSchemaText || '// prisma/schema.prisma ready'
                    : sqlSchemaText || '// PostgreSQL via Prisma ORM'}
                </pre>
              </div>
            </div>
          )}

          {/* ===================================================================
              TAB 5: SECURITY, WEBHOOKS & ENGINE DIAGNOSTICS
          =================================================================== */}
          {activeSubTab === 'security' && (
            <div className="space-y-6">
              <form
                onSubmit={handleSaveSystemSettingsForm}
                className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-5"
              >
                <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Security Vault, Public Access &amp; Webhook Automation</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Manage public portal access permissions, webhook signing keys, and standalone engine security.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Incoming Webhook Secret Key
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={sysSettings.incomingWebhookSecret}
                        className="flex-1 px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setSysSettings((s) => ({
                            ...s,
                            incomingWebhookSecret: `whsec_${Math.random()
                              .toString(36)
                              .slice(2, 14)}${Math.random().toString(36).slice(2, 10)}`,
                          }))
                        }
                        className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold hover:bg-slate-100"
                      >
                        Regenerate
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Outgoing Webhook Notification URL
                    </label>
                    <input
                      type="text"
                      value={sysSettings.outgoingWebhookUrl}
                      onChange={(e) =>
                        setSysSettings((s) => ({ ...s, outgoingWebhookUrl: e.target.value }))
                      }
                      placeholder="https://your-server.com/api/webhook-receiver"
                      className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sysSettings.enablePublicForms}
                      onChange={(e) =>
                        setSysSettings((s) => ({ ...s, enablePublicForms: e.target.checked }))
                      }
                      className="rounded accent-[#0B57D0]"
                    />
                    <span>Allow Public Shareable Form Links (?form=...)</span>
                  </label>

                  <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sysSettings.enablePublicCmhPortal}
                      onChange={(e) =>
                        setSysSettings((s) => ({
                          ...s,
                          enablePublicCmhPortal: e.target.checked,
                        }))
                      }
                      className="rounded accent-[#0B57D0]"
                    />
                    <span>Allow Public CMH Task/Project Portal Links (?cmh=...)</span>
                  </label>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSavingSys}
                    className="px-5 py-2 rounded-full bg-[#0B57D0] hover:bg-blue-700 text-white text-xs font-semibold"
                  >
                    {isSavingSys ? 'Saving...' : 'Save Security Settings'}
                  </button>
                </div>
              </form>

              {/* Live Standalone Engine Diagnostics Summary */}
              <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Standalone Workspace Engine Records Overview
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 text-center">
                  {[
                    { label: 'Gmail Accounts', count: gmailAccounts.length },
                    { label: 'Server Accounts', count: serverAccounts.length },
                    { label: 'Docs', count: sysStats.docs },
                    { label: 'Slides', count: sysStats.slides },
                    { label: 'Forms', count: sysStats.forms },
                    { label: 'Meetings', count: sysStats.meetings },
                    { label: 'Team Members', count: sysStats.members },
                    { label: 'CMH Tasks', count: sysStats.tasks },
                    { label: 'CMH Projects', count: sysStats.projects },
                    { label: 'Server Files', count: sysStats.files },
                    { label: 'Stored Emails', count: sysStats.messages },
                    {
                      label: 'API Keys',
                      count: sysSettings.externalIntegrations.length,
                    },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800"
                    >
                      <div className="text-base font-bold text-[#0B57D0] tabular-nums">
                        {stat.count}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
