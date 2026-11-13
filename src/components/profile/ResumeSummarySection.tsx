import React from 'react';
import { Sparkles, Quote } from 'lucide-react';

interface ResumeSummarySectionProps {
  summary: string;
  isEditing: boolean;
  onChangeSummary: (val: string) => void;
}

export const ResumeSummarySection: React.FC<ResumeSummarySectionProps> = ({
  summary,
  isEditing,
  onChangeSummary,
}) => {
  return (
    <section
      id="sec-summary"
      className="scroll-mt-24 rounded-[26px] p-5 sm:p-7 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/90 shadow-[0_12px_35px_-12px_rgba(15,23,42,0.06)] space-y-4 relative overflow-hidden"
    >
      {/* Subtle Top Accent Bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-500 opacity-85" />

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-br from-blue-500/15 to-indigo-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 block">
              Executive Narrative
            </span>
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
              Executive Summary &amp; Leadership Philosophy
            </h2>
          </div>
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
            Executive Summary Statement
          </label>
          <textarea
            value={summary}
            onChange={(e) => onChangeSummary(e.target.value)}
            rows={4}
            className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/80 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 leading-relaxed resize-y"
            placeholder="Describe your executive background, primary achievements, and leadership philosophy..."
          />
        </div>
      ) : (
        <div className="relative p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 dark:from-slate-800/50 dark:via-slate-800/30 dark:to-slate-900 border border-slate-200/60 dark:border-slate-800">
          <Quote className="w-6 h-6 text-blue-500/25 mb-2 rotate-180" />
          <p className="text-sm sm:text-[15px] text-slate-700 dark:text-slate-200 leading-relaxed font-medium whitespace-pre-line">
            {summary || 'No executive summary provided.'}
          </p>
        </div>
      )}
    </section>
  );
};
