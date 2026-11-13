import React, { useState, useEffect } from 'react';
import {
  ClipboardList,
  Plus,
  Trash2,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  Loader2,
  MoreVertical,
  Globe,
  Lock,
  Users,
  Eye,
  Edit3,
  Download,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  Sparkles,
  User,
  Mail,
  Calendar,
  Search,
} from 'lucide-react';
import {
  FormFieldType,
  WorkspaceFormField,
  WorkspaceFormItem,
  WorkspaceFormSubmission,
  fetchWorkspaceForms,
  saveWorkspaceForm,
  updateWorkspaceFormSettings,
  deleteWorkspaceForm,
  createGoogleForm,
  GoogleFormQuestion,
} from '../services/workspaceApi';
import { ConfirmModal } from './ConfirmModal';
import { convertViaEngine } from '../services/engineCache';

export type FormsSubTab = 'all_forms' | 'create_form';

interface FormsViewProps {
  isAuthenticated: boolean;
  onRequireAuth: () => void;
  onPreviewPublicForm?: (formId: string) => void;
  activeSubTab?: FormsSubTab;
  onSelectSubTab?: (tab: FormsSubTab) => void;
}

const FIELD_TYPE_META: Array<{ type: FormFieldType; label: string; hasOptions?: boolean }> = [
  { type: 'SHORT_TEXT', label: 'Short Text' },
  { type: 'PARAGRAPH', label: 'Paragraph' },
  { type: 'EMAIL', label: 'Email Address' },
  { type: 'PHONE', label: 'Phone Number' },
  { type: 'NUMBER', label: 'Number' },
  { type: 'SINGLE_CHOICE', label: 'Multiple Choice (Single)', hasOptions: true },
  { type: 'MULTI_CHOICE', label: 'Checkboxes (Multi-Select)', hasOptions: true },
  { type: 'DROPDOWN', label: 'Dropdown Menu', hasOptions: true },
  { type: 'YES_NO', label: 'Yes / No' },
  { type: 'RATING', label: 'Star Rating (1–5)' },
  { type: 'LINEAR_SCALE', label: 'Linear Scale (1–10)' },
  { type: 'DATE', label: 'Date' },
  { type: 'TIME', label: 'Time' },
  { type: 'URL', label: 'Website URL' },
];

const ACCENT_COLORS = [
  '#673AB7',
  '#0B57D0',
  '#00897B',
  '#E11D48',
  '#D97706',
  '#16A34A',
  '#334155',
];

