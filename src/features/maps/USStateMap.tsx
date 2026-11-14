import React from 'react';
import { US_STATES_GEOMETRY, US_MAP_VIEWBOX } from './generated/usStateGeometry';
import { StateMarker } from './StateMarker';
import type { USStateMapProps } from './contracts';

export const USStateMap: React.FC<USStateMapProps> = ({
  mode = 'distribution',
  stateCounts = {},
  selectedStateCode = null,
  onSelectState,
  accentColor = '#0B57D0',
  className = '',
  showLabels = true,
}) => {
  return (
    <div className={`relative w-full overflow-hidden select-none ${className}`}>
      <svg
        viewBox={US_MAP_VIEWBOX.viewBoxString}
        className="w-full h-auto max-h-[540px] drop-shadow-xs"
        role="img"
        aria-label="Map of the United States showing member distribution by state"
      >
        {/* State Polygons Base Layer */}
        <g className="states-layer">
          {US_STATES_GEOMETRY.map((st) => {
            const count = stateCounts[st.code] || 0;
            const isSelected = selectedStateCode === st.code;
            const isPopulated = count > 0;

            // Fill color hierarchy
            let fillColor = 'fill-slate-100 hover:fill-slate-200 dark:fill-slate-800/80 dark:hover:fill-slate-700/80';
            if (isSelected) {
              fillColor = 'fill-blue-100 dark:fill-blue-950/60 stroke-blue-600 dark:stroke-blue-400';
            } else if (isPopulated && mode === 'distribution') {
              fillColor = 'fill-blue-50/70 hover:fill-blue-100/80 dark:fill-slate-800 dark:hover:fill-slate-700';
            }

            return (
              <path
                key={st.code}
                d={st.path}
                className={`transition-colors duration-150 cursor-pointer stroke-slate-300 dark:stroke-slate-700 stroke-[0.8] ${fillColor}`}
                onClick={() => onSelectState?.(st.code)}
                tabIndex={0}
                role="button"
                aria-label={`${st.name} (${st.code}): ${count} members`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectState?.(st.code);
                  }
                }}
              />
            );
          })}
        </g>

        {/* State Postal Labels Layer (Optional / subtle on land) */}
        {showLabels && (
          <g className="labels-layer pointer-events-none opacity-40 dark:opacity-30">
            {US_STATES_GEOMETRY.map((st) => {
              // Hide labels for tiny northeastern states to prevent collision with pins
              const isTinyNE = ['DC', 'RI', 'DE', 'NJ', 'CT', 'MD', 'MA'].includes(st.code);
              if (isTinyNE) return null;

              return (
                <text
                  key={`lbl-${st.code}`}
                  x={st.anchor[0]}
                  y={st.anchor[1] + 3}
                  textAnchor="middle"
                  className="fill-slate-500 dark:fill-slate-400 font-extrabold text-[8px] tracking-tight font-sans select-none"
                >
                  {st.code}
                </text>
              );
            })}
          </g>
        )}

        {/* Pinpoint Markers Layer */}
        <g className="markers-layer">
          {US_STATES_GEOMETRY.map((st) => {
            const count = stateCounts[st.code] || 0;
            const isSelected = selectedStateCode === st.code;

            // In profile/preview mode: show pin on the selected state even if count is 0
            const shouldShowPin =
              mode === 'distribution' ? count > 0 : isSelected || count > 0;

            if (!shouldShowPin) return null;

            return (
              <StateMarker
                key={`pin-${st.code}`}
                stateCode={st.code}
                stateName={st.name}
                count={count || (mode === 'profile' || mode === 'preview' ? 1 : 0)}
                x={st.anchor[0]}
                y={st.anchor[1]}
                isSelected={isSelected}
                accentColor={accentColor}
                onClick={() => onSelectState?.(st.code)}
              />
            );
          })}
        </g>
      </svg>
    </div>
  );
};
