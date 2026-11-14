import React, { lazy, Suspense } from 'react';
import { WorkspaceModule } from './types';
import { WorkspaceAuthUser } from '../../services/workspaceAuth';
import { ConnectedGmailAccount, WorkspaceUser } from '../../services/auth';
import {
  CustomMailTab,
  ParsedEmail,
  ServerMailAccount,
  WorkspaceFileItem,
  WorkspaceMemberItem,
} from '../../services/workspaceApi';
import type { ServerMailFolder } from '../ServerMailView';
import type { SettingsSubTab } from '../SettingsView';
import type { CmhTasksSubTab } from '../CmhTasksView';
import type { CmhProjectsSubTab } from '../CmhProjectsView';
import type { CmhFormBuilderSubTab } from '../CmhFormBuilderView';
import type { TeamsSubTab } from '../TeamsView';
import type { PostsNoticesSubTab } from '../PostsNoticesView';
import type { FileManagerSubTab } from '../FileManagerView';
import type { DocsSubTab } from '../DocsView';
import type { SlidesSubTab } from '../SlidesView';
import type { FormsSubTab } from '../FormsView';
import type { MeetSubTab } from '../MeetView';
import type { SheetsSubTab } from '../SheetsView';
import type { CalendarSubTab } from '../CalendarView';
import type { FinanceSubTab } from '../FinanceView';
import type { CrmSubTab } from '../CrmTicketsView';
import type { HrSubTab } from '../HrManagementView';
import type { ChatSubTab } from '../TeamChatView';
import type { WikiSubTab } from '../WikiKnowledgeView';
import type { AutomationSubTab } from '../AutomationEngineView';

const WorkspaceFeedView = lazy(() =>
  import('../WorkspaceFeedView').then((m) => ({ default: m.WorkspaceFeedView }))
);
const OverviewDashboardView = lazy(() =>
  import('../OverviewDashboardView').then((m) => ({ default: m.OverviewDashboardView }))
);
const GmailView = lazy(() =>
  import('../GmailView').then((m) => ({ default: m.GmailView }))
);
const ServerMailView = lazy(() =>
  import('../ServerMailView').then((m) => ({ default: m.ServerMailView }))
);
const BulkMailView = lazy(() =>
  import('../BulkMailView').then((m) => ({ default: m.BulkMailView }))
);
const DocsView = lazy(() =>
  import('../DocsView').then((m) => ({ default: m.DocsView }))
);
const SlidesView = lazy(() =>
  import('../SlidesView').then((m) => ({ default: m.SlidesView }))
);
const FormsView = lazy(() =>
  import('../FormsView').then((m) => ({ default: m.FormsView }))
);
const MeetView = lazy(() =>
  import('../MeetView').then((m) => ({ default: m.MeetView }))
);
const TeamsView = lazy(() =>
  import('../TeamsView').then((m) => ({ default: m.TeamsView }))
);
const PostsNoticesView = lazy(() =>
  import('../PostsNoticesView').then((m) => ({ default: m.PostsNoticesView }))
);
const FileManagerView = lazy(() =>
  import('../FileManagerView').then((m) => ({ default: m.FileManagerView }))
);
const CmhTasksView = lazy(() =>
  import('../CmhTasksView').then((m) => ({ default: m.CmhTasksView }))
);
const CmhProjectsView = lazy(() =>
  import('../CmhProjectsView').then((m) => ({ default: m.CmhProjectsView }))
);
const CmhFormBuilderView = lazy(() =>
  import('../CmhFormBuilderView').then((m) => ({ default: m.CmhFormBuilderView }))
);
const SettingsView = lazy(() =>
  import('../SettingsView').then((m) => ({ default: m.SettingsView }))
);
const SheetsView = lazy(() =>
  import('../SheetsView').then((m) => ({ default: m.SheetsView }))
);
const CalendarView = lazy(() =>
  import('../CalendarView').then((m) => ({ default: m.CalendarView }))
);
const FinanceView = lazy(() =>
  import('../FinanceView').then((m) => ({ default: m.FinanceView }))
);
const CrmTicketsView = lazy(() =>
  import('../CrmTicketsView').then((m) => ({ default: m.CrmTicketsView }))
);
const HrManagementView = lazy(() =>
  import('../HrManagementView').then((m) => ({ default: m.HrManagementView }))
);
const TeamChatView = lazy(() =>
  import('../TeamChatView').then((m) => ({ default: m.TeamChatView }))
);
const WikiKnowledgeView = lazy(() =>
  import('../WikiKnowledgeView').then((m) => ({ default: m.WikiKnowledgeView }))
);
const AutomationEngineView = lazy(() =>
  import('../AutomationEngineView').then((m) => ({ default: m.AutomationEngineView }))
);
const ExecutiveProfileView = lazy(() =>
  import('../profile/ExecutiveProfileView').then((m) => ({ default: m.ExecutiveProfileView }))
);
const CommunicationView = lazy(() =>
  import('../communication/CommunicationView').then((m) => ({ default: m.CommunicationView }))
);
const AdminPanelView = lazy(() =>
  import('../AdminPanelView').then((m) => ({ default: m.AdminPanelView }))
);

