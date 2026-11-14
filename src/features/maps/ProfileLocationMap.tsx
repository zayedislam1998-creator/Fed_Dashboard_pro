import React from 'react';
import { MapPin, Globe } from 'lucide-react';
import { USStateMap } from './USStateMap';
import type { ProfileLocationMapProps } from './contracts';

export const ProfileLocationMap: React.FC<ProfileLocationMapProps> = ({
  stateCode = null,
  stateName = null,
  countryName = 'United States',
  cityName = null,
  className = '',
}) => {
  const isUS = !countryName || countryName.toLowerCase().includes('united states') || countryName.toLowerCase() === 'us';
  const cleanStateCode = (stateCode || '').trim().toUpperCase();
  const hasValidState = cleanStateCode.length === 2;

  return (
    <div
      className={`rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs space-y-3 ${className}`}
    >
      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400">
            <MapPin className="w-3.5 h-3.5" />
          </span>
          <span className="text-xs font-bold text-slate-900 dark:text-white">
            Primary Residence & Geographic Anchor
          </span>
        </div>
        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
          {countryName || 'Global'}
        </span>
      </div>

      {isUS && hasValidState ? (
        <div className="space-y-3">
          {/* US State Map focused on user's state */}
          <div className="rounded-xl bg-slate-50 dark:bg-slate-950/50 p-2 border border-slate-200/70 dark:border-slate-800">
            <USStateMap
              mode="profile"
              selectedStateCode={cleanStateCode}
              showLabels={false}
              className="max-h-[220px]"
            />
          </div>

          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/60 text-xs">
            <div>
              <span className="font-extrabold text-blue-950 dark:text-blue-200 block">
                {cityName ? `${cityName}, ` : ''}{stateName || cleanStateCode}
              </span>
              <span className="text-[10px] text-blue-700 dark:text-blue-400">
                Verified Geographic Anchor ({cleanStateCode})
              </span>
            </div>
            <span className="px-2 py-1 rounded-lg bg-blue-600 text-white font-black text-xs">
              {cleanStateCode}
            </span>
          </div>
        </div>
      ) : (
        <div className="p-6 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 text-center space-y-1.5">
          <Globe className="w-6 h-6 text-slate-400 mx-auto" />
          <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
            {cityName ? `${cityName}, ` : ''}{countryName || 'International Location'}
          </p>
          <p className="text-[11px] text-slate-400">
            {isUS
              ? 'Select your US state in Settings or Profile to anchor your location on the map.'
              : 'Registered with an international location.'}
          </p>
        </div>
      )}
    </div>
  );
};
