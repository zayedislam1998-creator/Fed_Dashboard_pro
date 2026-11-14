import React from 'react';
import {
  CmhFormField,
  CmhFormCategory,
  COUNTRY_DIAL_CODES,
  COUNTRY_STATE_CITY_DIRECTORY,
} from '../../services/workspaceApi';
import {
  Globe,
  Lock,
  GripVertical,
  Columns,
  Square,
  ArrowUp,
  ArrowDown,
  Trash2,
} from 'lucide-react';

interface FieldCanvasProps {
  formTitle: string;
  formDescription: string;
  formCategory: CmhFormCategory;
  accessMode: 'PUBLIC' | 'PRIVATE';
  submitButtonLabel: string;
  fields: CmhFormField[];
  selectedField: CmhFormField | null;
  selectedFieldId: string | null;
  draggedFieldIndex: number | null;
  onFormTitleChange: (v: string) => void;
  onFormDescriptionChange: (v: string) => void;
  onFormCategoryChange: (v: CmhFormCategory) => void;
  onAccessModeChange: (v: 'PUBLIC' | 'PRIVATE') => void;
  onSubmitButtonLabelChange: (v: string) => void;
  onSelectField: (id: string | null) => void;
  onUpdateField: (id: string, patch: Partial<CmhFormField>) => void;
  onDeleteField: (id: string) => void;
  onMoveField: (index: number, direction: -1 | 1) => void;
  onDragStart: (index: number) => void;
  onDropOnCanvas: (targetIndex: number) => void;
}