const ModuleLoadingFallback: React.FC = () => (
  <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400 dark:text-slate-500 animate-in fade-in duration-150">
    <div className="flex items-center gap-2.5 text-xs font-semibold">
      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      <span>Loading module...</span>
    </div>
  </div>
);

const feedModuleMap: Record<string, string> = {
  folders: 'files',
  members: 'teams',
  team_groups: 'teams',
  invoice: 'finance',
  expense: 'finance',
  lead: 'crm',
  ticket: 'crm',
  resume: 'profile',
  corporate: 'profile',
};

export interface AppModuleRouterProps {
  activeModule: WorkspaceModule;
  setActiveModule: (mod: WorkspaceModule) => void;
  workspaceTitle: string;
  setWorkspaceTitle: (t: string) => void;
  wsUser: WorkspaceAuthUser;
  user: WorkspaceUser | null;
  gmailAccounts: ConnectedGmailAccount[];
  setGmailAccounts: React.Dispatch<React.SetStateAction<ConnectedGmailAccount[]>>;
  activeGmail: string | null;
  setActiveGmail: React.Dispatch<React.SetStateAction<string | null>>;
  isAuthenticated: boolean;
  setToken: React.Dispatch<React.SetStateAction<string | null>>;
  setNeedsAuth: React.Dispatch<React.SetStateAction<boolean>>;
  handleGoogleSignIn: (isManual?: boolean) => void;
  serverAccounts: ServerMailAccount[];
  setServerAccounts: React.Dispatch<React.SetStateAction<ServerMailAccount[]>>;
  activeServerAccount: ServerMailAccount | null;
  setActiveServerAccountId: (id: string) => void;
  activeServerFolder: ServerMailFolder;
  setActiveServerFolder: (f: ServerMailFolder) => void;
  serverComposeTrigger: number;
  activeFolderId: string;
  setActiveFolderId: (f: string) => void;
  activeTabId: string;
  setActiveTabId: (t: string) => void;
  searchQuery: string;
  customTabs: CustomMailTab[];
  setCustomTabs: React.Dispatch<React.SetStateAction<CustomMailTab[]>>;
  setIsAddTabModalOpen: (val: boolean) => void;
  composeTriggerCount: number;
  focusGmailId: string | null;
  focusServerMailId: string | null;
  pendingFileAttachment: WorkspaceFileItem | null;
  setPendingFileAttachment: React.Dispatch<React.SetStateAction<WorkspaceFileItem | null>>;
  realtimeServerMailMsg: ParsedEmail | null;
  initialTeamRecipients: Array<{ email: string; name: string; company: string }> | null;
  setInitialTeamRecipients: React.Dispatch<
    React.SetStateAction<Array<{ email: string; name: string; company: string }> | null>
  >;
  setPreviewMemberInviteId: (id: string | null) => void;
  setPreviewPublicFormId: (id: string | null) => void;
  setPreviewCmhParam: (param: string | null) => void;
  viewingProfileMemberId: string | null;
  setViewingProfileMemberId: (id: string | null) => void;
  communicationTargetUserId: string | null;
  setCommunicationTargetUserId: (id: string | null) => void;
  setIsDesktopDrawerOpen: (val: boolean | ((prev: boolean) => boolean)) => void;
  feedSource: { type: string; id: string } | null;
  setFeedSource: React.Dispatch<React.SetStateAction<{ type: string; id: string } | null>>;
  teamsSubTab: TeamsSubTab;
  setTeamsSubTab: (tab: TeamsSubTab) => void;
  postsSubTab: PostsNoticesSubTab;
  setPostsSubTab: (tab: PostsNoticesSubTab) => void;
  filesSubTab: FileManagerSubTab;
  setFilesSubTab: (tab: FileManagerSubTab) => void;
  docsSubTab: DocsSubTab;
  setDocsSubTab: (tab: DocsSubTab) => void;
  slidesSubTab: SlidesSubTab;
  setSlidesSubTab: (tab: SlidesSubTab) => void;
  formsSubTab: FormsSubTab;
  setFormsSubTab: (tab: FormsSubTab) => void;
  meetSubTab: MeetSubTab;
  setMeetSubTab: (tab: MeetSubTab) => void;
  cmhTasksSubTab: CmhTasksSubTab;
  setCmhTasksSubTab: (tab: CmhTasksSubTab) => void;
  cmhProjectsSubTab: CmhProjectsSubTab;
  setCmhProjectsSubTab: (tab: CmhProjectsSubTab) => void;
  cmhFormsSubTab: CmhFormBuilderSubTab;
  setCmhFormsSubTab: (tab: CmhFormBuilderSubTab) => void;
  sheetsSubTab: SheetsSubTab;
  setSheetsSubTab: (tab: SheetsSubTab) => void;
  calendarSubTab: CalendarSubTab;
  setCalendarSubTab: (tab: CalendarSubTab) => void;
  financeSubTab: FinanceSubTab;
  setFinanceSubTab: (tab: FinanceSubTab) => void;
  crmSubTab: CrmSubTab;
  setCrmSubTab: (tab: CrmSubTab) => void;
  hrSubTab: HrSubTab;
  setHrSubTab: (tab: HrSubTab) => void;
  chatSubTab: ChatSubTab;
  setChatSubTab: (tab: ChatSubTab) => void;
  wikiSubTab: WikiSubTab;
  setWikiSubTab: (tab: WikiSubTab) => void;
  automationsSubTab: AutomationSubTab;
  setAutomationsSubTab: (tab: AutomationSubTab) => void;
  settingsSubTab: SettingsSubTab;
  setSettingsSubTab: (tab: SettingsSubTab) => void;
}

