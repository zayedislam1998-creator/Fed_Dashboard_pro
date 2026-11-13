import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import {
  Briefcase,
  CheckCircle2,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Download,
  Edit3,
  Eye,
  FileText,
  FolderOpen,
  HardDrive,
  KeyRound,
  LayoutDashboard,
  Lock,
  Mail,
  MapPin,
  Megaphone,
  MessageCircle,
  MessagesSquare,
  Palette,
  Paperclip,
  Phone,
  Pin,
  Plus,
  Presentation,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  User as UserIcon,
  Users,
} from 'lucide-react';
import {
  ensureClientSlideElements,
  prefetchEngineFile,
} from '../../services/engineCache';
import {
  UniversalDocumentEngineModal,
  UniversalEngineTarget,
} from '../UniversalDocumentEngineModal';
import type { ImageEditorTarget } from '../ImageEditorModal';

const SlideCanvasStudio = lazy(() =>
  import('../engines/SlideCanvasStudio').then((m) => ({ default: m.SlideCanvasStudio }))
);
const ImageEditorModal = lazy(() =>
  import('../ImageEditorModal').then((m) => ({ default: m.ImageEditorModal }))
);
import type {
  EvaluatedCapabilitiesClient,
  MemberThemeKey,
  WorkspaceAuthUser,
} from '../../services/workspaceAuth';
import {
  deleteMemberDoc,
  deleteMemberFile,
  saveMemberDoc,
  saveMemberForm,
  saveMemberPost,
  saveMemberSlide,
  sendMemberChatMessage,
  submitMemberTaskProgress,
  updateMemberProjectAsManager,
  updateMyMemberPreferences,
  updateMyPassword,
  uploadMemberFile,
} from '../../services/workspaceAuth';

export interface MemberBootstrapData {
  user: WorkspaceAuthUser;
  capabilities: EvaluatedCapabilitiesClient;
  storage: {
    usedBytes: number;
    quotaBytes: number;
    maxFileSizeBytes: number;
  };
  tasks: any[];
  projects: any[];
  posts: any[];
  docs: any[];
  forms: any[];
  slides: any[];
  files: any[];
  folders: any[];
  channels: any[];
  chatMessages: any[];
  teams: {
    members: any[];
    groups: any[];
  };
}

export function canMemberAction(
  caps: EvaluatedCapabilitiesClient,
  action: string
): boolean {
  if (caps.deniedActions.includes(action)) return false;
  return caps.isAdmin || caps.allowedActions.includes(action);
}

export function formatBytesCompact(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function filterBySearch<T extends Record<string, any>>(
  items: T[],
  searchQuery: string,
  keys: (keyof T)[]
): T[] {
  const q = searchQuery.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) =>
    keys.some((k) => String(item[k] || '').toLowerCase().includes(q))
  );
}

