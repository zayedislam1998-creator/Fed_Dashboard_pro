import React, { useState } from 'react';
import {
  Mail,
  Server,
  Plus,
  Trash2,
  Edit3,
  Bot,
  ShieldAlert,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Layers,
} from 'lucide-react';
import { ConnectedGmailAccount } from '../../services/auth';
import {
  ServerMailAccount,
  CustomMailTab,
  WorkspaceSystemSettingsClient,
  saveCustomMailTab,
  deleteCustomMailTab,
} from '../../services/workspaceApi';

export interface MailboxesOverviewData {
  totalCount: number;
  generalCount: number;
  adminRecipient: string;
  primarySystemMail: {
    id: string;
    email: string;
    label: string;
    type: 'server_mail' | 'gmail';
    host: string;
  } | null;
  mailboxes: Array<{
    id: string;
    email: string;
    label: string;
    type: 'server_mail' | 'gmail';
    role: string;
    isSystemPrimary: boolean;
  }>;
}

interface EmailChannelsTabProps {
  gmailAccounts: ConnectedGmailAccount[];
  activeGmailEmail?: string | null;
  serverAccounts: ServerMailAccount[];
  activeServerAccountId?: string | null;
  customTabs: CustomMailTab[];
  onCustomTabsChanged: (tabs: CustomMailTab[]) => void;
  mailboxesOverview: MailboxesOverviewData | null;
  sysSettings: WorkspaceSystemSettingsClient;
  setSysSettings: React.Dispatch<React.SetStateAction<WorkspaceSystemSettingsClient>>;
  onSaveSystemSettings: (e: React.FormEvent) => void;
  isSavingSys: boolean;
  onOpenConnectModal: () => void;
  onOpenSystemMailModal: () => void;
  onEditGmail: (acc: ConnectedGmailAccount) => void;
  onDeleteGmail: (idOrEmail: string) => void;
  onSwitchDefaultGmail: (email: string) => void;
  onOpenModule: (module: 'gmail' | 'server_mail' | 'bulk') => void;
  onEditServerMail: (acc: ServerMailAccount) => void;
  onDeleteServerMail: (id: string) => void;
  onSelectServerAccount: (id: string) => void;
  onUpdateMailboxRole: (type: 'gmail' | 'server_mail', id: string, role: string, isPrimary?: boolean) => void;
  onTestActiveSystemMail: () => void;
  testingActiveSystemMail: boolean;
  activeSystemMailTestResult: { ok: boolean; message: string; host?: string } | null;
  onDismissSystemMailTestResult: () => void;
  showToast: (type: 'success' | 'error', text: string) => void;
}

