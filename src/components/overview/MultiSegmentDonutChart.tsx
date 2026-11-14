import React from 'react';

/**
 * Renders a multi-segment SVG Donut/Pie Chart
 */
export const MultiSegmentDonutChart: React.FC<{
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
