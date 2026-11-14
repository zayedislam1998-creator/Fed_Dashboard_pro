import React, { useState, useEffect, useMemo } from 'react';
import { useSubmissionRequest } from '../services/useSubmissionRequest';
import { motion } from 'motion/react';
import {
  CheckSquare,
  Briefcase,
  Blocks,
  PieChart as PieChartIcon,
  TrendingUp,
  Eye,
  Plus,
  X,
  CheckCircle2,
  Clock,
  ExternalLink,
  UserCheck,
  AlertCircle,
  FileText,
  Sparkles,
  Check,
  RefreshCw,
} from 'lucide-react';
import { subscribeWorkspaceEvents } from '../services/realtimeBus';
import {
  fetchCmhWorkspaceBootstrap,
  saveCmhTask,
  saveCmhProject,
  submitPublicCmhResponse,
  CmhTaskItem,
  CmhProjectItem,
  CmhFormTemplate,
  CmhSubmission,
  WorkspaceMemberItem,
} from '../services/workspaceApi';

interface OverviewDashboardViewProps {
  workspaceTitle?: string;
  gmailCount?: number;
  serverMailCount?: number;
  onNavigateModule: (module: any, subTab?: string) => void;
  onOpenQuickCreate?: () => void;
}

type TrackerCategory = 'ALL' | 'TASK' | 'PROJECT' | 'FORM';

interface UnifiedTrackableItem {
  id: string;
  type: 'TASK' | 'PROJECT' | 'FORM';
  title: string;
  subtitle: string;
  status: string;
  priority?: string;
  dateLabel?: string;
  targetCount: number;
  submittedCount: number;
  remainingCount: number;
  completionPct: number;
  submissions: CmhSubmission[];
  assignedMemberIds: string[];
  rawItem: CmhTaskItem | CmhProjectItem | CmhFormTemplate;
}

/**
 * Renders a multi-segment SVG Donut/Pie Chart
 */
const MultiSegmentDonutChart: React.FC<{
  size?: number;
  strokeWidth?: number;
  segments: Array<{ value: number; color: string; label: string }>;
  centerTitle: string;
  centerSub: string;
}> = ({ size = 148, strokeWidth = 18, segments, centerTitle, centerSub }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((acc, s) => acc + Math.max(0, s.value), 0);

  let cumulativeFraction = 0;

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90 transform">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-slate-100 dark:text-slate-800"
        />
        {total > 0 &&
          segments.map((seg, idx) => {
            if (seg.value <= 0) return null;
            const fraction = seg.value / total;
            const dashArray = `${fraction * circumference} ${circumference}`;
            const dashOffset = -cumulativeFraction * circumference;
            cumulativeFraction += fraction;
            return (
              <circle
                key={idx}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke={seg.color}
                strokeWidth={strokeWidth}
                strokeDasharray={dashArray}
                strokeDashoffset={dashOffset}
                strokeLinecap="butt"
                className="transition-all duration-500"
              />
            );
          })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2">
        <span className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tabular-nums leading-none">
          {centerTitle}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-1">
          {centerSub}
        </span>
      </div>
    </div>
  );
};

