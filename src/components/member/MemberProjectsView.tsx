import React, { useMemo, useState } from 'react';
import { Briefcase } from 'lucide-react';
import { updateMemberProjectAsManager } from '../../services/workspaceAuth';
import {
  EmptyAppCard,
  filterBySearch,
  MemberBootstrapData,
  StatusPill,
} from './shared';

export function MemberProjectsView({
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [desc, setDesc] = useState('');
  const [status, setStatus] = useState('Active');
  const [deadline, setDeadline] = useState('');
  const [saving, setSaving] = useState(false);

  const visibleProjects = useMemo(
    () => filterBySearch(data.projects, searchQuery, ['title', 'description', 'status']),
    [data.projects, searchQuery]
  );

  const handleSaveProject = async (e: React.FormEvent, projectId: string) => {
    e.preventDefault();
    if (readOnlyPreview) return;
    setSaving(true);
    try {
      await updateMemberProjectAsManager(projectId, {
        description: desc,
        status,
        deadline,
      });
      setEditingId(null);
      await onReload();
      onNotify('Project updated.');
    } catch (err: any) {
      onNotify(err.message || 'Update failed.', true);
    } finally {
      setSaving(false);
    }
  };

  if (visibleProjects.length === 0) {
    return (
      <EmptyAppCard
        icon={Briefcase}
        title="No matching projects"
        subtitle="When Admin grants you access to a project, it will show up right here."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {visibleProjects.map((p) => {
        const actions: string[] = Array.isArray(p.myProjectActions) ? p.myProjectActions : [];
        const canManage = !readOnlyPreview && actions.includes('project.edit_details');
        const isEditing = editingId === p.id;
        return (
          <div key={p.id} className="mp-card-soft rounded-3xl p-5 flex flex-col justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <StatusPill
                  label={p.myProjectRole === 'MANAGER' ? 'Project Manager' : 'Participant'}
                  tone={p.myProjectRole === 'MANAGER' ? 'accent' : 'neutral'}
                />
                <StatusPill label={p.status || 'Active'} tone={p.status === 'Completed' ? 'success' : 'neutral'} />
              </div>
              <h3 className="text-base font-bold text-[var(--mp-text)] mt-3">{p.title}</h3>
              <p className="text-sm text-[var(--mp-text-muted)] mt-1">
                {p.description || 'No description added.'}
              </p>
              <div className="flex flex-wrap gap-3 mt-3 text-xs text-[var(--mp-text-muted)]">
                {p.deadline && <span>Deadline: {p.deadline}</span>}
                {p.budget && <span>Budget: {p.budget}</span>}
              </div>
            </div>

            {canManage && !isEditing && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(p.id);
                  setDesc(p.description || '');
                  setStatus(p.status || 'Active');
                  setDeadline(p.deadline || '');
                }}
                className="min-h-[42px] px-4 rounded-2xl text-xs font-semibold bg-[var(--mp-accent-soft)] text-[var(--mp-accent-text)] self-start cursor-pointer"
              >
                Manage Project Details
              </button>
            )}

            {isEditing && canManage && (
              <form onSubmit={(e) => handleSaveProject(e, p.id)} className="pt-3 border-t border-[var(--mp-border)] space-y-2.5">
                <textarea
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  rows={2}
                  placeholder="Project summary..."
                  className="w-full p-3 rounded-2xl border border-[var(--mp-border)] bg-[var(--mp-surface-subtle)] text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="min-h-[42px] px-3 rounded-2xl border border-[var(--mp-border)] bg-[var(--mp-surface-subtle)] text-sm"
                  >
                    <option value="Planning">Planning</option>
                    <option value="Active">Active</option>
                    <option value="On Hold">On Hold</option>
                    <option value="Completed">Completed</option>
                  </select>
                  <input
                    type="text"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    placeholder="Deadline"
                    className="min-h-[42px] px-3 rounded-2xl border border-[var(--mp-border)] bg-[var(--mp-surface-subtle)] text-sm"
                  />
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="min-h-[40px] px-3.5 rounded-2xl text-xs font-semibold text-[var(--mp-text-muted)] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="min-h-[40px] px-4 rounded-2xl text-xs font-semibold text-white bg-[var(--mp-accent)] cursor-pointer"
                  >
                    {'Save'}
                  </button>
                </div>
              </form>
            )}
          </div>
        );
      })}
    </div>
  );
}
