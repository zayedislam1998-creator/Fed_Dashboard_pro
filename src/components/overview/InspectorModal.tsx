import React from 'react';
import {
  X, Check, Clock, Plus, ExternalLink, AlertCircle, UserCheck, FileText,
} from 'lucide-react';
import { CmhSubmission, WorkspaceMemberItem } from '../../services/workspaceApi';

export type InspectorTab = 'SUBMITTED' | 'REMAINING' | 'QUICK_SUBMIT';

export interface InspectorModalProps {
  item: {
    id: string;
    type: 'TASK' | 'PROJECT' | 'FORM';
    title: string;
    targetCount: number;
    submittedCount: number;
    remainingCount: number;
    completionPct: number;
    submissions: CmhSubmission[];
  };
  members: WorkspaceMemberItem[];
  onClose: () => void;
  onNavigateModule: (module: string) => void;
  editingTargetValue: number;
  setEditingTargetValue: (v: number) => void;
  savingTarget: boolean;
  onSaveTargetCount: () => void;
  selectedSubmission: CmhSubmission | null;
  setSelectedSubmission: (s: CmhSubmission | null) => void;
  inspectorTab: InspectorTab;
  setInspectorTab: (t: InspectorTab) => void;
  quickSubmitName: string;
  setQuickSubmitName: (v: string) => void;
  quickSubmitEmail: string;
  setQuickSubmitEmail: (v: string) => void;
  quickSubmitNote: string;
  setQuickSubmitNote: (v: string) => void;
  quickSubmitDeliverable: string;
  setQuickSubmitDeliverable: (v: string) => void;
  submittingEntry: boolean;
  onSubmitQuickResponse: (e: React.FormEvent) => void;
}

