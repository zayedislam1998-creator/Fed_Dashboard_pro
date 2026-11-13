import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Check,
  Sparkles,
  Type,
  User,
  Mail,
  KeyRound,
  Phone,
  MapPin,
  AlignLeft,
  Hash,
  ListFilter,
  CheckSquare,
  Calendar,
  Clock,
  Upload,
  Star,
  Columns,
  Square,
  Loader2,
  Bookmark,
} from 'lucide-react';
import {
  CmhFormField,
  CmhFieldType,
  CmhFormTemplate,
  saveCmhFormTemplate,
} from '../services/workspaceApi';

export interface CmhFormFieldsEditorModalProps {
  isOpen: boolean;
  formTemplate?: CmhFormTemplate | null;
  template?: CmhFormTemplate | null;
  onClose: () => void;
  onSave?: (updated: CmhFormTemplate, fields: CmhFormField[]) => Promise<void> | void;
}

export const FIELD_DEFINITIONS: Array<{
  type: CmhFieldType;
  label: string;
  defaultLabel: string;
  placeholder?: string;
  defaultWidth: 'full' | 'half';
  defaultOptions?: string[];
  icon: React.ComponentType<{ className?: string }>;
  category: 'Identity & Contact' | 'Location' | 'Text & Data' | 'Choice & Status' | 'Media & Utility';
}> = [
  {
    type: 'FULL_NAME',
    label: 'Full Name',
    defaultLabel: 'Full Name',
    placeholder: 'Enter full name',
    defaultWidth: 'half',
    icon: User,
    category: 'Identity & Contact',
  },
  {
    type: 'EMAIL',
    label: 'Email Address',
    defaultLabel: 'Email Address',
    placeholder: 'name@company.com',
    defaultWidth: 'half',
    icon: Mail,
    category: 'Identity & Contact',
  },
  {
    type: 'PASSWORD',
    label: 'Password',
    defaultLabel: 'Password',
    placeholder: 'Enter password',
    defaultWidth: 'half',
    icon: KeyRound,
    category: 'Identity & Contact',
  },
  {
    type: 'PHONE_WITH_CODE',
    label: 'Phone (+ Country Code)',
    defaultLabel: 'Phone Number (with Country Code)',
    placeholder: '1700-000000',
    defaultWidth: 'half',
    icon: Phone,
    category: 'Identity & Contact',
  },
  {
    type: 'COUNTRY_STATE_CITY',
    label: 'Country, State & City',
    defaultLabel: 'Country, State / Region & City',
    defaultWidth: 'full',
    icon: MapPin,
    category: 'Location',
  },
  {
    type: 'ADDRESS',
    label: 'Street Address',
    defaultLabel: 'Street Address / Office Location',
    placeholder: 'House, Road, Area, Postal Code',
    defaultWidth: 'full',
    icon: MapPin,
    category: 'Location',
  },
  {
    type: 'SHORT_TEXT',
    label: 'Short Text',
    defaultLabel: 'Short Text Answer',
    placeholder: 'Type your answer...',
    defaultWidth: 'half',
    icon: Type,
    category: 'Text & Data',
  },
  {
    type: 'PARAGRAPH',
    label: 'Paragraph / Notes',
    defaultLabel: 'Detailed Description & Notes',
    placeholder: 'Write detailed explanation or notes...',
    defaultWidth: 'full',
    icon: AlignLeft,
    category: 'Text & Data',
  },
  {
    type: 'NUMBER',
    label: 'Number / Currency',
    defaultLabel: 'Amount / Budget / Quantity',
    placeholder: 'e.g. 5000',
    defaultWidth: 'half',
    icon: Hash,
    category: 'Text & Data',
  },
  {
    type: 'DROPDOWN',
    label: 'Dropdown Menu',
    defaultLabel: 'Select Option',
    defaultWidth: 'half',
    defaultOptions: ['Option A', 'Option B', 'Option C'],
    icon: ListFilter,
    category: 'Choice & Status',
  },
  {
    type: 'SINGLE_CHOICE',
    label: 'Radio (Single Choice)',
    defaultLabel: 'Choose One Option',
    defaultWidth: 'full',
    defaultOptions: ['Yes', 'No', 'Under Review'],
    icon: CheckSquare,
    category: 'Choice & Status',
  },
  {
    type: 'MULTI_CHOICE',
    label: 'Checkboxes (Multi-Choice)',
    defaultLabel: 'Select All That Apply',
    defaultWidth: 'full',
    defaultOptions: ['Requirements Verified', 'Testing Passed', 'Approved'],
    icon: CheckSquare,
    category: 'Choice & Status',
  },
  {
    type: 'STATUS_SELECT',
    label: 'Task / Project Status',
    defaultLabel: 'Current Status',
    defaultWidth: 'half',
    defaultOptions: ['To Do', 'In Progress', 'Review', 'Completed'],
    icon: Bookmark,
    category: 'Choice & Status',
  },
  {
    type: 'PRIORITY_SELECT',
    label: 'Priority Level',
    defaultLabel: 'Priority',
    defaultWidth: 'half',
    defaultOptions: ['Low', 'Medium', 'High', 'Critical'],
    icon: Bookmark,
    category: 'Choice & Status',
  },
  {
    type: 'DATE',
    label: 'Date Picker',
    defaultLabel: 'Due Date / Milestone Date',
    defaultWidth: 'half',
    icon: Calendar,
    category: 'Text & Data',
  },
  {
    type: 'TIME',
    label: 'Time Picker',
    defaultLabel: 'Scheduled Time',
    defaultWidth: 'half',
    icon: Clock,
    category: 'Text & Data',
  },
  {
    type: 'FILE_UPLOAD',
    label: 'File / Document Upload',
    defaultLabel: 'Attach Document or Image',
    defaultWidth: 'full',
    icon: Upload,
    category: 'Media & Utility',
  },
  {
    type: 'RATING',
    label: 'Star Rating (1–5)',
    defaultLabel: 'Performance Rating',
    defaultWidth: 'half',
    icon: Star,
    category: 'Media & Utility',
  },
  {
    type: 'TERMS_CHECKBOX',
    label: 'Terms & Conditions',
    defaultLabel: 'I agree to the Workspace Terms & Policies',
    defaultWidth: 'full',
    icon: CheckSquare,
    category: 'Media & Utility',
  },
  {
    type: 'PAGE_BREAK',
    label: 'Page / Step Break (Pagination)',
    defaultLabel: 'Next Step / Page Divider',
    defaultWidth: 'full',
    icon: Columns,
    category: 'Media & Utility',
  },
];

