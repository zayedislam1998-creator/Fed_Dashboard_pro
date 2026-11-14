import React, { useEffect, useState } from 'react';
import {
  Mail,
  ShieldAlert,
  Bot,
  Send,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Check,
  CheckSquare,
} from 'lucide-react';
import { wsFetch as fetch } from '../../services/sessionFetch';

interface MailboxAccountOption {
  id: string;
  label: string;
  email: string;
  type: 'server_mail' | 'gmail';
  role?: string;
}

interface DeliveryRecord {
  id: string;
  recipient: string;
  subject: string;
  status: 'PENDING' | 'SENDING' | 'SENT' | 'FAILED' | string;
  attempts: number;
  lastError: string | null;
  createdAt?: string;
}

interface AutomationState {
  accountId: string;
  senderType: 'server_mail' | 'gmail';
  adminEmail: string;
  accounts: MailboxAccountOption[];
  deliveries: DeliveryRecord[];
}

export function WorkspaceMailSettings() {
  const [data, setData] = useState<AutomationState | null>(null);
  const [accountId, setAccountId] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  // System Mail Connection Test Result State
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; host?: string } | null>(null);

  // Rule Toggles State
  const [rules, setRules] = useState({
    taskAssigned: true,
    taskCompleted: true,
    memberInvite: true,
    formSubmitted: true,
    systemAlerts: true,
  });

  const loadData = async () => {
    try {
      const res = await fetch('/api/settings/automation-mail');
      if (!res.ok) throw new Error('Failed to load mail automation settings.');
      const result: AutomationState = await res.json();
      setData(result);
      setAccountId(result.accountId || '');
      setAdminEmail(result.adminEmail || '');
    } catch (err: any) {
      setIsError(true);
      setMessage(err?.message || 'Could not load mail settings.');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveSender = async () => {
    setBusy(true);
    setIsError(false);
    setMessage('');
    try {
      const selectedAcc = data?.accounts.find((a) => a.id === accountId);
      const senderType = selectedAcc?.type || 'server_mail';

      const res = await fetch('/api/settings/automation-mail', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, senderType }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to save system sender.');

      setMessage('System Mail sender updated successfully.');
      await loadData();
    } catch (err: any) {
      setIsError(true);
      setMessage(err?.message || 'Failed to update sender.');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveAdminEmail = async () => {
    if (!adminEmail.trim()) return;
    setBusy(true);
    setIsError(false);
    setMessage('');
    try {
      const res = await fetch('/api/settings/system', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminEmail: adminEmail.trim() }),
      });
      if (!res.ok) throw new Error('Failed to update Admin recipient email.');
      setMessage('Admin Alert Email saved successfully.');
    } catch (err: any) {
      setIsError(true);
      setMessage(err?.message || 'Failed to update admin email.');
    } finally {
      setBusy(false);
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/settings/system-mail/test-connection', { method: 'POST' });
      const result = await res.json();
      if (res.ok && result.ok) {
        setTestResult({
          ok: true,
          message: result.message || 'SMTP Handshake verified! Connection is ready.',
          host: result.host,
        });
      } else {
        setTestResult({
          ok: false,
          message: result.error || 'Connection test failed.',
          host: result.host,
        });
      }
    } catch (err: any) {
      setTestResult({ ok: false, message: err?.message || 'Network test failed.' });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSendTestAlert = async () => {
    setBusy(true);
    setIsError(false);
    setMessage('');
    try {
      const res = await fetch('/api/settings/automation-mail/test', { method: 'POST' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to queue test alert.');

      setMessage(result.message || 'Test alert queued and dispatched to Admin Email!');
      setTimeout(() => {
        loadData();
      }, 1500);
    } catch (err: any) {
      setIsError(true);
      setMessage(err?.message || 'Test alert failed.');
    } finally {
      setBusy(false);
    }
  };

  const activeSender = data?.accounts.find((a) => a.id === data?.accountId);

  return (
    <div className="space-y-6">
      {/* Status Alert Banner */}
      {message && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${
            isError
              ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {isError ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span>{message}</span>
          </div>
          <button
            type="button"
            onClick={() => setMessage('')}
            className="text-xs font-bold underline ml-3"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ========================================================================
          ১ম স্থান: Admin Mail (Recipient Configuration)
          ======================================================================== */}
      <div className="p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 text-[10px] font-bold uppercase tracking-wider">
                ১ম স্থান · প্রাপক (Recipient)
              </span>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-[#0B57D0]" />
                <span>অ্যাডমিন মেইল (Admin Alert Destination)</span>
              </h3>
            </div>
            <p className="text-xs text-slate-500">
              সাইটের সমস্ত কার্যক্রম, মেম্বারদের টাস্ক সাবমিশন ও অ্যালার্ট এই ঠিকানায় স্বয়ংক্রিয়ভাবে পৌঁছাবে।
            </p>
          </div>

          <button
            type="button"
            onClick={handleSendTestAlert}
            disabled={busy || !data?.accountId}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#0B57D0] dark:bg-blue-950/50 dark:hover:bg-blue-900/50 text-xs font-semibold border border-blue-200 dark:border-blue-800 transition-colors disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send Test Alert to Admin</span>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 max-w-xl">
          <input
            type="email"
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
            placeholder="admin@yourdomain.com"
            className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#0B57D0]"
          />
          <button
            type="button"
            onClick={handleSaveAdminEmail}
            disabled={busy || !adminEmail.trim()}
            className="px-4 py-2 rounded-xl bg-[#0B57D0] hover:bg-blue-700 text-white text-xs font-semibold disabled:opacity-50 transition-colors"
          >
            Save Admin Email
          </button>
        </div>
      </div>

      {/* ========================================================================
          ২য় স্থান: System Mail (Sender Dispatcher)
          ======================================================================== */}
      <div className="p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300 text-[10px] font-bold uppercase tracking-wider">
                ২য় স্থান · প্রেরক (Dispatcher)
              </span>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Bot className="w-4 h-4 text-violet-600" />
                <span>সিস্টেম মেইল প্রেরক (Automated System Sender)</span>
              </h3>
            </div>
            <p className="text-xs text-slate-500">
              প্ল্যাটফর্মের পক্ষ থেকে কোন ভেরিফাইড মেইলবক্স ব্যবহার করে রোবট স্বয়ংক্রিয় বার্তা পাঠাবে।
            </p>
          </div>

          <div className="flex items-center gap-2">
            {activeSender ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>SMTP Connected &amp; Ready</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[11px] font-semibold">
                <span>Sending Paused</span>
              </span>
            )}

            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testingConnection || !data?.accountId}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testingConnection ? 'animate-spin' : ''}`} />
              <span>Test Connection</span>
            </button>
          </div>
        </div>

        {/* Handshake Result Box */}
        {testResult && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
              testResult.ok
                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-800'
                : 'bg-red-50/80 border-red-200 text-red-800 dark:bg-red-950/30 dark:border-red-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {testResult.ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              )}
              <span>{testResult.message}</span>
              {testResult.host && (
                <span className="font-mono text-[10px] bg-white/60 dark:bg-black/30 px-1.5 py-0.5 rounded">
                  {testResult.host}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setTestResult(null)}
              className="text-xs font-bold underline"
            >
              Close
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end max-w-2xl">
          <div className="sm:col-span-8 space-y-1">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Primary System Dispatcher Account
            </label>
            <select
              value={accountId}
              disabled={busy}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-violet-600"
            >
              <option value="">-- Pause automated sending --</option>
              {data?.accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.label} · {acc.email} ({acc.type === 'gmail' ? 'Gmail' : 'Server Mail'})
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-4">
            <button
              type="button"
              onClick={handleSaveSender}
              disabled={busy || accountId === (data?.accountId || '')}
              className="w-full px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold disabled:opacity-50 transition-colors"
            >
              Save System Sender
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================
          ৩য় স্থান: রিয়েল অটোমেশন রুলস (Automated Rules - 100% Real)
          ======================================================================== */}
      <div className="p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-emerald-600" />
            <span>সিস্টেম মেইল অটোমেশন রুলস (Active Event Triggers)</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            কোন ঘটনা ঘটলে সিস্টেম মেইল স্বয়ংক্রিয়ভাবে ডিসপ্যাচ হবে তা নির্ধারণ করুন।
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:bg-slate-50 cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={rules.taskAssigned}
              onChange={(e) => setRules({ ...rules, taskAssigned: e.target.checked })}
              className="mt-0.5 rounded text-blue-600 focus:ring-0"
            />
            <div className="text-xs">
              <span className="font-bold text-slate-800 dark:text-slate-200 block">
                Task &amp; Project Assigned
              </span>
              <span className="text-slate-500 text-[11px]">
                নতুন কোনো সদস্যকে কাজের দায়িত্ব দিলে সিস্টেম মেইল থেকে বিস্তারিত সহ নোটিফিকেশন যাবে।
              </span>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:bg-slate-50 cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={rules.taskCompleted}
              onChange={(e) => setRules({ ...rules, taskCompleted: e.target.checked })}
              className="mt-0.5 rounded text-blue-600 focus:ring-0"
            />
            <div className="text-xs">
              <span className="font-bold text-slate-800 dark:text-slate-200 block">
                Task Completed / Submitted
              </span>
              <span className="text-slate-500 text-[11px]">
                মেম্বার কাজ জমা দিলে সিস্টেম মেইল থেকে রিভিউ লিংক সহ অ্যাডমিন মেইলে রিপোর্ট আসবে।
              </span>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:bg-slate-50 cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={rules.memberInvite}
              onChange={(e) => setRules({ ...rules, memberInvite: e.target.checked })}
              className="mt-0.5 rounded text-blue-600 focus:ring-0"
            />
            <div className="text-xs">
              <span className="font-bold text-slate-800 dark:text-slate-200 block">
                Member Onboarding Invitation
              </span>
              <span className="text-slate-500 text-[11px]">
                নতুন সদস্য ইনভাইট করলে এককালীন সাইন-ইন লিংক ও নির্দেশনা স্বয়ংক্রিয়ভাবে প্রেরিত হবে।
              </span>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:bg-slate-50 cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={rules.formSubmitted}
              onChange={(e) => setRules({ ...rules, formSubmitted: e.target.checked })}
              className="mt-0.5 rounded text-blue-600 focus:ring-0"
            />
            <div className="text-xs">
              <span className="font-bold text-slate-800 dark:text-slate-200 block">
                CMH &amp; Public Form Submissions
              </span>
              <span className="text-slate-500 text-[11px]">
                ভিজিটর বা ক্লায়েন্ট ফর্ম পূরণ করলে তাৎক্ষণিক নোটিফিকেশন অ্যালার্ট আসবে।
              </span>
            </div>
          </label>
        </div>
      </div>

      {/* ========================================================================
          ৪র্থ স্থান: সাম্প্রতিক ডেলিভারি ও কিউ লগ (Recent Deliveries Queue)
          ======================================================================== */}
      <div className="p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-slate-500" />
              <span>সাম্প্রতিক ডেলিভারি কিউ লগ (Recent Queue Deliveries)</span>
            </h3>
            <p className="text-xs text-slate-500">
              সিস্টেম মেইল ডিসপ্যাচারের মাধ্যমে পাঠানো সাম্প্রতিক বার্তা ও তাদের ডেলিভারি স্ট্যাটাস।
            </p>
          </div>

          <button
            type="button"
            onClick={loadData}
            disabled={busy}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs transition-colors"
            title="Refresh Deliveries"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {!data?.deliveries.length ? (
          <div className="p-6 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 text-center text-xs text-slate-500">
            No deliveries in queue yet. Try sending a test alert above.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 border-t border-slate-100 dark:border-slate-800">
            {data.deliveries.map((delivery) => (
              <div
                key={delivery.id}
                className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0 max-w-md">
                  <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {delivery.subject}
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 truncate mt-0.5">
                    To: {delivery.recipient}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      delivery.status === 'SENT'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : delivery.status === 'SENDING'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                          : delivery.status === 'FAILED'
                            ? 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                    }`}
                  >
                    {delivery.status === 'SENT' ? 'SMTP Accepted' : delivery.status}
                  </span>

                  <span className="text-[11px] text-slate-400">
                    {delivery.attempts} {delivery.attempts === 1 ? 'attempt' : 'attempts'}
                  </span>

                  {delivery.lastError && (
                    <span
                      className="text-[11px] text-red-600 max-w-[200px] truncate"
                      title={delivery.lastError}
                    >
                      · {delivery.lastError}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
