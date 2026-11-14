import { wsFetch as fetch } from '../sessionFetch';

export interface WorkspaceNotification {
  id: string;
  type:
    | 'gmail_received'
    | 'server_mail_received'
    | 'mail_sent'
    | 'form_submitted'
    | 'cmh_activity'
    | 'auth_activity'
    | 'db_event';
  title: string;
  description: string;
  module:
    | 'gmail'
    | 'server_mail'
    | 'bulk'
    | 'docs'
    | 'slides'
    | 'forms'
    | 'meet'
    | 'teams'
    | 'posts'
    | 'files'
    | 'cmh_tasks'
    | 'cmh_projects'
    | 'cmh_forms'
    | 'admin_panel'
    | 'postgres';
  targetId?: string;
  accountId?: string;
  timestamp: number;
  timeLabel: string;
  isRead: boolean;
}

export async function fetchNotifications(): Promise<WorkspaceNotification[]> {
  const res = await fetch('/api/notifications');
  if (!res.ok) return [];
  const data = await res.json();
  return data.notifications || [];
}

export async function createNotification(payload: {
  type: WorkspaceNotification['type'];
  title: string;
  description: string;
  module: WorkspaceNotification['module'];
  targetId?: string;
  accountId?: string;
}): Promise<WorkspaceNotification | null> {
  const res = await fetch('/api/notifications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.notification || null;
}

export async function markNotificationsRead(id?: string): Promise<WorkspaceNotification[]> {
  const res = await fetch('/api/notifications/mark-read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  });
  const data = await res.json();
  return data.notifications || [];
}

export async function clearAllNotifications(): Promise<void> {
  await fetch('/api/notifications', { method: 'DELETE' });
}
