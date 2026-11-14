/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback, startTransition, lazy, Suspense } from 'react';
import { Bell, X } from 'lucide-react';
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
  fetchSystemSettings,
  fetchWorkspaceTeamsAndMembers,
} from './services/workspaceApi';
import type { ServerMailFolder } from './components/mail/ServerMailView';
import type { DocsSubTab } from './components/docs/DocsView';
import type { SlidesSubTab } from './components/slides/SlidesView';
import type { FormsSubTab } from './components/forms/FormsView';
import type { MeetSubTab } from './components/meetings/MeetView';
import type { TeamsSubTab } from './components/team/TeamsView';
import type { PostsNoticesSubTab } from './components/posts/PostsNoticesView';
import type { FileManagerSubTab } from './components/filemanager/FileManagerView';
import type { CmhTasksSubTab } from './components/cmh/CmhTasksView';
import type { CmhProjectsSubTab } from './components/cmh/CmhProjectsView';
import type { CmhFormBuilderSubTab } from './components/cmh/CmhFormBuilderView';
import type { SettingsSubTab } from './components/settings/SettingsView';
import type { SheetsSubTab } from './components/sheets/SheetsView';
import type { CalendarSubTab } from './components/calendar/CalendarView';
import type { FinanceSubTab } from './components/finance/FinanceView';
import type { CrmSubTab } from './components/crm/CrmTicketsView';
import type { HrSubTab } from './components/hr/HrManagementView';
import type { ChatSubTab } from './components/team/TeamChatView';
import type { WikiSubTab } from './components/wiki/WikiKnowledgeView';
import type { AutomationSubTab } from './components/automation/AutomationEngineView';
import { subscribeWorkspaceEvents } from './services/realtimeBus';
import {
  type EvaluatedCapabilitiesClient,
  fetchWorkspaceSession,
  logoutWorkspaceAccount,
  type WorkspaceAuthUser,
} from './services/workspaceAuth';

import {
  WorkspaceModule,
  AppHeader,
  AppSidebar,
  AppMobileNav,
  AppGlobalModals,
  AppModuleRouter,
} from './components/layout';

const PublicFormView = lazy(() =>
  import('./components/public/PublicFormView').then((m) => ({ default: m.PublicFormView }))
);
const PublicMemberInviteView = lazy(() =>
  import('./components/public/PublicMemberInviteView').then((m) => ({ default: m.PublicMemberInviteView }))
);
const PublicCmhPortalView = lazy(() =>
  import('./components/public/PublicCmhPortalView').then((m) => ({ default: m.PublicCmhPortalView }))
);
const SimpleDashboardView = lazy(() =>
  import('./components/dashboard/SimpleDashboardView').then((m) => ({ default: m.SimpleDashboardView }))
);
const MemberPortalShell = lazy(() =>
  import('./components/member/MemberPortalShell').then((m) => ({ default: m.MemberPortalShell }))
);



