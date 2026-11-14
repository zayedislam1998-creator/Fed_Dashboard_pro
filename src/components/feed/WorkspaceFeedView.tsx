import { useCallback, useEffect, useRef, useState } from 'react';
import { Archive, CalendarDays, CheckCircle2, ClipboardList, FileText, Folder, LayoutGrid, Search, SlidersHorizontal, X } from 'lucide-react';
import { subscribeWorkspaceEvents } from '../../services/realtimeBus';

export const feedTabs = ['ACTIVE', 'ALL', 'DRAFT', 'PAST'] as const;
type FeedTab = typeof feedTabs[number];
const tabLabel: Record<FeedTab, string> = { ALL: 'All', ACTIVE: 'Active', DRAFT: 'Draft', PAST: 'Past' };
const labels: Record<string, string> = {
  cmh_tasks: 'Task', cmh_projects: 'Project', cmh_forms: 'CMH Form', docs: 'Document',
  slides: 'Slides', forms: 'Form', posts: 'Post', files: 'File', folders: 'Folder',
  meet: 'Meeting', calendar: 'Calendar', sheets: 'Sheet', invoice: 'Invoice', expense: 'Expense',
  lead: 'Lead', ticket: 'Ticket', hr: 'HR record', wiki: 'Wiki', automations: 'Automation',
  team_groups: 'Team', members: 'Member', chat: 'Channel', bulk: 'Campaign', resume: 'Profile', corporate: 'Website',
};
type FeedItem = {
  id: string; title: string; sourceType: string; sourceId: string; lifecycle: FeedTab;
  day: string; createdAt: string; creator: string | null; dueDate: string | null; removed: boolean;
  assigned: boolean; status: string | null; progress: number | null; reason: string | null;
};
type FeedMember = { id: string; name: string; status: string; seenAt: string | null; progress: number; reason: string | null };
type Detail = { item: { lifecycle: FeedTab }; canManage: boolean; members: FeedMember[] };
type FeedPage = { items: FeedItem[]; nextCursor: string | null; timezone: string; today: string };

const field = 'rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';
const button = 'rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800';
const primary = 'rounded-xl bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50';

async function feedApi<T>(path = '', init?: RequestInit): Promise<T> {
  const response = await fetch('/api/main-feed' + path, { ...init, credentials: 'same-origin' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Main Feed is unavailable.');
  return data;
}

export function FeedPreferences({ workspace = false }: { workspace?: boolean }) {
  const [value, setValue] = useState('');
  const [saved, setSaved] = useState('');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    feedApi<{ personal: string; workspace: string }>('/preferences', { signal: controller.signal })
      .then((data) => { const tab = workspace ? data.workspace : data.personal; setValue(tab); setSaved(tab); setReady(true); })
      .catch((error) => { if (!controller.signal.aborted) setMessage(error.message); });
    return () => controller.abort();
  }, [workspace]);
  async function save() {
    setBusy(true);
    setMessage('');
    try {
      await feedApi('/preferences', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: workspace ? 'workspace' : 'personal', tab: value }),
      });
      setSaved(value);
      setMessage('Preference saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-3">
      <label className="flex flex-wrap items-center gap-2 text-sm font-medium">
        {workspace ? 'Workspace default feed tab' : 'My default feed tab'}
        <select className={field} value={value} disabled={!ready || busy} onChange={(event) => setValue(event.target.value)}>
          {!workspace && <option value="">Workspace default</option>}
          {feedTabs.map((tab) => <option key={tab} value={tab}>{tabLabel[tab]}</option>)}
        </select>
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={primary} disabled={!ready || busy || value === saved} onClick={save}>{'Save'}</button>
        {value !== saved && <button type="button" className={button} onClick={() => setValue(saved)}>Discard</button>}
      </div>
      {message && <p role="status" className="text-sm">{message}</p>}
    </div>
  );
}

