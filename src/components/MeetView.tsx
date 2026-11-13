import React, { useState, useEffect } from 'react';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  ExternalLink,
  Copy,
  Check,
  Keyboard,
  X,
  Plus,
  Trash2,
  Edit3,
  Search,
  RefreshCw,
  Calendar,
  Clock,
  Sparkles,
} from 'lucide-react';
import {
  WorkspaceMeetingItem,
  fetchWorkspaceMeetings,
  saveWorkspaceMeeting,
  deleteWorkspaceMeeting,
  createGoogleMeetSpace,
  getGoogleMeetSpace,
} from '../services/workspaceApi';
import { ConfirmModal } from './ConfirmModal';

export type MeetSubTab = 'all_meetings' | 'new_meeting';

interface MeetViewProps {
  isAuthenticated: boolean;
  onRequireAuth: () => void;
  activeSubTab?: MeetSubTab;
  onSelectSubTab?: (tab: MeetSubTab) => void;
}

export const MeetView: React.FC<MeetViewProps> = ({
  isAuthenticated,
  onRequireAuth,
  activeSubTab = 'all_meetings',
  onSelectSubTab,
}) => {
  const [internalTab, setInternalTab] = useState<MeetSubTab>(activeSubTab);
  const currentTab = onSelectSubTab ? activeSubTab : internalTab;
  const setTab = (tab: MeetSubTab) => {
    setInternalTab(tab);
    onSelectSubTab?.(tab);
  };

  const [meetings, setMeetings] = useState<WorkspaceMeetingItem[]>([]);
  const [loadingList, setLoadingList] = useState<boolean>(true);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // New / Edit Meeting Form State
  const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null);
  const [title, setTitle] = useState<string>('');
  const [agenda, setAgenda] = useState<string>('');
  const [scheduledFor, setScheduledFor] = useState<string>('Today, 05:00 PM');
  const [durationMins, setDurationMins] = useState<number>(30);
  const [meetingCode, setMeetingCode] = useState<string>('');
  const [meetingUri, setMeetingUri] = useState<string>('');
  const [status, setStatus] = useState<'Active' | 'Scheduled' | 'Instant'>('Scheduled');

  // Quick Join / Camera Check State
  const [joinInput, setJoinInput] = useState<string>('');
  const [isMicOn, setIsMicOn] = useState<boolean>(true);
  const [isCamOn, setIsCamOn] = useState<boolean>(true);
  const [isConfirmGoogleCreateOpen, setIsConfirmGoogleCreateOpen] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadMeetings = async (silent = false) => {
    if (!silent) setLoadingList(true);
    try {
      const list = await fetchWorkspaceMeetings();
      setMeetings(list);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to load meetings.');
    } finally {
      if (!silent) setLoadingList(false);
    }
  };

  useEffect(() => {
    loadMeetings();
  }, []);

  const handleStartNewMeeting = () => {
    setEditingMeetingId(null);
    setTitle('');
    setAgenda('');
    setScheduledFor('Today, 05:00 PM');
    setDurationMins(30);
    setMeetingCode('');
    setMeetingUri('');
    setStatus('Scheduled');
    setErrorMsg(null);
    setTab('new_meeting');
  };

  const handleEditMeeting = (meet: WorkspaceMeetingItem) => {
    setEditingMeetingId(meet.id);
    setTitle(meet.title);
    setAgenda(meet.agenda || '');
    setScheduledFor(meet.scheduledFor || 'Instant Meeting');
    setDurationMins(meet.durationMins || 30);
    setMeetingCode(meet.meetingCode);
    setMeetingUri(meet.meetingUri);
    setStatus(meet.status || 'Active');
    setErrorMsg(null);
    setTab('new_meeting');
  };

  const handleSaveMeetingForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Please enter a meeting title.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    try {
      const saved = await saveWorkspaceMeeting({
        id: editingMeetingId || undefined,
        title: title.trim(),
        agenda: agenda.trim(),
        scheduledFor: scheduledFor.trim() || 'Instant Meeting',
        durationMins: Number(durationMins) || 30,
        meetingCode: meetingCode.trim() || undefined,
        meetingUri: meetingUri.trim() || undefined,
        status,
      });
      setMeetings(saved.meetings);
      setEditingMeetingId(null);
      setStatusBanner(`Saved meeting "${saved.meeting.title}"`);
      setTimeout(() => setStatusBanner(null), 3500);
      setTab('all_meetings');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save meeting.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteMeeting = async (meet: WorkspaceMeetingItem, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const remaining = await deleteWorkspaceMeeting(meet.id);
      setMeetings(remaining);
      setStatusBanner(`Deleted "${meet.title}"`);
      setTimeout(() => setStatusBanner(null), 3000);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to delete meeting.');
    }
  };

  const handleConfirmCreateGoogleSpace = async () => {
    setIsConfirmGoogleCreateOpen(false);
    setIsSaving(true);
    setErrorMsg(null);
    try {
      const meetingLabel = title.trim() || 'Instant Meet Room';
      const createdSpace = await createGoogleMeetSpace(meetingLabel);
      const saved = await saveWorkspaceMeeting({
        id: editingMeetingId || undefined,
        title: meetingLabel,
        agenda: agenda.trim() || 'Live video conference room',
        meetingCode: createdSpace.meetingCode,
        meetingUri: createdSpace.meetingUri,
        scheduledFor: 'Instant Meeting',
        durationMins: Number(durationMins) || 30,
        status: 'Instant',
      });
      setMeetings(saved.meetings);
      setMeetingCode(createdSpace.meetingCode);
      setMeetingUri(createdSpace.meetingUri);
      setStatusBanner(`Created Meet room (${createdSpace.meetingCode})`);
      setTimeout(() => setStatusBanner(null), 3500);
      setTab('all_meetings');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to create Meet room.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLookupSpace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinInput.trim()) return;

    setIsSaving(true);
    setErrorMsg(null);
    try {
      const found = await getGoogleMeetSpace(joinInput);
      const saved = await saveWorkspaceMeeting({
        title: found.label || `Meet Room ${found.meetingCode}`,
        agenda: 'Added via Meet code lookup',
        meetingCode: found.meetingCode,
        meetingUri: found.meetingUri,
        scheduledFor: 'Active Now',
        durationMins: 30,
        status: 'Active',
      });
      setMeetings(saved.meetings);
      setJoinInput('');
      setTab('all_meetings');
      setStatusBanner(`Added meeting ${found.meetingCode}`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not find or add Meet room.');
    } finally {
      setIsSaving(false);
    }
  };

  const copyToClipboard = (text: string, id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredMeetings = meetings.filter((m) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      m.title.toLowerCase().includes(q) ||
      m.meetingCode.toLowerCase().includes(q) ||
      m.agenda.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 md:rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
      {/* Top Action Bar: All Meetings | New Meeting */}
      <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-[#F8FAFD] dark:bg-slate-900/90 shrink-0">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setTab('all_meetings')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
              currentTab === 'all_meetings'
                ? 'bg-[#00897B] text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>All Meetings ({meetings.length})</span>
          </button>

          <button
            type="button"
            onClick={handleStartNewMeeting}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
              currentTab === 'new_meeting'
                ? 'bg-[#00897B] text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>
              {editingMeetingId && currentTab === 'new_meeting' ? 'Edit Meeting' : 'New Meeting'}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {currentTab === 'all_meetings' && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search meetings..."
                className="pl-8 pr-3 py-1 text-xs rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#00897B]"
              />
            </div>
          )}

          <button
            type="button"
            onClick={() => loadMeetings(false)}
            className="p-1.5 rounded-full text-slate-500 hover:bg-slate-200/60 dark:hover:bg-slate-800"
            title="Refresh meetings"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Banners */}
      {statusBanner && (
        <div className="px-4 py-1.5 bg-emerald-50 dark:bg-emerald-950/50 border-b border-emerald-200 text-xs text-emerald-800 dark:text-emerald-200 flex items-center justify-between">
          <span>{statusBanner}</span>
          <button type="button" onClick={() => setStatusBanner(null)}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="px-4 py-1.5 bg-red-50 dark:bg-red-950/50 border-b border-red-200 text-xs text-red-700 dark:text-red-300 flex items-center justify-between">
          <span>{errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg(null)}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* =====================================================================
          VIEW 1: ALL MEETINGS (Compact Single-Line List View)
      ===================================================================== */}
      {currentTab === 'all_meetings' ? (
        <div className="flex-1 overflow-y-auto">
          {loadingList ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3 animate-pulse">
                  <div className="w-4 h-4 rounded bg-slate-200 dark:bg-slate-800 shrink-0" />
                  <div className="flex-1 h-3.5 rounded bg-slate-100 dark:bg-slate-800/60" />
                  <div className="w-24 h-3 rounded bg-slate-200 dark:bg-slate-800 shrink-0" />
                </div>
              ))}
            </div>
          ) : filteredMeetings.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center p-6">
              <Video className="w-9 h-9 text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                No meetings scheduled yet
              </p>
              <p className="text-xs text-slate-500 mt-0.5 mb-3">
                Click "New Meeting" to create an instant or scheduled Meet room.
              </p>
              <button
                type="button"
                onClick={handleStartNewMeeting}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold bg-[#00897B] text-white"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Meeting</span>
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {filteredMeetings.map((meet) => (
                <div
                  key={meet.id}
                  onClick={() => handleEditMeeting(meet)}
                  className="group flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-[#F2F6FC] dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
                >
                  {/* Left: Single-Line Icon + Title + Code + Schedule + Agenda */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Video className="w-4 h-4 text-[#00897B] shrink-0" />
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[220px] sm:max-w-[320px]">
                      {meet.title}
                    </span>

                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shrink-0">
                      {meet.meetingCode}
                    </span>

                    <span className="hidden sm:inline-flex items-center gap-1 text-xs text-slate-500 shrink-0">
                      <Calendar className="w-3 h-3" />
                      <span>{meet.scheduledFor}</span>
                    </span>

                    <span className="hidden md:inline-flex items-center gap-1 text-[11px] text-slate-400 shrink-0">
                      <Clock className="w-3 h-3" />
                      <span>{meet.durationMins}m</span>
                    </span>

                    {meet.agenda && (
                      <span className="hidden lg:inline text-xs text-slate-400 truncate">
                        — {meet.agenda}
                      </span>
                    )}
                  </div>

                  {/* Right: Compact Single-Line Actions (Copy icon, Join button, Edit icon, Delete icon) */}
                  <div
                    className="flex items-center gap-1.5 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={(e) => copyToClipboard(meet.meetingUri, meet.id, e)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 dark:hover:bg-slate-700 transition-colors"
                      title="Copy Meeting Link"
                    >
                      {copiedId === meet.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>

                    <a
                      href={meet.meetingUri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-[#00897B] dark:text-teal-300 hover:bg-teal-100 text-xs font-semibold transition-colors"
                      title="Join Meet Room"
                    >
                      <span>Join</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>

                    <button
                      type="button"
                      onClick={() => handleEditMeeting(meet)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-[#00897B] hover:bg-slate-200/70 dark:hover:bg-slate-700 transition-colors"
                      title="Edit Meeting"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleDeleteMeeting(meet, e)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-700 transition-colors"
                      title="Delete Meeting"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* =====================================================================
           VIEW 2: NEW MEETING / EDIT MEETING VIEW
        ===================================================================== */
        <div className="flex-1 overflow-y-auto p-5 md:p-8">
          <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left: Create or Schedule Meeting Form */}
            <div className="lg:col-span-7 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {editingMeetingId ? 'Edit Meeting Details' : 'Create or Schedule New Meeting'}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Save a scheduled meeting or generate an instant Meet conference room.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsConfirmGoogleCreateOpen(true)}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-teal-50 dark:bg-teal-950/60 text-[#00897B] dark:text-teal-300 border border-teal-200 dark:border-teal-800 hover:bg-teal-100 text-xs font-semibold transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Instant Meet Room</span>
                </button>
              </div>

              <form onSubmit={handleSaveMeetingForm} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Meeting Title *
                    </label>
                    <input
                      type="text"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Client Kickoff & Architecture Review"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:border-[#00897B]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Scheduled Date & Time
                    </label>
                    <input
                      type="text"
                      value={scheduledFor}
                      onChange={(e) => setScheduledFor(e.target.value)}
                      placeholder="e.g. Tomorrow, 11:00 AM"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Duration (Minutes)
                    </label>
                    <input
                      type="number"
                      min={5}
                      max={480}
                      value={durationMins}
                      onChange={(e) => setDurationMins(Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Meeting Code (auto-generated if blank)
                    </label>
                    <input
                      type="text"
                      value={meetingCode}
                      onChange={(e) => setMeetingCode(e.target.value)}
                      placeholder="e.g. abc-defg-hij"
                      className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Meeting Link URL (optional)
                    </label>
                    <input
                      type="text"
                      value={meetingUri}
                      onChange={(e) => setMeetingUri(e.target.value)}
                      placeholder="https://meet.google.com/..."
                      className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Meeting Agenda / Notes
                    </label>
                    <textarea
                      rows={3}
                      value={agenda}
                      onChange={(e) => setAgenda(e.target.value)}
                      placeholder="Outline key discussion points or participant notes..."
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none resize-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setTab('all_meetings')}
                    className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 rounded-full"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2 rounded-full bg-[#00897B] hover:bg-teal-700 text-white text-xs font-semibold transition-colors"
                  >
                    {isSaving
                      ? 'Saving...'
                      : editingMeetingId
                      ? 'Update Meeting'
                      : 'Save Meeting'}
                  </button>
                </div>
              </form>
            </div>

            {/* Right: Quick Join by Code + Camera/Mic Preview */}
            <div className="lg:col-span-5 space-y-4">
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-3">
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Import or Join Existing Meet Code
                </div>
                <form onSubmit={handleLookupSpace} className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Keyboard className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={joinInput}
                      onChange={(e) => setJoinInput(e.target.value)}
                      placeholder="Enter a code or link"
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!joinInput.trim() || isSaving}
                    className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-[#00897B] text-white disabled:opacity-40"
                  >
                    Add
                  </button>
                </form>
              </div>

              <div className="aspect-video rounded-2xl bg-slate-900 flex flex-col items-center justify-between p-5 text-white">
                <div className="w-full text-xs text-slate-400">Pre-call check</div>
                <div className="flex flex-col items-center">
                  <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center mb-2">
                    {isCamOn ? (
                      <Video className="w-6 h-6 text-teal-400" />
                    ) : (
                      <VideoOff className="w-6 h-6 text-slate-500" />
                    )}
                  </div>
                  <span className="text-xs text-slate-300">
                    {isCamOn ? 'Camera ready' : 'Camera off'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsMicOn(!isMicOn)}
                    className={`p-2.5 rounded-full transition-colors ${
                      isMicOn ? 'bg-slate-800 text-white' : 'bg-red-600 text-white'
                    }`}
                  >
                    {isMicOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCamOn(!isCamOn)}
                    className={`p-2.5 rounded-full transition-colors ${
                      isCamOn ? 'bg-slate-800 text-white' : 'bg-red-600 text-white'
                    }`}
                  >
                    {isCamOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={isConfirmGoogleCreateOpen}
        title="Create Instant Meet Room?"
        description="Confirm creating an instant Meet conference room and adding it to All Meetings."
        confirmLabel="Create Meeting"
        isLoading={isSaving}
        onConfirm={handleConfirmCreateGoogleSpace}
        onCancel={() => setIsConfirmGoogleCreateOpen(false)}
      />
    </div>
  );
};
