import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckSquare,
  Plus,
  Search,
  Copy,
  Check,
  ExternalLink,
  Trash2,
  Edit3,
  Eye,
  Globe,
  Lock,
  UserPlus,
  Calendar,
  Blocks,
  X,
  CheckCircle2,
  Loader2,
  Users,
  AlertCircle,
} from 'lucide-react';
import {
  CmhTaskItem,
  CmhFormTemplate,
  CmhSubmission,
  WorkspaceMemberItem,
  WorkspaceTeamGroup,
  fetchCmhWorkspaceBootstrap,
  saveCmhTask,
  deleteCmhTask,
  saveCmhFormTemplate,
  searchMembersInstant,
} from '../services/workspaceApi';
import { CmhDynamicFieldsRenderer } from './CmhDynamicFieldsRenderer';
import { CmhMemberInviteModal } from './CmhMemberInviteModal';
import { CmhFormFieldsEditorModal } from './CmhFormFieldsEditorModal';

export type CmhTasksSubTab = 'all_tasks' | 'create_task';

interface CmhTasksViewProps {
  initialItemId?: string;
  onInitialItemOpened?: () => void;
  activeSubTab?: CmhTasksSubTab;
  onSubTabChange?: (tab: CmhTasksSubTab) => void;
  searchQuery?: string;
  onOpenPublicCmhPreview?: (param: string) => void;
  onNavigateToFormBuilder?: () => void;
}

const PRIORITY_STYLES: Record<
  CmhTaskItem['priority'],
  { bg: string; text: string; border: string }
> = {
  Low: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' },
  Medium: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  High: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  Critical: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
};

