import React, { useState } from 'react';
import {
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { USStateMap } from './USStateMap';
import { useMemberLocationSummary } from './useMemberLocationSummary';
import type { StateDistributionCardProps } from './contracts';

export const StateDistributionCard: React.FC<StateDistributionCardProps> = ({
  className = '',
  onFilterByState,
}) => {
  const { summary, stateCounts, stateUsers, loading, error, reload } = useMemberLocationSummary();
  const [selectedState, setSelectedState] = useState<string | null>(null);

  const handleSelectState = (stateCode: string) => {
    const next = selectedState === stateCode ? null : stateCode;
    setSelectedState(next);
    if (next && onFilterByState) {
      onFilterByState(next);
    }
  };

  const totalPlotted = summary?.totalPlotted || 0;

  return (
    <div
      className={`bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 p-2 sm:p-4 shadow-xs ${className}`}
    >
      {/* Map Container - Full Width, On-Screen Visibility */}
      <div className="relative w-full rounded-xl sm:rounded-2xl bg-slate-50/60 dark:bg-slate-950/40 border border-slate-200/70 dark:border-slate-800/80 p-2 sm:p-3 flex flex-col justify-between min-h-[200px] sm:min-h-[280px] max-h-[360px] sm:max-h-[420px]">
        {/* Floating compact Live Status & Refresh indicator (Zero extra vertical space) */}
        <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs px-2.5 py-1 rounded-full border border-slate-200/80 dark:border-slate-700/80 text-[11px] shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="font-semibold text-slate-600 dark:text-slate-300">Live Members:</span>
          <span className="font-extrabold text-blue-600 dark:text-blue-400 tabular-nums">
            {totalPlotted}
          </span>
          <button
            onClick={() => reload()}
            disabled={loading}
            title="Refresh location data"
            className="ml-0.5 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition disabled:opacity-50"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>

        {error ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-rose-500 text-center">
            <AlertCircle className="w-6 h-6 mb-2" />
            <p className="text-xs font-bold">{error}</p>
            <button
              onClick={() => reload()}
              className="mt-3 px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            <USStateMap
              mode="distribution"
              stateCounts={stateCounts}
              stateUsers={stateUsers}
              selectedStateCode={selectedState}
              onSelectState={handleSelectState}
            />

            {/* Bottom minimal Map Legend */}
            <div className="pt-2 sm:pt-3 mt-1 border-t border-slate-200/60 dark:border-slate-800/60 flex flex-wrap items-center justify-between gap-2 text-[10px] sm:text-[11px] text-slate-500">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block shadow-xs" />
                  <span>Member Pinpoint (Hover / Touch for details)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 inline-block" />
                  <span>0 Plotted</span>
                </span>
              </div>
              {selectedState && (
                <button
                  onClick={() => setSelectedState(null)}
                  className="text-xs font-bold text-blue-600 hover:underline"
                >
                  Clear Filter ({selectedState})
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
