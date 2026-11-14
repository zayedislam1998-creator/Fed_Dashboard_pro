import React, { useState, useRef, useEffect } from 'react';
import {
  Menu,
  Search,
  Mail,
  Server,
  Layers,
  FileText,
  ClipboardList,
  Video,
  Plus,
  ChevronDown,
  LayoutGrid,
  Settings,
  X,
  LogOut,
  Check,
  UserPlus,
  Bell,
  Users,
  Megaphone,
  HardDrive,
  CheckSquare,
  Briefcase,
  Blocks,
  Presentation,
  ShieldCheck,
  Table,
  Calendar,
  Receipt,
  UserCheck,
  Clock,
  MessageSquare,
  MessagesSquare,
  BookOpen,
  Zap,
  Sun,
  Moon,
  Palette,
  LayoutDashboard,
} from 'lucide-react';
import { WorkspaceModule } from './types';
import { moduleMeta } from './moduleMeta';
import { ConnectedGmailAccount } from '../../services/auth';
import {
  ServerMailAccount,
  WorkspaceNotification,
  clearAllNotifications,
  markNotificationsRead,
} from '../../services/workspaceApi';
import { WorkspaceAuthUser } from '../../services/workspaceAuth';
import type { ServerMailFolder } from '../mail/ServerMailView';
import type { SettingsSubTab } from '../settings/SettingsView';
import type { CmhTasksSubTab } from '../cmh/CmhTasksView';
import type { CmhProjectsSubTab } from '../cmh/CmhProjectsView';
import type { CmhFormBuilderSubTab } from '../cmh/CmhFormBuilderView';
import type { TeamsSubTab } from '../team/TeamsView';
import type { PostsNoticesSubTab } from '../posts/PostsNoticesView';
import type { FinanceSubTab } from '../finance/FinanceView';

