import React, { Suspense, lazy, useState } from 'react';
import {
  Eye,
  EyeOff,
  Star,
  Paperclip,
  Globe,
  Phone,
  Check,
  X,
  User,
  Mail,
  Lock,
  MapPin,
  Hash,
  Calendar,
  Clock,
  Type,
  AlignLeft,
} from 'lucide-react';
import {
  CmhFormField,
  COUNTRY_DIAL_CODES,
  COUNTRY_STATE_CITY_DIRECTORY,
} from '../../services/workspaceApi';
import { FileManagerPickerModal } from '../filemanager/FileManagerPickerModal';
import {
  UniversalDocumentEngineModal,
  UniversalEngineTarget,
} from '../shared/UniversalDocumentEngineModal';
import type { ImageEditorTarget } from '../shared/ImageEditorModal';

const ImageEditorModal = lazy(() =>
  import('../shared/ImageEditorModal').then((m) => ({ default: m.ImageEditorModal }))
);

function isImageUrl(url: string): boolean {
  return /\.(png|jpe?g|webp|gif|bmp|svg|avif)(\?.*)?$/i.test(url) || url.startsWith('data:image/');
}

interface CmhDynamicFieldsRendererProps {
  fields: CmhFormField[];
  values: Record<string, any>;
  onChange: (fieldId: string, val: any) => void;
  readOnly?: boolean;
}

