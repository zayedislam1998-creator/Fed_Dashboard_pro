import React from 'react';
import {
  FolderGit2,
  Plus,
  Trash2,
  ExternalLink,
  Github,
  Calendar,
  FileText,
  Tag,
  CheckCircle2,
} from 'lucide-react';
import { ResumeProfileData } from '../../services/workspaceApi';

interface ResumeProjectsSectionProps {
  projects: ResumeProfileData['projects'];
  isEditing: boolean;
  onChangeProjects: (projects: ResumeProfileData['projects']) => void;
  onOpenDocument?: (docId: string) => void;
}

export const ResumeProjectsSection: React.FC<ResumeProjectsSectionProps> = ({
  projects,
  isEditing,
  onChangeProjects,
  onOpenDocument,
}) => {
  const handleAddProject = () => {
    const newProj: ResumeProfileData['projects'][0] = {
      id: `proj-${Date.now()}`,
      title: '',
      role: '',
      period: '',
      description: '',
      bullets: [],
      technologies: [],
      liveUrl: '',
    };
    onChangeProjects([...projects, newProj]);
  };

  const handleRemoveProject = (id: string) => {
    onChangeProjects(projects.filter((p) => p.id !== id));
  };

  const handleUpdateProject = (
    id: string,
    field: keyof ResumeProfileData['projects'][0],
    value: any
  ) => {
    onChangeProjects(
      projects.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  return (
    <section
      id="sec-projects"
      className="scroll-mt-24 rounded-3xl p-6 sm:p-8 bg-white/75 dark:bg-slate-900/75 backdrop-blur-2xl border border-white/60 dark:border-slate-800/80 shadow-[0_10px_35px_rgba(0,0,0,0.04)] space-y-6"
    >
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400">
            <FolderGit2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Key Projects & Systems Architecture
            </h2>
            <p className="text-xs text-slate-500">
              Enterprise platforms, digital transformations, and architectural contributions
            </p>
          </div>
        </div>

        {isEditing && (
          <button
            type="button"
            onClick={handleAddProject}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Project</span>
          </button>
        )}
      </div>

      {projects.length === 0 ? (
        <div className="p-5 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 text-center space-y-2">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            No key projects added yet.
          </p>
          {isEditing && (
            <button
              type="button"
              onClick={handleAddProject}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add First Project</span>
            </button>
          )}
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {projects.map((proj) => (
          <div
            key={proj.id}
            className="p-6 rounded-2xl bg-white/60 dark:bg-slate-850/60 border border-slate-200/60 dark:border-slate-800 space-y-4 hover:shadow-lg transition-all flex flex-col justify-between"
          >
            {isEditing ? (
              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold uppercase text-slate-400">Project Spec</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveProject(proj.id)}
                    className="text-rose-500 hover:text-rose-700"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <input
                  type="text"
                  value={proj.title}
                  onChange={(e) => handleUpdateProject(proj.id, 'title', e.target.value)}
                  placeholder="Project Title"
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold"
                />

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={proj.role}
                    onChange={(e) => handleUpdateProject(proj.id, 'role', e.target.value)}
                    placeholder="Role (e.g. Lead Architect)"
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                  <input
                    type="text"
                    value={proj.period || ''}
                    onChange={(e) => handleUpdateProject(proj.id, 'period', e.target.value)}
                    placeholder="Timeline (e.g. 2024 - 2025)"
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>

                <textarea
                  value={proj.description}
                  onChange={(e) =>
                    handleUpdateProject(proj.id, 'description', e.target.value)
                  }
                  rows={3}
                  placeholder="Project description and organizational context..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={proj.liveUrl || ''}
                    onChange={(e) =>
                      handleUpdateProject(proj.id, 'liveUrl', e.target.value)
                    }
                    placeholder="Live Link (https://...)"
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                  <input
                    type="text"
                    value={proj.technologies.join(', ')}
                    onChange={(e) =>
                      handleUpdateProject(
                        proj.id,
                        'technologies',
                        e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                      )
                    }
                    placeholder="Technologies (comma-separated)"
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      {proj.title}
                    </h3>
                    <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                      {proj.role}
                    </p>
                  </div>
                  {proj.period && (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 shrink-0">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      <span>{proj.period}</span>
                    </span>
                  )}
                </div>

                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {proj.description}
                </p>

                {proj.bullets && proj.bullets.length > 0 && (
                  <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300">
                    {proj.bullets.map((b, bIdx) => (
                      <li key={bIdx} className="flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Tech Stack Badges */}
                {proj.technologies && proj.technologies.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-2">
                    <Tag className="w-3 h-3 text-slate-400" />
                    {proj.technologies.map((t, tIdx) => (
                      <span
                        key={tIdx}
                        className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Bottom Actions */}
            {!isEditing && (
              <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                {proj.liveUrl && (
                  <a
                    href={proj.liveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>View Project</span>
                  </a>
                )}
                {proj.githubUrl && (
                  <a
                    href={proj.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 dark:text-slate-300 hover:underline ml-3"
                  >
                    <Github className="w-3.5 h-3.5" />
                    <span>Codebase</span>
                  </a>
                )}
                {proj.documentId && onOpenDocument && (
                  <button
                    type="button"
                    onClick={() => onOpenDocument(proj.documentId!)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline ml-auto"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Attached Document</span>
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      )}
    </section>
  );
};