export const OverviewDashboardView: React.FC<OverviewDashboardViewProps> = ({
  onNavigateModule,
}) => {
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<CmhTaskItem[]>([]);
  const [projects, setProjects] = useState<CmhProjectItem[]>([]);
  const [cmhForms, setCmhForms] = useState<CmhFormTemplate[]>([]);
  const [members, setMembers] = useState<WorkspaceMemberItem[]>([]);

  const [categoryFilter, setCategoryFilter] = useState<TrackerCategory>('ALL');

  // On-demand Modals & Light-weight View state
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [showAllTracker, setShowAllTracker] = useState(false);

  // Drill-down Inspector Modal State
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<CmhSubmission | null>(null);
  const [inspectorTab, setInspectorTab] = useState<'SUBMITTED' | 'REMAINING' | 'QUICK_SUBMIT'>(
    'SUBMITTED'
  );

  // Target Count Editor inside Modal
  const [editingTargetValue, setEditingTargetValue] = useState<number>(40);
  const [savingTarget, setSavingTarget] = useState(false);

  // Quick Submit inside Modal
  const [quickSubmitName, setQuickSubmitName] = useState('');
  const [quickSubmitEmail, setQuickSubmitEmail] = useState('');
  const [quickSubmitNote, setQuickSubmitNote] = useState('');
  const [quickSubmitDeliverable, setQuickSubmitDeliverable] = useState('');
  const submissionRequest = useSubmissionRequest();
  const [submittingEntry, setSubmittingEntry] = useState(false);

  const loadOverviewData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const cmhData = await fetchCmhWorkspaceBootstrap(true);
      setTasks(cmhData.tasks || []);
      setProjects(cmhData.projects || []);
      setCmhForms(cmhData.forms || []);
      setMembers(cmhData.members || []);
    } catch {
      // ignore error
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    // Single initial fetch only — NO aggressive background auto-sync polling
    loadOverviewData(false);
  }, []);

  // Build Unified Trackable Items (Tasks, Projects, Forms) with Target & Submitted circles
  const allTrackableItems = useMemo<UnifiedTrackableItem[]>(() => {
    const taskItems: UnifiedTrackableItem[] = tasks.map((t) => {
      const submittedCount = Array.isArray(t.submissions) ? t.submissions.length : 0;
      const savedTarget = Number(t.customFieldValues?._targetSubmissions);
      const assignedCount = Array.isArray(t.assignedMemberIds) ? t.assignedMemberIds.length : 0;
      const targetCount =
        savedTarget > 0
          ? savedTarget
          : assignedCount > 0 || submittedCount > 0
          ? Math.max(assignedCount, submittedCount, 1)
          : 0;
      const remainingCount = Math.max(0, targetCount - submittedCount);
      const completionPct = Math.min(
        100,
        Math.round((submittedCount / Math.max(1, targetCount)) * 100)
      );

      return {
        id: t.id,
        type: 'TASK',
        title: t.title,
        subtitle: t.formTemplateTitle || 'Task Submission Portal',
        status: t.status,
        priority: t.priority,
        dateLabel: t.dueDate ? `Due: ${t.dueDate}` : undefined,
        targetCount,
        submittedCount,
        remainingCount,
        completionPct,
        submissions: t.submissions || [],
        assignedMemberIds: t.assignedMemberIds || [],
        rawItem: t,
      };
    });

    const projectItems: UnifiedTrackableItem[] = projects.map((p) => {
      const submittedCount = Array.isArray(p.submissions) ? p.submissions.length : 0;
      const savedTarget = Number(p.customFieldValues?._targetSubmissions);
      const assignedCount = Array.isArray(p.assignedMemberIds) ? p.assignedMemberIds.length : 0;
      const targetCount =
        savedTarget > 0
          ? savedTarget
          : assignedCount > 0 || submittedCount > 0
          ? Math.max(assignedCount, submittedCount, 1)
          : 0;
      const remainingCount = Math.max(0, targetCount - submittedCount);
      const completionPct = Math.min(
        100,
        Math.round((submittedCount / Math.max(1, targetCount)) * 100)
      );

      return {
        id: p.id,
        type: 'PROJECT',
        title: p.title,
        subtitle: p.budget ? `Budget: ${p.budget}` : p.formTemplateTitle || 'Project Portal',
        status: p.status,
        priority: p.priority,
        dateLabel: p.deadline ? `Deadline: ${p.deadline}` : undefined,
        targetCount,
        submittedCount,
        remainingCount,
        completionPct,
        submissions: p.submissions || [],
        assignedMemberIds: p.assignedMemberIds || [],
        rawItem: p,
      };
    });

    const formItems: UnifiedTrackableItem[] = cmhForms.map((f) => {
      const submittedCount = Array.isArray(f.submissions) ? f.submissions.length : 0;
      const targetCount = Math.max(submittedCount, 1);
      const remainingCount = Math.max(0, targetCount - submittedCount);
      const completionPct = Math.min(
        100,
        Math.round((submittedCount / Math.max(1, targetCount)) * 100)
      );

      return {
        id: f.id,
        type: 'FORM',
        title: f.title,
        subtitle: `${f.fields?.length || 0} Custom Fields · ${f.formCategory}`,
        status: f.accessMode === 'PUBLIC' ? 'Public' : 'Private',
        dateLabel: f.updatedAt,
        targetCount,
        submittedCount,
        remainingCount,
        completionPct,
        submissions: f.submissions || [],
        assignedMemberIds: f.invitedMemberIds || [],
        rawItem: f,
      };
    });

    return [...taskItems, ...projectItems, ...formItems];
  }, [tasks, projects, cmhForms]);

  const filteredItems = useMemo(() => {
    if (categoryFilter === 'ALL') return allTrackableItems;
    return allTrackableItems.filter((item) => item.type === categoryFilter);
  }, [allTrackableItems, categoryFilter]);

  const selectedItem = useMemo(
    () => allTrackableItems.find((item) => item.id === selectedItemId) || null,
    [allTrackableItems, selectedItemId]
  );

  // Aggregate totals for Top 4 Cards & Multi-Pie Charts
  const taskStats = useMemo(() => {
    const items = allTrackableItems.filter((i) => i.type === 'TASK');
    const totalTarget = items.reduce((s, i) => s + i.targetCount, 0);
    const totalSubmitted = items.reduce((s, i) => s + i.submittedCount, 0);
    const pct = totalTarget > 0 ? Math.min(100, Math.round((totalSubmitted / totalTarget) * 100)) : 0;
    return {
      count: tasks.length,
      totalTarget,
      totalSubmitted,
      remaining: Math.max(0, totalTarget - totalSubmitted),
      pct,
    };
  }, [allTrackableItems, tasks.length]);

  const projectStats = useMemo(() => {
    const items = allTrackableItems.filter((i) => i.type === 'PROJECT');
    const totalTarget = items.reduce((s, i) => s + i.targetCount, 0);
    const totalSubmitted = items.reduce((s, i) => s + i.submittedCount, 0);
    const pct = totalTarget > 0 ? Math.min(100, Math.round((totalSubmitted / totalTarget) * 100)) : 0;
    return {
      count: projects.length,
      totalTarget,
      totalSubmitted,
      remaining: Math.max(0, totalTarget - totalSubmitted),
      pct,
    };
  }, [allTrackableItems, projects.length]);

  const formStats = useMemo(() => {
    const items = allTrackableItems.filter((i) => i.type === 'FORM');
    const totalTarget = items.reduce((s, i) => s + i.targetCount, 0);
    const totalSubmitted = items.reduce((s, i) => s + i.submittedCount, 0);
    const pct = totalTarget > 0 ? Math.min(100, Math.round((totalSubmitted / totalTarget) * 100)) : 0;
    return {
      count: cmhForms.length,
      totalTarget,
      totalSubmitted,
      remaining: Math.max(0, totalTarget - totalSubmitted),
      pct,
    };
  }, [allTrackableItems, cmhForms.length]);

  const overallSubmissionTotal =
    taskStats.totalSubmitted + projectStats.totalSubmitted + formStats.totalSubmitted;
  const overallTargetTotal =
    taskStats.totalTarget + projectStats.totalTarget + formStats.totalTarget;
  const overallRemainingTotal = Math.max(0, overallTargetTotal - overallSubmissionTotal);
  const overallGrowthPct = Math.min(
    100,
    Math.round((overallSubmissionTotal / Math.max(1, overallTargetTotal)) * 100)
  );

  // Status Distribution for Pie Chart 2
  const statusPieSegments = useMemo(() => {
    const completed =
      tasks.filter((t) => t.status === 'Completed').length +
      projects.filter((p) => p.status === 'Completed').length;
    const active =
      tasks.filter((t) => t.status === 'In Progress').length +
      projects.filter((p) => p.status === 'Active').length;
    const review =
      tasks.filter((t) => t.status === 'Review').length +
      projects.filter((p) => p.status === 'On Hold').length;
    const todo =
      tasks.filter((t) => t.status === 'To Do').length +
      projects.filter((p) => p.status === 'Planning').length;

    const total = completed + active + review + todo;
    if (total === 0) {
      return [
        { label: 'Active / In Progress', value: 1, color: '#2563EB' },
        { label: 'Completed', value: 0, color: '#10B981' },
        { label: 'Review / Hold', value: 0, color: '#F59E0B' },
        { label: 'To Do / Planning', value: 0, color: '#EF4444' },
      ];
    }
    return [
      { label: 'Completed', value: completed, color: '#10B981' },
      { label: 'In Progress / Active', value: active, color: '#2563EB' },
      { label: 'Review / On Hold', value: review, color: '#F59E0B' },
      { label: 'To Do / Planning', value: todo, color: '#EF4444' },
    ];
  }, [tasks, projects]);

  const handleOpenInspector = (item: UnifiedTrackableItem) => {
    setSelectedItemId(item.id);
    setEditingTargetValue(item.targetCount);
    setSelectedSubmission(item.submissions[0] || null);
    setInspectorTab('SUBMITTED');
  };

  const handleSaveTargetCount = async () => {
    if (!selectedItem) return;
    const cleanTarget = Math.max(1, Number(editingTargetValue) || 40);
    setSavingTarget(true);
    try {
      if (selectedItem.type === 'TASK') {
        const raw = selectedItem.rawItem as CmhTaskItem;
        const res = await saveCmhTask({
          ...raw,
          customFieldValues: {
            ...(raw.customFieldValues || {}),
            _targetSubmissions: cleanTarget,
          },
        });
        setTasks(res.tasks);
      } else if (selectedItem.type === 'PROJECT') {
        const raw = selectedItem.rawItem as CmhProjectItem;
        const res = await saveCmhProject({
          ...raw,
          customFieldValues: {
            ...(raw.customFieldValues || {}),
            _targetSubmissions: cleanTarget,
          },
        });
        setProjects(res.projects);
      }
    } finally {
      setSavingTarget(false);
    }
  };

  const handleQuickSubmitResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !quickSubmitName.trim()) return;
    setSubmittingEntry(true);
    try {
      const targetTypeLower =
        selectedItem.type === 'TASK'
          ? 'task'
          : selectedItem.type === 'PROJECT'
          ? 'project'
          : 'form';
      const payload = {
        submitterName: quickSubmitName.trim(),
        submitterEmail: quickSubmitEmail.trim() || 'member@workspace.local',
        values: {
          'Submitted Deliverable / Status':
            quickSubmitDeliverable.trim() || 'Completed & Verified',
          'Submission Notes':
            quickSubmitNote.trim() || 'Submitted via CEO Executive Overview',
        },
      };
      await submitPublicCmhResponse(targetTypeLower, selectedItem.id, payload, submissionRequest.getId([targetTypeLower, selectedItem.id, payload]));
      submissionRequest.clear();
      await loadOverviewData();
      setQuickSubmitName('');
      setQuickSubmitEmail('');
      setQuickSubmitDeliverable('');
      setQuickSubmitNote('');
      setInspectorTab('SUBMITTED');
    } finally {
      setSubmittingEntry(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="flex-1 overflow-y-auto bg-[#F8FAFC] dark:bg-slate-950 p-3 sm:p-5 pb-20 md:pb-8"
    >
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-5">
        {/* Minimal Executive Header Bar */}
        <div className="flex items-center justify-between gap-2 bg-white dark:bg-slate-900 rounded-2xl px-3.5 py-2.5 sm:px-5 sm:py-3.5 border border-slate-200/90 dark:border-slate-800 shadow-2xs">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-blue-600 dark:text-blue-400">
                CEO Executive · Live Analytics
              </span>
            </div>
            <h1 className="text-sm sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight truncate">
              Submission Circles, Pie Charts & Growth Overview
            </h1>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onNavigateModule('cmh_tasks', 'create_task')}
              className="px-2.5 sm:px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Task</span>
            </button>
          </div>
        </div>

        {/* =====================================================================
            SECTION 1: 2x2 MOBILE GRID (4 CARDS TOTAL ON SCREEN)
            Card 1: Tasks | Card 2: Projects | Card 3: Forms | Card 4: Team Growth
            ===================================================================== */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          {/* BOX 1: TASKS */}
          <div
            onClick={() => setCategoryFilter(categoryFilter === 'TASK' ? 'ALL' : 'TASK')}
            className={`cursor-pointer rounded-2xl p-3 sm:p-4 bg-white dark:bg-slate-900 border transition-all shadow-2xs flex flex-col justify-between ${
              categoryFilter === 'TASK'
                ? 'border-blue-600 ring-2 ring-blue-500/20'
                : 'border-slate-200/90 dark:border-slate-800 hover:border-blue-400'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <CheckSquare className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">
                    Tasks
                  </p>
                  <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                    {taskStats.count} Total Tasks
                  </p>
                </div>
              </div>

              {/* Mini Dual Circle Ring */}
              <div className="relative w-11 h-11 shrink-0 flex items-center justify-center">
                <svg className="w-11 h-11 -rotate-90" viewBox="0 0 44 44">
                  {/* Outer Red Target Circle */}
                  <circle
                    cx="22"
                    cy="22"
                    r="18"
                    fill="transparent"
                    stroke="#FEE2E2"
                    strokeWidth="4"
                  />
                  <circle
                    cx="22"
                    cy="22"
                    r="18"
                    fill="transparent"
                    stroke="#EF4444"
                    strokeWidth="4"
                    strokeDasharray="113.1"
                    strokeDashoffset="0"
                    className="opacity-35"
                  />
                  {/* Inner Blue Submitted Progress Circle */}
                  <circle
                    cx="22"
                    cy="22"
                    r="18"
                    fill="transparent"
                    stroke="#2563EB"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray="113.1"
                    strokeDashoffset={113.1 - (113.1 * taskStats.pct) / 100}
                  />
                </svg>
                <span className="absolute text-[10px] font-extrabold text-slate-900 dark:text-white tabular-nums">
                  {taskStats.pct}%
                </span>
              </div>
            </div>

            <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
              <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                Submitted: {taskStats.totalSubmitted}
              </span>
              <span className="font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                Target: {taskStats.totalTarget}
              </span>
            </div>
          </div>

          {/* BOX 2: PROJECTS */}
          <div
            onClick={() => setCategoryFilter(categoryFilter === 'PROJECT' ? 'ALL' : 'PROJECT')}
            className={`cursor-pointer rounded-2xl p-3 sm:p-4 bg-white dark:bg-slate-900 border transition-all shadow-2xs flex flex-col justify-between ${
              categoryFilter === 'PROJECT'
                ? 'border-purple-600 ring-2 ring-purple-500/20'
                : 'border-slate-200/90 dark:border-slate-800 hover:border-purple-400'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-purple-50 dark:bg-purple-950/70 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                  <Briefcase className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">
                    Projects
                  </p>
                  <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                    {projectStats.count} Total Projects
                  </p>
                </div>
              </div>

              <div className="relative w-11 h-11 shrink-0 flex items-center justify-center">
                <svg className="w-11 h-11 -rotate-90" viewBox="0 0 44 44">
                  <circle
                    cx="22"
                    cy="22"
                    r="18"
                    fill="transparent"
                    stroke="#FEE2E2"
                    strokeWidth="4"
                  />
                  <circle
                    cx="22"
                    cy="22"
                    r="18"
                    fill="transparent"
                    stroke="#EF4444"
                    strokeWidth="4"
                    strokeDasharray="113.1"
                    strokeDashoffset="0"
                    className="opacity-35"
                  />
                  <circle
                    cx="22"
                    cy="22"
                    r="18"
                    fill="transparent"
                    stroke="#9333EA"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray="113.1"
                    strokeDashoffset={113.1 - (113.1 * projectStats.pct) / 100}
                  />
                </svg>
                <span className="absolute text-[10px] font-extrabold text-slate-900 dark:text-white tabular-nums">
                  {projectStats.pct}%
                </span>
              </div>
            </div>

            <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
              <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                Submitted: {projectStats.totalSubmitted}
              </span>
              <span className="font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                Target: {projectStats.totalTarget}
              </span>
            </div>
          </div>

          {/* BOX 3: FORMS */}
          <div
            onClick={() => setCategoryFilter(categoryFilter === 'FORM' ? 'ALL' : 'FORM')}
            className={`cursor-pointer rounded-2xl p-3 sm:p-4 bg-white dark:bg-slate-900 border transition-all shadow-2xs flex flex-col justify-between ${
              categoryFilter === 'FORM'
                ? 'border-indigo-600 ring-2 ring-indigo-500/20'
                : 'border-slate-200/90 dark:border-slate-800 hover:border-indigo-400'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <Blocks className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">
                    Forms
                  </p>
                  <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                    {formStats.count} Active Forms
                  </p>
                </div>
              </div>

              <div className="relative w-11 h-11 shrink-0 flex items-center justify-center">
                <svg className="w-11 h-11 -rotate-90" viewBox="0 0 44 44">
                  <circle
                    cx="22"
                    cy="22"
                    r="18"
                    fill="transparent"
                    stroke="#FEE2E2"
                    strokeWidth="4"
                  />
                  <circle
                    cx="22"
                    cy="22"
                    r="18"
                    fill="transparent"
                    stroke="#EF4444"
                    strokeWidth="4"
                    strokeDasharray="113.1"
                    strokeDashoffset="0"
                    className="opacity-35"
                  />
                  <circle
                    cx="22"
                    cy="22"
                    r="18"
                    fill="transparent"
                    stroke="#4F46E5"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray="113.1"
                    strokeDashoffset={113.1 - (113.1 * formStats.pct) / 100}
                  />
                </svg>
                <span className="absolute text-[10px] font-extrabold text-slate-900 dark:text-white tabular-nums">
                  {formStats.pct}%
                </span>
              </div>
            </div>

            <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
              <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                Submitted: {formStats.totalSubmitted}
              </span>
              <span className="font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                Target: {formStats.totalTarget}
              </span>
            </div>
          </div>

          {/* BOX 4: TEAM & OVERALL GROWTH */}
          <div
            onClick={() => setCategoryFilter('ALL')}
            className={`cursor-pointer rounded-2xl p-3 sm:p-4 bg-white dark:bg-slate-900 border transition-all shadow-2xs flex flex-col justify-between ${
              categoryFilter === 'ALL'
                ? 'border-emerald-600 ring-2 ring-emerald-500/20'
                : 'border-slate-200/90 dark:border-slate-800 hover:border-emerald-400'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">
                    Growth Rate
                  </p>
                  <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                    {members.length} Team Members
                  </p>
                </div>
              </div>

              <div className="relative w-11 h-11 shrink-0 flex items-center justify-center">
                <svg className="w-11 h-11 -rotate-90" viewBox="0 0 44 44">
                  <circle
                    cx="22"
                    cy="22"
                    r="18"
                    fill="transparent"
                    stroke="#FEE2E2"
                    strokeWidth="4"
                  />
                  <circle
                    cx="22"
                    cy="22"
                    r="18"
                    fill="transparent"
                    stroke="#10B981"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray="113.1"
                    strokeDashoffset={113.1 - (113.1 * overallGrowthPct) / 100}
                  />
                </svg>
                <span className="absolute text-[10px] font-extrabold text-slate-900 dark:text-white tabular-nums">
                  {overallGrowthPct}%
                </span>
              </div>
            </div>

            <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
              <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                Filled: {overallSubmissionTotal}
              </span>
              <span className="font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                Pending: {overallRemainingTotal}
              </span>
            </div>
          </div>
        </div>

        {/* =====================================================================
            SECTION 2: INTERACTIVE DUAL-CIRCLE SUBMISSION TRACKER
            Red Circle = Total Target (e.g., 40 People)
            Second Circle = Submitted vs Remaining (Filled vs Pending)
            Click any card/circle -> Opens Modal showing Who Submitted & What They Submitted
            ===================================================================== */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-3.5 sm:p-5 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <PieChartIcon className="w-4 h-4 text-rose-500" />
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                  Target vs Submitted Circle Tracker
                </h2>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Red Circle = Total Target People · Green/Amber Circle = Submitted vs Remaining (Click any item to inspect submissions)
              </p>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl self-start sm:self-auto">
              {(
                [
                  { id: 'ALL', label: 'All Items' },
                  { id: 'TASK', label: 'Tasks' },
                  { id: 'PROJECT', label: 'Projects' },
                  { id: 'FORM', label: 'Forms' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCategoryFilter(tab.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                    categoryFilter === tab.id
                      ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <div className="py-10 text-center space-y-3">
              <p className="text-xs font-semibold text-slate-500">
                No items found. Create a new task or project to track submissions.
              </p>
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => onNavigateModule('cmh_tasks', 'create_task')}
                  className="px-3.5 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold"
                >
                  + Create Task
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateModule('cmh_projects', 'create_project')}
                  className="px-3.5 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold"
                >
                  + Create Project
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                {(showAllTracker ? filteredItems : filteredItems.slice(0, 4)).map((item) => {
                  const radius = 26;
                  const circumference = 2 * Math.PI * radius;
                  const strokeOffset =
                    circumference - (circumference * item.completionPct) / 100;

                return (
                  <div
                    key={item.id}
                    onClick={() => handleOpenInspector(item)}
                    className="group cursor-pointer rounded-2xl border border-slate-200/90 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-900 p-3.5 sm:p-4 transition-all shadow-2xs hover:shadow-md flex flex-col justify-between gap-3"
                  >
                    {/* Top Row: Badge + Title + Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider ${
                              item.type === 'TASK'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                                : item.type === 'PROJECT'
                                ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                                : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                            }`}
                          >
                            {item.type}
                          </span>
                          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                            {item.status}
                          </span>
                          {item.dateLabel && (
                            <span className="text-[10px] text-slate-400 dark:text-slate-500">
                              • {item.dateLabel}
                            </span>
                          )}
                        </div>
                        <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white mt-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                          {item.title}
                        </h3>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {item.subtitle}
                        </p>
                      </div>

                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 text-[11px] font-bold shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect</span>
                      </span>
                    </div>

                    {/* Middle Row: TWO DISTINCT CIRCLES (Circle 1: Red Full Target Circle | Circle 2: Submitted vs Remaining Pie Circle) */}
                    <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-200/70 dark:border-slate-800">
                      {/* CIRCLE 1: RED FULL CIRCLE (Total Target People) */}
                      <div className="flex items-center gap-2.5 p-2 rounded-xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40">
                        <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
                          <svg className="w-14 h-14 -rotate-90" viewBox="0 0 64 64">
                            <circle
                              cx="32"
                              cy="32"
                              r={radius}
                              fill="#FEE2E2"
                              stroke="#EF4444"
                              strokeWidth="6"
                            />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                            <span className="text-xs font-extrabold text-rose-700 dark:text-rose-400 tabular-nums leading-none">
                              {item.targetCount}
                            </span>
                            <span className="text-[8px] font-bold uppercase text-rose-600/80">
                              TOTAL
                            </span>
                          </div>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                            Target Circle
                          </p>
                          <p className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white tabular-nums">
                            {item.targetCount} People
                          </p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                            Expected Total
                          </p>
                        </div>
                      </div>

                      {/* CIRCLE 2: SUBMITTED VS REMAINING PIE CIRCLE */}
                      <div className="flex items-center gap-2.5 p-2 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40">
                        <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
                          <svg className="w-14 h-14 -rotate-90" viewBox="0 0 64 64">
                            {/* Remaining background track (Amber/Orange) */}
                            <circle
                              cx="32"
                              cy="32"
                              r={radius}
                              fill="transparent"
                              stroke="#FDE68A"
                              strokeWidth="6"
                            />
                            {/* Submitted progress arc (Emerald Green) */}
                            <circle
                              cx="32"
                              cy="32"
                              r={radius}
                              fill="transparent"
                              stroke="#10B981"
                              strokeWidth="6"
                              strokeLinecap="round"
                              strokeDasharray={circumference}
                              strokeDashoffset={strokeOffset}
                              className="transition-all duration-500"
                            />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                            <span className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums leading-none">
                              {item.submittedCount}/{item.targetCount}
                            </span>
                            <span className="text-[8px] font-bold uppercase text-emerald-600/90">
                              {item.completionPct}%
                            </span>
                          </div>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                            Progress Circle
                          </p>
                          <p className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums">
                            Filled: {item.submittedCount}
                          </p>
                          <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400 tabular-nums">
                            Left: {item.remainingCount}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredItems.length > 4 && (
              <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 text-xs">
                <span className="text-slate-500 font-semibold">
                  {showAllTracker
                    ? `Showing all ${filteredItems.length} items`
                    : `Showing top 4 priority items of ${filteredItems.length}`}
                </span>
                <button
                  type="button"
                  onClick={() => setShowAllTracker((prev) => !prev)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-white dark:hover:bg-slate-700 text-xs font-bold text-blue-600 dark:text-blue-400 transition-all cursor-pointer shadow-2xs"
                >
                  {showAllTracker ? 'Show Less (Priority Only)' : `Show All (${filteredItems.length} Items)`}
                </button>
              </div>
            )}
          </div>
        )}
        </div>

        {/* =====================================================================
            COMPACT EXECUTIVE ANALYTICS BANNER (Keeps Home Page Clean & Super-Fast)
            ===================================================================== */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
              <PieChartIcon className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">Executive Pie Charts & Fill Velocity</h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Submission ratios ({overallSubmissionTotal}/{overallTargetTotal} Filled), status distribution & velocity graphs
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowAnalyticsModal(true)}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer self-start sm:self-auto"
          >
            Open Analytics Mode →
          </button>
        </div>
      </div>

      {/* =======================================================================
          ANALYTICS & PIE CHARTS MODAL (Loaded On-Demand to avoid Main Page Lag)
          ======================================================================= */}
      {showAnalyticsModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 w-full max-w-5xl rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/50 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 flex items-center justify-center">
                  <PieChartIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                    Executive Analytics & Submission Ratios
                  </h3>
                  <p className="text-[11px] text-slate-500">Live submission ratios, status breakdown & fill velocity</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAnalyticsModal(false)}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 sm:gap-4">
                {/* PIE CHART 1: TOTAL TARGET VS SUBMITTED VS REMAINING */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 shadow-2xs flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      Pie Chart 01 · Submission Ratio
                    </span>
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mt-0.5">
                      Overall Filled vs Remaining
                    </h3>
                  </div>

                  <div className="my-4 flex items-center justify-center">
                    <MultiSegmentDonutChart
                      size={152}
                      strokeWidth={20}
                      centerTitle={`${overallGrowthPct}%`}
                      centerSub={`${overallSubmissionTotal}/${overallTargetTotal} Filled`}
                      segments={[
                        {
                          label: 'Submitted',
                          value: overallSubmissionTotal,
                          color: '#10B981',
                        },
                        {
                          label: 'Remaining',
                          value: Math.max(1, overallRemainingTotal),
                          color: '#EF4444',
                        },
                      ]}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30">
                      <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
                      <div>
                        <p className="text-[10px] font-bold text-slate-500">Submitted</p>
                        <p className="font-extrabold text-slate-900 dark:text-white tabular-nums">
                          {overallSubmissionTotal} People
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-rose-50/70 dark:bg-rose-950/30">
                      <span className="w-3 h-3 rounded-full bg-rose-500 shrink-0" />
                      <div>
                        <p className="text-[10px] font-bold text-slate-500">Remaining</p>
                        <p className="font-extrabold text-slate-900 dark:text-white tabular-nums">
                          {overallRemainingTotal} People
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* PIE CHART 2: TASK & PROJECT STATUS BREAKDOWN */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 shadow-2xs flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                      Pie Chart 02 · Workflow Progress
                    </span>
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mt-0.5">
                      Task & Project Status Distribution
                    </h3>
                  </div>

                  <div className="my-4 flex items-center justify-center">
                    <MultiSegmentDonutChart
                      size={152}
                      strokeWidth={20}
                      centerTitle={`${tasks.length + projects.length}`}
                      centerSub="Active Items"
                      segments={statusPieSegments}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                    {statusPieSegments.map((seg, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800/60"
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: seg.color }}
                          />
                          <span className="font-semibold text-slate-600 dark:text-slate-300 truncate">
                            {seg.label}
                          </span>
                        </div>
                        <span className="font-extrabold text-slate-900 dark:text-white tabular-nums ml-1">
                          {seg.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* CHART 3: GROWTH & COMPLETION ANALYTICS PER CATEGORY */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 shadow-2xs flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                      Growth Chart 03 · Category Velocity
                    </span>
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mt-0.5">
                      Category Growth & Fill Rate
                    </h3>
                  </div>

                  <div className="my-3 space-y-3.5">
                    {[
                      {
                        label: 'Tasks Submission Growth',
                        submitted: taskStats.totalSubmitted,
                        target: taskStats.totalTarget,
                        pct: taskStats.pct,
                        barColor: 'bg-blue-600',
                      },
                      {
                        label: 'Projects Milestone Growth',
                        submitted: projectStats.totalSubmitted,
                        target: projectStats.totalTarget,
                        pct: projectStats.pct,
                        barColor: 'bg-purple-600',
                      },
                      {
                        label: 'Forms Response Growth',
                        submitted: formStats.totalSubmitted,
                        target: formStats.totalTarget,
                        pct: formStats.pct,
                        barColor: 'bg-indigo-600',
                      },
                      {
                        label: 'Overall Workspace Completion',
                        submitted: overallSubmissionTotal,
                        target: overallTargetTotal,
                        pct: overallGrowthPct,
                        barColor: 'bg-emerald-600',
                      },
                    ].map((row, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-700 dark:text-slate-200">
                            {row.label}
                          </span>
                          <span className="font-extrabold text-slate-900 dark:text-white tabular-nums">
                            {row.submitted}/{row.target} ({row.pct}%)
                          </span>
                        </div>
                        <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${row.barColor} transition-all duration-500`}
                            style={{ width: `${Math.max(4, row.pct)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                    <span>Live submission tracking vs target</span>
                    <span className="font-bold text-emerald-600 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" /> Real-Time Analytics
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          DRILL-DOWN MODAL: Who Submitted, What They Submitted & Who Is Remaining
          ======================================================================= */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
            {/* Modal Header */}
            <div className="px-4 py-3.5 sm:px-6 sm:py-4 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3 bg-slate-50/70 dark:bg-slate-800/50">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-blue-600 text-white">
                    {selectedItem.type} INSPECTOR
                  </span>
                  <span className="text-xs font-bold text-slate-500">
                    Target: {selectedItem.targetCount} · Submitted: {selectedItem.submittedCount} · Remaining: {selectedItem.remainingCount}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white mt-1 truncate">
                  {selectedItem.title}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setSelectedItemId(null)}
                className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Target People Adjuster Bar (Set e.g. 40 people right here) */}
            {(selectedItem.type === 'TASK' || selectedItem.type === 'PROJECT') && (
              <div className="px-4 py-2.5 sm:px-6 bg-rose-50/60 dark:bg-rose-950/20 border-b border-rose-200/60 dark:border-rose-900/40 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-rose-800 dark:text-rose-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span>Set Target People for this {selectedItem.type === 'TASK' ? 'Task' : 'Project'}:</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {[10, 25, 40, 50, 100].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setEditingTargetValue(preset)}
                      className={`px-2 py-1 rounded-lg text-[11px] font-extrabold border ${
                        editingTargetValue === preset
                          ? 'bg-rose-600 text-white border-rose-600'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                  <input
                    type="number"
                    min={1}
                    max={10000}
                    value={editingTargetValue}
                    onChange={(e) =>
                      setEditingTargetValue(Math.max(1, Number(e.target.value) || 1))
                    }
                    className="w-20 px-2.5 py-1 rounded-lg border border-slate-300 text-xs font-extrabold text-slate-900"
                  />
                  <button
                    type="button"
                    onClick={handleSaveTargetCount}
                    disabled={savingTarget}
                    className="px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{savingTarget ? 'Saving...' : 'Save'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Modal Sub-Tabs */}
            <div className="px-4 sm:px-6 pt-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto">
              <button
                type="button"
                onClick={() => setInspectorTab('SUBMITTED')}
                className={`pb-2.5 px-3 border-b-2 text-xs font-extrabold flex items-center gap-1.5 whitespace-nowrap ${
                  inspectorTab === 'SUBMITTED'
                    ? 'border-emerald-600 text-emerald-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Submitted & Deliverables ({selectedItem.submittedCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setInspectorTab('REMAINING')}
                className={`pb-2.5 px-3 border-b-2 text-xs font-extrabold flex items-center gap-1.5 whitespace-nowrap ${
                  inspectorTab === 'REMAINING'
                    ? 'border-rose-600 text-rose-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>Remaining / Pending ({selectedItem.remainingCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setInspectorTab('QUICK_SUBMIT')}
                className={`pb-2.5 px-3 border-b-2 text-xs font-extrabold flex items-center gap-1.5 whitespace-nowrap ${
                  inspectorTab === 'QUICK_SUBMIT'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Plus className="w-4 h-4" />
                <span>+ Add Submission</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {inspectorTab === 'SUBMITTED' && (
                <div>
                  {selectedItem.submissions.length === 0 ? (
                    <div className="py-10 text-center space-y-3">
                      <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                        No submissions yet (0/{selectedItem.targetCount} People)
                      </p>
                      <p className="text-xs text-slate-500">
                        Click the button below to record a submission or share the portal link.
                      </p>
                      <button
                        type="button"
                        onClick={() => setInspectorTab('QUICK_SUBMIT')}
                        className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold"
                      >
                        + Add First Submission
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                      {/* Left List: Who Submitted */}
                      <div className="md:col-span-5 space-y-2 border-r-0 md:border-r border-slate-200 dark:border-slate-800 md:pr-3">
                        <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                          Submitted People ({selectedItem.submissions.length})
                        </p>
                        {selectedItem.submissions.map((sub, idx) => {
                          const isSelected = selectedSubmission?.id === sub.id;
                          return (
                            <button
                              key={sub.id}
                              type="button"
                              onClick={() => setSelectedSubmission(sub)}
                              className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between gap-2 ${
                                isSelected
                                  ? 'bg-emerald-50/90 dark:bg-emerald-950/50 border-emerald-500'
                                  : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-800 hover:bg-white'
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                                    {idx + 1}
                                  </span>
                                  <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                                    {sub.submitterName}
                                  </p>
                                </div>
                                <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                  {sub.submitterEmail}
                                </p>
                              </div>
                              <span className="text-[10px] font-semibold text-slate-400 shrink-0">
                                {sub.submittedAt}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Right Detail: What They Submitted */}
                      <div className="md:col-span-7">
                        {selectedSubmission ? (
                          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-4 space-y-3">
                            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2.5">
                              <div>
                                <p className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400">
                                  Submitted By: {selectedSubmission.submitterName}
                                </p>
                                <p className="text-[11px] text-slate-500">
                                  {selectedSubmission.submitterEmail} · Time: {selectedSubmission.submittedAt}
                                </p>
                              </div>
                              <FileText className="w-4 h-4 text-emerald-600" />
                            </div>

                            <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                              Submitted Form Data & Deliverables:
                            </p>

                            <div className="space-y-2">
                              {Object.entries(selectedSubmission.values || {}).map(([key, val]) => (
                                <div
                                  key={key}
                                  className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800"
                                >
                                  <p className="text-[11px] font-bold text-slate-500">{key}</p>
                                  <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white mt-0.5 break-words">
                                    {Array.isArray(val) ? val.join(', ') : String(val ?? '—')}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="py-8 text-center text-xs text-slate-500">
                            Select a person on the left to inspect their submitted data.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {inspectorTab === 'REMAINING' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-extrabold text-amber-800 dark:text-amber-300">
                        {selectedItem.remainingCount} out of {selectedItem.targetCount} Target People Remaining
                      </p>
                      <p className="text-[11px] text-amber-700/80 dark:text-amber-400 mt-0.5">
                        Already Submitted: {selectedItem.submittedCount} People ({selectedItem.completionPct}% Complete)
                      </p>
                    </div>
                    <span className="text-xl font-extrabold text-rose-600 tabular-nums">
                      {selectedItem.remainingCount} Left
                    </span>
                  </div>

                  {/* Assigned Team Members who haven't submitted yet */}
                  <div className="space-y-2">
                    <p className="text-xs font-extrabold text-slate-700 dark:text-slate-300">
                      Team Member Submission Status:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {members.map((m) => {
                        const hasSubmitted = selectedItem.submissions.some(
                          (s) =>
                            s.submitterEmail.toLowerCase() === m.email.toLowerCase() ||
                            s.submitterName.toLowerCase() === m.fullName.toLowerCase()
                        );
                        return (
                          <div
                            key={m.id}
                            className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                              hasSubmitted
                                ? 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900'
                                : 'bg-white border-slate-200 dark:bg-slate-800 dark:border-slate-700'
                            }`}
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                {m.fullName}
                              </p>
                              <p className="text-[10px] text-slate-500 truncate">{m.email}</p>
                            </div>
                            {hasSubmitted ? (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-bold flex items-center gap-1 shrink-0">
                                <UserCheck className="w-3 h-3" /> Submitted
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 text-[10px] font-bold shrink-0">
                                Pending
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {inspectorTab === 'QUICK_SUBMIT' && (
                <form
                  onSubmit={handleQuickSubmitResponse}
                  className="space-y-3.5 max-w-lg mx-auto"
                >
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    Record a new submission for "{selectedItem.title}":
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Submitter Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={quickSubmitName}
                        onChange={(e) => setQuickSubmitName(e.target.value)}
                        placeholder="e.g., Alex Morgan"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={quickSubmitEmail}
                        onChange={(e) => setQuickSubmitEmail(e.target.value)}
                        placeholder="alex@company.com"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Submitted Deliverable / Link / Answer *
                    </label>
                    <input
                      type="text"
                      required
                      value={quickSubmitDeliverable}
                      onChange={(e) => setQuickSubmitDeliverable(e.target.value)}
                      placeholder="e.g., Completed Module Report & Verified Data Sheet"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Additional Notes (Optional)
                    </label>
                    <textarea
                      rows={2}
                      value={quickSubmitNote}
                      onChange={(e) => setQuickSubmitNote(e.target.value)}
                      placeholder="Enter any extra notes or details..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submittingEntry}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-xs"
                  >
                    {submittingEntry ? 'Saving Submission...' : 'Save Submission & Update Circle'}
                  </button>
                </form>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-4 py-3 sm:px-6 bg-slate-50 dark:bg-slate-800/70 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  const targetMod =
                    selectedItem.type === 'TASK'
                      ? 'cmh_tasks'
                      : selectedItem.type === 'PROJECT'
                      ? 'cmh_projects'
                      : 'cmh_forms';
                  setSelectedItemId(null);
                  onNavigateModule(targetMod);
                }}
                className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open Full Module</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedItemId(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-700 text-white text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};
