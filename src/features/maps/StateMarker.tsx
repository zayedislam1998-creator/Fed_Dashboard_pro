import React, { useState } from 'react';
import type { StateMarkerProps } from './contracts';

export const StateMarker: React.FC<StateMarkerProps> = ({
  stateCode,
  stateName,
  count,
  x,
  y,
  isSelected = false,
  onClick,
  accentColor = '#0B57D0',
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const isMulti = count > 1;

  // Pin dimensions
  const scale = isSelected ? 1.25 : isHovered ? 1.15 : 1;
  const pinColor = isSelected ? '#1E40AF' : accentColor;

  return (
    <g
      transform={`translate(${x}, ${y}) scale(${scale})`}
      className="cursor-pointer transition-transform duration-200 focus:outline-none select-none"
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsHovered(true)}
      onBlur={() => setIsHovered(false)}
      tabIndex={0}
      role="button"
      aria-label={`${stateName} (${stateCode}): ${count} active ${count === 1 ? 'member' : 'members'}`}
    >
      {/* Drop shadow filter */}
      <defs>
        <filter id={`shadow-${stateCode}`} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor="#0f172a" floodOpacity="0.3" />
        </filter>
      </defs>

      {/* Pin Body (Google Maps style teardrop) */}
      <g filter={`url(#shadow-${stateCode})`}>
        {/* Ground shadow dot */}
        <ellipse cx="0" cy="1" rx="3.5" ry="1.5" fill="#0f172a" fillOpacity="0.2" />

        {isMulti ? (
          // Multi-member badge pin (wider pill shape)
          <g transform="translate(0, -18)">
            <path
              d="M -11 -6 C -11 -12, 11 -12, 11 -6 C 11 0, 3 4, 0 16 C -3 4, -11 0, -11 -6 Z"
              fill={pinColor}
              stroke="#ffffff"
              strokeWidth="1.5"
            />
            {/* Count text */}
            <text
              x="0"
              y="-4"
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#ffffff"
              fontSize="8.5"
              fontWeight="800"
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              {count > 99 ? '99+' : count}
            </text>
          </g>
        ) : (
          // Single member pinpoint
          <g transform="translate(0, -16)">
            <path
              d="M 0 14 C -2 8, -7 5, -7 0 A 7 7 0 1 1 7 0 C 7 5, 2 8, 0 14 Z"
              fill={pinColor}
              stroke="#ffffff"
              strokeWidth="1.5"
            />
            <circle cx="0" cy="0" r="2.5" fill="#ffffff" />
          </g>
        )}
      </g>

      {/* Hover / Selected Interactive Tooltip */}
      {(isHovered || isSelected) && (
        <g transform={`translate(0, ${isMulti ? -38 : -32})`} className="pointer-events-none">
          {/* Tooltip bubble */}
          <rect
            x={-Math.max(stateName.length * 4 + 20, 48)}
            y="-18"
            width={Math.max(stateName.length * 8 + 40, 96)}
            height="22"
            rx="6"
            fill="#0f172a"
            fillOpacity="0.95"
            stroke="#334155"
            strokeWidth="1"
          />
          {/* Small downward triangle arrow */}
          <polygon points="0,4 -4,-1 4,-1" fill="#0f172a" fillOpacity="0.95" />
          {/* Tooltip text */}
          <text
            x="0"
            y="-7"
            textAnchor="middle"
            fill="#ffffff"
            fontSize="9"
            fontWeight="700"
            fontFamily="system-ui, -apple-system, sans-serif"
          >
            {stateName} ({stateCode}): {count} {count === 1 ? 'member' : 'members'}
          </text>
        </g>
      )}
    </g>
  );
};
