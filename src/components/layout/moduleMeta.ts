import React from 'react';
import {
  LayoutGrid,
  LayoutDashboard,
  ShieldCheck,
  Mail,
  Server,
  Layers,
  Users,
  Megaphone,
  HardDrive,
  FileText,
  Presentation,
  ClipboardList,
  Video,
  CheckSquare,
  Briefcase,
  Blocks,
  Table,
  Calendar,
  Receipt,
  UserCheck,
  Clock,
  MessageSquare,
  BookOpen,
  Zap,
  MessagesSquare,
  Settings,
} from 'lucide-react';
import { WorkspaceModule } from './types';

export interface ModuleMetaItem {
  title: string;
  colorClass: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const moduleMeta: Record<WorkspaceModule, ModuleMetaItem> = {
  main_feed: { title: 'Main', colorClass: 'text-[#0B57D0]', icon: LayoutGrid },
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
