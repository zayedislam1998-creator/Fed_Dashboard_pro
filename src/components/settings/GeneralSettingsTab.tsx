import React from 'react';
import { Sliders, Globe } from 'lucide-react';
import { WorkspaceSystemSettingsClient } from '../../services/workspaceApi';

interface GeneralSettingsTabProps {
  sysSettings: WorkspaceSystemSettingsClient;
  setSysSettings: React.Dispatch<React.SetStateAction<WorkspaceSystemSettingsClient>>;
  onSubmit: (e: React.FormEvent) => void;
  isSaving: boolean;
}

export const GeneralSettingsTab: React.FC<GeneralSettingsTabProps> = ({
  sysSettings,
  setSysSettings,
  onSubmit,
  isSaving,
}) => {
  return (
    <form onSubmit={onSubmit} className="space-y-5">
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
            disabled={isSaving}
            className="px-5 py-2 rounded-xl bg-[#0B57D0] hover:bg-blue-700 text-white text-xs font-semibold shadow-xs disabled:opacity-60 cursor-pointer"
          >
            {'Save General Settings'}
          </button>
        </div>
      </div>
    </form>
  );
};
