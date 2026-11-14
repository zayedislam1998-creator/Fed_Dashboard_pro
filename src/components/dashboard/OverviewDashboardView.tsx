import { readCmhWorkspaceSnapshot } from '../../services/api/cmhApi';
import React, { useState, useEffect, useMemo } from 'react';
import { useSubmissionRequest } from '../../services/useSubmissionRequest';
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
import { subscribeWorkspaceEvents } from '../../services/realtimeBus';
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
} from '../../services/workspaceApi';
import { StateDistributionCard } from '../../features/maps';
import { AnalyticsModal, InspectorModal, InspectorTab } from '../overview';

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
  const [tasks, setTasks] = useState<CmhTaskItem[]>(() => readCmhWorkspaceSnapshot()?.tasks ?? []);
  const [projects, setProjects] = useState<CmhProjectItem[]>(() => readCmhWorkspaceSnapshot()?.projects ?? []);
  const [cmhForms, setCmhForms] = useState<CmhFormTemplate[]>(() => readCmhWorkspaceSnapshot()?.forms ?? []);
  const [members, setMembers] = useState<WorkspaceMemberItem[]>(() => readCmhWorkspaceSnapshot()?.members ?? []);

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
      const cmhData = await fetchCmhWorkspaceBootstrap();
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
    // Single initial fetch only â€” NO aggressive background auto-sync polling
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
        subtitle: `${f.fields?.length || 0} Custom Fields Â· ${f.formCategory}`,
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
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="flex-1 overflow-y-auto bg-[#F8FAFC] dark:bg-slate-950 p-3 sm:p-5 pb-20 md:pb-8"
    >
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-5">
        {/* Executive Header Bar */}
        <div className="flex items-center justify-between gap-2 bg-white dark:bg-slate-900 rounded-2xl px-3.5 py-2.5 sm:px-5 sm:py-3.5 border border-slate-200/90 dark:border-slate-800 shadow-2xs">
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight truncate flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
              <span>FED Executive Dashboard</span>
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowAnalyticsModal(true)}
              className="px-3 sm:px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
            >
              <PieChartIcon className="w-3.5 h-3.5" />
              <span>Open Analytics Mode â†’</span>
            </button>

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
            GEOGRAPHIC INTELLIGENCE: 50-STATE INTERACTIVE US MEMBER DISTRIBUTION MAP
            Featured prominently on the Executive Dashboard (fits inside the primary viewport)
            Layout: Map takes ~2/3 width on desktop, full width on mobile, with empty side column for future content
            ===================================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5 sm:gap-4">
          <div className="lg:col-span-2">
            <StateDistributionCard />
          </div>
          {/* Empty side column â€” reserved for future content */}
          <div className="hidden lg:block" />
        </div>

        {/* If tasks, projects, or forms exist, display the submission tracker below the map */}
        {filteredItems.length > 0 && (
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
                  Red Circle = Total Target People Â· Green/Amber Circle = Submitted vs Remaining (Click any item to inspect submissions)
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
                              â€¢ {item.dateLabel}
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
        </div>
      )}
      </div>
      {/* Analytics Modal */}
      {showAnalyticsModal && (
        <AnalyticsModal
          onClose={() => setShowAnalyticsModal(false)}
          overallSubmissionTotal={overallSubmissionTotal}
          overallTargetTotal={overallTargetTotal}
          overallRemainingTotal={overallRemainingTotal}
          overallGrowthPct={overallGrowthPct}
          taskCount={tasks.length}
          projectCount={projects.length}
          formCount={cmhForms.length}
          statusPieSegments={statusPieSegments}
          taskStats={taskStats}
          projectStats={projectStats}
          formStats={formStats}
        />
      )}

      {/* Inspector Modal */}
      {selectedItem && (
        <InspectorModal
          item={selectedItem}
          members={members}
          onClose={() => setSelectedItemId(null)}
          onNavigateModule={(mod) => { setSelectedItemId(null); onNavigateModule(mod); }}
          editingTargetValue={editingTargetValue}
          setEditingTargetValue={setEditingTargetValue}
          savingTarget={savingTarget}
          onSaveTargetCount={handleSaveTargetCount}
          selectedSubmission={selectedSubmission}
          setSelectedSubmission={setSelectedSubmission}
          inspectorTab={inspectorTab}
          setInspectorTab={setInspectorTab}
          quickSubmitName={quickSubmitName}
          setQuickSubmitName={setQuickSubmitName}
          quickSubmitEmail={quickSubmitEmail}
          setQuickSubmitEmail={setQuickSubmitEmail}
          quickSubmitNote={quickSubmitNote}
          setQuickSubmitNote={setQuickSubmitNote}
          quickSubmitDeliverable={quickSubmitDeliverable}
          setQuickSubmitDeliverable={setQuickSubmitDeliverable}
          submittingEntry={submittingEntry}
          onSubmitQuickResponse={handleQuickSubmitResponse}
        />
      )}
    </motion.div>
  );
};