export const EmailChannelsTab: React.FC<EmailChannelsTabProps> = ({
  gmailAccounts,
  activeGmailEmail,
  serverAccounts,
  activeServerAccountId,
  customTabs,
  onCustomTabsChanged,
  mailboxesOverview,
  sysSettings,
  setSysSettings,
  onSaveSystemSettings,
  isSavingSys,
  onOpenConnectModal,
  onOpenSystemMailModal,
  onEditGmail,
  onDeleteGmail,
  onSwitchDefaultGmail,
  onOpenModule,
  onEditServerMail,
  onDeleteServerMail,
  onSelectServerAccount,
  onUpdateMailboxRole,
  onTestActiveSystemMail,
  testingActiveSystemMail,
  activeSystemMailTestResult,
  onDismissSystemMailTestResult,
  showToast,
}) => {
  const [newTabName, setNewTabName] = useState('');
  const [newTabQuery, setNewTabQuery] = useState('');

  const totalConnected = gmailAccounts.length + serverAccounts.length;

  return (
    <div className="space-y-6">
      {/* 1. Mailbox Overview & Role Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <div className="text-[11px] font-medium text-slate-500">Total Mailboxes</div>
          <div className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">
            {mailboxesOverview?.totalCount ?? totalConnected} Connected
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
            {mailboxesOverview?.generalCount ?? totalConnected} Active
          </div>
        </div>
      </div>

      {/* 2. Dedicated System Mail Section */}
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
              onClick={onTestActiveSystemMail}
              disabled={testingActiveSystemMail || !mailboxesOverview?.primarySystemMail}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-violet-300 dark:border-violet-700 hover:bg-violet-100/60 dark:hover:bg-violet-900/40 text-violet-700 dark:text-violet-300 text-xs font-semibold transition-colors disabled:opacity-40 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testingActiveSystemMail ? 'animate-spin' : ''}`} />
              <span>Test Connection</span>
            </button>

            <button
              type="button"
              onClick={onOpenSystemMailModal}
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
              onClick={onDismissSystemMailTestResult}
              className="text-xs font-bold underline cursor-pointer"
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

      {/* 3. Unified Connected Accounts Directory Card */}
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
            onClick={onOpenConnectModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0B57D0] hover:bg-blue-700 text-white text-xs font-semibold shadow-xs cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>+ Connect Mailbox</span>
          </button>
        </div>

        {totalConnected === 0 ? (
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
                        {isCurrent && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 text-[10px] font-bold">
                            Default Active
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 truncate mt-0.5">
                        {acc.email} · Google IMAP:993
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={currentRole}
                      onChange={(e) =>
                        onUpdateMailboxRole(
                          'gmail',
                          acc.id || acc.email,
                          e.target.value,
                          e.target.value === 'system' && !isPrimarySys
                        )
                      }
                      className="text-[11px] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium focus:outline-none"
                    >
                      <option value="general">📬 General Inbox</option>
                      <option value="system">🤖 System Mail</option>
                      <option value="admin">🛡️ Admin Alert</option>
                      <option value="marketing">📢 Marketing</option>
                    </select>

                    {currentRole === 'system' && !isPrimarySys && (
                      <button
                        type="button"
                        onClick={() => onUpdateMailboxRole('gmail', acc.id || acc.email, 'system', true)}
                        className="px-2 py-1 rounded-lg bg-violet-600 text-white text-[10px] font-semibold cursor-pointer"
                      >
                        Set Primary
                      </button>
                    )}

                    {!isCurrent && (
                      <button
                        type="button"
                        onClick={() => onSwitchDefaultGmail(acc.email)}
                        className="px-2.5 py-1 rounded-lg bg-[#0B57D0] text-white text-[11px] font-semibold cursor-pointer"
                      >
                        Set Default
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        onSwitchDefaultGmail(acc.email);
                        onOpenModule('gmail');
                      }}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[11px] font-semibold hover:bg-slate-50 cursor-pointer"
                    >
                      Inbox
                    </button>
                    <button
                      type="button"
                      onClick={() => onEditGmail(acc)}
                      className="p-1.5 text-slate-500 hover:text-[#0B57D0] cursor-pointer"
                      title="Edit"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteGmail(acc.id || acc.email)}
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
                        {isCurrent && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 text-[10px] font-bold">
                            Default Active
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 truncate mt-0.5">
                        {acc.email} · {acc.imapHost}:{acc.imapPort}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={currentRole}
                      onChange={(e) =>
                        onUpdateMailboxRole(
                          'server_mail',
                          acc.id,
                          e.target.value,
                          e.target.value === 'system' && !isPrimarySys
                        )
                      }
                      className="text-[11px] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium focus:outline-none"
                    >
                      <option value="general">📬 General Inbox</option>
                      <option value="system">🤖 System Mail</option>
                      <option value="admin">🛡️ Admin Alert</option>
                      <option value="marketing">📢 Marketing</option>
                    </select>

                    {currentRole === 'system' && !isPrimarySys && (
                      <button
                        type="button"
                        onClick={() => onUpdateMailboxRole('server_mail', acc.id, 'system', true)}
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
                      onClick={() => onEditServerMail(acc)}
                      className="p-1.5 text-slate-500 hover:text-[#0B57D0] cursor-pointer"
                      title="Edit"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteServerMail(acc.id)}
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

      {/* 4. Outgoing Mail Defaults & Signatures */}
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

        <form onSubmit={onSaveSystemSettings} className="space-y-4 pt-1">
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

      {/* 5. Custom Mail Navigation Tabs */}
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
  );
};
