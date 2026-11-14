import React from 'react';
import { BellRing } from 'lucide-react';
import { WorkspaceMailSettings } from './WorkspaceMailSettings';
import { CmhNotificationRules, WorkspaceSystemSettingsClient } from '../../services/workspaceApi';

interface NotificationRulesTabProps {
  cmhRules: CmhNotificationRules;
  setCmhRules: React.Dispatch<React.SetStateAction<CmhNotificationRules>>;
  sysSettings: WorkspaceSystemSettingsClient;
  setSysSettings: React.Dispatch<React.SetStateAction<WorkspaceSystemSettingsClient>>;
  onSubmit: (e: React.FormEvent) => void;
  isSaving: boolean;
}

export const NotificationRulesTab: React.FC<NotificationRulesTabProps> = ({
  cmhRules,
  setCmhRules,
  sysSettings,
  setSysSettings,
  onSubmit,
  isSaving,
}) => {
  return (
    <div className="space-y-6">
      <WorkspaceMailSettings />

      <div className="p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <BellRing className="w-4 h-4 text-[#0B57D0]" />
            <span>Workspace Activity Notification Rules</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Control automated activity notifications and admin alert triggers.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 pt-1">
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
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-[#0B57D0] hover:bg-blue-700 text-white text-xs font-semibold shadow-xs disabled:opacity-60 cursor-pointer"
            >
              {isSaving ? 'Saving...' : 'Save Notification Rules'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