export const CmhFormFieldsEditorModal: React.FC<CmhFormFieldsEditorModalProps> = ({
  isOpen,
  formTemplate,
  template,
  onClose,
  onSave,
}) => {
  const activeTemplate = template || formTemplate;
  const [fields, setFields] = useState<CmhFormField[]>([]);
  const [formTitle, setFormTitle] = useState('');
  const [isFieldPickerOpen, setIsFieldPickerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    if (activeTemplate) {
      setFields(
        activeTemplate.fields && activeTemplate.fields.length > 0
          ? JSON.parse(JSON.stringify(activeTemplate.fields))
          : [
              {
                id: `fld-${Date.now()}-1`,
                label: 'Title / Subject',
                type: 'SHORT_TEXT',
                placeholder: 'Enter title...',
                required: true,
                width: 'full',
              },
            ]
      );
      setFormTitle(activeTemplate.title || 'Untitled Form Schema');
    }
  }, [activeTemplate, isOpen]);

  if (!isOpen || !activeTemplate) return null;

  const handleAddField = (def: (typeof FIELD_DEFINITIONS)[number]) => {
    const newField: CmhFormField = {
      id: `fld-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      label: def.defaultLabel,
      type: def.type,
      placeholder: def.placeholder,
      required: def.type === 'FULL_NAME' || def.type === 'EMAIL',
      width: def.defaultWidth,
      options: def.defaultOptions ? [...def.defaultOptions] : undefined,
      defaultCountryCode: def.type === 'PHONE_WITH_CODE' ? '+1' : undefined,
      defaultCountry: def.type === 'COUNTRY_STATE_CITY' ? 'United States' : undefined,
    };
    setFields((prev) => [...prev, newField]);
    setIsFieldPickerOpen(false);
  };

  const handleUpdateField = (id: string, patch: Partial<CmhFormField>) => {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  const handleDeleteField = (id: string) => {
    if (fields.length <= 1) {
      setToastMsg('A form must have at least one field.');
      setTimeout(() => setToastMsg(null), 3000);
      return;
    }
    setFields((prev) => prev.filter((f) => f.id !== id));
  };

  const handleMoveField = (index: number, direction: 'UP' | 'DOWN') => {
    const targetIdx = direction === 'UP' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= fields.length) return;
    const cloned = [...fields];
    const [moved] = cloned.splice(index, 1);
    cloned.splice(targetIdx, 0, moved);
    setFields(cloned);
  };

  const handleAddOption = (fieldId: string) => {
    setFields((prev) =>
      prev.map((f) => {
        if (f.id !== fieldId) return f;
        const currentOpts = f.options || [];
        return {
          ...f,
          options: [...currentOpts, `Option ${currentOpts.length + 1}`],
        };
      })
    );
  };

  const handleUpdateOption = (fieldId: string, optIndex: number, text: string) => {
    setFields((prev) =>
      prev.map((f) => {
        if (f.id !== fieldId) return f;
        const next = [...(f.options || [])];
        next[optIndex] = text;
        return { ...f, options: next };
      })
    );
  };

  const handleDeleteOption = (fieldId: string, optIndex: number) => {
    setFields((prev) =>
      prev.map((f) => {
        if (f.id !== fieldId) return f;
        const next = [...(f.options || [])];
        next.splice(optIndex, 1);
        return { ...f, options: next };
      })
    );
  };

  const handleSaveAndSync = async () => {
    setIsSaving(true);
    setToastMsg(null);
    try {
      const templateToSave: CmhFormTemplate = {
        ...activeTemplate,
        id: activeTemplate.id,
        title: formTitle.trim() || activeTemplate.title,
        description: activeTemplate.description,
        formCategory: activeTemplate.formCategory,
        accessMode: activeTemplate.accessMode,
        invitedMemberIds: activeTemplate.invitedMemberIds || [],
        invitedTeamIds: activeTemplate.invitedTeamIds || [],
        submitButtonLabel: activeTemplate.submitButtonLabel || 'Submit',
        confirmationMessage: activeTemplate.confirmationMessage,
        fields,
      };

      // 1. Save directly to the Form Template in the backend so it's permanently synced
      await saveCmhFormTemplate(templateToSave);

      // 2. Trigger parent callback
      await onSave?.(templateToSave, fields);

      setToastMsg('Form fields saved and synced across all modules!');
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      setToastMsg(err?.message || 'Failed to save form fields.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs">
      <div className="w-full max-w-4xl max-h-[92vh] flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-[#F8FAFD] dark:bg-slate-800/80 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#0B57D0] text-white flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                Customize Form Fields
              </h2>
              <p className="text-[11px] text-slate-500 truncate">
                Connected to: <span className="font-semibold text-blue-600">{activeTemplate.title}</span> ({activeTemplate.formCategory})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsFieldPickerOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-[#0B57D0] dark:text-blue-300 hover:bg-blue-100 border border-blue-200 dark:border-blue-800 text-xs font-bold transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Field</span>
            </button>

            <button
              type="button"
              onClick={handleSaveAndSync}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#0B57D0] hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Save & Sync Fields</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Toast */}
        {toastMsg && (
          <div className="px-5 py-2 bg-blue-50 dark:bg-blue-950/50 text-[#0B57D0] dark:text-blue-300 text-xs font-semibold border-b border-blue-100 dark:border-blue-900 flex items-center justify-between">
            <span>{toastMsg}</span>
            <button type="button" onClick={() => setToastMsg(null)}>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Field Picker Dropdown / Overlay */}
        {isFieldPickerOpen && (
          <div className="p-4 bg-slate-50 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700 max-h-64 overflow-y-auto shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Choose Field Type to Add ({FIELD_DEFINITIONS.length} Types)
              </span>
              <button
                type="button"
                onClick={() => setIsFieldPickerOpen(false)}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {FIELD_DEFINITIONS.map((def) => {
                const Icon = def.icon;
                return (
                  <button
                    key={def.type}
                    type="button"
                    onClick={() => handleAddField(def)}
                    className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 text-left transition-all flex items-center gap-2 group cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 group-hover:bg-[#0B57D0] group-hover:text-white text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0 transition-colors">
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {def.label}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">{def.category}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Canvas / Field List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 bg-[#F8FAFC] dark:bg-slate-950">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Form Schema Fields ({fields.length})
            </span>
            <span className="text-[11px] text-slate-400">
              Edit labels, placeholders, required flags, or reorder
            </span>
          </div>

          <div className="space-y-2.5">
            {fields.map((field, index) => {
              const def = FIELD_DEFINITIONS.find((d) => d.type === field.type);
              const isPageBreak = field.type === 'PAGE_BREAK';

              if (isPageBreak) {
                return (
                  <div
                    key={field.id}
                    className="p-3.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Columns className="w-4 h-4 text-purple-600 shrink-0" />
                      <span className="px-2 py-0.5 rounded bg-purple-200 text-purple-800 text-[10px] font-bold">
                        PAGE BREAK
                      </span>
                      <input
                        type="text"
                        value={field.label}
                        onChange={(e) => handleUpdateField(field.id, { label: e.target.value })}
                        placeholder="Page Title or Step Name..."
                        className="text-xs font-bold text-purple-900 dark:text-purple-200 bg-transparent border-b border-purple-300 dark:border-purple-700 focus:outline-none focus:border-purple-600"
                      />
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleMoveField(index, 'UP')}
                        disabled={index === 0}
                        className="p-1 rounded text-slate-500 hover:text-slate-800 disabled:opacity-30"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveField(index, 'DOWN')}
                        disabled={index === fields.length - 1}
                        className="p-1 rounded text-slate-500 hover:text-slate-800 disabled:opacity-30"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteField(field.id)}
                        className="p-1 rounded text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={field.id}
                  className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2.5 transition-all"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-bold flex items-center justify-center shrink-0">
                        {index + 1}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-[#0B57D0] dark:text-blue-300 text-[10px] font-bold shrink-0">
                        {field.type}
                      </span>
                      <input
                        type="text"
                        value={field.label}
                        onChange={(e) => handleUpdateField(field.id, { label: e.target.value })}
                        placeholder="Field Title / Label *"
                        className="text-xs font-bold text-slate-900 dark:text-slate-100 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-600 focus:outline-none min-w-[180px] sm:min-w-[240px]"
                      />
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Width toggle */}
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateField(field.id, {
                            width: field.width === 'half' ? 'full' : 'half',
                          })
                        }
                        className="px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-[10px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        {field.width === 'half' ? '50% Width' : '100% Width'}
                      </button>

                      {/* Required toggle */}
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateField(field.id, { required: !field.required })
                        }
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                          field.required
                            ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300'
                            : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {field.required ? '* Required' : 'Optional'}
                      </button>

                      {/* Reorder */}
                      <button
                        type="button"
                        onClick={() => handleMoveField(index, 'UP')}
                        disabled={index === 0}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-20"
                        title="Move Up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveField(index, 'DOWN')}
                        disabled={index === fields.length - 1}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-20"
                        title="Move Down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => handleDeleteField(field.id)}
                        className="p-1 rounded text-slate-400 hover:text-rose-600"
                        title="Delete Field"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Placeholder Input (if applicable) */}
                  {field.type !== 'PAGE_BREAK' &&
                    field.type !== 'TERMS_CHECKBOX' &&
                    field.type !== 'RATING' &&
                    field.type !== 'FILE_UPLOAD' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">
                            Placeholder Text
                          </label>
                          <input
                            type="text"
                            value={field.placeholder || ''}
                            onChange={(e) =>
                              handleUpdateField(field.id, { placeholder: e.target.value })
                            }
                            placeholder="Hint or guidance for respondent..."
                            className="w-full px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 focus:outline-none focus:border-blue-600"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">
                            Help / Guidance Subtext
                          </label>
                          <input
                            type="text"
                            value={field.helpText || ''}
                            onChange={(e) =>
                              handleUpdateField(field.id, { helpText: e.target.value })
                            }
                            placeholder="Optional instructions below input..."
                            className="w-full px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 focus:outline-none focus:border-blue-600"
                          />
                        </div>
                      </div>
                    )}

                  {/* Options Editor (Dropdown, Radio, Checkboxes, Status, Priority) */}
                  {(field.type === 'DROPDOWN' ||
                    field.type === 'SINGLE_CHOICE' ||
                    field.type === 'MULTI_CHOICE' ||
                    field.type === 'STATUS_SELECT' ||
                    field.type === 'PRIORITY_SELECT') && (
                    <div className="pt-1 space-y-1.5 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
                        <span>Selectable Options ({field.options?.length || 0})</span>
                        <button
                          type="button"
                          onClick={() => handleAddOption(field.id)}
                          className="text-blue-600 hover:underline flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add Option</span>
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {(field.options || []).map((opt, optIdx) => (
                          <div
                            key={optIdx}
                            className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                          >
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) =>
                                handleUpdateOption(field.id, optIdx, e.target.value)
                              }
                              className="bg-transparent font-medium text-slate-800 dark:text-slate-200 focus:outline-none max-w-[120px]"
                            />
                            {(field.options?.length || 0) > 1 && (
                              <button
                                type="button"
                                onClick={() => handleDeleteOption(field.id, optIdx)}
                                className="text-slate-400 hover:text-rose-600"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add Field Button at Bottom of Canvas */}
          <div className="pt-2 flex justify-center">
            <button
              type="button"
              onClick={() => setIsFieldPickerOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-full border border-dashed border-blue-400 bg-blue-50/60 dark:bg-blue-950/40 text-[#0B57D0] dark:text-blue-300 text-xs font-bold hover:bg-blue-100 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Another Form Field</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
