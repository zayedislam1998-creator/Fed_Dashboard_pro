import React, { useState, useEffect, useMemo } from 'react';
import {
  Briefcase,
  Plus,
  Search,
  Copy,
  Check,
  ExternalLink,
  Trash2,
  Edit3,
  Eye,
  Globe,
  Lock,
  UserPlus,
  Calendar,
  Blocks,
  X,
  CheckCircle2,
  Loader2,
  Users,
  DollarSign,
} from 'lucide-react';
import {
  CmhProjectItem,
  CmhFormTemplate,
  CmhSubmission,
  WorkspaceMemberItem,
  WorkspaceTeamGroup,
  fetchCmhWorkspaceBootstrap,
  saveCmhProject,
  deleteCmhProject,
  saveCmhFormTemplate,
  searchMembersInstant,
} from '../services/workspaceApi';
import { CmhDynamicFieldsRenderer } from './CmhDynamicFieldsRenderer';
import { CmhMemberInviteModal } from './CmhMemberInviteModal';
import { CmhFormFieldsEditorModal } from './CmhFormFieldsEditorModal';

export type CmhProjectsSubTab = 'all_projects' | 'create_project';

interface CmhProjectsViewProps {
  activeSubTab?: CmhProjectsSubTab;
  onSubTabChange?: (tab: CmhProjectsSubTab) => void;
  searchQuery?: string;
  onOpenPublicCmhPreview?: (param: string) => void;
  onNavigateToFormBuilder?: () => void;
}

const PRIORITY_STYLES: Record<
  CmhProjectItem['priority'],
  { bg: string; text: string; border: string }
> = {
  Low: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' },
  Medium: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  High: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  Critical: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
};

