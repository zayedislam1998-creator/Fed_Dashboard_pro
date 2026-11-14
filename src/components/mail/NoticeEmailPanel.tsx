import { useState } from 'react';
import { fetchWorkspaceTeamsAndMembers, type WorkspaceMemberItem } from '../../services/workspaceApi';

export function NoticeEmailPanel({ noticeId }: { noticeId: string }) {
  const [members, setMembers] = useState<WorkspaceMemberItem[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  async function choose() {
    setBusy(true); setMessage(''); setError(false);
    try { setMembers((await fetchWorkspaceTeamsAndMembers()).members.filter((member) => member.email)); }
    catch { setError(true); setMessage('Could not load members. Try again.'); }
    finally { setBusy(false); }
  }
  async function send() {
    setBusy(true); setMessage(''); setError(false);
    try {
      const response = await fetch('/api/posts-notices/' + encodeURIComponent(noticeId) + '/email', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberIds: selected }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not queue the notice.');
      setMessage(result.queued ? 'Queued for ' + result.queued + ' recipient(s).' : 'No new deliveries. These addresses may already be queued.');
      setSelected([]);
    } catch (failure) { setError(true); setMessage(failure instanceof Error ? failure.message : 'Could not queue the notice.'); }
    finally { setBusy(false); }
  }
  const button = 'rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium disabled:opacity-50 dark:border-slate-700';
  return (
    <section className="my-4 space-y-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
      <h3 className="text-sm font-semibold">Email this notice</h3>
      {!members && <button type="button" className={button} disabled={busy} onClick={choose}>{'Choose recipients'}</button>}
      {members && <>
        <input aria-label="Search recipients" placeholder="Search members or email" className="w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-700" value={query} onChange={(event) => setQuery(event.target.value)} />
        <div className="max-h-44 space-y-1 overflow-y-auto">
          {members.filter((member) => (member.fullName + ' ' + member.email).toLowerCase().includes(query.trim().toLowerCase())).map((member) =>
            <label className="flex items-center gap-2 rounded p-1 text-sm" key={member.id}>
              <input type="checkbox" checked={selected.includes(member.id)} disabled={busy || (selected.length >= 200 && !selected.includes(member.id))}
                onChange={(event) => setSelected((old) => event.target.checked ? [...old, member.id] : old.filter((id) => id !== member.id))} />
              <span>{member.fullName} · {member.email}</span>
            </label>)}
        </div>
        <button type="button" className={button} disabled={busy || !selected.length} onClick={send}>Queue email ({selected.length})</button>
      </>}
      {message && <p role={error ? 'alert' : 'status'} className="text-sm">{message}</p>}
    </section>
  );
}
