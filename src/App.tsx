/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Menu,
  Search,
  Mail,
  Server,
  Layers,
  FileText,
  ClipboardList,
  Video,
  Inbox,
  Star,
  Send,
  PenSquare,
  Plus,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  Settings,
  X,
  Trash2,
  LogOut,
  Check,
  UserPlus,
  Bell,
  Users,
  Megaphone,
  HardDrive,
  FolderPlus,
  Image as ImageIcon,
  Tag,
  CheckSquare,
  Briefcase,
  Blocks,
  BellRing,
  Presentation,
  KeyRound,
  Sliders,
  Database,
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
import {
  WorkspaceUser,
  ConnectedGmailAccount,
  initAuth,
  logout,
  switchActiveGmailAccount,
  getActiveGmailEmail,
} from './services/auth';
import {
  CustomMailTab,
  ServerMailAccount,
  ParsedEmail,
  WorkspaceNotification,
  WorkspaceFileItem,
  WorkspaceMemberItem,
  fetchServerMailAccounts,
  fetchCustomMailTabs,
  saveCustomMailTab,
  deleteCustomMailTab,
  fetchNotifications,
  markNotificationsRead,
  clearAllNotifications,
  injectRealtimeAdminInboxMessage,
  fetchSystemSettings,
  fetchWorkspaceTeamsAndMembers,
} from './services/workspaceApi';
import { GmailView } from './components/GmailView';
import { ServerMailView, ServerMailFolder } from './components/ServerMailView';
import { BulkMailView } from './components/BulkMailView';
import { DocsView, DocsSubTab } from './components/DocsView';
import { SlidesView, SlidesSubTab } from './components/SlidesView';
import { FormsView, FormsSubTab } from './components/FormsView';
import { PublicFormView } from './components/PublicFormView';
import { MeetView, MeetSubTab } from './components/MeetView';
import { TeamsView, TeamsSubTab } from './components/TeamsView';
import { PublicMemberInviteView } from './components/PublicMemberInviteView';
import { PostsNoticesView, PostsNoticesSubTab } from './components/PostsNoticesView';
import { FileManagerView, FileManagerSubTab } from './components/FileManagerView';
import { CmhTasksView, CmhTasksSubTab } from './components/CmhTasksView';
import { CmhProjectsView, CmhProjectsSubTab } from './components/CmhProjectsView';
import { CmhFormBuilderView, CmhFormBuilderSubTab } from './components/CmhFormBuilderView';
import { PublicCmhPortalView } from './components/PublicCmhPortalView';
import { SettingsView, SettingsSubTab } from './components/SettingsView';
import { SheetsView, SheetsSubTab } from './components/SheetsView';
import { CalendarView, CalendarSubTab } from './components/CalendarView';
import { FinanceView, FinanceSubTab } from './components/FinanceView';
import { CrmTicketsView, CrmSubTab } from './components/CrmTicketsView';
import { HrManagementView, HrSubTab } from './components/HrManagementView';
import { TeamChatView, ChatSubTab } from './components/TeamChatView';
import { WikiKnowledgeView, WikiSubTab } from './components/WikiKnowledgeView';
import { AutomationEngineView, AutomationSubTab } from './components/AutomationEngineView';
import { OverviewDashboardView } from './components/OverviewDashboardView';
import { ExecutiveProfileView } from './components/profile/ExecutiveProfileView';
import { CommunicationView } from './components/communication/CommunicationView';
import { subscribeWorkspaceEvents } from './services/realtimeBus';
import { FloatingMessengerWidget } from './components/communication/FloatingMessengerWidget';
import { SimpleDashboardView } from './components/SimpleDashboardView';
import { AdminPanelView } from './components/AdminPanelView';
import { MemberPortalShell } from './components/member/MemberPortalShell';
import {
  type EvaluatedCapabilitiesClient,
  fetchWorkspaceSession,
  logoutWorkspaceAccount,
  type WorkspaceAuthUser,
} from './services/workspaceAuth';

export type WorkspaceModule =
  | 'overview'
  | 'admin_panel'
  | 'gmail'
  | 'server_mail'
  | 'bulk'
  | 'teams'
  | 'posts'
  | 'files'
  | 'docs'
  | 'slides'
  | 'forms'
  | 'meet'
  | 'cmh_tasks'
  | 'cmh_projects'
  | 'cmh_forms'
  | 'sheets'
  | 'calendar'
  | 'finance'
  | 'crm'
  | 'hr'
  | 'chat'
  | 'wiki'
  | 'automations'
  | 'communication'
  | 'profile'
  | 'settings';

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

