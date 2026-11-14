import React, { useState, useEffect } from 'react';
import { useSubmissionRequest } from '../../services/useSubmissionRequest';
import {
  CheckCircle2,
  ArrowLeft,
  Lock,
  Globe,
  Send,
  Calendar,
  AlertCircle,
  ClipboardCheck,
  Briefcase,
  Sliders,
} from 'lucide-react';
import {
  CmhFormTemplate,
  WorkspaceMemberItem,
  fetchPublicCmhItem,
  submitPublicCmhResponse,
} from '../../services/workspaceApi';
import { CmhDynamicFieldsRenderer } from '../cmh/CmhDynamicFieldsRenderer';

interface PublicCmhPortalViewProps {
  cmhParam: string; // e.g. "form:cmh-form-1" or "task:cmh-task-1" or "project:cmh-proj-1"
  onExitPreview?: () => void;
}

export const PublicCmhPortalView: React.FC<PublicCmhPortalViewProps> = ({
  cmhParam,
  onExitPreview,
}) => {
  const [targetType, setTargetType] = useState<'form' | 'task' | 'project'>('form');
  const [targetId, setTargetId] = useState<string>('');
  const [item, setItem] = useState<any | null>(null);
  const [template, setTemplate] = useState<CmhFormTemplate | null>(null);
  const [members, setMembers] = useState<WorkspaceMemberItem[]>([]);

  const [submitterName, setSubmitterName] = useState<string>('');
  const [submitterEmail, setSubmitterEmail] = useState<string>('');
  const [statusUpdate, setStatusUpdate] = useState<string>('');
  const [fieldValues, setFieldValues] = useState<Record<string, any>>({});

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const submissionRequest = useSubmissionRequest();
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submittedMsg, setSubmittedMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const [rawType, rawId] = cmhParam.includes(':')
      ? cmhParam.split(':')
      : ['form', cmhParam];
    const normalizedType =
      rawType === 'task' ? 'task' : rawType === 'project' ? 'project' : 'form';
    setTargetType(normalizedType);
    setTargetId(rawId);

    setIsLoading(true);
    setErrorMsg(null);
    fetchPublicCmhItem(normalizedType, rawId)
      .then((res) => {
        setItem(res.item);
        setTemplate(res.template);
        setMembers(res.members || []);
        if (res.item?.status) {
          setStatusUpdate(res.item.status);
        }
        if (res.item?.customFieldValues) {
          setFieldValues({ ...res.item.customFieldValues });
        } else {
          setFieldValues({});
        }
      })
      .catch((err: any) => {
        setErrorMsg(err?.message || 'Unable to load portal item.');
      })
      .finally(() => setIsLoading(false));
  }, [cmhParam]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submitterEmail.trim()) {
      setErrorMsg('Please enter your email address.');
      return;
    }

    // If Private mode, verify email belongs to an invited member or workspace member
    if (item?.accessMode === 'PRIVATE') {
      const matchedMember = members.find(
        (m) => m.email.toLowerCase() === submitterEmail.trim().toLowerCase()
      );
      if (!matchedMember) {
        setErrorMsg(
          'This link is set to Private. Please enter an invited Workspace Member email address.'
        );
        return;
      }
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const payload = {
        submitterName: submitterName.trim() || submitterEmail.split('@')[0],
        submitterEmail: submitterEmail.trim(),
        values: fieldValues,
        statusUpdate:
          targetType === 'task' || targetType === 'project' ? statusUpdate : undefined,
      };
      const res = await submitPublicCmhResponse(targetType, targetId, payload, submissionRequest.getId([targetType, targetId, payload]));
      submissionRequest.clear();
      setSubmittedMsg(
        res.confirmationMessage ||
          'Your submission has been recorded and sent to the Admin in real time.'
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to submit.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F8FC] dark:bg-slate-950 text-slate-900 dark:text-slate-100 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-4">
        {onExitPreview && (
          <div className="flex items-center justify-between bg-white dark:bg-slate-900 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <button
              type="button"
              onClick={onExitPreview}
              className="flex items-center gap-2 text-xs font-semibold text-[#0B57D0] hover:underline"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Workspace Pro</span>
            </button>
            <span className="text-[11px] font-mono text-slate-400">
              Direct Link: ?cmh={targetType}:{targetId}
            </span>
          </div>
        )}

        {isLoading ? null : errorMsg && !item ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-red-200 p-8 text-center space-y-2">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
            <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Unable to Open Link
            </div>
            <p className="text-xs text-slate-500">{errorMsg}</p>
          </div>
        ) : submittedMsg ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-4 shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Submitted Successfully
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 max-w-md mx-auto leading-relaxed">
              {submittedMsg}
            </p>
            <p className="text-[11px] text-slate-400">
              Real-time notification & email copy delivered to the Workspace Admin inbox.
            </p>
            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setSubmittedMsg(null);
                }}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                Submit Another Response
              </button>
              {onExitPreview && (
                <button
                  type="button"
                  onClick={onExitPreview}
                  className="px-4 py-2 rounded-xl bg-[#0B57D0] text-white text-xs font-semibold"
                >
                  Return to Workspace
                </button>
              )}
            </div>
          </div>
        ) : (
          item &&
          template && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              {/* Top Banner */}
              <div className="px-6 py-5 border-b border-slate-200/80 dark:border-slate-800 bg-[#F8FAFD] dark:bg-slate-800/50 space-y-2">
                <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-[#0B57D0]">
                    {targetType === 'task' ? (
                      <ClipboardCheck className="w-4 h-4" />
                    ) : targetType === 'project' ? (
                      <Briefcase className="w-4 h-4" />
                    ) : (
                      <Sliders className="w-4 h-4" />
                    )}
                    <span>
                      CMH {targetType.toUpperCase()} Â· {template.title}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium">
                    {item.accessMode === 'PRIVATE' ? (
                      <>
                        <Lock className="w-3.5 h-3.5 text-amber-600" />
                        <span>Private (Members Only)</span>
                      </>
                    ) : (
                      <>
                        <Globe className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Public Link (No Account Needed)</span>
                      </>
                    )}
                  </span>
                </div>

                <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  {item.title}
                </h1>
                {item.description && (
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {item.description}
                  </p>
                )}

                {(targetType === 'task' || targetType === 'project') && (
                  <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-slate-500">
                    <span>
                      Priority: <strong className="text-slate-800 dark:text-slate-200">{item.priority}</strong>
                    </span>
                    <span>Â·</span>
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{item.dueDate || item.deadline || 'Active'}</span>
                    </span>
                    {item.budget && (
                      <>
                        <span>Â·</span>
                        <span>Budget: {item.budget}</span>
                      </>
                    )}
                  </div>
                )}
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                {errorMsg && (
                  <div className="px-4 py-2.5 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 text-xs text-red-700 dark:text-red-200">
                    {errorMsg}
                  </div>
                )}

                {/* Submitter Identity Bar (Only email required for public access) */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                      Your Email Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={submitterEmail}
                      onChange={(e) => setSubmitterEmail(e.target.value)}
                      placeholder="you@example.com (No Google login required)"
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                      Your Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={submitterName}
                      onChange={(e) => setSubmitterName(e.target.value)}
                      placeholder="Enter your name"
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
                    />
                  </div>
                </div>

                {/* Task or Project Status Selector if applicable */}
                {(targetType === 'task' || targetType === 'project') && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                      Update {targetType === 'task' ? 'Task' : 'Project'} Status
                    </label>
                    <select
                      value={statusUpdate}
                      onChange={(e) => setStatusUpdate(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                    >
                      {(targetType === 'task'
                        ? ['To Do', 'In Progress', 'Review', 'Completed']
                        : ['Planning', 'Active', 'On Hold', 'Completed']
                      ).map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Dynamic Form Fields built in Form Builder */}
                <CmhDynamicFieldsRenderer
                  fields={template.fields}
                  values={fieldValues}
                  onChange={(fId, val) =>
                    setFieldValues((prev) => ({ ...prev, [fId]: val }))
                  }
                />

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    Instant real-time alert & email copy will be sent to Admin upon submit.
                  </span>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#0B57D0] hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>
                      {template.submitButtonLabel || 'Submit Response'}
                    </span>
                  </button>
                </div>
              </form>
            </div>
          )
        )}
      </div>
    </div>
  );
};


