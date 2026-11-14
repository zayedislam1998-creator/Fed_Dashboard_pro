import React, { useMemo } from 'react';
import {
  Briefcase,
  CheckSquare,
  FileText,
  Pin,
  Sparkles,
} from 'lucide-react';
import {
  MemberBootstrapData,
  StatusPill,
  taskStatusTone,
} from './shared';

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
          <div className="lg:text-lg font-extrabold text-[var(--mp-text)] mt-2">
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
