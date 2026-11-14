import React from 'react';
import { FIELD_PALETTE } from './types';

type FieldPaletteItemType = typeof FIELD_PALETTE[number];

interface FieldPaletteProps {
  onAddField: (item: FieldPaletteItemType) => void;
}

export const FieldPalette: React.FC<FieldPaletteProps> = ({ onAddField }) => {
  return (
    <div className="col-span-3 bg-white border-r border-slate-200 overflow-y-auto p-4 space-y-3">
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Add or Drag Fields ({FIELD_PALETTE.length} Types)
        </h2>
        <p className="text-[11px] text-slate-500 mt-0.5">
          Click any field block below to add it to your form canvas
        </p>
      </div>

      <div className="grid grid-cols-1 gap-1.5">
        {FIELD_PALETTE.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.type}
              type="button"
              onClick={() => onAddField(item)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 text-left flex items-center justify-between group transition-all"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-slate-100 group-hover:bg-blue-600 group-hover:text-white text-slate-600 flex items-center justify-center shrink-0 transition-colors">
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-semibold text-slate-800 truncate">
                  {item.label}
                </span>
              </div>
              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px] font-semibold shrink-0">
                {item.badge}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
