import React from 'react';
import { Bot, Mail, Server, X, CheckCircle2, AlertCircle } from 'lucide-react';

interface SystemMailSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  sysType: 'server_mail' | 'gmail';
  setSysType: (t: 'server_mail' | 'gmail') => void;
  sysEmail: string;
  setSysEmail: (v: string) => void;
  sysLabel: string;
  setSysLabel: (v: string) => void;
  sysPassword: string;
  setSysPassword: (v: string) => void;
  sysSmtpHost: string;
  setSysSmtpHost: (v: string) => void;
  sysSmtpPort: number;
  setSysSmtpPort: (v: number) => void;
  sysBanner: { ok: boolean; text: string } | null;
  sysSaving: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export const SystemMailSetupModal: React.FC<SystemMailSetupModalProps> = ({
  isOpen,
  onClose,
  sysType,
  setSysType,
  sysEmail,
  setSysEmail,
  sysLabel,
  setSysLabel,
  sysPassword,
  setSysPassword,
  sysSmtpHost,
  setSysSmtpHost,
  sysSmtpPort,
  setSysSmtpPort,
  sysBanner,
  sysSaving,
  onSubmit,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs   duration-150">
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
            onClick={onClose}
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
              }}
              className={`py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
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
              }}
              className={`py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
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

          <form onSubmit={onSubmit} className="space-y-3.5">
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
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sysSaving}
                className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold shadow-xs disabled:opacity-60 transition-colors cursor-pointer"
              >
                {'Save & Activate System Mail'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