export const CmhDynamicFieldsRenderer: React.FC<CmhDynamicFieldsRendererProps> = ({
  fields,
  values,
  onChange,
  readOnly = false,
}) => {
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [activeFileFieldId, setActiveFileFieldId] = useState<string | null>(null);
  const [engineTarget, setEngineTarget] = useState<UniversalEngineTarget | null>(null);
  const [editingImageField, setEditingImageField] = useState<{ fieldId: string; target: ImageEditorTarget } | null>(null);

  const togglePasswordVisibility = (fieldId: string) => {
    setVisiblePasswords((prev) => ({ ...prev, [fieldId]: !prev[fieldId] }));
  };

  if (fields.length === 0) {
    return (
      <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50/50">
        No custom fields added to this template yet.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {fields.map((field) => {
        const rawVal = values[field.id];
        const colSpanClass = field.width === 'half' ? 'md:col-span-1' : 'md:col-span-2';

        const parsePhoneValue = (val: any) => {
          const defaultCode = field.defaultCountryCode || '+880';
          if (!val || typeof val !== 'string') {
            return { code: defaultCode, number: '' };
          }
          const matchedCode = COUNTRY_DIAL_CODES.find((c) => val.startsWith(c.code));
          if (matchedCode) {
            return {
              code: matchedCode.code,
              number: val.slice(matchedCode.code.length).trim(),
            };
          }
          return { code: defaultCode, number: val };
        };

        const parseLocationValue = (val: any) => {
          const defaultCountry = field.defaultCountry || 'Bangladesh';
          const defaultStates = Object.keys(
            COUNTRY_STATE_CITY_DIRECTORY[defaultCountry] || {}
          );
          const defaultState = defaultStates[0] || '';
          const defaultCities =
            COUNTRY_STATE_CITY_DIRECTORY[defaultCountry]?.[defaultState] || [];
          const defaultCity = defaultCities[0] || '';

          if (!val || typeof val !== 'string') {
            return {
              country: defaultCountry,
              state: defaultState,
              city: defaultCity,
            };
          }
          const parts = val.split('Â·').map((p) => p.trim());
          return {
            country: parts[0] || defaultCountry,
            state: parts[1] || defaultState,
            city: parts[2] || defaultCity,
          };
        };

        return (
          <div
            key={field.id}
            className={`${colSpanClass} p-3.5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80 space-y-2 transition-all focus-within:bg-white focus-within:border-blue-300 focus-within:shadow-xs`}
          >
            {field.type !== 'TERMS_CHECKBOX' && (
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <span>{field.label}</span>
                  {field.required && (
                    <span className="px-1.5 py-0.2 rounded bg-rose-50 text-rose-600 text-[10px] font-bold">
                      Required
                    </span>
                  )}
                </label>
              </div>
            )}

            {field.helpText && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                {field.helpText}
              </p>
            )}

            {/* 1. SHORT_TEXT / FULL_NAME / ADDRESS */}
            {(field.type === 'SHORT_TEXT' ||
              field.type === 'FULL_NAME' ||
              field.type === 'ADDRESS') && (
              <div className="relative">
                {field.type === 'FULL_NAME' ? (
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                ) : field.type === 'ADDRESS' ? (
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                ) : (
                  <Type className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                )}
                <input
                  type="text"
                  disabled={readOnly}
                  required={field.required}
                  value={rawVal || ''}
                  onChange={(e) => onChange(field.id, e.target.value)}
                  placeholder={
                    field.placeholder ||
                    (field.type === 'FULL_NAME'
                      ? 'Enter full name...'
                      : field.type === 'ADDRESS'
                      ? 'Street address, suite, or building...'
                      : 'Enter value...')
                  }
                  className="w-full !pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                />
              </div>
            )}

            {/* 2. EMAIL */}
            {field.type === 'EMAIL' && (
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="email"
                  disabled={readOnly}
                  required={field.required}
                  value={rawVal || ''}
                  onChange={(e) => onChange(field.id, e.target.value)}
                  placeholder={field.placeholder || 'name@domain.com'}
                  className="w-full !pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                />
              </div>
            )}

            {/* 3. PASSWORD */}
            {field.type === 'PASSWORD' && (
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={visiblePasswords[field.id] ? 'text' : 'password'}
                  disabled={readOnly}
                  required={field.required}
                  value={rawVal || ''}
                  onChange={(e) => onChange(field.id, e.target.value)}
                  placeholder={field.placeholder || 'Enter password...'}
                  className="w-full !pl-10 pr-10 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility(field.id)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {visiblePasswords[field.id] ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            )}

            {/* 4. PHONE_WITH_CODE */}
            {field.type === 'PHONE_WITH_CODE' && (() => {
              const parsedPhone = parsePhoneValue(rawVal);
              return (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="relative sm:w-44 shrink-0">
                    <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <select
                      disabled={readOnly}
                      value={parsedPhone.code}
                      onChange={(e) => {
                        const newCode = e.target.value;
                        onChange(
                          field.id,
                          `${newCode} ${parsedPhone.number}`.trim()
                        );
                      }}
                      className="w-full !pl-8 pr-7 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    >
                      {COUNTRY_DIAL_CODES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.country}
                        </option>
                      ))}
                    </select>
                  </div>
                  <input
                    type="tel"
                    disabled={readOnly}
                    required={field.required}
                    value={parsedPhone.number}
                    onChange={(e) => {
                      onChange(
                        field.id,
                        `${parsedPhone.code} ${e.target.value}`.trim()
                      );
                    }}
                    placeholder={field.placeholder || '1700-000000'}
                    className="flex-1 px-3.5 py-2.5 text-sm font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  />
                </div>
              );
            })()}

            {/* 5. COUNTRY_STATE_CITY */}
            {field.type === 'COUNTRY_STATE_CITY' && (() => {
              const loc = parseLocationValue(rawVal);
              const countries = Object.keys(COUNTRY_STATE_CITY_DIRECTORY);
              const statesObj =
                COUNTRY_STATE_CITY_DIRECTORY[loc.country] ||
                COUNTRY_STATE_CITY_DIRECTORY.Bangladesh;
              const states = Object.keys(statesObj);
              const activeState = states.includes(loc.state) ? loc.state : states[0] || '';
              const cities = statesObj[activeState] || [];

              return (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700">
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                      <Globe className="w-3 h-3 text-[#0B57D0]" />
                      <span>Country</span>
                    </span>
                    <select
                      disabled={readOnly}
                      value={loc.country}
                      onChange={(e) => {
                        const nextCountry = e.target.value;
                        const nextStates = Object.keys(
                          COUNTRY_STATE_CITY_DIRECTORY[nextCountry] || {}
                        );
                        const nextState = nextStates[0] || '';
                        const nextCity =
                          COUNTRY_STATE_CITY_DIRECTORY[nextCountry]?.[nextState]?.[0] || '';
                        onChange(field.id, `${nextCountry} Â· ${nextState} Â· ${nextCity}`);
                      }}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                    >
                      {countries.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      State / Division
                    </span>
                    <select
                      disabled={readOnly}
                      value={activeState}
                      onChange={(e) => {
                        const nextState = e.target.value;
                        const nextCity = statesObj[nextState]?.[0] || '';
                        onChange(field.id, `${loc.country} Â· ${nextState} Â· ${nextCity}`);
                      }}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                    >
                      {states.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      City / District
                    </span>
                    <select
                      disabled={readOnly}
                      value={cities.includes(loc.city) ? loc.city : cities[0] || ''}
                      onChange={(e) => {
                        onChange(field.id, `${loc.country} Â· ${activeState} Â· ${e.target.value}`);
                      }}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                    >
                      {cities.map((ct) => (
                        <option key={ct} value={ct}>
                          {ct}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })()}

            {/* 6. PARAGRAPH */}
            {field.type === 'PARAGRAPH' && (
              <div className="relative">
                <AlignLeft className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
                <textarea
                  rows={3}
                  disabled={readOnly}
                  required={field.required}
                  value={rawVal || ''}
                  onChange={(e) => onChange(field.id, e.target.value)}
                  placeholder={field.placeholder || 'Write detailed notes...'}
                  className="w-full !pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 resize-y"
                />
              </div>
            )}

            {/* 7. NUMBER */}
            {field.type === 'NUMBER' && (
              <div className="relative">
                <Hash className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="number"
                  disabled={readOnly}
                  required={field.required}
                  value={rawVal || ''}
                  onChange={(e) => onChange(field.id, e.target.value)}
                  placeholder={field.placeholder || '0'}
                  className="w-full !pl-10 pr-3.5 py-2.5 text-sm font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                />
              </div>
            )}

            {/* 8. DROPDOWN / STATUS_SELECT / PRIORITY_SELECT */}
            {(field.type === 'DROPDOWN' ||
              field.type === 'STATUS_SELECT' ||
              field.type === 'PRIORITY_SELECT') && (() => {
              const opts =
                field.options && field.options.length > 0
                  ? field.options
                  : field.type === 'STATUS_SELECT'
                  ? ['To Do', 'In Progress', 'Review', 'Completed']
                  : field.type === 'PRIORITY_SELECT'
                  ? ['Low', 'Medium', 'High', 'Critical']
                  : ['Option 1', 'Option 2'];

              if (opts.length <= 5) {
                return (
                  <div className="flex flex-wrap gap-2 pt-0.5">
                    {opts.map((opt) => {
                      const active = rawVal === opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          disabled={readOnly}
                          onClick={() => onChange(field.id, opt)}
                          className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                            active
                              ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {active && <Check className="w-3.5 h-3.5" />}
                          <span>{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              }

              return (
                <select
                  disabled={readOnly}
                  required={field.required}
                  value={rawVal || ''}
                  onChange={(e) => onChange(field.id, e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                >
                  <option value="">Select {field.label}...</option>
                  {opts.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              );
            })()}

            {/* 9. SINGLE_CHOICE (Interactive Pill Cards) */}
            {field.type === 'SINGLE_CHOICE' && (
              <div className="flex flex-wrap gap-2 pt-1">
                {(field.options || ['Option A', 'Option B']).map((opt) => {
                  const selected = rawVal === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      disabled={readOnly}
                      onClick={() => onChange(field.id, opt)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-2 ${
                        selected
                          ? 'bg-blue-50 text-blue-700 border-blue-500 ring-2 ring-blue-500/15'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span
                        className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                          selected ? 'border-blue-600 bg-blue-600' : 'border-slate-300'
                        }`}
                      >
                        {selected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </span>
                      <span>{opt}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* 10. MULTI_CHOICE (Interactive Checkbox Chips) */}
            {field.type === 'MULTI_CHOICE' && (
              <div className="flex flex-wrap gap-2 pt-1">
                {(field.options || ['Item 1', 'Item 2']).map((opt) => {
                  const arr: string[] = Array.isArray(rawVal) ? rawVal : [];
                  const isChecked = arr.includes(opt);
                  return (
                    <button
                      key={opt}
                      type="button"
                      disabled={readOnly}
                      onClick={() => {
                        const next = isChecked
                          ? arr.filter((x) => x !== opt)
                          : [...arr, opt];
                        onChange(field.id, next);
                      }}
                      className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-2 ${
                        isChecked
                          ? 'bg-blue-50 text-blue-700 border-blue-500 ring-2 ring-blue-500/15'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded-md border flex items-center justify-center ${
                          isChecked ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'
                        }`}
                      >
                        {isChecked && <Check className="w-3 h-3" />}
                      </span>
                      <span>{opt}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* 11. DATE & TIME */}
            {field.type === 'DATE' && (
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="date"
                  disabled={readOnly}
                  required={field.required}
                  value={rawVal || ''}
                  onChange={(e) => onChange(field.id, e.target.value)}
                  className="w-full !pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                />
              </div>
            )}

            {field.type === 'TIME' && (
              <div className="relative">
                <Clock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="time"
                  disabled={readOnly}
                  required={field.required}
                  value={rawVal || ''}
                  onChange={(e) => onChange(field.id, e.target.value)}
                  className="w-full !pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                />
              </div>
            )}

            {/* 12. FILE_UPLOAD */}
            {field.type === 'FILE_UPLOAD' && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900">
                {rawVal ? (
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <Paperclip className="w-4 h-4 text-[#0B57D0] shrink-0" />
                    <a
                      href={rawVal}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-[#0B57D0] hover:underline truncate max-w-[220px]"
                    >
                      {rawVal}
                    </a>
                    <button
                      type="button"
                      onClick={() =>
                        setEngineTarget({
                          title: String(rawVal).split('/').pop() || field.label,
                          url: String(rawVal),
                          initialMode: 'VIEW',
                        })
                      }
                      className="px-2 py-0.5 rounded-lg bg-blue-50 text-[#0B57D0] text-[10px] font-bold cursor-pointer"
                    >
                      Open Engine
                    </button>
                    {!readOnly && isImageUrl(String(rawVal)) && (
                      <button
                        type="button"
                        onClick={() =>
                          setEditingImageField({
                            fieldId: field.id,
                            target: {
                              title: field.label,
                              imageUrl: String(rawVal),
                            },
                          })
                        }
                        className="px-2 py-0.5 rounded-lg bg-purple-50 text-purple-700 text-[10px] font-bold cursor-pointer"
                      >
                        Edit Image
                      </button>
                    )}
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => onChange(field.id, '')}
                        className="p-1 text-slate-400 hover:text-red-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-slate-500">
                    Attach photo, PDF, or document from Server File Manager
                  </span>
                )}
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => setActiveFileFieldId(field.id)}
                    className="px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-xs font-bold text-[#0B57D0] whitespace-nowrap shrink-0"
                  >
                    + Choose / Upload File
                  </button>
                )}
              </div>
            )}

            {/* 13. RATING */}
            {field.type === 'RATING' && (
              <div className="flex items-center gap-2 pt-1">
                {[1, 2, 3, 4, 5].map((num) => {
                  const active = Number(rawVal || 0) >= num;
                  return (
                    <button
                      key={num}
                      type="button"
                      disabled={readOnly}
                      onClick={() => onChange(field.id, String(num))}
                      className={`p-2 rounded-xl border transition-all ${
                        active
                          ? 'bg-amber-50 border-amber-300 text-amber-500'
                          : 'bg-white border-slate-200 text-slate-300'
                      }`}
                    >
                      <Star className={`w-5 h-5 ${active ? 'fill-amber-400' : ''}`} />
                    </button>
                  );
                })}
              </div>
            )}

            {/* 14. TERMS_CHECKBOX */}
            {field.type === 'TERMS_CHECKBOX' && (
              <label className="flex items-center gap-3 p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={readOnly}
                  required={field.required}
                  checked={Boolean(rawVal)}
                  onChange={(e) => onChange(field.id, e.target.checked ? 'Accepted' : '')}
                  className="w-4 h-4 rounded text-[#0B57D0]"
                />
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </span>
                {rawVal && <Check className="w-4 h-4 text-emerald-600 ml-auto shrink-0" />}
              </label>
            )}
          </div>
        );
      })}

      <FileManagerPickerModal
        isOpen={Boolean(activeFileFieldId)}
        onClose={() => setActiveFileFieldId(null)}
        title="Select or Auto-Compress File for Form Field"
        onSelectFile={(file) => {
          if (activeFileFieldId) {
            onChange(activeFileFieldId, `${window.location.origin}${file.url}`);
          }
          setActiveFileFieldId(null);
        }}
      />

      <UniversalDocumentEngineModal
        isOpen={Boolean(engineTarget)}
        target={engineTarget}
        onClose={() => setEngineTarget(null)}
      />

      {editingImageField && (
        <Suspense fallback={null}>
          <ImageEditorModal
            isOpen={Boolean(editingImageField)}
            target={editingImageField.target}
            onClose={() => setEditingImageField(null)}
            onSaved={(res) => {
              const nextUrl = res.file?.url ? `${window.location.origin}${res.file.url}` : res.dataUrl;
              onChange(editingImageField.fieldId, nextUrl);
              setEditingImageField(null);
            }}
          />
        </Suspense>
      )}
    </div>
  );
};



