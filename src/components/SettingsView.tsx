import { WorkspaceMailSettings } from './settings/WorkspaceMailSettings';
import { FeedPreferences } from './WorkspaceFeedView';
import React, { useState, useEffect, useRef } from 'react';
import {
  Sliders,
  Mail,
  Server,
  KeyRound,
  ShieldCheck,
  HardDrive,
  Plus,
  Trash2,
  Edit3,
  Check,
  CheckCircle2,
  AlertCircle,
  Download,
  Upload,
  Sparkles,
  Globe,
  BellRing,
  Layers,
  X,
  Bot,
  ShieldAlert,
  Send,
  RefreshCw,
  Database,
  Search,
  Table,
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
  CmhNotificationRules,
  VpsStorageDiagnosticsClient,
  verifyServerMailConnection,
  saveServerMailAccount,
  deleteServerMailAccount,
  saveCustomMailTab,
  deleteCustomMailTab,
  fetchSystemSettings,
  saveSystemSettings,
  fetchVpsStorageDiagnostics,
  runVpsStorageCleanup,
  formatBytes,
  exportWorkspaceBackupJson,
  restoreWorkspaceBackupJson,
  fetchPostgresCatalog,
  fetchDatabaseConfig,
  saveDatabaseConfig,
  type PostgresCatalogInfo,
  type PostgresCatalogTable,
  type PostgresConfigClient,
} from '../services/workspaceApi';

