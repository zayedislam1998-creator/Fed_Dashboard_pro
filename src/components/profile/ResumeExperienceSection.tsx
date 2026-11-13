import React from 'react';
import {
  Briefcase,
  Plus,
  Trash2,
  Calendar,
  MapPin,
  CheckCircle2,
  Tag,
} from 'lucide-react';
import { ResumeProfileData } from '../../services/workspaceApi';

interface ResumeExperienceSectionProps {
  experience: ResumeProfileData['experience'];
  isEditing: boolean;
  onChangeExperience: (exp: ResumeProfileData['experience']) => void;
}

export const ResumeExperienceSection: React.FC<ResumeExperienceSectionProps> = ({
  experience,
  isEditing,
  onChangeExperience,
}) => {
  const handleAddJob = () => {
    const newJob: ResumeProfileData['experience'][0] = {
      id: `exp-${Date.now()}`,
      company: '',
      position: '',
      employmentType: 'Full-time',
      location: '',
      startDate: '',
      endDate: '',
      isCurrent: true,
      bullets: [''],
      technologies: [],
    };
    onChangeExperience([newJob, ...experience]);
  };

  const handleRemoveJob = (id: string) => {
    onChangeExperience(experience.filter((e) => e.id !== id));
  };

  const handleUpdateJob = (
    id: string,
    field: keyof ResumeProfileData['experience'][0],
    value: any
  ) => {
    onChangeExperience(
      experience.map((e) => (e.id === id ? { ...e, [field]: value } : e))
    );
  };

  const handleAddBullet = (id: string) => {
    onChangeExperience(
      experience.map((e) =>
        e.id === id
          ? {
              ...e,
              bullets: [...e.bullets, ''],
            }
          : e
      )
    );
  };

  const handleUpdateBullet = (id: string, index: number, value: string) => {
    onChangeExperience(
      experience.map((e) =>
        e.id === id
          ? {
              ...e,
              bullets: e.bullets.map((b, i) => (i === index ? value : b)),
            }
          : e
      )
    );
  };

  const handleRemoveBullet = (id: string, index: number) => {
    onChangeExperience(
      experience.map((e) =>
        e.id === id
          ? {
              ...e,
              bullets: e.bullets.filter((_, i) => i !== index),
            }
          : e
      )
    );
  };

  return (
    <section
      id="sec-experience"
      className="scroll-mt-24 rounded-3xl p-6 sm:p-8 bg-white/75 dark:bg-slate-900/75 backdrop-blur-2xl border border-white/60 dark:border-slate-800/80 shadow-[0_10px_35px_rgba(0,0,0,0.04)] space-y-6"
    >
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Professional Experience Timeline
            </h2>
            <p className="text-xs text-slate-500">
              Career progression adhering to US Executive STAR/XYZ impact standards
            </p>
          </div>
        </div>

        {isEditing && (
          <button
            type="button"
            onClick={handleAddJob}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Position</span>
          </button>
        )}
      </div>

      {experience.length === 0 ? (
        <div className="p-5 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 text-center space-y-2">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            No career experience recorded yet.
          </p>
          {isEditing && (
            <button
              type="button"
              onClick={handleAddJob}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add First Position</span>
            </button>
          )}
        </div>
      ) : (
        <div className="relative pl-6 sm:pl-8 space-y-8 before:absolute before:left-2.5 sm:before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-gradient-to-b before:from-blue-600 before:via-indigo-500 before:to-slate-300 dark:before:to-slate-700">
          {experience.map((job) => (
            <div key={job.id} className="relative group">
              {/* Timeline Indicator Dot */}
              <div className="absolute -left-[30px] sm:-left-[34px] top-1.5 w-4 h-4 rounded-full bg-white dark:bg-slate-900 border-3 border-blue-600 shadow-xs" />

              <div className="p-5 sm:p-6 rounded-2xl bg-white/60 dark:bg-slate-850/60 border border-slate-200/60 dark:border-slate-800 space-y-3.5 hover:shadow-md transition-shadow">
                {isEditing ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Edit Position
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveJob(job.id)}
                        className="text-rose-600 hover:text-rose-700 p-1"
                        title="Delete Position"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block font-semibold mb-1">Position Title</label>
                        <input
                          type="text"
                          value={job.position}
                          onChange={(e) =>
                            handleUpdateJob(job.id, 'position', e.target.value)
                          }
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Company Name</label>
                        <input
                          type="text"
                          value={job.company}
                          onChange={(e) =>
                            handleUpdateJob(job.id, 'company', e.target.value)
                          }
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Employment Type</label>
                        <select
                          value={job.employmentType}
                          onChange={(e) =>
                            handleUpdateJob(job.id, 'employmentType', e.target.value)
                          }
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                        >
                          <option value="Full-time">Full-time</option>
                          <option value="Executive">Executive</option>
                          <option value="Contract">Contract</option>
                          <option value="Advisory">Advisory</option>
                          <option value="Part-time">Part-time</option>
                        </select>
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Location</label>
                        <input
                          type="text"
                          value={job.location}
                          onChange={(e) =>
                            handleUpdateJob(job.id, 'location', e.target.value)
                          }
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Start Date</label>
                        <input
                          type="text"
                          value={job.startDate}
                          onChange={(e) =>
                            handleUpdateJob(job.id, 'startDate', e.target.value)
                          }
                          placeholder="e.g. Jan 2022"
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">End Date</label>
                        <input
                          type="text"
                          value={job.endDate}
                          onChange={(e) =>
                            handleUpdateJob(job.id, 'endDate', e.target.value)
                          }
                          placeholder="e.g. Present"
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                        />
                      </div>
                    </div>

                    {/* Bullet Points Editor */}
                    <div className="space-y-2 pt-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Impact Bullet Points (STAR / XYZ Method)
                        </label>
                        <button
                          type="button"
                          onClick={() => handleAddBullet(job.id)}
                          className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add Bullet</span>
                        </button>
                      </div>
                      {job.bullets.map((bullet, bIdx) => (
                        <div key={bIdx} className="flex items-start gap-2">
                          <textarea
                            value={bullet}
                            onChange={(e) =>
                              handleUpdateBullet(job.id, bIdx, e.target.value)
                            }
                            rows={2}
                            className="flex-1 p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveBullet(job.id, bIdx)}
                            className="text-rose-500 hover:text-rose-700 p-1"
                            title="Remove Bullet"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Technologies */}
                    <div className="pt-2">
                      <label className="block text-xs font-semibold mb-1">
                        Technologies / Keywords (Comma-separated)
                      </label>
                      <input
                        type="text"
                        value={job.technologies.join(', ')}
                        onChange={(e) =>
                          handleUpdateJob(
                            job.id,
                            'technologies',
                            e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                          )
                        }
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                      <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                          {job.position}
                        </h3>
                        <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                          {job.company}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            {job.startDate} – {job.endDate || 'Present'}
                          </span>
                        </span>
                        {job.location && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            <span>{job.location}</span>
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {job.employmentType}
                        </span>
                      </div>
                    </div>

                    {/* Bullet Points */}
                    {job.bullets.length > 0 && (
                      <ul className="space-y-1.5 pt-1 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                        {job.bullets.map((b, bIdx) => (
                          <li key={bIdx} className="flex items-start gap-2.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* Tech Badges */}
                    {job.technologies.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                        <Tag className="w-3 h-3 text-slate-400" />
                        {job.technologies.map((t, tIdx) => (
                          <span
                            key={tIdx}
                            className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
