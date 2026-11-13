import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronDown,
  ChevronRight,
  Eye,
  HardDrive,
  LayoutGrid,
  LogOut,
  Menu,
  Palette,
  Search,
  ShieldCheck,
  Sparkles,
  User as UserIcon,
  UserCheck,
  X,
} from 'lucide-react';
import { subscribeWorkspaceEvents } from '../../services/realtimeBus';
import { ExecutiveProfileView } from '../profile/ExecutiveProfileView';
import { CommunicationView } from '../communication/CommunicationView';
import { FloatingMessengerWidget } from '../communication/FloatingMessengerWidget';
import type {
  EvaluatedCapabilitiesClient,
  MemberThemeKey,
  WorkspaceAuthUser,
} from '../../services/workspaceAuth';
import {
  fetchMemberPortalBootstrap,
  updateMyMemberPreferences,
} from '../../services/workspaceAuth';
import {
  MemberAccountSettingsView,
  MemberBootstrapData,
  MemberChatView,
  MemberDocsView,
  MemberFilesView,
  MemberFormsView,
  MemberHomeView,
  MemberPostsView,
  MemberProjectsView,
  MemberRestrictedNotice,
  MemberSlidesView,
  MemberTasksView,
  MemberTeamsView,
  MODULE_APP_CATALOG,
} from './MemberSubViews';

interface MemberPortalShellProps {
  user: WorkspaceAuthUser;
  capabilities: EvaluatedCapabilitiesClient;
  previewSnapshot?: MemberBootstrapData | null;
  readOnlyPreview?: boolean;
  onLogout: () => Promise<void> | void;
  onUserUpdated?: (user: WorkspaceAuthUser, capabilities?: EvaluatedCapabilitiesClient) => void;
}

const THEME_OPTIONS: Array<{
  key: MemberThemeKey;
  label: string;
  swatch: string;
}> = [
  { key: 'cloud', label: 'Porcelain', swatch: '#4f46e5' },
  { key: 'mint', label: 'Seafoam', swatch: '#0d9488' },
  { key: 'lavender', label: 'Pearl Iris', swatch: '#7c3aed' },
];

