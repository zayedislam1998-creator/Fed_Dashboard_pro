import React from 'react';
import {
  Briefcase,
  CheckSquare,
  ClipboardList,
  FileText,
  FolderOpen,
  HardDrive,
  LayoutDashboard,
  Lock,
  MessageCircle,
  MessagesSquare,
  Megaphone,
  Presentation,
  User as UserIcon,
  Users,
} from 'lucide-react';
import type {
  EvaluatedCapabilitiesClient,
  MemberThemeKey,
  WorkspaceAuthUser,
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

export function filterBySearch<T extends Record<string, any>>(
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

export function StatusPill({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'accent' | 'success' | 'warn' | 'danger' }) {
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

export function taskStatusTone(status: string): 'neutral' | 'accent' | 'success' | 'warn' {
  if (status === 'Completed') return 'success';
  if (status === 'In Progress') return 'accent';
  if (status === 'Review') return 'warn';
  return 'neutral';
}

export function EmptyAppCard({
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
  { id: 'main_feed', label: 'Main', shortLabel: 'Main', description: 'Workspace activity and assigned work', section: 'workspace', icon: LayoutDashboard },
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

export type { EvaluatedCapabilitiesClient, MemberThemeKey, WorkspaceAuthUser };
