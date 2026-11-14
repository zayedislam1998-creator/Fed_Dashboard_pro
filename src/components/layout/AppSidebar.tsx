import React from 'react';
import {
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  LayoutDashboard,
  ShieldCheck,
  CheckSquare,
  Briefcase,
  Users,
  Megaphone,
  MessagesSquare,
  UserCheck,
  Settings,
  Mail,
  Server,
  Layers,
  Blocks,
  FileText,
  ClipboardList,
  MessageSquare,
  Video,
  HardDrive,
  Presentation,
  Table,
  Calendar,
  Receipt,
  Clock,
  BookOpen,
  Zap,
  PenSquare,
  Plus,
  Trash2,
  Inbox,
  Star,
  Send,
} from 'lucide-react';
import { WorkspaceModule } from './types';
import { CustomMailTab, ServerMailAccount } from '../../services/workspaceApi';
import type { ServerMailFolder } from '../mail/ServerMailView';
import type { SettingsSubTab } from '../settings/SettingsView';
import type { CmhTasksSubTab } from '../cmh/CmhTasksView';
import type { CmhProjectsSubTab } from '../cmh/CmhProjectsView';
import type { CmhFormBuilderSubTab } from '../cmh/CmhFormBuilderView';
import type { TeamsSubTab } from '../team/TeamsView';
import type { PostsNoticesSubTab } from '../posts/PostsNoticesView';
import type { FileManagerSubTab } from '../filemanager/FileManagerView';
import type { DocsSubTab } from '../docs/DocsView';
import type { SlidesSubTab } from '../slides/SlidesView';
import type { FormsSubTab } from '../forms/FormsView';
import type { MeetSubTab } from '../meetings/MeetView';
import type { SheetsSubTab } from '../sheets/SheetsView';
import type { CalendarSubTab } from '../calendar/CalendarView';
import type { FinanceSubTab } from '../finance/FinanceView';
import type { CrmSubTab } from '../crm/CrmTicketsView';
import type { HrSubTab } from '../hr/HrManagementView';
import type { ChatSubTab } from '../team/TeamChatView';
import type { WikiSubTab } from '../wiki/WikiKnowledgeView';
import type { AutomationSubTab } from '../automation/AutomationEngineView';

export interface NavigationContentProps {
  isMobile?: boolean;
  activeModule: WorkspaceModule;
  setActiveModule: (mod: WorkspaceModule) => void;
  isCmhSectionExpanded: boolean;
  setIsCmhSectionExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  isAppsSectionExpanded: boolean;
  setIsAppsSectionExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  isMoreToolsExpanded: boolean;
  setIsMoreToolsExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  activeServerAccount: ServerMailAccount | null;
  activeServerFolder: ServerMailFolder;
  setActiveServerFolder: (f: ServerMailFolder) => void;
  activeFolderId: string;
  setActiveFolderId: (f: string) => void;
  activeTabId: string;
  setActiveTabId: (t: string) => void;
  customTabs: CustomMailTab[];
  setIsAddTabModalOpen: (val: boolean) => void;
  handleRemoveCustomTab: (id: string) => void;
  setServerComposeTrigger: React.Dispatch<React.SetStateAction<number>>;
  setComposeTriggerCount: React.Dispatch<React.SetStateAction<number>>;
  setIsMobileDrawerOpen: (val: boolean) => void;
  setIsDesktopDrawerOpen: (val: boolean | ((prev: boolean) => boolean)) => void;
  setViewingProfileMemberId: (id: string | null) => void;
  setCmhTasksSubTab: (tab: CmhTasksSubTab) => void;
  setCmhProjectsSubTab: (tab: CmhProjectsSubTab) => void;
  setCmhFormsSubTab: (tab: CmhFormBuilderSubTab) => void;
  setTeamsSubTab: (tab: TeamsSubTab) => void;
  setPostsSubTab: (tab: PostsNoticesSubTab) => void;
  setFilesSubTab: (tab: FileManagerSubTab) => void;
  setDocsSubTab: (tab: DocsSubTab) => void;
  setSlidesSubTab: (tab: SlidesSubTab) => void;
  setFormsSubTab: (tab: FormsSubTab) => void;
  setMeetSubTab: (tab: MeetSubTab) => void;
  setSheetsSubTab: (tab: SheetsSubTab) => void;
  setCalendarSubTab: (tab: CalendarSubTab) => void;
  setFinanceSubTab: (tab: FinanceSubTab) => void;
  setCrmSubTab: (tab: CrmSubTab) => void;
  setHrSubTab: (tab: HrSubTab) => void;
  setChatSubTab: (tab: ChatSubTab) => void;
  setWikiSubTab: (tab: WikiSubTab) => void;
  setAutomationsSubTab: (tab: AutomationSubTab) => void;
  setSettingsSubTab: (tab: SettingsSubTab) => void;
}

