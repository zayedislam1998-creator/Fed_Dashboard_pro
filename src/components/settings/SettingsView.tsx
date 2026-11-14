import React, { useState, useEffect, useRef } from 'react';
import {
  Sliders,
  Mail,
  HardDrive,
  BellRing,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { ConnectedGmailAccount, removeGmailAccount } from '../../services/auth';
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
  fetchSystemSettings,
  saveSystemSettings,
  fetchVpsStorageDiagnostics,
  runVpsStorageCleanup,
  exportWorkspaceBackupJson,
  restoreWorkspaceBackupJson,
  fetchPostgresCatalog,
  fetchDatabaseConfig,
  type PostgresCatalogInfo,
  type PostgresConfigClient,
} from '../../services/workspaceApi';
import { wsFetch as fetch } from '../../services/sessionFetch';

import { GeneralSettingsTab } from './GeneralSettingsTab';
import { FeedSettingsTab } from './FeedSettingsTab';
import { EmailChannelsTab, MailboxesOverviewData } from './EmailChannelsTab';
import { NotificationRulesTab } from './NotificationRulesTab';
import { StorageAndDatabaseTab } from './StorageAndDatabaseTab';
import { MailboxSetupModal } from './MailboxSetupModal';
import { SystemMailSetupModal } from './SystemMailSetupModal';

export type SettingsSubTab = 'general' | 'accounts' | 'mail_rules' | 'database' | 'security' | 'feed';
export type AccountSetupType = 'gmail' | 'server_mail';