export const FieldCanvas: React.FC<FieldCanvasProps> = ({
  formTitle,
  formDescription,
  formCategory,
  accessMode,
  submitButtonLabel,
  fields,
  selectedField,
  selectedFieldId,
  draggedFieldIndex,
  onFormTitleChange,
  onFormDescriptionChange,
  onFormCategoryChange,
  onAccessModeChange,
  onSubmitButtonLabelChange,
  onSelectField,
  onUpdateField,
  onDeleteField,
  onMoveField,
  onDragStart,
  onDropOnCanvas,
}) => {
  return (
    <div className="col-span-5 bg-[#F8FAFC] border-r border-slate-200 overflow-y-auto p-5 space-y-4">
      {/* Form Metadata Header Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-2xs">
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-8">
            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
              Form Title *
            </label>
            <input
              type="text"
              value={formTitle}
              onChange={(e) => onFormTitleChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-600"
            />
          </div>
          <div className="col-span-4">
            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
              Form Type / Module
            </label>
            <select
              value={formCategory}
              onChange={(e) => onFormCategoryChange(e.target.value as CmhFormCategory)}
              className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:border-blue-600"
            >
              <option value="TASK">Task Form (CMH Tasks)</option>
              <option value="PROJECT">Project Form (CMH Projects)</option>
              <option value="REGISTRATION">Registration Form</option>
              <option value="LOGIN">Login Form</option>
              <option value="GENERAL">General Form</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
            Description / Instructions
          </label>
          <input
            type="text"
            value={formDescription}
            onChange={(e) => onFormDescriptionChange(e.target.value)}
            className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-700 focus:outline-none focus:border-blue-600"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
              Link Access Permission
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => onAccessModeChange('PUBLIC')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 ${
                  accessMode === 'PUBLIC'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                    : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                Public Link
              </button>
              <button
                type="button"
                onClick={() => onAccessModeChange('PRIVATE')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 ${
                  accessMode === 'PRIVATE'
                    ? 'bg-amber-50 text-amber-700 border-amber-300'
                    : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                Private Only
              </button>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
              Submit Button Text
            </label>
            <input
              type="text"
              value={submitButtonLabel}
              onChange={(e) => onSubmitButtonLabelChange(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-600"
            />
          </div>
        </div>
      </div>

      {/* Drag & Drop Canvas List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Drag & Drop Form Fields ({fields.length})
          </span>
          <span className="text-[11px] text-slate-400">
            Drag rows by handle or click to edit properties
          </span>
        </div>

        {fields.map((field, index) => {
          const isSelected = field.id === selectedFieldId;
          return (
            <div
              key={field.id}
              draggable
              onDragStart={() => onDragStart(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDropOnCanvas(index)}
              onClick={() => onSelectField(field.id)}
              className={`rounded-xl border p-3.5 bg-white transition-all cursor-pointer ${
                isSelected
                  ? 'border-blue-600 ring-2 ring-blue-500/15 shadow-xs'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <GripVertical className="w-4 h-4 text-slate-400 cursor-grab shrink-0" />
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold">
                    {field.type}
                  </span>
                  <span className="text-xs font-bold text-slate-900 truncate">
                    {field.label}
                  </span>
                  {field.required && (
                    <span className="text-[10px] font-bold text-rose-600">*Required</span>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateField(field.id, {
                        width: field.width === 'full' ? 'half' : 'full',
                      });
                    }}
                    title="Toggle 50% Half Width / 100% Full Width"
                    className="px-2 py-0.5 rounded border border-slate-200 text-[10px] font-semibold text-slate-600 hover:bg-slate-100 flex items-center gap-1"
                  >
                    {field.width === 'half' ? (
                      <>
                        <Columns className="w-3 h-3" /> 50%
                      </>
                    ) : (
                      <>
                        <Square className="w-3 h-3" /> 100%
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveField(index, -1);
                    }}
                    disabled={index === 0}
                    className="p-1 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-30"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveField(index, 1);
                    }}
                    disabled={index === fields.length - 1}
                    className="p-1 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-30"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteField(field.id);
                    }}
                    className="p-1 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Inline Editor when Selected */}
              {isSelected && selectedField && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="mt-3 pt-3 border-t border-slate-100 space-y-2.5"
                >
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                        Field Label
                      </label>
                      <input
                        type="text"
                        value={selectedField.label}
                        onChange={(e) =>
                          onUpdateField(selectedField.id, { label: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                        Placeholder / Hint
                      </label>
                      <input
                        type="text"
                        value={selectedField.placeholder || ''}
                        onChange={(e) =>
                          onUpdateField(selectedField.id, {
                            placeholder: e.target.value,
                          })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                      />
                    </div>
                  </div>

                  {/* Default Country Dial Code selector for PHONE_WITH_CODE */}
                  {selectedField.type === 'PHONE_WITH_CODE' && (
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                        Default Country Dial Code
                      </label>
                      <select
                        value={selectedField.defaultCountryCode || '+880'}
                        onChange={(e) =>
                          onUpdateField(selectedField.id, {
                            defaultCountryCode: e.target.value,
                          })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                      >
                        {COUNTRY_DIAL_CODES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.country}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Default Country selector for COUNTRY_STATE_CITY */}
                  {selectedField.type === 'COUNTRY_STATE_CITY' && (
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                        Default Selected Country
                      </label>
                      <select
                        value={selectedField.defaultCountry || 'Bangladesh'}
                        onChange={(e) =>
                          onUpdateField(selectedField.id, {
                            defaultCountry: e.target.value,
                          })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                      >
                        {Object.keys(COUNTRY_STATE_CITY_DIRECTORY).map((country) => (
                          <option key={country} value={country}>
                            {country}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Options editor for Dropdown, Single Choice, Multi Choice, Status, Priority */}
                  {(selectedField.type === 'DROPDOWN' ||
                    selectedField.type === 'SINGLE_CHOICE' ||
                    selectedField.type === 'MULTI_CHOICE' ||
                    selectedField.type === 'STATUS_SELECT' ||
                    selectedField.type === 'PRIORITY_SELECT') && (
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                        Options (comma-separated)
                      </label>
                      <input
                        type="text"
                        value={(selectedField.options || []).join(', ')}
                        onChange={(e) =>
                          onUpdateField(selectedField.id, {
                            options: e.target.value
                              .split(',')
                              .map((s) => s.trim())
                              .filter(Boolean),
                          })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedField.required}
                        onChange={(e) =>
                          onUpdateField(selectedField.id, {
                            required: e.target.checked,
                          })
                        }
                        className="w-3.5 h-3.5 rounded text-blue-600"
                      />
                      Required Field
                    </label>
                    <span className="text-[11px] text-slate-400">
                      Width: {selectedField.width === 'half' ? '50% Column' : '100% Full'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