export const InspectorModal: React.FC<InspectorModalProps> = ({
  item,
  members,
  onClose,
  onNavigateModule,
  editingTargetValue,
  setEditingTargetValue,
  savingTarget,
  onSaveTargetCount,
  selectedSubmission,
  setSelectedSubmission,
  inspectorTab,
  setInspectorTab,
  quickSubmitName,
  setQuickSubmitName,
  quickSubmitEmail,
  setQuickSubmitEmail,
  quickSubmitNote,
  setQuickSubmitNote,
  quickSubmitDeliverable,
  setQuickSubmitDeliverable,
  submittingEntry,
  onSubmitQuickResponse,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-h-[90vh] flex flex-col overflow-hidden    duration-200">
        {/* Modal Header */}
        <div className="px-4 py-3.5 sm:px-6 sm:py-4 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3 bg-slate-50/70 dark:bg-slate-800/50">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-blue-600 text-white">
                {item.type} INSPECTOR
              </span>
              <span className="text-xs font-bold text-slate-500">
                Target: {item.targetCount} · Submitted: {item.submittedCount} · Remaining: {item.remainingCount}
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white mt-1 truncate">
              {item.title}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Target People Adjuster Bar */}
        {(item.type === 'TASK' || item.type === 'PROJECT') && (
          <div className="px-4 py-2.5 sm:px-6 bg-rose-50/60 dark:bg-rose-950/20 border-b border-rose-200/60 dark:border-rose-900/40 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-rose-800 dark:text-rose-300">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span>Set Target People for this {item.type === 'TASK' ? 'Task' : 'Project'}:</span>
            </div>
            <div className="flex items-center gap-1.5">
              {[10, 25, 40, 50, 100].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setEditingTargetValue(preset)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-extrabold border ${
                    editingTargetValue === preset
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200'
                  }`}
                >
                  {preset}
                </button>
              ))}
              <input
                type="number"
                min={1}
                max={10000}
                value={editingTargetValue}
                onChange={(e) =>
                  setEditingTargetValue(Math.max(1, Number(e.target.value) || 1))
                }
                className="w-20 px-2.5 py-1 rounded-lg border border-slate-300 text-xs font-extrabold text-slate-900"
              />
              <button
                type="button"
                onClick={onSaveTargetCount}
                disabled={savingTarget}
                className="px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save</span>
              </button>
            </div>
          </div>
        )}

        {/* Modal Sub-Tabs */}
        <div className="px-4 sm:px-6 pt-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setInspectorTab('SUBMITTED')}
            className={`pb-2.5 px-3 border-b-2 text-xs font-extrabold flex items-center gap-1.5 whitespace-nowrap ${
              inspectorTab === 'SUBMITTED'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Check className="w-4 h-4" />
            <span>Submitted & Deliverables ({item.submittedCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setInspectorTab('REMAINING')}
            className={`pb-2.5 px-3 border-b-2 text-xs font-extrabold flex items-center gap-1.5 whitespace-nowrap ${
              inspectorTab === 'REMAINING'
                ? 'border-rose-600 text-rose-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Remaining / Pending ({item.remainingCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setInspectorTab('QUICK_SUBMIT')}
            className={`pb-2.5 px-3 border-b-2 text-xs font-extrabold flex items-center gap-1.5 whitespace-nowrap ${
              inspectorTab === 'QUICK_SUBMIT'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Submission</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {inspectorTab === 'SUBMITTED' && (
            <SubmittedTab
              item={item}
              selectedSubmission={selectedSubmission}
              setSelectedSubmission={setSelectedSubmission}
              setInspectorTab={setInspectorTab}
            />
          )}

          {inspectorTab === 'REMAINING' && (
            <RemainingTab item={item} members={members} />
          )}

          {inspectorTab === 'QUICK_SUBMIT' && (
            <QuickSubmitTab
              item={item}
              quickSubmitName={quickSubmitName}
              setQuickSubmitName={setQuickSubmitName}
              quickSubmitEmail={quickSubmitEmail}
              setQuickSubmitEmail={setQuickSubmitEmail}
              quickSubmitNote={quickSubmitNote}
              setQuickSubmitNote={setQuickSubmitNote}
              quickSubmitDeliverable={quickSubmitDeliverable}
              setQuickSubmitDeliverable={setQuickSubmitDeliverable}
              submittingEntry={submittingEntry}
              onSubmit={onSubmitQuickResponse}
            />
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-3 sm:px-6 bg-slate-50 dark:bg-slate-800/70 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              const targetMod =
                item.type === 'TASK'
                  ? 'cmh_tasks'
                  : item.type === 'PROJECT'
                  ? 'cmh_projects'
                  : 'cmh_forms';
              onClose();
              onNavigateModule(targetMod);
            }}
            className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open Full Module</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-700 text-white text-xs font-bold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

/* ---- Sub-tabs ---- */

interface TabProps {
  item: {
    id: string;
    type: 'TASK' | 'PROJECT' | 'FORM';
    title: string;
    targetCount: number;
    submittedCount: number;
    remainingCount: number;
    completionPct: number;
    submissions: CmhSubmission[];
  };
}

const SubmittedTab: React.FC<TabProps & {
  selectedSubmission: CmhSubmission | null;
  setSelectedSubmission: (s: CmhSubmission | null) => void;
  setInspectorTab: (t: InspectorTab) => void;
}> = ({ item, selectedSubmission, setSelectedSubmission, setInspectorTab }) => {
  if (item.submissions.length === 0) {
    return (
      <div>
        <div className="py-10 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
            No submissions yet (0/{item.targetCount} People)
          </p>
          <p className="text-xs text-slate-500">
            Click the button below to record a submission or share the portal link.
          </p>
          <button
            type="button"
            onClick={() => setInspectorTab('QUICK_SUBMIT')}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold"
          >
            + Add First Submission
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Left List: Who Submitted */}
        <div className="md:col-span-5 space-y-2 border-r-0 md:border-r border-slate-200 dark:border-slate-800 md:pr-3">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
            Submitted People ({item.submissions.length})
          </p>
          {item.submissions.map((sub, idx) => {
            const isSelected = selectedSubmission?.id === sub.id;
            return (
              <button
                key={sub.id}
                type="button"
                onClick={() => setSelectedSubmission(sub)}
                className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between gap-2 ${
                  isSelected
                    ? 'bg-emerald-50/90 dark:bg-emerald-950/50 border-emerald-500'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-800 hover:bg-white'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                      {sub.submitterName}
                    </p>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">
                    {sub.submitterEmail}
                  </p>
                </div>
                <span className="text-[10px] font-semibold text-slate-400 shrink-0">
                  {sub.submittedAt}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right Detail: What They Submitted */}
        <div className="md:col-span-7">
          {selectedSubmission ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2.5">
                <div>
                  <p className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400">
                    Submitted By: {selectedSubmission.submitterName}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {selectedSubmission.submitterEmail} · Time: {selectedSubmission.submittedAt}
                  </p>
                </div>
                <FileText className="w-4 h-4 text-emerald-600" />
              </div>

              <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                Submitted Form Data & Deliverables:
              </p>

              <div className="space-y-2">
                {Object.entries(selectedSubmission.values || {}).map(([key, val]) => (
                  <div
                    key={key}
                    className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800"
                  >
                    <p className="text-[11px] font-bold text-slate-500">{key}</p>
                    <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white mt-0.5 break-words">
                      {Array.isArray(val) ? val.join(', ') : String(val ?? '—')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-slate-500">
              Select a person on the left to inspect their submitted data.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const RemainingTab: React.FC<TabProps & { members: WorkspaceMemberItem[] }> = ({ item, members }) => (
  <div className="space-y-4">
    <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex items-center justify-between">
      <div>
        <p className="text-xs font-extrabold text-amber-800 dark:text-amber-300">
          {item.remainingCount} out of {item.targetCount} Target People Remaining
        </p>
        <p className="text-[11px] text-amber-700/80 dark:text-amber-400 mt-0.5">
          Already Submitted: {item.submittedCount} People ({item.completionPct}% Complete)
        </p>
      </div>
      <span className="text-xl font-extrabold text-rose-600 tabular-nums">
        {item.remainingCount} Left
      </span>
    </div>

    {/* Assigned Team Members who haven't submitted yet */}
    <div className="space-y-2">
      <p className="text-xs font-extrabold text-slate-700 dark:text-slate-300">
        Team Member Submission Status:
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {members.map((m) => {
          const hasSubmitted = item.submissions.some(
            (s) =>
              s.submitterEmail.toLowerCase() === m.email.toLowerCase() ||
              s.submitterName.toLowerCase() === m.fullName.toLowerCase()
          );
          return (
            <div
              key={m.id}
              className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                hasSubmitted
                  ? 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900'
                  : 'bg-white border-slate-200 dark:bg-slate-800 dark:border-slate-700'
              }`}
            >
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {m.fullName}
                </p>
                <p className="text-[10px] text-slate-500 truncate">{m.email}</p>
              </div>
              {hasSubmitted ? (
                <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-bold flex items-center gap-1 shrink-0">
                  <UserCheck className="w-3 h-3" /> Submitted
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 text-[10px] font-bold shrink-0">
                  Pending
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  </div>
);

const QuickSubmitTab: React.FC<TabProps & {
  quickSubmitName: string;
  setQuickSubmitName: (v: string) => void;
  quickSubmitEmail: string;
  setQuickSubmitEmail: (v: string) => void;
  quickSubmitNote: string;
  setQuickSubmitNote: (v: string) => void;
  quickSubmitDeliverable: string;
  setQuickSubmitDeliverable: (v: string) => void;
  submittingEntry: boolean;
  onSubmit: (e: React.FormEvent) => void;
}> = ({
  item, quickSubmitName, setQuickSubmitName, quickSubmitEmail, setQuickSubmitEmail,
  quickSubmitNote, setQuickSubmitNote, quickSubmitDeliverable, setQuickSubmitDeliverable,
  submittingEntry, onSubmit,
}) => (
  <form onSubmit={onSubmit} className="space-y-3.5 max-w-lg mx-auto">
    <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
      Record a new submission for "{item.title}":
    </p>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">Submitter Name *</label>
        <input
          type="text"
          required
          value={quickSubmitName}
          onChange={(e) => setQuickSubmitName(e.target.value)}
          placeholder="e.g., Alex Morgan"
          className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold"
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
        <input
          type="email"
          value={quickSubmitEmail}
          onChange={(e) => setQuickSubmitEmail(e.target.value)}
          placeholder="alex@company.com"
          className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold"
        />
      </div>
    </div>
    <div>
      <label className="block text-xs font-bold text-slate-700 mb-1">
        Submitted Deliverable / Link / Answer *
      </label>
      <input
        type="text"
        required
        value={quickSubmitDeliverable}
        onChange={(e) => setQuickSubmitDeliverable(e.target.value)}
        placeholder="e.g., Completed Module Report & Verified Data Sheet"
        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold"
      />
    </div>
    <div>
      <label className="block text-xs font-bold text-slate-700 mb-1">Additional Notes (Optional)</label>
      <textarea
        rows={2}
        value={quickSubmitNote}
        onChange={(e) => setQuickSubmitNote(e.target.value)}
        placeholder="Enter any extra notes or details..."
        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
      />
    </div>
    <button
      type="submit"
      disabled={submittingEntry}
      className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-xs"
    >
      Save Submission & Update Circle
    </button>
  </form>
);