interface SettingsViewProps {
  activeSubTab: SettingsSubTab;
  onSelectSubTab: (tab: SettingsSubTab) => void;
  gmailAccounts: ConnectedGmailAccount[];
  activeGmailEmail?: string | null;
  onGmailAccountsChanged: (accounts: ConnectedGmailAccount[], nextActive?: string | null) => void;
  serverAccounts: ServerMailAccount[];
  activeServerAccountId?: string | null;
  onSelectServerAccount: (id: string) => void;
  onServerAccountsChanged: (accounts: ServerMailAccount[], nextActiveId?: string) => void;
  customTabs: CustomMailTab[];
  onCustomTabsChanged: (tabs: CustomMailTab[]) => void;
  onOpenModule: (module: 'gmail' | 'server_mail' | 'bulk') => void;
  onWorkspaceNameChanged?: (name: string) => void;
  onOpenAccessSettings: () => void;
}

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

  // Modal states
  const [showAccountModal, setShowAccountModal] = useState<boolean>(false);
  const [showAddSystemMailModal, setShowAddSystemMailModal] = useState<boolean>(false);
  const [accountType, setAccountType] = useState<AccountSetupType>('gmail');

  // Gmail modal form state
  const [gmailEditingId, setGmailEditingId] = useState<string | undefined>(undefined);
  const [gmailLabel, setGmailLabel] = useState<string>('');
  const [gmailEmail, setGmailEmail] = useState<string>('');
  const [gmailPassword, setGmailPassword] = useState<string>('');
  const [isVerifyingGmail, setIsVerifyingGmail] = useState<boolean>(false);
  const [isSavingGmail, setIsSavingGmail] = useState<boolean>(false);
  const [gmailVerifyResult, setGmailVerifyResult] = useState<ServerMailVerifyResult | null>(null);

  // Server Mail modal form state
  const [serverEditingId, setServerEditingId] = useState<string | undefined>(undefined);
  const [serverLabel, setServerLabel] = useState<string>('');
  const [serverEmail, setServerEmail] = useState<string>('');
  const [serverUsername, setServerUsername] = useState<string>('');
  const [serverPassword, setServerPassword] = useState<string>('');
  const [serverImapHost, setServerImapHost] = useState<string>('mail.yourdomain.com');
  const [serverImapPort, setServerImapPort] = useState<number>(993);
  const [serverSmtpHost, setServerSmtpHost] = useState<string>('mail.yourdomain.com');
  const [serverSmtpPort, setServerSmtpPort] = useState<number>(465);
  const [serverSecure, setServerSecure] = useState<boolean>(true);
  const [isVerifyingServer, setIsVerifyingServer] = useState<boolean>(false);
  const [isSavingServer, setIsSavingServer] = useState<boolean>(false);
  const [serverVerifyResult, setServerVerifyResult] = useState<ServerMailVerifyResult | null>(null);

  // System Mail Form State
  const [sysType, setSysType] = useState<'server_mail' | 'gmail'>('server_mail');
  const [sysEmail, setSysEmail] = useState<string>('');
  const [sysPassword, setSysPassword] = useState<string>('');
  const [sysLabel, setSysLabel] = useState<string>('System Mail');
  const [sysSmtpHost, setSysSmtpHost] = useState<string>('mail.yourdomain.com');
  const [sysSmtpPort, setSysSmtpPort] = useState<number>(465);
  const [sysSaving, setSysSaving] = useState<boolean>(false);
  const [sysBanner, setSysBanner] = useState<{ ok: boolean; text: string } | null>(null);

  // Mailboxes Overview & Testing State
  const [mailboxesOverview, setMailboxesOverview] = useState<MailboxesOverviewData | null>(null);
  const [testingActiveSystemMail, setTestingActiveSystemMail] = useState<boolean>(false);
  const [activeSystemMailTestResult, setActiveSystemMailTestResult] = useState<{
    ok: boolean;
    message: string;
    host?: string;
  } | null>(null);

  // General System Settings & CMH Rules State
  const [sysSettings, setSysSettings] = useState<WorkspaceSystemSettingsClient>({
    workspaceName: 'Workspace Pro',
    organizationName: '',
    adminEmail: '',
    defaultLandingModule: 'overview',
    timezone: 'Asia/Dhaka',
    dateFormat: 'MMM D, YYYY',
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
    adminEmail: '',
    notifyOnTaskActivity: true,
    notifyOnFormSubmit: true,
    notifyOnProjectActivity: true,
    notifyOnMemberActivity: true,
    autoSendAdminEmail: true,
    injectIntoPrimaryInbox: false,
    updatedAt: '',
  });

  const [isSavingSys, setIsSavingSys] = useState<boolean>(false);

  // Storage & PostgreSQL Catalog State
  const [vpsDiag, setVpsDiag] = useState<VpsStorageDiagnosticsClient | null>(null);
  const [isCleaningStorage, setIsCleaningStorage] = useState<boolean>(false);
  const backupFileInputRef = useRef<HTMLInputElement>(null);

  const [catalogInfo, setCatalogInfo] = useState<PostgresCatalogInfo | null>(null);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState<boolean>(false);
  const [catalogLastLoaded, setCatalogLastLoaded] = useState<string>('');
  const [dbConfig, setDbConfig] = useState<PostgresConfigClient | null>(null);

  // Load Mailboxes Overview
  const loadMailboxesOverview = async () => {
    try {
      const res = await fetch('/api/mail/mailboxes/overview');
      if (res.ok) {
        const data = await res.json();
        setMailboxesOverview(data);
      }
    } catch {
      // ignore
    }
  };

  // Load Initial Settings
  useEffect(() => {
    loadMailboxesOverview();
    Promise.all([
      fetchSystemSettings().catch(() => null),
      fetchVpsStorageDiagnostics().catch(() => null),
    ]).then(([sys, storage]) => {
      if (sys?.settings) {
        setSysSettings(sys.settings);
        if (onWorkspaceNameChanged && sys.settings.workspaceName) {
          onWorkspaceNameChanged(sys.settings.workspaceName);
        }
      }
      if (sys?.cmhRules) {
        setCmhRules(sys.cmhRules);
      }
      if (storage) {
        setVpsDiag(storage);
      }
    });
  }, []);

  // Fetch PostgreSQL Catalog & DB Config on database tab
  const loadCatalogData = async () => {
    setIsLoadingCatalog(true);
    try {
      const data = await fetchPostgresCatalog();
      setCatalogInfo(data);
      setCatalogLastLoaded(new Date().toLocaleTimeString());
    } catch (err: any) {
      console.warn('Postgres catalog load error:', err?.message || err);
    } finally {
      setIsLoadingCatalog(false);
    }
  };

  const loadDbConfigData = async () => {
    try {
      const res = await fetchDatabaseConfig();
      if (res?.config) {
        setDbConfig(res.config);
      }
    } catch (err: any) {
      console.warn('Postgres config load error:', err?.message || err);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'database') {
      if (!catalogInfo) loadCatalogData();
      if (!dbConfig) loadDbConfigData();
    }
  }, [activeSubTab]);

  // Handlers
  const handleSaveSystemSettingsForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSys(true);
    try {
      const res = await saveSystemSettings(sysSettings, cmhRules);
      if (res.settings) {
        setSysSettings(res.settings);
        if (onWorkspaceNameChanged && res.settings.workspaceName) {
          onWorkspaceNameChanged(res.settings.workspaceName);
        }
      }
      if (res.cmhRules) {
        setCmhRules(res.cmhRules);
      }
      showToast('success', 'Workspace settings saved successfully.');
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to save settings.');
    } finally {
      setIsSavingSys(false);
    }
  };

  const handleRunSmartStorageCleanup = async (days: number) => {
    setIsCleaningStorage(true);
    try {
      const res = await runVpsStorageCleanup({ purgeTrashOlderThanDays: days, pruneOrphans: true });
      setVpsDiag(res.storage);
      const totalRemoved = res.cleanup.removedOrphans + res.cleanup.removedTrashedFiles;
      showToast('success', `Cleanup complete! Removed ${totalRemoved} temporary files (${res.cleanup.reclaimedBytes ? (res.cleanup.reclaimedBytes / (1024 * 1024)).toFixed(1) + ' MB' : '0 MB'} freed).`);
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
      const payload = JSON.parse(text);
      const res = await restoreWorkspaceBackupJson(payload);
      showToast('success', res.message || 'Backup restored successfully!');
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to import backup file.');
    }
  };

  // Gmail Handlers
  const handleVerifyGmail = async () => {
    if (!gmailEmail.trim() || !gmailPassword.trim()) {
      showToast('error', 'Please enter your Gmail address and App Password.');
      return;
    }
    setIsVerifyingGmail(true);
    setGmailVerifyResult(null);
    try {
      const res = await verifyServerMailConnection({
        email: gmailEmail.trim(),
        username: gmailEmail.trim(),
        password: gmailPassword.trim(),
        imapHost: 'imap.gmail.com',
        imapPort: 993,
        imapSecure: true,
        smtpHost: 'smtp.gmail.com',
        smtpPort: 465,
        smtpSecure: true,
      });
      setGmailVerifyResult(res);
      if (res.ok) {
        showToast('success', 'Gmail App Password verified successfully!');
      } else {
        showToast('error', res.imapMessage || res.smtpMessage || 'Gmail verification failed.');
      }
    } catch (err: any) {
      setGmailVerifyResult({ ok: false, imapOk: false, imapMessage: err?.message || 'Verification failed.', smtpOk: false, smtpMessage: '' });
      showToast('error', err?.message || 'Verification failed.');
    } finally {
      setIsVerifyingGmail(false);
    }
  };

  const handleSaveGmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gmailEmail.trim() || (!gmailPassword.trim() && !gmailEditingId)) {
      showToast('error', 'Gmail address and password are required.');
      return;
    }
    setIsSavingGmail(true);
    try {
      const res = await fetch('/api/mail/gmail/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: gmailEditingId,
          displayName: gmailLabel.trim() || 'Official Gmail',
          email: gmailEmail.trim(),
          password: gmailPassword.trim(),
          authMode: 'app_password',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to connect Gmail');

      showToast('success', 'Gmail connected successfully!');
      setShowAccountModal(false);
      if (data.accounts) {
        onGmailAccountsChanged(data.accounts, data.account?.email || gmailEmail.trim());
      }
      loadMailboxesOverview();
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to save Gmail.');
    } finally {
      setIsSavingGmail(false);
    }
  };

  // Server Mail Handlers
  const handleVerifyServer = async () => {
    if (!serverEmail.trim() || !serverPassword.trim()) {
      showToast('error', 'Email and password are required for verification.');
      return;
    }
    setIsVerifyingServer(true);
    setServerVerifyResult(null);
    try {
      const res = await verifyServerMailConnection({
        email: serverEmail.trim(),
        username: serverUsername.trim() || serverEmail.trim(),
        password: serverPassword.trim(),
        imapHost: serverImapHost.trim(),
        imapPort: serverImapPort,
        imapSecure: serverSecure,
        smtpHost: serverSmtpHost.trim(),
        smtpPort: serverSmtpPort,
        smtpSecure: serverSecure,
      });
      setServerVerifyResult(res);
      if (res.ok) {
        showToast('success', 'IMAP & SMTP connection verified successfully!');
      } else {
        showToast('error', res.imapMessage || res.smtpMessage || 'Connection verification failed.');
      }
    } catch (err: any) {
      setServerVerifyResult({ ok: false, imapOk: false, imapMessage: err?.message || 'Verification error', smtpOk: false, smtpMessage: '' });
      showToast('error', err?.message || 'Verification error');
    } finally {
      setIsVerifyingServer(false);
    }
  };

  const handleSaveServerMail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverEmail.trim()) {
      showToast('error', 'Email is required.');
      return;
    }
    setIsSavingServer(true);
    try {
      const res = await saveServerMailAccount({
        id: serverEditingId,
        label: serverLabel.trim() || 'Server Mail',
        email: serverEmail.trim(),
        username: serverUsername.trim() || serverEmail.trim(),
        password: serverPassword.trim(),
        imapHost: serverImapHost.trim(),
        imapPort: serverImapPort,
        imapSecure: serverSecure,
        smtpHost: serverSmtpHost.trim(),
        smtpPort: serverSmtpPort,
        smtpSecure: serverSecure,
      });
      showToast('success', 'Server Mail saved successfully!');
      setShowAccountModal(false);
      if (res.accounts) {
        onServerAccountsChanged(res.accounts, res.account?.id);
      }
      loadMailboxesOverview();
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to save Server Mail.');
    } finally {
      setIsSavingServer(false);
    }
  };

  // System Mail Setup Handler
  const handleAddSystemMailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSysSaving(true);
    setSysBanner(null);
    try {
      const res = await fetch('/api/mail/mailboxes/system-mail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: sysType,
          email: sysEmail.trim(),
          label: sysLabel.trim() || 'System Mail',
          password: sysPassword.trim(),
          smtpHost: sysSmtpHost.trim(),
          smtpPort: sysSmtpPort,
          smtpSecure: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to configure system mail');

      setSysBanner({ ok: true, text: 'System mail verified & active!' });
      showToast('success', 'System mail configured & active!');
      setTimeout(() => setShowAddSystemMailModal(false), 800);
      loadMailboxesOverview();
    } catch (err: any) {
      setSysBanner({ ok: false, text: err?.message || 'Failed to add system mail.' });
    } finally {
      setSysSaving(false);
    }
  };

  // Test Active System Mail
  const handleTestActiveSystemMail = async () => {
    setTestingActiveSystemMail(true);
    setActiveSystemMailTestResult(null);
    try {
      const res = await fetch('/api/mail/mailboxes/test-system-mail', { method: 'POST' });
      const data = await res.json();
      setActiveSystemMailTestResult(data);
      if (data.ok) {
        showToast('success', 'System Mail dispatcher connection verified!');
      } else {
        showToast('error', data.message || 'System Mail test failed.');
      }
    } catch (err: any) {
      setActiveSystemMailTestResult({ ok: false, message: err?.message || 'Test connection error' });
    } finally {
      setTestingActiveSystemMail(false);
    }
  };

  // Role Update Handler
  const handleUpdateMailboxRole = async (
    type: 'gmail' | 'server_mail',
    id: string,
    role: string,
    isPrimary?: boolean
  ) => {
    try {
      const res = await fetch('/api/mail/mailboxes/role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, id, role, isPrimary }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast('success', 'Mailbox role updated successfully.');
        loadMailboxesOverview();
      } else {
        showToast('error', data.error || 'Failed to update role.');
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to update role.');
    }
  };

  const [settingsSearch, setSettingsSearch] = useState('');
  const totalConnected = gmailAccounts.length + serverAccounts.length;

  const navItems: Array<{
    id: SettingsSubTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
  }> = [
    { id: 'general', label: 'General & Workspace', icon: Sliders },
    { id: 'feed', label: 'Main Feed', icon: Sliders },
    { id: 'accounts', label: 'Email & Channels', icon: Mail, count: totalConnected },
    { id: 'mail_rules', label: 'Notifications & Rules', icon: BellRing },
    { id: 'database', label: 'Storage & Backup', icon: HardDrive },
    { id: 'security', label: 'Access & Security', icon: ShieldCheck },
  ];

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 md:rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
      {/* 1-Line Clean Sub-Navigation Tab Bar */}
      <div className="px-4 sm:px-6 py-2.5 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {navItems
            .filter((item) => item.label.toLowerCase().includes(settingsSearch.trim().toLowerCase()))
            .map((item) => {
              const Icon = item.icon;
              const active = activeSubTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectSubTab(item.id)}
                  className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-[#0B57D0] text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
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

        <input
          aria-label="Find a settings section"
          placeholder="Find settings..."
          value={settingsSearch}
          onChange={(e) => setSettingsSearch(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 sm:w-44"
        />
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
            âœ•
          </button>
        </div>
      )}

      {/* Main Scrollable Settings Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {activeSubTab === 'general' && (
            <GeneralSettingsTab
              sysSettings={sysSettings}
              setSysSettings={setSysSettings}
              onSubmit={handleSaveSystemSettingsForm}
              isSaving={isSavingSys}
            />
          )}

          {activeSubTab === 'feed' && <FeedSettingsTab />}

          {activeSubTab === 'accounts' && (
            <EmailChannelsTab
              gmailAccounts={gmailAccounts}
              activeGmailEmail={activeGmailEmail}
              serverAccounts={serverAccounts}
              activeServerAccountId={activeServerAccountId}
              customTabs={customTabs}
              onCustomTabsChanged={onCustomTabsChanged}
              mailboxesOverview={mailboxesOverview}
              sysSettings={sysSettings}
              setSysSettings={setSysSettings}
              onSaveSystemSettings={handleSaveSystemSettingsForm}
              isSavingSys={isSavingSys}
              onOpenConnectModal={() => {
                setGmailEditingId(undefined);
                setServerEditingId(undefined);
                setGmailLabel('');
                setGmailEmail('');
                setGmailPassword('');
                setServerLabel('');
                setServerEmail('');
                setServerUsername('');
                setServerPassword('');
                setAccountType('gmail');
                setShowAccountModal(true);
              }}
              onOpenSystemMailModal={() => {
                setSysType('server_mail');
                setSysEmail('');
                setSysPassword('');
                setSysLabel('System Mail');
                setSysSmtpHost('mail.yourdomain.com');
                setSysSmtpPort(465);
                setSysBanner(null);
                setShowAddSystemMailModal(true);
              }}
              onEditGmail={(acc) => {
                setGmailEditingId(acc.id || acc.email);
                setGmailLabel(acc.displayName || '');
                setGmailEmail(acc.email);
                setGmailPassword('');
                setAccountType('gmail');
                setShowAccountModal(true);
              }}
              onDeleteGmail={async (idOrEmail) => {
                const remaining = await removeGmailAccount(idOrEmail);
                onGmailAccountsChanged(remaining, remaining[0]?.email || null);
                showToast('success', `Removed ${idOrEmail}`);
                loadMailboxesOverview();
              }}
              onSwitchDefaultGmail={(email) => {
                onGmailAccountsChanged(gmailAccounts, email);
                showToast('success', `Default Gmail switched to ${email}`);
              }}
              onOpenModule={onOpenModule}
              onEditServerMail={(acc) => {
                setServerEditingId(acc.id);
                setServerLabel(acc.label);
                setServerEmail(acc.email);
                setServerUsername(acc.username || acc.email);
                setServerPassword('');
                setServerImapHost(acc.imapHost);
                setServerImapPort(acc.imapPort);
                setServerSmtpHost(acc.smtpHost);
                setServerSmtpPort(acc.smtpPort);
                setServerSecure(acc.smtpSecure ?? true);
                setAccountType('server_mail');
                setShowAccountModal(true);
              }}
              onDeleteServerMail={async (id) => {
                const remaining = await deleteServerMailAccount(id);
                onServerAccountsChanged(remaining, remaining[0]?.id || undefined);
                showToast('success', 'Server mail account removed.');
                loadMailboxesOverview();
              }}
              onSelectServerAccount={onSelectServerAccount}
              onUpdateMailboxRole={handleUpdateMailboxRole}
              onTestActiveSystemMail={handleTestActiveSystemMail}
              testingActiveSystemMail={testingActiveSystemMail}
              activeSystemMailTestResult={activeSystemMailTestResult}
              onDismissSystemMailTestResult={() => setActiveSystemMailTestResult(null)}
              showToast={showToast}
            />
          )}

          {activeSubTab === 'mail_rules' && (
            <NotificationRulesTab
              cmhRules={cmhRules}
              setCmhRules={setCmhRules}
              sysSettings={sysSettings}
              setSysSettings={setSysSettings}
              onSubmit={handleSaveSystemSettingsForm}
              isSaving={isSavingSys}
            />
          )}

          {activeSubTab === 'database' && (
            <StorageAndDatabaseTab
              vpsDiag={vpsDiag}
              catalogInfo={catalogInfo}
              dbConfig={dbConfig}
              isLoadingCatalog={isLoadingCatalog}
              catalogLastLoaded={catalogLastLoaded}
              onRefreshCatalog={loadCatalogData}
              onRunStorageCleanup={handleRunSmartStorageCleanup}
              isCleaningStorage={isCleaningStorage}
              onExportBackup={handleExportBackup}
              onImportBackup={handleImportBackup}
              backupFileInputRef={backupFileInputRef}
            />
          )}

          {activeSubTab === 'security' && (
            <section className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800 sm:p-6 bg-white dark:bg-slate-900">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Access &amp; Security Controls
              </h2>
              <p className="text-xs text-slate-500">
                Manage workspace roles, team member access levels, and active user sessions.
              </p>
              <button
                type="button"
                onClick={onOpenAccessSettings}
                className="rounded-xl bg-[#0B57D0] hover:bg-blue-700 px-4 py-2 text-xs font-semibold text-white cursor-pointer"
              >
                Open Access &amp; Users Panel
              </button>
            </section>
          )}
        </div>
      </div>

      {/* Focused Modals */}
      <MailboxSetupModal
        isOpen={showAccountModal}
        onClose={() => setShowAccountModal(false)}
        accountType={accountType}
        setAccountType={setAccountType}
        gmailEditingId={gmailEditingId}
        gmailLabel={gmailLabel}
        setGmailLabel={setGmailLabel}
        gmailEmail={gmailEmail}
        setGmailEmail={setGmailEmail}
        gmailPassword={gmailPassword}
        setGmailPassword={setGmailPassword}
        isVerifyingGmail={isVerifyingGmail}
        isSavingGmail={isSavingGmail}
        gmailVerifyResult={gmailVerifyResult}
        onVerifyGmail={handleVerifyGmail}
        onSaveGmail={handleSaveGmail}
        serverEditingId={serverEditingId}
        serverLabel={serverLabel}
        setServerLabel={setServerLabel}
        serverEmail={serverEmail}
        setServerEmail={setServerEmail}
        serverUsername={serverUsername}
        setServerUsername={setServerUsername}
        serverPassword={serverPassword}
        setServerPassword={setServerPassword}
        serverImapHost={serverImapHost}
        setServerImapHost={setServerImapHost}
        serverImapPort={serverImapPort}
        setServerImapPort={setServerImapPort}
        serverSmtpHost={serverSmtpHost}
        setServerSmtpHost={setServerSmtpHost}
        serverSmtpPort={serverSmtpPort}
        setServerSmtpPort={setServerSmtpPort}
        serverSecure={serverSecure}
        setServerSecure={setServerSecure}
        isVerifyingServer={isVerifyingServer}
        isSavingServer={isSavingServer}
        serverVerifyResult={serverVerifyResult}
        onVerifyServer={handleVerifyServer}
        onSaveServerMail={handleSaveServerMail}
        onApplyPreset={(p) => {
          setServerImapHost(p.imapHost);
          setServerImapPort(p.imapPort);
          setServerSmtpHost(p.smtpHost);
          setServerSmtpPort(p.smtpPort);
          showToast('success', `Applied preset: ${p.name}`);
        }}
      />

      <SystemMailSetupModal
        isOpen={showAddSystemMailModal}
        onClose={() => setShowAddSystemMailModal(false)}
        sysType={sysType}
        setSysType={setSysType}
        sysEmail={sysEmail}
        setSysEmail={setSysEmail}
        sysLabel={sysLabel}
        setSysLabel={setSysLabel}
        sysPassword={sysPassword}
        setSysPassword={setSysPassword}
        sysSmtpHost={sysSmtpHost}
        setSysSmtpHost={setSysSmtpHost}
        sysSmtpPort={sysSmtpPort}
        setSysSmtpPort={setSysSmtpPort}
        sysBanner={sysBanner}
        sysSaving={sysSaving}
        onSubmit={handleAddSystemMailSubmit}
      />
    </div>
  );
};

