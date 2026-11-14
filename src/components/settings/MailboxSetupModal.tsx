import React from 'react';
import { Mail, Server, X } from 'lucide-react';
import { ServerMailVerifyResult } from '../../services/workspaceApi';

const SMTP_RELAY_PRESETS = [
  {
    id: 'cpanel',
    name: 'cPanel / Standard',
    imapHost: 'mail.yourdomain.com',
    imapPort: 993,
    smtpHost: 'mail.yourdomain.com',
    smtpPort: 465,
    secure: true,
  },
  {
    id: 'titan',
    name: 'Hostinger / Titan',
    imapHost: 'imap.titan.email',
    imapPort: 993,
    smtpHost: 'smtp.titan.email',
    smtpPort: 465,
    secure: true,
  },
  {
    id: 'zoho',
    name: 'Zoho Mail',
    imapHost: 'imappro.zoho.com',
    imapPort: 993,
    smtpHost: 'smtppro.zoho.com',
    smtpPort: 465,
    secure: true,
  },
  {
    id: 'outlook',
    name: 'Microsoft 365',
    imapHost: 'outlook.office365.com',
    imapPort: 993,
    smtpHost: 'smtp.office365.com',
    smtpPort: 587,
    secure: true,
  },
];

interface MailboxSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountType: 'gmail' | 'server_mail';
  setAccountType: (type: 'gmail' | 'server_mail') => void;
  // Gmail state
  gmailEditingId?: string;
  gmailLabel: string;
  setGmailLabel: (v: string) => void;
  gmailEmail: string;
  setGmailEmail: (v: string) => void;
  gmailPassword: string;
  setGmailPassword: (v: string) => void;
  isVerifyingGmail: boolean;
  isSavingGmail: boolean;
  gmailVerifyResult: ServerMailVerifyResult | null;
  onVerifyGmail: () => void;
  onSaveGmail: (e: React.FormEvent) => void;
  // Server mail state
  serverEditingId?: string;
  serverLabel: string;
  setServerLabel: (v: string) => void;
  serverEmail: string;
  setServerEmail: (v: string) => void;
  serverUsername: string;
  setServerUsername: (v: string) => void;
  serverPassword: string;
  setServerPassword: (v: string) => void;
  serverImapHost: string;
  setServerImapHost: (v: string) => void;
  serverImapPort: number;
  setServerImapPort: (v: number) => void;
  serverSmtpHost: string;
  setServerSmtpHost: (v: string) => void;
  serverSmtpPort: number;
  setServerSmtpPort: (v: number) => void;
  serverSecure: boolean;
  setServerSecure: (v: boolean) => void;
  isVerifyingServer: boolean;
  isSavingServer: boolean;
  serverVerifyResult: ServerMailVerifyResult | null;
  onVerifyServer: () => void;
  onSaveServerMail: (e: React.FormEvent) => void;
  onApplyPreset: (preset: (typeof SMTP_RELAY_PRESETS)[0]) => void;
}

export const MailboxSetupModal: React.FC<MailboxSetupModalProps> = ({
  isOpen,
  onClose,
  accountType,
  setAccountType,
  gmailEditingId,
  gmailLabel,
  setGmailLabel,
  gmailEmail,
  setGmailEmail,
  gmailPassword,
  setGmailPassword,
  isVerifyingGmail,
  isSavingGmail,
  gmailVerifyResult,
  onVerifyGmail,
  onSaveGmail,
  serverEditingId,
  serverLabel,
  setServerLabel,
  serverEmail,
  setServerEmail,
  serverUsername,
  setServerUsername,
  serverPassword,
  setServerPassword,
  serverImapHost,
  setServerImapHost,
  serverImapPort,
  setServerImapPort,
  serverSmtpHost,
  setServerSmtpHost,
  serverSmtpPort,
  setServerSmtpPort,
  serverSecure,
  setServerSecure,
  isVerifyingServer,
  isSavingServer,
  serverVerifyResult,
  onVerifyServer,
  onSaveServerMail,
  onApplyPreset,
}) => {
  if (!isOpen) return null;

  return (
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
            onClick={onClose}
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

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {accountType === 'gmail' && (
            <form onSubmit={onSaveGmail} className="space-y-4">
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
                  {gmailVerifyResult.ok
                    ? 'Gmail App Password verified successfully!'
                    : gmailVerifyResult.imapMessage || gmailVerifyResult.smtpMessage || 'Verification failed.'}
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  disabled={isVerifyingGmail}
                  onClick={onVerifyGmail}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer"
                >
                  {isVerifyingGmail ? 'Testing...' : 'Test Connection'}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingGmail}
                    className="px-4 py-1.5 rounded-xl bg-[#0B57D0] hover:bg-blue-700 text-white text-xs font-semibold shadow-xs disabled:opacity-60 cursor-pointer"
                  >
                    {isSavingGmail ? 'Saving...' : 'Save & Connect'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {accountType === 'server_mail' && (
            <form onSubmit={onSaveServerMail} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">
                  Quick Presets:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {SMTP_RELAY_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => onApplyPreset(preset)}
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    IMAP Host
                  </label>
                  <input
                    type="text"
                    required
                    value={serverImapHost}
                    onChange={(e) => setServerImapHost(e.target.value)}
                    placeholder="mail.yourdomain.com"
                    className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    IMAP Port
                  </label>
                  <input
                    type="number"
                    value={serverImapPort}
                    onChange={(e) => setServerImapPort(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    SMTP Host
                  </label>
                  <input
                    type="text"
                    required
                    value={serverSmtpHost}
                    onChange={(e) => setServerSmtpHost(e.target.value)}
                    placeholder="mail.yourdomain.com"
                    className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    SMTP Port
                  </label>
                  <input
                    type="number"
                    value={serverSmtpPort}
                    onChange={(e) => setServerSmtpPort(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={serverSecure}
                  onChange={(e) => setServerSecure(e.target.checked)}
                  className="rounded text-[#0B57D0]"
                />
                <span className="text-xs text-slate-700 dark:text-slate-300">
                  Use SSL/TLS Encryption (Port 465 / 993)
                </span>
              </label>

              {serverVerifyResult && (
                <div
                  className={`p-3 rounded-xl text-xs font-medium ${
                    serverVerifyResult.ok
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-red-50 text-red-800 border border-red-200'
                  }`}
                >
                  {serverVerifyResult.ok
                    ? 'Server connection verified!'
                    : serverVerifyResult.imapMessage || serverVerifyResult.smtpMessage || 'Verification failed.'}
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  disabled={isVerifyingServer}
                  onClick={onVerifyServer}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer"
                >
                  {isVerifyingServer ? 'Testing...' : 'Test Connection'}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingServer}
                    className="px-4 py-1.5 rounded-xl bg-[#0B57D0] hover:bg-blue-700 text-white text-xs font-semibold shadow-xs disabled:opacity-60 cursor-pointer"
                  >
                    {isSavingServer ? 'Saving...' : 'Save & Connect'}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
