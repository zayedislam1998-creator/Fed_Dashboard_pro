import React, { useMemo, useState } from 'react';
import { ClipboardList, Plus } from 'lucide-react';
import { saveMemberForm } from '../../services/workspaceAuth';
import {
  canMemberAction,
  EmptyAppCard,
  filterBySearch,
  MemberBootstrapData,
  StatusPill,
} from './shared';

export function MemberFormsView({
  data,
  searchQuery = '',
  readOnlyPreview,
  onReload,
  onNotify,
}: {
  data: MemberBootstrapData;
  searchQuery?: string;
  readOnlyPreview?: boolean;
  onReload: () => Promise<void>;
  onNotify: (msg: string, isError?: boolean) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [fieldLabel, setFieldLabel] = useState('Full Name');
  const [saving, setSaving] = useState(false);

  const canCreate = !readOnlyPreview && canMemberAction(data.capabilities, 'form.create');
  const visibleForms = useMemo(
    () => filterBySearch(data.forms, searchQuery, ['title', 'description']),
    [data.forms, searchQuery]
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await saveMemberForm({
        title: title.trim(),
        description,
        fields: [
          {
            id: `fld-${Date.now()}`,
            label: fieldLabel.trim() || 'Response',
            type: 'text',
            required: true,
          },
        ],
      });
      setTitle('');
      setDescription('');
      setCreating(false);
      await onReload();
      onNotify('Personal form created.');
    } catch (err: any) {
      onNotify(err.message || 'Could not create form.', true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {canCreate && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setCreating((v) => !v)}
            className="min-h-[44px] px-4 rounded-2xl text-sm font-semibold text-white bg-[var(--mp-accent)] inline-flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" /> New Personal Form
          </button>
        </div>
      )}

      {creating && canCreate && (
        <form onSubmit={handleSave} className="mp-card rounded-3xl p-5 space-y-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Form title..."
            required
            className="w-full min-h-[44px] px-4 rounded-2xl border border-[var(--mp-border)] bg-[var(--mp-surface-subtle)] text-sm font-semibold"
          />
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description..."
            className="w-full min-h-[44px] px-4 rounded-2xl border border-[var(--mp-border)] bg-[var(--mp-surface-subtle)] text-sm"
          />
          <input
            type="text"
            value={fieldLabel}
            onChange={(e) => setFieldLabel(e.target.value)}
            placeholder="Primary question label"
            className="w-full min-h-[44px] px-4 rounded-2xl border border-[var(--mp-border)] bg-[var(--mp-surface-subtle)] text-sm"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="min-h-[42px] px-4 rounded-2xl text-sm text-[var(--mp-text-muted)] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[42px] px-5 rounded-2xl text-sm font-semibold text-white bg-[var(--mp-accent)] cursor-pointer"
            >
              {'Create Form'}
            </button>
          </div>
        </form>
      )}

      {visibleForms.length === 0 ? (
        <EmptyAppCard
          icon={ClipboardList}
          title="No forms found"
          subtitle="Forms you create or forms shared with your account appear here."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {visibleForms.map((form) => (
            <div key={form.id} className="mp-card-soft rounded-3xl p-5">
              <div className="flex items-center justify-between gap-2">
                <StatusPill label={`${form.submissionsCount || 0} Responses`} tone="accent" />
                <span className="text-xs text-[var(--mp-text-muted)]">{form.fields?.length || 0} fields</span>
              </div>
              <h3 className="text-base font-bold text-[var(--mp-text)] mt-2.5">{form.title}</h3>
              {form.description && (
                <p className="text-sm text-[var(--mp-text-muted)] mt-1">{form.description}</p>
              )}
              <a
                href={`/?form=${encodeURIComponent(form.id)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 mt-3 text-xs font-semibold text-[var(--mp-accent-text)] hover:underline"
              >
                Open Fillable Form Link
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
