import React, { Suspense, lazy } from 'react';
import { X } from 'lucide-react';
import { WorkspaceAuthUser } from '../../services/workspaceAuth';
import { WorkspaceModule } from './types';

const FloatingMessengerWidget = lazy(() =>
  import('../communication/FloatingMessengerWidget').then((m) => ({ default: m.FloatingMessengerWidget }))
);

export interface AppGlobalModalsProps {
  isAddTabModalOpen: boolean;
  setIsAddTabModalOpen: (val: boolean) => void;
  newTabName: string;
  setNewTabName: (val: string) => void;
  newTabQuery: string;
  setNewTabQuery: (val: string) => void;
  handleCreateCustomTab: (e: React.FormEvent) => void;
  wsUser: WorkspaceAuthUser;
  activeModule: WorkspaceModule;
  setActiveModule: (mod: WorkspaceModule) => void;
  setIsDesktopDrawerOpen: (val: boolean) => void;
  setIsMobileDrawerOpen: (val: boolean) => void;
}

export const AppGlobalModals: React.FC<AppGlobalModalsProps> = ({
  isAddTabModalOpen,
  setIsAddTabModalOpen,
  newTabName,
  setNewTabName,
  newTabQuery,
  setNewTabQuery,
  handleCreateCustomTab,
  wsUser,
  activeModule,
  setActiveModule,
  setIsDesktopDrawerOpen,
  setIsMobileDrawerOpen,
}) => {
  return (
    <>
      {/* Add Custom Tab Modal */}
      {isAddTabModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[2px] p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Add Custom Inbox Tab
              </h3>
              <button
                type="button"
                onClick={() => setIsAddTabModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateCustomTab} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Tab Name
                </label>
                <input
                  type="text"
                  required
                  value={newTabName}
                  onChange={(e) => setNewTabName(e.target.value)}
                  placeholder="e.g. Invoices, Urgent Clients"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Gmail Search Filter
                </label>
                <input
                  type="text"
                  required
                  value={newTabQuery}
                  onChange={(e) => setNewTabQuery(e.target.value)}
                  placeholder="e.g. subject:invoice OR is:important"
                  className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddTabModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#0B57D0] hover:bg-blue-700 rounded-lg"
                >
                  Create Tab
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Persistent Floating Sticky Messenger Launcher (Desktop & Mobile) */}
      <Suspense fallback={null}>
        <FloatingMessengerWidget
          currentUserId={wsUser.id}
          currentUserRole={wsUser.role}
          onNavigateToCommunication={() => {
            setActiveModule('communication');
            setIsDesktopDrawerOpen(false);
            setIsMobileDrawerOpen(false);
          }}
          isCurrentViewCommunication={activeModule === 'communication'}
        />
      </Suspense>
    </>
  );
};