export const FormsView: React.FC<FormsViewProps> = ({
  isAuthenticated,
  onRequireAuth,
  onPreviewPublicForm,
  activeSubTab = 'all_forms',
  onSelectSubTab,
}) => {
  // Primary Two-Tab Navigation: 'all_forms' (Tab 1) | 'create_form' (Tab 2)
  const [internalTab, setInternalTab] = useState<FormsSubTab>(activeSubTab);
  const activeTab = onSelectSubTab ? activeSubTab : internalTab;
  const setActiveTab = (tab: FormsSubTab) => {
    setInternalTab(tab);
    onSelectSubTab?.(tab);
  };

  // All Forms State
  const [forms, setForms] = useState<WorkspaceFormItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [openMenuFormId, setOpenMenuFormId] = useState<string | null>(null);

  // Selected Form for Submissions Inspector (Inside Tab 1)
  const [inspectingFormId, setInspectingFormId] = useState<string | null>(null);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [submissionSearch, setSubmissionSearch] = useState<string>('');

  // Tab 2: Create / Edit Form Builder State
  const [editingFormId, setEditingFormId] = useState<string | null>(null);
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [accentColor, setAccentColor] = useState<string>('#673AB7');
  const [isPublic, setIsPublic] = useState<boolean>(true);
  const [identityMode, setIdentityMode] = useState<'OPTIONAL' | 'REQUIRED' | 'ANONYMOUS'>(
    'OPTIONAL'
  );
  const [targetSubmissions, setTargetSubmissions] = useState<number>(50);
  const [autoCloseOnTarget, setAutoCloseOnTarget] = useState<boolean>(false);
  const [confirmationMessage, setConfirmationMessage] = useState<string>(
    'Your response has been recorded. Thank you!'
  );
  const [fields, setFields] = useState<WorkspaceFormField[]>([
    {
      id: 'field-1',
      label: 'Project Overview or Feedback',
      type: 'PARAGRAPH',
      placeholder: 'Enter details here...',
      required: true,
    },
    {
      id: 'field-2',
      label: 'Which service are you interested in?',
      type: 'SINGLE_CHOICE',
      options: ['Web Development', 'Cloud & Server Setup', 'Custom Software', 'Other'],
      required: true,
    },
  ]);

  const [saving, setSaving] = useState<boolean>(false);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Optional Google Forms API Sync Confirmation
  const [syncGoogleConfirmForm, setSyncGoogleConfirmForm] = useState<WorkspaceFormItem | null>(
    null
  );
  const [syncingGoogle, setSyncingGoogle] = useState<boolean>(false);

  const loadForms = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const list = await fetchWorkspaceForms();
      setForms(list);
    } catch (err: any) {
      setStatusBanner({
        type: 'error',
        message: err?.message || 'Failed to load forms list.',
      });
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadForms();
  }, []);

  const getPublicShareUrl = (formId: string) => {
    return `${window.location.origin}/?form=${encodeURIComponent(formId)}`;
  };

  const handleCopyLink = (formId: string) => {
    const link = getPublicShareUrl(formId);
    navigator.clipboard.writeText(link);
    setCopiedId(formId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleStartNewForm = () => {
    setEditingFormId(null);
    setTitle('');
    setDescription('');
    setAccentColor('#673AB7');
    setIsPublic(true);
    setIdentityMode('OPTIONAL');
    setTargetSubmissions(50);
    setAutoCloseOnTarget(false);
    setConfirmationMessage('Your response has been recorded. Thank you!');
    setFields([
      {
        id: `f-${Date.now()}-1`,
        label: 'Organization or Project Name',
        type: 'SHORT_TEXT',
        placeholder: 'Short answer...',
        required: true,
      },
      {
        id: `f-${Date.now()}-2`,
        label: 'Select your preferred package',
        type: 'SINGLE_CHOICE',
        options: ['Standard', 'Professional', 'Enterprise'],
        required: true,
      },
    ]);
    setInspectingFormId(null);
    setActiveTab('create_form');
  };

  const handleEditForm = (form: WorkspaceFormItem) => {
    setEditingFormId(form.id);
    setTitle(form.title);
    setDescription(form.description);
    setAccentColor(form.accentColor || '#673AB7');
    setIsPublic(form.isPublic);
    setIdentityMode(form.identityMode || 'OPTIONAL');
    setTargetSubmissions(form.targetSubmissions || 50);
    setAutoCloseOnTarget(Boolean(form.autoCloseOnTarget));
    setConfirmationMessage(
      form.confirmationMessage || 'Your response has been recorded. Thank you!'
    );
    setFields(
      form.fields.map((f) => ({
        ...f,
        options: f.options ? [...f.options] : undefined,
      }))
    );
    setOpenMenuFormId(null);
    setInspectingFormId(null);
    setActiveTab('create_form');
  };

  const handleTogglePublic = async (form: WorkspaceFormItem) => {
    try {
      const updated = await updateWorkspaceFormSettings(form.id, {
        isPublic: !form.isPublic,
      });
      setForms(updated.forms);
      setStatusBanner({
        type: 'success',
        message: !form.isPublic
          ? `"${form.title}" link is now Public and open to everyone.`
          : `"${form.title}" link is now Private.`,
      });
    } catch (err: any) {
      setStatusBanner({
        type: 'error',
        message: err?.message || 'Failed to update form access settings.',
      });
    } finally {
      setOpenMenuFormId(null);
    }
  };

  const handleUpdateTargetInline = async (form: WorkspaceFormItem, newTarget: number) => {
    if (Number.isNaN(newTarget) || newTarget < 0) return;
    try {
      const updated = await updateWorkspaceFormSettings(form.id, {
        targetSubmissions: newTarget,
      });
      setForms(updated.forms);
    } catch {
      // ignore inline error
    }
  };

  const handleDeleteForm = async (form: WorkspaceFormItem) => {
    setOpenMenuFormId(null);
    try {
      const remaining = await deleteWorkspaceForm(form.id);
      setForms(remaining);
      if (inspectingFormId === form.id) {
        setInspectingFormId(null);
      }
      setStatusBanner({
        type: 'success',
        message: `"${form.title}" has been deleted.`,
      });
    } catch (err: any) {
      setStatusBanner({
        type: 'error',
        message: err?.message || 'Failed to delete form.',
      });
    }
  };

  const handleAddField = (presetType: FormFieldType = 'SHORT_TEXT', presetLabel = '') => {
    const hasOpts =
      presetType === 'SINGLE_CHOICE' ||
      presetType === 'MULTI_CHOICE' ||
      presetType === 'DROPDOWN';
    setFields((prev) => [
      ...prev,
      {
        id: `field-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        label: presetLabel || `Question ${prev.length + 1}`,
        type: presetType,
        options: hasOpts ? ['Option 1', 'Option 2'] : undefined,
        required: false,
        scaleMax: presetType === 'RATING' ? 5 : presetType === 'LINEAR_SCALE' ? 10 : undefined,
      },
    ]);
  };

  const handleUpdateField = (idx: number, patch: Partial<WorkspaceFormField>) => {
    setFields((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        const updated = { ...item, ...patch };
        if (
          (updated.type === 'SINGLE_CHOICE' ||
            updated.type === 'MULTI_CHOICE' ||
            updated.type === 'DROPDOWN') &&
          (!updated.options || updated.options.length === 0)
        ) {
          updated.options = ['Option 1', 'Option 2'];
        }
        return updated;
      })
    );
  };

  const handleMoveField = (idx: number, direction: -1 | 1) => {
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= fields.length) return;
    setFields((prev) => {
      const copy = [...prev];
      const temp = copy[idx];
      copy[idx] = copy[targetIdx];
      copy[targetIdx] = temp;
      return copy;
    });
  };

  const handleDuplicateField = (idx: number) => {
    const source = fields[idx];
    const cloned: WorkspaceFormField = {
      ...source,
      id: `field-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      label: `${source.label} (Copy)`,
      options: source.options ? [...source.options] : undefined,
    };
    setFields((prev) => [...prev.slice(0, idx + 1), cloned, ...prev.slice(idx + 1)]);
  };

  const handleRemoveField = (idx: number) => {
    if (fields.length <= 1) return;
    setFields((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setStatusBanner({
        type: 'error',
        message: 'Please enter a form title.',
      });
      return;
    }

    setSaving(true);
    setStatusBanner(null);
    try {
      const res = await saveWorkspaceForm({
        id: editingFormId || undefined,
        title: title.trim(),
        description: description.trim(),
        accentColor,
        isPublic,
        identityMode,
        targetSubmissions: Number(targetSubmissions) || 0,
        autoCloseOnTarget,
        confirmationMessage: confirmationMessage.trim(),
        fields,
      });
      setForms(res.forms);
      setEditingFormId(null);
      setActiveTab('all_forms');
      setStatusBanner({
        type: 'success',
        message: `"${res.form.title}" saved and shareable link generated.`,
      });
    } catch (err: any) {
      setStatusBanner({
        type: 'error',
        message: err?.message || 'Failed to save form.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleExportCsv = (form: WorkspaceFormItem) => {
    if (form.submissions.length === 0) return;
    const headers = [
      'Submission ID',
      'Respondent Name',
      'Respondent Email / Contact',
      'Submitted At',
      ...form.fields.map((f) => f.label),
    ];

    const escapeCsv = (val: string) => `"${String(val ?? '').replace(/"/g, '""')}"`;

    const rows = form.submissions.map((sub) => {
      const fieldCells = form.fields.map((f) => {
        const raw = sub.answers[f.id];
        return Array.isArray(raw) ? raw.join('; ') : String(raw ?? '');
      });
      return [
        sub.id,
        sub.respondentName,
        sub.respondentEmail,
        sub.submittedAt,
        ...fieldCells,
      ]
        .map(escapeCsv)
        .join(',');
    });

    const csvContent = '\uFEFF' + [headers.map(escapeCsv).join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${form.title.replace(/\s+/g, '_')}_submissions.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const executeGoogleFormSync = async () => {
    if (!syncGoogleConfirmForm) return;
    const targetForm = syncGoogleConfirmForm;
    setSyncGoogleConfirmForm(null);

    if (!isAuthenticated) {
      onRequireAuth();
      return;
    }

    setSyncingGoogle(true);
    setStatusBanner(null);
    try {
      const googleQuestions: GoogleFormQuestion[] = targetForm.fields.map((f) => ({
        title: f.label,
        description: f.description,
        type:
          f.type === 'SINGLE_CHOICE' || f.type === 'MULTI_CHOICE' || f.type === 'DROPDOWN'
            ? 'CHOICE'
            : f.type === 'PARAGRAPH'
            ? 'PARAGRAPH'
            : 'TEXT',
        options: f.options,
        required: f.required,
      }));

      const createdGoogle = await createGoogleForm(
        targetForm.title,
        targetForm.description,
        googleQuestions
      );

      const saved = await saveWorkspaceForm({
        ...targetForm,
        googleFormUri: createdGoogle.responderUri,
      });
      setForms(saved.forms);
      setStatusBanner({
        type: 'success',
        message: 'Form synced to your Google Forms account.',
      });
    } catch (err: any) {
      if (err?.message === 'AUTH_REQUIRED') {
        onRequireAuth();
      } else {
        setStatusBanner({
          type: 'error',
          message: err?.message || 'Failed to sync to Google Forms.',
        });
      }
    } finally {
      setSyncingGoogle(false);
    }
  };

  const inspectingForm = forms.find((f) => f.id === inspectingFormId) || null;
  const filteredForms = forms.filter((f) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return f.title.toLowerCase().includes(q) || f.description.toLowerCase().includes(q);
  });

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900 rounded-none md:rounded-2xl border-0 md:border border-slate-200/90 dark:border-slate-800 shadow-xs overflow-hidden">
      {/* Top Bar with Primary Tabs: All Forms & Add New Form */}
      <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-[#F8FAFD] dark:bg-slate-900/90 shrink-0">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setActiveTab('all_forms');
              setInspectingFormId(null);
            }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeTab === 'all_forms'
                ? 'bg-[#673AB7] text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            <span>All Forms ({forms.length})</span>
          </button>

          <button
            type="button"
            onClick={handleStartNewForm}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeTab === 'create_form'
                ? 'bg-[#673AB7] text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{editingFormId && activeTab === 'create_form' ? 'Edit Form' : 'Add New Form'}</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'all_forms' && !inspectingForm && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search forms..."
                className="pl-8 pr-3 py-1.5 text-xs rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#673AB7]"
              />
            </div>
          )}

          <button
            type="button"
            onClick={() => loadForms(false)}
            disabled={loading || syncingGoogle}
            className="p-2 rounded-full text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
            title="Refresh forms"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Status Notification Bar */}
      {statusBanner && (
        <div
          className={`px-4 py-2 border-b text-xs flex items-center justify-between shrink-0 ${
            statusBanner.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 text-emerald-800 dark:text-emerald-200'
              : 'bg-red-50 dark:bg-red-950/50 border-red-200 text-red-700 dark:text-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusBanner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{statusBanner.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="text-[11px] font-semibold underline ml-3"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* =====================================================================
          TAB 1: ALL FORMS LIST OR SUBMISSIONS INSPECTOR
      ===================================================================== */}
      {activeTab === 'all_forms' && (
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {inspectingForm ? (
            /* SUBMISSIONS & ANALYTICS INSPECTOR VIEW */
            <div className="max-w-5xl mx-auto space-y-5">
              {/* Top bar to return to All Forms */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setInspectingFormId(null);
                      setSelectedSubmissionId(null);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Forms</span>
                  </button>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      {inspectingForm.title}
                    </h2>
                    <p className="text-xs text-slate-500">
                      Submissions & Respondent Answers Breakdown
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyLink(inspectingForm.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                  >
                    {copiedId === inspectingForm.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-600">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Share Link</span>
                      </>
                    )}
                  </button>

                  {onPreviewPublicForm && (
                    <button
                      type="button"
                      onClick={() => onPreviewPublicForm(inspectingForm.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-purple-200 bg-purple-50/70 text-[#673AB7] hover:bg-purple-100"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open Live Form</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleExportCsv(inspectingForm)}
                    disabled={inspectingForm.submissions.length === 0}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#673AB7] text-white hover:bg-purple-800 disabled:opacity-40"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export CSV</span>
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      const fieldLabels = inspectingForm.fields.map((f) => f.label);
                      await convertViaEngine({
                        action: 'SHEETS_TO_XLSX',
                        title: `${inspectingForm.title}_Responses`,
                        sheets: [
                          {
                            name: 'Responses',
                            columns: ['Submission ID', 'Submitter Name', 'Submitter Email', 'Submitted At', ...fieldLabels],
                            rows: inspectingForm.submissions.map((s) => [
                              s.id,
                              s.respondentName,
                              s.respondentEmail,
                              s.submittedAt,
                              ...inspectingForm.fields.map((f) => String(s.answers?.[f.id] ?? '')),
                            ]),
                          },
                        ],
                        folderId: 'folder-documents',
                      });
                    }}
                    disabled={inspectingForm.submissions.length === 0}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Save .xlsx</span>
                  </button>
                </div>
              </div>

              {/* Compact Summary Strip: Total Submitted vs Target Expected */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-medium text-slate-500">
                      Total Submitted
                    </div>
                    <div className="text-2xl font-bold text-[#673AB7] mt-0.5">
                      {inspectingForm.submissions.length}
                    </div>
                  </div>
                  <Users className="w-7 h-7 text-[#673AB7]/40" />
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-medium text-slate-500">
                      Target Submissions
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="number"
                        min={0}
                        value={inspectingForm.targetSubmissions}
                        onChange={(e) =>
                          handleUpdateTargetInline(inspectingForm, Number(e.target.value))
                        }
                        className="w-24 px-2.5 py-1 text-sm font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                      />
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {inspectingForm.targetSubmissions > 0
                        ? `${Math.min(
                            100,
                            Math.round(
                              (inspectingForm.submissions.length /
                                inspectingForm.targetSubmissions) *
                                100
                            )
                          )}% reached`
                        : 'Unlimited'}
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-medium text-slate-500">
                      Public Link Access
                    </div>
                    <div className="text-sm font-bold mt-1 flex items-center gap-1.5">
                      {inspectingForm.isPublic ? (
                        <span className="text-emerald-600 flex items-center gap-1">
                          <Globe className="w-4 h-4" /> Public (Open)
                        </span>
                      ) : (
                        <span className="text-amber-600 flex items-center gap-1">
                          <Lock className="w-4 h-4" /> Private / Closed
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleTogglePublic(inspectingForm)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100"
                  >
                    {inspectingForm.isPublic ? 'Make Private' : 'Make Public'}
                  </button>
                </div>
              </div>

              {/* Respondent List & Detailed Answers Split */}
              {inspectingForm.submissions.length === 0 ? (
                <div className="p-12 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
                  <ClipboardList className="w-8 h-8 text-slate-400 mx-auto" />
                  <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    No submissions yet
                  </div>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Copy the shareable link above and share it across any platform to start collecting responses.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  {/* Left Column: Who Submitted (Respondent List) */}
                  <div className="lg:col-span-5 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden flex flex-col bg-white dark:bg-slate-900">
                    <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                          Respondents ({inspectingForm.submissions.length})
                        </span>
                      </div>
                      <input
                        type="text"
                        value={submissionSearch}
                        onChange={(e) => setSubmissionSearch(e.target.value)}
                        placeholder="Search by respondent name, email, or answer..."
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none"
                      />
                    </div>

                    <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[500px] overflow-y-auto">
                      {inspectingForm.submissions
                        .filter((sub) => {
                          if (!submissionSearch.trim()) return true;
                          const q = submissionSearch.toLowerCase();
                          const matchIdentity =
                            sub.respondentName.toLowerCase().includes(q) ||
                            sub.respondentEmail.toLowerCase().includes(q);
                          const matchAnswers = Object.values(sub.answers).some((val) =>
                            String(val).toLowerCase().includes(q)
                          );
                          return matchIdentity || matchAnswers;
                        })
                        .map((sub, idx) => {
                          const activeSub: WorkspaceFormSubmission =
                            inspectingForm.submissions.find(
                              (s) => s.id === selectedSubmissionId
                            ) || inspectingForm.submissions[0];
                          const isSelected = activeSub?.id === sub.id;

                          return (
                            <button
                              key={sub.id}
                              type="button"
                              onClick={() => setSelectedSubmissionId(sub.id)}
                              className={`w-full text-left p-3.5 transition-colors flex items-start justify-between gap-2 ${
                                isSelected
                                  ? 'bg-purple-50/90 dark:bg-purple-950/40 border-l-4 border-l-[#673AB7]'
                                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="w-5 h-5 rounded-full bg-[#673AB7]/10 text-[#673AB7] text-[11px] font-bold flex items-center justify-center shrink-0">
                                    {idx + 1}
                                  </span>
                                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                                    {sub.respondentName || 'Anonymous Respondent'}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-500 truncate mt-0.5 pl-6">
                                  {sub.respondentEmail || 'No email provided'}
                                </div>
                              </div>
                              <span className="text-[11px] text-slate-400 whitespace-nowrap shrink-0">
                                {sub.submittedAt}
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  </div>

                  {/* Right Column: What That Person Submitted (Detailed Question & Answer Sheet) */}
                  <div className="lg:col-span-7 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 bg-white dark:bg-slate-900 space-y-4">
                    {(() => {
                      const activeSub =
                        inspectingForm.submissions.find((s) => s.id === selectedSubmissionId) ||
                        inspectingForm.submissions[0];
                      if (!activeSub) return null;

                      return (
                        <>
                          <div className="pb-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-[#673AB7]" />
                                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                  {activeSub.respondentName || 'Anonymous Respondent'}
                                </h3>
                              </div>
                              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-1">
                                <span className="flex items-center gap-1">
                                  <Mail className="w-3.5 h-3.5" />
                                  {activeSub.respondentEmail || 'No email provided'}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3.5 h-3.5" />
                                  {activeSub.submittedAt}
                                </span>
                              </div>
                            </div>
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700">
                              Submitted Response
                            </span>
                          </div>

                          <div className="space-y-3">
                            {inspectingForm.fields.map((field, fIdx) => {
                              const rawAnswer = activeSub.answers[field.id];
                              const formattedAnswer = Array.isArray(rawAnswer)
                                ? rawAnswer.join(', ')
                                : rawAnswer || '— (Not answered)';

                              return (
                                <div
                                  key={field.id}
                                  className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 space-y-1"
                                >
                                  <div className="text-xs font-semibold text-slate-500">
                                    {fIdx + 1}. {field.label}
                                  </div>
                                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100 whitespace-pre-line">
                                    {formattedAnswer}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ALL FORMS LIST — COMPACT SINGLE-LINE ROW VIEW */
            <div className="-m-4 md:-m-6">
              {loading ? (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 px-4 py-3 animate-pulse">
                      <div className="w-3 h-3 rounded-full bg-slate-200 dark:bg-slate-800 shrink-0" />
                      <div className="flex-1 h-3.5 rounded bg-slate-100 dark:bg-slate-800/60" />
                      <div className="w-28 h-3 rounded bg-slate-200 dark:bg-slate-800 shrink-0" />
                    </div>
                  ))}
                </div>
              ) : filteredForms.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center p-6">
                  <ClipboardList className="w-9 h-9 text-slate-300 dark:text-slate-600 mb-2" />
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    No forms found
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 mb-3">
                    Click "Add New Form" to create a shareable form.
                  </p>
                  <button
                    type="button"
                    onClick={handleStartNewForm}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold bg-[#673AB7] text-white"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add New Form</span>
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {filteredForms.map((form) => {
                    const subCount = form.submissions.length;
                    const target = form.targetSubmissions || 0;

                    return (
                      <div
                        key={form.id}
                        onClick={() => {
                          setInspectingFormId(form.id);
                          setSelectedSubmissionId(form.submissions[0]?.id || null);
                        }}
                        className="group flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-[#F2F6FC] dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
                      >
                        {/* Left: Single-Line Dot + Form Title + Status Badge + Questions Count */}
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: form.accentColor || '#673AB7' }}
                          />
                          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[220px] sm:max-w-[340px]">
                            {form.title}
                          </span>

                          {form.isPublic ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 shrink-0">
                              <Globe className="w-2.5 h-2.5" />
                              <span>Public</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 shrink-0">
                              <Lock className="w-2.5 h-2.5" />
                              <span>Private</span>
                            </span>
                          )}

                          <span className="hidden md:inline text-[11px] text-slate-400 shrink-0">
                            {form.fields.length} fields · {form.createdAt}
                          </span>

                          {form.description && (
                            <span className="hidden lg:inline text-xs text-slate-400 truncate">
                              — {form.description}
                            </span>
                          )}
                        </div>

                        {/* Right: Single-Line Compact Actions (Submissions count, small Copy icon, Open icon, Access toggle, Edit, Delete) */}
                        <div
                          className="flex items-center gap-1.5 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setInspectingFormId(form.id);
                              setSelectedSubmissionId(form.submissions[0]?.id || null);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-[#673AB7] dark:text-purple-300 hover:bg-purple-100 text-xs font-semibold tabular-nums transition-colors"
                            title="View Submissions & Respondent Answers"
                          >
                            <Users className="w-3 h-3" />
                            <span>
                              {subCount}
                              {target > 0 ? `/${target}` : ''}
                            </span>
                          </button>

                          {/* Compact Icon-Only Copy Link Button */}
                          <button
                            type="button"
                            onClick={() => handleCopyLink(form.id)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 dark:hover:bg-slate-700 transition-colors"
                            title="Copy Link"
                          >
                            {copiedId === form.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {/* Open / Preview Form */}
                          {onPreviewPublicForm && (
                            <button
                              type="button"
                              onClick={() => onPreviewPublicForm(form.id)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-[#673AB7] hover:bg-slate-200/70 dark:hover:bg-slate-700 transition-colors"
                              title="Open Public Form"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Public / Private Quick Toggle */}
                          <button
                            type="button"
                            onClick={() => handleTogglePublic(form)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 dark:hover:bg-slate-700 transition-colors"
                            title={form.isPublic ? 'Make Link Private' : 'Make Link Public'}
                          >
                            {form.isPublic ? (
                              <Globe className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Lock className="w-3.5 h-3.5 text-amber-600" />
                            )}
                          </button>

                          {/* Edit Form */}
                          <button
                            type="button"
                            onClick={() => handleEditForm(form)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-[#673AB7] hover:bg-slate-200/70 dark:hover:bg-slate-700 transition-colors"
                            title="Edit Form"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Form */}
                          <button
                            type="button"
                            onClick={() => handleDeleteForm(form)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-700 transition-colors"
                            title="Delete Form"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 2: CREATE / CUSTOMIZE FORM BUILDER
      ===================================================================== */}
      {activeTab === 'create_form' && (
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <form onSubmit={handleSaveForm} className="max-w-4xl mx-auto space-y-5 pb-12">
            {/* Form Metadata & Sharing Settings Card */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-2xs">
              <div className="h-2.5 w-full" style={{ backgroundColor: accentColor }} />
              <div className="p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {editingFormId ? 'Edit & Customize Form' : 'Create New Form'}
                  </h2>

                  {/* Theme Color Picker */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-slate-400 mr-1">Theme:</span>
                    {ACCENT_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setAccentColor(color)}
                        className={`w-5 h-5 rounded-full transition-transform ${
                          accentColor === color ? 'scale-125 ring-2 ring-offset-1 ring-slate-400' : ''
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Form Title *
                    </label>
                    <input
                      type="text"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Client Onboarding Survey, Event Registration, Job Application"
                      className="w-full px-3.5 py-2 text-sm font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 focus:bg-white focus:outline-none focus:border-[#673AB7]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Description / Instructions
                    </label>
                    <textarea
                      rows={2}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Add short instructions or context for respondents..."
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 focus:bg-white focus:outline-none focus:border-[#673AB7]"
                    />
                  </div>
                </div>

                {/* Sharing, Respondent Identity & Target Submissions Settings */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  {/* 1. Public Open Link Toggle */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 space-y-1">
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        Open Link to Everyone
                      </span>
                      <input
                        type="checkbox"
                        checked={isPublic}
                        onChange={(e) => setIsPublic(e.target.checked)}
                        className="w-4 h-4 accent-[#673AB7] rounded"
                      />
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Anyone on any platform can visit the link and submit responses.
                    </p>
                  </div>

                  {/* 2. Respondent Identity Mode (No Google Account Needed) */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 space-y-1">
                    <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Respondent Identity
                    </label>
                    <select
                      value={identityMode}
                      onChange={(e) =>
                        setIdentityMode(e.target.value as 'OPTIONAL' | 'REQUIRED' | 'ANONYMOUS')
                      }
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                    >
                      <option value="OPTIONAL">Optional Name / Email</option>
                      <option value="REQUIRED">Require Name or Email (Any Domain)</option>
                      <option value="ANONYMOUS">Strictly Anonymous</option>
                    </select>
                  </div>

                  {/* 3. Target Submissions Count */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 space-y-1">
                    <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Target Submissions
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        value={targetSubmissions}
                        onChange={(e) => setTargetSubmissions(Number(e.target.value))}
                        className="w-24 px-2.5 py-1 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                      />
                      <label className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={autoCloseOnTarget}
                          onChange={(e) => setAutoCloseOnTarget(e.target.checked)}
                          className="accent-[#673AB7] rounded"
                        />
                        <span>Auto-close at limit</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick-Add Field Presets Bar */}
            <div className="flex flex-wrap items-center gap-1.5 px-1">
              <span className="text-xs font-semibold text-slate-500 mr-1">Quick Add:</span>
              {[
                { label: '+ Short Text', type: 'SHORT_TEXT' as FormFieldType, title: 'Your Answer' },
                { label: '+ Paragraph', type: 'PARAGRAPH' as FormFieldType, title: 'Detailed Feedback' },
                { label: '+ Phone', type: 'PHONE' as FormFieldType, title: 'Phone Number' },
                { label: '+ Multiple Choice', type: 'SINGLE_CHOICE' as FormFieldType, title: 'Select an option' },
                { label: '+ Checkboxes', type: 'MULTI_CHOICE' as FormFieldType, title: 'Select all that apply' },
                { label: '+ Dropdown', type: 'DROPDOWN' as FormFieldType, title: 'Choose from list' },
                { label: '+ Star Rating', type: 'RATING' as FormFieldType, title: 'Rate your experience' },
                { label: '+ Date', type: 'DATE' as FormFieldType, title: 'Preferred Date' },
                { label: '+ Yes / No', type: 'YES_NO' as FormFieldType, title: 'Do you agree?' },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handleAddField(preset.type, preset.title)}
                  className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-purple-100 dark:hover:bg-purple-950/60 text-slate-700 dark:text-slate-200 hover:text-[#673AB7] transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Dynamic Questions Builder List */}
            <div className="space-y-3">
              {fields.map((field, idx) => {
                const showOptions =
                  field.type === 'SINGLE_CHOICE' ||
                  field.type === 'MULTI_CHOICE' ||
                  field.type === 'DROPDOWN';

                return (
                  <div
                    key={field.id}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3 shadow-2xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="w-6 h-6 rounded-full bg-purple-50 dark:bg-purple-950 text-[#673AB7] text-xs font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <input
                          type="text"
                          required
                          value={field.label}
                          onChange={(e) => handleUpdateField(idx, { label: e.target.value })}
                          placeholder="Question title..."
                          className="w-full px-3 py-1.5 text-sm font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800 focus:bg-white focus:outline-none focus:border-[#673AB7]"
                        />
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <select
                          value={field.type}
                          onChange={(e) =>
                            handleUpdateField(idx, { type: e.target.value as FormFieldType })
                          }
                          className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                        >
                          {FIELD_TYPE_META.map((m) => (
                            <option key={m.type} value={m.type}>
                              {m.label}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={() => handleMoveField(idx, -1)}
                          disabled={idx === 0}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 disabled:opacity-30"
                          title="Move up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveField(idx, 1)}
                          disabled={idx === fields.length - 1}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 disabled:opacity-30"
                          title="Move down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDuplicateField(idx)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700"
                          title="Duplicate"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        {fields.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveField(idx)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600"
                            title="Delete question"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Optional Help Text & Required Switch */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pl-8">
                      <input
                        type="text"
                        value={field.description || ''}
                        onChange={(e) => handleUpdateField(idx, { description: e.target.value })}
                        placeholder="Helper text or hint (optional)..."
                        className="flex-1 min-w-[200px] px-2.5 py-1 text-xs rounded-lg border border-slate-200/80 dark:border-slate-700 bg-transparent text-slate-600 dark:text-slate-300 focus:outline-none"
                      />

                      <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={(e) => handleUpdateField(idx, { required: e.target.checked })}
                          className="accent-[#673AB7] rounded"
                        />
                        <span>Required</span>
                      </label>
                    </div>

                    {/* Options Editor for Choice / Dropdown Questions */}
                    {showOptions && (
                      <div className="pl-8 space-y-2 pt-1">
                        <div className="text-[11px] font-semibold text-slate-500">
                          Options:
                        </div>
                        {(field.options || []).map((opt, optIdx) => (
                          <div key={optIdx} className="flex items-center gap-2">
                            <span className="text-xs text-slate-400 w-4">{optIdx + 1}.</span>
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) => {
                                const nextOpts = [...(field.options || [])];
                                nextOpts[optIdx] = e.target.value;
                                handleUpdateField(idx, { options: nextOpts });
                              }}
                              className="flex-1 px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                            />
                            {(field.options || []).length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const nextOpts = (field.options || []).filter(
                                    (_, i) => i !== optIdx
                                  );
                                  handleUpdateField(idx, { options: nextOpts });
                                }}
                                className="text-xs text-slate-400 hover:text-red-500 px-1"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            const nextOpts = [
                              ...(field.options || []),
                              `Option ${(field.options || []).length + 1}`,
                            ];
                            handleUpdateField(idx, { options: nextOpts });
                          }}
                          className="text-xs font-semibold text-[#673AB7] hover:underline"
                        >
                          + Add Option
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bottom Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleAddField('SHORT_TEXT')}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
              >
                <Plus className="w-4 h-4" />
                <span>Add Question</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('all_forms')}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-semibold text-white bg-[#673AB7] hover:bg-purple-800 shadow-sm disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>
                    {editingFormId ? 'Update Form' : 'Save Form & Generate Link'}
                  </span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Confirmation Modal for Optional Google Forms API Sync */}
      <ConfirmModal
        isOpen={Boolean(syncGoogleConfirmForm)}
        title="Sync Copy to Google Forms"
        description="Would you like to create a synchronized copy of this form in your Google Forms account?"
        confirmLabel="Create in Google Forms"
        isLoading={syncingGoogle}
        details={
          syncGoogleConfirmForm
            ? [
                `Form Title: ${syncGoogleConfirmForm.title}`,
                `Total Questions: ${syncGoogleConfirmForm.fields.length} items`,
              ]
            : []
        }
        onConfirm={executeGoogleFormSync}
        onCancel={() => setSyncGoogleConfirmForm(null)}
      />
    </div>
  );
};
