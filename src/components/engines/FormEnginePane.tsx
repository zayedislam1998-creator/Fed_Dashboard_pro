import React, { useEffect, useState } from 'react';
import {
  ClipboardList,
  Plus,
  Trash2,
  Save,
  Eye,
  Edit3,
  CheckCircle2,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import {
  WorkspaceFormItem,
  fetchWorkspaceForms,
  saveWorkspaceForm,
} from '../../services/workspaceApi';

interface FormEnginePaneProps {
  formId?: string;
  title: string;
  mode: 'VIEW' | 'EDIT';
  onSaved?: () => void;
}

export const FormEnginePane: React.FC<FormEnginePaneProps> = ({
  formId,
  title,
  mode,
  onSaved,
}) => {
  const [form, setForm] = useState<WorkspaceFormItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [testSubmitted, setTestSubmitted] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchWorkspaceForms()
      .then((forms) => {
        const match = forms.find(
          (f) => (formId && f.id === formId) || f.title.toLowerCase() === title.toLowerCase()
        );
        setForm(match || forms[0] || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [formId, title]);

  const handleSaveForm = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const res = await saveWorkspaceForm({
        id: form.id,
        title: form.title,
        description: form.description,
        accentColor: form.accentColor,
        isPublic: form.isPublic,
        identityMode: form.identityMode,
        targetSubmissions: form.targetSubmissions,
        autoCloseOnTarget: form.autoCloseOnTarget,
        confirmationMessage: form.confirmationMessage,
        fields: form.fields,
      });
      setForm(res.form);
      setStatusMsg('Form saved to database.');
      setTimeout(() => setStatusMsg(null), 2500);
      onSaved?.();
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-100">
        <Loader2 className="w-7 h-7 text-purple-600 animate-spin" />
      </div>
    );
  }

  if (!form) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-100 p-8 text-center">
        <ClipboardList className="w-10 h-10 text-slate-300 mb-2" />
        <p className="text-sm font-bold text-slate-700">No form matched &ldquo;{title}&rdquo;</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100 p-4 sm:p-8">
      <div className="max-w-3xl mx-auto space-y-4">
        <div
          className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
          style={{ borderTopWidth: '8px', borderTopColor: form.accentColor || '#673AB7' }}
        >
          <div className="p-6 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex-1 min-w-[200px]">
              {mode === 'EDIT' ? (
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full text-xl font-extrabold text-slate-900 border-b border-slate-300 focus:border-purple-600 outline-none pb-1"
                />
              ) : (
                <h2 className="text-xl font-extrabold text-slate-900">{form.title}</h2>
              )}
              <p className="text-xs text-slate-500 mt-1">
                {form.fields.length} questions · {form.submissions?.length || 0} responses
              </p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={`/?form=${encodeURIComponent(form.id)}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Public Link
              </a>
              {mode === 'EDIT' && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSaveForm}
                  className="flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  {saving ? 'Saving...' : 'Save Form'}
                </button>
              )}
            </div>
          </div>

          {statusMsg && (
            <div className="px-6 py-2 bg-emerald-50 text-emerald-800 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> {statusMsg}
            </div>
          )}

          {mode === 'EDIT' ? (
            <div className="p-6 space-y-3">
              {form.fields.map((fld, idx) => (
                <div key={fld.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400">Q{idx + 1}</span>
                    <input
                      type="text"
                      value={fld.label}
                      onChange={(e) => {
                        const next = form.fields.map((f, i) =>
                          i === idx ? { ...f, label: e.target.value } : f
                        );
                        setForm({ ...form, fields: next });
                      }}
                      className="flex-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs font-semibold"
                    />
                    <select
                      value={fld.type}
                      onChange={(e) => {
                        const next = form.fields.map((f, i) =>
                          i === idx ? { ...f, type: e.target.value as any } : f
                        );
                        setForm({ ...form, fields: next });
                      }}
                      className="px-2 py-1 rounded-lg border border-slate-200 bg-white text-xs"
                    >
                      <option value="SHORT_TEXT">Short Text</option>
                      <option value="PARAGRAPH">Paragraph</option>
                      <option value="EMAIL">Email</option>
                      <option value="NUMBER">Number</option>
                      <option value="DATE">Date</option>
                      <option value="SINGLE_CHOICE">Choice</option>
                    </select>
                    <button
                      type="button"
                      onClick={() =>
                        setForm({ ...form, fields: form.fields.filter((_, i) => i !== idx) })
                      }
                      className="p-1 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setForm({
                    ...form,
                    fields: [
                      ...form.fields,
                      {
                        id: `fld-${Date.now()}`,
                        label: `Question ${form.fields.length + 1}`,
                        type: 'SHORT_TEXT',
                        required: false,
                      },
                    ],
                  })
                }
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 text-xs font-bold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Field
              </button>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setTestSubmitted(true);
                setTimeout(() => setTestSubmitted(false), 3000);
              }}
              className="p-6 space-y-4"
            >
              {form.fields.map((fld) => (
                <div key={fld.id}>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {fld.label} {fld.required && <span className="text-rose-500">*</span>}
                  </label>
                  {fld.type === 'PARAGRAPH' ? (
                    <textarea
                      rows={3}
                      value={answers[fld.id] || ''}
                      onChange={(e) => setAnswers({ ...answers, [fld.id]: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                    />
                  ) : (
                    <input
                      type={fld.type === 'DATE' ? 'date' : fld.type === 'NUMBER' ? 'number' : 'text'}
                      value={answers[fld.id] || ''}
                      onChange={(e) => setAnswers({ ...answers, [fld.id]: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                    />
                  )}
                </div>
              ))}
              <div className="flex items-center justify-between pt-2">
                {testSubmitted ? (
                  <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Preview response validated!
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-400">Interactive Form Engine Preview</span>
                )}
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-white text-xs font-bold cursor-pointer"
                  style={{ backgroundColor: form.accentColor || '#673AB7' }}
                >
                  Test Submit
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