export interface AppHeaderProps {
  activeModule: WorkspaceModule;
  setActiveModule: (mod: WorkspaceModule) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  handleToggleHamburger: () => void;
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
  accentTheme: 'blue' | 'violet' | 'emerald' | 'rose';
  setAccentTheme: (val: 'blue' | 'violet' | 'emerald' | 'rose') => void;
  notifications: WorkspaceNotification[];
  setNotifications: React.Dispatch<React.SetStateAction<WorkspaceNotification[]>>;
  onOpenNotificationItem: (notif: WorkspaceNotification) => void;
  wsUser: WorkspaceAuthUser;
  handleWorkspaceLogout: () => void;
  gmailAccounts: ConnectedGmailAccount[];
  activeGmail: string | null;
  handleSwitchGmail: (email: string) => void;
  serverAccounts: ServerMailAccount[];
  activeServerAccount: ServerMailAccount | null;
  setActiveServerAccountId: (id: string) => void;
  setActiveFolderId: (id: string) => void;
  setActiveServerFolder: (f: ServerMailFolder) => void;
  setViewingProfileMemberId: (id: string | null) => void;
  setIsDesktopDrawerOpen: (val: boolean | ((prev: boolean) => boolean)) => void;
  setSettingsSubTab: (tab: SettingsSubTab) => void;
  setCmhTasksSubTab: (tab: CmhTasksSubTab) => void;
  setCmhProjectsSubTab: (tab: CmhProjectsSubTab) => void;
  setCmhFormsSubTab: (tab: CmhFormBuilderSubTab) => void;
  setTeamsSubTab: (tab: TeamsSubTab) => void;
  setPostsSubTab: (tab: PostsNoticesSubTab) => void;
  setFinanceSubTab: (tab: FinanceSubTab) => void;
  isAuthenticated: boolean;
  handleSignOut: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  activeModule,
  setActiveModule,
  searchQuery,
  setSearchQuery,
  handleToggleHamburger,
  isDarkMode,
  setIsDarkMode,
  accentTheme,
  setAccentTheme,
  notifications,
  setNotifications,
  onOpenNotificationItem,
  wsUser,
  handleWorkspaceLogout,
  gmailAccounts,
  activeGmail,
  handleSwitchGmail,
  serverAccounts,
  activeServerAccount,
  setActiveServerAccountId,
  setActiveFolderId,
  setActiveServerFolder,
  setViewingProfileMemberId,
  setIsDesktopDrawerOpen,
  setSettingsSubTab,
  setCmhTasksSubTab,
  setCmhProjectsSubTab,
  setCmhFormsSubTab,
  setTeamsSubTab,
  setPostsSubTab,
  setFinanceSubTab,
  isAuthenticated,
  handleSignOut,
}) => {
  const [isAppGridOpen, setIsAppGridOpen] = useState<boolean>(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState<boolean>(false);
  const [isNotifMenuOpen, setIsNotifMenuOpen] = useState<boolean>(false);
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState<boolean>(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState<boolean>(false);

  const appGridRef = useRef<HTMLDivElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const notifMenuRef = useRef<HTMLDivElement>(null);
  const quickCreateRef = useRef<HTMLDivElement>(null);
  const themeMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (appGridRef.current && !appGridRef.current.contains(target)) {
        setIsAppGridOpen(false);
      }
      if (accountMenuRef.current && !accountMenuRef.current.contains(target)) {
        setIsAccountMenuOpen(false);
      }
      if (notifMenuRef.current && !notifMenuRef.current.contains(target)) {
        setIsNotifMenuOpen(false);
      }
      if (quickCreateRef.current && !quickCreateRef.current.contains(target)) {
        setIsQuickCreateOpen(false);
      }
      if (themeMenuRef.current && !themeMenuRef.current.contains(target)) {
        setIsThemeMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadNotifCount = notifications.filter((n) => !n.isRead).length;
  const ActiveIcon = moduleMeta[activeModule]?.icon || LayoutGrid;

  return (
    <header className="h-14 flex items-center justify-between gap-3 px-3 md:px-4 bg-white/88 dark:bg-slate-900/88 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800 shrink-0 z-30">
      {/* Left: Hamburger Button + Current App Brand */}
      <div className="flex items-center gap-2 shrink-0 min-w-0">
        <button
          type="button"
          onClick={handleToggleHamburger}
          className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
          aria-label="Toggle navigation drawer"
        >
          <Menu className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={() => setActiveModule('overview')}
          className="flex items-center gap-2 pr-1 whitespace-nowrap shrink-0"
        >
          <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
            <ActiveIcon className={`w-4 h-4 ${moduleMeta[activeModule]?.colorClass || 'text-[#0B57D0]'}`} />
          </div>
          <span className="text-sm sm:text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 truncate max-w-[140px] sm:max-w-none">
            {moduleMeta[activeModule]?.title || 'Workspace'}
          </span>
        </button>
      </div>

      {/* Center: Search Bar (Shown on desktop or when in Mail modules) */}
      <div
        className={`flex-1 max-w-xl ${
          activeModule === 'gmail' || activeModule === 'server_mail'
            ? 'block'
            : 'hidden md:block'
        }`}
      >
        <div className="flex items-center bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/70 dark:border-slate-700 rounded-xl px-3.5 py-1.5 focus-within:bg-white dark:focus-within:bg-slate-900 focus-within:border-[#0B57D0] focus-within:shadow-xs transition-all">
          <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              activeModule === 'server_mail'
                ? 'Search mail...'
                : 'Search across workspace...'
            }
            className="w-full bg-transparent text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="p-0.5 text-slate-400 hover:text-slate-600"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Right: Quick Create (+) + Theme Studio + Notification Bell + Settings + App Grid + Account Switcher */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
        {/* Quick Create (+) Menu */}
        <div className="relative" ref={quickCreateRef}>
          <button
            type="button"
            onClick={() => setIsQuickCreateOpen((prev) => !prev)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-[#0B57D0] to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold shadow-xs transition-all"
            title="Quick Create Anything"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Create</span>
          </button>

          {isQuickCreateOpen && (
            <div className=" absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-2 z-50 text-xs space-y-1">
              <div className="px-2.5 py-1.5 text-[11px] font-bold text-slate-400">
                Quick Create Studio
              </div>
              {[
                {
                  label: 'New Task',
                  sub: 'Assign & generate portal link',
                  icon: CheckSquare,
                  color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/50',
                  action: () => {
                    setActiveModule('cmh_tasks');
                    setCmhTasksSubTab('create_task');
                  },
                },
                {
                  label: 'New Project',
                  sub: 'Budget, deadline & team portal',
                  icon: Briefcase,
                  color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/50',
                  action: () => {
                    setActiveModule('cmh_projects');
                    setCmhProjectsSubTab('create_project');
                  },
                },
                {
                  label: 'New Team Member',
                  sub: 'Add profile & invitation link',
                  icon: UserPlus,
                  color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50',
                  action: () => {
                    setActiveModule('teams');
                    setTeamsSubTab('add_member');
                  },
                },
                {
                  label: 'New Post / Notice',
                  sub: 'Publish team announcement',
                  icon: Megaphone,
                  color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/50',
                  action: () => {
                    setActiveModule('posts');
                    setPostsSubTab('create_post');
                  },
                },
                {
                  label: 'New Invoice / Expense',
                  sub: 'Finance & billing ledger',
                  icon: Receipt,
                  color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/50',
                  action: () => {
                    setActiveModule('finance');
                    setFinanceSubTab('invoices');
                  },
                },
                {
                  label: 'New Custom Form',
                  sub: '18+ dynamic field builder',
                  icon: Blocks,
                  color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/50',
                  action: () => {
                    setActiveModule('cmh_forms');
                    setCmhFormsSubTab('builder');
                  },
                },
              ].map((qItem) => {
                const QIcon = qItem.icon;
                return (
                  <button
                    key={qItem.label}
                    type="button"
                    onClick={() => {
                      qItem.action();
                      setIsQuickCreateOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors"
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${qItem.color}`}>
                      <QIcon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 dark:text-slate-100 truncate">
                        {qItem.label}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">{qItem.sub}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Theme & Accent Studio Switcher */}
        <div className="relative" ref={themeMenuRef}>
          <button
            type="button"
            onClick={() => setIsThemeMenuOpen((prev) => !prev)}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Theme & Color Studio"
          >
            <Palette className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {isThemeMenuOpen && (
            <div className=" absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-3.5 z-50 text-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  Appearance Mode
                </span>
                <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsDarkMode(false)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                      !isDarkMode
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                    }`}
                  >
                    <Sun className="w-3.5 h-3.5 text-amber-500" />
                    Light
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsDarkMode(true)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                      isDarkMode
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Moon className="w-3.5 h-3.5 text-indigo-400" />
                    Dark
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="block font-bold text-slate-900 dark:text-slate-100">
                  Focus & Accent Color
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {(
                    [
                      { id: 'blue', label: 'Royal Blue', swatch: 'bg-[#0B57D0]' },
                      { id: 'violet', label: 'Electric Violet', swatch: 'bg-[#7c3aed]' },
                      { id: 'emerald', label: 'Emerald', swatch: 'bg-[#059669]' },
                      { id: 'rose', label: 'Rose Sunset', swatch: 'bg-[#e11d48]' },
                    ] as const
                  ).map((ac) => (
                    <button
                      key={ac.id}
                      type="button"
                      onClick={() => setAccentTheme(ac.id)}
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border text-[11px] font-bold transition-all ${
                        accentTheme === ac.id
                          ? 'border-slate-900 dark:border-white bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white'
                          : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <span className={`w-3.5 h-3.5 rounded-full shrink-0 ${ac.swatch}`} />
                      <span className="truncate">{ac.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Real-Time Notification Bell */}
        <div className="relative" ref={notifMenuRef}>
          <button
            type="button"
            onClick={() => {
              setIsNotifMenuOpen((prev) => !prev);
              if (!isNotifMenuOpen && unreadNotifCount > 0) {
                markNotificationsRead()
                  .then((updated) => setNotifications(updated))
                  .catch(() => {});
              }
            }}
            className="relative p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Real-Time Notifications"
          >
            <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
            {unreadNotifCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">
                {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
              </span>
            )}
          </button>

          {isNotifMenuOpen && (
            <div className=" absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden z-50 text-xs">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-[#F8FAFD] dark:bg-slate-800/70">
                <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Bell className="w-4 h-4 text-[#0B57D0]" />
                  <span>Real-Time Notifications ({notifications.length})</span>
                </div>
                {notifications.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      clearAllNotifications().then(() => setNotifications([]));
                    }}
                    className="text-[11px] font-semibold text-slate-500 hover:text-red-600"
                  >
                    Clear all
                  </button>
                )}
              </div>

              <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 space-y-1">
                    <Bell className="w-6 h-6 mx-auto opacity-40" />
                    <p>No new notifications</p>
                    <p className="text-[11px]">
                      Instant alerts for incoming Gmail, Server Mail, and CMH form/task/project submissions will appear here.
                    </p>
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <button
                      key={notif.id}
                      type="button"
                      onClick={() => onOpenNotificationItem(notif)}
                      className={`w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors flex items-start justify-between gap-3 ${
                        !notif.isRead ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {notif.title}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                          {notif.description}
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0">
                        {notif.timeLabel}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Quick Settings Button in Top Header */}
        <button
          type="button"
          onClick={() => {
            setActiveModule('settings');
            setSettingsSubTab('accounts');
          }}
          className={`p-2 rounded-xl transition-colors ${
            activeModule === 'settings'
              ? 'bg-[#D3E3FD] dark:bg-blue-950/60 text-[#0B57D0] dark:text-blue-400'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title="Settings & Account Manager"
        >
          <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        {/* Workspace App Grid Dropdown */}
        <div className="relative" ref={appGridRef}>
          <button
            type="button"
            onClick={() => setIsAppGridOpen((prev) => !prev)}
            className="p-2 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors"
            title="Switch Workspace App"
          >
            <LayoutGrid className="w-5 h-5" />
          </button>

          {isAppGridOpen && (
            <div className=" absolute right-0 mt-2 w-80 max-h-[80vh] overflow-y-auto rounded-2xl bg-[#F8FAFD] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-3 grid grid-cols-3 gap-2 z-50">
              {(
                [
                  { id: 'main_feed', label: 'Main', icon: LayoutGrid, color: 'text-[#0B57D0]' },
                  { id: 'overview', label: 'Overview', icon: LayoutDashboard, color: 'text-[#0B57D0]' },
                  { id: 'admin_panel', label: 'Admin Access', icon: ShieldCheck, color: 'text-[#0B57D0]' },
                  { id: 'cmh_tasks', label: 'Tasks', icon: CheckSquare, color: 'text-[#0B57D0]' },
                  { id: 'cmh_projects', label: 'Projects', icon: Briefcase, color: 'text-[#7C3AED]' },
                  { id: 'cmh_forms', label: 'Form Builder', icon: Blocks, color: 'text-[#0B57D0]' },
                  { id: 'teams', label: 'Teams', icon: Users, color: 'text-[#059669]' },
                  { id: 'posts', label: 'Posts & Notices', icon: Megaphone, color: 'text-[#D97706]' },
                  { id: 'docs', label: 'Docs', icon: FileText, color: 'text-[#2684FC]' },
                  { id: 'forms', label: 'Forms', icon: ClipboardList, color: 'text-[#673AB7]' },
                  { id: 'communication', label: 'Communication', icon: MessagesSquare, color: 'text-emerald-600' },
                  { id: 'profile', label: 'Profile', icon: UserCheck, color: 'text-[#0B57D0]' },
                  { id: 'settings', label: 'Settings', icon: Settings, color: 'text-[#0B57D0]' },
                  { id: 'chat', label: 'Team Chat', icon: MessageSquare, color: 'text-[#2563EB]' },
                  { id: 'gmail', label: 'Gmail', icon: Mail, color: 'text-[#EA4335]' },
                  { id: 'server_mail', label: 'Server Mail', icon: Server, color: 'text-[#0B57D0]' },
                  { id: 'bulk', label: 'Bulk Mail', icon: Layers, color: 'text-[#0B57D0]' },
                  { id: 'meet', label: 'Meet', icon: Video, color: 'text-[#00897B]' },
                  { id: 'files', label: 'File Manager', icon: HardDrive, color: 'text-[#0284C7]' },
                  { id: 'slides', label: 'Slides', icon: Presentation, color: 'text-[#F59E0B]' },
                  { id: 'sheets', label: 'Sheets', icon: Table, color: 'text-[#059669]' },
                  { id: 'calendar', label: 'Calendar', icon: Calendar, color: 'text-[#2563EB]' },
                  { id: 'finance', label: 'Finance', icon: Receipt, color: 'text-[#4F46E5]' },
                  { id: 'crm', label: 'CRM & Tickets', icon: UserCheck, color: 'text-[#0284C7]' },
                  { id: 'hr', label: 'HR & Payroll', icon: Clock, color: 'text-[#0D9488]' },
                  { id: 'wiki', label: 'Wiki & SOPs', icon: BookOpen, color: 'text-[#D97706]' },
                  { id: 'automations', label: 'Automations', icon: Zap, color: 'text-[#7C3AED]' },
                ] as const
              ).map((item) => {
                const Icon = item.icon;
                const active = activeModule === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveModule(item.id);
                      if (item.id === 'gmail') setActiveFolderId('inbox');
                      if (item.id === 'server_mail') setActiveServerFolder('inbox');
                      if (item.id === 'profile') {
                        setViewingProfileMemberId(null);
                        setIsDesktopDrawerOpen(false);
                      }
                      if (item.id === 'settings') setSettingsSubTab('accounts');
                      setIsAppGridOpen(false);
                    }}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl text-xs font-medium transition-colors ${
                      active
                        ? 'bg-[#D3E3FD] text-[#041E49] font-semibold'
                        : 'hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <Icon className={`w-6 h-6 mb-1.5 ${item.color}`} />
                    <span className="truncate w-full text-center">{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Workspace Identity & Multi-Account Switcher */}
        <div className="relative" ref={accountMenuRef}>
          <button
            type="button"
            onClick={() => setIsAccountMenuOpen((prev) => !prev)}
            className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:shadow-xs transition-all"
            title="Workspace Account & Mail Switcher"
          >
            <div className="w-7 h-7 rounded-full bg-[#0B57D0] text-white font-semibold text-xs flex items-center justify-center">
              {(activeModule === 'server_mail' && activeServerAccount
                ? activeServerAccount.email
                : activeGmail || wsUser.email || 'A'
              )
                .charAt(0)
                .toUpperCase()}
            </div>
            <span className="hidden sm:inline text-xs font-medium text-slate-700 dark:text-slate-200 max-w-[160px] truncate">
              {activeModule === 'server_mail' && activeServerAccount
                ? activeServerAccount.email
                : wsUser.name || activeGmail || wsUser.email}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {isAccountMenuOpen && (
            <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-3 space-y-3 z-50 text-xs">
              {/* Active Admin Workspace Session */}
              <div className="px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 dark:text-slate-100 truncate">
                    {wsUser.name}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {wsUser.email}
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-[#0B57D0] shrink-0">
                  {wsUser.role}
                </span>
              </div>

              {/* Connected Gmail Accounts */}
              <div>
                <div className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold text-slate-400">
                  <span>Gmail Accounts ({gmailAccounts.length})</span>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveModule('settings');
                      setSettingsSubTab('accounts');
                      setIsAccountMenuOpen(false);
                    }}
                    className="text-[#0B57D0] hover:underline flex items-center gap-1"
                  >
                    <UserPlus className="w-3 h-3" />
                    <span>Manage in Settings</span>
                  </button>
                </div>

                {gmailAccounts.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveModule('settings');
                      setSettingsSubTab('accounts');
                      setIsAccountMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-[#0B57D0] font-semibold hover:bg-slate-50 rounded-xl"
                  >
                    + Add Gmail Account in Settings
                  </button>
                ) : (
                  <div className="space-y-1 mt-1">
                    {gmailAccounts.map((ga) => {
                      const isCurrent =
                        activeModule !== 'server_mail' && activeGmail === ga.email;
                      return (
                        <button
                          key={ga.email}
                          type="button"
                          onClick={() => {
                            handleSwitchGmail(ga.email);
                            setIsAccountMenuOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-colors ${
                            isCurrent
                              ? 'bg-blue-50/80 dark:bg-blue-950/50 text-[#0B57D0] font-semibold'
                              : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          <div className="min-w-0 text-left">
                            <div className="truncate">{ga.displayName}</div>
                            <div className="text-[11px] text-slate-400 truncate">
                              {ga.email}
                            </div>
                          </div>
                          {isCurrent && <Check className="w-4 h-4 text-[#0B57D0] shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Connected Server Mail Accounts */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold text-slate-400">
                  <span>Server Mail Accounts ({serverAccounts.length})</span>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveModule('settings');
                      setSettingsSubTab('accounts');
                      setIsAccountMenuOpen(false);
                    }}
                    className="text-[#0B57D0] hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Manage in Settings</span>
                  </button>
                </div>

                {serverAccounts.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveModule('settings');
                      setSettingsSubTab('accounts');
                      setIsAccountMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-slate-600 hover:bg-slate-50 rounded-xl"
                  >
                    + Add Server Mail in Settings
                  </button>
                ) : (
                  <div className="space-y-1 mt-1">
                    {serverAccounts.map((sa) => {
                      const isCurrent =
                        activeModule === 'server_mail' &&
                        activeServerAccount?.id === sa.id;
                      return (
                        <button
                          key={sa.id}
                          type="button"
                          onClick={() => {
                            setActiveServerAccountId(sa.id);
                            setActiveModule('server_mail');
                            setActiveServerFolder('inbox');
                            setIsAccountMenuOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-colors ${
                            isCurrent
                              ? 'bg-blue-50/80 dark:bg-blue-950/50 text-[#0B57D0] font-semibold'
                              : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          <div className="min-w-0 text-left">
                            <div className="truncate">{sa.label}</div>
                            <div className="text-[11px] font-mono text-slate-400 truncate">
                              {sa.email}
                            </div>
                          </div>
                          {isCurrent && <Check className="w-4 h-4 text-[#0B57D0] shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setViewingProfileMemberId(null);
                    setActiveModule('profile');
                    setIsDesktopDrawerOpen(false);
                    setIsAccountMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-slate-800 dark:text-slate-100 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  <UserCheck className="w-4 h-4 text-[#0B57D0]" />
                  <span>Executive Profile & CV Studio</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveModule('admin_panel');
                    setIsAccountMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[#0B57D0] font-semibold hover:bg-blue-50/70 dark:hover:bg-slate-800 rounded-xl"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Admin Access & Users</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveModule('settings');
                    setSettingsSubTab('accounts');
                    setIsAccountMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  <Settings className="w-4 h-4" />
                  <span>All Settings & Account Manager</span>
                </button>

                {isAuthenticated && (
                  <button
                    type="button"
                    onClick={() => {
                      handleSignOut();
                      setIsAccountMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Disconnect Active Gmail</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    handleWorkspaceLogout();
                    setIsAccountMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-rose-600 font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out of Workspace Pro</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};



