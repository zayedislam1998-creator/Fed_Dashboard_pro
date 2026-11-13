import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Send,
  Star,
  ArrowLeft,
  User,
  Mail,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';
import {
  WorkspaceFormField,
  fetchPublicFormById,
  submitPublicFormResponse,
} from '../services/workspaceApi';

interface PublicFormViewProps {
  formId: string;
  onExitPreview?: () => void;
}

export const PublicFormView: React.FC<PublicFormViewProps> = ({ formId, onExitPreview }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [formMeta, setFormMeta] = useState<{
    id: string;
    title: string;
    description: string;
    accentColor: string;
    identityMode: 'OPTIONAL' | 'REQUIRED' | 'ANONYMOUS';
    confirmationMessage: string;
    fields: WorkspaceFormField[];
  } | null>(null);

  const [respondentName, setRespondentName] = useState<string>('');
  const [respondentEmail, setRespondentEmail] = useState<string>('');
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedConfirmation, setSubmittedConfirmation] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setSubmittedConfirmation(null);

    fetchPublicFormById(formId)
      .then((data) => {
        if (!active) return;
        setFormMeta(data);
        const initial: Record<string, string | string[]> = {};
        data.fields.forEach((f) => {
          initial[f.id] = f.type === 'MULTI_CHOICE' ? [] : '';
        });
        setAnswers(initial);
      })
      .catch((err: any) => {
        if (!active) return;
        setError(err?.message || 'This form is currently unavailable or closed.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [formId]);

  const handleSingleChange = (fieldId: string, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [fieldId]: value,
    }));
  };

  const handleMultiChoiceToggle = (fieldId: string, optionValue: string) => {
    setAnswers((prev) => {
      const current = Array.isArray(prev[fieldId]) ? (prev[fieldId] as string[]) : [];
      const exists = current.includes(optionValue);
      return {
        ...prev,
        [fieldId]: exists
          ? current.filter((item) => item !== optionValue)
          : [...current, optionValue],
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formMeta) return;
    setSubmitError(null);

    if (formMeta.identityMode === 'REQUIRED') {
      if (!respondentName.trim() && !respondentEmail.trim()) {
        setSubmitError('Please provide your Name or Email address.');
        return;
      }
    }

    for (const field of formMeta.fields) {
      if (field.required) {
        const val = answers[field.id];
        const isEmpty =
          val === undefined ||
          val === null ||
          (typeof val === 'string' && !val.trim()) ||
          (Array.isArray(val) && val.length === 0);
        if (isEmpty) {
          setSubmitError(`"${field.label}" is required.`);
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      const res = await submitPublicFormResponse(formMeta.id, {
        respondentName: respondentName.trim() || undefined,
        respondentEmail: respondentEmail.trim() || undefined,
        answers,
      });
      setSubmittedConfirmation(
        res.confirmationMessage ||
          formMeta.confirmationMessage ||
          'Your response has been recorded. Thank you!'
      );
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to submit form response. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetAnother = () => {
    if (!formMeta) return;
    const initial: Record<string, string | string[]> = {};
    formMeta.fields.forEach((f) => {
      initial[f.id] = f.type === 'MULTI_CHOICE' ? [] : '';
    });
    setAnswers(initial);
    setSubmittedConfirmation(null);
    setSubmitError(null);
  };

  const accentColor = formMeta?.accentColor || '#673AB7';

  return (
    <div className="min-h-screen bg-[#F4F2F8] dark:bg-slate-950 text-slate-900 dark:text-slate-100 py-6 px-3 sm:px-6 overflow-y-auto">
      <div className="max-w-2xl mx-auto space-y-4">
        {onExitPreview && (
          <div className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 shadow-xs">
            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>Public Responder View</strong> — Anyone with this link can submit without a Google account
              </span>
            </div>
            <button
              type="button"
              onClick={onExitPreview}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 transition-colors shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Forms</span>
            </button>
          </div>
        )}

        {loading ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 flex flex-col items-center justify-center gap-3 shadow-xs">
            <Loader2 className="w-7 h-7 animate-spin text-[#673AB7]" />
            <p className="text-sm text-slate-500">Loading form...</p>
          </div>
        ) : error || !formMeta ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-red-200 dark:border-red-900/50 p-8 text-center space-y-3 shadow-xs">
            <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Form Unavailable
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
              {error || 'This form is currently private or has reached its maximum submission limit.'}
            </p>
            {onExitPreview && (
              <button
                type="button"
                onClick={onExitPreview}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#673AB7] text-white"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Forms List</span>
              </button>
            )}
          </div>
        ) : submittedConfirmation ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="h-3 w-full" style={{ backgroundColor: accentColor }} />
            <div className="p-8 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {formMeta.title}
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-300 max-w-md mx-auto">
                {submittedConfirmation}
              </p>
              <div className="pt-3 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleResetAnother}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Submit another response</span>
                </button>
                {onExitPreview && (
                  <button
                    type="button"
                    onClick={onExitPreview}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white"
                    style={{ backgroundColor: accentColor }}
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Return to Dashboard</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pb-12">
            {/* Form Header Card */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
              <div className="h-3 w-full" style={{ backgroundColor: accentColor }} />
              <div className="p-6 space-y-2">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {formMeta.title}
                </h1>
                {formMeta.description && (
                  <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-line">
                    {formMeta.description}
                  </p>
                )}
                <div className="pt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500 border-t border-slate-100 dark:border-slate-800">
                  <span>No Google account or login required</span>
                  <span className="text-red-500 font-medium">* Indicates required question</span>
                </div>
              </div>
            </div>

            {/* Respondent Name / Email Card */}
            {formMeta.identityMode !== 'ANONYMOUS' && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Respondent Details{' '}
                    {formMeta.identityMode === 'OPTIONAL'
                      ? '(Optional)'
                      : '(Name or Email Required)'}
                  </span>
                  {formMeta.identityMode === 'REQUIRED' && (
                    <span className="text-xs font-semibold text-red-500">* Required</span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">
                      Your Name
                    </label>
                    <div className="relative">
                      <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={respondentName}
                        onChange={(e) => setRespondentName(e.target.value)}
                        placeholder="Enter your name..."
                        className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 focus:bg-white focus:outline-none focus:border-[#673AB7]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">
                      Email or Contact Info
                    </label>
                    <div className="relative">
                      <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={respondentEmail}
                        onChange={(e) => setRespondentEmail(e.target.value)}
                        placeholder="name@domain.com or phone..."
                        className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 focus:bg-white focus:outline-none focus:border-[#673AB7]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Dynamic Form Fields */}
            {formMeta.fields.map((field, index) => {
              const value = answers[field.id];
              return (
                <div
                  key={field.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3 shadow-xs"
                >
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                      <span className="text-slate-400 mr-1.5">{index + 1}.</span>
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    {field.description && (
                      <p className="text-xs text-slate-500 mt-0.5">{field.description}</p>
                    )}
                  </div>

                  {field.type === 'SHORT_TEXT' && (
                    <input
                      type="text"
                      value={typeof value === 'string' ? value : ''}
                      onChange={(e) => handleSingleChange(field.id, e.target.value)}
                      placeholder={field.placeholder || 'Your answer...'}
                      className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 focus:bg-white focus:outline-none focus:border-[#673AB7]"
                    />
                  )}

                  {field.type === 'PARAGRAPH' && (
                    <textarea
                      rows={3}
                      value={typeof value === 'string' ? value : ''}
                      onChange={(e) => handleSingleChange(field.id, e.target.value)}
                      placeholder={field.placeholder || 'Your detailed answer...'}
                      className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 focus:bg-white focus:outline-none focus:border-[#673AB7]"
                    />
                  )}

                  {field.type === 'EMAIL' && (
                    <input
                      type="email"
                      value={typeof value === 'string' ? value : ''}
                      onChange={(e) => handleSingleChange(field.id, e.target.value)}
                      placeholder={field.placeholder || 'example@domain.com'}
                      className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 focus:bg-white focus:outline-none focus:border-[#673AB7]"
                    />
                  )}

                  {field.type === 'PHONE' && (
                    <input
                      type="tel"
                      value={typeof value === 'string' ? value : ''}
                      onChange={(e) => handleSingleChange(field.id, e.target.value)}
                      placeholder={field.placeholder || '+1 (555) 000-0000'}
                      className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 focus:bg-white focus:outline-none focus:border-[#673AB7]"
                    />
                  )}

                  {field.type === 'NUMBER' && (
                    <input
                      type="number"
                      value={typeof value === 'string' ? value : ''}
                      onChange={(e) => handleSingleChange(field.id, e.target.value)}
                      placeholder={field.placeholder || '0'}
                      className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 focus:bg-white focus:outline-none focus:border-[#673AB7]"
                    />
                  )}

                  {field.type === 'URL' && (
                    <input
                      type="url"
                      value={typeof value === 'string' ? value : ''}
                      onChange={(e) => handleSingleChange(field.id, e.target.value)}
                      placeholder={field.placeholder || 'https://'}
                      className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 focus:bg-white focus:outline-none focus:border-[#673AB7]"
                    />
                  )}

                  {field.type === 'DATE' && (
                    <input
                      type="date"
                      value={typeof value === 'string' ? value : ''}
                      onChange={(e) => handleSingleChange(field.id, e.target.value)}
                      className="w-full sm:w-60 px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 focus:bg-white focus:outline-none focus:border-[#673AB7]"
                    />
                  )}

                  {field.type === 'TIME' && (
                    <input
                      type="time"
                      value={typeof value === 'string' ? value : ''}
                      onChange={(e) => handleSingleChange(field.id, e.target.value)}
                      className="w-full sm:w-48 px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 focus:bg-white focus:outline-none focus:border-[#673AB7]"
                    />
                  )}

                  {field.type === 'SINGLE_CHOICE' && (
                    <div className="space-y-2 pt-1">
                      {(field.options || []).map((opt) => (
                        <label
                          key={opt}
                          className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-200 cursor-pointer"
                        >
                          <input
                            type="radio"
                            name={field.id}
                            checked={value === opt}
                            onChange={() => handleSingleChange(field.id, opt)}
                            className="w-4 h-4 accent-[#673AB7]"
                          />
                          <span>{opt}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {field.type === 'MULTI_CHOICE' && (
                    <div className="space-y-2 pt-1">
                      {(field.options || []).map((opt) => {
                        const checked = Array.isArray(value) && value.includes(opt);
                        return (
                          <label
                            key={opt}
                            className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-200 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handleMultiChoiceToggle(field.id, opt)}
                              className="w-4 h-4 rounded accent-[#673AB7]"
                            />
                            <span>{opt}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {field.type === 'DROPDOWN' && (
                    <select
                      value={typeof value === 'string' ? value : ''}
                      onChange={(e) => handleSingleChange(field.id, e.target.value)}
                      className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 focus:bg-white focus:outline-none focus:border-[#673AB7]"
                    >
                      <option value="">-- Select an option --</option>
                      {(field.options || []).map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  )}

                  {field.type === 'YES_NO' && (
                    <div className="flex items-center gap-3 pt-1">
                      {['Yes', 'No'].map((choice) => {
                        const active = value === choice;
                        return (
                          <button
                            key={choice}
                            type="button"
                            onClick={() => handleSingleChange(field.id, choice)}
                            className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                              active
                                ? 'text-white border-transparent shadow-xs'
                                : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                            style={active ? { backgroundColor: accentColor } : undefined}
                          >
                            {choice}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {field.type === 'RATING' && (
                    <div className="flex items-center gap-2 pt-1">
                      {Array.from({ length: field.scaleMax || 5 }, (_, idx) => idx + 1).map(
                        (starVal) => {
                          const currentRating = Number(value || 0);
                          const active = starVal <= currentRating;
                          return (
                            <button
                              key={starVal}
                              type="button"
                              onClick={() => handleSingleChange(field.id, String(starVal))}
                              className={`p-2 rounded-xl border transition-all flex items-center gap-1 ${
                                active
                                  ? 'bg-amber-50 border-amber-300 text-amber-500'
                                  : 'border-slate-200 dark:border-slate-700 text-slate-400 hover:text-amber-400'
                              }`}
                            >
                              <Star
                                className={`w-5 h-5 ${active ? 'fill-amber-400 text-amber-400' : ''}`}
                              />
                              <span className="text-xs font-semibold">{starVal}</span>
                            </button>
                          );
                        }
                      )}
                    </div>
                  )}

                  {field.type === 'LINEAR_SCALE' && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {Array.from({ length: field.scaleMax || 10 }, (_, idx) => idx + 1).map(
                        (num) => {
                          const active = String(value) === String(num);
                          return (
                            <button
                              key={num}
                              type="button"
                              onClick={() => handleSingleChange(field.id, String(num))}
                              className={`w-9 h-9 rounded-xl text-xs font-semibold border transition-all ${
                                active
                                  ? 'text-white border-transparent shadow-xs'
                                  : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                              }`}
                              style={active ? { backgroundColor: accentColor } : undefined}
                            >
                              {num}
                            </button>
                          );
                        }
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {submitError && (
              <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white shadow-sm hover:opacity-95 disabled:opacity-50 transition-all"
                style={{ backgroundColor: accentColor }}
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>Submit</span>
              </button>

              <button
                type="button"
                onClick={handleResetAnother}
                className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              >
                Clear form
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