export const AppModuleRouter: React.FC<AppModuleRouterProps> = ({
  activeModule,
  setActiveModule,
  workspaceTitle,
  setWorkspaceTitle,
  wsUser,
  user,
  gmailAccounts,
  setGmailAccounts,
  activeGmail,
  setActiveGmail,
  isAuthenticated,
  setToken,
  setNeedsAuth,
  handleGoogleSignIn,
  serverAccounts,
  setServerAccounts,
  activeServerAccount,
  setActiveServerAccountId,
  activeServerFolder,
  setActiveServerFolder,
  serverComposeTrigger,
  activeFolderId,
  setActiveFolderId,
  activeTabId,
  setActiveTabId,
  searchQuery,
  customTabs,
  setCustomTabs,
  setIsAddTabModalOpen,
  composeTriggerCount,
  focusGmailId,
  focusServerMailId,
  pendingFileAttachment,
  setPendingFileAttachment,
  realtimeServerMailMsg,
  initialTeamRecipients,
  setInitialTeamRecipients,
  setPreviewMemberInviteId,
  setPreviewPublicFormId,
  setPreviewCmhParam,
  viewingProfileMemberId,
  setViewingProfileMemberId,
  communicationTargetUserId,
  setCommunicationTargetUserId,
  setIsDesktopDrawerOpen,
  feedSource,
  setFeedSource,
  teamsSubTab,
  setTeamsSubTab,
  postsSubTab,
  setPostsSubTab,
  filesSubTab,
  setFilesSubTab,
  docsSubTab,
  setDocsSubTab,
  slidesSubTab,
  setSlidesSubTab,
  formsSubTab,
  setFormsSubTab,
  meetSubTab,
  setMeetSubTab,
  cmhTasksSubTab,
  setCmhTasksSubTab,
  cmhProjectsSubTab,
  setCmhProjectsSubTab,
  cmhFormsSubTab,
  setCmhFormsSubTab,
  sheetsSubTab,
  setSheetsSubTab,
  calendarSubTab,
  setCalendarSubTab,
  financeSubTab,
  setFinanceSubTab,
  crmSubTab,
  setCrmSubTab,
  hrSubTab,
  setHrSubTab,
  chatSubTab,
  setChatSubTab,
  wikiSubTab,
  setWikiSubTab,
  automationsSubTab,
  setAutomationsSubTab,
  settingsSubTab,
  setSettingsSubTab,
}) => {
  return (
    <main className="flex-1 min-w-0 min-h-0 pb-14 md:pb-3 md:pr-3 overflow-hidden flex flex-col">
      <Suspense fallback={<ModuleLoadingFallback />}>
        {activeModule === 'main_feed' && (
          <WorkspaceFeedView
            onOpen={(source, id) => {
              setFeedSource({ type: source, id });
              if (source === 'members') {
                setViewingProfileMemberId(id);
                setActiveModule('profile');
              } else {
                setActiveModule((feedModuleMap[source] || source) as WorkspaceModule);
              }
            }}
          />
        )}
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
            defaultAuthorName={
              wsUser.name || user?.displayName || activeServerAccount?.label || 'Administrator'
            }
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
            initialItemId={feedSource?.type === 'docs' ? feedSource.id : undefined}
            onInitialItemOpened={() => setFeedSource(null)}
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
            initialItemId={feedSource?.type === 'cmh_tasks' ? feedSource.id : undefined}
            onInitialItemOpened={() => setFeedSource(null)}
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
            initialItemId={feedSource?.type === 'cmh_projects' ? feedSource.id : undefined}
            onInitialItemOpened={() => setFeedSource(null)}
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
            onOpenAccessSettings={() => setActiveModule('admin_panel')}
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
      </Suspense>
    </main>
  );
};