const GMAIL_FOLDERS = [
  { id: 'inbox', label: 'Inbox', icon: Inbox },
  { id: 'starred', label: 'Starred', icon: Star },
  { id: 'sent', label: 'Sent', icon: Send },
  { id: 'drafts', label: 'Drafts', icon: FileText },
  { id: 'all', label: 'All Mail', icon: Mail },
];

const SERVER_MAIL_FOLDERS: Array<{
  id: ServerMailFolder;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'inbox', label: 'Inbox', icon: Inbox },
  { id: 'starred', label: 'Starred', icon: Star },
  { id: 'sent', label: 'Sent', icon: Send },
  { id: 'drafts', label: 'Drafts', icon: FileText },
  { id: 'all', label: 'All Mail', icon: Mail },
];

export const NavigationContent: React.FC<NavigationContentProps> = ({
  isMobile = false,
  activeModule,
  setActiveModule,
  isCmhSectionExpanded,
  setIsCmhSectionExpanded,
  isAppsSectionExpanded,
  setIsAppsSectionExpanded,
  isMoreToolsExpanded,
  setIsMoreToolsExpanded,
  activeServerAccount,
  activeServerFolder,
  setActiveServerFolder,
  activeFolderId,
  setActiveFolderId,
  activeTabId,
  setActiveTabId,
  customTabs,
  setIsAddTabModalOpen,
  handleRemoveCustomTab,
  setServerComposeTrigger,
  setComposeTriggerCount,
  setIsMobileDrawerOpen,
  setIsDesktopDrawerOpen,
  setViewingProfileMemberId,
  setCmhTasksSubTab,
  setCmhProjectsSubTab,
  setCmhFormsSubTab,
  setTeamsSubTab,
  setPostsSubTab,
  setFilesSubTab,
  setDocsSubTab,
  setSlidesSubTab,
  setFormsSubTab,
  setMeetSubTab,
  setSheetsSubTab,
  setCalendarSubTab,
  setFinanceSubTab,
  setCrmSubTab,
  setHrSubTab,
  setChatSubTab,
  setWikiSubTab,
  setAutomationsSubTab,
  setSettingsSubTab,
}) => {
  const isMailModule =
    activeModule === 'gmail' || activeModule === 'server_mail' || activeModule === 'bulk';

  return (
    <div className="flex flex-col h-full select-none py-3 px-2.5 space-y-4">
      {/* SECTION 1: CEO EXECUTIVE (Always at the very top) */}
      <div>
        <button
          type="button"
          onClick={() => setIsCmhSectionExpanded((prev) => !prev)}
          className={`w-full flex items-center justify-between px-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 rounded-xl ${
            isMobile ? 'min-h-[44px] py-2.5 active:bg-slate-200/60 dark:active:bg-slate-800/60' : 'py-1.5'
          }`}
        >
          <span className="flex items-center gap-1.5">
            {isCmhSectionExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-[#0B57D0]" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-[#0B57D0]" />
            )}
            <span>CEO Executive</span>
          </span>
        </button>

        {isCmhSectionExpanded && (
          <div className="mt-1 space-y-0.5">
            {(
              [
                { id: 'main_feed', label: 'Main', icon: LayoutGrid, color: 'text-[#0B57D0]' },
                { id: 'overview', label: 'Overview', icon: LayoutDashboard, color: 'text-[#0B57D0]' },
                { id: 'admin_panel', label: 'Admin Access & Users', icon: ShieldCheck, color: 'text-[#0B57D0]' },
                { id: 'cmh_tasks', label: 'Tasks', icon: CheckSquare, color: 'text-[#0B57D0]' },
                { id: 'cmh_projects', label: 'Projects', icon: Briefcase, color: 'text-[#7C3AED]' },
                { id: 'teams', label: 'Teams', icon: Users, color: 'text-[#059669]' },
                { id: 'posts', label: 'Posts & Notices', icon: Megaphone, color: 'text-[#D97706]' },
                { id: 'communication', label: 'Communication', icon: MessagesSquare, color: 'text-emerald-600' },
                { id: 'profile', label: 'Profile', icon: UserCheck, color: 'text-[#0B57D0]' },
                { id: 'settings', label: 'Settings', icon: Settings, color: 'text-[#0B57D0]' },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              const isSelected = activeModule === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveModule(item.id);
                    if (item.id === 'cmh_tasks') setCmhTasksSubTab('all_tasks');
                    if (item.id === 'cmh_projects') setCmhProjectsSubTab('all_projects');
                    if (item.id === 'teams') setTeamsSubTab('all_members');
                    if (item.id === 'posts') setPostsSubTab('feed');
                    if (item.id === 'profile') {
                      setViewingProfileMemberId(null);
                      setIsDesktopDrawerOpen(false);
                    }
                    if (item.id === 'settings') setSettingsSubTab('accounts');
                    if (isMobile) setIsMobileDrawerOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 rounded-xl text-xs sm:text-sm transition-all whitespace-nowrap ${
                    isMobile ? 'min-h-[44px] py-2.5' : 'py-2'
                  } ${
                    isSelected
                      ? 'bg-[#D3E3FD] dark:bg-blue-950/80 text-[#041E49] dark:text-blue-200 font-bold shadow-2xs'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 font-medium'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${item.color}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* TOUCH-FRIENDLY SECTION DIVIDER */}
      <div
        role="separator"
        aria-orientation="horizontal"
        className={isMobile ? 'py-2.5 px-2 select-none' : 'pt-2 pb-0.5'}
      >
        <div className="flex items-center gap-2.5">
          <div className="h-px flex-1 bg-slate-200/90 dark:bg-slate-800" />
          {isMobile && (
            <span
              className="h-1 w-9 rounded-full bg-slate-300/90 dark:bg-slate-700"
              aria-hidden="true"
            />
          )}
          <div className="h-px flex-1 bg-slate-200/90 dark:bg-slate-800" />
        </div>
      </div>

      {/* SECTION 2: WORKSPACE, CHANNELS & ENGINES */}
      <div>
        <button
          type="button"
          onClick={() => setIsAppsSectionExpanded((prev) => !prev)}
          className={`w-full flex items-center justify-between px-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 rounded-xl ${
            isMobile ? 'min-h-[44px] py-2.5 active:bg-slate-200/60 dark:active:bg-slate-800/60' : 'py-1.5'
          }`}
        >
          <span className="flex items-center gap-1.5">
            {isAppsSectionExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-indigo-600" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-indigo-600" />
            )}
            <span>Workspace & Channels</span>
          </span>
        </button>

        {isAppsSectionExpanded && (
          <div className="mt-1 space-y-0.5">
            {(
              [
                { id: 'gmail', label: 'Gmail', icon: Mail, color: 'text-[#EA4335]' },
                { id: 'server_mail', label: 'Server Mail (Domain)', icon: Server, color: 'text-[#0B57D0]' },
              ] as const
            ).map((app) => {
              const Icon = app.icon;
              const isSelected = activeModule === app.id;
              return (
                <button
                  key={app.id}
                  type="button"
                  onClick={() => {
                    setActiveModule(app.id);
                    if (app.id === 'gmail') setActiveFolderId('inbox');
                    if (app.id === 'server_mail') setActiveServerFolder('inbox');
                    if (isMobile) setIsMobileDrawerOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 rounded-xl text-xs sm:text-sm transition-all whitespace-nowrap ${
                    isMobile ? 'min-h-[44px] py-2.5' : 'py-2'
                  } ${
                    isSelected
                      ? 'bg-[#D3E3FD] dark:bg-blue-950/80 text-[#041E49] dark:text-blue-200 font-bold shadow-2xs'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 font-medium'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${app.color}`} />
                  <span>{app.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 3: MORE TOOLS */}
      <div>
        <button
          type="button"
          onClick={() => setIsMoreToolsExpanded((prev) => !prev)}
          className={`w-full flex items-center justify-between px-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 rounded-xl ${
            isMobile ? 'min-h-[44px] py-2.5 active:bg-slate-200/60 dark:active:bg-slate-800/60' : 'py-1.5'
          }`}
        >
          <span className="flex items-center gap-1.5">
            {isMoreToolsExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
            )}
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span>More Tools</span>
          </span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-slate-700">
            15
          </span>
        </button>

        {isMoreToolsExpanded && (
          <div className="mt-1 space-y-0.5">
            {(
              [
                { id: 'cmh_forms', label: 'Form Builder', icon: Blocks, color: 'text-[#0B57D0]' },
                { id: 'docs', label: 'Docs', icon: FileText, color: 'text-[#2684FC]' },
                { id: 'forms', label: 'Forms', icon: ClipboardList, color: 'text-[#673AB7]' },
                { id: 'chat', label: 'Team Chat & Channels', icon: MessageSquare, color: 'text-[#2563EB]' },
                { id: 'bulk', label: 'Bulk Mail Studio', icon: Layers, color: 'text-[#0B57D0]' },
                { id: 'meet', label: 'Video Meet', icon: Video, color: 'text-[#00897B]' },
                { id: 'files', label: 'File Manager', icon: HardDrive, color: 'text-[#0284C7]' },
                { id: 'slides', label: 'Slides', icon: Presentation, color: 'text-[#F59E0B]' },
                { id: 'sheets', label: 'Sheets & Data Grid', icon: Table, color: 'text-[#059669]' },
                { id: 'calendar', label: 'Calendar & Schedule', icon: Calendar, color: 'text-[#2563EB]' },
                { id: 'finance', label: 'Finance & Invoices', icon: Receipt, color: 'text-[#4F46E5]' },
                { id: 'crm', label: 'CRM & Support Tickets', icon: UserCheck, color: 'text-[#0284C7]' },
                { id: 'hr', label: 'HR, Attendance & Payroll', icon: Clock, color: 'text-[#0D9488]' },
                { id: 'wiki', label: 'Knowledge Base & SOPs', icon: BookOpen, color: 'text-[#D97706]' },
                { id: 'automations', label: 'Workflow Automations', icon: Zap, color: 'text-[#7C3AED]' },
              ] as const
            ).map((app) => {
              const Icon = app.icon;
              const isSelected = activeModule === app.id;
              return (
                <button
                  key={app.id}
                  type="button"
                  onClick={() => {
                    setActiveModule(app.id);
                    if (app.id === 'cmh_forms') setCmhFormsSubTab('all_forms');
                    if (app.id === 'docs') setDocsSubTab('all_docs');
                    if (app.id === 'forms') setFormsSubTab('all_forms');
                    if (app.id === 'files') setFilesSubTab('all_files');
                    if (app.id === 'slides') setSlidesSubTab('all_slides');
                    if (app.id === 'sheets') setSheetsSubTab('all_sheets');
                    if (app.id === 'calendar') setCalendarSubTab('agenda');
                    if (app.id === 'finance') setFinanceSubTab('invoices');
                    if (app.id === 'crm') setCrmSubTab('leads');
                    if (app.id === 'hr') setHrSubTab('attendance');
                    if (app.id === 'chat') setChatSubTab('channels');
                    if (app.id === 'wiki') setWikiSubTab('articles');
                    if (app.id === 'automations') setAutomationsSubTab('rules');
                    if (app.id === 'meet') setMeetSubTab('all_meetings');
                    if (isMobile) setIsMobileDrawerOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 rounded-xl text-xs sm:text-sm transition-all whitespace-nowrap ${
                    isMobile ? 'min-h-[44px] py-2.5' : 'py-2'
                  } ${
                    isSelected
                      ? 'bg-[#D3E3FD] dark:bg-blue-950/80 text-[#041E49] dark:text-blue-200 font-bold shadow-2xs'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 font-medium'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${app.color}`} />
                  <span>{app.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 4: CONTEXTUAL MAIL FOLDERS & CUSTOM TABS */}
      {isMailModule && (
        <>
          <div
            role="separator"
            aria-orientation="horizontal"
            className={isMobile ? 'py-2 px-2 select-none' : 'pt-2 pb-0.5'}
          >
            <div className="h-px bg-slate-200/90 dark:bg-slate-800" />
          </div>
          <div className="space-y-2">
            <div className="px-2">
              <button
                type="button"
                onClick={() => {
                  if (activeModule === 'server_mail') {
                    setServerComposeTrigger((c) => c + 1);
                  } else {
                    setActiveModule('gmail');
                    setComposeTriggerCount((c) => c + 1);
                  }
                  if (isMobile) setIsMobileDrawerOpen(false);
                }}
                className="flex items-center justify-center gap-2.5 w-full px-4 py-2.5 rounded-xl bg-[#C2E7FF] hover:shadow-xs text-[#001D35] font-bold text-xs transition-all whitespace-nowrap"
              >
                <PenSquare className="w-4 h-4 shrink-0" />
                <span>Compose Mail</span>
              </button>
            </div>

            {activeModule === 'server_mail' ? (
              <div className="space-y-0.5">
                <div className="px-3.5 py-1 text-[11px] font-bold text-slate-400 truncate">
                  Server Mail {activeServerAccount ? `Â· ${activeServerAccount.email}` : ''}
                </div>
                {SERVER_MAIL_FOLDERS.map((folder) => {
                  const Icon = folder.icon;
                  const isSelected = activeServerFolder === folder.id;
                  return (
                    <button
                      key={folder.id}
                      type="button"
                      onClick={() => {
                        setActiveServerFolder(folder.id);
                        if (isMobile) setIsMobileDrawerOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3.5 py-1.5 rounded-xl text-xs transition-colors whitespace-nowrap ${
                        isSelected
                          ? 'bg-[#D3E3FD] dark:bg-blue-950 text-[#041E49] dark:text-blue-200 font-bold'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 font-medium'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span>{folder.label}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-0.5">
                <div className="px-3.5 py-1 text-[11px] font-bold text-slate-400">
                  Gmail Folders
                </div>
                {GMAIL_FOLDERS.map((folder) => {
                  const Icon = folder.icon;
                  const isSelected = activeModule === 'gmail' && activeFolderId === folder.id;
                  return (
                    <button
                      key={folder.id}
                      type="button"
                      onClick={() => {
                        setActiveModule('gmail');
                        setActiveFolderId(folder.id);
                        if (isMobile) setIsMobileDrawerOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3.5 py-1.5 rounded-xl text-xs transition-colors whitespace-nowrap ${
                        isSelected
                          ? 'bg-[#D3E3FD] dark:bg-blue-950 text-[#041E49] dark:text-blue-200 font-bold'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 font-medium'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span>{folder.label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Custom Mail Tabs */}
            <div className="pt-1">
              <div className="flex items-center justify-between px-3.5 py-1 text-[11px] font-bold text-slate-400">
                <span>Custom Inbox Tabs</span>
                <button
                  type="button"
                  onClick={() => setIsAddTabModalOpen(true)}
                  className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                  title="Add new custom tab"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              {customTabs.map((tab) => {
                const isSelected =
                  activeModule === 'gmail' &&
                  activeFolderId === 'inbox' &&
                  activeTabId === tab.id;
                return (
                  <div
                    key={tab.id}
                    className={`group flex items-center justify-between px-3.5 py-1.5 rounded-xl text-xs transition-colors ${
                      isSelected
                        ? 'bg-[#D3E3FD] dark:bg-blue-950 text-[#041E49] dark:text-blue-200 font-bold'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 font-medium'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setActiveModule('gmail');
                        setActiveFolderId('inbox');
                        setActiveTabId(tab.id);
                        if (isMobile) setIsMobileDrawerOpen(false);
                      }}
                      className="flex-1 text-left truncate"
                    >
                      {tab.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveCustomTab(tab.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-600 transition-opacity"
                      title="Delete custom tab"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export interface AppSidebarProps extends NavigationContentProps {
  isDesktopDrawerOpen: boolean;
}

export const AppSidebar: React.FC<AppSidebarProps> = (props) => {
  if (!props.isDesktopDrawerOpen) return null;

  return (
    <aside className="hidden md:block w-60 shrink-0 overflow-y-auto">
      <NavigationContent {...props} isMobile={false} />
    </aside>
  );
};



