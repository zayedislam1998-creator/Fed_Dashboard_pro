import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  Plus,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Trash2,
  Edit3,
  Download,
  Video,
  Users,
  Check,
  AlertCircle,
  X,
  Repeat,
  Loader2,
} from 'lucide-react';
import {
  deleteEngineRecord,
  fetchEngineCollection,
  fetchWorkspaceMeetings,
  saveEngineRecord,
  WorkspaceCalendarEventItem,
  WorkspaceHrRecordItem,
  WorkspaceMeetingItem,
} from '../services/workspaceApi';

export type CalendarSubTab = 'agenda' | 'create_event';

interface CalendarViewProps {
  activeSubTab?: CalendarSubTab;
  onSubTabChange?: (tab: CalendarSubTab) => void;
}

type GridViewMode = 'month' | 'week' | 'day' | 'agenda';

interface UnifiedCalendarEntry {
  id: string;
  source: 'EVENT' | 'MEETING' | 'LEAVE';
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string;
  endTime: string;
  location: string;
  description: string;
  color: string;
  badge: string;
  rawEvent?: WorkspaceCalendarEventItem;
}

const EVENT_COLORS = ['#0B57D0', '#059669', '#D97706', '#DC2626', '#7C3AED', '#0F172A'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 15 }, (_, i) => i + 7); // 07:00 - 21:00

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function addMonths(d: Date, months: number): Date {
  const copy = new Date(d);
  copy.setMonth(copy.getMonth() + months);
  return copy;
}

function parseHrDate(raw: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? '' : toIsoDate(parsed);
}

