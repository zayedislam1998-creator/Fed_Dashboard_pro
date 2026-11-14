import React, { useState } from 'react';
import { CmhFormTemplate, CmhSubmission } from '../../services/workspaceApi';
import { convertViaEngine } from '../../services/engineCache';
import { Download, X } from 'lucide-react';

interface SubmissionsInspectorProps {
  form: CmhFormTemplate;
  onClose: () => void;
}

export const SubmissionsInspector: React.FC<SubmissionsInspectorProps> = ({ form, onClose }) => {
  const [selectedSubmission, setSelectedSubmission] = useState<CmhSubmission | null>(null);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">
              Submissions Inspector ({form.submissions?.length || 0} Responses)
            </span>
            <h3 className="text-base font-bold">{form.title}</h3>
          </div>
          <div className="flex items-center gap-2">
            {(form.submissions?.length || 0) > 0 && (
              <button
                type="button"
                onClick={() => {
                  const fieldCols = (form.fields || []).map((f) => f.label);
                  convertViaEngine({
                    action: 'SHEETS_TO_XLSX',
                    title: `${form.title}_Submissions`,
                    sheets: [
                      {
                        name: 'Submissions',
                        columns: ['ID', 'Submitter', 'Email', 'Submitted At', ...fieldCols],
                        rows: form.submissions.map((s) => [
                          s.id,
                          s.submitterName,
                          s.submitterEmail,
                          s.submittedAt,
                          ...(form.fields || []).map((f) => String(s.values?.[f.id] ?? '')),
                        ]),
                      },
                    ],
                    folderId: 'folder-documents',
                  });
                }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Export .xlsx
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {!form.submissions || form.submissions.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">
            No submissions received for this form yet. Copy the link or invite members to start
            collecting responses.
          </div>
        ) : (
          <div className="flex-1 grid grid-cols-12 overflow-hidden">
            <div className="col-span-5 border-r border-slate-200 overflow-y-auto divide-y divide-slate-100">
              {form.submissions.map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => setSelectedSubmission(sub)}
                  className={`w-full px-4 py-3 text-left transition-colors ${
                    selectedSubmission?.id === sub.id
                      ? 'bg-blue-50/80 border-l-4 border-l-blue-600'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <p className="text-xs font-bold text-slate-900 truncate">
                    {sub.submitterName}
                  </p>
                  <p className="text-[11px] text-blue-600 truncate">{sub.submitterEmail}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{sub.submittedAt}</p>
                </button>
              ))}
            </div>
            <div className="col-span-7 p-5 overflow-y-auto space-y-3 bg-slate-50/50">
              {selectedSubmission ? (
                <>
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                    <p className="text-xs font-bold text-slate-900">
                      {selectedSubmission.submitterName} ({selectedSubmission.submitterEmail})
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Submitted on {selectedSubmission.submittedAt}
                    </p>
                  </div>
                  <div className="space-y-2">
                    {Object.entries(selectedSubmission.values || {}).map(([label, val]) => (
                      <div
                        key={label}
                        className="bg-white p-3 rounded-xl border border-slate-200"
                      >
                        <p className="text-[11px] font-bold uppercase text-slate-400">
                          {label}
                        </p>
                        <p className="text-xs font-semibold text-slate-900 mt-1 break-words">
                          {Array.isArray(val) ? val.join(', ') : String(val ?? '—')}
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-xs text-slate-500">Select a submission on the left.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