export const MemberPortalShell: React.FC<MemberPortalShellProps> = ({
  user,
  capabilities,
  previewSnapshot,
  readOnlyPreview = false,
  onLogout,
  onUserUpdated,
}) => {
  const [data, setData] = useState<MemberBootstrapData | null>(previewSnapshot || null);
  const [loading, setLoading] = useState<boolean>(!previewSnapshot);
  const [activeTheme, setActiveTheme] = useState<MemberThemeKey>(
    (user.memberTheme as MemberThemeKey) || 'cloud'
  );
  const [activeModule, setActiveModule] = useState<string>(() =>
    capabilities.allowedModules.includes('overview')
      ? 'overview'
      : capabilities.allowedModules[0] || 'overview'
  );
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Shell Drawer & Dropdown State (Mirrors Admin Executive Navigation Model)
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isWorkspaceExpanded, setIsWorkspaceExpanded] = useState(true);
  const [isToolsExpanded, setIsToolsExpanded] = useState(true);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [isAppGridOpen, setIsAppGridOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const [toast, setToast] = useState<{ message: string; isError?: boolean } | null>(null);

  const themeMenuRef = useRef<HTMLDivElement>(null);
  const appGridRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const notify = useCallback((message: string, isError = false) => {
    setToast({ message, isError });
    window.setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target as Node)) {
        setIsThemeMenuOpen(false);
      }
      if (appGridRef.current && !appGridRef.current.contains(e.target as Node)) {
        setIsAppGridOpen(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadBootstrap = useCallback(async () => {
    if (previewSnapshot) {
      setData(previewSnapshot);
      setLoading(false);
      return;
    }
    try {
      const payload = (await fetchMemberPortalBootstrap()) as MemberBootstrapData;
      setData(payload);
      setActiveTheme((payload.user.memberTheme as MemberThemeKey) || 'cloud');
      onUserUpdated?.(
        {
          ...payload.user,
          usedStorageBytes: payload.storage.usedBytes,
        },
        payload.capabilities
      );
      if (
        activeModule !== 'account' &&
        payload.capabilities.allowedModules.length > 0 &&
        !payload.capabilities.allowedModules.includes(activeModule)
      ) {
        setActiveModule(payload.capabilities.allowedModules[0]);
      }
    } catch (err: any) {
      notify(err.message || 'Could not load your workspace.', true);
    } finally {
      setLoading(false);
    }
  }, [previewSnapshot, activeModule, notify, onUserUpdated]);

  useEffect(() => {
    if (previewSnapshot) {
      setData(previewSnapshot);
      setActiveTheme((previewSnapshot.user.memberTheme as MemberThemeKey) || 'cloud');
      setLoading(false);
      return;
    }
    loadBootstrap();
    const unsubscribe = subscribeWorkspaceEvents((eventName) => {
      if (
        eventName === 'members:updated' ||
        eventName === 'cmh:updated' ||
        eventName === 'auth:permissions_updated' ||
        eventName === 'workspace:updated'
      ) {
        loadBootstrap();
      }
    });
    return unsubscribe;
  }, [previewSnapshot, loadBootstrap]);



  const effectiveCaps = data?.capabilities || capabilities;
  const effectiveUser = data?.user || user;

  const allowedApps = useMemo(
    () => MODULE_APP_CATALOG.filter((m) => effectiveCaps.allowedModules.includes(m.id)),
    [effectiveCaps.allowedModules]
  );

  const workspaceMenuApps = useMemo(
    () => allowedApps.filter((a) => a.section === 'workspace'),
    [allowedApps]
  );
  const toolsMenuApps = useMemo(
    () => allowedApps.filter((a) => a.section === 'tools'),
    [allowedApps]
  );

  const bottomMobileApps = useMemo(() => {
    const order = ['overview', 'posts', 'cmh_projects', 'cmh_tasks', 'chat', 'files'];
    const sorted = [...allowedApps].sort(
      (a, b) =>
        (order.indexOf(a.id) === -1 ? 99 : order.indexOf(a.id)) -
        (order.indexOf(b.id) === -1 ? 99 : order.indexOf(b.id))
    );
    return sorted.slice(0, 4);
  }, [allowedApps]);

  const currentHeaderMeta =
    activeModule === 'profile'
      ? { label: 'Executive Profile & CV', icon: UserCheck }
      : activeModule === 'account'
      ? { label: 'Account & Security', icon: UserIcon }
      : MODULE_APP_CATALOG.find((m) => m.id === activeModule) || MODULE_APP_CATALOG[0];

  const ActiveHeaderIcon = currentHeaderMeta.icon;

  const handleToggleSidebar = () => {
    if (window.innerWidth < 768) {
      setIsMobileDrawerOpen((prev) => !prev);
    } else {
      setIsDesktopSidebarOpen((prev) => !prev);
    }
  };

  const openModule = (moduleId: string, isMobile = false) => {
    setActiveModule(moduleId);
    setIsAppGridOpen(false);
    setIsProfileMenuOpen(false);
    if (isMobile) setIsMobileDrawerOpen(false);
  };

  const handleSelectTheme = async (theme: MemberThemeKey) => {
    setActiveTheme(theme);
    setIsThemeMenuOpen(false);
    if (readOnlyPreview) return;
    try {
      await updateMyMemberPreferences({ memberTheme: theme });
      onUserUpdated?.({ ...effectiveUser, memberTheme: theme });
    } catch (err: any) {
      notify(err.message || 'Could not save theme preference.', true);
    }
  };

  const openTasksCount = data ? data.tasks.filter((t) => t.status !== 'Completed').length : 0;
  const projectsCount = data ? data.projects.length : 0;

  const renderLeftNavigation = (isMobile = false) => (
    <div className="flex flex-col h-full justify-between select-none py-3 px-2.5">
      <div className="space-y-4">
        {/* SECTION 1: MY WORKSPACE */}
        {workspaceMenuApps.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setIsWorkspaceExpanded((prev) => !prev)}
              className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-[var(--mp-text-muted)] hover:text-[var(--mp-text)] cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                {isWorkspaceExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-[var(--mp-accent)]" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-[var(--mp-accent)]" />
                )}
                <span>My Workspace</span>
              </span>
            </button>

            {isWorkspaceExpanded && (
              <div className="mt-1 space-y-0.5">
                {workspaceMenuApps.map((item) => {
                  const Icon = item.icon;
                  const isSelected = activeModule === item.id;
                  const countBadge =
                    item.id === 'cmh_tasks' && openTasksCount > 0
                      ? openTasksCount
                      : item.id === 'cmh_projects' && projectsCount > 0
                      ? projectsCount
                      : null;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => openModule(item.id, isMobile)}
                      aria-current={isSelected ? 'page' : undefined}
                      className={`w-full flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm transition-all whitespace-nowrap cursor-pointer ${
                        isSelected
                          ? 'bg-[var(--mp-accent-soft)] text-[var(--mp-accent-text)] font-bold shadow-2xs ring-1 ring-[var(--mp-border)]'
                          : 'text-[var(--mp-text)] hover:bg-white/75 font-medium'
                      }`}
                    >
                      <span className="flex items-center gap-3 min-w-0">
                        <Icon
                          className={`w-4 h-4 shrink-0 ${
                            isSelected ? 'text-[var(--mp-accent)]' : 'text-[var(--mp-text-muted)]'
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                      </span>
                      {countBadge !== null && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isSelected
                              ? 'bg-[var(--mp-accent)] text-white'
                              : 'bg-white/90 text-[var(--mp-text-muted)]'
                          }`}
                        >
                          {countBadge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* SECTION 2: TOOLS & CONTENT */}
        {toolsMenuApps.length > 0 && (
          <div className="pt-3 border-t border-[var(--mp-border)]">
            <button
              type="button"
              onClick={() => setIsToolsExpanded((prev) => !prev)}
              className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-[var(--mp-text-muted)] hover:text-[var(--mp-text)] cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                {isToolsExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-[var(--mp-accent)]" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-[var(--mp-accent)]" />
                )}
                <span>Workspace Apps</span>
              </span>
            </button>

            {isToolsExpanded && (
              <div className="mt-1 space-y-0.5">
                {toolsMenuApps.map((item) => {
                  const Icon = item.icon;
                  const isSelected = activeModule === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => openModule(item.id, isMobile)}
                      aria-current={isSelected ? 'page' : undefined}
                      className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs sm:text-sm transition-all whitespace-nowrap cursor-pointer ${
                        isSelected
                          ? 'bg-[var(--mp-accent-soft)] text-[var(--mp-accent-text)] font-bold shadow-2xs ring-1 ring-[var(--mp-border)]'
                          : 'text-[var(--mp-text)] hover:bg-white/75 font-medium'
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          isSelected ? 'text-[var(--mp-accent)]' : 'text-[var(--mp-text-muted)]'
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const renderMainContent = () => {
    if (loading || !data) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center space-y-3">
            <div className="w-10 h-10 rounded-2xl mx-auto bg-[var(--mp-accent-soft)] text-[var(--mp-accent)] flex items-center justify-center animate-pulse">
              <Sparkles className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium text-[var(--mp-text-muted)]">
              Loading your workspace...
            </p>
          </div>
        </div>
      );
    }

    if (activeModule === 'account') {
      return (
        <MemberAccountSettingsView
          data={data}
          activeTheme={activeTheme}
          readOnlyPreview={readOnlyPreview}
          onSelectTheme={handleSelectTheme}
          onReload={loadBootstrap}
          onNotify={notify}
          onUserUpdated={onUserUpdated}
        />
      );
    }

    if (activeModule === 'profile') {
      return (
        <ExecutiveProfileView
          currentUserRole={effectiveUser.role || 'MEMBER'}
          currentUser={effectiveUser}
        />
      );
    }

    if (activeModule === 'communication') {
      return (
        <CommunicationView
          currentUserId={user.id}
          currentUserRole={user.role || 'MEMBER'}
        />
      );
    }

    if (!effectiveCaps.allowedModules.includes(activeModule)) {
      return <MemberRestrictedNotice moduleName={currentHeaderMeta.label} />;
    }

    switch (activeModule) {
      case 'overview':
        return (
          <MemberHomeView
            data={data}
            searchQuery={searchQuery}
            onOpenModule={(modId) => openModule(modId)}
            onSelectTask={(taskId) => setSelectedTaskId(taskId)}
          />
        );
      case 'cmh_tasks':
        return (
          <MemberTasksView
            data={data}
            searchQuery={searchQuery}
            readOnlyPreview={readOnlyPreview}
            initialTaskId={selectedTaskId}
            onReload={loadBootstrap}
            onNotify={notify}
          />
        );
      case 'cmh_projects':
        return (
          <MemberProjectsView
            data={data}
            searchQuery={searchQuery}
            readOnlyPreview={readOnlyPreview}
            onReload={loadBootstrap}
            onNotify={notify}
          />
        );
      case 'posts':
        return (
          <MemberPostsView
            data={data}
            searchQuery={searchQuery}
            readOnlyPreview={readOnlyPreview}
            onReload={loadBootstrap}
            onNotify={notify}
          />
        );
      case 'docs':
        return (
          <MemberDocsView
            data={data}
            searchQuery={searchQuery}
            readOnlyPreview={readOnlyPreview}
            onReload={loadBootstrap}
            onNotify={notify}
          />
        );
      case 'forms':
        return (
          <MemberFormsView
            data={data}
            searchQuery={searchQuery}
            readOnlyPreview={readOnlyPreview}
            onReload={loadBootstrap}
            onNotify={notify}
          />
        );
      case 'slides':
        return (
          <MemberSlidesView
            data={data}
            searchQuery={searchQuery}
            readOnlyPreview={readOnlyPreview}
            onReload={loadBootstrap}
            onNotify={notify}
          />
        );
      case 'chat':
        return (
          <MemberChatView
            data={data}
            readOnlyPreview={readOnlyPreview}
            onReload={loadBootstrap}
            onNotify={notify}
          />
        );
      case 'files':
        return (
          <MemberFilesView
            data={data}
            searchQuery={searchQuery}
            readOnlyPreview={readOnlyPreview}
            onReload={loadBootstrap}
            onNotify={notify}
          />
        );
      case 'teams':
        return <MemberTeamsView data={data} searchQuery={searchQuery} />;
      default:
        return <MemberRestrictedNotice moduleName={activeModule} />;
    }
  };

  return (
    <div
      className="member-portal h-[100dvh] flex flex-col overflow-hidden transition-colors duration-300"
      data-member-theme={activeTheme}
    >
      {/* Read-Only Admin Preview Banner */}
      {readOnlyPreview && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-1.5 text-xs text-amber-900 flex items-center justify-between gap-3 shrink-0">
          <span className="inline-flex items-center gap-2 font-semibold">
            <Eye className="w-4 h-4 shrink-0" />
            Admin Preview: Viewing Member Dashboard as {effectiveUser.name} ({effectiveUser.email}) — Read Only
          </span>
          <button
            type="button"
            onClick={() => onLogout()}
            className="px-3 py-1 rounded-xl bg-amber-900 text-white font-semibold cursor-pointer"
          >
            Exit Preview
          </button>
        </div>
      )}

      {/* Executive Frosted Glass Top Header Bar (Matches Admin Shell Structure) */}
      <header className="h-14 flex items-center justify-between gap-3 px-3 md:px-4 bg-white/88 backdrop-blur-xl border-b border-[var(--mp-border)] shrink-0 z-30">
        {/* Left: Hamburger Toggle + Active Brand / Module Title */}
        <div className="flex items-center gap-2 shrink-0 min-w-0">
          <button
            type="button"
            onClick={handleToggleSidebar}
            className="p-2 rounded-xl text-[var(--mp-text-muted)] hover:bg-[var(--mp-surface-subtle)] hover:text-[var(--mp-text)] transition-colors shrink-0 cursor-pointer"
            aria-label="Toggle navigation drawer"
          >
            <Menu className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => openModule('overview')}
            className="flex items-center gap-2.5 pr-1 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <div className="w-8 h-8 rounded-xl bg-[var(--mp-accent-soft)] text-[var(--mp-accent)] flex items-center justify-center shrink-0">
              <ActiveHeaderIcon className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm sm:text-base font-bold tracking-tight text-[var(--mp-text)] truncate max-w-[140px] sm:max-w-none">
                {currentHeaderMeta.label}
              </span>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--mp-accent-soft)] text-[var(--mp-accent-text)]">
                Member Portal
              </span>
            </div>
          </button>
        </div>

        {/* Center: Workspace Search Bar */}
        <div className="hidden md:block flex-1 max-w-xl">
          <div className="flex items-center bg-[var(--mp-surface-subtle)] border border-[var(--mp-border)] rounded-xl px-3.5 py-1.5 focus-within:bg-white focus-within:border-[var(--mp-accent)] focus-within:shadow-xs transition-all">
            <Search className="w-4 h-4 text-[var(--mp-text-muted)] mr-2 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search your tasks, projects, docs, files, or teammates..."
              className="w-full bg-transparent text-xs sm:text-sm text-[var(--mp-text)] placeholder-[var(--mp-text-muted)] focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="p-0.5 text-[var(--mp-text-muted)] hover:text-[var(--mp-text)] cursor-pointer"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Right: Soft Theme Picker + App Grid + Top-Right Profile Dropdown */}
        <div className="flex items-center gap-1.5 shrink-0">

          {/* Theme Studio Dropdown */}
          <div className="relative" ref={themeMenuRef}>
            <button
              type="button"
              onClick={() => setIsThemeMenuOpen((v) => !v)}
              title="Switch Pastel Theme"
              aria-label="Switch Pastel Theme"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-[var(--mp-text)] bg-[var(--mp-surface-subtle)] hover:bg-[var(--mp-accent-soft)] transition-colors cursor-pointer"
            >
              <Palette className="w-4 h-4 text-[var(--mp-accent)]" />
              <span className="hidden lg:inline">
                {THEME_OPTIONS.find((t) => t.key === activeTheme)?.label || 'Theme'}
              </span>
            </button>

            {isThemeMenuOpen && (
              <div className="ws-animate-in absolute right-0 mt-2 w-52 rounded-2xl bg-white border border-[var(--mp-border)] shadow-xl p-2 z-50 space-y-1 text-xs">
                <div className="px-2.5 py-1 text-[11px] font-bold text-[var(--mp-text-muted)]">
                  Member Portal Theme
                </div>
                {THEME_OPTIONS.map((t) => {
                  const selected = activeTheme === t.key;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => handleSelectTheme(t.key)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl font-semibold transition cursor-pointer ${
                        selected
                          ? 'bg-[var(--mp-accent-soft)] text-[var(--mp-accent-text)]'
                          : 'hover:bg-slate-50 text-[var(--mp-text)]'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: t.swatch }}
                        />
                        {t.label}
                      </span>
                      {selected && <span className="text-[10px] font-bold">Active</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Apps Grid Dropdown */}
          <div className="relative" ref={appGridRef}>
            <button
              type="button"
              onClick={() => setIsAppGridOpen((prev) => !prev)}
              className="p-2 rounded-xl text-[var(--mp-text-muted)] hover:bg-[var(--mp-surface-subtle)] hover:text-[var(--mp-text)] transition-colors cursor-pointer"
              title="Switch Workspace App"
            >
              <LayoutGrid className="w-5 h-5" />
            </button>

            {isAppGridOpen && (
              <div className="ws-animate-in absolute right-0 mt-2 w-72 max-h-[75dvh] overflow-y-auto rounded-2xl bg-white border border-[var(--mp-border)] shadow-xl p-3 grid grid-cols-3 gap-2 z-50">
                {allowedApps.map((app) => {
                  const Icon = app.icon;
                  const active = activeModule === app.id;
                  return (
                    <button
                      key={app.id}
                      type="button"
                      onClick={() => openModule(app.id)}
                      className={`flex flex-col items-center justify-center p-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                        active
                          ? 'bg-[var(--mp-accent-soft)] text-[var(--mp-accent-text)] font-semibold'
                          : 'hover:bg-slate-50 text-[var(--mp-text)]'
                      }`}
                    >
                      <Icon className="w-5 h-5 mb-1.5 text-[var(--mp-accent)]" />
                      <span className="truncate w-full text-center">{app.shortLabel}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Top-Right Profile Dropdown (Mirrors Admin Account Switcher Style) */}
          <div className="relative" ref={profileMenuRef}>
            <button
              type="button"
              onClick={() => setIsProfileMenuOpen((prev) => !prev)}
              aria-expanded={isProfileMenuOpen}
              className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-full bg-white border border-[var(--mp-border)] hover:shadow-xs transition-all cursor-pointer"
              title="Account Profile & Settings"
            >
              <div className="w-7 h-7 rounded-full bg-[var(--mp-accent)] text-white font-bold text-xs flex items-center justify-center">
                {String(effectiveUser.name || 'M').slice(0, 2).toUpperCase()}
              </div>
              <span className="hidden sm:inline text-xs font-semibold text-[var(--mp-text)] max-w-[140px] truncate">
                {effectiveUser.name}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-[var(--mp-text-muted)]" />
            </button>

            {isProfileMenuOpen && (
              <div className="ws-animate-in absolute right-0 mt-2 w-72 sm:w-80 rounded-2xl bg-white border border-[var(--mp-border)] shadow-2xl p-3 space-y-2.5 z-50 text-xs">
                <div className="p-3 rounded-xl bg-[var(--mp-surface-subtle)] flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-[var(--mp-text)] truncate">
                      {effectiveUser.name}
                    </div>
                    <div className="text-[11px] text-[var(--mp-text-muted)] truncate">
                      {effectiveUser.email}
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--mp-accent-soft)] text-[var(--mp-accent-text)] shrink-0">
                    {effectiveCaps.role}
                  </span>
                </div>

                {/* Inline Theme Strip */}
                <div className="px-1 py-1">
                  <div className="text-[11px] font-bold text-[var(--mp-text-muted)] mb-1.5">
                    Theme Palette
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {THEME_OPTIONS.map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => handleSelectTheme(t.key)}
                        className={`py-1.5 px-2 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1 border cursor-pointer ${
                          activeTheme === t.key
                            ? 'border-[var(--mp-accent)] bg-[var(--mp-accent-soft)] text-[var(--mp-accent-text)]'
                            : 'border-[var(--mp-border)] text-[var(--mp-text)] hover:bg-slate-50'
                        }`}
                      >
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: t.swatch }}
                        />
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-[var(--mp-border)] space-y-1">
                  <button
                    type="button"
                    onClick={() => openModule('profile')}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[var(--mp-text)] font-semibold hover:bg-[var(--mp-surface-subtle)] rounded-xl cursor-pointer"
                  >
                    <UserCheck className="w-4 h-4 text-[var(--mp-accent)]" />
                    <span>Executive Profile &amp; CV Studio</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openModule('account')}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[var(--mp-text)] font-semibold hover:bg-[var(--mp-surface-subtle)] rounded-xl cursor-pointer"
                  >
                    <UserIcon className="w-4 h-4 text-[var(--mp-accent)]" />
                    <span>My Profile &amp; Security</span>
                  </button>

                  {effectiveCaps.allowedModules.includes('files') && (
                    <button
                      type="button"
                      onClick={() => openModule('files')}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-[var(--mp-text)] font-semibold hover:bg-[var(--mp-surface-subtle)] rounded-xl cursor-pointer"
                    >
                      <HardDrive className="w-4 h-4 text-[var(--mp-accent)]" />
                      <span>My Files</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={async () => {
                      setIsProfileMenuOpen(false);
                      await onLogout();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-rose-600 font-semibold hover:bg-rose-50 rounded-xl cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>{readOnlyPreview ? 'Close Preview' : 'Sign Out'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Split Workspace Area: Structured Left Sidebar + Crisp Main Viewport */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {isDesktopSidebarOpen && (
          <aside className="hidden md:block w-60 lg:w-64 shrink-0 overflow-y-auto border-r border-[var(--mp-border)] bg-white/50">
            {renderLeftNavigation(false)}
          </aside>
        )}

        {/* Mobile Left Slide-Out Drawer with Framer Motion */}
        <AnimatePresence>
          {isMobileDrawerOpen && (
            <div className="md:hidden fixed inset-0 z-50 flex">
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
                className="relative w-72 max-w-[82vw] bg-white h-full shadow-2xl flex flex-col z-10 overflow-y-auto"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--mp-border)]">
                  <span className="text-sm font-bold text-[var(--mp-text)] inline-flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[var(--mp-accent)]" />
                    Member Portal
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsMobileDrawerOpen(false)}
                    aria-label="Close menu"
                    className="p-1.5 rounded-full text-[var(--mp-text-muted)] hover:bg-slate-100 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto">{renderLeftNavigation(true)}</div>
              </motion.aside>
            </div>
          )}
        </AnimatePresence>

        {/* Main Active Module Viewport */}
        <main className="flex-1 min-w-0 min-h-0 pb-14 md:pb-3 md:p-3 overflow-hidden flex flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto p-2.5 sm:p-5 md:rounded-2xl bg-white/75 border border-[var(--mp-border)] shadow-2xs">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeModule}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="h-full flex flex-col"
              >
                {renderMainContent()}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Subtle Toast Banner */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.94 }}
            role="status"
            className={`fixed bottom-16 md:bottom-5 right-4 z-50 px-4 py-2.5 rounded-xl shadow-lg text-xs font-semibold text-white ${
              toast.isError ? 'bg-rose-600' : 'bg-slate-900'
            }`}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Compact Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Mobile quick navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-white/95 backdrop-blur-xl border-t border-[var(--mp-border)] grid grid-cols-4 items-center px-2 z-30"
      >
        {bottomMobileApps.map((item) => {
          const Icon = item.icon;
          const active = activeModule === item.id;
          return (
            <motion.button
              key={item.id}
              whileTap={{ scale: 0.93 }}
              type="button"
              onClick={() => openModule(item.id, true)}
              aria-current={active ? 'page' : undefined}
              className={`relative flex flex-col items-center justify-center py-1.5 rounded-xl text-[11px] transition-all whitespace-nowrap cursor-pointer z-10 ${
                active
                  ? 'text-[var(--mp-accent-text)] font-bold'
                  : 'text-[var(--mp-text-muted)] font-semibold'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="memberBottomNavActive"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  className="absolute inset-0 rounded-xl bg-[var(--mp-accent-soft)] -z-10"
                />
              )}
              <Icon className="w-4 h-4 mb-0.5" />
              <span>{item.shortLabel}</span>
            </motion.button>
          );
        })}
      </nav>

      {/* Persistent Floating Sticky Messenger Launcher (Desktop & Mobile) */}
      <FloatingMessengerWidget
        currentUserId={user.id}
        currentUserRole={user.role || 'MEMBER'}
        onNavigateToCommunication={() => openModule('communication', true)}
        isCurrentViewCommunication={activeModule === 'communication'}
      />
    </div>
  );
};