export default function App() {
  // Check if visitor opened a universal public form link (?form=...), member invitation link (?invite=...), or CMH link (?cmh=...)
  const [publicFormIdFromUrl, setPublicFormIdFromUrl] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('form');
  });
  const [previewPublicFormId, setPreviewPublicFormId] = useState<string | null>(null);

  const [publicInviteIdFromUrl, setPublicInviteIdFromUrl] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('invite');
  });
  const [previewMemberInviteId, setPreviewMemberInviteId] = useState<string | null>(null);

  const [publicCmhFromUrl, setPublicCmhFromUrl] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('cmh');
  });
  const [previewCmhParam, setPreviewCmhParam] = useState<string | null>(null);

  const [appInviteTokenFromUrl, setAppInviteTokenFromUrl] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('app-invite');
  });
  const [wsSessionLoading, setWsSessionLoading] = useState<boolean>(true);
  const [wsUser, setWsUser] = useState<WorkspaceAuthUser | null>(null);
  const [wsCapabilities, setWsCapabilities] = useState<EvaluatedCapabilitiesClient | null>(null);

  const [activeModule, setActiveModule] = useState<WorkspaceModule>('overview');
  const [needsAuth, setNeedsAuth] = useState<boolean>(true);
  const [user, setUser] = useState<WorkspaceUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [gmailAccounts, setGmailAccounts] = useState<ConnectedGmailAccount[]>([]);
  const [activeGmail, setActiveGmail] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  // Server Mail Multi-Account State
  const [serverAccounts, setServerAccounts] = useState<ServerMailAccount[]>([]);
  const [activeServerAccountId, setActiveServerAccountId] = useState<string | null>(null);
  const [activeServerFolder, setActiveServerFolder] = useState<ServerMailFolder>('inbox');
  const [serverComposeTrigger, setServerComposeTrigger] = useState<number>(0);

  // Navigation & Hamburger Drawer State
  const [isDesktopDrawerOpen, setIsDesktopDrawerOpen] = useState<boolean>(true);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);
  const [isCustomFoldersExpanded, setIsCustomFoldersExpanded] = useState<boolean>(true);
  const [isAppsSectionExpanded, setIsAppsSectionExpanded] = useState<boolean>(true);
  const [isCmhSectionExpanded, setIsCmhSectionExpanded] = useState<boolean>(true);

  // Module-Specific Sub-Navigation State (Teams, Posts & Notices, File Manager, Docs, Forms, Meet, CMH App)
  const [teamsSubTab, setTeamsSubTab] = useState<TeamsSubTab>('all_members');
  const [postsSubTab, setPostsSubTab] = useState<PostsNoticesSubTab>('feed');
  const [filesSubTab, setFilesSubTab] = useState<FileManagerSubTab>('all_files');
  const [docsSubTab, setDocsSubTab] = useState<DocsSubTab>('all_docs');
  const [slidesSubTab, setSlidesSubTab] = useState<SlidesSubTab>('all_slides');
  const [formsSubTab, setFormsSubTab] = useState<FormsSubTab>('all_forms');
  const [meetSubTab, setMeetSubTab] = useState<MeetSubTab>('all_meetings');
  const [cmhTasksSubTab, setCmhTasksSubTab] = useState<CmhTasksSubTab>('all_tasks');
  const [cmhProjectsSubTab, setCmhProjectsSubTab] = useState<CmhProjectsSubTab>('all_projects');
  const [cmhFormsSubTab, setCmhFormsSubTab] = useState<CmhFormBuilderSubTab>('all_forms');
  const [sheetsSubTab, setSheetsSubTab] = useState<SheetsSubTab>('all_sheets');
  const [calendarSubTab, setCalendarSubTab] = useState<CalendarSubTab>('agenda');
  const [financeSubTab, setFinanceSubTab] = useState<FinanceSubTab>('invoices');
  const [crmSubTab, setCrmSubTab] = useState<CrmSubTab>('leads');
  const [hrSubTab, setHrSubTab] = useState<HrSubTab>('attendance');
  const [chatSubTab, setChatSubTab] = useState<ChatSubTab>('channels');
  const [wikiSubTab, setWikiSubTab] = useState<WikiSubTab>('articles');
  const [automationsSubTab, setAutomationsSubTab] = useState<AutomationSubTab>('rules');
  const [settingsSubTab, setSettingsSubTab] = useState<SettingsSubTab>('accounts');
  const [viewingProfileMemberId, setViewingProfileMemberId] = useState<string | null>(null);
  const [communicationTargetUserId, setCommunicationTargetUserId] = useState<string | null>(null);
  const [workspaceTitle, setWorkspaceTitle] = useState<string>('Workspace Pro');

  // Cross-module attachment & team bulk recipients state
  const [pendingFileAttachment, setPendingFileAttachment] = useState<WorkspaceFileItem | null>(null);
  const [initialTeamRecipients, setInitialTeamRecipients] = useState<Array<{
    email: string;
    name: string;
    company: string;
  }> | null>(null);

  // Header Dropdowns, Quick Create, Theme Studio & Real-Time Notifications State
  const [isAppGridOpen, setIsAppGridOpen] = useState<boolean>(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState<boolean>(false);
  const [isNotifMenuOpen, setIsNotifMenuOpen] = useState<boolean>(false);
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState<boolean>(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState<boolean>(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [accentTheme, setAccentTheme] = useState<'blue' | 'violet' | 'emerald' | 'rose'>('blue');
  const [notifications, setNotifications] = useState<WorkspaceNotification[]>([]);
  const [liveToastNotif, setLiveToastNotif] = useState<WorkspaceNotification | null>(null);
  const [realtimeServerMailMsg, setRealtimeServerMailMsg] = useState<ParsedEmail | null>(null);
  const [focusGmailId, setFocusGmailId] = useState<string | null>(null);
  const [focusServerMailId, setFocusServerMailId] = useState<string | null>(null);

  // Shared Gmail State
  const [activeFolderId, setActiveFolderId] = useState<string>('inbox');
  const [activeTabId, setActiveTabId] = useState<string>('primary');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [customTabs, setCustomTabs] = useState<CustomMailTab[]>([]);
  const [composeTriggerCount, setComposeTriggerCount] = useState<number>(0);
  const [isAddTabModalOpen, setIsAddTabModalOpen] = useState<boolean>(false);
  const [newTabName, setNewTabName] = useState<string>('');
  const [newTabQuery, setNewTabQuery] = useState<string>('');

  const appGridRef = useRef<HTMLDivElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const notifMenuRef = useRef<HTMLDivElement>(null);
  const quickCreateRef = useRef<HTMLDivElement>(null);
  const themeMenuRef = useRef<HTMLDivElement>(null);
  const mobileDrawerTouchStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    root.setAttribute('data-accent', accentTheme);
  }, [isDarkMode, accentTheme]);

  const refreshWorkspaceSession = () => {
    setWsSessionLoading(true);
    fetchWorkspaceSession()
      .then((res) => {
        if (res.authenticated && res.user && res.capabilities) {
          setWsUser(res.user);
          setWsCapabilities(res.capabilities);
        } else {
          setWsUser(null);
          setWsCapabilities(null);
        }
      })
      .catch(() => {})
      .finally(() => setWsSessionLoading(false));
  };

  useEffect(() => {
    refreshWorkspaceSession();
  }, []);

  useEffect(() => {
    if (!wsUser || (wsUser.role !== 'OWNER' && wsUser.role !== 'ADMIN')) {
      return;
    }

    const unsubscribe = initAuth((authedUser, accessToken, allAccounts) => {
      setUser(authedUser);
      setToken(accessToken);
      setGmailAccounts(allAccounts);
      setActiveGmail(getActiveGmailEmail() || authedUser?.email || null);
      setNeedsAuth(!accessToken);
    });

    // Load saved Server Mail accounts from encrypted DB
    fetchServerMailAccounts()
      .then((loaded) => {
        setServerAccounts(loaded);
        if (loaded.length > 0) {
          setActiveServerAccountId(loaded[0].id);
        }
      })
      .catch(() => {});

    // Load saved custom mail tabs from DB
    fetchCustomMailTabs()
      .then((tabs) => setCustomTabs(tabs))
      .catch(() => {});

    // Load existing notifications
    fetchNotifications()
      .then((loadedNotifs) => setNotifications(loadedNotifs))
      .catch(() => {});

    // Load global system settings (Workspace branding title, etc.)
    fetchSystemSettings()
      .then((res) => {
        if (res.settings?.workspaceName) {
          setWorkspaceTitle(res.settings.workspaceName);
          document.title = res.settings.workspaceName;
        }
      })
      .catch(() => {});

    // Preload member directory for instant autocomplete
    fetchWorkspaceTeamsAndMembers().catch(() => {});

    const unsubRealtime = subscribeWorkspaceEvents((eventName, payload) => {
      if (eventName === 'notification:new' && payload) {
        setNotifications((prev) =>
          prev.some((n) => n.id === payload.id) ? prev : [payload, ...prev].slice(0, 60)
        );
      } else if (eventName === 'notification:read') {
        fetchNotifications()
          .then((loadedNotifs) => setNotifications(loadedNotifs))
          .catch(() => {});
      } else if (eventName === 'notification:cleared') {
        setNotifications([]);
      } else if (eventName === 'members:updated') {
        fetchWorkspaceTeamsAndMembers().catch(() => {});
      } else if (eventName === 'mail:arrived' && payload?.message) {
        setRealtimeServerMailMsg(payload.message);
      }
    });

    return () => {
      unsubscribe();
      unsubRealtime();
    };
  }, [wsUser?.id, wsUser?.role]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (appGridRef.current && !appGridRef.current.contains(e.target as Node)) {
        setIsAppGridOpen(false);
      }
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setIsAccountMenuOpen(false);
      }
      if (notifMenuRef.current && !notifMenuRef.current.contains(e.target as Node)) {
        setIsNotifMenuOpen(false);
      }
      if (quickCreateRef.current && !quickCreateRef.current.contains(e.target as Node)) {
        setIsQuickCreateOpen(false);
      }
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target as Node)) {
        setIsThemeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleGoogleSignIn = (_selectAnother = false) => {
    setActiveModule('settings');
    setSettingsSubTab('accounts');
    setIsAccountMenuOpen(false);
  };

  const handleSwitchGmail = (email: string) => {
    const switched = switchActiveGmailAccount(email);
    if (switched) {
      setActiveGmail(switched.email);
      setToken(switched.accessToken);
      setNeedsAuth(false);
      setActiveModule('gmail');
      setActiveFolderId('inbox');
      setIsAccountMenuOpen(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    setUser(null);
    setToken(null);
    setGmailAccounts([]);
    setActiveGmail(null);
    setNeedsAuth(true);
    setIsAccountMenuOpen(false);
  };

  const handleWorkspaceLogout = async () => {
    await logoutWorkspaceAccount().catch(() => {});
    setWsUser(null);
    setWsCapabilities(null);
    setIsAccountMenuOpen(false);
  };

  const handleToggleHamburger = () => {
    if (window.innerWidth < 768) {
      setIsMobileDrawerOpen((prev) => !prev);
    } else {
      setIsDesktopDrawerOpen((prev) => !prev);
    }
  };

  const handleCreateCustomTab = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTabName.trim() || !newTabQuery.trim()) return;
    const newTab: CustomMailTab = {
      id: `custom-${Date.now()}`,
      name: newTabName.trim(),
      query: newTabQuery.trim(),
      accentColor: '#0B57D0',
      description: `Filter: ${newTabQuery.trim()}`,
    };
    const updated = await saveCustomMailTab(newTab);
    setCustomTabs(updated);
    setActiveModule('gmail');
    setActiveFolderId('inbox');
    setActiveTabId(newTab.id);
    setNewTabName('');
    setNewTabQuery('');
    setIsAddTabModalOpen(false);
    setIsMobileDrawerOpen(false);
  };

  const handleRemoveCustomTab = async (id: string) => {
    const updated = await deleteCustomMailTab(id);
    setCustomTabs(updated);
    if (activeTabId === id) {
      setActiveTabId('primary');
    }
  };

  const isAuthenticated = Boolean(!needsAuth && token);
  const activeServerAccount =
    serverAccounts.find((a) => a.id === activeServerAccountId) || serverAccounts[0] || null;

  const moduleMeta: Record<
    WorkspaceModule,
    { title: string; colorClass: string; icon: React.ComponentType<{ className?: string }> }
  > = {
    overview: { title: 'Overview', colorClass: 'text-[#0B57D0]', icon: LayoutDashboard },
    admin_panel: { title: 'Admin & Access Control', colorClass: 'text-[#0B57D0]', icon: ShieldCheck },
    gmail: { title: 'Gmail', colorClass: 'text-[#EA4335]', icon: Mail },
    server_mail: { title: 'Server Mail', colorClass: 'text-[#0B57D0]', icon: Server },
    bulk: { title: 'Bulk Mail', colorClass: 'text-[#0B57D0]', icon: Layers },
    teams: { title: 'Teams', colorClass: 'text-[#0B57D0]', icon: Users },
    posts: { title: 'Posts & Notices', colorClass: 'text-[#D97706]', icon: Megaphone },
    files: { title: 'File Manager', colorClass: 'text-[#0284C7]', icon: HardDrive },
    docs: { title: 'Docs', colorClass: 'text-[#2684FC]', icon: FileText },
    slides: { title: 'Slides', colorClass: 'text-[#F59E0B]', icon: Presentation },
    forms: { title: 'Forms', colorClass: 'text-[#673AB7]', icon: ClipboardList },
    meet: { title: 'Meet', colorClass: 'text-[#00897B]', icon: Video },
    cmh_tasks: { title: 'Tasks', colorClass: 'text-[#0B57D0]', icon: CheckSquare },
    cmh_projects: { title: 'Projects', colorClass: 'text-[#7C3AED]', icon: Briefcase },
    cmh_forms: { title: 'Form Builder', colorClass: 'text-[#0B57D0]', icon: Blocks },
    sheets: { title: 'Sheets & Data', colorClass: 'text-[#059669]', icon: Table },
    calendar: { title: 'Calendar & Schedule', colorClass: 'text-[#2563EB]', icon: Calendar },
    finance: { title: 'Finance & Billing', colorClass: 'text-[#4F46E5]', icon: Receipt },
    crm: { title: 'CRM & Tickets', colorClass: 'text-[#0284C7]', icon: UserCheck },
    hr: { title: 'HR & Payroll', colorClass: 'text-[#0D9488]', icon: Clock },
    chat: { title: 'Team Chat', colorClass: 'text-[#2563EB]', icon: MessageSquare },
    wiki: { title: 'Wiki & SOPs', colorClass: 'text-[#D97706]', icon: BookOpen },
    automations: { title: 'Automations', colorClass: 'text-[#7C3AED]', icon: Zap },
    communication: { title: 'Communication Messenger', colorClass: 'text-emerald-600', icon: MessagesSquare },
    profile: { title: 'Executive Profile & CV', colorClass: 'text-[#0B57D0]', icon: UserCheck },
    settings: { title: 'Settings', colorClass: 'text-[#0B57D0]', icon: Settings },
  };

  const unreadNotifCount = notifications.filter((n) => !n.isRead).length;

  const handleOpenNotificationItem = (notif: WorkspaceNotification) => {
    markNotificationsRead(notif.id)
      .then((updated) => setNotifications(updated))
      .catch(() => {});
    setIsNotifMenuOpen(false);
    setLiveToastNotif(null);

    if (notif.module === 'gmail') {
      setActiveModule('gmail');
      setActiveFolderId('inbox');
      if (notif.targetId) setFocusGmailId(notif.targetId);
    } else if (notif.module === 'server_mail') {
      if (notif.accountId) setActiveServerAccountId(notif.accountId);
      setActiveModule('server_mail');
      setActiveServerFolder('inbox');
      if (notif.targetId) setFocusServerMailId(notif.targetId);
    } else if (notif.module === 'slides') {
      setActiveModule('slides');
      setSlidesSubTab('all_slides');
    } else if (notif.module === 'docs') {
      setActiveModule('docs');
      setDocsSubTab('all_docs');
    } else if (notif.module === 'files') {
      setActiveModule('files');
      setFilesSubTab('documents');
    } else if (notif.module === 'forms') {
      setActiveModule('forms');
    } else if (notif.module === 'teams') {
      setActiveModule('teams');
    } else if (notif.module === 'posts') {
      setActiveModule('posts');
    } else if (notif.module === 'cmh_tasks') {
      setActiveModule('cmh_tasks');
      setCmhTasksSubTab('all_tasks');
    } else if (notif.module === 'cmh_projects') {
      setActiveModule('cmh_projects');
      setCmhProjectsSubTab('all_projects');
    } else if (notif.module === 'cmh_forms') {
      setActiveModule('cmh_forms');
      setCmhFormsSubTab('all_forms');
    } else if (notif.module === 'admin_panel') {
      setActiveModule('admin_panel');
    }
  };

  const ActiveIcon = moduleMeta[activeModule].icon;

  // Clean, Structured Hamburger Navigation Drawer:
  // 1. CEO Executive (Top Section): Overview, Tasks, Projects, Form Builder, Teams, Posts & Notices, Docs, Forms, Settings
  // 2. Workspace, Channels & Engines (Second Section): Team Chat & Channels (@mentions, quotes), Gmail, Server Mail, Bulk Mail, etc.
  // 3. Contextual Mail Folders (When inside Gmail / Server Mail / Bulk Mail)
  const renderNavigationList = (isMobile = false) => {
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
                  {
                    id: 'overview',
                    label: 'Overview',
                    icon: LayoutDashboard,
                    color: 'text-[#0B57D0]',
                  },
                  {
                    id: 'admin_panel',
                    label: 'Admin Access & Users',
                    icon: ShieldCheck,
                    color: 'text-[#0B57D0]',
                  },
                  {
                    id: 'cmh_tasks',
                    label: 'Tasks',
                    icon: CheckSquare,
                    color: 'text-[#0B57D0]',
                  },
                  {
                    id: 'cmh_projects',
                    label: 'Projects',
                    icon: Briefcase,
                    color: 'text-[#7C3AED]',
                  },
                  {
                    id: 'cmh_forms',
                    label: 'Form Builder',
                    icon: Blocks,
                    color: 'text-[#0B57D0]',
                  },
                  {
                    id: 'teams',
                    label: 'Teams',
                    icon: Users,
                    color: 'text-[#059669]',
                  },
                  {
                    id: 'posts',
                    label: 'Posts & Notices',
                    icon: Megaphone,
                    color: 'text-[#D97706]',
                  },
                  {
                    id: 'docs',
                    label: 'Docs',
                    icon: FileText,
                    color: 'text-[#2684FC]',
                  },
                  {
                    id: 'forms',
                    label: 'Forms',
                    icon: ClipboardList,
                    color: 'text-[#673AB7]',
                  },
                  {
                    id: 'communication',
                    label: 'Communication',
                    icon: MessagesSquare,
                    color: 'text-emerald-600',
                  },
                  {
                    id: 'profile',
                    label: 'Profile',
                    icon: UserCheck,
                    color: 'text-[#0B57D0]',
                  },
                  {
                    id: 'settings',
                    label: 'Settings',
                    icon: Settings,
                    color: 'text-[#0B57D0]',
                  },
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
                      if (item.id === 'cmh_forms') setCmhFormsSubTab('all_forms');
                      if (item.id === 'teams') setTeamsSubTab('all_members');
                      if (item.id === 'posts') setPostsSubTab('feed');
                      if (item.id === 'docs') setDocsSubTab('all_docs');
                      if (item.id === 'forms') setFormsSubTab('all_forms');
                      if (item.id === 'profile') {
                        setViewingProfileMemberId(null);
                        setIsDesktopDrawerOpen(false); // Auto collapse drawer!
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

        {/* TOUCH-FRIENDLY SECTION DIVIDER: CEO EXECUTIVE <-> WORKSPACE & CHANNELS */}
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
                  {
                    id: 'chat',
                    label: 'Team Chat & Channels',
                    icon: MessageSquare,
                    color: 'text-[#2563EB]',
                  },
                  { id: 'gmail', label: 'Gmail', icon: Mail, color: 'text-[#EA4335]' },
                  {
                    id: 'server_mail',
                    label: 'Server Mail (Domain)',
                    icon: Server,
                    color: 'text-[#0B57D0]',
                  },
                  {
                    id: 'bulk',
                    label: 'Bulk Mail Studio',
                    icon: Layers,
                    color: 'text-[#0B57D0]',
                  },
                  { id: 'meet', label: 'Video Meet', icon: Video, color: 'text-[#00897B]' },
                  {
                    id: 'files',
                    label: 'File Manager',
                    icon: HardDrive,
                    color: 'text-[#0284C7]',
                  },
                  {
                    id: 'slides',
                    label: 'Slides',
                    icon: Presentation,
                    color: 'text-[#F59E0B]',
                  },
                  {
                    id: 'sheets',
                    label: 'Sheets & Data Grid',
                    icon: Table,
                    color: 'text-[#059669]',
                  },
                  {
                    id: 'calendar',
                    label: 'Calendar & Schedule',
                    icon: Calendar,
                    color: 'text-[#2563EB]',
                  },
                  {
                    id: 'finance',
                    label: 'Finance & Invoices',
                    icon: Receipt,
                    color: 'text-[#4F46E5]',
                  },
                  {
                    id: 'crm',
                    label: 'CRM & Support Tickets',
                    icon: UserCheck,
                    color: 'text-[#0284C7]',
                  },
                  {
                    id: 'hr',
                    label: 'HR, Attendance & Payroll',
                    icon: Clock,
                    color: 'text-[#0D9488]',
                  },
                  {
                    id: 'wiki',
                    label: 'Knowledge Base & SOPs',
                    icon: BookOpen,
                    color: 'text-[#D97706]',
                  },
                  {
                    id: 'automations',
                    label: 'Workflow Automations',
                    icon: Zap,
                    color: 'text-[#7C3AED]',
                  },
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

        {/* SECTION 3: CONTEXTUAL MAIL FOLDERS & CUSTOM TABS (Only when in Gmail / Server Mail / Bulk Mail) */}
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
                  Server Mail {activeServerAccount ? `· ${activeServerAccount.email}` : ''}
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

  // Universal Public Form Responder Mode (No Google Account Needed)
  if (publicFormIdFromUrl || previewPublicFormId) {
    const activeFormId = previewPublicFormId || publicFormIdFromUrl!;
    return (
      <PublicFormView
        formId={activeFormId}
        onExitPreview={
          previewPublicFormId
            ? () => setPreviewPublicFormId(null)
            : () => {
                const url = new URL(window.location.href);
                url.searchParams.delete('form');
                window.history.replaceState({}, '', url.toString());
                setPublicFormIdFromUrl(null);
              }
        }
      />
    );
  }

  // Universal Member Profile Invitation Portal (?invite=<memberId>)
  if (publicInviteIdFromUrl || previewMemberInviteId) {
    const activeInviteId = previewMemberInviteId || publicInviteIdFromUrl!;
    return (
      <PublicMemberInviteView
        inviteId={activeInviteId}
        onExitPreview={
          previewMemberInviteId
            ? () => setPreviewMemberInviteId(null)
            : () => {
                const url = new URL(window.location.href);
                url.searchParams.delete('invite');
                window.history.replaceState({}, '', url.toString());
                setPublicInviteIdFromUrl(null);
              }
        }
      />
    );
  }

  // Universal CMH App Form, Task & Project Shareable Link Portal (?cmh=form:<id> | task:<id> | project:<id>)
  if (publicCmhFromUrl || previewCmhParam) {
    const activeCmhParam = previewCmhParam || publicCmhFromUrl!;
    return (
      <PublicCmhPortalView
        cmhParam={activeCmhParam}
        onExitPreview={
          previewCmhParam
            ? () => setPreviewCmhParam(null)
            : () => {
                const url = new URL(window.location.href);
                url.searchParams.delete('cmh');
                window.history.replaceState({}, '', url.toString());
                setPublicCmhFromUrl(null);
              }
        }
      />
    );
  }

  if (wsSessionLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[#F8FAFC] text-slate-600 text-sm font-medium">
        Loading Workspace Pro...
      </div>
    );
  }

  // Public Landing Dashboard (clean simple dashboard + optional sign-in / invite modal; zero admin setup)
  if (appInviteTokenFromUrl || !wsUser || !wsCapabilities) {
    return (
      <SimpleDashboardView
        inviteToken={appInviteTokenFromUrl}
        onAuthenticated={(authedUser, caps) => {
          setWsUser(authedUser);
          setWsCapabilities(caps);
          setAppInviteTokenFromUrl(null);
          setActiveModule('overview');
        }}
      />
    );
  }

  // Completely Distinct Mobile-App-Style Member Dashboard UI (Cloud / Mint / Lavender Themes)
  if (wsUser.role === 'MEMBER' || wsCapabilities.isMember) {
    return (
      <MemberPortalShell
        user={wsUser}
        capabilities={wsCapabilities}
        onLogout={handleWorkspaceLogout}
        onUserUpdated={(updatedUser, updatedCaps) => {
          setWsUser(updatedUser);
          if (updatedCaps) setWsCapabilities(updatedCaps);
        }}
      />
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#F8FAFC] dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden">
      {/* Frosted Glassmorphism Top Header Bar */}
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
              <ActiveIcon className={`w-4 h-4 ${moduleMeta[activeModule].colorClass}`} />
            </div>
            <span className="text-sm sm:text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 truncate max-w-[140px] sm:max-w-none">
              {moduleMeta[activeModule].title}
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
              onChange={(e) => {
                setSearchQuery(e.target.value);
              }}
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
              <div className="ws-animate-in absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-2 z-50 text-xs space-y-1">
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
              <div className="ws-animate-in absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-3.5 z-50 text-xs space-y-3">
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
              <div className="ws-animate-in absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden z-50 text-xs">
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
                        onClick={() => handleOpenNotificationItem(notif)}
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
              <div className="ws-animate-in absolute right-0 mt-2 w-80 max-h-[80vh] overflow-y-auto rounded-2xl bg-[#F8FAFD] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-3 grid grid-cols-3 gap-2 z-50">
                {(
                  [
                    {
                      id: 'overview',
                      label: 'Overview',
                      icon: LayoutDashboard,
                      color: 'text-[#0B57D0]',
                    },
                    {
                      id: 'admin_panel',
                      label: 'Admin Access',
                      icon: ShieldCheck,
                      color: 'text-[#0B57D0]',
                    },
                    {
                      id: 'cmh_tasks',
                      label: 'Tasks',
                      icon: CheckSquare,
                      color: 'text-[#0B57D0]',
                    },
                    {
                      id: 'cmh_projects',
                      label: 'Projects',
                      icon: Briefcase,
                      color: 'text-[#7C3AED]',
                    },
                    {
                      id: 'cmh_forms',
                      label: 'Form Builder',
                      icon: Blocks,
                      color: 'text-[#0B57D0]',
                    },
                    { id: 'teams', label: 'Teams', icon: Users, color: 'text-[#059669]' },
                    {
                      id: 'posts',
                      label: 'Posts & Notices',
                      icon: Megaphone,
                      color: 'text-[#D97706]',
                    },
                    { id: 'docs', label: 'Docs', icon: FileText, color: 'text-[#2684FC]' },
                    {
                      id: 'forms',
                      label: 'Forms',
                      icon: ClipboardList,
                      color: 'text-[#673AB7]',
                    },
                    {
                      id: 'communication',
                      label: 'Communication',
                      icon: MessagesSquare,
                      color: 'text-emerald-600',
                    },
                    {
                      id: 'profile',
                      label: 'Profile',
                      icon: UserCheck,
                      color: 'text-[#0B57D0]',
                    },
                    {
                      id: 'settings',
                      label: 'Settings',
                      icon: Settings,
                      color: 'text-[#0B57D0]',
                    },
                    {
                      id: 'chat',
                      label: 'Team Chat',
                      icon: MessageSquare,
                      color: 'text-[#2563EB]',
                    },
                    { id: 'gmail', label: 'Gmail', icon: Mail, color: 'text-[#EA4335]' },
                    {
                      id: 'server_mail',
                      label: 'Server Mail',
                      icon: Server,
                      color: 'text-[#0B57D0]',
                    },
                    { id: 'bulk', label: 'Bulk Mail', icon: Layers, color: 'text-[#0B57D0]' },
                    { id: 'meet', label: 'Meet', icon: Video, color: 'text-[#00897B]' },
                    {
                      id: 'files',
                      label: 'File Manager',
                      icon: HardDrive,
                      color: 'text-[#0284C7]',
                    },
                    {
                      id: 'slides',
                      label: 'Slides',
                      icon: Presentation,
                      color: 'text-[#F59E0B]',
                    },
                    {
                      id: 'sheets',
                      label: 'Sheets',
                      icon: Table,
                      color: 'text-[#059669]',
                    },
                    {
                      id: 'calendar',
                      label: 'Calendar',
                      icon: Calendar,
                      color: 'text-[#2563EB]',
                    },
                    {
                      id: 'finance',
                      label: 'Finance',
                      icon: Receipt,
                      color: 'text-[#4F46E5]',
                    },
                    {
                      id: 'crm',
                      label: 'CRM & Tickets',
                      icon: UserCheck,
                      color: 'text-[#0284C7]',
                    },
                    {
                      id: 'hr',
                      label: 'HR & Payroll',
                      icon: Clock,
                      color: 'text-[#0D9488]',
                    },
                    {
                      id: 'wiki',
                      label: 'Wiki & SOPs',
                      icon: BookOpen,
                      color: 'text-[#D97706]',
                    },
                    {
                      id: 'automations',
                      label: 'Automations',
                      icon: Zap,
                      color: 'text-[#7C3AED]',
                    },
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
                              onClick={() => handleSwitchGmail(ga.email)}
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
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-2 px-3 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Disconnect Active Gmail</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleWorkspaceLogout}
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

      {authError && (
        <div className="bg-amber-50 dark:bg-amber-950/60 border-b border-amber-200 px-4 py-1.5 text-xs text-amber-800 flex items-center justify-between shrink-0">
          <span>{authError}</span>
          <button
            type="button"
            onClick={() => setAuthError(null)}
            className="font-semibold underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Body Area */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {isDesktopDrawerOpen && (
          <aside className="hidden md:block w-60 shrink-0 overflow-y-auto">
            {renderNavigationList(false)}
          </aside>
        )}

        <AnimatePresence>
          {isMobileDrawerOpen && (
            <div
              className="md:hidden fixed inset-0 z-50 flex"
              onTouchStart={(e) => {
                const touch = e.touches[0];
                if (touch) {
                  mobileDrawerTouchStartRef.current = { x: touch.clientX, y: touch.clientY };
                }
              }}
              onTouchEnd={(e) => {
                const start = mobileDrawerTouchStartRef.current;
                const touch = e.changedTouches[0];
                mobileDrawerTouchStartRef.current = null;
                if (!start || !touch) return;
                const dx = touch.clientX - start.x;
                const dy = Math.abs(touch.clientY - start.y);
                if (dx < -55 && Math.abs(dx) > dy * 1.2) {
                  setIsMobileDrawerOpen(false);
                }
              }}
            >
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px]"
                onClick={() => setIsMobileDrawerOpen(false)}
              />
              <motion.aside
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', stiffness: 360, damping: 32 }}
                drag="x"
                dragDirectionLock
                dragConstraints={{ left: -320, right: 0 }}
                dragElastic={{ left: 0.12, right: 0 }}
                onDragEnd={(_event, info) => {
                  if (info.offset.x < -64 || info.velocity.x < -280) {
                    setIsMobileDrawerOpen(false);
                  }
                }}
                style={{ touchAction: 'pan-y' }}
                className="relative w-72 max-w-[82vw] bg-[#F6F8FC] dark:bg-slate-900 h-full shadow-2xl flex flex-col z-10 overflow-hidden"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/80 dark:border-slate-800 shrink-0">
                  <div className="min-w-0">
                    <span className="text-base font-bold text-slate-800 dark:text-slate-100 block truncate">
                      {workspaceTitle}
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 block">
                      Swipe left to close
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMobileDrawerOpen(false)}
                    aria-label="Close navigation drawer"
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-200/60 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto overscroll-contain touch-pan-y">
                  {renderNavigationList(true)}
                </div>
              </motion.aside>
            </div>
          )}
        </AnimatePresence>

        {/* Active Module Viewport */}
        <main className="flex-1 min-w-0 min-h-0 pb-14 md:pb-3 md:pr-3 overflow-hidden flex flex-col">
          {activeModule === 'overview' && (
            <OverviewDashboardView
              workspaceTitle={workspaceTitle}
              gmailCount={gmailAccounts.length}
              serverMailCount={serverAccounts.length}
              onNavigateModule={(modId: WorkspaceModule, subTab?: string) => {
                setActiveModule(modId);
                if (modId === 'cmh_tasks' && subTab) setCmhTasksSubTab(subTab as CmhTasksSubTab);
                if (modId === 'cmh_projects' && subTab)
                  setCmhProjectsSubTab(subTab as CmhProjectsSubTab);
                if (modId === 'cmh_forms' && subTab)
                  setCmhFormsSubTab(subTab as CmhFormBuilderSubTab);
                if (modId === 'teams' && subTab) setTeamsSubTab(subTab as TeamsSubTab);
                if (modId === 'posts' && subTab) setPostsSubTab(subTab as PostsNoticesSubTab);
                if (modId === 'docs' && subTab) setDocsSubTab(subTab as DocsSubTab);
                if (modId === 'forms' && subTab) setFormsSubTab(subTab as FormsSubTab);
                if (modId === 'settings' && subTab) setSettingsSubTab(subTab as SettingsSubTab);
              }}
            />
          )}
          {activeModule === 'admin_panel' && (
            <AdminPanelView currentUser={wsUser} searchQuery={searchQuery} />
          )}
          {activeModule === 'gmail' && (
            <GmailView
              key={activeGmail || 'default'}
              isAuthenticated={isAuthenticated}
              accounts={gmailAccounts}
              activeAccountEmail={activeGmail}
              onSelectFolder={setActiveFolderId}
              onAccountsChanged={(updated, nextEmail) => {
                setGmailAccounts(updated);
                if (nextEmail !== undefined) {
                  setActiveGmail(nextEmail);
                  setToken(nextEmail);
                  setNeedsAuth(!nextEmail);
                }
              }}
              onRequireAuth={() => {
                setActiveModule('settings');
                setSettingsSubTab('accounts');
              }}
              onOpenBulkStudio={() => setActiveModule('bulk')}
              onSwitchToServerMail={() => setActiveModule('server_mail')}
              activeFolderId={activeFolderId}
              activeTabId={activeTabId}
              onSelectTab={setActiveTabId}
              searchQuery={searchQuery}
              customTabs={customTabs}
              onOpenAddTabModal={() => setIsAddTabModalOpen(true)}
              composeTriggerCount={composeTriggerCount}
              focusMessageId={focusGmailId}
              pendingFileAttachment={pendingFileAttachment}
              onClearPendingFile={() => setPendingFileAttachment(null)}
            />
          )}
          {activeModule === 'server_mail' && (
            <ServerMailView
              accounts={serverAccounts}
              activeAccountId={activeServerAccount?.id || null}
              onSelectAccount={(id) => setActiveServerAccountId(id)}
              onAccountsChanged={(updated, newId) => {
                setServerAccounts(updated);
                if (newId) setActiveServerAccountId(newId);
              }}
              activeFolder={activeServerFolder}
              onSelectFolder={setActiveServerFolder}
              searchQuery={searchQuery}
              composeTriggerCount={serverComposeTrigger}
              onOpenBulkStudio={() => setActiveModule('bulk')}
              onOpenSettingsAccounts={() => {
                setActiveModule('settings');
                setSettingsSubTab('accounts');
              }}
              realtimeIncomingMessage={realtimeServerMailMsg}
              focusMessageId={focusServerMailId}
              pendingFileAttachment={pendingFileAttachment}
              onClearPendingAttachment={() => setPendingFileAttachment(null)}
            />
          )}
          {activeModule === 'bulk' && (
            <BulkMailView
              isAuthenticated={isAuthenticated}
              activeGmailEmail={activeGmail}
              serverAccounts={serverAccounts}
              defaultChannel={activeServerAccount ? activeServerAccount.id : 'gmail'}
              onRequireAuth={() => handleGoogleSignIn(false)}
              initialTeamRecipients={initialTeamRecipients}
              onClearInitialTeamRecipients={() => setInitialTeamRecipients(null)}
            />
          )}
          {activeModule === 'teams' && (
            <TeamsView
              activeSubTab={teamsSubTab}
              onSelectSubTab={setTeamsSubTab}
              serverAccounts={serverAccounts}
              activeServerAccountId={activeServerAccount?.id || null}
              isAuthenticated={isAuthenticated}
              onPreviewMemberInvite={(mId: string) => setPreviewMemberInviteId(mId)}
              onViewMemberProfile={(mId: string) => {
                setViewingProfileMemberId(mId);
                setActiveModule('profile');
                setIsDesktopDrawerOpen(false);
              }}
              onMessageMember={(mId: string) => {
                setCommunicationTargetUserId(mId);
                setActiveModule('communication');
                setIsDesktopDrawerOpen(false);
              }}
              onEmailTeamMembers={(teamMembers: WorkspaceMemberItem[], teamName: string) => {
                setInitialTeamRecipients(
                  teamMembers.map((m) => ({
                    email: m.email,
                    name: m.fullName,
                    company: `${teamName} · ${m.designation}`,
                  }))
                );
                setActiveModule('bulk');
              }}
            />
          )}
          {activeModule === 'posts' && (
            <PostsNoticesView
              activeSubTab={postsSubTab}
              onSelectSubTab={setPostsSubTab}
              defaultAuthorName={wsUser.name || user?.displayName || activeServerAccount?.label || 'Administrator'}
            />
          )}
          {activeModule === 'files' && (
            <FileManagerView
              activeSubTab={filesSubTab}
              onSelectSubTab={setFilesSubTab}
              onSendFileViaMail={(file: WorkspaceFileItem) => {
                setPendingFileAttachment(file);
                if (serverAccounts.length > 0) {
                  setActiveModule('server_mail');
                } else {
                  setActiveModule('gmail');
                }
              }}
            />
          )}
          {activeModule === 'docs' && (
            <DocsView
              isAuthenticated={isAuthenticated}
              onRequireAuth={() => handleGoogleSignIn(false)}
              activeSubTab={docsSubTab}
              onSelectSubTab={setDocsSubTab}
            />
          )}
          {activeModule === 'slides' && (
            <SlidesView
              subTab={slidesSubTab}
              onSubTabChange={setSlidesSubTab}
              globalSearchQuery={searchQuery}
            />
          )}
          {activeModule === 'forms' && (
            <FormsView
              isAuthenticated={isAuthenticated}
              onRequireAuth={() => handleGoogleSignIn(false)}
              onPreviewPublicForm={(fId) => setPreviewPublicFormId(fId)}
              activeSubTab={formsSubTab}
              onSelectSubTab={setFormsSubTab}
            />
          )}
          {activeModule === 'meet' && (
            <MeetView
              isAuthenticated={isAuthenticated}
              onRequireAuth={() => handleGoogleSignIn(false)}
              activeSubTab={meetSubTab}
              onSelectSubTab={setMeetSubTab}
            />
          )}
          {activeModule === 'cmh_tasks' && (
            <CmhTasksView
              activeSubTab={cmhTasksSubTab}
              onSubTabChange={setCmhTasksSubTab}
              searchQuery={searchQuery}
              onOpenPublicCmhPreview={(param) => setPreviewCmhParam(param)}
              onNavigateToFormBuilder={() => {
                setActiveModule('cmh_forms');
                setCmhFormsSubTab('builder');
              }}
            />
          )}
          {activeModule === 'cmh_projects' && (
            <CmhProjectsView
              activeSubTab={cmhProjectsSubTab}
              onSubTabChange={setCmhProjectsSubTab}
              searchQuery={searchQuery}
              onOpenPublicCmhPreview={(param) => setPreviewCmhParam(param)}
              onNavigateToFormBuilder={() => {
                setActiveModule('cmh_forms');
                setCmhFormsSubTab('builder');
              }}
            />
          )}
          {activeModule === 'cmh_forms' && (
            <CmhFormBuilderView
              activeSubTab={cmhFormsSubTab}
              onSubTabChange={setCmhFormsSubTab}
              searchQuery={searchQuery}
              onOpenPublicCmhPreview={(param) => setPreviewCmhParam(param)}
            />
          )}
          {activeModule === 'sheets' && (
            <SheetsView activeSubTab={sheetsSubTab} onSubTabChange={setSheetsSubTab} />
          )}
          {activeModule === 'calendar' && (
            <CalendarView activeSubTab={calendarSubTab} onSubTabChange={setCalendarSubTab} />
          )}
          {activeModule === 'finance' && (
            <FinanceView activeSubTab={financeSubTab} onSubTabChange={setFinanceSubTab} />
          )}
          {activeModule === 'crm' && (
            <CrmTicketsView activeSubTab={crmSubTab} onSubTabChange={setCrmSubTab} />
          )}
          {activeModule === 'hr' && (
            <HrManagementView activeSubTab={hrSubTab} onSubTabChange={setHrSubTab} />
          )}
          {activeModule === 'chat' && (
            <TeamChatView
              activeSubTab={chatSubTab}
              onSubTabChange={setChatSubTab}
              currentUserEmail={activeServerAccount?.email || activeGmail || wsUser.email}
            />
          )}
          {activeModule === 'wiki' && (
            <WikiKnowledgeView activeSubTab={wikiSubTab} onSubTabChange={setWikiSubTab} />
          )}
          {activeModule === 'automations' && (
            <AutomationEngineView
              activeSubTab={automationsSubTab}
              onSubTabChange={setAutomationsSubTab}
            />
          )}
          {activeModule === 'communication' && (
            <CommunicationView
              currentUserId={wsUser.id}
              currentUserRole={wsUser.role}
              initialTargetUserId={communicationTargetUserId}
            />
          )}
          {activeModule === 'profile' && (
            <ExecutiveProfileView
              viewingMemberId={viewingProfileMemberId}
              onBackToTeams={() => {
                setViewingProfileMemberId(null);
                setActiveModule('teams');
              }}
              currentUserRole={wsUser.role}
              currentUser={wsUser}
            />
          )}
          {activeModule === 'settings' && (
            <SettingsView
              activeSubTab={settingsSubTab}
              onSelectSubTab={setSettingsSubTab}
              gmailAccounts={gmailAccounts}
              activeGmailEmail={activeGmail}
              onGmailAccountsChanged={(updated, nextEmail) => {
                setGmailAccounts(updated);
                if (nextEmail !== undefined) {
                  setActiveGmail(nextEmail);
                  setToken(nextEmail);
                  setNeedsAuth(!nextEmail);
                }
              }}
              serverAccounts={serverAccounts}
              activeServerAccountId={activeServerAccount?.id || null}
              onSelectServerAccount={(id) => setActiveServerAccountId(id)}
              onServerAccountsChanged={(updated, nextId) => {
                setServerAccounts(updated);
                if (nextId !== undefined) {
                  setActiveServerAccountId(nextId);
                }
              }}
              customTabs={customTabs}
              onCustomTabsChanged={setCustomTabs}
              onOpenModule={(mod) => {
                if (mod === 'gmail') {
                  setActiveModule('gmail');
                  setActiveFolderId('inbox');
                } else if (mod === 'server_mail') {
                  setActiveModule('server_mail');
                  setActiveServerFolder('inbox');
                } else if (mod === 'bulk') {
                  setActiveModule('bulk');
                }
              }}
              onWorkspaceNameChanged={(title) => {
                if (title) {
                  setWorkspaceTitle(title);
                  document.title = title;
                }
              }}
            />
          )}
        </main>
      </div>

      {/* Live Urgent Floating Notification Popup (Click to jump straight to the email/event) */}
      {liveToastNotif && (
        <div className="fixed top-16 right-4 z-50 w-80 sm:w-96 rounded-2xl bg-slate-900 text-white shadow-2xl border border-slate-700 p-3.5 flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={() => handleOpenNotificationItem(liveToastNotif)}
            className="flex items-start gap-3 text-left min-w-0 flex-1"
          >
            <div className="w-8 h-8 rounded-xl bg-[#0B57D0] text-white flex items-center justify-center shrink-0 mt-0.5">
              <Bell className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold truncate">{liveToastNotif.title}</div>
              <div className="text-[11px] text-slate-300 line-clamp-2 mt-0.5">
                {liveToastNotif.description}
              </div>
              <div className="text-[10px] text-blue-300 font-semibold mt-1">
                Click to view →
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setLiveToastNotif(null)}
            className="p-1 text-slate-400 hover:text-white shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Frosted Glassmorphism Mobile Bottom Navigation: Strictly Post, Project, Task, Team Profile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200/80 dark:border-slate-800 grid grid-cols-4 items-center px-2 z-30">
        {[
          { id: 'posts', label: 'Post', icon: Megaphone },
          { id: 'cmh_projects', label: 'Project', icon: Briefcase },
          { id: 'cmh_tasks', label: 'Task', icon: CheckSquare },
          { id: 'teams', label: 'Team Profile', icon: Users },
        ].map((item) => {
          const Icon = item.icon;
          const active = activeModule === item.id;
          return (
            <motion.button
              key={item.id}
              whileTap={{ scale: 0.93 }}
              type="button"
              onClick={() => {
                setActiveModule(item.id as WorkspaceModule);
                if (item.id === 'posts') setPostsSubTab('feed');
                if (item.id === 'cmh_projects') setCmhProjectsSubTab('all_projects');
                if (item.id === 'cmh_tasks') setCmhTasksSubTab('all_tasks');
                if (item.id === 'teams') setTeamsSubTab('all_members');
              }}
              className={`relative flex flex-col items-center justify-center py-1.5 rounded-xl text-[11px] transition-all whitespace-nowrap z-10 ${
                active
                  ? 'text-[#0B57D0] dark:text-blue-400 font-extrabold'
                  : 'text-slate-500 dark:text-slate-400 font-semibold hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="adminBottomNavActive"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  className="absolute inset-0 rounded-xl bg-blue-50/90 dark:bg-blue-950/50 -z-10"
                />
              )}
              {active && (
                <span className="absolute -top-1 w-6 h-0.5 rounded-full bg-[#0B57D0] dark:bg-blue-400" />
              )}
              <Icon className="w-4 h-4 mb-0.5" />
              <span>{item.label}</span>
            </motion.button>
          );
        })}
      </nav>

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
    </div>
  );
}
