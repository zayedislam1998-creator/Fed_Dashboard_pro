import React, { useMemo, useState } from 'react';
import { CheckCircle2, Clock } from 'lucide-react';
import { useSubmissionRequest } from '../../services/useSubmissionRequest';
import { submitMemberTaskProgress } from '../../services/workspaceAuth';
import {
  canMemberAction,
  EmptyAppCard,
  filterBySearch,
  MemberBootstrapData,
  StatusPill,
  taskStatusTone,
} from './shared';

export function MemberTasksView({
  data,
  searchQuery = '',
  readOnlyPreview,
  initialTaskId,
  onReload,
  onNotify,
}: {
  data: MemberBootstrapData;
  searchQuery?: string;
  readOnlyPreview?: boolean;
  initialTaskId?: string | null;
  onReload: () => Promise<void>;
  onNotify: (msg: string, isError?: boolean) => void;
}) {
  const [filter, setFilter] = useState<string>('ALL');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(initialTaskId || null);
  const [statusUpdate, setStatusUpdate] = useState<string>('In Progress');
  const [note, setNote] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const submissionRequest = useSubmissionRequest();
  const canSubmit = !readOnlyPreview && canMemberAction(data.capabilities, 'task.submit_own');
  const visibleTasks = useMemo(() => {
    const byStatus =
      filter === 'ALL' ? data.tasks : data.tasks.filter((t) => t.status === filter);
    return filterBySearch(byStatus, searchQuery, ['title', 'description', 'priority']);
  }, [data.tasks, filter, searchQuery]);

  const handleSubmit = async (e: React.FormEvent, taskId: string) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    try {
      const payload = { statusUpdate, note };
      await submitMemberTaskProgress(taskId, payload, submissionRequest.getId([taskId, payload]));
      submissionRequest.clear();
      setNote('');
      setEditingTaskId(null);
      await onReload();
      onNotify('Task progress saved.');
    } catch (err: any) {
      onNotify(err.message || 'Could not update task.', true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {['ALL', 'To Do', 'In Progress', 'Review', 'Completed'].map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setFilter(tab)}
            className={`min-h-[40px] px-4 rounded-2xl text-xs sm:text-sm font-semibold transition cursor-pointer ${
              filter === tab
                ? 'bg-[var(--mp-accent)] text-white shadow-sm'
                : 'mp-card-soft text-[var(--mp-text-muted)] hover:text-[var(--mp-text)]'
            }`}
          >
            {tab === 'ALL' ? `All (${data.tasks.length})` : tab}
          </button>
        ))}
      </div>

      {visibleTasks.length === 0 ? (
        <EmptyAppCard
          icon={CheckCircle2}
          title="No tasks in this view"
          subtitle="Tasks assigned to you or your team will appear here automatically."
        />
      ) : (
        <div className="space-y-3">
          {visibleTasks.map((task) => {
            const isExpanded = editingTaskId === task.id;
            return (
              <div key={task.id} className="mp-card-soft rounded-3xl p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill label={task.status} tone={taskStatusTone(task.status)} />
                      <StatusPill
                        label={task.priority || 'Medium'}
                        tone={task.priority === 'Critical' || task.priority === 'High' ? 'warn' : 'neutral'}
                      />
                      {task.dueDate && (
                        <span className="inline-flex items-center gap-1 text-xs text-[var(--mp-text-muted)]">
                          <Clock className="w-3.5 h-3.5" />
                          Due {task.dueDate}
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-[var(--mp-text)] mt-2">{task.title}</h3>
                    {task.description && (
                      <p className="text-sm text-[var(--mp-text-muted)] mt-1 whitespace-pre-line">
                        {task.description}
                      </p>
                    )}
                  </div>

                  {canSubmit && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTaskId(isExpanded ? null : task.id);
                        setStatusUpdate(task.status || 'In Progress');
                      }}
                      className="min-h-[42px] px-4 rounded-2xl text-xs font-semibold bg-[var(--mp-accent-soft)] text-[var(--mp-accent-text)] hover:opacity-90 transition shrink-0 cursor-pointer"
                    >
                      {isExpanded ? 'Close' : 'Update Progress'}
                    </button>
                  )}
                </div>

                {Array.isArray(task.submissions) && task.submissions.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-[var(--mp-border)] text-xs text-[var(--mp-text-muted)]">
                    Latest update by <strong className="text-[var(--mp-text)]">{task.submissions[0].submitterName}</strong>{' '}
                    ({task.submissions[0].submittedAt}):{' '}
                    {task.submissions[0].values?.ProgressNote || task.submissions[0].values?.Status || 'Updated'}
                  </div>
                )}

                {isExpanded && canSubmit && (
                  <form
                    onSubmit={(e) => handleSubmit(e, task.id)}
                    className="mt-4 pt-4 border-t border-[var(--mp-border)] space-y-3"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-[var(--mp-text-muted)] mb-1">
                          New Status
                        </label>
                        <select
                          value={statusUpdate}
                          onChange={(e) => setStatusUpdate(e.target.value)}
                          className="w-full min-h-[44px] px-3 rounded-2xl border border-[var(--mp-border)] bg-[var(--mp-surface-subtle)] text-sm text-[var(--mp-text)]"
                        >
                          <option value="To Do">To Do</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Review">Review</option>
                          <option value="Completed">Completed</option>
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-[var(--mp-text-muted)] mb-1">
                          Progress Note
                        </label>
                        <input
                          type="text"
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="What did you complete or need help with?"
                          className="w-full min-h-[44px] px-3.5 rounded-2xl border border-[var(--mp-border)] bg-[var(--mp-surface-subtle)] text-sm text-[var(--mp-text)]"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={saving}
                        className="min-h-[44px] px-5 rounded-2xl text-sm font-semibold text-white bg-[var(--mp-accent)] hover:bg-[var(--mp-accent-hover)] disabled:opacity-50 transition cursor-pointer"
                      >
                        {'Submit Update'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