export function WorkspaceFeedView({ onOpen }: { onOpen: (type: string, id: string) => void }) {
  const [tab, setTab] = useState<FeedTab>('ACTIVE');
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [date, setDate] = useState('');
  const [mine, setMine] = useState(false);
  const [assigned, setAssigned] = useState(false);
  const [overdue, setOverdue] = useState(false);
  const [desktop, setDesktop] = useState(() => matchMedia('(min-width: 1024px)').matches);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [timezone, setTimezone] = useState('Asia/Dhaka');
  const [today, setToday] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const pendingPage = useRef<AbortController | null>(null);
  const [selected, setSelected] = useState<FeedItem | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailError, setDetailError] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [reviewUser, setReviewUser] = useState<string | null>(null);
  const [reviewReason, setReviewReason] = useState('');
  const [shareEmail, setShareEmail] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const media = matchMedia('(min-width: 1024px)');
    const listener = () => setDesktop(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    feedApi<{ personal: FeedTab | ''; workspace: FeedTab }>('/preferences', { signal: controller.signal })
      .then(({ personal, workspace }) => setTab(personal || workspace))
      .catch(() => {})
      .finally(() => { if (!controller.signal.aborted) setPreferencesReady(true); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    window.addEventListener('focus', refresh);
    const off = subscribeWorkspaceEvents((event) => {
      if (['cmh:updated', 'workspace:updated', 'members:updated', 'auth:permissions_updated'].includes(event)) refresh();
    });
    return () => { window.removeEventListener('focus', refresh); off(); };
  }, []);
  const getPage = useCallback((after: string | null, signal?: AbortSignal) => {
    const params = new URLSearchParams({ tab, limit: desktop ? '8' : '6' });
    if (query) params.set('q', query);
    if (date) params.set('date', date);
    if (mine) params.set('mine', '1');
    if (assigned) params.set('assigned', '1');
    if (overdue) params.set('overdue', '1');
    if (after) params.set('cursor', after);
    return feedApi<FeedPage>('?' + params, { signal });
  }, [tab, desktop, query, date, mine, assigned, overdue]);
  useEffect(() => {
    if (!preferencesReady) return;
    pendingPage.current?.abort();
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setCursor(null);
    getPage(null, controller.signal).then((data) => {
      setItems(data.items);
      setCursor(data.nextCursor);
      setTimezone(data.timezone);
      setToday(data.today);
    }).catch((failure) => { if (!controller.signal.aborted) setError(failure.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); pendingPage.current?.abort(); };
  }, [getPage, revision, preferencesReady]);

  async function loadMore() {
    if (!cursor || loading) return;
    pendingPage.current?.abort();
    const controller = new AbortController();
    pendingPage.current = controller;
    setLoading(true);
    setError('');
    try {
      const page = await getPage(cursor, controller.signal);
      if (controller.signal.aborted) return;
      setItems((old) => [...old, ...page.items.filter((item) => !old.some((previous) => previous.id === item.id))]);
      setCursor(page.nextCursor);
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Unable to load more.');
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }
  const patch = (id: string, payload: Record<string, unknown>) => feedApi('/' + id, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    setDetail(null);
    setDetailError('');
    setProgress(selected.progress || 0);
    setShareEmail('');
    setNotice('');
    setReviewUser(null);
    setReviewReason('');
    feedApi<Detail>('/' + selected.id, { signal: controller.signal })
      .then(setDetail).catch((failure) => { if (!controller.signal.aborted) setDetailError(failure.message); });
    if (selected.assigned && !selected.removed) void patch(selected.id, { action: 'seen' }).catch(() => {});
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setSelected(null); };
    window.addEventListener('keydown', escape);
    return () => { controller.abort(); window.removeEventListener('keydown', escape); };
  }, [selected]);
  async function act(payload: Record<string, unknown>) {
    if (!selected) return;
    setBusy(true);
    setDetailError('');
    try {
      await patch(selected.id, payload);
      setRevision((value) => value + 1);
      if (payload.action === 'lifecycle' || payload.action === 'submit' || payload.action === 'progress') setSelected(null);
      else {
        if (payload.action === 'share') {
          setShareEmail('');
          setNotice('Access granted.');
        }
        setDetail(await feedApi<Detail>('/' + selected.id));
        setReviewUser(null);
        setReviewReason('');
      }
    } catch (failure) {
      setDetailError(failure instanceof Error ? failure.message : 'Unable to update item.');
    } finally { setBusy(false); }
  }
  const days = new Map<string, FeedItem[]>();
  for (const item of items) {
    const day = days.get(item.day) || [];
    day.push(item);
    days.set(item.day, day);
  }
  const formatTime = new Intl.DateTimeFormat(undefined, { timeZone: timezone, hour: 'numeric', minute: '2-digit' });
  return (
    <section className="mx-auto w-full max-w-7xl space-y-3 px-3 py-3 sm:px-6">
      <div className="rounded-2xl border border-slate-200 bg-white px-3 py-1.5 shadow-2xs dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {/* Main Feed title */}
          <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-100 text-xs sm:text-sm shrink-0 pr-1">
            <LayoutGrid className="size-4 text-blue-600 shrink-0" />
            <span>Main Feed</span>
          </div>

          <div className="hidden sm:block h-3.5 w-px bg-slate-200 dark:bg-slate-700 shrink-0 mx-0.5" aria-hidden />

          {/* Feed Tabs: Active, All, Draft, Past */}
          <div className="flex items-center gap-1 shrink-0">
            {feedTabs.map((value) => (
              <button
                type="button"
                key={value}
                aria-pressed={tab === value}
                className={`h-7 px-2.5 rounded-full text-xs font-medium transition-colors shrink-0 ${
                  tab === value
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700'
                }`}
                onClick={() => setTab(value)}
              >
                {tabLabel[value]}
              </button>
            ))}
          </div>

          <div className="hidden sm:block h-3.5 w-px bg-slate-200 dark:bg-slate-700 shrink-0 mx-0.5" aria-hidden />

          {/* Filters: Created by me, Assigned to me, Overdue */}
          <div className="flex items-center gap-1 shrink-0">
            {[
              { label: 'Created by me', value: mine, set: setMine },
              { label: 'Assigned to me', value: assigned, set: setAssigned },
              { label: 'Overdue', value: overdue, set: setOverdue },
            ].map((filter) => (
              <button
                type="button"
                key={filter.label}
                aria-pressed={filter.value}
                className={`h-7 px-2.5 rounded-full text-xs font-medium transition-colors shrink-0 ${
                  filter.value
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700'
                }`}
                onClick={() => filter.set(!filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="hidden md:block h-3.5 w-px bg-slate-200 dark:bg-slate-700 shrink-0 mx-0.5" aria-hidden />

          {/* Small Search */}
          <div className="relative flex items-center shrink-0">
            <Search className="absolute left-2.5 size-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              aria-label="Search feed"
              placeholder="Search..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-7 w-28 sm:w-36 pl-7 pr-6 text-xs rounded-full border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:w-44 transition-all dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            {search && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearch('')}
                className="absolute right-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="size-3" />
              </button>
            )}
          </div>

          {/* Date Picker */}
          <div className="relative flex items-center shrink-0">
            <input
              aria-label="Jump to date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="h-7 text-xs rounded-full border border-slate-200 bg-white px-2.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
            {date && (
              <button
                type="button"
                title="Clear date"
                aria-label="Clear date"
                className="ml-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                onClick={() => setDate('')}
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Feed preferences button */}
          <div className="ml-auto flex items-center shrink-0">
            <button
              type="button"
              title="Feed preferences"
              aria-expanded={showPreferences}
              onClick={() => setShowPreferences(!showPreferences)}
              className={`h-7 px-2 flex items-center gap-1 text-xs rounded-full border transition-colors ${
                showPreferences
                  ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-500'
                  : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
              }`}
            >
              <SlidersHorizontal className="size-3.5" />
              <span className="hidden xl:inline text-xs">Preferences</span>
            </button>
          </div>
        </div>
      </div>
      {showPreferences && <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"><FeedPreferences /></div>}
      {error && <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-red-700 dark:text-red-300">{error}<button className={button} onClick={() => setRevision((value) => value + 1)}>Retry</button></div>}
      {!loading && !items.length && !error && <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">No items match this view.</p>}
      {[...days].map(([day, cards]) => (
        <div key={day} className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-300">{day === today ? 'Today Â· ' : ''}{day}</h2>
          <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
            {cards.map((item) => {
              const Icon = item.removed ? Archive : item.sourceType === 'cmh_tasks' ? ClipboardList : item.sourceType === 'folders' ? Folder : FileText;
              const isOverdue = item.lifecycle === 'ACTIVE' && item.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(item.dueDate) && item.dueDate < today;
              return <button type="button" key={item.id} onClick={() => setSelected(item)} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 text-left hover:border-blue-400 focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-slate-700 dark:bg-slate-900">
                <span className="flex items-center gap-1.5 text-xs font-medium text-blue-700 dark:text-blue-300"><Icon aria-hidden className="size-4 shrink-0" />{labels[item.sourceType] || item.sourceType}</span>
                <span className="mt-2 block break-words text-sm font-semibold">{item.title}</span>
                <span className="mt-1 block truncate text-xs text-slate-500">{formatTime.format(new Date(item.createdAt))}{item.creator ? ' Â· ' + item.creator : ''}</span>
                <span className={'mt-2 block text-xs ' + (isOverdue ? 'text-red-700 dark:text-red-300' : 'text-slate-600 dark:text-slate-300')}>
                  {item.removed ? 'Removed' : isOverdue ? 'Overdue' : item.status && item.status !== 'PENDING' ? item.status.replaceAll('_', ' ') : tabLabel[item.lifecycle]}
                </span>
              </button>;
            })}
          </div>
        </div>
      ))}
      {cursor && <button type="button" className={button} disabled={loading} onClick={loadMore}>{'Load more'}</button>}
      {selected && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/40 p-3 sm:items-center" onClick={() => { if (!busy) setSelected(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="feed-detail-title" className="max-h-[85vh] w-full max-w-xl space-y-4 overflow-auto rounded-2xl bg-white p-4 shadow-xl dark:bg-slate-900 sm:p-6" onClick={(event) => event.stopPropagation()}>
            <header className="flex items-start justify-between gap-3"><h2 id="feed-detail-title" className="text-lg font-semibold">{selected.title}</h2><button autoFocus type="button" className={button} disabled={busy} onClick={() => setSelected(null)}>Close</button></header>
            <p className="text-sm text-slate-500">{labels[selected.sourceType] || selected.sourceType} Â· {selected.day}{selected.dueDate ? ' Â· Due ' + selected.dueDate : ''}</p>
            {detailError && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{detailError}</p>}
            {notice && <p role="status" className="text-sm text-green-700 dark:text-green-300">{notice}</p>}
            {!selected.removed && <button type="button" className={primary} onClick={() => onOpen(selected.sourceType, selected.sourceId)}>Open in workspace</button>}
            {detail?.canManage && !selected.removed && <div className="flex flex-wrap gap-2">
              {(['ACTIVE', 'DRAFT', 'PAST'] as const).filter((value) => value !== detail.item.lifecycle).map((value) =>
                <button type="button" className={button} disabled={busy} key={value} onClick={() => {
                  if (value !== 'DRAFT' || confirm('Move this card to Draft? Shared members will no longer see it in Main Feed.')) void act({ action: 'lifecycle', lifecycle: value });
                }}>{value === 'ACTIVE' ? 'Activate' : 'Move to ' + tabLabel[value]}</button>)}
            </div>}
            {detail?.canManage && !selected.removed && ['cmh_tasks', 'cmh_projects', 'docs', 'forms', 'slides', 'files'].includes(selected.sourceType) && (
              <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => {
                event.preventDefault();
                void act({ action: 'share', email: shareEmail });
              }}>
                <label className="flex flex-1 flex-col gap-1 text-sm">
                  Workspace member email
                  <input type="email" required maxLength={254} className={field} value={shareEmail} onChange={(event) => setShareEmail(event.target.value)} />
                </label>
                <button type="submit" className={button} disabled={busy || !shareEmail.trim()}>{selected.sourceType.startsWith('cmh_') ? 'Assign' : 'Share'}</button>
              </form>
            )}
            {selected.assigned && selected.lifecycle === 'ACTIVE' && !selected.removed && !['APPROVED', 'SUBMITTED'].includes(selected.status || '') && <div className="flex flex-wrap items-center gap-2">
              <label className="text-sm">Progress <input type="number" min={0} max={100} className={field + ' w-20'} value={progress} onChange={(event) => setProgress(Number(event.target.value))} />%</label>
              <button className={button} disabled={busy || progress < 0 || progress > 100} onClick={() => act({ action: 'progress', progress })}>Save progress</button>
              <button className={primary} disabled={busy} onClick={() => act({ action: 'submit', progress: 100 })}>Submit for review</button>
            </div>}
            {selected.reason && <p className="text-sm">Review notes Â· {selected.reason}</p>}
            {detail && detail.members.length > 0 && <div className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold"><CheckCircle2 className="size-4" />{detail.members.filter((member) => member.status === 'APPROVED').length}/{detail.members.length} approved</h3>
              {detail.members.map((member) => <div key={member.id} className="rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700">
                <div className="flex flex-wrap justify-between gap-2"><strong>{member.name}</strong><span>{member.status === 'PENDING' && member.seenAt ? 'Seen' : member.status.replaceAll('_', ' ')} Â· {member.progress}%</span></div>
                {member.reason && <p className="mt-1">{member.reason}</p>}
                {member.status === 'SUBMITTED' && <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" className={primary} disabled={busy} onClick={() => act({ action: 'approve', userId: member.id })}>Approve</button>
                  <button type="button" className={button} disabled={busy} onClick={() => { setReviewUser(member.id); setReviewReason(''); }}>Request changes</button>
                </div>}
                {reviewUser === member.id && <div className="mt-2 flex flex-wrap gap-2">
                  <input className={field} aria-label="Changes required" placeholder="Changes required" value={reviewReason} maxLength={1000} onChange={(event) => setReviewReason(event.target.value)} />
                  <button type="button" className={primary} disabled={busy || !reviewReason.trim()} onClick={() => act({ action: 'request-changes', userId: member.id, reason: reviewReason })}>Send</button>
                </div>}
              </div>)}
            </div>}
          </section>
        </div>
      )}
    </section>
  );
}