export default function App() {
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

  const [activeModule, setActiveModuleState] = useState<WorkspaceModule>('overview');
  const setActiveModule = useCallback<React.Dispatch<React.SetStateAction<WorkspaceModule>>>((next) => {
    // Keep the current page mounted until the next lazy module is ready.
    startTransition(() => setActiveModuleState(next));
  }, []);
  const landingApplied = useRef(false);
  const [feedSource, setFeedSource] = useState<{ type: string; id: string } | null>(null);
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
  const [isAppsSectionExpanded, setIsAppsSectionExpanded] = useState<boolean>(true);
  const [isCmhSectionExpanded, setIsCmhSectionExpanded] = useState<boolean>(true);
  const [isMoreToolsExpanded, setIsMoreToolsExpanded] = useState<boolean>(false);

  // Module-Specific Sub-Navigation State
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

  // Appearance, Themes & Notifications
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

  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    root.setAttribute('data-accent', accentTheme);
  }, [isDarkMode, accentTheme]);

  useEffect(() => {
    const MORE_TOOLS_MODULES: WorkspaceModule[] = [
      'cmh_forms',
      'docs',
      'forms',
      'chat',
      'bulk',
      'meet',
      'files',
      'slides',
      'sheets',
      'calendar',
      'finance',
      'crm',
      'hr',
      'wiki',
      'automations',
    ];
    if (MORE_TOOLS_MODULES.includes(activeModule)) {
      setIsMoreToolsExpanded(true);
    }
  }, [activeModule]);

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

    fetchServerMailAccounts()
      .then((loaded) => {
        setServerAccounts(loaded);
        if (loaded.length > 0) {
          setActiveServerAccountId(loaded[0].id);
        }
      })
      .catch(() => {});

    fetchCustomMailTabs()
      .then((tabs) => setCustomTabs(tabs))
      .catch(() => {});

    fetchNotifications()
      .then((loadedNotifs) => setNotifications(loadedNotifs))
      .catch(() => {});

    fetchSystemSettings()
      .then((res) => {
        if (!landingApplied.current && res.settings?.defaultLandingModule) {
          const supported = ['main_feed', 'overview', 'cmh_tasks', 'cmh_projects', 'gmail', 'server_mail'];
          const configured = res.settings.defaultLandingModule;
          if (supported.includes(configured)) {
            setActiveModule((current) => current === 'overview' ? configured as WorkspaceModule : current);
          }
          landingApplied.current = true;
        }
        if (res.settings?.workspaceName) {
          setWorkspaceTitle(res.settings.workspaceName);
          document.title = res.settings.workspaceName;
        }
      })
      .catch(() => {});

    fetchWorkspaceTeamsAndMembers().catch(() => {});

    const unsubRealtime = subscribeWorkspaceEvents((eventName, payload) => {
      if (eventName === 'notification:new' && payload) {
        setNotifications((prev) =>
          prev.some((n) => n.id === payload.id) ? prev : [payload, ...prev].slice(0, 60)
        );
      } else if (eventName === 'notification:read') {
        if (payload?.id) {
          setNotifications((prev) =>
            prev.map((n) => (n.id === payload.id ? { ...n, isRead: true } : n))
          );
        }
      } else if (eventName === 'notification:cleared') {
        setNotifications([]);
      } else if (eventName === 'mail:arrived' && payload?.message) {
        setRealtimeServerMailMsg(payload.message);
      }
    });

    return () => {
      unsubscribe();
      unsubRealtime();
    };
  }, [wsUser?.id, wsUser?.role]);

  const handleGoogleSignIn = (_selectAnother = false) => {
    setActiveModule('settings');
    setSettingsSubTab('accounts');
  };

  const handleSwitchGmail = (email: string) => {
    const switched = switchActiveGmailAccount(email);
    if (switched) {
      setActiveGmail(switched.email);
      setToken(switched.accessToken);
      setNeedsAuth(false);
      setActiveModule('gmail');
      setActiveFolderId('inbox');
    }
  };

  const handleSignOut = async () => {
    await logout();
    setUser(null);
    setToken(null);
    setGmailAccounts([]);
    setActiveGmail(null);
    setNeedsAuth(true);
  };

  const handleWorkspaceLogout = async () => {
    await logoutWorkspaceAccount().catch(() => {});
    setWsUser(null);
    setWsCapabilities(null);
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

  const handleOpenNotificationItem = (notif: WorkspaceNotification) => {
    markNotificationsRead(notif.id)
      .then((updated) => setNotifications(updated))
      .catch(() => {});
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

  const isAuthenticated = Boolean(!needsAuth && token);
  const activeServerAccount =
    serverAccounts.find((a) => a.id === activeServerAccountId) || serverAccounts[0] || null;

  // Universal Public Form Responder Mode
  if (publicFormIdFromUrl || previewPublicFormId) {
    const activeFormId = previewPublicFormId || publicFormIdFromUrl!;
    return (
      <Suspense fallback={null}>
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
      </Suspense>
    );
  }

  // Universal Member Profile Invitation Portal (?invite=<memberId>)
  if (publicInviteIdFromUrl || previewMemberInviteId) {
    const activeInviteId = previewMemberInviteId || publicInviteIdFromUrl!;
    return (
      <Suspense fallback={null}>
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
      </Suspense>
    );
  }

  // Universal CMH App Form, Task & Project Shareable Link Portal (?cmh=form:<id> | task:<id> | project:<id>)
  if (publicCmhFromUrl || previewCmhParam) {
    const activeCmhParam = previewCmhParam || publicCmhFromUrl!;
    return (
      <Suspense fallback={null}>
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
      </Suspense>
    );
  }

  if (wsSessionLoading) {
    return null;
  }

  // Public Landing Dashboard
  if (appInviteTokenFromUrl || !wsUser || !wsCapabilities) {
    return (
      <Suspense fallback={null}>
        <SimpleDashboardView
          inviteToken={appInviteTokenFromUrl}
          onAuthenticated={(authedUser, caps) => {
            setWsUser(authedUser);
            setWsCapabilities(caps);
            setAppInviteTokenFromUrl(null);
            setActiveModule('overview');
          }}
        />
      </Suspense>
    );
  }

  // Member Dashboard UI
  if (wsUser.role === 'MEMBER' || wsCapabilities.isMember) {
    return (
      <Suspense fallback={null}>
        <MemberPortalShell
          user={wsUser}
          capabilities={wsCapabilities}
          onLogout={handleWorkspaceLogout}
          onUserUpdated={(updatedUser, updatedCaps) => {
            setWsUser(updatedUser);
            if (updatedCaps) setWsCapabilities(updatedCaps);
          }}
        />
      </Suspense>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#F8FAFC] dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden">
      <AppHeader
        activeModule={activeModule}
        setActiveModule={setActiveModule}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        handleToggleHamburger={handleToggleHamburger}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        accentTheme={accentTheme}
        setAccentTheme={setAccentTheme}
        notifications={notifications}
        setNotifications={setNotifications}
        onOpenNotificationItem={handleOpenNotificationItem}
        wsUser={wsUser}
        handleWorkspaceLogout={handleWorkspaceLogout}
        gmailAccounts={gmailAccounts}
        activeGmail={activeGmail}
        handleSwitchGmail={handleSwitchGmail}
        serverAccounts={serverAccounts}
        activeServerAccount={activeServerAccount}
        setActiveServerAccountId={setActiveServerAccountId}
        setActiveFolderId={setActiveFolderId}
        setActiveServerFolder={setActiveServerFolder}
        setViewingProfileMemberId={setViewingProfileMemberId}
        setIsDesktopDrawerOpen={setIsDesktopDrawerOpen}
        setSettingsSubTab={setSettingsSubTab}
        setCmhTasksSubTab={setCmhTasksSubTab}
        setCmhProjectsSubTab={setCmhProjectsSubTab}
        setCmhFormsSubTab={setCmhFormsSubTab}
        setTeamsSubTab={setTeamsSubTab}
        setPostsSubTab={setPostsSubTab}
        setFinanceSubTab={setFinanceSubTab}
        isAuthenticated={isAuthenticated}
        handleSignOut={handleSignOut}
      />

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
        <AppSidebar
          isDesktopDrawerOpen={isDesktopDrawerOpen}
          activeModule={activeModule}
          setActiveModule={setActiveModule}
          isCmhSectionExpanded={isCmhSectionExpanded}
          setIsCmhSectionExpanded={setIsCmhSectionExpanded}
          isAppsSectionExpanded={isAppsSectionExpanded}
          setIsAppsSectionExpanded={setIsAppsSectionExpanded}
          isMoreToolsExpanded={isMoreToolsExpanded}
          setIsMoreToolsExpanded={setIsMoreToolsExpanded}
          activeServerAccount={activeServerAccount}
          activeServerFolder={activeServerFolder}
          setActiveServerFolder={setActiveServerFolder}
          activeFolderId={activeFolderId}
          setActiveFolderId={setActiveFolderId}
          activeTabId={activeTabId}
          setActiveTabId={setActiveTabId}
          customTabs={customTabs}
          setIsAddTabModalOpen={setIsAddTabModalOpen}
          handleRemoveCustomTab={handleRemoveCustomTab}
          setServerComposeTrigger={setServerComposeTrigger}
          setComposeTriggerCount={setComposeTriggerCount}
          setIsMobileDrawerOpen={setIsMobileDrawerOpen}
          setIsDesktopDrawerOpen={setIsDesktopDrawerOpen}
          setViewingProfileMemberId={setViewingProfileMemberId}
          setCmhTasksSubTab={setCmhTasksSubTab}
          setCmhProjectsSubTab={setCmhProjectsSubTab}
          setCmhFormsSubTab={setCmhFormsSubTab}
          setTeamsSubTab={setTeamsSubTab}
          setPostsSubTab={setPostsSubTab}
          setFilesSubTab={setFilesSubTab}
          setDocsSubTab={setDocsSubTab}
          setSlidesSubTab={setSlidesSubTab}
          setFormsSubTab={setFormsSubTab}
          setMeetSubTab={setMeetSubTab}
          setSheetsSubTab={setSheetsSubTab}
          setCalendarSubTab={setCalendarSubTab}
          setFinanceSubTab={setFinanceSubTab}
          setCrmSubTab={setCrmSubTab}
          setHrSubTab={setHrSubTab}
          setChatSubTab={setChatSubTab}
          setWikiSubTab={setWikiSubTab}
          setAutomationsSubTab={setAutomationsSubTab}
          setSettingsSubTab={setSettingsSubTab}
        />

        <AppMobileNav
          isMobileDrawerOpen={isMobileDrawerOpen}
          setIsMobileDrawerOpen={setIsMobileDrawerOpen}
          workspaceTitle={workspaceTitle}
          activeModule={activeModule}
          setActiveModule={setActiveModule}
          isCmhSectionExpanded={isCmhSectionExpanded}
          setIsCmhSectionExpanded={setIsCmhSectionExpanded}
          isAppsSectionExpanded={isAppsSectionExpanded}
          setIsAppsSectionExpanded={setIsAppsSectionExpanded}
          isMoreToolsExpanded={isMoreToolsExpanded}
          setIsMoreToolsExpanded={setIsMoreToolsExpanded}
          activeServerAccount={activeServerAccount}
          activeServerFolder={activeServerFolder}
          setActiveServerFolder={setActiveServerFolder}
          activeFolderId={activeFolderId}
          setActiveFolderId={setActiveFolderId}
          activeTabId={activeTabId}
          setActiveTabId={setActiveTabId}
          customTabs={customTabs}
          setIsAddTabModalOpen={setIsAddTabModalOpen}
          handleRemoveCustomTab={handleRemoveCustomTab}
          setServerComposeTrigger={setServerComposeTrigger}
          setComposeTriggerCount={setComposeTriggerCount}
          setIsDesktopDrawerOpen={setIsDesktopDrawerOpen}
          setViewingProfileMemberId={setViewingProfileMemberId}
          setCmhTasksSubTab={setCmhTasksSubTab}
          setCmhProjectsSubTab={setCmhProjectsSubTab}
          setCmhFormsSubTab={setCmhFormsSubTab}
          setTeamsSubTab={setTeamsSubTab}
          setPostsSubTab={setPostsSubTab}
          setFilesSubTab={setFilesSubTab}
          setDocsSubTab={setDocsSubTab}
          setSlidesSubTab={setSlidesSubTab}
          setFormsSubTab={setFormsSubTab}
          setMeetSubTab={setMeetSubTab}
          setSheetsSubTab={setSheetsSubTab}
          setCalendarSubTab={setCalendarSubTab}
          setFinanceSubTab={setFinanceSubTab}
          setCrmSubTab={setCrmSubTab}
          setHrSubTab={setHrSubTab}
          setChatSubTab={setChatSubTab}
          setWikiSubTab={setWikiSubTab}
          setAutomationsSubTab={setAutomationsSubTab}
          setSettingsSubTab={setSettingsSubTab}
        />

        <AppModuleRouter
          activeModule={activeModule}
          setActiveModule={setActiveModule}
          workspaceTitle={workspaceTitle}
          setWorkspaceTitle={setWorkspaceTitle}
          wsUser={wsUser}
          user={user}
          gmailAccounts={gmailAccounts}
          setGmailAccounts={setGmailAccounts}
          activeGmail={activeGmail}
          setActiveGmail={setActiveGmail}
          isAuthenticated={isAuthenticated}
          setToken={setToken}
          setNeedsAuth={setNeedsAuth}
          handleGoogleSignIn={handleGoogleSignIn}
          serverAccounts={serverAccounts}
          setServerAccounts={setServerAccounts}
          activeServerAccount={activeServerAccount}
          setActiveServerAccountId={setActiveServerAccountId}
          activeServerFolder={activeServerFolder}
          setActiveServerFolder={setActiveServerFolder}
          serverComposeTrigger={serverComposeTrigger}
          activeFolderId={activeFolderId}
          setActiveFolderId={setActiveFolderId}
          activeTabId={activeTabId}
          setActiveTabId={setActiveTabId}
          searchQuery={searchQuery}
          customTabs={customTabs}
          setCustomTabs={setCustomTabs}
          setIsAddTabModalOpen={setIsAddTabModalOpen}
          composeTriggerCount={composeTriggerCount}
          focusGmailId={focusGmailId}
          focusServerMailId={focusServerMailId}
          pendingFileAttachment={pendingFileAttachment}
          setPendingFileAttachment={setPendingFileAttachment}
          realtimeServerMailMsg={realtimeServerMailMsg}
          initialTeamRecipients={initialTeamRecipients}
          setInitialTeamRecipients={setInitialTeamRecipients}
          setPreviewMemberInviteId={setPreviewMemberInviteId}
          setPreviewPublicFormId={setPreviewPublicFormId}
          setPreviewCmhParam={setPreviewCmhParam}
          viewingProfileMemberId={viewingProfileMemberId}
          setViewingProfileMemberId={setViewingProfileMemberId}
          communicationTargetUserId={communicationTargetUserId}
          setCommunicationTargetUserId={setCommunicationTargetUserId}
          setIsDesktopDrawerOpen={setIsDesktopDrawerOpen}
          feedSource={feedSource}
          setFeedSource={setFeedSource}
          teamsSubTab={teamsSubTab}
          setTeamsSubTab={setTeamsSubTab}
          postsSubTab={postsSubTab}
          setPostsSubTab={setPostsSubTab}
          filesSubTab={filesSubTab}
          setFilesSubTab={setFilesSubTab}
          docsSubTab={docsSubTab}
          setDocsSubTab={setDocsSubTab}
          slidesSubTab={slidesSubTab}
          setSlidesSubTab={setSlidesSubTab}
          formsSubTab={formsSubTab}
          setFormsSubTab={setFormsSubTab}
          meetSubTab={meetSubTab}
          setMeetSubTab={setMeetSubTab}
          cmhTasksSubTab={cmhTasksSubTab}
          setCmhTasksSubTab={setCmhTasksSubTab}
          cmhProjectsSubTab={cmhProjectsSubTab}
          setCmhProjectsSubTab={setCmhProjectsSubTab}
          cmhFormsSubTab={cmhFormsSubTab}
          setCmhFormsSubTab={setCmhFormsSubTab}
          sheetsSubTab={sheetsSubTab}
          setSheetsSubTab={setSheetsSubTab}
          calendarSubTab={calendarSubTab}
          setCalendarSubTab={setCalendarSubTab}
          financeSubTab={financeSubTab}
          setFinanceSubTab={setFinanceSubTab}
          crmSubTab={crmSubTab}
          setCrmSubTab={setCrmSubTab}
          hrSubTab={hrSubTab}
          setHrSubTab={setHrSubTab}
          chatSubTab={chatSubTab}
          setChatSubTab={setChatSubTab}
          wikiSubTab={wikiSubTab}
          setWikiSubTab={setWikiSubTab}
          automationsSubTab={automationsSubTab}
          setAutomationsSubTab={setAutomationsSubTab}
          settingsSubTab={settingsSubTab}
          setSettingsSubTab={setSettingsSubTab}
        />
      </div>

      {/* Live Urgent Floating Notification Popup */}
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
                Click to view â†’
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

      <AppGlobalModals
        isAddTabModalOpen={isAddTabModalOpen}
        setIsAddTabModalOpen={setIsAddTabModalOpen}
        newTabName={newTabName}
        setNewTabName={setNewTabName}
        newTabQuery={newTabQuery}
        setNewTabQuery={setNewTabQuery}
        handleCreateCustomTab={handleCreateCustomTab}
        wsUser={wsUser}
        activeModule={activeModule}
        setActiveModule={setActiveModule}
        setIsDesktopDrawerOpen={setIsDesktopDrawerOpen}
        setIsMobileDrawerOpen={setIsMobileDrawerOpen}
      />
    </div>
  );
}