export const CmhProjectsView: React.FC<CmhProjectsViewProps> = ({
  activeSubTab = 'all_projects',
  onSubTabChange,
  searchQuery = '',
  onOpenPublicCmhPreview,
  onNavigateToFormBuilder,
}) => {
  const [subTab, setSubTab] = useState<CmhProjectsSubTab>(activeSubTab);
  const [projects, setProjects] = useState<CmhProjectItem[]>([]);
  const [forms, setForms] = useState<CmhFormTemplate[]>([]);
  const [members, setMembers] = useState<WorkspaceMemberItem[]>([]);
  const [teamGroups, setTeamGroups] = useState<WorkspaceTeamGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [localSearch, setLocalSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modals
  const [inviteModalProject, setInviteModalProject] = useState<CmhProjectItem | null>(null);
  const [inspectingProject, setInspectingProject] = useState<CmhProjectItem | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<CmhSubmission | null>(null);

  // Create / Edit Project State
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [selectedFormId, setSelectedFormId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<CmhProjectItem['status']>('Active');
  const [priority, setPriority] = useState<CmhProjectItem['priority']>('High');
  const [budget, setBudget] = useState('$12,500');
  const [deadline, setDeadline] = useState(() => {
    const d = new Date(Date.now() + 21 * 86400000);
    return d.toISOString().slice(0, 10);
  });
  const [accessMode, setAccessMode] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
  const [assignedMemberIds, setAssignedMemberIds] = useState<string[]>([]);
  const [assignedTeamIds, setAssignedTeamIds] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});
  const [isFieldsEditorOpen, setIsFieldsEditorOpen] = useState(false);

  useEffect(() => {
    setSubTab(activeSubTab);
  }, [activeSubTab]);

  const switchTab = (tab: CmhProjectsSubTab) => {
    setSubTab(tab);
    onSubTabChange?.(tab);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchCmhWorkspaceBootstrap();
      setProjects(data.projects);
      setForms(data.forms);
      setMembers(data.members);
      setTeamGroups(data.teamGroups);
      const defaultProjectForm =
        data.forms.find((f) => f.formCategory === 'PROJECT') || data.forms[0];
      if (defaultProjectForm && !selectedFormId) {
        setSelectedFormId(defaultProjectForm.id);
      }
    } catch {
      // ignore error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showToast = (type: 'success' | 'error', message: string) => {
    setStatusBanner({ type, message });
    setTimeout(() => {
      setStatusBanner((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  };

  const selectedFormTemplate = useMemo(
    () => forms.find((f) => f.id === selectedFormId) || forms[0] || null,
    [forms, selectedFormId]
  );

  const filteredMembers = useMemo(
    () => searchMembersInstant(memberSearch, members),
    [memberSearch, members]
  );

  const resetForm = () => {
    setEditingProjectId(null);
    setTitle('');
    setDescription('');
    setStatus('Active');
    setPriority('High');
    setBudget('$12,500');
    setAccessMode('PUBLIC');
    setAssignedMemberIds([]);
    setAssignedTeamIds([]);
    setCustomFieldValues({});
    const defaultProjectForm = forms.find((f) => f.formCategory === 'PROJECT') || forms[0];
    if (defaultProjectForm) setSelectedFormId(defaultProjectForm.id);
  };

  const handleEditProject = (project: CmhProjectItem) => {
    setEditingProjectId(project.id);
    setSelectedFormId(project.formTemplateId);
    setTitle(project.title);
    setDescription(project.description);
    setStatus(project.status);
    setPriority(project.priority);
    setBudget(project.budget || '');
    setDeadline(project.deadline || '');
    setAccessMode(project.accessMode);
    setAssignedMemberIds(project.assignedMemberIds || []);
    setAssignedTeamIds(project.assignedTeamIds || []);
    setCustomFieldValues(project.customFieldValues || {});
    switchTab('create_project');
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast('error', 'Please enter a project title.');
      return;
    }

    const formattedValues: Record<string, any> = {
      ...customFieldValues,
      _targetSubmissions: Math.max(1, Number(customFieldValues._targetSubmissions) || 40),
    };
    if (selectedFormTemplate) {
      for (const field of selectedFormTemplate.fields) {
        if (customFieldValues[field.id] !== undefined) {
          formattedValues[field.label] = customFieldValues[field.id];
        }
      }
    }

    setSaving(true);
    try {
      const res = await saveCmhProject({
        id: editingProjectId || undefined,
        title: title.trim(),
        description: description.trim(),
        formTemplateId: selectedFormTemplate?.id || '',
        formTemplateTitle: selectedFormTemplate?.title || 'Enterprise Project Form',
        status,
        priority,
        budget: budget.trim(),
        deadline,
        accessMode,
        assignedMemberIds,
        assignedTeamIds,
        customFieldValues: formattedValues,
      });
      setProjects(res.projects);
      showToast(
        'success',
        `Project "${res.project.title}" saved! Real-time notification & Admin Inbox email delivered.`
      );
      resetForm();
      switchTab('all_projects');
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to save project.');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickStatusChange = async (
    project: CmhProjectItem,
    nextStatus: CmhProjectItem['status']
  ) => {
    try {
      const res = await saveCmhProject({
        ...project,
        status: nextStatus,
      });
      setProjects(res.projects);
      showToast('success', `Project "${project.title}" updated to ${nextStatus}.`);
    } catch {
      showToast('error', 'Failed to update project status.');
    }
  };

  const handleQuickAccessToggle = async (project: CmhProjectItem) => {
    const nextMode = project.accessMode === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC';
    try {
      const res = await saveCmhProject({
        ...project,
        accessMode: nextMode,
      });
      setProjects(res.projects);
      showToast(
        'success',
        `Project link set to ${
          nextMode === 'PUBLIC' ? 'Public (Anyone with link)' : 'Private (Invited Members only)'
        }.`
      );
    } catch {
      showToast('error', 'Failed to toggle project link access.');
    }
  };

  const handleDeleteProject = async (project: CmhProjectItem) => {
    try {
      const next = await deleteCmhProject(project.id);
      setProjects(next);
      showToast('success', `Project "${project.title}" deleted.`);
    } catch {
      showToast('error', 'Failed to delete project.');
    }
  };

  const handleCopyLink = (projectId: string) => {
    const url = `${window.location.origin}/?cmh=project:${encodeURIComponent(projectId)}`;
    navigator.clipboard.writeText(url);
    setCopiedId(projectId);
    setTimeout(() => setCopiedId(null), 2000);
    showToast('success', 'Individual project share link copied to clipboard.');
  };

  const filteredProjects = useMemo(() => {
    const q = (searchQuery || localSearch).trim().toLowerCase();
    return projects.filter((p) => {
      if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.formTemplateTitle.toLowerCase().includes(q)
      );
    });
  }, [projects, statusFilter, searchQuery, localSearch]);

  return (
    <div className="h-full flex flex-col bg-[#F8FAFC] overflow-hidden">
      {/* Top Sub-Navigation Header (Single Clean Action Bar) */}
      <div className="px-4 sm:px-6 py-3 bg-white border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => switchTab('all_projects')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              subTab === 'all_projects'
                ? 'bg-purple-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>All Projects ({projects.length})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              resetForm();
              switchTab('create_project');
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              subTab === 'create_project'
                ? 'bg-purple-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{editingProjectId && subTab === 'create_project' ? 'Edit Project' : 'Add New Project'}</span>
          </button>
        </div>
      </div>

      {/* Status Toast */}
      {statusBanner && (
        <div
          className={`px-4 sm:px-6 py-2.5 text-xs font-semibold flex items-center justify-between border-b ${
            statusBanner.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {statusBanner.message}
          </span>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* TAB 1: ALL PROJECTS */}
      {subTab === 'all_projects' && (
        <div className="flex-1 overflow-y-auto p-3 sm:p-6">
          <div className="max-w-7xl mx-auto space-y-3.5 sm:space-y-4 ws-animate-in">
            {/* 4-Card KPI Summary Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
              {[
                {
                  label: 'Total Projects',
                  count: projects.length,
                  accent: 'text-slate-900',
                  sub: 'Workspace portfolio',
                },
                {
                  label: 'Active Now',
                  count: projects.filter((p) => p.status === 'Active').length,
                  accent: 'text-purple-600',
                  sub: 'In execution',
                },
                {
                  label: 'Planning / Hold',
                  count: projects.filter((p) => p.status === 'Planning' || p.status === 'On Hold').length,
                  accent: 'text-amber-600',
                  sub: 'Scoping & review',
                },
                {
                  label: 'Completed',
                  count: projects.filter((p) => p.status === 'Completed').length,
                  accent: 'text-emerald-600',
                  sub: 'Delivered milestones',
                },
              ].map((kpi) => (
                <div
                  key={kpi.label}
                  className="bg-white rounded-2xl border border-slate-200/90 p-3.5 shadow-2xs flex flex-col justify-between"
                >
                  <span className="text-[11px] font-bold text-slate-500">{kpi.label}</span>
                  <div className="flex items-baseline justify-between mt-1.5">
                    <span className={`text-xl sm:text-2xl font-extrabold tabular-nums ${kpi.accent}`}>
                      {kpi.count}
                    </span>
                    <span className="text-[10px] text-slate-400 hidden sm:inline">{kpi.sub}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Clean Responsive Filter & Search Bar (No duplicate Add button) */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600 shrink-0">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="flex-1 sm:flex-none px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:border-purple-600"
                >
                  <option value="ALL">All Projects ({projects.length})</option>
                  <option value="Planning">Planning ({projects.filter((p) => p.status === 'Planning').length})</option>
                  <option value="Active">Active ({projects.filter((p) => p.status === 'Active').length})</option>
                  <option value="On Hold">On Hold ({projects.filter((p) => p.status === 'On Hold').length})</option>
                  <option value="Completed">Completed ({projects.filter((p) => p.status === 'Completed').length})</option>
                </select>
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  placeholder="Filter projects by title or form..."
                  className="w-full !pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-purple-600"
                />
              </div>
            </div>

            {/* Responsive Projects List (Cards on Mobile, 12-Col Table on Desktop) */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
              <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-3 bg-slate-50/80 border-b border-slate-200 text-xs font-bold text-slate-600">
                <div className="col-span-4">Project Title & Connected Form</div>
                <div className="col-span-2">Status & Progress</div>
                <div className="col-span-2">Link Access & Deadline</div>
                <div className="col-span-1 text-center">Submissions</div>
                <div className="col-span-3 text-right">Share Link · Invite · Actions</div>
              </div>

              {loading ? (
                <div className="py-14 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                  Loading CMH Projects...
                </div>
              ) : filteredProjects.length === 0 ? (
                <div className="py-14 px-4 text-center max-w-md mx-auto space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-100 text-purple-600 flex items-center justify-center mx-auto shadow-2xs">
                    <Briefcase className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-base font-extrabold text-slate-900">
                      No projects in your workspace yet
                    </p>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Create your first project with budget tracking, deadline milestones, team assignments, and an automatic shareable submission portal link.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        resetForm();
                        switchTab('create_project');
                      }}
                      className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Create First Project</span>
                    </button>
                    {onNavigateToFormBuilder && (
                      <button
                        type="button"
                        onClick={onNavigateToFormBuilder}
                        className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5"
                      >
                        <Blocks className="w-3.5 h-3.5 text-purple-600" />
                        <span>Open Form Builder</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredProjects.map((project) => {
                    const pStyle = PRIORITY_STYLES[project.priority] || PRIORITY_STYLES.High;
                    const submissionsCount = project.submissions?.length || 0;
                    const assignedCount =
                      (project.assignedMemberIds?.length || 0) +
                      (project.assignedTeamIds?.length || 0);
                    const progressPct =
                      project.status === 'Completed'
                        ? 100
                        : project.status === 'On Hold'
                        ? 75
                        : project.status === 'Active'
                        ? 55
                        : 25;

                    return (
                      <div
                        key={project.id}
                        className="flex flex-col md:grid md:grid-cols-12 gap-3 p-4 md:px-4 md:py-3 md:items-center hover:bg-slate-50/80 transition-colors"
                      >
                        <div className="md:col-span-4 min-w-0">
                          <div className="flex items-center justify-between md:justify-start gap-2">
                            <p className="text-sm font-semibold text-slate-900 truncate">
                              {project.title}
                            </p>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border shrink-0 ${pStyle.bg} ${pStyle.text} ${pStyle.border}`}
                            >
                              {project.priority}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-slate-500">
                            <span className="inline-flex items-center gap-1 text-purple-700 font-medium truncate">
                              <Blocks className="w-3 h-3 shrink-0" />
                              {project.formTemplateTitle}
                            </span>
                            {assignedCount > 0 && (
                              <span className="text-slate-600 font-medium shrink-0">
                                · {assignedCount} assigned
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="md:col-span-2 flex flex-col gap-1.5">
                          <div className="flex items-center justify-between md:justify-start gap-2">
                            <select
                              value={project.status}
                              onChange={(e) =>
                                handleQuickStatusChange(
                                  project,
                                  e.target.value as CmhProjectItem['status']
                                )
                              }
                              className={`w-fit px-2.5 py-1 rounded-lg text-xs font-bold border focus:outline-none ${
                                project.status === 'Completed'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : project.status === 'Active'
                                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                                  : project.status === 'On Hold'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              <option value="Planning">Planning</option>
                              <option value="Active">Active</option>
                              <option value="On Hold">On Hold</option>
                              <option value="Completed">Completed</option>
                            </select>
                            {project.budget && (
                              <span className="text-[11px] font-bold text-slate-700 tabular-nums">
                                {project.budget}
                              </span>
                            )}
                          </div>
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                project.status === 'Completed'
                                  ? 'bg-emerald-500'
                                  : project.status === 'Active'
                                  ? 'bg-purple-600'
                                  : 'bg-amber-500'
                              }`}
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        </div>

                        <div className="md:col-span-2 flex flex-wrap items-center md:flex-col md:items-start gap-2 md:gap-1">
                          <button
                            type="button"
                            onClick={() => handleQuickAccessToggle(project)}
                            className={`inline-flex items-center gap-1 w-fit px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                              project.accessMode === 'PUBLIC'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {project.accessMode === 'PUBLIC' ? (
                              <>
                                <Globe className="w-3 h-3" /> Public Link
                              </>
                            ) : (
                              <>
                                <Lock className="w-3 h-3" /> Private Only
                              </>
                            )}
                          </button>
                          {project.deadline && (
                            <span className="text-[11px] text-slate-500 flex items-center gap-1">
                              <Calendar className="w-3 h-3" /> {project.deadline}
                            </span>
                          )}
                        </div>

                        <div className="md:col-span-4 flex flex-wrap items-center justify-between md:justify-end gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                          <button
                            type="button"
                            onClick={() => {
                              setInspectingProject(project);
                              setSelectedSubmission(project.submissions?.[0] || null);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-purple-50 hover:text-purple-700 text-slate-800 text-xs font-bold"
                            title="View Submissions"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>{submissionsCount}</span>
                          </button>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleCopyLink(project.id)}
                              title="Copy Individual Project Share Link"
                              className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1"
                            >
                              {copiedId === project.id ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>Link</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => setInviteModalProject(project)}
                              title="Invite Members or Team Groups & Send Project Link via Email"
                              className="px-2.5 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-semibold flex items-center gap-1"
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                              <span>Invite</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => onOpenPublicCmhPreview?.(`project:${project.id}`)}
                              title="Open Live Project Portal"
                              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleEditProject(project)}
                              title="Edit Project"
                              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteProject(project)}
                              title="Delete Project"
                              className="p-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 hover:text-rose-600 text-slate-500"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ADD NEW PROJECT (HIGH-CRAFT MOBILE-FIRST STUDIO FORM) */}
      {subTab === 'create_project' && (
        <div className="flex-1 overflow-y-auto p-3 sm:p-6">
          <form onSubmit={handleSaveProject} className="max-w-4xl mx-auto space-y-4 pb-8">
            {/* Card 1: Core Project Scope, Budget & Deadline */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-6 shadow-2xs space-y-5">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-purple-600 text-white font-bold text-xs flex items-center justify-center shadow-2xs shrink-0">
                    1
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                      {editingProjectId ? 'Edit Project Details' : 'Create New Project'}
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      Define project title, allocated budget, target deadline, and portal access
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-5 space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800">
                    Project Title <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Briefcase className="w-4 h-4 text-purple-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g., Global Multi-Domain Cloud Workspace Rollout"
                      className="w-full !pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900"
                    />
                  </div>
                </div>

                <div className="md:col-span-2 space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800">
                    Target People
                  </label>
                  <div className="relative">
                    <Users className="w-4 h-4 text-rose-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="number"
                      min={1}
                      max={10000}
                      value={customFieldValues._targetSubmissions ?? 40}
                      onChange={(e) =>
                        setCustomFieldValues((prev) => ({
                          ...prev,
                          _targetSubmissions: Math.max(1, Number(e.target.value) || 1),
                        }))
                      }
                      placeholder="40"
                      className="w-full !pl-9 pr-2.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-900"
                    />
                  </div>
                </div>

                <div className="md:col-span-2 space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800">
                    Budget
                  </label>
                  <div className="relative">
                    <DollarSign className="w-4 h-4 text-emerald-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                      placeholder="15,000"
                      className="w-full !pl-9 pr-2.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900"
                    />
                  </div>
                </div>

                <div className="md:col-span-3 space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800">
                    Target Deadline
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="date"
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                      className="w-full !pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  Project Charter & Milestones
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the project goals, milestones, and deliverables..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-800"
                />
              </div>

              {/* Interactive Status & Priority Pills */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Project Status
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(['Planning', 'Active', 'On Hold', 'Completed'] as const).map((st) => {
                      const active = status === st;
                      return (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setStatus(st)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                            active
                              ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {active && <Check className="w-3.5 h-3.5 shrink-0" />}
                          <span>{st}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Priority Level
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(['Low', 'Medium', 'High', 'Critical'] as const).map((pr) => {
                      const active = priority === pr;
                      return (
                        <button
                          key={pr}
                          type="button"
                          onClick={() => setPriority(pr)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                            active
                              ? pr === 'Critical'
                                ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                                : pr === 'High'
                                ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                                : 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {active && <Check className="w-3.5 h-3.5 shrink-0" />}
                          <span>{pr}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Shareable Link Access Mode Cards */}
              <div className="space-y-2 pt-1">
                <label className="block text-xs font-bold text-slate-800">
                  Shareable Link Access Mode
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setAccessMode('PUBLIC')}
                    className={`p-3.5 rounded-2xl border text-left transition-all flex items-start gap-3 ${
                      accessMode === 'PUBLIC'
                        ? 'bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-500/15'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                        accessMode === 'PUBLIC'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      <Globe className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">
                        Public Share Link
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Anyone with the project link can view & submit updates
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAccessMode('PRIVATE')}
                    className={`p-3.5 rounded-2xl border text-left transition-all flex items-start gap-3 ${
                      accessMode === 'PRIVATE'
                        ? 'bg-amber-50/70 border-amber-500 ring-2 ring-amber-500/15'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                        accessMode === 'PRIVATE'
                          ? 'bg-amber-600 text-white'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      <Lock className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">
                        Private (Invited Members Only)
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Only assigned team members can submit responses
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </div>

            {/* Card 2: Assign Team Groups & Individual Members */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-6 shadow-2xs space-y-4">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <div className="w-7 h-7 rounded-xl bg-purple-50 text-purple-700 font-bold text-xs flex items-center justify-center shrink-0">
                  2
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Assign Team Groups or Members
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Select teams or members collaborating on this project
                  </p>
                </div>
              </div>

              {teamGroups.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {teamGroups.map((group) => {
                    const selected = assignedTeamIds.includes(group.id);
                    return (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() =>
                          setAssignedTeamIds((prev) =>
                            prev.includes(group.id)
                              ? prev.filter((id) => id !== group.id)
                              : [...prev, group.id]
                          )
                        }
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                          selected
                            ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <Users className="w-3.5 h-3.5" />
                        {group.name}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder="Search team members by name or email..."
                    className="w-full !pl-10 pr-3.5 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                </div>
                {filteredMembers.length === 0 ? (
                  <p className="text-xs text-slate-400 py-1">
                    No team members added yet. You can add members from the Team Profile tab.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pt-1">
                    {filteredMembers.map((m) => {
                      const selected = assignedMemberIds.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() =>
                            setAssignedMemberIds((prev) =>
                              prev.includes(m.id)
                                ? prev.filter((id) => id !== m.id)
                                : [...prev, m.id]
                            )
                          }
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                            selected
                              ? 'bg-purple-50 text-purple-700 border-purple-400 ring-2 ring-purple-500/10'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {selected && <Check className="w-3 h-3 text-purple-600" />}
                          <span>{m.fullName}</span>
                          <span className="text-[10px] text-slate-400">({m.email})</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Card 3: Connected Form Template & Custom Fields */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-6 shadow-2xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-xl bg-purple-50 text-purple-700 font-bold text-xs flex items-center justify-center shrink-0">
                    3
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Connected Submission Form & Custom Fields
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Choose or customize extra fields for project submissions
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {selectedFormTemplate && (
                    <button
                      type="button"
                      onClick={() => setIsFieldsEditorOpen(true)}
                      className="px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-bold flex items-center gap-1.5"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Customize Fields
                    </button>
                  )}
                  {onNavigateToFormBuilder && (
                    <button
                      type="button"
                      onClick={onNavigateToFormBuilder}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5"
                    >
                      <Blocks className="w-3.5 h-3.5 text-purple-600" />
                      Form Builder
                    </button>
                  )}
                </div>
              </div>

              {forms.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {forms.map((form) => {
                    const active = selectedFormTemplate?.id === form.id;
                    return (
                      <button
                        key={form.id}
                        type="button"
                        onClick={() => setSelectedFormId(form.id)}
                        className={`p-3.5 rounded-2xl border text-left transition-all ${
                          active
                            ? 'bg-purple-50/70 border-purple-600 ring-2 ring-purple-500/15'
                            : 'bg-slate-50/60 border-slate-200 hover:bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 text-[10px] font-bold">
                            {form.formCategory}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-500">
                            {form.fields?.length || 0} fields
                          </span>
                        </div>
                        <p className="text-xs font-bold text-slate-900 mt-2 truncate">
                          {form.title}
                        </p>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-slate-50 border border-dashed border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-slate-700">
                      Using Default Project Submission Portal
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Want custom input fields on this project? Create a template in Form Builder anytime.
                    </p>
                  </div>
                </div>
              )}

              {selectedFormTemplate && (
                <div className="pt-2">
                  <CmhDynamicFieldsRenderer
                    fields={selectedFormTemplate.fields || []}
                    values={customFieldValues}
                    onChange={(fieldId, val) =>
                      setCustomFieldValues((prev) => ({ ...prev, [fieldId]: val }))
                    }
                  />
                </div>
              )}
            </div>

            {/* Sticky Bottom Action Bar */}
            <div className="sticky bottom-2 z-20 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/90 p-3.5 shadow-lg flex items-center justify-between sm:justify-end gap-3">
              <button
                type="button"
                onClick={() => switchTab('all_projects')}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 sm:flex-none justify-center px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-md shadow-purple-500/20"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving Project...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    {editingProjectId ? 'Update Project' : 'Publish & Generate Project Link'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* PROJECT SUBMISSIONS & SPECIFICATIONS INSPECTOR MODAL */}
      {inspectingProject && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">
                  Project Specifications & Milestone Submissions (
                  {inspectingProject.submissions?.length || 0})
                </span>
                <h3 className="text-base font-bold">{inspectingProject.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectingProject(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 bg-slate-50 border-b border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-2.5">
              {Object.entries(inspectingProject.customFieldValues || {}).map(([k, v]) => (
                <div key={k} className="bg-white p-2.5 rounded-lg border border-slate-200">
                  <p className="text-[10px] font-bold uppercase text-slate-400 truncate">{k}</p>
                  <p className="text-xs font-semibold text-slate-800 truncate">{String(v)}</p>
                </div>
              ))}
            </div>

            {!inspectingProject.submissions || inspectingProject.submissions.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                No milestone or stakeholder submissions recorded on this project link yet.
              </div>
            ) : (
              <div className="flex-1 grid grid-cols-12 overflow-hidden">
                <div className="col-span-5 border-r border-slate-200 overflow-y-auto divide-y divide-slate-100">
                  {inspectingProject.submissions.map((sub) => (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => setSelectedSubmission(sub)}
                      className={`w-full px-4 py-3 text-left ${
                        selectedSubmission?.id === sub.id
                          ? 'bg-purple-50/80 border-l-4 border-l-purple-600'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <p className="text-xs font-bold text-slate-900">{sub.submitterName}</p>
                      <p className="text-[11px] text-purple-600">{sub.submitterEmail}</p>
                      <p className="text-[10px] text-slate-400">{sub.submittedAt}</p>
                    </button>
                  ))}
                </div>
                <div className="col-span-7 p-5 overflow-y-auto space-y-2.5">
                  {selectedSubmission &&
                    Object.entries(selectedSubmission.values || {}).map(([label, val]) => (
                      <div key={label} className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <p className="text-[10px] font-bold uppercase text-slate-400">{label}</p>
                        <p className="text-xs font-semibold text-slate-900 mt-0.5">
                          {Array.isArray(val) ? val.join(', ') : String(val ?? '—')}
                        </p>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* INVITE MEMBERS / TEAMS MODAL */}
      {inviteModalProject && (
        <CmhMemberInviteModal
          isOpen={Boolean(inviteModalProject)}
          onClose={() => setInviteModalProject(null)}
          targetType="project"
          targetId={inviteModalProject.id}
          targetTitle={inviteModalProject.title}
          initialMemberIds={inviteModalProject.assignedMemberIds || []}
          initialTeamIds={inviteModalProject.assignedTeamIds || []}
          members={members}
          teamGroups={teamGroups}
          onSuccess={(res) => {
            setProjects(res.projects);
            showToast(
              'success',
              `Project link emailed to ${res.invitedCount} member(s) & logged to Admin Inbox.`
            );
          }}
        />
      )}

      {/* FORM FIELDS EDITOR MODAL */}
      {isFieldsEditorOpen && selectedFormTemplate && (
        <CmhFormFieldsEditorModal
          isOpen={isFieldsEditorOpen}
          onClose={() => setIsFieldsEditorOpen(false)}
          template={selectedFormTemplate}
          onSave={(updated) => {
            setForms((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
            showToast('success', `Form fields for "${updated.title}" updated and synced.`);
          }}
        />
      )}
    </div>
  );
};
