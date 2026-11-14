import React, { useState, useEffect } from 'react';
import {
  Clock,
  CalendarOff,
  Wallet,
  Plus,
  Check,
  X,
  Trash2,
  CheckCircle2,
  Printer,
  Download,
  Calendar,
  List as ListIcon,
  Eye,
} from 'lucide-react';
import {
  WorkspaceHrRecordItem,
  WorkspaceMemberItem,
  fetchEngineCollection,
  saveEngineRecord,
  deleteEngineRecord,
  fetchCmhWorkspaceBootstrap,
} from '../../services/workspaceApi';
import { convertViaEngine } from '../../services/engineCache';

export type HrSubTab = 'attendance' | 'leaves' | 'payslips' | 'create_hr';

interface HrManagementViewProps {
  activeSubTab?: HrSubTab;
  onSubTabChange?: (tab: HrSubTab) => void;
}

export const HrManagementView: React.FC<HrManagementViewProps> = ({
  activeSubTab = 'attendance',
  onSubTabChange,
}) => {
  const [subTab, setSubTab] = useState<HrSubTab>(activeSubTab);
  const [records, setRecords] = useState<WorkspaceHrRecordItem[]>([]);
  const [members, setMembers] = useState<WorkspaceMemberItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<string | null>(null);
  const [attendanceViewMode, setAttendanceViewMode] = useState<'list' | 'matrix'>('matrix');
  const [previewPayslip, setPreviewPayslip] = useState<WorkspaceHrRecordItem | null>(null);

  const handleExportHrXlsx = async () => {
    try {
      const res = await convertViaEngine({
        action: 'SHEETS_TO_XLSX',
        title: `HR_Attendance_Payroll_${new Date().toISOString().slice(0, 10)}`,
        sheets: [
          {
            name: 'Attendance',
            columns: ['Member', 'Email', 'Date', 'Status', 'Check-In', 'Check-Out'],
            rows: attendanceList.map((r) => [
              r.memberName,
              r.memberEmail,
              r.dateOrMonth,
              r.status,
              String(r.details?.checkIn || ''),
              String(r.details?.checkOut || ''),
            ]),
          },
          {
            name: 'Leave Requests',
            columns: ['Member', 'Email', 'Date', 'Type', 'Status', 'Reason'],
            rows: leaveList.map((r) => [
              r.memberName,
              r.memberEmail,
              r.dateOrMonth,
              String(r.details?.leaveType || 'Leave'),
              r.status,
              String(r.details?.leaveReason || ''),
            ]),
          },
          {
            name: 'Payslips',
            columns: ['Member', 'Email', 'Month', 'Status', 'Net Salary'],
            rows: payslipList.map((r) => [
              r.memberName,
              r.memberEmail,
              r.dateOrMonth,
              r.status,
              String(r.details?.netSalary || 0),
            ]),
          },
        ],
        folderId: 'folder-documents',
      });
      setBanner(`Saved HR Report "${res.file.name}" to File Manager!`);
      setTimeout(() => setBanner(null), 3500);
    } catch (err: any) {
      setBanner(err?.message || 'HR export failed.');
    }
  };

  const handleSavePayslipPdf = async (rec: WorkspaceHrRecordItem) => {
    try {
      const res = await convertViaEngine({
        action: 'TEXT_TO_PDF',
        title: `Payslip_${rec.memberName}_${rec.dateOrMonth}`,
        lines: [
          'OFFICIAL WORKSPACE PAYSLIP',
          `Employee: ${rec.memberName} (${rec.memberEmail})`,
          `Pay Period: ${rec.dateOrMonth}`,
          `Payment Status: ${rec.status}`,
          '----------------------------------------',
          `Net Payable Salary: $${Number(rec.details?.netSalary || 0).toLocaleString()}`,
          `Generated: ${new Date().toLocaleDateString()}`,
        ],
        folderId: 'folder-documents',
      });
      setBanner(`Saved PDF Payslip "${res.file.name}" to Server File Manager!`);
      setTimeout(() => setBanner(null), 3500);
    } catch (err: any) {
      setBanner(err?.message || 'Payslip PDF export failed.');
    }
  };

  const [recordType, setRecordType] =
    useState<WorkspaceHrRecordItem['recordType']>('ATTENDANCE');
  const [memberName, setMemberName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [dateOrMonth, setDateOrMonth] = useState(() => new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState('Present');
  const [checkIn, setCheckIn] = useState('09:00');
  const [checkOut, setCheckOut] = useState('18:00');
  const [leaveType, setLeaveType] = useState('Annual Leave');
  const [leaveReason, setLeaveReason] = useState('');
  const [netSalary, setNetSalary] = useState(0);

  useEffect(() => {
    setSubTab(activeSubTab);
  }, [activeSubTab]);

  const switchTab = (tab: HrSubTab) => {
    setSubTab(tab);
    onSubTabChange?.(tab);
  };

  const loadHr = async () => {
    setLoading(true);
    try {
      const [recList, teamData] = await Promise.all([
        fetchEngineCollection<WorkspaceHrRecordItem>('hrRecords'),
        fetchCmhWorkspaceBootstrap(),
      ]);
      setRecords(recList);
      setMembers(teamData.members || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHr();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberName.trim()) return;
    const defaultStatus =
      recordType === 'ATTENDANCE'
        ? status
        : recordType === 'LEAVE'
        ? 'Pending'
        : 'Generated';
    const res = await saveEngineRecord<WorkspaceHrRecordItem>('hrRecords', {
      recordType,
      memberName: memberName.trim(),
      memberEmail: memberEmail.trim(),
      dateOrMonth,
      status: defaultStatus,
      details:
        recordType === 'ATTENDANCE'
          ? { checkIn, checkOut }
          : recordType === 'LEAVE'
          ? { leaveType, leaveReason }
          : { netSalary: Number(netSalary || 0) },
    });
    setRecords(res.items);
    setBanner(`${recordType} record saved for ${res.item.memberName}.`);
    setTimeout(() => setBanner(null), 3000);
    setMemberName('');
    setMemberEmail('');
    switchTab(
      recordType === 'ATTENDANCE'
        ? 'attendance'
        : recordType === 'LEAVE'
        ? 'leaves'
        : 'payslips'
    );
  };

  const attendanceList = records.filter((r) => r.recordType === 'ATTENDANCE');
  const leaveList = records.filter((r) => r.recordType === 'LEAVE');
  const payslipList = records.filter((r) => r.recordType === 'PAYSLIP');

  return (
    <div className="flex-1 flex flex-col bg-[#F8FAFC] overflow-hidden">
      {/* Top Sub-Navigation Bar */}
      <div className="px-4 sm:px-6 py-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => switchTab('attendance')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              subTab === 'attendance'
                ? 'bg-teal-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Attendance ({attendanceList.length})
          </button>
          <button
            type="button"
            onClick={() => switchTab('leaves')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              subTab === 'leaves'
                ? 'bg-teal-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <CalendarOff className="w-3.5 h-3.5" />
            Leave Requests ({leaveList.length})
          </button>
          <button
            type="button"
            onClick={() => switchTab('payslips')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              subTab === 'payslips'
                ? 'bg-teal-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Wallet className="w-3.5 h-3.5" />
            Payroll / Payslips ({payslipList.length})
          </button>
          <button
            type="button"
            onClick={() => switchTab('create_hr')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              subTab === 'create_hr'
                ? 'bg-teal-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            Record HR Entry
          </button>
        </div>

        <div className="flex items-center gap-2">
          {subTab === 'attendance' && (
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-0.5">
              <button
                type="button"
                onClick={() => setAttendanceViewMode('matrix')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                  attendanceViewMode === 'matrix' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" /> Matrix
              </button>
              <button
                type="button"
                onClick={() => setAttendanceViewMode('list')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                  attendanceViewMode === 'list' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                <ListIcon className="w-3.5 h-3.5" /> List
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={handleExportHrXlsx}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold hover:bg-emerald-100 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Export .xlsx
          </button>
        </div>
      </div>

      {banner && (
        <div className="px-4 py-2 bg-emerald-50 border-b border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {banner}
          </span>
          <button type="button" onClick={() => setBanner(null)}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {subTab !== 'create_hr' && (
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4">
          {subTab === 'attendance' && attendanceViewMode === 'matrix' && attendanceList.length > 0 && (
            <div className="max-w-7xl mx-auto bg-white rounded-xl border border-slate-200 p-4 shadow-2xs overflow-x-auto">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-600">
                  Team Attendance Calendar Matrix
                </h3>
                <span className="text-[11px] text-slate-400">
                  {attendanceList.length} check-in log(s)
                </span>
              </div>
              {(() => {
                const dates = Array.from(new Set(attendanceList.map((a) => a.dateOrMonth))).sort().slice(-14);
                const empNames = Array.from(
                  new Set([
                    ...members.map((m) => m.fullName),
                    ...attendanceList.map((a) => a.memberName),
                  ])
                );
                return (
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="p-2 font-bold text-slate-700 sticky left-0 bg-slate-50">Member</th>
                        {dates.map((d) => (
                          <th key={d} className="p-2 font-mono text-center text-slate-500 whitespace-nowrap">
                            {d.slice(5)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {empNames.map((emp) => (
                        <tr key={emp} className="hover:bg-slate-50">
                          <td className="p-2 font-bold text-slate-800 whitespace-nowrap sticky left-0 bg-white">
                            {emp}
                          </td>
                          {dates.map((d) => {
                            const hit = attendanceList.find(
                              (a) => a.memberName === emp && a.dateOrMonth === d
                            );
                            return (
                              <td key={d} className="p-1.5 text-center">
                                {hit ? (
                                  <span
                                    title={`${hit.status} (${hit.details?.checkIn || '-'} - ${hit.details?.checkOut || '-'})`}
                                    className={`inline-block px-2 py-0.5 rounded font-bold ${
                                      hit.status === 'Present'
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : hit.status === 'Late'
                                        ? 'bg-amber-100 text-amber-800'
                                        : 'bg-rose-100 text-rose-700'
                                    }`}
                                  >
                                    {hit.status.slice(0, 1)}
                                  </span>
                                ) : (
                                  <span className="text-slate-300">Â·</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}
            </div>
          )}

          <div className="max-w-7xl mx-auto bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            {(subTab === 'attendance'
                ? attendanceList
                : subTab === 'leaves'
                ? leaveList
                : payslipList
              ).length === 0 ? (
              <div className="py-12 px-4 text-center">
                <p className="text-sm font-medium text-slate-700">
                  No {subTab} records found yet.
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Use the &ldquo;+ Record HR Entry&rdquo; tab above to log attendance, leave, or payroll.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {(subTab === 'attendance'
                  ? attendanceList
                  : subTab === 'leaves'
                  ? leaveList
                  : payslipList
                ).map((rec) => (
                  <div
                    key={rec.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3.5 hover:bg-slate-50"
                  >
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-slate-900">{rec.memberName}</p>
                        <span className="text-xs text-slate-500">{rec.memberEmail}</span>
                        <span className="px-2 py-0.5 rounded bg-teal-50 text-teal-700 text-[10px] font-bold">
                          {rec.dateOrMonth}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            rec.status === 'Approved' ||
                            rec.status === 'Present' ||
                            rec.status === 'Paid'
                              ? 'bg-emerald-100 text-emerald-700'
                              : rec.status === 'Rejected'
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {rec.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {rec.recordType === 'ATTENDANCE'
                          ? `Check-In: ${rec.details?.checkIn || '-'} Â· Check-Out: ${rec.details?.checkOut || '-'}`
                          : rec.recordType === 'LEAVE'
                          ? `${rec.details?.leaveType || 'Leave'}: ${rec.details?.leaveReason || ''}`
                          : `Net Salary: $${Number(rec.details?.netSalary || 0).toLocaleString()}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {rec.recordType === 'LEAVE' && (
                        <>
                          <button
                            type="button"
                            onClick={async () => {
                              const res = await saveEngineRecord<WorkspaceHrRecordItem>(
                                'hrRecords',
                                { ...rec, status: 'Approved' }
                              );
                              setRecords(res.items);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" /> Approve
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              const res = await saveEngineRecord<WorkspaceHrRecordItem>(
                                'hrRecords',
                                { ...rec, status: 'Rejected' }
                              );
                              setRecords(res.items);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold flex items-center gap-1"
                          >
                            <X className="w-3 h-3" /> Reject
                          </button>
                        </>
                      )}
                      {rec.recordType === 'PAYSLIP' && (
                        <>
                          <button
                            type="button"
                            onClick={() => setPreviewPayslip(rec)}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3 h-3" /> Payslip PDF
                          </button>
                          {rec.status !== 'Paid' && (
                            <button
                              type="button"
                              onClick={async () => {
                                const res = await saveEngineRecord<WorkspaceHrRecordItem>('hrRecords', {
                                  ...rec,
                                  status: 'Paid',
                                });
                                setRecords(res.items);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold"
                            >
                              Mark Paid
                            </button>
                          )}
                        </>
                      )}
                      <button
                        type="button"
                        onClick={async () => {
                          const updated = await deleteEngineRecord<WorkspaceHrRecordItem>(
                            'hrRecords',
                            rec.id
                          );
                          setRecords(updated);
                        }}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {subTab === 'create_hr' && (
        <div className="flex-1 overflow-y-auto p-3 sm:p-6">
          <form
            onSubmit={handleSave}
            className="max-w-2xl mx-auto bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4"
          >
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              {(['ATTENDANCE', 'LEAVE', 'PAYSLIP'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setRecordType(t)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold ${
                    recordType === t ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {t === 'ATTENDANCE'
                    ? 'Attendance Check-In'
                    : t === 'LEAVE'
                    ? 'Leave Request'
                    : 'Generate Payslip'}
                </button>
              ))}
            </div>

            {members.length > 0 && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Quick Select Team Member
                </label>
                <select
                  onChange={(e) => {
                    const m = members.find((mem) => mem.id === e.target.value);
                    if (m) {
                      setMemberName(m.fullName);
                      setMemberEmail(m.email);
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
                >
                  <option value="">-- Choose from Team Profile or type below --</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.fullName} ({m.email})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Member Name *
                </label>
                <input
                  type="text"
                  required
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Member Email
                </label>
                <input
                  type="email"
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Date / Month *
                </label>
                <input
                  type="date"
                  required
                  value={dateOrMonth}
                  onChange={(e) => setDateOrMonth(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                />
              </div>

              {recordType === 'ATTENDANCE' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
                    >
                      <option value="Present">Present</option>
                      <option value="Remote">Remote</option>
                      <option value="Late">Late</option>
                      <option value="Absent">Absent</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Check-In</label>
                    <input
                      type="time"
                      value={checkIn}
                      onChange={(e) => setCheckIn(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Check-Out</label>
                    <input
                      type="time"
                      value={checkOut}
                      onChange={(e) => setCheckOut(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                  </div>
                </>
              )}

              {recordType === 'LEAVE' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Leave Type
                    </label>
                    <select
                      value={leaveType}
                      onChange={(e) => setLeaveType(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
                    >
                      <option value="Annual Leave">Annual Leave</option>
                      <option value="Sick Leave">Sick Leave</option>
                      <option value="Casual Leave">Casual Leave</option>
                      <option value="Unpaid Leave">Unpaid Leave</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">Reason</label>
                    <input
                      type="text"
                      value={leaveReason}
                      onChange={(e) => setLeaveReason(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                  </div>
                </>
              )}

              {recordType === 'PAYSLIP' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Net Salary Amount ($)
                  </label>
                  <input
                    type="number"
                    value={netSalary}
                    onChange={(e) => setNetSalary(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold"
              >
                Save HR Record
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Printable PDF Payslip Modal */}
      {previewPayslip && (
        <div className="fixed inset-0 z-50 bg-slate-900/55 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-teal-50 text-teal-700">
                  Employee Payslip
                </span>
                <h3 className="text-base font-extrabold text-slate-900 mt-1">{previewPayslip.memberName}</h3>
                <p className="text-xs text-slate-500">{previewPayslip.memberEmail}</p>
              </div>
              <button type="button" onClick={() => setPreviewPayslip(null)} className="cursor-pointer text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Pay Period:</span>
                <span className="font-bold text-slate-900">{previewPayslip.dateOrMonth}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status:</span>
                <span className="font-bold text-emerald-700">{previewPayslip.status}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-200 text-sm font-extrabold">
                <span>Net Payable Salary:</span>
                <span className="text-teal-700">
                  ${Number(previewPayslip.details?.netSalary || 0).toLocaleString()}
                </span>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleSavePayslipPdf(previewPayslip)}
                className="flex items-center gap-1 px-3.5 py-2 rounded-xl bg-teal-600 text-white text-xs font-bold cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Save PDF
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1 px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" /> Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