function StatusPill({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'accent' | 'success' | 'warn' | 'danger' }) {
  const styles: Record<string, string> = {
    neutral: 'bg-slate-100 text-slate-700',
    accent: 'bg-[var(--mp-accent-soft)] text-[var(--mp-accent-text)]',
    success: 'bg-emerald-50 text-emerald-700',
    warn: 'bg-amber-50 text-amber-700',
    danger: 'bg-rose-50 text-rose-700',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${styles[tone]}`}>
      {label}
    </span>
  );
}

function taskStatusTone(status: string): 'neutral' | 'accent' | 'success' | 'warn' {
  if (status === 'Completed') return 'success';
  if (status === 'In Progress') return 'accent';
  if (status === 'Review') return 'warn';
  return 'neutral';
}

function EmptyAppCard({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mp-card-soft rounded-3xl p-8 text-center">
      <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center bg-[var(--mp-accent-soft)] text-[var(--mp-accent-text)]">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-base font-bold text-[var(--mp-text)]">{title}</h3>
      <p className="text-sm text-[var(--mp-text-muted)] mt-1 max-w-sm mx-auto">{subtitle}</p>
    </div>
  );
}

export const MODULE_APP_CATALOG: Array<{
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  section: 'workspace' | 'tools';
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'overview', label: 'Overview', shortLabel: 'Overview', description: 'Personal summary & analytics', section: 'workspace', icon: LayoutDashboard },
  { id: 'profile', label: 'Profile & Website Studio', shortLabel: 'Studio', description: 'Resume Builder & Corporate Website', section: 'workspace', icon: UserIcon },
  { id: 'communication', label: 'Communication', shortLabel: 'Messenger', description: 'Direct 1-on-1 Messenger & Files', section: 'workspace', icon: MessagesSquare },
  { id: 'cmh_tasks', label: 'Tasks', shortLabel: 'Tasks', description: 'Assigned tasks & progress', section: 'workspace', icon: CheckSquare },
  { id: 'cmh_projects', label: 'Projects', shortLabel: 'Projects', description: 'Projects shared with you', section: 'workspace', icon: Briefcase },
  { id: 'teams', label: 'Teams', shortLabel: 'Teams', description: 'Directory & team groups', section: 'workspace', icon: Users },
  { id: 'posts', label: 'Posts & Notices', shortLabel: 'Post', description: 'Updates & pinned announcements', section: 'tools', icon: Megaphone },
  { id: 'docs', label: 'Docs', shortLabel: 'Docs', description: 'Personal & shared documents', section: 'tools', icon: FileText },
  { id: 'forms', label: 'Forms', shortLabel: 'Forms', description: 'Custom forms & responses', section: 'tools', icon: ClipboardList },
  { id: 'slides', label: 'Slides', shortLabel: 'Slides', description: 'Presentations & decks', section: 'tools', icon: Presentation },
  { id: 'chat', label: 'Team Chat', shortLabel: 'Chat', description: 'Assigned team channels', section: 'tools', icon: MessageCircle },
  { id: 'files', label: 'File Manager', shortLabel: 'Files', description: 'Personal cloud storage', section: 'tools', icon: HardDrive },
];

// ----------------------------------------------------------------------------
// 1. EXECUTIVE MEMBER OVERVIEW (Matches Admin Polish with Pastel Soft Shadows)
// ----------------------------------------------------------------------------
function MemberTaskDonut({
  todo,
  inProgress,
  review,
  completed,
}: {
  todo: number;
  inProgress: number;
  review: number;
  completed: number;
}) {
  const total = todo + inProgress + review + completed;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const size = 136;
  const strokeWidth = 16;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const segments = [
    { label: 'Completed', value: completed, color: '#10b981' },
    { label: 'In Progress', value: inProgress, color: 'var(--mp-accent)' },
    { label: 'Review', value: review, color: '#f59e0b' },
    { label: 'To Do', value: todo, color: '#cbd5e1' },
  ];

  let accFraction = 0;
  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90 transform">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="#e2e8f0"
            strokeWidth={strokeWidth}
          />
          {total > 0 &&
            segments.map((seg) => {
              if (seg.value <= 0) return null;
              const fraction = seg.value / total;
              const dashArray = `${fraction * circumference} ${circumference}`;
              const dashOffset = -accFraction * circumference;
              accFraction += fraction;
              return (
                <circle
                  key={seg.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="transparent"
                  stroke={seg.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={dashArray}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="round"
                />
              );
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-extrabold text-[var(--mp-text)]">{pct}%</span>
          <span className="text-[11px] font-semibold text-[var(--mp-text-muted)]">Complete</span>
        </div>
      </div>

      <div className="flex-1 w-full space-y-2.5">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 font-semibold text-[var(--mp-text)]">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
              {seg.label}
            </span>
            <span className="font-bold text-[var(--mp-text)] tabular-nums">{seg.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MemberHomeView({
  data,
  searchQuery = '',
  onOpenModule,
  onSelectTask,
}: {
  data: MemberBootstrapData;
  searchQuery?: string;
  onOpenModule: (moduleId: string) => void;
  onSelectTask?: (taskId: string) => void;
}) {
  const { user, capabilities, tasks, projects, posts, docs, files } = data;
  const q = searchQuery.trim().toLowerCase();

  const filteredTasks = useMemo(
    () =>
      q
        ? tasks.filter(
            (t) =>
              t.title?.toLowerCase().includes(q) ||
              (t.description || '').toLowerCase().includes(q)
          )
        : tasks,
    [tasks, q]
  );

  const openTasks = filteredTasks.filter((t) => t.status !== 'Completed');
  const completedTasks = filteredTasks.filter((t) => t.status === 'Completed');
  const todoCount = tasks.filter((t) => t.status === 'To Do').length;
  const inProgressCount = tasks.filter((t) => t.status === 'In Progress').length;
  const reviewCount = tasks.filter((t) => t.status === 'Review').length;
  const completedCount = tasks.filter((t) => t.status === 'Completed').length;

  return (
    <div className="space-y-5">
      {/* Clean Executive Greeting Header Strip */}
      <div className="mp-card-soft rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[var(--mp-accent-soft)] text-[var(--mp-accent-text)]">
              <Sparkles className="w-3 h-3" />
              Member Workspace
            </span>
            {user.countryName && (
              <span className="text-xs text-[var(--mp-text-muted)]">
                {[user.cityName, user.stateName, user.countryName].filter(Boolean).join(', ')}
              </span>
            )}
          </div>
          <h1 className="text-xl font-bold text-[var(--mp-text)] mt-1.5 tracking-tight">
            Welcome back, {user.firstName || user.name}
          </h1>
          <p className="text-xs sm:text-sm text-[var(--mp-text-muted)] mt-0.5">
            Track your assigned tasks, project workspaces, shared documents, and team notices in one place.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {capabilities.allowedModules.includes('cmh_tasks') && (
            <button
              type="button"
              onClick={() => onOpenModule('cmh_tasks')}
              className="min-h-[40px] px-4 rounded-xl text-xs font-bold text-white bg-[var(--mp-accent)] hover:bg-[var(--mp-accent-hover)] transition shadow-xs cursor-pointer"
            >
              My Tasks ({openTasks.length} Open)
            </button>
          )}
          {capabilities.allowedModules.includes('files') && (
            <button
              type="button"
              onClick={() => onOpenModule('files')}
              className="min-h-[40px] px-4 rounded-xl text-xs font-bold bg-[var(--mp-surface-subtle)] text-[var(--mp-text)] hover:opacity-90 transition cursor-pointer"
            >
              Upload Files
            </button>
          )}
        </div>
      </div>

      {/* 4 KPI Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => capabilities.allowedModules.includes('cmh_tasks') && onOpenModule('cmh_tasks')}
          className="text-left mp-card-soft rounded-2xl p-4 hover:opacity-95 transition cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-[var(--mp-text-muted)]">
            <span>Open Tasks</span>
            <CheckSquare className="w-4 h-4 text-[var(--mp-accent)]" />
          </div>
          <div className="text-2xl font-extrabold text-[var(--mp-text)] mt-2 tabular-nums">
            {openTasks.length}
          </div>
          <div className="text-[11px] text-[var(--mp-text-muted)] mt-1">
            {completedTasks.length} completed total
          </div>
        </button>

        <button
          type="button"
          onClick={() => capabilities.allowedModules.includes('cmh_projects') && onOpenModule('cmh_projects')}
          className="text-left mp-card-soft rounded-2xl p-4 hover:opacity-95 transition cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-[var(--mp-text-muted)]">
            <span>Assigned Projects</span>
            <Briefcase className="w-4 h-4 text-[var(--mp-accent)]" />
          </div>
          <div className="text-2xl font-extrabold text-[var(--mp-text)] mt-2 tabular-nums">
            {projects.length}
          </div>
          <div className="text-[11px] text-[var(--mp-text-muted)] mt-1">
            Active collaborations
          </div>
        </button>

        <button
          type="button"
          onClick={() => capabilities.allowedModules.includes('docs') && onOpenModule('docs')}
          className="text-left mp-card-soft rounded-2xl p-4 hover:opacity-95 transition cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-[var(--mp-text-muted)]">
            <span>Docs &amp; Files</span>
            <FileText className="w-4 h-4 text-[var(--mp-accent)]" />
          </div>
          <div className="text-2xl font-extrabold text-[var(--mp-text)] mt-2 tabular-nums">
            {docs.length + files.length}
          </div>
          <div className="text-[11px] text-[var(--mp-text-muted)] mt-1">
            {docs.length} docs · {files.length} files
          </div>
        </button>

        <button
          type="button"
          onClick={() => onOpenModule('profile')}
          className="text-left mp-card-soft rounded-2xl p-4 hover:opacity-95 transition cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-[var(--mp-text-muted)]">
            <span>Profile &amp; Website</span>
            <Sparkles className="w-4 h-4 text-[var(--mp-accent)]" />
          </div>
          <div className="text-lg font-extrabold text-[var(--mp-text)] mt-2">
            My Studio
          </div>
          <div className="text-[11px] text-[var(--mp-text-muted)] mt-1">
            Resume &amp; corporate site
          </div>
        </button>
      </div>

      {/* Main Analytics + Priority Tasks Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <section className="lg:col-span-5 mp-card-soft rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-[var(--mp-text)]">Task Progress Breakdown</h2>
            <span className="text-xs font-semibold text-[var(--mp-text-muted)]">
              {tasks.length} total
            </span>
          </div>
          <MemberTaskDonut
            todo={todoCount}
            inProgress={inProgressCount}
            review={reviewCount}
            completed={completedCount}
          />
        </section>

        {capabilities.allowedModules.includes('cmh_tasks') && (
          <section className="lg:col-span-7 mp-card-soft rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-[var(--mp-text)]">Assigned Task Queue</h2>
              <button
                type="button"
                onClick={() => onOpenModule('cmh_tasks')}
                className="text-xs font-bold text-[var(--mp-accent-text)] hover:underline cursor-pointer"
              >
                Open Tasks →
              </button>
            </div>
            {openTasks.length === 0 ? (
              <div className="py-10 text-center text-sm text-[var(--mp-text-muted)]">
                No open tasks assigned right now.
              </div>
            ) : (
              <div className="space-y-2.5">
                {openTasks.slice(0, 4).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      onSelectTask?.(t.id);
                      onOpenModule('cmh_tasks');
                    }}
                    className="w-full text-left p-3.5 rounded-xl bg-[var(--mp-surface-subtle)] hover:bg-[var(--mp-accent-soft)] transition flex items-center justify-between gap-3 cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[var(--mp-text)] truncate">
                        {t.title}
                      </div>
                      <div className="text-xs text-[var(--mp-text-muted)] mt-0.5 flex items-center gap-2">
                        {t.dueDate && <span>Due {t.dueDate}</span>}
                        <span>• {t.priority || 'Medium'}</span>
                      </div>
                    </div>
                    <StatusPill label={t.status} tone={taskStatusTone(t.status)} />
                  </button>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Bottom Split: Assigned Projects & Latest Notices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {capabilities.allowedModules.includes('cmh_projects') && (
          <section className="mp-card-soft rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-[var(--mp-text)]">Assigned Projects</h2>
              <button
                type="button"
                onClick={() => onOpenModule('cmh_projects')}
                className="text-xs font-bold text-[var(--mp-accent-text)] hover:underline cursor-pointer"
              >
                View all →
              </button>
            </div>
            {projects.length === 0 ? (
              <p className="text-sm text-[var(--mp-text-muted)] py-6 text-center">
                No projects shared with your account yet.
              </p>
            ) : (
              <div className="space-y-2.5">
                {projects.slice(0, 3).map((proj) => (
                  <div
                    key={proj.id}
                    className="p-3.5 rounded-xl bg-[var(--mp-surface-subtle)] flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[var(--mp-text)] truncate">
                        {proj.title}
                      </div>
                      <div className="text-xs text-[var(--mp-text-muted)] mt-0.5">
                        {proj.myProjectRole === 'MANAGER' ? 'Project Manager' : 'Participant'}
                        {proj.deadline ? ` • Due ${proj.deadline}` : ''}
                      </div>
                    </div>
                    <StatusPill
                      label={proj.status || 'Active'}
                      tone={proj.status === 'Completed' ? 'success' : 'accent'}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {capabilities.allowedModules.includes('posts') && (
          <section className="mp-card-soft rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-[var(--mp-text)]">Latest Announcements</h2>
              <button
                type="button"
                onClick={() => onOpenModule('posts')}
                className="text-xs font-bold text-[var(--mp-accent-text)] hover:underline cursor-pointer"
              >
                Open feed →
              </button>
            </div>
            {posts.length === 0 ? (
              <p className="text-sm text-[var(--mp-text-muted)] py-6 text-center">
                No announcements published yet.
              </p>
            ) : (
              <div className="space-y-2.5">
                {posts.slice(0, 3).map((post) => (
                  <div key={post.id} className="p-3.5 rounded-xl bg-[var(--mp-surface-subtle)]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-[var(--mp-text)] line-clamp-1">
                        {post.title}
                      </span>
                      {post.isPinned && <Pin className="w-3.5 h-3.5 text-[var(--mp-accent)] shrink-0" />}
                    </div>
                    <p className="text-xs text-[var(--mp-text-muted)] mt-1 line-clamp-2">
                      {post.summary || post.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// 2. TASKS
// ----------------------------------------------------------------------------
export function MemberTasksView({
  data,
  searchQuery = '',
  readOnlyPreview,
  initialTaskId,
  onReload,
  onNotify,
}: {
  data: MemberBootstrapData;
  searchQuery?: string;
  readOnlyPreview?: boolean;
  initialTaskId?: string | null;
  onReload: () => Promise<void>;
  onNotify: (msg: string, isError?: boolean) => void;
}) {
  const [filter, setFilter] = useState<string>('ALL');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(initialTaskId || null);
  const [statusUpdate, setStatusUpdate] = useState<string>('In Progress');
  const [note, setNote] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const canSubmit = !readOnlyPreview && canMemberAction(data.capabilities, 'task.submit_own');
  const visibleTasks = useMemo(() => {
    const byStatus =
      filter === 'ALL' ? data.tasks : data.tasks.filter((t) => t.status === filter);
    return filterBySearch(byStatus, searchQuery, ['title', 'description', 'priority']);
  }, [data.tasks, filter, searchQuery]);

  const handleSubmit = async (e: React.FormEvent, taskId: string) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    try {
      await submitMemberTaskProgress(taskId, { statusUpdate, note });
      setNote('');
      setEditingTaskId(null);
      await onReload();
      onNotify('Task progress saved.');
    } catch (err: any) {
      onNotify(err.message || 'Could not update task.', true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {['ALL', 'To Do', 'In Progress', 'Review', 'Completed'].map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setFilter(tab)}
            className={`min-h-[40px] px-4 rounded-2xl text-xs sm:text-sm font-semibold transition cursor-pointer ${
              filter === tab
                ? 'bg-[var(--mp-accent)] text-white shadow-sm'
                : 'mp-card-soft text-[var(--mp-text-muted)] hover:text-[var(--mp-text)]'
            }`}
          >
            {tab === 'ALL' ? `All (${data.tasks.length})` : tab}
          </button>
        ))}
      </div>

      {visibleTasks.length === 0 ? (
        <EmptyAppCard
          icon={CheckCircle2}
          title="No tasks in this view"
          subtitle="Tasks assigned to you or your team will appear here automatically."
        />
      ) : (
        <div className="space-y-3">
          {visibleTasks.map((task) => {
            const isExpanded = editingTaskId === task.id;
            return (
              <div key={task.id} className="mp-card-soft rounded-3xl p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill label={task.status} tone={taskStatusTone(task.status)} />
                      <StatusPill
                        label={task.priority || 'Medium'}
                        tone={task.priority === 'Critical' || task.priority === 'High' ? 'warn' : 'neutral'}
                      />
                      {task.dueDate && (
                        <span className="inline-flex items-center gap-1 text-xs text-[var(--mp-text-muted)]">
                          <Clock className="w-3.5 h-3.5" />
                          Due {task.dueDate}
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-[var(--mp-text)] mt-2">{task.title}</h3>
                    {task.description && (
                      <p className="text-sm text-[var(--mp-text-muted)] mt-1 whitespace-pre-line">
                        {task.description}
                      </p>
                    )}
                  </div>

                  {canSubmit && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTaskId(isExpanded ? null : task.id);
                        setStatusUpdate(task.status || 'In Progress');
                      }}
                      className="min-h-[42px] px-4 rounded-2xl text-xs font-semibold bg-[var(--mp-accent-soft)] text-[var(--mp-accent-text)] hover:opacity-90 transition shrink-0 cursor-pointer"
                    >
                      {isExpanded ? 'Close' : 'Update Progress'}
                    </button>
                  )}
                </div>

                {Array.isArray(task.submissions) && task.submissions.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-[var(--mp-border)] text-xs text-[var(--mp-text-muted)]">
                    Latest update by <strong className="text-[var(--mp-text)]">{task.submissions[0].submitterName}</strong>{' '}
                    ({task.submissions[0].submittedAt}):{' '}
                    {task.submissions[0].values?.ProgressNote || task.submissions[0].values?.Status || 'Updated'}
                  </div>
                )}

                {isExpanded && canSubmit && (
                  <form
                    onSubmit={(e) => handleSubmit(e, task.id)}
                    className="mt-4 pt-4 border-t border-[var(--mp-border)] space-y-3"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-[var(--mp-text-muted)] mb-1">
                          New Status
                        </label>
                        <select
                          value={statusUpdate}
                          onChange={(e) => setStatusUpdate(e.target.value)}
                          className="w-full min-h-[44px] px-3 rounded-2xl border border-[var(--mp-border)] bg-[var(--mp-surface-subtle)] text-sm text-[var(--mp-text)]"
                        >
                          <option value="To Do">To Do</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Review">Review</option>
                          <option value="Completed">Completed</option>
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-[var(--mp-text-muted)] mb-1">
                          Progress Note
                        </label>
                        <input
                          type="text"
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="What did you complete or need help with?"
                          className="w-full min-h-[44px] px-3.5 rounded-2xl border border-[var(--mp-border)] bg-[var(--mp-surface-subtle)] text-sm text-[var(--mp-text)]"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={saving}
                        className="min-h-[44px] px-5 rounded-2xl text-sm font-semibold text-white bg-[var(--mp-accent)] hover:bg-[var(--mp-accent-hover)] disabled:opacity-50 transition cursor-pointer"
                      >
                        {saving ? 'Saving...' : 'Submit Update'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// 3. PROJECTS (Scoped Participant vs Scoped Project Manager)
// ----------------------------------------------------------------------------
export function MemberProjectsView({
  data,
  searchQuery = '',
  readOnlyPreview,
  onReload,
  onNotify,
}: {
  data: MemberBootstrapData;
  searchQuery?: string;
  readOnlyPreview?: boolean;
  onReload: () => Promise<void>;
  onNotify: (msg: string, isError?: boolean) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [desc, setDesc] = useState('');
  const [status, setStatus] = useState('Active');
  const [deadline, setDeadline] = useState('');
  const [saving, setSaving] = useState(false);

  const visibleProjects = useMemo(
    () => filterBySearch(data.projects, searchQuery, ['title', 'description', 'status']),
    [data.projects, searchQuery]
  );

  const handleSaveProject = async (e: React.FormEvent, projectId: string) => {
    e.preventDefault();
    if (readOnlyPreview) return;
    setSaving(true);
    try {
      await updateMemberProjectAsManager(projectId, {
        description: desc,
        status,
        deadline,
      });
      setEditingId(null);
      await onReload();
      onNotify('Project updated.');
    } catch (err: any) {
      onNotify(err.message || 'Update failed.', true);
    } finally {
      setSaving(false);
    }
  };

  if (visibleProjects.length === 0) {
    return (
      <EmptyAppCard
        icon={Briefcase}
        title="No matching projects"
        subtitle="When Admin grants you access to a project, it will show up right here."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {visibleProjects.map((p) => {
        const actions: string[] = Array.isArray(p.myProjectActions) ? p.myProjectActions : [];
        const canManage = !readOnlyPreview && actions.includes('project.edit_details');
        const isEditing = editingId === p.id;
        return (
          <div key={p.id} className="mp-card-soft rounded-3xl p-5 flex flex-col justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <StatusPill
                  label={p.myProjectRole === 'MANAGER' ? 'Project Manager' : 'Participant'}
                  tone={p.myProjectRole === 'MANAGER' ? 'accent' : 'neutral'}
                />
                <StatusPill label={p.status || 'Active'} tone={p.status === 'Completed' ? 'success' : 'neutral'} />
              </div>
              <h3 className="text-base font-bold text-[var(--mp-text)] mt-3">{p.title}</h3>
              <p className="text-sm text-[var(--mp-text-muted)] mt-1">
                {p.description || 'No description added.'}
              </p>
              <div className="flex flex-wrap gap-3 mt-3 text-xs text-[var(--mp-text-muted)]">
                {p.deadline && <span>Deadline: {p.deadline}</span>}
                {p.budget && <span>Budget: {p.budget}</span>}
              </div>
            </div>

            {canManage && !isEditing && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(p.id);
                  setDesc(p.description || '');
                  setStatus(p.status || 'Active');
                  setDeadline(p.deadline || '');
                }}
                className="min-h-[42px] px-4 rounded-2xl text-xs font-semibold bg-[var(--mp-accent-soft)] text-[var(--mp-accent-text)] self-start cursor-pointer"
              >
                Manage Project Details
              </button>
            )}

            {isEditing && canManage && (
              <form onSubmit={(e) => handleSaveProject(e, p.id)} className="pt-3 border-t border-[var(--mp-border)] space-y-2.5">
                <textarea
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  rows={2}
                  placeholder="Project summary..."
                  className="w-full p-3 rounded-2xl border border-[var(--mp-border)] bg-[var(--mp-surface-subtle)] text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="min-h-[42px] px-3 rounded-2xl border border-[var(--mp-border)] bg-[var(--mp-surface-subtle)] text-sm"
                  >
                    <option value="Planning">Planning</option>
                    <option value="Active">Active</option>
                    <option value="On Hold">On Hold</option>
                    <option value="Completed">Completed</option>
                  </select>
                  <input
                    type="text"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    placeholder="Deadline"
                    className="min-h-[42px] px-3 rounded-2xl border border-[var(--mp-border)] bg-[var(--mp-surface-subtle)] text-sm"
                  />
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="min-h-[40px] px-3.5 rounded-2xl text-xs font-semibold text-[var(--mp-text-muted)] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="min-h-[40px] px-4 rounded-2xl text-xs font-semibold text-white bg-[var(--mp-accent)] cursor-pointer"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </form>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ----------------------------------------------------------------------------
// 4. POSTS & NOTICES
// ----------------------------------------------------------------------------
export function MemberPostsView({
  data,
  searchQuery = '',
  readOnlyPreview,
  onReload,
  onNotify,
}: {
  data: MemberBootstrapData;
  searchQuery?: string;
  readOnlyPreview?: boolean;
  onReload: () => Promise<void>;
  onNotify: (msg: string, isError?: boolean) => void;
}) {
  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const canDraft = !readOnlyPreview && canMemberAction(data.capabilities, 'post.create');
  const canPublish = !readOnlyPreview && canMemberAction(data.capabilities, 'post.publish');
  const visiblePosts = useMemo(
    () => filterBySearch(data.posts, searchQuery, ['title', 'summary', 'content', 'authorName']),
    [data.posts, searchQuery]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    try {
      await saveMemberPost({
        title: title.trim(),
        content: content.trim(),
        publishNow: canPublish,
      });
      setTitle('');
      setContent('');
      setComposerOpen(false);
      await onReload();
      onNotify(canPublish ? 'Announcement published.' : 'Draft submitted for review.');
    } catch (err: any) {
      onNotify(err.message || 'Could not save post.', true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {canDraft && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setComposerOpen((v) => !v)}
            className="min-h-[44px] px-4 rounded-2xl text-sm font-semibold text-white bg-[var(--mp-accent)] hover:bg-[var(--mp-accent-hover)] inline-flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {canPublish ? 'New Announcement' : 'Submit Draft Post'}
          </button>
        </div>
      )}

      {composerOpen && canDraft && (
        <form onSubmit={handleSubmit} className="mp-card rounded-3xl p-5 space-y-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Headline..."
            required
            className="w-full min-h-[44px] px-4 rounded-2xl border border-[var(--mp-border)] bg-[var(--mp-surface-subtle)] text-sm font-semibold"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            placeholder="Write your update clearly for the team..."
            required
            className="w-full p-4 rounded-2xl border border-[var(--mp-border)] bg-[var(--mp-surface-subtle)] text-sm"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setComposerOpen(false)}
              className="min-h-[42px] px-4 rounded-2xl text-sm text-[var(--mp-text-muted)] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[42px] px-5 rounded-2xl text-sm font-semibold text-white bg-[var(--mp-accent)] cursor-pointer"
            >
              {saving ? 'Sending...' : canPublish ? 'Publish Now' : 'Send Draft'}
            </button>
          </div>
        </form>
      )}

      {visiblePosts.length === 0 ? (
        <EmptyAppCard
          icon={Megaphone}
          title="No notices found"
          subtitle="Published announcements and important workspace news will appear here."
        />
      ) : (
        <div className="space-y-3">
          {visiblePosts.map((post) => (
            <article key={post.id} className="mp-card-soft rounded-3xl p-5">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <StatusPill label={post.type || 'POST'} tone={post.type === 'NOTICE' ? 'accent' : 'neutral'} />
                {post.priority && post.priority !== 'Normal' && (
                  <StatusPill label={post.priority} tone={post.priority === 'Urgent' ? 'danger' : 'warn'} />
                )}
                {post.status === 'DRAFT' && <StatusPill label="Pending Review" tone="warn" />}
                {post.isPinned && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--mp-accent-text)]">
                    <Pin className="w-3.5 h-3.5" /> Pinned
                  </span>
                )}
              </div>
              <h3 className="text-base sm:text-lg font-bold text-[var(--mp-text)]">{post.title}</h3>
              <p className="text-sm text-[var(--mp-text-muted)] mt-2 whitespace-pre-line">{post.content}</p>
              <div className="text-xs text-[var(--mp-text-muted)] mt-3 pt-2 border-t border-[var(--mp-border)]">
                {post.authorName} • {post.createdAt}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// 5. DOCS (Personal & Shared)
// ----------------------------------------------------------------------------
export function MemberDocsView({
  data,
  searchQuery = '',
  readOnlyPreview,
  onReload,
  onNotify,
}: {
  data: MemberBootstrapData;
  searchQuery?: string;
  readOnlyPreview?: boolean;
  onReload: () => Promise<void>;
  onNotify: (msg: string, isError?: boolean) => void;
}) {
  const [selected, setSelected] = useState<any | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Personal');
  const [bodyText, setBodyText] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [engineTarget, setEngineTarget] = useState<UniversalEngineTarget | null>(null);

  const canCreate = !readOnlyPreview && canMemberAction(data.capabilities, 'doc.create');
  const canEditOwn = canCreate;
  const canDeleteOwn = canCreate;
  const visibleDocs = useMemo(
    () => filterBySearch(data.docs, searchQuery, ['title', 'category', 'bodyText']),
    [data.docs, searchQuery]
  );

  const openEditor = (doc?: any) => {
    if (doc) {
      setSelected(doc);
      setTitle(doc.title);
      setCategory(doc.category || 'General');
      setBodyText(doc.bodyText || '');
    } else {
      setSelected(null);
      setTitle('');
      setCategory('Personal');
      setBodyText('');
    }
    setEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await saveMemberDoc({
        id: selected?.id,
        title: title.trim(),
        category,
        bodyText,
      });
      setEditing(false);
      await onReload();
      onNotify('Document saved.');
    } catch (err: any) {
      onNotify(err.message || 'Could not save document.', true);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (docId: string) => {
    try {
      await deleteMemberDoc(docId);
      setSelected(null);
      setEditing(false);
      await onReload();
      onNotify('Document deleted.');
    } catch (err: any) {
      onNotify(err.message || 'Delete failed.', true);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--mp-text-muted)]">{data.docs.length} personal & shared notes</p>
        {canCreate && !editing && (
          <button
            type="button"
            onClick={() => openEditor()}
            className="min-h-[44px] px-4 rounded-2xl text-sm font-semibold text-white bg-[var(--mp-accent)] inline-flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" /> New Doc
          </button>
        )}
      </div>

      {editing ? (
        <form onSubmit={handleSave} className="mp-card rounded-3xl p-5 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Document title..."
              required
              className="flex-1 min-h-[44px] px-4 rounded-2xl border border-[var(--mp-border)] bg-[var(--mp-surface-subtle)] text-sm font-semibold"
            />
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Category"
              className="sm:w-40 min-h-[44px] px-4 rounded-2xl border border-[var(--mp-border)] bg-[var(--mp-surface-subtle)] text-sm"
            />
          </div>
          <textarea
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
            rows={8}
            placeholder="Start typing cleanly..."
            className="w-full p-4 rounded-2xl border border-[var(--mp-border)] bg-[var(--mp-surface-subtle)] text-sm leading-relaxed"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="min-h-[42px] px-4 rounded-2xl text-sm text-[var(--mp-text-muted)] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[42px] px-5 rounded-2xl text-sm font-semibold text-white bg-[var(--mp-accent)] cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save Document'}
            </button>
          </div>
        </form>
      ) : visibleDocs.length === 0 ? (
        <EmptyAppCard
          icon={FileText}
          title="No documents found"
          subtitle="Create a personal note or wait for someone to share a document with you."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {visibleDocs.map((doc) => {
            const isMine = doc.ownerUserId === data.user.id || data.capabilities.isAdmin;
            return (
              <div key={doc.id} className="mp-card-soft rounded-3xl p-5 flex flex-col justify-between gap-3">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <StatusPill label={doc.category || 'General'} tone="neutral" />
                    <StatusPill label={isMine ? 'Personal' : 'Shared with you'} tone={isMine ? 'accent' : 'success'} />
                  </div>
                  <h3 className="text-base font-bold text-[var(--mp-text)] mt-2.5">{doc.title}</h3>
                  <p className="text-sm text-[var(--mp-text-muted)] mt-1 line-clamp-3 whitespace-pre-line">
                    {doc.bodyText || 'Empty document'}
                  </p>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-[var(--mp-border)]">
                  <span className="text-xs text-[var(--mp-text-muted)]">{doc.wordCount || 0} words</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setEngineTarget({
                          title: `${doc.title}.docx`,
                          docId: doc.id,
                          fileId: doc.linkedFileId,
                          bodyText: doc.bodyText,
                          initialMode: isMine && canEditOwn ? 'EDIT' : 'VIEW',
                        })
                      }
                      className="min-h-[38px] px-3 rounded-xl text-xs font-semibold bg-blue-50 text-[#0B57D0] cursor-pointer inline-flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" /> Engine
                    </button>
                    {isMine && canEditOwn && (
                      <button
                        type="button"
                        onClick={() => openEditor(doc)}
                        className="min-h-[38px] px-3.5 rounded-xl text-xs font-semibold bg-[var(--mp-accent-soft)] text-[var(--mp-accent-text)] cursor-pointer"
                      >
                        Edit
                      </button>
                    )}
                    {isMine && canDeleteOwn && (
                      <button
                        type="button"
                        onClick={() => handleDelete(doc.id)}
                        aria-label={`Delete ${doc.title}`}
                        className="min-h-[38px] px-2.5 rounded-xl text-rose-600 hover:bg-rose-50 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <UniversalDocumentEngineModal
        isOpen={Boolean(engineTarget)}
        target={engineTarget}
        onClose={() => setEngineTarget(null)}
        onSavedOrUpdated={onReload}
      />
    </div>
  );
}

// ----------------------------------------------------------------------------
// 6. FORMS (Personal Forms Owned/Shared)
// ----------------------------------------------------------------------------
export function MemberFormsView({
  data,
  searchQuery = '',
  readOnlyPreview,
  onReload,
  onNotify,
}: {
  data: MemberBootstrapData;
  searchQuery?: string;
  readOnlyPreview?: boolean;
  onReload: () => Promise<void>;
  onNotify: (msg: string, isError?: boolean) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [fieldLabel, setFieldLabel] = useState('Full Name');
  const [saving, setSaving] = useState(false);

  const canCreate = !readOnlyPreview && canMemberAction(data.capabilities, 'form.create');
  const visibleForms = useMemo(
    () => filterBySearch(data.forms, searchQuery, ['title', 'description']),
    [data.forms, searchQuery]
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await saveMemberForm({
        title: title.trim(),
        description,
        fields: [
          {
            id: `fld-${Date.now()}`,
            label: fieldLabel.trim() || 'Response',
            type: 'text',
            required: true,
          },
        ],
      });
      setTitle('');
      setDescription('');
      setCreating(false);
      await onReload();
      onNotify('Personal form created.');
    } catch (err: any) {
      onNotify(err.message || 'Could not create form.', true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {canCreate && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setCreating((v) => !v)}
            className="min-h-[44px] px-4 rounded-2xl text-sm font-semibold text-white bg-[var(--mp-accent)] inline-flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" /> New Personal Form
          </button>
        </div>
      )}

      {creating && canCreate && (
        <form onSubmit={handleSave} className="mp-card rounded-3xl p-5 space-y-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Form title..."
            required
            className="w-full min-h-[44px] px-4 rounded-2xl border border-[var(--mp-border)] bg-[var(--mp-surface-subtle)] text-sm font-semibold"
          />
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description..."
            className="w-full min-h-[44px] px-4 rounded-2xl border border-[var(--mp-border)] bg-[var(--mp-surface-subtle)] text-sm"
          />
          <input
            type="text"
            value={fieldLabel}
            onChange={(e) => setFieldLabel(e.target.value)}
            placeholder="Primary question label"
            className="w-full min-h-[44px] px-4 rounded-2xl border border-[var(--mp-border)] bg-[var(--mp-surface-subtle)] text-sm"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="min-h-[42px] px-4 rounded-2xl text-sm text-[var(--mp-text-muted)] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[42px] px-5 rounded-2xl text-sm font-semibold text-white bg-[var(--mp-accent)] cursor-pointer"
            >
              {saving ? 'Saving...' : 'Create Form'}
            </button>
          </div>
        </form>
      )}

      {visibleForms.length === 0 ? (
        <EmptyAppCard
          icon={ClipboardList}
          title="No forms found"
          subtitle="Forms you create or forms shared with your account appear here."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {visibleForms.map((form) => (
            <div key={form.id} className="mp-card-soft rounded-3xl p-5">
              <div className="flex items-center justify-between gap-2">
                <StatusPill label={`${form.submissionsCount || 0} Responses`} tone="accent" />
                <span className="text-xs text-[var(--mp-text-muted)]">{form.fields?.length || 0} fields</span>
              </div>
              <h3 className="text-base font-bold text-[var(--mp-text)] mt-2.5">{form.title}</h3>
              {form.description && (
                <p className="text-sm text-[var(--mp-text-muted)] mt-1">{form.description}</p>
              )}
              <a
                href={`/?form=${encodeURIComponent(form.id)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 mt-3 text-xs font-semibold text-[var(--mp-accent-text)] hover:underline"
              >
                Open Fillable Form Link
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// 7. SLIDES (Deck Reader + Light Deck Creator)
// ----------------------------------------------------------------------------
export function MemberSlidesView({
  data,
  searchQuery = '',
  readOnlyPreview,
  onReload,
  onNotify,
}: {
  data: MemberBootstrapData;
  searchQuery?: string;
  readOnlyPreview?: boolean;
  onReload: () => Promise<void>;
  onNotify: (msg: string, isError?: boolean) => void;
}) {
  const [activeDeck, setActiveDeck] = useState<any | null>(null);
  const [pageIdx, setPageIdx] = useState(0);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [saving, setSaving] = useState(false);

  const canCreate = !readOnlyPreview && canMemberAction(data.capabilities, 'slide.create');
  const visibleSlides = useMemo(
    () => filterBySearch(data.slides, searchQuery, ['title', 'subtitle', 'category']),
    [data.slides, searchQuery]
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await saveMemberSlide({
        title: title.trim(),
        subtitle,
        pages: [
          {
            id: `sp-${Date.now()}-1`,
            slideNumber: 1,
            title: title.trim(),
            subtitle: subtitle || 'Presentation Overview',
            bullets: subtitle ? subtitle.split('\n').filter(Boolean) : ['Key highlights & talking points'],
          },
        ],
      });
      setTitle('');
      setSubtitle('');
      setCreating(false);
      await onReload();
      onNotify('Slide deck saved.');
    } catch (err: any) {
      onNotify(err.message || 'Could not create slide deck.', true);
    } finally {
      setSaving(false);
    }
  };

  if (activeDeck) {
    const rawPages: any[] = Array.isArray(activeDeck.pages) && activeDeck.pages.length > 0
      ? activeDeck.pages
      : [{ id: 'sp-1', slideNumber: 1, layout: 'TITLE_COVER', title: activeDeck.title, subtitle: activeDeck.subtitle || 'Presentation slide', bullets: [], speakerNotes: '' }];
    const studioPages = rawPages.map((p: any, i: number) =>
      ensureClientSlideElements(
        {
          id: p.id || `mp-sp-${i}`,
          slideNumber: p.slideNumber || i + 1,
          layout: p.layout || (i === 0 ? 'TITLE_COVER' : 'BULLETS_AND_INSIGHTS'),
          title: p.title || p.heading || activeDeck.title,
          subtitle: p.subtitle || p.body || '',
          bullets: Array.isArray(p.bullets) ? p.bullets : [],
          speakerNotes: p.speakerNotes || '',
          imageUrl: p.imageUrl,
          accentColor: p.accentColor || activeDeck.themeColor,
          bgColor: p.bgColor,
          elements: p.elements,
        },
        activeDeck.themeColor || '#D97706'
      )
    );

    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => {
            setActiveDeck(null);
            setPageIdx(0);
          }}
          className="min-h-[40px] px-3.5 rounded-2xl mp-card-soft text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" /> Back to Decks
        </button>

        <div className="mp-card rounded-3xl overflow-hidden min-h-[460px] flex flex-col">
          <Suspense fallback={<div className="p-8 text-xs text-slate-500">Loading Visual Presentation...</div>}>
            <SlideCanvasStudio
              title={activeDeck.title}
              themeColor={activeDeck.themeColor || '#D97706'}
              pages={studioPages}
              mode="VIEW"
              onChangePages={() => {}}
            />
          </Suspense>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {canCreate && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setCreating((v) => !v)}
            className="min-h-[44px] px-4 rounded-2xl text-sm font-semibold text-white bg-[var(--mp-accent)] inline-flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" /> New Slide Deck
          </button>
        </div>
      )}

      {creating && canCreate && (
        <form onSubmit={handleCreate} className="mp-card rounded-3xl p-5 space-y-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Deck title..."
            required
            className="w-full min-h-[44px] px-4 rounded-2xl border border-[var(--mp-border)] bg-[var(--mp-surface-subtle)] text-sm font-semibold"
          />
          <textarea
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            rows={3}
            placeholder="Intro slide bullet points..."
            className="w-full p-4 rounded-2xl border border-[var(--mp-border)] bg-[var(--mp-surface-subtle)] text-sm"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setCreating(false)} className="min-h-[42px] px-4 text-sm text-[var(--mp-text-muted)] cursor-pointer">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="min-h-[42px] px-5 rounded-2xl text-sm font-semibold text-white bg-[var(--mp-accent)] cursor-pointer">
              {saving ? 'Creating...' : 'Create Deck'}
            </button>
          </div>
        </form>
      )}

      {visibleSlides.length === 0 ? (
        <EmptyAppCard
          icon={Presentation}
          title="No slide decks found"
          subtitle="Decks you create or decks shared with you appear here."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {visibleSlides.map((deck) => (
            <button
              key={deck.id}
              type="button"
              onClick={() => {
                setActiveDeck(deck);
                setPageIdx(0);
              }}
              className="text-left mp-card-soft rounded-3xl p-5 hover:opacity-95 transition cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2">
                <StatusPill label={`${deck.slideCount || 1} Slides`} tone="accent" />
                <span className="text-xs text-[var(--mp-text-muted)]">{deck.updatedAt}</span>
              </div>
              <h3 className="text-base font-bold text-[var(--mp-text)] mt-2.5">{deck.title}</h3>
              {deck.subtitle && <p className="text-sm text-[var(--mp-text-muted)] mt-1 line-clamp-2">{deck.subtitle}</p>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// 8. SCOPED TEAM CHAT
// ----------------------------------------------------------------------------
export function MemberChatView({
  data,
  readOnlyPreview,
  onReload,
  onNotify,
}: {
  data: MemberBootstrapData;
  readOnlyPreview?: boolean;
  onReload: () => Promise<void>;
  onNotify: (msg: string, isError?: boolean) => void;
}) {
  const [activeChannelId, setActiveChannelId] = useState<string>(data.channels[0]?.id || '');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);



  const selectedChannel =
    data.channels.find((c) => c.id === activeChannelId) || data.channels[0] || null;
  const canSend = !readOnlyPreview && canMemberAction(data.capabilities, 'channel.send_member');

  const messages = useMemo(
    () =>
      selectedChannel
        ? data.chatMessages.filter((m) => m.channelId === selectedChannel.id)
        : [],
    [data.chatMessages, selectedChannel]
  );

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChannel || !text.trim() || !canSend) return;
    setSending(true);
    try {
      await sendMemberChatMessage(selectedChannel.id, text.trim());
      setText('');
      await onReload();
    } catch (err: any) {
      onNotify(err.message || 'Could not send message.', true);
    } finally {
      setSending(false);
    }
  };

  if (data.channels.length === 0) {
    return (
      <EmptyAppCard
        icon={MessageCircle}
        title="No channels assigned"
        subtitle="Ask your Admin to invite you to a project or team chat channel."
      />
    );
  }

  return (
    <div className="mp-card rounded-3xl overflow-hidden flex flex-col min-h-[62dvh]">
      {/* Channel Pills */}
      <div className="p-3.5 border-b border-[var(--mp-border)] flex items-center gap-2 overflow-x-auto bg-[var(--mp-surface-subtle)]">
        {data.channels.map((ch) => (
          <button
            key={ch.id}
            type="button"
            onClick={() => setActiveChannelId(ch.id)}
            className={`min-h-[40px] px-4 rounded-2xl text-xs sm:text-sm font-semibold whitespace-nowrap transition cursor-pointer ${
              selectedChannel?.id === ch.id
                ? 'bg-[var(--mp-accent)] text-white shadow-sm'
                : 'bg-white text-[var(--mp-text-muted)]'
            }`}
          >
            # {ch.name}
          </button>
        ))}
      </div>

      {/* Messages Feed */}
      <div className="flex-1 p-4 space-y-3 overflow-y-auto max-h-[52dvh]">
        {messages.length === 0 ? (
          <p className="text-sm text-[var(--mp-text-muted)] text-center py-10">
            No messages in #{selectedChannel?.name} yet. Say hello!
          </p>
        ) : (
          messages.map((m) => {
            const isMine = m.senderEmail?.toLowerCase() === data.user.email.toLowerCase();
            return (
              <div key={m.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                <div className="text-[11px] font-medium text-[var(--mp-text-muted)] mb-1 px-1">
                  {isMine ? 'You' : m.senderName} • {m.createdAt}
                </div>
                <div
                  className={`max-w-[82%] px-4 py-2.5 rounded-2xl text-sm whitespace-pre-line ${
                    isMine
                      ? 'bg-[var(--mp-accent)] text-white rounded-br-sm'
                      : 'bg-[var(--mp-surface-subtle)] text-[var(--mp-text)] rounded-bl-sm'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Composer */}
      <form onSubmit={handleSend} className="p-3 border-t border-[var(--mp-border)] flex items-center gap-2 bg-white">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={!canSend || sending}
          placeholder={
            readOnlyPreview
              ? 'Read-only preview mode'
              : canSend
              ? `Message #${selectedChannel?.name}...`
              : 'Sending messages is disabled by Admin'
          }
          className="flex-1 min-h-[44px] px-4 rounded-2xl bg-[var(--mp-surface-subtle)] text-sm text-[var(--mp-text)] border border-[var(--mp-border)]"
        />
        <button
          type="submit"
          disabled={!canSend || sending || !text.trim()}
          aria-label="Send message"
          className="min-h-[44px] min-w-[44px] px-4 rounded-2xl bg-[var(--mp-accent)] text-white flex items-center justify-center disabled:opacity-40 cursor-pointer"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}

// ----------------------------------------------------------------------------
// 9. PERSONAL FILES & STORAGE QUOTA
// ----------------------------------------------------------------------------
export function MemberFilesView({
  data,
  searchQuery = '',
  readOnlyPreview,
  onReload,
  onNotify,
}: {
  data: MemberBootstrapData;
  searchQuery?: string;
  readOnlyPreview?: boolean;
  onReload: () => Promise<void>;
  onNotify: (msg: string, isError?: boolean) => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [engineTarget, setEngineTarget] = useState<UniversalEngineTarget | null>(null);
  const [editingImageTarget, setEditingImageTarget] = useState<ImageEditorTarget | null>(null);

  const canUpload = !readOnlyPreview && canMemberAction(data.capabilities, 'file.upload_own');
  const canDelete = !readOnlyPreview && canMemberAction(data.capabilities, 'file.upload_own');
  const visibleFiles = useMemo(
    () => filterBySearch(data.files, searchQuery, ['name', 'folderName', 'extension']),
    [data.files, searchQuery]
  );

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Could not read selected file.'));
        reader.readAsDataURL(file);
      });
      await uploadMemberFile({
        originalName: file.name,
        mimeType: file.type || 'application/octet-stream',
        dataUrl,
      });
      await onReload();
      onNotify(`Uploaded "${file.name}".`);
    } catch {
      onNotify('Unable to upload this file. Please try another file or contact your administrator.', true);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (fileId: string, name: string) => {
    try {
      await deleteMemberFile(fileId);
      await onReload();
      onNotify(`Deleted "${name}".`);
    } catch (err: any) {
      onNotify(err.message || 'Delete failed.', true);
    }
  };

  return (
    <div className="space-y-4">
      {/* Clean Files Header Bar */}
      <div className="mp-card rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 text-sm font-bold text-[var(--mp-text)]">
            <FolderOpen className="w-4 h-4 text-[var(--mp-accent)]" />
            My Files &amp; Shared Documents
          </div>
          <p className="text-xs text-[var(--mp-text-muted)] mt-1">
            Upload files or open documents shared directly with your workspace.
          </p>
        </div>

        {canUpload ? (
          <>
            <input
              ref={fileRef}
              type="file"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="min-h-[46px] px-5 rounded-2xl text-sm font-semibold text-white bg-[var(--mp-accent)] hover:bg-[var(--mp-accent-hover)] inline-flex items-center justify-center gap-2 shadow-sm shrink-0 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              {uploading ? 'Uploading...' : 'Upload File'}
            </button>
          </>
        ) : (
          <StatusPill label="Upload Disabled" tone="neutral" />
        )}
      </div>

      {visibleFiles.length === 0 ? (
        <EmptyAppCard
          icon={FolderOpen}
          title="No files found"
          subtitle="Upload files or view documents shared directly with you here."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {visibleFiles.map((file) => {
            const isMine = file.ownerUserId === data.user.id || data.capabilities.isAdmin;
            const isImg = Boolean(file.isImage || String(file.mimeType || '').startsWith('image/'));
            return (
              <div
                key={file.id}
                onMouseEnter={() => prefetchEngineFile(file.id)}
                className="mp-card-soft rounded-3xl p-4 flex flex-col justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  {isImg ? (
                    <img
                      src={file.thumbnailUrl || file.url}
                      alt={file.name}
                      onClick={() =>
                        setEngineTarget({
                          title: file.name,
                          url: file.url,
                          mimeType: file.mimeType,
                          extension: file.extension,
                          fileId: file.id,
                          initialMode: 'VIEW',
                        })
                      }
                      className="w-12 h-12 rounded-2xl object-cover border border-[var(--mp-border)] shrink-0 cursor-pointer"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-2xl bg-[var(--mp-accent-soft)] text-[var(--mp-accent-text)] flex items-center justify-center shrink-0">
                      <Paperclip className="w-5 h-5" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-[var(--mp-text)] truncate">{file.name}</div>
                    <div className="text-xs text-[var(--mp-text-muted)] mt-0.5">
                      {formatBytesCompact(file.compressedSizeBytes)} • {file.uploadedAt}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-[var(--mp-border)]">
                  <StatusPill label={isMine ? 'My File' : 'Shared'} tone={isMine ? 'accent' : 'success'} />
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() =>
                        setEngineTarget({
                          title: file.name,
                          url: file.url,
                          mimeType: file.mimeType,
                          extension: file.extension,
                          fileId: file.id,
                          slideDeckId: file.slideDeckId,
                          docId: file.docId,
                          initialMode: 'VIEW',
                        })
                      }
                      className="min-h-[38px] px-3 rounded-xl text-xs font-semibold bg-blue-50 text-[#0B57D0] inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" /> Engine
                    </button>
                    {isImg && isMine && (
                      <button
                        type="button"
                        onClick={() =>
                          setEditingImageTarget({
                            title: file.name,
                            imageUrl: file.url,
                            fileId: file.id,
                          })
                        }
                        className="min-h-[38px] px-2.5 rounded-xl text-xs font-semibold bg-purple-50 text-purple-700 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Edit
                      </button>
                    )}
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Download ${file.name}`}
                      className="min-h-[38px] px-2.5 rounded-xl text-xs font-semibold bg-[var(--mp-surface-subtle)] text-[var(--mp-text)] inline-flex items-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                    {isMine && canDelete && (
                      <button
                        type="button"
                        onClick={() => handleDelete(file.id, file.name)}
                        aria-label={`Delete ${file.name}`}
                        className="min-h-[38px] px-2.5 rounded-xl text-rose-600 hover:bg-rose-50 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <UniversalDocumentEngineModal
        isOpen={Boolean(engineTarget)}
        target={engineTarget}
        onClose={() => setEngineTarget(null)}
        onSavedOrUpdated={onReload}
      />

      {editingImageTarget && (
        <Suspense fallback={null}>
          <ImageEditorModal
            isOpen={Boolean(editingImageTarget)}
            target={editingImageTarget}
            onClose={() => setEditingImageTarget(null)}
            onSaved={async () => {
              setEditingImageTarget(null);
              await onReload();
              onNotify('Edited image saved!');
            }}
          />
        </Suspense>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// 10. TEAMS DIRECTORY
// ----------------------------------------------------------------------------
export function MemberTeamsView({
  data,
  searchQuery = '',
}: {
  data: MemberBootstrapData;
  searchQuery?: string;
}) {
  const [query, setQuery] = useState('');
  const combinedQuery = (query || searchQuery).trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!combinedQuery) return data.teams.members;
    return data.teams.members.filter(
      (m) =>
        m.fullName.toLowerCase().includes(combinedQuery) ||
        m.email.toLowerCase().includes(combinedQuery) ||
        (m.designation || '').toLowerCase().includes(combinedQuery) ||
        (m.teamName || '').toLowerCase().includes(combinedQuery)
    );
  }, [data.teams.members, combinedQuery]);

  return (
    <div className="space-y-4">
      <div className="mp-card-soft rounded-2xl px-4 py-2.5 flex items-center gap-2.5">
        <Search className="w-4 h-4 text-[var(--mp-text-muted)]" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a teammate, designation, or group..."
          className="w-full bg-transparent text-sm text-[var(--mp-text)] focus:outline-none"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyAppCard
          icon={Users}
          title="No matching teammates"
          subtitle="Try clearing your search filter."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((m) => (
            <div key={m.id} className="mp-card-soft rounded-3xl p-4 flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-[var(--mp-accent-soft)] text-[var(--mp-accent-text)] font-bold flex items-center justify-center shrink-0">
                {String(m.fullName || 'U').slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-[var(--mp-text)] truncate">{m.fullName}</div>
                <div className="text-xs text-[var(--mp-text-muted)] truncate">{m.designation || 'Team Member'}</div>
                {m.teamName && (
                  <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[var(--mp-surface-subtle)] text-[var(--mp-text)]">
                    {m.teamName}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// 11. ACCOUNT, PROFILE, THEME & PASSWORD (Inline Workspace View — No Clunky Popups)
// ----------------------------------------------------------------------------
export function MemberAccountSettingsView({
  data,
  activeTheme,
  readOnlyPreview,
  onSelectTheme,
  onReload,
  onNotify,
  onUserUpdated,
}: {
  data: MemberBootstrapData;
  activeTheme: MemberThemeKey;
  readOnlyPreview?: boolean;
  onSelectTheme: (theme: MemberThemeKey) => Promise<void> | void;
  onReload: () => Promise<void>;
  onNotify: (msg: string, isError?: boolean) => void;
  onUserUpdated?: (user: WorkspaceAuthUser, caps?: EvaluatedCapabilitiesClient) => void;
}) {
  const { user, capabilities } = data;
  const [displayName, setDisplayName] = useState(user.name);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const themes: Array<{ key: MemberThemeKey; label: string; desc: string; swatch: string }> = [
    { key: 'cloud', label: 'Porcelain Mist', desc: 'Clean sky-slate pastel', swatch: '#4f46e5' },
    { key: 'mint', label: 'Seafoam Calm', desc: 'Soft botanical teal pastel', swatch: '#0d9488' },
    { key: 'lavender', label: 'Pearl Iris', desc: 'Warm lavender-iris pastel', swatch: '#7c3aed' },
  ];

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnlyPreview || !displayName.trim()) return;
    setSaving(true);
    try {
      const res = await updateMyMemberPreferences({
        name: displayName.trim(),
        memberTheme: activeTheme,
      });
      if (res.user) onUserUpdated?.(res.user);
      await onReload();
      onNotify('Display name updated.');
    } catch (err: any) {
      onNotify(err?.message || 'Could not update display name.', true);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnlyPreview || !currentPassword || newPassword.length < 6) return;
    setSaving(true);
    try {
      await updateMyPassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      onNotify('Password updated securely.');
    } catch (err: any) {
      onNotify(err?.message || 'Could not update password.', true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      <div className="lg:col-span-7 space-y-5">
        {/* Profile Card */}
        <section className="mp-card-soft rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-3.5 pb-4 border-b border-[var(--mp-border)]">
            <div className="w-12 h-12 rounded-2xl bg-[var(--mp-accent)] text-white font-bold text-base flex items-center justify-center shadow-xs shrink-0">
              {String(user.name || 'M').slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-[var(--mp-text)] truncate">{user.name}</h2>
              <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--mp-text-muted)] mt-0.5">
                <span className="inline-flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5" /> {user.email}
                </span>
                <StatusPill label={`${capabilities.role} · ${capabilities.presetKey}`} tone="accent" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-[var(--mp-surface-subtle)]">
              <div className="font-semibold text-[var(--mp-text-muted)] flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" /> Phone
              </div>
              <div className="font-bold text-[var(--mp-text)] mt-1">
                {user.phoneNumber
                  ? `${user.phoneCountryCode || ''} ${user.phoneNumber}`
                  : 'Not provided'}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-[var(--mp-surface-subtle)]">
              <div className="font-semibold text-[var(--mp-text-muted)] flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" /> Location
              </div>
              <div className="font-bold text-[var(--mp-text)] mt-1">
                {[user.addressLine, user.cityName, user.stateName, user.zipCode, user.countryName]
                  .filter(Boolean)
                  .join(', ') || 'Not provided'}
              </div>
            </div>
          </div>

          {!readOnlyPreview && (
            <form onSubmit={handleSaveName} className="pt-2 space-y-2">
              <label
                htmlFor="member-display-name"
                className="block text-xs font-bold text-[var(--mp-text)]"
              >
                Update Display Name
              </label>
              <div className="flex gap-2">
                <input
                  id="member-display-name"
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="flex-1 min-h-[42px] px-3.5 rounded-xl border border-[var(--mp-border)] bg-[var(--mp-surface-subtle)] text-sm text-[var(--mp-text)]"
                />
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-[42px] px-4 rounded-xl text-xs font-bold text-white bg-[var(--mp-accent)] hover:bg-[var(--mp-accent-hover)] cursor-pointer"
                >
                  Save Name
                </button>
              </div>
            </form>
          )}
        </section>

        {/* Theme Appearance Studio */}
        <section className="mp-card-soft rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-[var(--mp-text)]">
            <Palette className="w-4 h-4 text-[var(--mp-accent)]" />
            <span>Dashboard Appearance Themes</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {themes.map((t) => {
              const selected = activeTheme === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => onSelectTheme(t.key)}
                  className={`text-left p-3.5 rounded-xl border transition cursor-pointer ${
                    selected
                      ? 'border-[var(--mp-accent)] bg-[var(--mp-accent-soft)]'
                      : 'border-[var(--mp-border)] bg-[var(--mp-surface-subtle)] hover:opacity-90'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0"
                      style={{ backgroundColor: t.swatch }}
                    />
                    <span className="text-xs font-bold text-[var(--mp-text)]">{t.label}</span>
                  </div>
                  <div className="text-[11px] text-[var(--mp-text-muted)] mt-1">{t.desc}</div>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      <div className="lg:col-span-5 space-y-5">
        {/* Security & Password */}
        {!readOnlyPreview && (
          <section className="mp-card-soft rounded-2xl p-5">
            <div className="flex items-center gap-2 text-sm font-bold text-[var(--mp-text)] mb-3">
              <KeyRound className="w-4 h-4 text-[var(--mp-accent)]" />
              <span>Change Password</span>
            </div>
            <form onSubmit={handleChangePassword} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[var(--mp-text-muted)] mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full min-h-[42px] px-3.5 rounded-xl border border-[var(--mp-border)] bg-[var(--mp-surface-subtle)] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--mp-text-muted)] mb-1">
                  New Password (min 6 characters)
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full min-h-[42px] px-3.5 rounded-xl border border-[var(--mp-border)] bg-[var(--mp-surface-subtle)] text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={saving || !currentPassword || newPassword.length < 6}
                className="w-full min-h-[42px] rounded-xl text-xs font-bold text-white bg-[var(--mp-accent)] hover:bg-[var(--mp-accent-hover)] disabled:opacity-50 cursor-pointer"
              >
                Update Password
              </button>
            </form>
          </section>
        )}

        {/* Workspace Access & Permissions Overview */}
        <section className="mp-card-soft rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-[var(--mp-text)]">
            <ShieldCheck className="w-4 h-4 text-[var(--mp-accent)]" />
            <span>Workspace Access &amp; Modules</span>
          </div>

          <div>
            <div className="text-xs font-semibold text-[var(--mp-text-muted)] mb-2">
              Enabled Modules ({capabilities.allowedModules.length})
            </div>
            <div className="flex flex-wrap gap-1.5">
              {capabilities.allowedModules.map((mod) => (
                <StatusPill key={mod} label={mod} tone="neutral" />
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export function MemberRestrictedNotice({ moduleName }: { moduleName: string }) {
  return (
    <div className="mp-card-soft rounded-2xl p-8 text-center">
      <div className="w-12 h-12 rounded-2xl mx-auto mb-3 bg-slate-100 text-slate-500 flex items-center justify-center">
        <Lock className="w-6 h-6" />
      </div>
      <h3 className="text-base font-bold text-[var(--mp-text)]">{moduleName} is restricted</h3>
      <p className="text-sm text-[var(--mp-text-muted)] mt-1">
        Your Workspace Admin has not enabled this app for your account yet.
      </p>
    </div>
  );
}