export const CmhTasksView: React.FC<CmhTasksViewProps> = ({
  initialItemId,
  onInitialItemOpened,
  activeSubTab = 'all_tasks',
  onSubTabChange,
  searchQuery = '',
  onOpenPublicCmhPreview,
  onNavigateToFormBuilder,
}) => {
  const [subTab, setSubTab] = useState<CmhTasksSubTab>(activeSubTab);
  const [tasks, setTasks] = useState<CmhTaskItem[]>([]);
  const [forms, setForms] = useState<CmhFormTemplate[]>([]);
  const [members, setMembers] = useState<WorkspaceMemberItem[]>([]);
  const [teamGroups, setTeamGroups] = useState<WorkspaceTeamGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [localSearch, setLocalSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modals
  const [inviteModalTask, setInviteModalTask] = useState<CmhTaskItem | null>(null);
  const [inspectingTask, setInspectingTask] = useState<CmhTaskItem | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<CmhSubmission | null>(null);

  // Create / Edit Task State
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [selectedFormId, setSelectedFormId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<CmhTaskItem['status']>('In Progress');
  const [priority, setPriority] = useState<CmhTaskItem['priority']>('High');
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date(Date.now() + 5 * 86400000);
    return d.toISOString().slice(0, 10);
  });
  const [accessMode, setAccessMode] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
  const [assignedMemberIds, setAssignedMemberIds] = useState<string[]>([]);
  const [assignedTeamIds, setAssignedTeamIds] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});
  const [isFieldsEditorOpen, setIsFieldsEditorOpen] = useState(false);


  useEffect(() => {
    if (!initialItemId) return;
    const item = tasks.find((entry) => entry.id === initialItemId);
    if (!item) return;
    setInspectingTask(item);
    setSelectedSubmission(item.submissions?.[0] || null);
    onInitialItemOpened?.();
  }, [initialItemId, tasks, onInitialItemOpened]);
  useEffect(() => {
    setSubTab(activeSubTab);
  }, [activeSubTab]);

  const switchTab = (tab: CmhTasksSubTab) => {
    setSubTab(tab);
    onSubTabChange?.(tab);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchCmhWorkspaceBootstrap();
      setTasks(data.tasks);
      setForms(data.forms);
      setMembers(data.members);
      setTeamGroups(data.teamGroups);
      const defaultTaskForm =
        data.forms.find((f) => f.formCategory === 'TASK') || data.forms[0];
      if (defaultTaskForm && !selectedFormId) {
        setSelectedFormId(defaultTaskForm.id);
      }
    } catch {
      // ignore error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showToast = (type: 'success' | 'error', message: string) => {
    setStatusBanner({ type, message });
    setTimeout(() => {
      setStatusBanner((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  };

  const selectedFormTemplate = useMemo(
    () => forms.find((f) => f.id === selectedFormId) || forms[0] || null,
    [forms, selectedFormId]
  );

  const filteredMembers = useMemo(
    () => searchMembersInstant(memberSearch, members),
    [memberSearch, members]
  );

  const resetForm = () => {
    setEditingTaskId(null);
    setTitle('');
    setDescription('');
    setStatus('To Do');
    setPriority('High');
    setAccessMode('PUBLIC');
    setAssignedMemberIds([]);
    setAssignedTeamIds([]);
    setCustomFieldValues({});
    const defaultTaskForm = forms.find((f) => f.formCategory === 'TASK') || forms[0];
    if (defaultTaskForm) setSelectedFormId(defaultTaskForm.id);
  };

  const handleEditTask = (task: CmhTaskItem) => {
    setEditingTaskId(task.id);
    setSelectedFormId(task.formTemplateId);
    setTitle(task.title);
    setDescription(task.description);
    setStatus(task.status);
    setPriority(task.priority);
    setDueDate(task.dueDate || '');
    setAccessMode(task.accessMode);
    setAssignedMemberIds(task.assignedMemberIds || []);
    setAssignedTeamIds(task.assignedTeamIds || []);
    setCustomFieldValues(task.customFieldValues || {});
    switchTab('create_task');
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast('error', 'Please enter a task title.');
      return;
    }

    // Store human-readable field labels in customFieldValues as well
    const formattedValues: Record<string, any> = {
      ...customFieldValues,
      _targetSubmissions: Math.max(1, Number(customFieldValues._targetSubmissions) || 40),
    };
    if (selectedFormTemplate) {
      for (const field of selectedFormTemplate.fields) {
        if (customFieldValues[field.id] !== undefined) {
          formattedValues[field.label] = customFieldValues[field.id];
        }
      }
    }

    setSaving(true);
    try {
      const res = await saveCmhTask({
        id: editingTaskId || undefined,
        title: title.trim(),
        description: description.trim(),
        formTemplateId: selectedFormTemplate?.id || '',
        formTemplateTitle: selectedFormTemplate?.title || 'Standard Task Form',
        status,
        priority,
        dueDate,
        accessMode,
        assignedMemberIds,
        assignedTeamIds,
        customFieldValues: formattedValues,
      });
      setTasks(res.tasks);
      showToast(
        'success',
        `Task "${res.task.title}" saved! Real-time notification & Admin Inbox email delivered.`
      );
      resetForm();
      switchTab('all_tasks');
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to save task.');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickStatusChange = async (
    task: CmhTaskItem,
    nextStatus: CmhTaskItem['status']
  ) => {
    try {
      const res = await saveCmhTask({
        ...task,
        status: nextStatus,
      });
      setTasks(res.tasks);
      showToast('success', `Task "${task.title}" updated to ${nextStatus}.`);
    } catch {
      showToast('error', 'Failed to update task status.');
    }
  };

  const handleQuickAccessToggle = async (task: CmhTaskItem) => {
    const nextMode = task.accessMode === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC';
    try {
      const res = await saveCmhTask({
        ...task,
        accessMode: nextMode,
      });
      setTasks(res.tasks);
      showToast(
        'success',
        `Task link set to ${
          nextMode === 'PUBLIC' ? 'Public (Anyone with link)' : 'Private (Invited Members only)'
        }.`
      );
    } catch {
      showToast('error', 'Failed to toggle task link access.');
    }
  };

  const handleDeleteTask = async (task: CmhTaskItem) => {
    try {
      const next = await deleteCmhTask(task.id);
      setTasks(next);
      showToast('success', `Task "${task.title}" deleted.`);
    } catch {
      showToast('error', 'Failed to delete task.');
    }
  };

  const handleCopyLink = (taskId: string) => {
    const url = `${window.location.origin}/?cmh=task:${encodeURIComponent(taskId)}`;
    navigator.clipboard.writeText(url);
    setCopiedId(taskId);
    setTimeout(() => setCopiedId(null), 2000);
    showToast('success', 'Individual task share link copied to clipboard.');
  };

  const filteredTasks = useMemo(() => {
    const q = (searchQuery || localSearch).trim().toLowerCase();
    return tasks.filter((t) => {
      if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.formTemplateTitle.toLowerCase().includes(q)
      );
    });
  }, [tasks, statusFilter, searchQuery, localSearch]);

  return (
    <div className="h-full flex flex-col bg-[#F8FAFC] overflow-hidden">
      {/* Top Sub-Navigation Header */}
      <div className="px-6 py-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => switchTab('all_tasks')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              subTab === 'all_tasks'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            All Tasks ({tasks.length})
          </button>
          <button
            type="button"
            onClick={() => {
              resetForm();
              switchTab('create_task');
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              subTab === 'create_task'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            Add New Task
          </button>
        </div>
      </div>

      {/* Status Toast */}
      {statusBanner && (
        <div
          className={`px-6 py-2.5 text-xs font-semibold flex items-center justify-between border-b ${
            statusBanner.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {statusBanner.message}
          </span>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* TAB 1: ALL TASKS */}
      {subTab === 'all_tasks' && (
        <div className="flex-1 overflow-y-auto p-3 sm:p-6">
          <div className="max-w-7xl mx-auto space-y-3.5 sm:space-y-4 ws-animate-in">
            {/* 4-Card KPI Summary Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
              {[
                {
                  label: 'Total Tasks',
                  count: tasks.length,
                  accent: 'text-slate-900',
                  sub: 'Assigned backlog',
                },
                {
                  label: 'In Progress',
                  count: tasks.filter((t) => t.status === 'In Progress').length,
                  accent: 'text-blue-600',
                  sub: 'Active execution',
                },
                {
                  label: 'To Do / Review',
                  count: tasks.filter((t) => t.status === 'To Do' || t.status === 'Review').length,
                  accent: 'text-amber-600',
                  sub: 'Pending & QA',
                },
                {
                  label: 'Completed',
                  count: tasks.filter((t) => t.status === 'Completed').length,
                  accent: 'text-emerald-600',
                  sub: 'Delivered tasks',
                },
              ].map((kpi) => (
                <div
                  key={kpi.label}
                  className="bg-white rounded-2xl border border-slate-200/90 p-3.5 shadow-2xs flex flex-col justify-between"
                >
                  <span className="text-[11px] font-bold text-slate-500">{kpi.label}</span>
                  <div className="flex items-baseline justify-between mt-1.5">
                    <span className={`text-xl sm:text-2xl font-extrabold tabular-nums ${kpi.accent}`}>
                      {kpi.count}
                    </span>
                    <span className="text-[10px] text-slate-400 hidden sm:inline">{kpi.sub}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Filter & Search Bar */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs">
              <div className="flex items-center justify-between sm:justify-start gap-2">
                <span className="text-xs font-bold text-slate-600 shrink-0">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="flex-1 sm:flex-none px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:border-blue-600 shadow-2xs"
                >
                  <option value="ALL">All Tasks ({tasks.length})</option>
                  <option value="To Do">To Do ({tasks.filter((t) => t.status === 'To Do').length})</option>
                  <option value="In Progress">In Progress ({tasks.filter((t) => t.status === 'In Progress').length})</option>
                  <option value="Review">Review ({tasks.filter((t) => t.status === 'Review').length})</option>
                  <option value="Completed">Completed ({tasks.filter((t) => t.status === 'Completed').length})</option>
                </select>
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  placeholder="Filter tasks by title or form..."
                  className="w-full !pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            {/* Responsive Tasks List (Cards on Mobile, 12-Col Table on Desktop) */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
              <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-3 bg-slate-50/80 border-b border-slate-200 text-xs font-bold text-slate-600">
                <div className="col-span-4">Task Title & Connected Form</div>
                <div className="col-span-2">Status & Progress</div>
                <div className="col-span-2">Link Access & Due Date</div>
                <div className="col-span-1 text-center">Responses</div>
                <div className="col-span-3 text-right">Share Link · Invite · Actions</div>
              </div>

              {loading ? (
                <div className="py-14 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  Loading CMH Tasks...
                </div>
              ) : filteredTasks.length === 0 ? (
                <div className="py-14 px-4 text-center max-w-md mx-auto space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 text-blue-600 flex items-center justify-center mx-auto shadow-2xs">
                    <CheckSquare className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-base font-extrabold text-slate-900">
                      No tasks in your workspace yet
                    </p>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Create your first task with due dates, priority levels, team assignments, and an automatic shareable submission portal link.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        resetForm();
                        switchTab('create_task');
                      }}
                      className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Create First Task</span>
                    </button>
                    {onNavigateToFormBuilder && (
                      <button
                        type="button"
                        onClick={onNavigateToFormBuilder}
                        className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5"
                      >
                        <Blocks className="w-3.5 h-3.5 text-blue-600" />
                        <span>Open Form Builder</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredTasks.map((task) => {
                    const pStyle = PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.Medium;
                    const submissionsCount = task.submissions?.length || 0;
                    const assignedCount =
                      (task.assignedMemberIds?.length || 0) + (task.assignedTeamIds?.length || 0);
                    const progressPct =
                      task.status === 'Completed'
                        ? 100
                        : task.status === 'Review'
                        ? 80
                        : task.status === 'In Progress'
                        ? 55
                        : 20;

                    return (
                      <div
                        key={task.id}
                        className="flex flex-col md:grid md:grid-cols-12 gap-2.5 md:gap-3 px-4 py-3.5 md:py-3 md:items-center hover:bg-slate-50/80 transition-colors"
                      >
                        <div className="md:col-span-4 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-slate-900 truncate">
                              {task.title}
                            </p>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border shrink-0 ${pStyle.bg} ${pStyle.text} ${pStyle.border}`}
                            >
                              {task.priority}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                            <span className="inline-flex items-center gap-1 text-blue-700 font-medium truncate">
                              <Blocks className="w-3 h-3 shrink-0" />
                              {task.formTemplateTitle}
                            </span>
                            {assignedCount > 0 && (
                              <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-semibold shrink-0">
                                {assignedCount} assigned
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="md:col-span-2 flex flex-col gap-1.5">
                          <div className="flex items-center justify-between md:justify-start gap-2">
                            <select
                              value={task.status}
                              onChange={(e) =>
                                handleQuickStatusChange(
                                  task,
                                  e.target.value as CmhTaskItem['status']
                                )
                              }
                              className={`w-fit px-2.5 py-1 rounded-lg text-xs font-bold border focus:outline-none ${
                                task.status === 'Completed'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : task.status === 'In Progress'
                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                  : task.status === 'Review'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              <option value="To Do">To Do</option>
                              <option value="In Progress">In Progress</option>
                              <option value="Review">Review</option>
                              <option value="Completed">Completed</option>
                            </select>
                            <span className="text-[11px] font-bold text-slate-500 tabular-nums">
                              {progressPct}%
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                task.status === 'Completed'
                                  ? 'bg-emerald-500'
                                  : task.status === 'Review'
                                  ? 'bg-amber-500'
                                  : 'bg-blue-600'
                              }`}
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        </div>

                        <div className="md:col-span-2 flex flex-wrap md:flex-col items-center md:items-start gap-2 md:gap-1">
                          <button
                            type="button"
                            onClick={() => handleQuickAccessToggle(task)}
                            className={`inline-flex items-center gap-1 w-fit px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                              task.accessMode === 'PUBLIC'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {task.accessMode === 'PUBLIC' ? (
                              <>
                                <Globe className="w-3 h-3" /> Public Link
                              </>
                            ) : (
                              <>
                                <Lock className="w-3 h-3" /> Private Only
                              </>
                            )}
                          </button>
                          {task.dueDate && (
                            <span className="text-[11px] text-slate-500 flex items-center gap-1">
                              <Calendar className="w-3 h-3" /> Due {task.dueDate}
                            </span>
                          )}
                        </div>

                        <div className="md:col-span-1 md:text-center flex items-center justify-between md:justify-center">
                          <span className="text-[11px] font-semibold text-slate-500 md:hidden">
                            Responses:
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setInspectingTask(task);
                              setSelectedSubmission(task.submissions?.[0] || null);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-800 text-xs font-bold"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            {submissionsCount}
                          </button>
                        </div>

                        <div className="md:col-span-3 flex flex-wrap items-center justify-end gap-1.5 pt-1 md:pt-0 border-t border-slate-100 md:border-t-0">
                          <button
                            type="button"
                            onClick={() => handleCopyLink(task.id)}
                            title="Copy Individual Task Share Link"
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1"
                          >
                            {copiedId === task.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                Link
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => setInviteModalTask(task)}
                            title="Invite Members or Team Groups & Send Task Link via Email"
                            className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold flex items-center gap-1"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            Invite
                          </button>

                          <button
                            type="button"
                            onClick={() => onOpenPublicCmhPreview?.(`task:${task.id}`)}
                            title="Open Live Task Submission Portal"
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleEditTask(task)}
                            title="Edit Task"
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteTask(task)}
                            title="Delete Task"
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 hover:text-rose-600 text-slate-500"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ADD NEW TASK (HIGH-CRAFT MOBILE-FIRST STUDIO FORM) */}
      {subTab === 'create_task' && (
        <div className="flex-1 overflow-y-auto p-3 sm:p-6">
          <form onSubmit={handleSaveTask} className="max-w-4xl mx-auto space-y-4 pb-8">
            {/* Card 1: Core Task Identity & Schedule */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-6 shadow-2xs space-y-5">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-2xs shrink-0">
                    1
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                      {editingTaskId ? 'Edit Task Details' : 'Create New Task'}
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      Set title, due date, status, priority, and shareable link privacy
                    </p>
                  </div>
                </div>
              </div>

              {/* Title, Target Submissions & Due Date */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-6 space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800">
                    Task Title <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <CheckSquare className="w-4 h-4 text-blue-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g., Deploy Production SMTP Queue & Real-Time Webhook"
                      className="w-full !pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900"
                    />
                  </div>
                </div>

                <div className="md:col-span-3 space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800">
                    Target People
                  </label>
                  <div className="relative">
                    <Users className="w-4 h-4 text-rose-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="number"
                      min={1}
                      max={10000}
                      value={customFieldValues._targetSubmissions ?? 40}
                      onChange={(e) =>
                        setCustomFieldValues((prev) => ({
                          ...prev,
                          _targetSubmissions: Math.max(1, Number(e.target.value) || 1),
                        }))
                      }
                      placeholder="40"
                      className="w-full !pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-900"
                    />
                  </div>
                </div>

                <div className="md:col-span-3 space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800">
                    Due Date
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full !pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* Instructions */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  Task Instructions & Acceptance Criteria
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Write clear step-by-step instructions or deliverables for team members..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-800"
                />
              </div>

              {/* Interactive Status & Priority Pills */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Task Status
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(['To Do', 'In Progress', 'Review', 'Completed'] as const).map((st) => {
                      const active = status === st;
                      return (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setStatus(st)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                            active
                              ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {active && <Check className="w-3.5 h-3.5 shrink-0" />}
                          <span>{st}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Priority Level
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(['Low', 'Medium', 'High', 'Critical'] as const).map((pr) => {
                      const active = priority === pr;
                      return (
                        <button
                          key={pr}
                          type="button"
                          onClick={() => setPriority(pr)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                            active
                              ? pr === 'Critical'
                                ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                                : pr === 'High'
                                ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                                : 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {active && <Check className="w-3.5 h-3.5 shrink-0" />}
                          <span>{pr}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Shareable Link Access Mode Cards */}
              <div className="space-y-2 pt-1">
                <label className="block text-xs font-bold text-slate-800">
                  Shareable Link Access Mode
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setAccessMode('PUBLIC')}
                    className={`p-3.5 rounded-2xl border text-left transition-all flex items-start gap-3 ${
                      accessMode === 'PUBLIC'
                        ? 'bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-500/15'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                        accessMode === 'PUBLIC'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      <Globe className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">
                        Public Share Link
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Anyone with the task link can view & submit updates
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAccessMode('PRIVATE')}
                    className={`p-3.5 rounded-2xl border text-left transition-all flex items-start gap-3 ${
                      accessMode === 'PRIVATE'
                        ? 'bg-amber-50/70 border-amber-500 ring-2 ring-amber-500/15'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                        accessMode === 'PRIVATE'
                          ? 'bg-amber-600 text-white'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      <Lock className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">
                        Private (Invited Members Only)
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Only assigned team members can submit responses
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </div>

            {/* Card 2: Assign Team Groups & Individual Members */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-6 shadow-2xs space-y-4">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <div className="w-7 h-7 rounded-xl bg-blue-50 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0">
                  2
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Assign Team Groups or Members
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Select who is responsible for completing this task
                  </p>
                </div>
              </div>

              {teamGroups.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {teamGroups.map((group) => {
                    const selected = assignedTeamIds.includes(group.id);
                    return (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() =>
                          setAssignedTeamIds((prev) =>
                            prev.includes(group.id)
                              ? prev.filter((id) => id !== group.id)
                              : [...prev, group.id]
                          )
                        }
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                          selected
                            ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <Users className="w-3.5 h-3.5" />
                        {group.name}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder="Search team members by name or email..."
                    className="w-full !pl-10 pr-3.5 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                </div>
                {filteredMembers.length === 0 ? (
                  <p className="text-xs text-slate-400 py-1">
                    No team members added yet. You can add members from the Team Profile tab.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pt-1">
                    {filteredMembers.map((m) => {
                      const selected = assignedMemberIds.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() =>
                            setAssignedMemberIds((prev) =>
                              prev.includes(m.id)
                                ? prev.filter((id) => id !== m.id)
                                : [...prev, m.id]
                            )
                          }
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                            selected
                              ? 'bg-blue-50 text-blue-700 border-blue-400 ring-2 ring-blue-500/10'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {selected && <Check className="w-3 h-3 text-blue-600" />}
                          <span>{m.fullName}</span>
                          <span className="text-[10px] text-slate-400">({m.email})</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Card 3: Connected Form Template & Custom Fields */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-6 shadow-2xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-xl bg-blue-50 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0">
                    3
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Connected Submission Form & Custom Fields
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Choose or customize extra fields for task submissions
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {selectedFormTemplate && (
                    <button
                      type="button"
                      onClick={() => setIsFieldsEditorOpen(true)}
                      className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold flex items-center gap-1.5"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Customize Fields
                    </button>
                  )}
                  {onNavigateToFormBuilder && (
                    <button
                      type="button"
                      onClick={onNavigateToFormBuilder}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5"
                    >
                      <Blocks className="w-3.5 h-3.5 text-blue-600" />
                      Form Builder
                    </button>
                  )}
                </div>
              </div>

              {forms.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {forms.map((form) => {
                    const active = selectedFormTemplate?.id === form.id;
                    return (
                      <button
                        key={form.id}
                        type="button"
                        onClick={() => setSelectedFormId(form.id)}
                        className={`p-3.5 rounded-2xl border text-left transition-all ${
                          active
                            ? 'bg-blue-50/70 border-blue-600 ring-2 ring-blue-500/15'
                            : 'bg-slate-50/60 border-slate-200 hover:bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 text-[10px] font-bold">
                            {form.formCategory}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-500">
                            {form.fields?.length || 0} fields
                          </span>
                        </div>
                        <p className="text-xs font-bold text-slate-900 mt-2 truncate">
                          {form.title}
                        </p>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-slate-50 border border-dashed border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-slate-700">
                      Using Default Task Submission Portal
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Want custom input fields on this task? Create a template in Form Builder anytime.
                    </p>
                  </div>
                </div>
              )}

              {selectedFormTemplate && (
                <div className="pt-2">
                  <CmhDynamicFieldsRenderer
                    fields={selectedFormTemplate.fields || []}
                    values={customFieldValues}
                    onChange={(fieldId, val) =>
                      setCustomFieldValues((prev) => ({ ...prev, [fieldId]: val }))
                    }
                  />
                </div>
              )}
            </div>

            {/* Sticky Bottom Action Bar */}
            <div className="sticky bottom-2 z-20 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/90 p-3.5 shadow-lg flex items-center justify-between sm:justify-end gap-3">
              <button
                type="button"
                onClick={() => switchTab('all_tasks')}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 sm:flex-none justify-center px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-md shadow-blue-500/20"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving Task...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    {editingTaskId ? 'Update Task' : 'Publish & Generate Task Link'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TASK SUBMISSIONS & SPECIFICATIONS INSPECTOR MODAL */}
      {inspectingTask && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">
                  Task Details & Member Submissions ({inspectingTask.submissions?.length || 0})
                </span>
                <h3 className="text-base font-bold">{inspectingTask.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectingTask(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 bg-slate-50 border-b border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-2.5">
              {Object.entries(inspectingTask.customFieldValues || {}).map(([k, v]) => (
                <div key={k} className="bg-white p-2.5 rounded-lg border border-slate-200">
                  <p className="text-[10px] font-bold uppercase text-slate-400 truncate">{k}</p>
                  <p className="text-xs font-semibold text-slate-800 truncate">{String(v)}</p>
                </div>
              ))}
            </div>

            {!inspectingTask.submissions || inspectingTask.submissions.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                No external or member submissions recorded on this task link yet.
              </div>
            ) : (
              <div className="flex-1 grid grid-cols-12 overflow-hidden">
                <div className="col-span-5 border-r border-slate-200 overflow-y-auto divide-y divide-slate-100">
                  {inspectingTask.submissions.map((sub) => (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => setSelectedSubmission(sub)}
                      className={`w-full px-4 py-3 text-left ${
                        selectedSubmission?.id === sub.id
                          ? 'bg-blue-50/80 border-l-4 border-l-blue-600'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <p className="text-xs font-bold text-slate-900">{sub.submitterName}</p>
                      <p className="text-[11px] text-blue-600">{sub.submitterEmail}</p>
                      <p className="text-[10px] text-slate-400">{sub.submittedAt}</p>
                    </button>
                  ))}
                </div>
                <div className="col-span-7 p-5 overflow-y-auto space-y-2.5">
                  {selectedSubmission &&
                    Object.entries(selectedSubmission.values || {}).map(([label, val]) => (
                      <div key={label} className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <p className="text-[10px] font-bold uppercase text-slate-400">{label}</p>
                        <p className="text-xs font-semibold text-slate-900 mt-0.5">
                          {Array.isArray(val) ? val.join(', ') : String(val ?? '—')}
                        </p>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* INVITE MEMBERS / TEAMS MODAL */}
      {inviteModalTask && (
        <CmhMemberInviteModal
          isOpen={Boolean(inviteModalTask)}
          onClose={() => setInviteModalTask(null)}
          targetType="task"
          targetId={inviteModalTask.id}
          targetTitle={inviteModalTask.title}
          initialMemberIds={inviteModalTask.assignedMemberIds || []}
          initialTeamIds={inviteModalTask.assignedTeamIds || []}
          members={members}
          teamGroups={teamGroups}
          onSuccess={(res) => {
            setTasks(res.tasks);
            showToast(
              'success',
              `Task link emailed to ${res.invitedCount} member(s) & logged to Admin Inbox.`
            );
          }}
        />
      )}

      {/* FORM FIELDS EDITOR MODAL */}
      {isFieldsEditorOpen && selectedFormTemplate && (
        <CmhFormFieldsEditorModal
          isOpen={isFieldsEditorOpen}
          onClose={() => setIsFieldsEditorOpen(false)}
          template={selectedFormTemplate}
          onSave={(updated) => {
            setForms((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
            showToast('success', `Form fields for "${updated.title}" updated and synced.`);
          }}
        />
      )}
    </div>
  );
};
