import React, { useMemo, useState } from 'react';
import {
  Globe,
  MapPin,
  RefreshCw,
  Search,
  Users,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { USStateMap } from './USStateMap';
import { useMemberLocationSummary } from './useMemberLocationSummary';
import { US_STATES_GEOMETRY } from './generated/usStateGeometry';
import type { StateDistributionCardProps } from './contracts';

export const StateDistributionCard: React.FC<StateDistributionCardProps> = ({
  className = '',
  title = 'US Member Distribution & Geographic Footprint',
  subtitle = 'Live registered user distribution across 50 US States with Google Maps-style pinpoints',
  onFilterByState,
}) => {
  const { summary, stateCounts, loading, error, reload } = useMemberLocationSummary();
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSelectState = (stateCode: string) => {
    const next = selectedState === stateCode ? null : stateCode;
    setSelectedState(next);
    if (next && onFilterByState) {
      onFilterByState(next);
    }
  };

  // Enriched list with full state names
  const stateList = useMemo(() => {
    const geomMap = new Map(US_STATES_GEOMETRY.map((g) => [g.code, g.name]));
    const list = US_STATES_GEOMETRY.map((g) => ({
      code: g.code,
      name: g.name,
      count: stateCounts[g.code] || 0,
    }));

    // Filter by search query
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? list.filter((s) => s.code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
      : list;

    // Sort: populated first (descending count), then alphabetically
    return filtered.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [stateCounts, searchQuery]);

  const totalPlotted = summary?.totalPlotted || 0;
  const totalEligible = summary?.totalEligible || 0;
  const populatedStatesCount = Object.values(stateCounts).filter((c) => c > 0).length;

  return (
    <div
      className={`bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 md:p-6 shadow-xs ${className}`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400">
              <MapPin className="w-4 h-4" />
            </span>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Geographic Intelligence · 50-State Real-Time Map
            </span>
          </div>
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            {title}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
        </div>

        {/* Quick Metrics & Refresh */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 text-xs">
            <Users className="w-3.5 h-3.5 text-blue-600" />
            <span className="font-semibold text-slate-600 dark:text-slate-300">Plotted:</span>
            <span className="font-extrabold text-slate-900 dark:text-white tabular-nums">
              {totalPlotted}
            </span>
            <span className="text-slate-400">/</span>
            <span className="text-slate-500">{totalEligible} members</span>
          </div>

          <button
            onClick={() => reload()}
            disabled={loading}
            title="Refresh location data"
            className="p-2 rounded-xl border border-slate-200/80 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Excluded Buckets Reconciliation Bar */}
      {summary?.excluded && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
          <span className="font-semibold text-slate-500 dark:text-slate-400">Distribution Audit:</span>
          <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200/60">
            {populatedStatesCount} States Active
          </span>
          {summary.excluded.outsideUS > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-medium border border-purple-200/60 flex items-center gap-1">
              <Globe className="w-3 h-3" />
              Outside US: {summary.excluded.outsideUS}
            </span>
          )}
          {summary.excluded.unspecifiedUSState > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-medium border border-amber-200/60">
              Unspecified State: {summary.excluded.unspecifiedUSState}
            </span>
          )}
          {summary.excluded.unspecifiedCountry > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
              Unspecified Country: {summary.excluded.unspecifiedCountry}
            </span>
          )}
        </div>
      )}

      {/* Main Content Grid: Map (Left 65%) + State Directory / Filter (Right 35%) */}
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Map Container */}
        <div className="lg:col-span-8 rounded-2xl bg-slate-50/60 dark:bg-slate-950/40 border border-slate-200/70 dark:border-slate-800/80 p-3 sm:p-4 flex flex-col justify-between min-h-[380px]">
          {loading && !summary ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mb-2" />
              <p className="text-xs font-semibold">Loading US State Map geometry & member locations...</p>
            </div>
          ) : error ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-rose-500 text-center">
              <AlertCircle className="w-6 h-6 mb-2" />
              <p className="text-xs font-bold">{error}</p>
              <button
                onClick={() => reload()}
                className="mt-3 px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition"
              >
                Retry Loading
              </button>
            </div>
          ) : (
            <>
              <USStateMap
                mode="distribution"
                stateCounts={stateCounts}
                selectedStateCode={selectedState}
                onSelectState={handleSelectState}
              />

              {/* Bottom Map Legend */}
              <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block shadow-xs" />
                    <span>Populated State (Click pin to view)</span>
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

        {/* State Breakdown Directory List */}
        <div className="lg:col-span-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
              State Directory
            </h4>
            <span className="text-[11px] text-slate-400 font-medium">
              {stateList.length} regions
            </span>
          </div>

          {/* Search box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter by state or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>

          {/* Scrollable List */}
          <div className="max-h-[300px] overflow-y-auto space-y-1 pr-1">
            {stateList.map((st) => {
              const isSelected = selectedState === st.code;
              const hasMembers = st.count > 0;
              const pct = totalPlotted > 0 ? Math.round((st.count / totalPlotted) * 100) : 0;

              return (
                <button
                  key={st.code}
                  onClick={() => handleSelectState(st.code)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs transition flex items-center justify-between ${
                    isSelected
                      ? 'bg-blue-600 text-white font-bold shadow-xs'
                      : hasMembers
                      ? 'bg-blue-50/70 hover:bg-blue-100/70 dark:bg-slate-800/80 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span
                      className={`w-6 h-5 rounded-md flex items-center justify-center text-[10px] font-black shrink-0 ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : hasMembers
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {st.code}
                    </span>
                    <span className="truncate">{st.name}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {hasMembers && (
                      <span
                        className={`text-[10px] font-semibold ${
                          isSelected ? 'text-white/80' : 'text-slate-400'
                        }`}
                      >
                        {pct}%
                      </span>
                    )}
                    <span
                      className={`font-black tabular-nums ${
                        isSelected
                          ? 'text-white'
                          : hasMembers
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-slate-400'
                      }`}
                    >
                      {st.count}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Quick Info Box */}
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-[11px] text-slate-500 space-y-1">
            <p className="font-semibold text-slate-700 dark:text-slate-300">
              How are locations populated?
            </p>
            <p className="text-[10px] leading-relaxed">
              Derived automatically from verified US state selections during member registration or profile updates.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
