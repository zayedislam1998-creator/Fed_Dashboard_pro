import React from 'react';
import { X, PieChart as PieChartIcon } from 'lucide-react';
import { MultiSegmentDonutChart } from './MultiSegmentDonutChart';

export interface AnalyticsModalProps {
  onClose: () => void;
  overallSubmissionTotal: number;
  overallTargetTotal: number;
  overallRemainingTotal: number;
  overallGrowthPct: number;
  taskCount: number;
  projectCount: number;
  formCount: number;
  statusPieSegments: Array<{ label: string; value: number; color: string }>;
  taskStats: { totalTarget: number; totalSubmitted: number; remaining: number; pct: number };
  projectStats: { totalTarget: number; totalSubmitted: number; remaining: number; pct: number };
  formStats: { totalTarget: number; totalSubmitted: number; remaining: number; pct: number };
}

export const AnalyticsModal: React.FC<AnalyticsModalProps> = ({
  onClose,
  overallSubmissionTotal,
  overallTargetTotal,
  overallRemainingTotal,
  overallGrowthPct,
  taskCount,
  projectCount,
  formCount,
  statusPieSegments,
  taskStats,
  projectStats,
  formStats,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6   duration-150">
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
            onClick={onClose}
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
                    { label: 'Submitted', value: overallSubmissionTotal, color: '#10B981' },
                    { label: 'Remaining', value: Math.max(1, overallRemainingTotal), color: '#EF4444' },
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
                  centerTitle={`${taskCount + projectCount}`}
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
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                      <span className="text-slate-600 dark:text-slate-400 truncate">{seg.label}</span>
                    </div>
                    <span className="font-extrabold text-slate-900 dark:text-white tabular-nums ml-1">{seg.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* PIE CHART 3: CATEGORY BREAKDOWN */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 shadow-2xs flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                  Pie Chart 03 · Category Split
                </span>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mt-0.5">
                  Tasks vs Projects vs Forms
                </h3>
              </div>

              <div className="my-4 flex items-center justify-center">
                <MultiSegmentDonutChart
                  size={152}
                  strokeWidth={20}
                  centerTitle={`${taskCount + projectCount + formCount}`}
                  centerSub="Total Items"
                  segments={[
                    { label: 'Tasks', value: taskCount, color: '#2563EB' },
                    { label: 'Projects', value: projectCount, color: '#9333EA' },
                    { label: 'Forms', value: formCount, color: '#4F46E5' },
                  ]}
                />
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                {[
                  { label: 'Tasks', ...taskStats, color: '#2563EB' },
                  { label: 'Projects', ...projectStats, color: '#9333EA' },
                  { label: 'Forms', ...formStats, color: '#4F46E5' },
                ].map((cat) => (
                  <div key={cat.label} className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                        <span className="font-bold text-slate-700 dark:text-slate-300">{cat.label}</span>
                      </div>
                      <span className="font-extrabold text-slate-900 dark:text-white tabular-nums">{cat.pct}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${cat.pct}%`, backgroundColor: cat.color }}
                      />
                    </div>
                    <div className="flex justify-between mt-1 text-[10px] text-slate-500">
                      <span>Submitted: {cat.totalSubmitted}</span>
                      <span>Target: {cat.totalTarget}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom Summary Row */}
          <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border border-indigo-200/60 dark:border-indigo-900/40 flex items-center justify-between">
            <div>
              <p className="text-xs font-extrabold text-indigo-800 dark:text-indigo-300">
                Total Workspace Submission Health
              </p>
              <p className="text-[11px] text-indigo-600/80 dark:text-indigo-400 mt-0.5">
                {overallSubmissionTotal} of {overallTargetTotal} target slots filled across all tasks, projects & forms
              </p>
            </div>
            <span className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 tabular-nums">
              {overallGrowthPct}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