function parseMeetingDateTime(raw: string): { date: string; startTime: string } {
  const fallbackDate = toIsoDate(new Date());
  if (!raw) return { date: fallbackDate, startTime: '10:00' };
  const isoMatch = raw.match(/(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}))?/);
  if (isoMatch) {
    return { date: isoMatch[1], startTime: isoMatch[2] || '10:00' };
  }
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return {
      date: toIsoDate(parsed),
      startTime: `${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`,
    };
  }
  return { date: fallbackDate, startTime: '10:00' };
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  activeSubTab = 'agenda',
  onSubTabChange,
}) => {
  const [subTab, setSubTab] = useState<CalendarSubTab>(activeSubTab);
  const [viewMode, setViewMode] = useState<GridViewMode>('month');
  const [cursorDate, setCursorDate] = useState<Date>(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string>(() => toIsoDate(new Date()));

  const [events, setEvents] = useState<WorkspaceCalendarEventItem[]>([]);
  const [meetings, setMeetings] = useState<WorkspaceMeetingItem[]>([]);
  const [leaves, setLeaves] = useState<WorkspaceHrRecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);

  // Source filters
  const [showEvents, setShowEvents] = useState(true);
  const [showMeetings, setShowMeetings] = useState(true);
  const [showLeaves, setShowLeaves] = useState(true);

  // Event modal state
  const [showEventModal, setShowEventModal] = useState(activeSubTab === 'create_event');
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState<'MEETING' | 'DEADLINE' | 'REMINDER' | 'HOLIDAY'>('MEETING');
  const [formDate, setFormDate] = useState(() => toIsoDate(new Date()));
  const [formStart, setFormStart] = useState('10:00');
  const [formEnd, setFormEnd] = useState('11:00');
  const [formLocation, setFormLocation] = useState('Conference Room / Online');
  const [formDesc, setFormDesc] = useState('');
  const [formColor, setFormColor] = useState('#0B57D0');
  const [formRepeat, setFormRepeat] = useState<'NONE' | 'WEEKLY_4' | 'MONTHLY_3'>('NONE');
  const [saving, setSaving] = useState(false);

  const [detailEntry, setDetailEntry] = useState<UnifiedCalendarEntry | null>(null);

  useEffect(() => {
    setSubTab(activeSubTab);
    if (activeSubTab === 'create_event') {
      openCreateModal(selectedDate);
    }
  }, [activeSubTab]);

  const showNotice = (text: string, ok = true) => {
    setToast({ text, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const loadAllCalendarSources = async () => {
    setLoading(true);
    try {
      const [evList, mtList, hrList] = await Promise.all([
        fetchEngineCollection<WorkspaceCalendarEventItem>('calendarEvents'),
        fetchWorkspaceMeetings().catch(() => [] as WorkspaceMeetingItem[]),
        fetchEngineCollection<WorkspaceHrRecordItem>('hrRecords').catch(() => [] as WorkspaceHrRecordItem[]),
      ]);
      setEvents(evList);
      setMeetings(mtList);
      setLeaves(hrList.filter((r) => r.recordType === 'LEAVE'));
    } catch (err: any) {
      showNotice(err.message || 'Failed to load calendar schedules.', false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllCalendarSources();
  }, []);

  const unifiedEntries = useMemo<UnifiedCalendarEntry[]>(() => {
    const out: UnifiedCalendarEntry[] = [];
    if (showEvents) {
      for (const e of events) {
        out.push({
          id: e.id,
          source: 'EVENT',
          title: e.title,
          date: e.date,
          startTime: e.startTime || '09:00',
          endTime: e.endTime || '10:00',
          location: e.location || '',
          description: e.description || '',
          color: e.color || '#0B57D0',
          badge: e.eventType,
          rawEvent: e,
        });
      }
    }
    if (showMeetings) {
      for (const m of meetings) {
        const dt = parseMeetingDateTime(m.scheduledFor || '');
        const endH = Math.min(23, Number(dt.startTime.split(':')[0] || 10) + 1);
        out.push({
          id: `mt-${m.id}`,
          source: 'MEETING',
          title: `Meet: ${m.title}`,
          date: dt.date,
          startTime: dt.startTime,
          endTime: `${String(endH).padStart(2, '0')}:${dt.startTime.split(':')[1] || '00'}`,
          location: m.meetingCode ? `Code: ${m.meetingCode}` : 'Workspace Meet',
          description: m.agenda || '',
          color: '#059669',
          badge: 'MEET',
        });
      }
    }
    if (showLeaves) {
      for (const l of leaves) {
        const iso = parseHrDate(l.dateOrMonth);
        if (!iso) continue;
        out.push({
          id: `lv-${l.id}`,
          source: 'LEAVE',
          title: `Leave: ${l.memberName} (${l.status})`,
          date: iso,
          startTime: '09:00',
          endTime: '18:00',
          location: 'HR Time Off',
          description: String(l.details?.reason || l.details?.leaveType || 'Employee leave record'),
          color: '#D97706',
          badge: 'LEAVE',
        });
      }
    }
    return out.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  }, [events, meetings, leaves, showEvents, showMeetings, showLeaves]);

  const entriesByDate = useMemo(() => {
    const map = new Map<string, UnifiedCalendarEntry[]>();
    for (const item of unifiedEntries) {
      const list = map.get(item.date) || [];
      list.push(item);
      map.set(item.date, list);
    }
    return map;
  }, [unifiedEntries]);

  const monthGridDays = useMemo(() => {
    const year = cursorDate.getFullYear();
    const month = cursorDate.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const startOffset = firstOfMonth.getDay();
    const gridStart = addDays(firstOfMonth, -startOffset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = addDays(gridStart, i);
      return {
        dateObj: d,
        iso: toIsoDate(d),
        inMonth: d.getMonth() === month,
        isToday: toIsoDate(d) === toIsoDate(new Date()),
      };
    });
  }, [cursorDate]);

  const weekDays = useMemo(() => {
    const start = addDays(cursorDate, -cursorDate.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(start, i);
      return {
        dateObj: d,
        iso: toIsoDate(d),
        label: `${WEEKDAYS[d.getDay()]} ${d.getDate()}`,
        isToday: toIsoDate(d) === toIsoDate(new Date()),
      };
    });
  }, [cursorDate]);

  const openCreateModal = (dateStr: string, startStr = '10:00') => {
    setEditingId(undefined);
    setFormTitle('');
    setFormType('MEETING');
    setFormDate(dateStr);
    setFormStart(startStr);
    const startH = Number(startStr.split(':')[0] || 10);
    setFormEnd(`${String(Math.min(23, startH + 1)).padStart(2, '0')}:00`);
    setFormLocation('Workspace Room / Video Link');
    setFormDesc('');
    setFormColor('#0B57D0');
    setFormRepeat('NONE');
    setShowEventModal(true);
  };

  const openEditModal = (ev: WorkspaceCalendarEventItem) => {
    setEditingId(ev.id);
    setFormTitle(ev.title);
    setFormType(ev.eventType);
    setFormDate(ev.date);
    setFormStart(ev.startTime || '10:00');
    setFormEnd(ev.endTime || '11:00');
    setFormLocation(ev.location || '');
    setFormDesc(ev.description || '');
    setFormColor(ev.color || '#0B57D0');
    setFormRepeat('NONE');
    setDetailEntry(null);
    setShowEventModal(true);
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;
    setSaving(true);
    try {
      const datesToCreate: string[] = [formDate];
      if (!editingId && formRepeat === 'WEEKLY_4') {
        const base = new Date(`${formDate}T00:00:00`);
        for (let w = 1; w <= 3; w++) datesToCreate.push(toIsoDate(addDays(base, w * 7)));
      } else if (!editingId && formRepeat === 'MONTHLY_3') {
        const base = new Date(`${formDate}T00:00:00`);
        for (let m = 1; m <= 2; m++) datesToCreate.push(toIsoDate(addMonths(base, m)));
      }

      let latestList = events;
      for (let i = 0; i < datesToCreate.length; i++) {
        const res = await saveEngineRecord<WorkspaceCalendarEventItem>('calendarEvents', {
          id: i === 0 ? editingId : undefined,
          title: formTitle.trim(),
          description: formDesc.trim(),
          eventType: formType,
          date: datesToCreate[i],
          startTime: formStart,
          endTime: formEnd,
          location: formLocation.trim(),
          color: formColor,
        });
        latestList = res.items;
      }
      setEvents(latestList);
      setShowEventModal(false);
      onSubTabChange?.('agenda');
      showNotice(
        datesToCreate.length > 1
          ? `Created ${datesToCreate.length} recurring events!`
          : editingId
          ? 'Event updated.'
          : 'Event added to Calendar.'
      );
    } catch (err: any) {
      showNotice(err.message || 'Failed to save event.', false);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (!window.confirm('Delete this calendar event?')) return;
    try {
      const items = await deleteEngineRecord<WorkspaceCalendarEventItem>('calendarEvents', id);
      setEvents(items);
      setDetailEntry(null);
      showNotice('Event deleted.');
    } catch (err: any) {
      showNotice(err.message || 'Failed to delete event.', false);
    }
  };

  const handleExportIcs = () => {
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Workspace Enterprise Calendar//EN',
    ];
    for (const item of unifiedEntries) {
      const dCompact = item.date.replace(/-/g, '');
      const st = `${(item.startTime || '09:00').replace(':', '')}00`;
      const en = `${(item.endTime || '10:00').replace(':', '')}00`;
      lines.push(
        'BEGIN:VEVENT',
        `UID:${item.id}@workspace.local`,
        `DTSTART:${dCompact}T${st}`,
        `DTEND:${dCompact}T${en}`,
        `SUMMARY:${item.title.replace(/[\r\n]/g, ' ')}`,
        `DESCRIPTION:${(item.description || '').replace(/[\r\n]/g, ' ')}`,
        `LOCATION:${(item.location || '').replace(/[\r\n]/g, ' ')}`,
        'END:VEVENT'
      );
    }
    lines.push('END:VCALENDAR');
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Workspace_Calendar_${toIsoDate(cursorDate)}.ics`;
    a.click();
    showNotice('Exported .ics calendar file!');
  };

  const monthTitle = cursorDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const todayIso = toIsoDate(new Date());

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden">
      {/* Top Google-Calendar-Style Toolbar */}
      <div className="px-4 sm:px-6 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#0B57D0]">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-extrabold text-slate-900">Calendar & Schedule Grid</h1>
            <p className="text-[11px] text-slate-500">
              Month/Week/Day visual grid synced with Meetings & HR Leaves
            </p>
          </div>

          <div className="flex items-center gap-1 ml-2">
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                setCursorDate(now);
                setSelectedDate(toIsoDate(now));
              }}
              className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-700 cursor-pointer"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() =>
                setCursorDate((d) =>
                  viewMode === 'week' ? addDays(d, -7) : viewMode === 'day' ? addDays(d, -1) : addMonths(d, -1)
                )
              }
              className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-600 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() =>
                setCursorDate((d) =>
                  viewMode === 'week' ? addDays(d, 7) : viewMode === 'day' ? addDays(d, 1) : addMonths(d, 1)
                )
              }
              className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-600 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <span className="text-sm font-extrabold text-slate-900 ml-1 min-w-[140px]">{monthTitle}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-0.5">
            {(['month', 'week', 'day', 'agenda'] as GridViewMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setViewMode(m)}
                className={`px-3 py-1 rounded-lg text-xs font-bold capitalize cursor-pointer ${
                  viewMode === m ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleExportIcs}
            title="Export Calendar (.ics)"
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            .ics
          </button>

          <button
            type="button"
            onClick={() => openCreateModal(selectedDate)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#0B57D0] hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            New Event
          </button>
        </div>
      </div>

      {toast && (
        <div
          className={`px-4 py-2 text-xs font-semibold flex items-center gap-2 border-b ${
            toast.ok ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
          }`}
        >
          {toast.ok ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.text}
        </div>
      )}

      {/* Body: Left Mini Calendar + Main Grid */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <aside className="hidden lg:flex w-64 border-r border-slate-200 bg-slate-50/70 p-4 flex-col gap-5 overflow-y-auto shrink-0">
          {/* Mini Month Navigator */}
          <div className="bg-white rounded-2xl border border-slate-200 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-900">{monthTitle}</span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setCursorDate((d) => addMonths(d, -1))}
                  className="p-1 rounded hover:bg-slate-100 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setCursorDate((d) => addMonths(d, 1))}
                  className="p-1 rounded hover:bg-slate-100 cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-bold text-slate-400 mb-1">
              {WEEKDAYS.map((w) => (
                <div key={w}>{w.slice(0, 1)}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5 text-center text-[11px]">
              {monthGridDays.map((cell) => {
                const hasAny = (entriesByDate.get(cell.iso)?.length || 0) > 0;
                const isSel = selectedDate === cell.iso;
                return (
                  <button
                    key={cell.iso}
                    type="button"
                    onClick={() => {
                      setSelectedDate(cell.iso);
                      setCursorDate(cell.dateObj);
                    }}
                    className={`h-7 rounded-lg flex flex-col items-center justify-center relative cursor-pointer ${
                      isSel
                        ? 'bg-[#0B57D0] text-white font-bold'
                        : cell.isToday
                        ? 'bg-blue-100 text-[#0B57D0] font-bold'
                        : cell.inMonth
                        ? 'text-slate-700 hover:bg-slate-100'
                        : 'text-slate-300'
                    }`}
                  >
                    {cell.dateObj.getDate()}
                    {hasAny && !isSel && (
                      <span className="w-1 h-1 rounded-full bg-[#0B57D0] absolute bottom-0.5" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Calendar Layers / Sources */}
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Calendar Layers</p>
            <label className="flex items-center gap-2.5 p-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-800 cursor-pointer">
              <input type="checkbox" checked={showEvents} onChange={(e) => setShowEvents(e.target.checked)} />
              <span className="w-2.5 h-2.5 rounded-full bg-[#0B57D0]" />
              Workspace Events ({events.length})
            </label>
            <label className="flex items-center gap-2.5 p-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-800 cursor-pointer">
              <input type="checkbox" checked={showMeetings} onChange={(e) => setShowMeetings(e.target.checked)} />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
              Meet Schedule ({meetings.length})
            </label>
            <label className="flex items-center gap-2.5 p-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-800 cursor-pointer">
              <input type="checkbox" checked={showLeaves} onChange={(e) => setShowLeaves(e.target.checked)} />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-600" />
              HR Team Leaves ({leaves.length})
            </label>
          </div>

          {/* Selected Day Summary */}
          <div className="bg-white rounded-2xl border border-slate-200 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900">{selectedDate}</span>
              <button
                type="button"
                onClick={() => openCreateModal(selectedDate)}
                className="text-[11px] font-bold text-[#0B57D0] hover:underline cursor-pointer"
              >
                + Add
              </button>
            </div>
            {(entriesByDate.get(selectedDate) || []).length === 0 ? (
              <p className="text-[11px] text-slate-400">No events scheduled for this date.</p>
            ) : (
              (entriesByDate.get(selectedDate) || []).map((item) => (
                <div
                  key={item.id}
                  onClick={() => setDetailEntry(item)}
                  className="p-2 rounded-xl border border-slate-100 hover:border-slate-300 cursor-pointer text-[11px]"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="font-bold text-slate-800 truncate">{item.title}</span>
                  </div>
                  <p className="text-slate-400 pl-3.5">
                    {item.startTime} – {item.endTime}
                  </p>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Main Calendar Canvas */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-7 h-7 animate-spin text-[#0B57D0]" />
            </div>
          ) : viewMode === 'month' ? (
            <div className="h-full min-h-[600px] flex flex-col">
              <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center py-2 text-[11px] font-bold uppercase text-slate-500">
                {WEEKDAYS.map((w) => (
                  <div key={w}>{w}</div>
                ))}
              </div>
              <div className="flex-1 grid grid-cols-7 grid-rows-6">
                {monthGridDays.map((cell) => {
                  const dayItems = entriesByDate.get(cell.iso) || [];
                  const isSel = selectedDate === cell.iso;
                  return (
                    <div
                      key={cell.iso}
                      onClick={() => setSelectedDate(cell.iso)}
                      onDoubleClick={() => openCreateModal(cell.iso)}
                      className={`border-r border-b border-slate-200 p-1.5 flex flex-col gap-1 cursor-pointer transition-colors min-h-[96px] ${
                        !cell.inMonth ? 'bg-slate-50/70' : isSel ? 'bg-blue-50/40' : 'bg-white hover:bg-slate-50/60'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            cell.isToday
                              ? 'bg-[#0B57D0] text-white'
                              : cell.inMonth
                              ? 'text-slate-800'
                              : 'text-slate-400'
                          }`}
                        >
                          {cell.dateObj.getDate()}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openCreateModal(cell.iso);
                          }}
                          className="opacity-0 hover:opacity-100 focus:opacity-100 p-0.5 rounded text-slate-400 hover:text-[#0B57D0] cursor-pointer"
                          title="Quick Add Event"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="space-y-1 overflow-hidden">
                        {dayItems.slice(0, 3).map((ev) => (
                          <div
                            key={ev.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setDetailEntry(ev);
                            }}
                            className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold text-white truncate shadow-xs cursor-pointer"
                            style={{ backgroundColor: ev.color }}
                            title={`${ev.startTime} ${ev.title}`}
                          >
                            {ev.startTime} {ev.title}
                          </div>
                        ))}
                        {dayItems.length > 3 && (
                          <p className="text-[10px] font-bold text-slate-500 pl-1">
                            +{dayItems.length - 3} more
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : viewMode === 'week' ? (
            /* Week Hourly Time Grid */
            <div className="min-w-[760px]">
              <div className="grid grid-cols-[72px_repeat(7,minmax(0,1fr))] border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
                <div className="p-2 text-[10px] font-bold text-slate-400 text-center">GMT</div>
                {weekDays.map((wd) => (
                  <div
                    key={wd.iso}
                    onClick={() => setSelectedDate(wd.iso)}
                    className={`p-2 text-center border-l border-slate-200 cursor-pointer ${
                      wd.isToday ? 'bg-blue-50 text-[#0B57D0]' : 'text-slate-700'
                    }`}
                  >
                    <p className="text-xs font-extrabold">{wd.label}</p>
                    <p className="text-[10px] text-slate-400">{(entriesByDate.get(wd.iso) || []).length} items</p>
                  </div>
                ))}
              </div>
              {HOURS.map((hr) => {
                const hrLabel = `${String(hr).padStart(2, '0')}:00`;
                return (
                  <div key={hr} className="grid grid-cols-[72px_repeat(7,minmax(0,1fr))] border-b border-slate-100 min-h-[56px]">
                    <div className="p-1.5 text-[11px] font-mono text-slate-400 text-right pr-2 bg-slate-50/40">
                      {hrLabel}
                    </div>
                    {weekDays.map((wd) => {
                      const slotEvents = (entriesByDate.get(wd.iso) || []).filter(
                        (e) => Number((e.startTime || '09').split(':')[0]) === hr
                      );
                      return (
                        <div
                          key={`${wd.iso}-${hr}`}
                          onClick={() => openCreateModal(wd.iso, hrLabel)}
                          className="border-l border-slate-100 p-1 hover:bg-blue-50/30 cursor-pointer space-y-1"
                        >
                          {slotEvents.map((ev) => (
                            <div
                              key={ev.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setDetailEntry(ev);
                              }}
                              className="p-1.5 rounded-lg text-[10px] font-bold text-white shadow-xs"
                              style={{ backgroundColor: ev.color }}
                            >
                              <div className="truncate">{ev.title}</div>
                              <div className="opacity-85 text-[9px]">
                                {ev.startTime}–{ev.endTime}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ) : viewMode === 'day' ? (
            /* Single Day Time Schedule */
            <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-extrabold text-slate-900">
                  Schedule for {selectedDate} {selectedDate === todayIso ? '(Today)' : ''}
                </h2>
                <button
                  type="button"
                  onClick={() => openCreateModal(selectedDate)}
                  className="px-3 py-1.5 rounded-xl bg-[#0B57D0] text-white text-xs font-bold cursor-pointer"
                >
                  + Add Slot
                </button>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden">
                {HOURS.map((hr) => {
                  const hrLabel = `${String(hr).padStart(2, '0')}:00`;
                  const slotItems = (entriesByDate.get(selectedDate) || []).filter(
                    (e) => Number((e.startTime || '09').split(':')[0]) === hr
                  );
                  return (
                    <div
                      key={hr}
                      onClick={() => openCreateModal(selectedDate, hrLabel)}
                      className="flex min-h-[54px] hover:bg-slate-50 cursor-pointer"
                    >
                      <div className="w-20 p-3 text-xs font-mono text-slate-400 border-r border-slate-100 shrink-0">
                        {hrLabel}
                      </div>
                      <div className="flex-1 p-2 flex flex-wrap gap-2">
                        {slotItems.map((ev) => (
                          <div
                            key={ev.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setDetailEntry(ev);
                            }}
                            className="px-3 py-1.5 rounded-xl text-white text-xs font-bold flex items-center gap-2"
                            style={{ backgroundColor: ev.color }}
                          >
                            <span>{ev.title}</span>
                            <span className="text-[10px] opacity-85">
                              ({ev.startTime}–{ev.endTime})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Agenda List View */
            <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-3">
              {unifiedEntries.length === 0 ? (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-12 text-center text-xs text-slate-500">
                  No scheduled events, meetings, or leaves found.
                </div>
              ) : (
                unifiedEntries.map((ev) => (
                  <div
                    key={ev.id}
                    onClick={() => setDetailEntry(ev)}
                    className="bg-white border border-slate-200 hover:border-[#0B57D0] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 cursor-pointer"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-3 h-10 rounded-full shrink-0 mt-0.5"
                        style={{ backgroundColor: ev.color }}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">{ev.title}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                            {ev.badge}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {ev.date} • {ev.startTime}–{ev.endTime}
                          </span>
                          {ev.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5" />
                              {ev.location}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {ev.rawEvent && (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => openEditModal(ev.rawEvent!)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-[#0B57D0] hover:bg-blue-50 cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteEvent(ev.rawEvent!.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Event Details Modal */}
      {detailEntry && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 text-white flex items-center justify-between" style={{ backgroundColor: detailEntry.color }}>
              <div className="flex items-center gap-2">
                {detailEntry.source === 'MEETING' ? (
                  <Video className="w-4 h-4" />
                ) : detailEntry.source === 'LEAVE' ? (
                  <Users className="w-4 h-4" />
                ) : (
                  <CalendarIcon className="w-4 h-4" />
                )}
                <span className="text-xs font-bold uppercase">{detailEntry.badge}</span>
              </div>
              <button type="button" onClick={() => setDetailEntry(null)} className="cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <h3 className="text-base font-extrabold text-slate-900">{detailEntry.title}</h3>
              <p className="text-xs text-slate-600 flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                {detailEntry.date} • {detailEntry.startTime} – {detailEntry.endTime}
              </p>
              {detailEntry.location && (
                <p className="text-xs text-slate-600 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  {detailEntry.location}
                </p>
              )}
              {detailEntry.description && (
                <p className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-3">
                  {detailEntry.description}
                </p>
              )}
              {detailEntry.rawEvent && (
                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleDeleteEvent(detailEntry.rawEvent!.id)}
                    className="px-3.5 py-1.5 rounded-xl border border-red-200 text-red-700 hover:bg-red-50 text-xs font-bold cursor-pointer"
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditModal(detailEntry.rawEvent!)}
                    className="px-4 py-1.5 rounded-xl bg-[#0B57D0] text-white text-xs font-bold cursor-pointer"
                  >
                    Edit Event
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Event Modal */}
      {showEventModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <form onSubmit={handleSaveEvent} className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                {editingId ? 'Edit Calendar Event' : 'Schedule New Workspace Event'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowEventModal(false);
                  onSubTabChange?.('agenda');
                }}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Event Title</label>
                <input
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g., Product Roadmap Sync or Client Review"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Type</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                  >
                    <option value="MEETING">Meeting</option>
                    <option value="DEADLINE">Deadline</option>
                    <option value="REMINDER">Reminder</option>
                    <option value="HOLIDAY">Holiday / Company Off</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                </div>
                {!editingId && (
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-bold text-slate-600 mb-1 flex items-center gap-1">
                      <Repeat className="w-3 h-3" /> Repeat
                    </label>
                    <select
                      value={formRepeat}
                      onChange={(e) => setFormRepeat(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                    >
                      <option value="NONE">Does not repeat</option>
                      <option value="WEEKLY_4">Weekly (4x)</option>
                      <option value="MONTHLY_3">Monthly (3x)</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={formStart}
                    onChange={(e) => setFormStart(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">End Time</label>
                  <input
                    type="time"
                    value={formEnd}
                    onChange={(e) => setFormEnd(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Location / Video Link</label>
                <input
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Description / Agenda</label>
                <textarea
                  rows={2}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs resize-none"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600">Color Tag</span>
                <div className="flex items-center gap-2">
                  {EVENT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setFormColor(c)}
                      className={`w-6 h-6 rounded-full border-2 cursor-pointer ${
                        formColor === c ? 'border-slate-900 scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowEventModal(false);
                  onSubTabChange?.('agenda');
                }}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-[#0B57D0] text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Event'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