export type SettingsSubTab = 'general' | 'accounts' | 'mail_rules' | 'database' | 'security' | 'feed';
export type AccountSetupType = 'gmail' | 'server_mail';

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
  onOpenAccessSettings: () => void;
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
  onOpenAccessSettings,
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
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 4000);
  };

  // Modal / Drawer state for adding or editing an email account
  const [showAccountModal, setShowAccountModal] = useState<boolean>(false);
  const [accountType, setAccountType] = useState<AccountSetupType>('gmail');

  // ============================================================================
  // 1. GMAIL ACCOUNT FORM STATE
  // ============================================================================
  const [gmailEditingId, setGmailEditingId] = useState<string | undefined>(undefined);
  const [gmailLabel, setGmailLabel] = useState<string>('');
  const [gmailEmail, setGmailEmail] = useState<string>('');
  const [gmailAuthMode, setGmailAuthMode] = useState<'app_password' | 'oauth_secret'>('app_password');
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
  const [gmailVerifyResult, setGmailVerifyResult] = useState<{ ok: boolean; message: string } | null>(null);

  // ============================================================================
  // 2. SERVER MAIL FORM STATE
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
  const [serverVerifyResult, setServerVerifyResult] = useState<ServerMailVerifyResult | null>(null);

  // ============================================================================
  // 3. SYSTEM SETTINGS & RULES
  // ============================================================================
  const [sysSettings, setSysSettings] = useState<WorkspaceSystemSettingsClient>({
    workspaceName: 'Workspace Pro',
    organizationName: 'Primary Org',
    adminEmail: 'zayed.islam1998@gmail.com',
    timezone: 'Asia/Dhaka',
    dateFormat: 'MMM D, YYYY',
    defaultLandingModule: 'overview',
    autoSyncIntervalSec: 60,
    densityMode: 'comfortable',
    defaultReplyTo: '',
    bulkDelayMs: 2500,
    dailySendLimit: 500,
    enableReadReceipts: true,
    defaultSignatureHtml: '',
    autoSaveAttachmentsToFiles: true,
    incomingWebhookSecret: '',
    outgoingWebhookUrl: '',
    enablePublicForms: true,
    enablePublicCmhPortal: true,
    externalIntegrations: [],
    updatedAt: '',
  });

  const [cmhRules, setCmhRules] = useState<CmhNotificationRules>({
    id: 'cmh-rules-default',
    adminEmail: 'zayed.islam1998@gmail.com',
    notifyOnFormSubmit: true,
    notifyOnTaskActivity: true,
    notifyOnProjectActivity: true,
    notifyOnMemberActivity: true,
    autoSendAdminEmail: true,
    injectIntoPrimaryInbox: false,
    updatedAt: '',
  });

  const [isSavingSys, setIsSavingSys] = useState<boolean>(false);

  // ============================================================================
  // 4. STORAGE & BACKUP STATE
  // ============================================================================
  const [vpsDiag, setVpsDiag] = useState<VpsStorageDiagnosticsClient | null>(null);
  const [isCleaningStorage, setIsCleaningStorage] = useState<boolean>(false);
  const [newTabName, setNewTabName] = useState<string>('');
  const [newTabQuery, setNewTabQuery] = useState<string>('');
  const backupFileInputRef = useRef<HTMLInputElement>(null);

  // PostgreSQL Connection & Live Catalog State
  const [dbSubTab, setDbSubTab] = useState<'url' | 'credentials' | 'info'>('info');
  const [catalogInfo, setCatalogInfo] = useState<PostgresCatalogInfo | null>(null);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState<boolean>(false);
  const [catalogLastLoaded, setCatalogLastLoaded] = useState<string>('');
  const [tableSearchQuery, setTableSearchQuery] = useState<string>('');
  const [nonEmptyOnly, setNonEmptyOnly] = useState<boolean>(false);

  // DB Config Form & Save State
  const [dbConfig, setDbConfig] = useState<PostgresConfigClient | null>(null);
  const [isSavingDbConfig, setIsSavingDbConfig] = useState<boolean>(false);
  const [rawConnectionUrl, setRawConnectionUrl] = useState<string>('');
  const [pgHost, setPgHost] = useState<string>('');
  const [pgPort, setPgPort] = useState<number>(5432);
  const [pgDatabase, setPgDatabase] = useState<string>('');
  const [pgUser, setPgUser] = useState<string>('');
  const [pgPassword, setPgPassword] = useState<string>('');
  const [pgSsl, setPgSsl] = useState<boolean>(true);
  const [autoMigrate, setAutoMigrate] = useState<boolean>(true);

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

  const loadAllSettingsData = async () => {
    try {
      const [sysRes, vpsRes] = await Promise.all([
        fetchSystemSettings().catch(() => null),
        fetchVpsStorageDiagnostics().catch(() => null),
      ]);
      if (sysRes) {
        setSysSettings(sysRes.settings);
        if (sysRes.cmhRules) setCmhRules(sysRes.cmhRules);
      }
      if (vpsRes) {
        setVpsDiag(vpsRes);
      }
    } catch {
      // Quiet fail on initial load
    }
  };

  useEffect(() => {
    loadAllSettingsData();
  }, []);

  // ============================================================================
  // SYSTEM MAIL & MAILBOX OVERVIEW STATE & HANDLERS
  // ============================================================================
  const [mailboxesOverview, setMailboxesOverview] = useState<{
    totalCount: number;
    systemCount: number;
    generalCount: number;
    adminRecipient: string;
    primarySystemMail: {
      id: string;
      type: 'server_mail' | 'gmail';
      email: string;
      label: string;
      host: string;
      isVerified: boolean;
    } | null;
    mailboxes: Array<{
      id: string;
      type: 'server_mail' | 'gmail';
      label: string;
      email: string;
      role: string;
      isSystemPrimary: boolean;
      lastVerifiedAt?: string | null;
      host: string;
    }>;
  } | null>(null);

  const [testingActiveSystemMail, setTestingActiveSystemMail] = useState(false);
  const [activeSystemMailTestResult, setActiveSystemMailTestResult] = useState<{
    ok: boolean;
    message: string;
    host?: string;
  } | null>(null);

  // Add System Mail Modal State
  const [showAddSystemMailModal, setShowAddSystemMailModal] = useState(false);
  const [sysType, setSysType] = useState<'server_mail' | 'gmail'>('server_mail');
  const [sysEmail, setSysEmail] = useState('');
  const [sysLabel, setSysLabel] = useState('');
  const [sysPassword, setSysPassword] = useState('');
  const [sysSmtpHost, setSysSmtpHost] = useState('mail.yourdomain.com');
  const [sysSmtpPort, setSysSmtpPort] = useState(465);
  const [sysSmtpSecure, setSysSmtpSecure] = useState(true);
  const [sysSaving, setSysSaving] = useState(false);
  const [sysBanner, setSysBanner] = useState<{ ok: boolean; text: string } | null>(null);

  const loadMailboxesOverview = async () => {
    try {
      const res = await fetch('/api/settings/mailboxes/overview');
      if (res.ok) {
        const data = await res.json();
        setMailboxesOverview(data);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (activeSubTab === 'accounts') {
      loadMailboxesOverview();
    }
  }, [activeSubTab, gmailAccounts, serverAccounts]);

  const handleTestActiveSystemMail = async () => {
    setTestingActiveSystemMail(true);
    setActiveSystemMailTestResult(null);
    try {
      const res = await fetch('/api/settings/system-mail/test-connection', { method: 'POST' });
      const result = await res.json();
      if (res.ok && result.ok) {
        setActiveSystemMailTestResult({
          ok: true,
          message: result.message || 'Active System Mail SMTP handshake verified successfully!',
          host: result.host,
        });
        showToast('success', 'Active System Mail verified!');
      } else {
        setActiveSystemMailTestResult({
          ok: false,
          message: result.error || 'Connection handshake failed.',
          host: result.host,
        });
        showToast('error', result.error || 'System Mail handshake failed.');
      }
    } catch (err: any) {
      setActiveSystemMailTestResult({ ok: false, message: err?.message || 'Network test failed.' });
      showToast('error', 'Connection test failed.');
    } finally {
      setTestingActiveSystemMail(false);
      loadMailboxesOverview();
    }
  };

  const handleUpdateMailboxRole = async (
    type: 'server_mail' | 'gmail',
    id: string,
    role: string,
    isSystemPrimary = false
  ) => {
    try {
      const res = await fetch(`/api/settings/mailboxes/${type}/${id}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, isSystemPrimary }),
      });
      if (!res.ok) throw new Error('Failed to update mailbox role.');
      showToast('success', `Mailbox role updated to ${role.toUpperCase()}`);
      await loadMailboxesOverview();
    } catch (err: any) {
      showToast('error', err?.message || 'Could not update mailbox role.');
    }
  };

  const handleAddSystemMailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sysEmail.trim() || !sysPassword.trim()) {
      setSysBanner({ ok: false, text: 'Please enter email address and password.' });
      return;
    }
    setSysSaving(true);
    setSysBanner(null);
    try {
      const res = await fetch('/api/settings/system-mail/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: sysType,
          email: sysEmail.trim(),
          label: sysLabel.trim() || (sysType === 'gmail' ? 'System Gmail' : 'System Mail'),
          password: sysPassword.trim(),
          smtpHost: sysSmtpHost.trim(),
          smtpPort: Number(sysSmtpPort) || 465,
          smtpSecure: sysSmtpSecure,
          setAsPrimary: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add System Mail.');

      showToast('success', `System Mail ${sysEmail} added & activated!`);
      setShowAddSystemMailModal(false);
      setSysEmail('');
      setSysPassword('');
      setSysLabel('');
      await loadMailboxesOverview();
    } catch (err: any) {
      setSysBanner({ ok: false, text: err?.message || 'Failed to register System Mail.' });
    } finally {
      setSysSaving(false);
    }
  };

  // Handlers for Gmail
  const handleVerifyGmail = async () => {
    if (!gmailEmail.trim()) {
      showToast('error', 'Please enter a Gmail address.');
      return;
    }
    setIsVerifyingGmail(true);
    setGmailVerifyResult(null);
    try {
      const res = await verifyGmailConnectionOnServer({
        email: gmailEmail.trim(),
        password: gmailPassword.trim() || undefined,
        imapHost: gmailImapHost.trim() || 'imap.gmail.com',
        imapPort: Number(gmailImapPort) || 993,
        smtpHost: gmailSmtpHost.trim() || 'smtp.gmail.com',
        smtpPort: Number(gmailSmtpPort) || 465,
      });
      const msg = res.ok ? 'Connection verified successfully!' : (res.imapMessage || res.smtpMessage || 'Verification failed');
      setGmailVerifyResult({ ok: res.ok, message: msg });
      if (res.ok) {
        showToast('success', 'Gmail connection verified successfully!');
      } else {
        showToast('error', msg);
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Verification failed.');
    } finally {
      setIsVerifyingGmail(false);
    }
  };

  const handleSaveGmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gmailEmail.trim()) {
      showToast('error', 'Gmail address is required.');
      return;
    }
    setIsSavingGmail(true);
    try {
      const res = await saveGmailAccountOnServer({
        id: gmailEditingId,
        label: gmailLabel.trim() || gmailEmail.trim().split('@')[0],
        email: gmailEmail.trim(),
        password: gmailPassword.trim() || undefined,
        imapHost: gmailImapHost.trim() || 'imap.gmail.com',
        imapPort: Number(gmailImapPort) || 993,
        smtpHost: gmailSmtpHost.trim() || 'smtp.gmail.com',
        smtpPort: Number(gmailSmtpPort) || 465,
        authMode: gmailAuthMode,
        clientId: gmailClientId.trim() || undefined,
        clientSecret: gmailClientSecret.trim() || undefined,
        refreshToken: gmailRefreshToken.trim() || undefined,
      });

      onGmailAccountsChanged(res.accounts, activeGmailEmail || res.account.email);
      showToast('success', `Saved Gmail account ${res.account.email}`);
      resetGmailForm();
      setShowAccountModal(false);
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to save Gmail account.');
    } finally {
      setIsSavingGmail(false);
    }
  };

  const handleEditGmailAccount = (acc: ConnectedGmailAccount) => {
    resetGmailForm();
    setGmailEditingId(acc.id || acc.email);
    setGmailLabel(acc.displayName || '');
    setGmailEmail(acc.email || '');
    setGmailAuthMode(acc.authMode || 'app_password');
    setGmailImapHost(acc.imapHost || 'imap.gmail.com');
    setGmailImapPort(acc.imapPort || 993);
    setGmailSmtpHost(acc.smtpHost || 'smtp.gmail.com');
    setGmailSmtpPort(acc.smtpPort || 465);
    setGmailClientId(acc.clientId || '');
    setAccountType('gmail');
    setShowAccountModal(true);
  };

  // Handlers for Server Mail
  const handleVerifyServerMail = async () => {
    if (!serverEmail.trim() || !serverImapHost.trim() || !serverSmtpHost.trim()) {
      showToast('error', 'Email, IMAP host, and SMTP host are required.');
      return;
    }
    setIsVerifyingServer(true);
    setServerVerifyResult(null);
    try {
      const res = await verifyServerMailConnection({
        email: serverEmail.trim(),
        username: serverUsername.trim() || serverEmail.trim(),
        password: serverPassword.trim() || undefined,
        imapHost: serverImapHost.trim(),
        imapPort: Number(serverImapPort) || 993,
        imapSecure: serverImapSecure,
        smtpHost: serverSmtpHost.trim(),
        smtpPort: Number(serverSmtpPort) || 465,
        smtpSecure: serverSmtpSecure,
      });
      setServerVerifyResult(res);
      if (res.ok) {
        showToast('success', 'Server Mail verified successfully!');
      } else {
        showToast('error', res.imapMessage || res.smtpMessage || (res as any).error || 'Server Mail verification failed.');
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Verification failed.');
    } finally {
      setIsVerifyingServer(false);
    }
  };

  const handleSaveServerMail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverEmail.trim() || !serverImapHost.trim() || !serverSmtpHost.trim()) {
      showToast('error', 'Email, IMAP host, and SMTP host are required.');
      return;
    }
    setIsSavingServer(true);
    try {
      const res = await saveServerMailAccount({
        id: serverEditingId,
        label: serverLabel.trim() || serverEmail.trim(),
        email: serverEmail.trim(),
        username: serverUsername.trim() || serverEmail.trim(),
        password: serverPassword.trim() || undefined,
        imapHost: serverImapHost.trim(),
        imapPort: Number(serverImapPort) || 993,
        imapSecure: serverImapSecure,
        smtpHost: serverSmtpHost.trim(),
        smtpPort: Number(serverSmtpPort) || 465,
        smtpSecure: serverSmtpSecure,
      });

      onServerAccountsChanged(res.accounts, activeServerAccountId || res.account.id);
      showToast('success', `Saved Server Mail ${res.account.email}`);
      resetServerForm();
      setShowAccountModal(false);
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to save Server Mail.');
    } finally {
      setIsSavingServer(false);
    }
  };

  const handleEditServerMailAccount = (acc: ServerMailAccount) => {
    resetServerForm();
    setServerEditingId(acc.id);
    setServerLabel(acc.label);
    setServerEmail(acc.email);
    setServerUsername(acc.username || acc.email);
    setServerImapHost(acc.imapHost);
    setServerImapPort(acc.imapPort);
    setServerImapSecure(acc.imapSecure);
    setServerSmtpHost(acc.smtpHost);
    setServerSmtpPort(acc.smtpPort);
    setServerSmtpSecure(acc.smtpSecure);
    setAccountType('server_mail');
    setShowAccountModal(true);
  };

  // Handlers for System Settings
  const handleSaveSystemSettingsForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSys(true);
    try {
      const res = await saveSystemSettings(sysSettings, cmhRules);
      setSysSettings(res.settings);
      if (res.cmhRules) setCmhRules(res.cmhRules);
      if (onWorkspaceNameChanged && sysSettings.workspaceName) {
        onWorkspaceNameChanged(sysSettings.workspaceName);
      }
      showToast('success', 'Settings saved successfully.');
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to save settings.');
    } finally {
      setIsSavingSys(false);
    }
  };

  // Handlers for Storage & Backup
  const handleRunSmartStorageCleanup = async (days: number) => {
    setIsCleaningStorage(true);
    try {
      const res = await runVpsStorageCleanup({ purgeTrashOlderThanDays: days, pruneOrphans: true });
      setVpsDiag(res.storage);
      const totalRemoved = res.cleanup.removedOrphans + res.cleanup.removedTrashedFiles;
      showToast('success', `Cleanup complete! Removed ${totalRemoved} temporary files (${formatBytes(res.cleanup.reclaimedBytes)} freed).`);
    } catch (err: any) {
      showToast('error', err?.message || 'Storage cleanup failed.');
    } finally {
      setIsCleaningStorage(false);
    }
  };

  const handleExportBackup = async () => {
    try {
      await exportWorkspaceBackupJson();
      showToast('success', 'Relational backup exported successfully.');
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
      await restoreWorkspaceBackupJson(parsed);
      showToast('success', 'Backup restored successfully! Refreshing...');
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to restore backup file.');
    }
  };

  const formatCatalogSyncedTime = (isoStr?: string): string => {
    if (!isoStr) return 'Recently';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Recently';
    }
  };

  const loadCatalogData = async () => {
    setIsLoadingCatalog(true);
    try {
      const data = await fetchPostgresCatalog();
      setCatalogInfo(data);
      const now = new Date();
      setCatalogLastLoaded(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      );
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to load database catalog.');
    } finally {
      setIsLoadingCatalog(false);
    }
  };

  const loadDbConfigData = async () => {
    try {
      const res = await fetchDatabaseConfig();
      if (res && res.config) {
        setDbConfig(res.config);
        setRawConnectionUrl(res.config.connectionString || '');
        setPgHost(res.config.host || '');
        setPgPort(res.config.port || 5432);
        setPgDatabase(res.config.database || '');
        setPgUser(res.config.user || '');
        setPgSsl(res.config.ssl ?? true);
        setAutoMigrate(res.config.autoMigrateOnStartup ?? true);
      }
    } catch (err) {
      console.error('Failed to load database config:', err);
    }
  };

  const handleSaveConnectionUrl = async () => {
    if (!rawConnectionUrl.trim()) {
      showToast('error', 'Please enter a valid PostgreSQL connection string.');
      return;
    }
    setIsSavingDbConfig(true);
    try {
      const res = await saveDatabaseConfig({
        connectionString: rawConnectionUrl.trim(),
        autoMigrateOnStartup: autoMigrate,
        testAndMigrateNow: true,
      });
      setDbConfig(res.config);
      showToast('success', res.config.statusMessage || 'PostgreSQL database connected and verified!');
      await loadCatalogData();
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to connect to database.');
    } finally {
      setIsSavingDbConfig(false);
    }
  };

  const handleSaveCredentials = async () => {
    if (!pgHost.trim() || !pgDatabase.trim() || !pgUser.trim()) {
      showToast('error', 'Host, Database, and User fields are required.');
      return;
    }
    setIsSavingDbConfig(true);
    try {
      const res = await saveDatabaseConfig({
        host: pgHost.trim(),
        port: Number(pgPort) || 5432,
        database: pgDatabase.trim(),
        user: pgUser.trim(),
        password: pgPassword ? pgPassword : undefined,
        ssl: pgSsl,
        autoMigrateOnStartup: autoMigrate,
        testAndMigrateNow: true,
      });
      setDbConfig(res.config);
      showToast('success', res.config.statusMessage || 'PostgreSQL database connected and verified!');
      await loadCatalogData();
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to connect to database.');
    } finally {
      setIsSavingDbConfig(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'database') {
      if (!catalogInfo) {
        loadCatalogData();
      }
      if (!dbConfig) {
        loadDbConfigData();
      }
    }
  }, [activeSubTab]);

  const filteredTables = (catalogInfo?.tables || []).filter((t) => {
    if (nonEmptyOnly && t.rowCount === 0) return false;
    if (tableSearchQuery.trim()) {
      return t.tableName.toLowerCase().includes(tableSearchQuery.toLowerCase().trim());
    }
    return true;
  });

  const [settingsSearch, setSettingsSearch] = useState('');
  const totalConnectedMailboxes = gmailAccounts.length + serverAccounts.length;

  // Modern navigation tabs (Map old keys seamlessly)
  const navItems: Array<{
    id: SettingsSubTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
  }> = [
    { id: 'general', label: 'General & Workspace', icon: Sliders },
    { id: 'feed', label: 'Main Feed', icon: Sliders },
    { id: 'accounts', label: 'Email & Channels', icon: Mail, count: totalConnectedMailboxes },
    { id: 'mail_rules', label: 'Notifications & Rules', icon: BellRing },
    { id: 'database', label: 'Storage & Backup', icon: HardDrive },
    { id: 'security', label: 'Access & Security', icon: ShieldCheck },
  ];

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 md:rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
      {/* Clean 1-Line Sub-Navigation Tab Bar (Zero Redundant Header Bloat) */}
      <div className="px-4 sm:px-6 py-2.5 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {navItems.filter((item) => item.label.toLowerCase().includes(settingsSearch.trim().toLowerCase())).map((item) => {
            const Icon = item.icon;
            const active =
              activeSubTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectSubTab(item.id)}
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-[#0B57D0] text-white shadow-xs'
                    : 'bg-slate-100/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-750'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
                {item.count !== undefined && item.count > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      active
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <input aria-label="Find a settings section" placeholder="Find settings" value={settingsSearch}
          onChange={(event) => setSettingsSearch(event.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 sm:w-40" />
      </div>

      {/* Toast Feedback Banner */}
      {toastMsg && (
        <div
          className={`mx-4 sm:mx-6 mt-3 px-4 py-2 rounded-xl border flex items-center justify-between text-xs font-semibold ${
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
            className="text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Scrollable Settings Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* ===================================================================
              TAB 1: GENERAL & WORKSPACE BRANDING
          =================================================================== */}
          {activeSubTab === 'feed' && (
            <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-6">
              <h2 className="text-base font-semibold">Main Feed</h2>
              <FeedPreferences workspace />
            </section>
          )}
          {activeSubTab === 'general' && (
            <form onSubmit={handleSaveSystemSettingsForm} className="space-y-5">
              <div className="p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-4">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-[#0B57D0]" />
                    <span>Workspace Profile &amp; Identity</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Configure your workspace branding, organization details, and administrator contact.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Workspace Name
                    </label>
                    <input
                      type="text"
                      required
                      value={sysSettings.workspaceName}
                      onChange={(e) => setSysSettings((s) => ({ ...s, workspaceName: e.target.value }))}
                      placeholder="Workspace Pro"
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Organization / Company
                    </label>
                    <input
                      type="text"
                      value={sysSettings.organizationName}
                      onChange={(e) => setSysSettings((s) => ({ ...s, organizationName: e.target.value }))}
                      placeholder="My Organization"
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Admin Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={sysSettings.adminEmail}
                      onChange={(e) => setSysSettings((s) => ({ ...s, adminEmail: e.target.value }))}
                      placeholder="admin@company.com"
                      className="w-full px-3.5 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                </div>
              </div>

              <div className="p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-4">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-[#0B57D0]" />
                    <span>Regional &amp; System Behavior</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Select your timezone and default landing screen after login.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Default Landing Screen
                    </label>
                    <select
                      value={sysSettings.defaultLandingModule}
                      onChange={(e) => setSysSettings((s) => ({ ...s, defaultLandingModule: e.target.value }))}
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    >
                      <option value="main_feed">Main Feed</option>
                      <option value="overview">Executive Overview</option>
                      <option value="cmh_tasks">Tasks Management</option>
                      <option value="cmh_projects">Projects Management</option>
                      <option value="gmail">Gmail Channel</option>
                      <option value="server_mail">Server Mail Channel</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Timezone
                    </label>
                    <select
                      value={sysSettings.timezone}
                      onChange={(e) => setSysSettings((s) => ({ ...s, timezone: e.target.value }))}
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                    >
                      <option value="Asia/Dhaka">Asia/Dhaka (UTC+06:00)</option>
                      <option value="UTC">UTC (Coordinated Universal Time)</option>
                      <option value="America/New_York">America/New_York (EST / EDT)</option>
                      <option value="Europe/London">Europe/London (GMT / BST)</option>
                      <option value="Asia/Dubai">Asia/Dubai (UTC+04:00)</option>
                      <option value="Asia/Singapore">Asia/Singapore (UTC+08:00)</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSavingSys}
                    className="px-5 py-2 rounded-xl bg-[#0B57D0] hover:bg-blue-700 text-white text-xs font-semibold shadow-xs disabled:opacity-60 cursor-pointer"
                  >
                    {isSavingSys ? 'Saving...' : 'Save General Settings'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* ===================================================================
              TAB 2: EMAIL & CHANNELS (Unified Accounts Directory & Clean Modal)
          =================================================================== */}
          {activeSubTab === 'accounts' && (
            <div className="space-y-6">
              {/* Mailbox Overview & Role Summary Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
                  <div className="text-[11px] font-medium text-slate-500">Total Mailboxes</div>
                  <div className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                    {mailboxesOverview?.totalCount ?? totalConnectedMailboxes} Connected
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
                  <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                    <Bot className="w-3.5 h-3.5 text-violet-600" />
                    <span>System Mail</span>
                  </div>
                  <div className="text-xs font-bold text-violet-700 dark:text-violet-400 mt-1 truncate">
                    {mailboxesOverview?.primarySystemMail ? mailboxesOverview.primarySystemMail.email : 'None (Paused)'}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
                  <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5 text-[#0B57D0]" />
                    <span>Admin Recipient</span>
                  </div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1 truncate">
                    {mailboxesOverview?.adminRecipient || sysSettings.adminEmail || 'admin@yourdomain.com'}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
                  <div className="text-[11px] font-medium text-slate-500">General Inboxes</div>
                  <div className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                    {mailboxesOverview?.generalCount ?? totalConnectedMailboxes} Active
                  </div>
                </div>
              </div>

              {/* Dedicated System Mail Section */}
              <div className="p-5 sm:p-6 rounded-2xl border border-violet-200/80 dark:border-violet-900/60 bg-gradient-to-r from-violet-50/40 to-white dark:from-violet-950/20 dark:to-slate-900 shadow-2xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Bot className="w-5 h-5 text-violet-600" />
                      <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        System Mail (স্বয়ংক্রিয় রোবট ডিসপ্যাচার)
                      </h2>
                    </div>
                    <p className="text-xs text-slate-500">
                      প্ল্যাটফর্মের স্বয়ংক্রিয় নোটিফিকেশন, টাস্ক অ্যাসাইনমেন্ট অ্যালার্ট ও মেম্বার ইনভাইটেশনের ডেডিকেটেড সেন্ডার।
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleTestActiveSystemMail}
                      disabled={testingActiveSystemMail || !mailboxesOverview?.primarySystemMail}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-violet-300 dark:border-violet-700 hover:bg-violet-100/60 dark:hover:bg-violet-900/40 text-violet-700 dark:text-violet-300 text-xs font-semibold transition-colors disabled:opacity-40"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${testingActiveSystemMail ? 'animate-spin' : ''}`} />
                      <span>Test Connection</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSysType('server_mail');
                        setSysEmail('');
                        setSysPassword('');
                        setSysLabel('System Mail');
                        setSysSmtpHost('mail.yourdomain.com');
                        setSysSmtpPort(465);
                        setSysSmtpSecure(true);
                        setSysBanner(null);
                        setShowAddSystemMailModal(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold shadow-xs cursor-pointer transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      <span>+ Add System Mail</span>
                    </button>
                  </div>
                </div>

                {activeSystemMailTestResult && (
                  <div
                    className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                      activeSystemMailTestResult.ok
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800'
                        : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {activeSystemMailTestResult.ok ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                      )}
                      <span>{activeSystemMailTestResult.message}</span>
                      {activeSystemMailTestResult.host && (
                        <span className="font-mono text-[10px] bg-white/60 dark:bg-black/30 px-1.5 py-0.5 rounded">
                          {activeSystemMailTestResult.host}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveSystemMailTestResult(null)}
                      className="text-xs font-bold underline"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                <div className="p-4 rounded-xl border border-violet-100 dark:border-violet-900/40 bg-white/70 dark:bg-slate-800/40 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-900/50 dark:text-violet-300 flex items-center justify-center font-bold">
                      <Bot className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          {mailboxesOverview?.primarySystemMail
                            ? mailboxesOverview.primarySystemMail.label
                            : 'No Primary System Mail Configured'}
                        </span>
                        {mailboxesOverview?.primarySystemMail && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-bold">
                            Active Dispatcher
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                        {mailboxesOverview?.primarySystemMail
                          ? `${mailboxesOverview.primarySystemMail.email} · SMTP: ${mailboxesOverview.primarySystemMail.host}`
                          : 'Click "+ Add System Mail" to register a dedicated Gmail or Server Mail dispatcher.'}
                      </div>
                    </div>
                  </div>

                  {mailboxesOverview?.primarySystemMail && (
                    <div className="text-right">
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 justify-end">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Ready &amp; Verified</span>
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Type: {mailboxesOverview.primarySystemMail.type === 'gmail' ? 'Gmail App Password' : 'Server SMTP'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Unified Connected Accounts Directory Card */}
              <div className="p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <Mail className="w-4 h-4 text-[#0B57D0]" />
                      <span>Connected Mailboxes &amp; Communication Channels</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Unified mailbox hub for your official Gmail and custom domain email accounts.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      resetGmailForm();
                      resetServerForm();
                      setAccountType('gmail');
                      setShowAccountModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0B57D0] hover:bg-blue-700 text-white text-xs font-semibold shadow-xs cursor-pointer transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Connect Mailbox</span>
                  </button>
                </div>

                {/* Empty State */}
                {totalConnectedMailboxes === 0 ? (
                  <div className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-300 dark:border-slate-700 text-center space-y-2">
                    <Mail className="w-8 h-8 text-slate-400 mx-auto" />
                    <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      No Mailboxes Connected Yet
                    </h3>
                    <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                      Click "+ Connect Mailbox" to connect your Google Gmail (via App Password) or your custom domain server mail (cPanel/IMAP).
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5 pt-1">
                    {/* Gmail Accounts */}
                    {gmailAccounts.map((acc) => {
                      const isCurrent = activeGmailEmail === acc.email;
                      const overviewEntry = mailboxesOverview?.mailboxes.find(
                        (m) => m.type === 'gmail' && (m.id === acc.id || m.email === acc.email)
                      );
                      const currentRole = overviewEntry?.role || (acc as any).role || 'general';
                      const isPrimarySys = overviewEntry?.isSystemPrimary || (acc as any).isSystemPrimary;

                      return (
                        <div
                          key={acc.id || acc.email}
                          className={`flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border transition-all ${
                            isCurrent
                              ? 'border-[#0B57D0]/60 bg-blue-50/40 dark:bg-blue-950/20 shadow-2xs'
                              : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-100/60'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-[#EA4335] shrink-0">
                              <Mail className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100">
                                <span className="truncate">{acc.displayName || 'Gmail'}</span>
                                {isPrimarySys && (
                                  <span className="px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-300 text-[10px] font-bold">
                                    Primary System Mail
                                  </span>
                                )}
                                {isCurrent ? (
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 text-[10px] font-bold">
                                    Default Active
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 text-[10px] font-semibold">
                                    Connected
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] font-mono text-slate-500 truncate mt-0.5">
                                {acc.email} · Google IMAP:993
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {/* Role Selector */}
                            <select
                              value={currentRole}
                              onChange={(e) =>
                                handleUpdateMailboxRole(
                                  'gmail',
                                  acc.id || acc.email,
                                  e.target.value,
                                  e.target.value === 'system' && !isPrimarySys
                                )
                              }
                              className="text-[11px] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium focus:outline-none"
                              title="Assign Purpose/Role to this Mailbox"
                            >
                              <option value="general">📬 General Inbox</option>
                              <option value="system">🤖 System Mail</option>
                              <option value="admin">🛡️ Admin Alert</option>
                              <option value="marketing">📢 Marketing</option>
                            </select>

                            {currentRole === 'system' && !isPrimarySys && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdateMailboxRole('gmail', acc.id || acc.email, 'system', true)
                                }
                                className="px-2 py-1 rounded-lg bg-violet-600 text-white text-[10px] font-semibold cursor-pointer"
                              >
                                Set Primary
                              </button>
                            )}

                            {!isCurrent && (
                              <button
                                type="button"
                                onClick={() => {
                                  const switched = switchActiveGmailAccount(acc.email);
                                  if (switched) {
                                    onGmailAccountsChanged(gmailAccounts, switched.email);
                                    showToast('success', `Default Gmail switched to ${switched.email}`);
                                  }
                                }}
                                className="px-2.5 py-1 rounded-lg bg-[#0B57D0] text-white text-[11px] font-semibold cursor-pointer"
                              >
                                Set Default
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                switchActiveGmailAccount(acc.email);
                                onGmailAccountsChanged(gmailAccounts, acc.email);
                                onOpenModule('gmail');
                              }}
                              className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[11px] font-semibold hover:bg-slate-50 cursor-pointer"
                            >
                              Inbox
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEditGmailAccount(acc)}
                              className="p-1.5 text-slate-500 hover:text-[#0B57D0] cursor-pointer"
                              title="Edit"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                const remaining = await removeGmailAccount(acc.id || acc.email);
                                onGmailAccountsChanged(remaining, remaining[0]?.email || null);
                                showToast('success', `Removed ${acc.email}`);
                                loadMailboxesOverview();
                              }}
                              className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                              title="Remove"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {/* Server Mail Accounts */}
                    {serverAccounts.map((acc) => {
                      const isCurrent = activeServerAccountId === acc.id;
                      const overviewEntry = mailboxesOverview?.mailboxes.find(
                        (m) => m.type === 'server_mail' && (m.id === acc.id || m.email === acc.email)
                      );
                      const currentRole = overviewEntry?.role || acc.role || 'general';
                      const isPrimarySys = overviewEntry?.isSystemPrimary || acc.isSystemPrimary;

                      return (
                        <div
                          key={acc.id}
                          className={`flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border transition-all ${
                            isCurrent
                              ? 'border-[#0B57D0]/60 bg-blue-50/40 dark:bg-blue-950/20 shadow-2xs'
                              : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-100/60'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-[#0B57D0] shrink-0">
                              <Server className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100">
                                <span className="truncate">{acc.label}</span>
                                {isPrimarySys && (
                                  <span className="px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-300 text-[10px] font-bold">
                                    Primary System Mail
                                  </span>
                                )}
                                {isCurrent ? (
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 text-[10px] font-bold">
                                    Default Active
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 text-[10px] font-semibold">
                                    Connected
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] font-mono text-slate-500 truncate mt-0.5">
                                {acc.email} · {acc.imapHost}:{acc.imapPort}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {/* Role Selector */}
                            <select
                              value={currentRole}
                              onChange={(e) =>
                                handleUpdateMailboxRole(
                                  'server_mail',
                                  acc.id,
                                  e.target.value,
                                  e.target.value === 'system' && !isPrimarySys
                                )
                              }
                              className="text-[11px] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium focus:outline-none"
                              title="Assign Purpose/Role to this Mailbox"
                            >
                              <option value="general">📬 General Inbox</option>
                              <option value="system">🤖 System Mail</option>
                              <option value="admin">🛡️ Admin Alert</option>
                              <option value="marketing">📢 Marketing</option>
                            </select>

                            {currentRole === 'system' && !isPrimarySys && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdateMailboxRole('server_mail', acc.id, 'system', true)
                                }
                                className="px-2 py-1 rounded-lg bg-violet-600 text-white text-[10px] font-semibold cursor-pointer"
                              >
                                Set Primary
                              </button>
                            )}

                            {!isCurrent && (
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectServerAccount(acc.id);
                                  showToast('success', `Default Server Mail set to ${acc.email}`);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-[#0B57D0] text-white text-[11px] font-semibold cursor-pointer"
                              >
                                Set Default
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                onSelectServerAccount(acc.id);
                                onOpenModule('server_mail');
                              }}
                              className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[11px] font-semibold hover:bg-slate-50 cursor-pointer"
                            >
                              Inbox
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEditServerMailAccount(acc)}
                              className="p-1.5 text-slate-500 hover:text-[#0B57D0] cursor-pointer"
                              title="Edit"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                const remaining = await deleteServerMailAccount(acc.id);
                                onServerAccountsChanged(remaining, remaining[0]?.id || undefined);
                                showToast('success', `Removed ${acc.email}`);
                                loadMailboxesOverview();
                              }}
                              className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                              title="Remove"
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

              {/* Outgoing Mail Defaults & Signatures */}
              <div className="p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-4">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Edit3 className="w-4 h-4 text-[#0B57D0]" />
                    <span>Outgoing Email Signature &amp; Send Limits</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Customize your global email signature and daily outbound dispatch parameters.
                  </p>
                </div>

                <form onSubmit={handleSaveSystemSettingsForm} className="space-y-4 pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Default Reply-To Address
                      </label>
                      <input
                        type="email"
                        value={sysSettings.defaultReplyTo}
                        onChange={(e) => setSysSettings((s) => ({ ...s, defaultReplyTo: e.target.value }))}
                        placeholder="replies@company.com"
                        className="w-full px-3.5 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Daily Outbound Send Limit
                      </label>
                      <input
                        type="number"
                        value={sysSettings.dailySendLimit}
                        onChange={(e) => setSysSettings((s) => ({ ...s, dailySendLimit: Number(e.target.value) }))}
                        placeholder="500"
                        className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      HTML Email Signature
                    </label>
                    <textarea
                      rows={3}
                      value={sysSettings.defaultSignatureHtml}
                      onChange={(e) => setSysSettings((s) => ({ ...s, defaultSignatureHtml: e.target.value }))}
                      placeholder="<p>Best regards,<br/><strong>Team</strong></p>"
                      className="w-full px-3.5 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={isSavingSys}
                      className="px-5 py-2 rounded-xl bg-[#0B57D0] hover:bg-blue-700 text-white text-xs font-semibold shadow-xs disabled:opacity-60 cursor-pointer"
                    >
                      {isSavingSys ? 'Saving...' : 'Save Signature & Defaults'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Custom Mail Filter Tabs */}
              <div className="p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-4">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#0B57D0]" />
                    <span>Custom Mail Navigation Tabs</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Create dynamic filter tabs in Gmail/Server Mail (e.g. "Invoices", "VIP", "Support").
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
                    showToast('success', 'Added custom mail tab.');
                  }}
                  className="grid grid-cols-1 sm:grid-cols-3 gap-3"
                >
                  <input
                    type="text"
                    required
                    value={newTabName}
                    onChange={(e) => setNewTabName(e.target.value)}
                    placeholder="Tab Label (e.g. Invoices)"
                    className="px-3.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                  <input
                    type="text"
                    required
                    value={newTabQuery}
                    onChange={(e) => setNewTabQuery(e.target.value)}
                    placeholder="Search Query (e.g. subject:invoice)"
                    className="px-3.5 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-[#0B57D0] hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
                  >
                    + Add Tab
                  </button>
                </form>

                {customTabs.length > 0 && (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden mt-3">
                    {customTabs.map((tab) => (
                      <div key={tab.id} className="flex items-center justify-between px-4 py-2.5 text-xs">
                        <div>
                          <span className="font-bold text-slate-900 dark:text-slate-100">{tab.name}</span>
                          <span className="ml-2 font-mono text-slate-500">{tab.query}</span>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            const updated = await deleteCustomMailTab(tab.id);
                            onCustomTabsChanged(updated);
                            showToast('success', `Removed tab "${tab.name}"`);
                          }}
                          className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===================================================================
              TAB 3: NOTIFICATIONS & RULES
          =================================================================== */}
          {activeSubTab === 'mail_rules' && <WorkspaceMailSettings />}
          {activeSubTab === 'mail_rules' && (
            <div className="space-y-6">
              <div className="p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-4">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <BellRing className="w-4 h-4 text-[#0B57D0]" />
                    <span>Workspace Notification Rules</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Control automated activity notifications and admin alert triggers.
                  </p>
                </div>

                <form onSubmit={handleSaveSystemSettingsForm} className="space-y-4 pt-1">
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <input
                        type="checkbox"
                        checked={cmhRules.notifyOnTaskActivity}
                        onChange={(e) => setCmhRules((r) => ({ ...r, notifyOnTaskActivity: e.target.checked }))}
                        className="rounded text-[#0B57D0] focus:ring-0"
                      />
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          Task Progress &amp; Submission Alerts
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Receive notifications when a team member submits updates or changes task status.
                        </div>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <input
                        type="checkbox"
                        checked={cmhRules.notifyOnFormSubmit}
                        onChange={(e) => setCmhRules((r) => ({ ...r, notifyOnFormSubmit: e.target.checked }))}
                        className="rounded text-[#0B57D0] focus:ring-0"
                      />
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          Form Submission Notifications
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Notify workspace admin immediately when an internal or public form is submitted.
                        </div>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <input
                        type="checkbox"
                        checked={cmhRules.notifyOnProjectActivity}
                        onChange={(e) => setCmhRules((r) => ({ ...r, notifyOnProjectActivity: e.target.checked }))}
                        className="rounded text-[#0B57D0] focus:ring-0"
                      />
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          Project Activity &amp; Milestone Alerts
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Receive notifications when milestones or deadlines on projects are updated.
                        </div>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <input
                        type="checkbox"
                        checked={sysSettings.autoSaveAttachmentsToFiles}
                        onChange={(e) => setSysSettings((s) => ({ ...s, autoSaveAttachmentsToFiles: e.target.checked }))}
                        className="rounded text-[#0B57D0] focus:ring-0"
                      />
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          Auto-Save Email Attachments to File Manager
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Automatically mirror incoming email attachments into the workspace File Manager drive.
                        </div>
                      </div>
                    </label>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={isSavingSys}
                      className="px-5 py-2 rounded-xl bg-[#0B57D0] hover:bg-blue-700 text-white text-xs font-semibold shadow-xs disabled:opacity-60 cursor-pointer"
                    >
                      {isSavingSys ? 'Saving...' : 'Save Notification Rules'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ===================================================================
              TAB 4: STORAGE & DATA BACKUP (Clean & Free of Raw DB Credentials)
          =================================================================== */}
          {activeSubTab === 'security' && (
            <section className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800 sm:p-6">
              <h2 className="text-base font-semibold">Access &amp; Security</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Manage workspace roles, member access and active sessions.</p>
              <button type="button" onClick={onOpenAccessSettings} className="rounded-xl bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800">Open Access &amp; Users</button>
            </section>
          )}
          {activeSubTab === 'database' && (
            <div className="space-y-6">
              {/* PostgreSQL Engine Active Status Pill */}
              <div className="p-4 sm:p-5 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-700 dark:text-emerald-300">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
                      PostgreSQL Relational Engine: Active &amp; Healthy
                    </h3>
                    <p className="text-[11px] text-emerald-800/80 dark:text-emerald-400 mt-0.5">
                      All workspace tables, users, tasks, and system configurations are securely persisted. Database connection parameters are protected via server environment.
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold">
                  System Ready
                </span>
              </div>

              {/* VPS / Persistent Storage Diagnostics */}
              <div className="p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <HardDrive className="w-4 h-4 text-[#0B57D0]" />
                      <span>Workspace Storage &amp; Cache Diagnostics</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Monitor disk utilization for uploads, generated previews, and cache.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isCleaningStorage}
                      onClick={() => handleRunSmartStorageCleanup(30)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#0B57D0] hover:bg-blue-700 text-white text-xs font-semibold shadow-xs disabled:opacity-60 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{isCleaningStorage ? 'Cleaning...' : 'Clean Cache & Temp Files'}</span>
                    </button>
                  </div>
                </div>

                {vpsDiag ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
                      <div className="text-[11px] font-semibold text-slate-500">Uploads &amp; Files</div>
                      <div className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1">
                        {formatBytes(vpsDiag.uploadsBytes)}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{vpsDiag.activeFilesCount} active files</div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
                      <div className="text-[11px] font-semibold text-slate-500">Thumbnails Cache</div>
                      <div className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1">
                        {formatBytes(vpsDiag.thumbsBytes)}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Image previews</div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
                      <div className="text-[11px] font-semibold text-slate-500">Trash Bin</div>
                      <div className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1">
                        {formatBytes(vpsDiag.trashedBytes)}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{vpsDiag.trashedFilesCount} pending purge</div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
                      <div className="text-[11px] font-semibold text-slate-500">Total Storage Used</div>
                      <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                        {formatBytes(vpsDiag.totalUsedBytes)}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Persistent Storage</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500">Loading storage metrics...</div>
                )}
              </div>

              {/* Data Backup & Restore Hub */}
              <div className="p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <Download className="w-4 h-4 text-[#0B57D0]" />
                      <span>One-Click Relational Data Backup &amp; Restore</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Export a complete JSON snapshot of workspace records (users, tasks, projects, forms) or restore from an existing backup.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleExportBackup}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
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
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Restore Backup JSON</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* =======================================================================
          FOCUSED MODAL: ADD / EDIT MAILBOX DIALOG (Opens only on user request)
      ======================================================================= */}
      {showAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-[#0B57D0]" />
                  <span>
                    {gmailEditingId || serverEditingId ? 'Edit Mailbox Account' : 'Connect New Mailbox'}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Select your provider and configure your connection credentials.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAccountModal(false)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Provider Type Toggle (Only if creating new) */}
            {!gmailEditingId && !serverEditingId && (
              <div className="px-5 pt-4">
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setAccountType('gmail')}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      accountType === 'gmail'
                        ? 'bg-white dark:bg-slate-900 text-[#EA4335] shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Google Gmail</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAccountType('server_mail')}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      accountType === 'server_mail'
                        ? 'bg-white dark:bg-slate-900 text-[#0B57D0] shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <Server className="w-3.5 h-3.5" />
                    <span>Domain / Server Mail</span>
                  </button>
                </div>
              </div>
            )}

            {/* Modal Body / Form Container */}
            <div className="p-5 overflow-y-auto space-y-4">
              {/* --- GMAIL FORM --- */}
              {accountType === 'gmail' && (
                <form onSubmit={handleSaveGmail} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Display Label
                    </label>
                    <input
                      type="text"
                      value={gmailLabel}
                      onChange={(e) => setGmailLabel(e.target.value)}
                      placeholder="e.g. Official Gmail"
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
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
                      className="w-full px-3.5 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {gmailEditingId ? 'Google App Password (leave blank to keep current)' : 'Google App Password *'}
                    </label>
                    <input
                      type="password"
                      required={!gmailEditingId}
                      value={gmailPassword}
                      onChange={(e) => setGmailPassword(e.target.value)}
                      placeholder="16-character Google App Password"
                      className="w-full px-3.5 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      Generate from myaccount.google.com/apppasswords with 2-Step Verification enabled.
                    </p>
                  </div>

                  {gmailVerifyResult && (
                    <div
                      className={`p-3 rounded-xl text-xs font-medium ${
                        gmailVerifyResult.ok
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-red-50 text-red-800 border border-red-200'
                      }`}
                    >
                      {gmailVerifyResult.message}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      disabled={isVerifyingGmail}
                      onClick={handleVerifyGmail}
                      className="px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer"
                    >
                      {isVerifyingGmail ? 'Testing...' : 'Test Connection'}
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowAccountModal(false)}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingGmail}
                        className="px-4 py-1.5 rounded-xl bg-[#0B57D0] hover:bg-blue-700 text-white text-xs font-semibold shadow-xs disabled:opacity-60 cursor-pointer"
                      >
                        {isSavingGmail ? 'Saving...' : 'Save &amp; Connect'}
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* --- SERVER MAIL FORM --- */}
              {accountType === 'server_mail' && (
                <form onSubmit={handleSaveServerMail} className="space-y-4">
                  {/* Preset quick buttons */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">
                      Quick Presets:
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {SMTP_RELAY_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            setServerImapHost(preset.imapHost);
                            setServerImapPort(preset.imapPort);
                            setServerSmtpHost(preset.smtpHost);
                            setServerSmtpPort(preset.smtpPort);
                            showToast('success', `Applied preset: ${preset.name}`);
                          }}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
                        >
                          {preset.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Account Label
                      </label>
                      <input
                        type="text"
                        value={serverLabel}
                        onChange={(e) => setServerLabel(e.target.value)}
                        placeholder="e.g. Support cPanel"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        required
                        value={serverEmail}
                        onChange={(e) => setServerEmail(e.target.value)}
                        placeholder="contact@yourdomain.com"
                        className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Username (default email)
                      </label>
                      <input
                        type="text"
                        value={serverUsername}
                        onChange={(e) => setServerUsername(e.target.value)}
                        placeholder="contact@yourdomain.com"
                        className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        {serverEditingId ? 'Password (leave blank to keep current)' : 'Password *'}
                      </label>
                      <input
                        type="password"
                        required={!serverEditingId}
                        value={serverPassword}
                        onChange={(e) => setServerPassword(e.target.value)}
                        placeholder="Mailbox password"
                        className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        IMAP Host &amp; Port *
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          required
                          value={serverImapHost}
                          onChange={(e) => setServerImapHost(e.target.value)}
                          placeholder="mail.yourdomain.com"
                          className="flex-1 px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                        />
                        <input
                          type="number"
                          value={serverImapPort}
                          onChange={(e) => setServerImapPort(Number(e.target.value))}
                          placeholder="993"
                          className="w-16 px-2 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        SMTP Host &amp; Port *
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          required
                          value={serverSmtpHost}
                          onChange={(e) => setServerSmtpHost(e.target.value)}
                          placeholder="mail.yourdomain.com"
                          className="flex-1 px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                        />
                        <input
                          type="number"
                          value={serverSmtpPort}
                          onChange={(e) => setServerSmtpPort(Number(e.target.value))}
                          placeholder="465"
                          className="w-16 px-2 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                        />
                      </div>
                    </div>
                  </div>

                  {serverVerifyResult && (
                    <div
                      className={`p-3 rounded-xl text-xs font-medium ${
                        serverVerifyResult.ok
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-red-50 text-red-800 border border-red-200'
                      }`}
                    >
                      {serverVerifyResult.ok ? 'Server connection verified!' : (serverVerifyResult.imapMessage || serverVerifyResult.smtpMessage || 'Verification failed')}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      disabled={isVerifyingServer}
                      onClick={handleVerifyServerMail}
                      className="px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer"
                    >
                      {isVerifyingServer ? 'Testing...' : 'Test Connection'}
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowAccountModal(false)}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingServer}
                        className="px-4 py-1.5 rounded-xl bg-[#0B57D0] hover:bg-blue-700 text-white text-xs font-semibold shadow-xs disabled:opacity-60 cursor-pointer"
                      >
                        {isSavingServer ? 'Saving...' : 'Save &amp; Connect'}
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          ADD DEDICATED SYSTEM MAIL MODAL (Clean, Slim & Modern)
      ===================================================================== */}
      {showAddSystemMailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between bg-violet-50/40 dark:bg-violet-950/20">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-violet-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Add Dedicated System Mail
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    স্বয়ংক্রিয় টাস্ক নোটিফিকেশন, ইনভাইটেশন ও অ্যালার্ট পাঠানোর জন্য
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAddSystemMailModal(false)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Provider Type Switcher */}
            <div className="p-5 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setSysType('server_mail');
                    setSysSmtpHost('mail.yourdomain.com');
                    setSysSmtpPort(465);
                    setSysSmtpSecure(true);
                  }}
                  className={`py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    sysType === 'server_mail'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <Server className="w-3.5 h-3.5" />
                  <span>Custom Server SMTP</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSysType('gmail');
                    setSysSmtpHost('smtp.gmail.com');
                    setSysSmtpPort(465);
                    setSysSmtpSecure(true);
                  }}
                  className={`py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    sysType === 'gmail'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5 text-[#EA4335]" />
                  <span>Google Gmail</span>
                </button>
              </div>

              {sysBanner && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                    sysBanner.ok
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-red-50 border-red-200 text-red-800'
                  }`}
                >
                  {sysBanner.ok ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{sysBanner.text}</span>
                </div>
              )}

              <form onSubmit={handleAddSystemMailSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    System Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={sysEmail}
                    onChange={(e) => setSysEmail(e.target.value)}
                    placeholder={
                      sysType === 'gmail'
                        ? 'notifications.workspace@gmail.com'
                        : 'system@yourcompany.com'
                    }
                    className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:border-violet-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Sender Display Name
                  </label>
                  <input
                    type="text"
                    value={sysLabel}
                    onChange={(e) => setSysLabel(e.target.value)}
                    placeholder="Workspace Pro System"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:border-violet-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {sysType === 'gmail' ? '16-Character Google App Password *' : 'SMTP Password *'}
                  </label>
                  <input
                    type="password"
                    required
                    value={sysPassword}
                    onChange={(e) => setSysPassword(e.target.value)}
                    placeholder="••••••••••••••••"
                    className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:border-violet-600"
                  />
                  {sysType === 'gmail' && (
                    <p className="text-[10px] text-slate-500 mt-1">
                      Use a Google Account App Password (requires 2-Step Verification enabled).
                    </p>
                  )}
                </div>

                {sysType === 'server_mail' && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                        SMTP Host
                      </label>
                      <input
                        type="text"
                        value={sysSmtpHost}
                        onChange={(e) => setSysSmtpHost(e.target.value)}
                        placeholder="mail.yourdomain.com"
                        className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                        SMTP Port
                      </label>
                      <input
                        type="number"
                        value={sysSmtpPort}
                        onChange={(e) => setSysSmtpPort(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowAddSystemMailModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={sysSaving}
                    className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold shadow-xs disabled:opacity-60 transition-colors"
                  >
                    {sysSaving ? 'Verifying & Saving...' : 'Save & Activate System Mail'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
