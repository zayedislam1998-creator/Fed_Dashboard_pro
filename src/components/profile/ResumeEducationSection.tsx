import React from 'react';
import { GraduationCap, Plus, Trash2, Calendar, MapPin, Award } from 'lucide-react';
import { ResumeProfileData } from '../../services/workspaceApi';

interface ResumeEducationSectionProps {
  education: ResumeProfileData['education'];
  isEditing: boolean;
  onChangeEducation: (edu: ResumeProfileData['education']) => void;
}

export const ResumeEducationSection: React.FC<ResumeEducationSectionProps> = ({
  education,
  isEditing,
  onChangeEducation,
}) => {
  const handleAddEdu = () => {
    const newEdu: ResumeProfileData['education'][0] = {
      id: `edu-${Date.now()}`,
      institution: '',
      degree: '',
      fieldOfStudy: '',
      location: '',
      graduationDate: '',
      gpaOrHonors: '',
      highlights: [],
    };
    onChangeEducation([...education, newEdu]);
  };

  const handleRemoveEdu = (id: string) => {
    onChangeEducation(education.filter((e) => e.id !== id));
  };

  const handleUpdateEdu = (
    id: string,
    field: keyof ResumeProfileData['education'][0],
    value: any
  ) => {
    onChangeEducation(
      education.map((e) => (e.id === id ? { ...e, [field]: value } : e))
    );
  };

  return (
    <section
      id="sec-education"
      className="scroll-mt-24 rounded-3xl p-6 sm:p-8 bg-white/75 dark:bg-slate-900/75 backdrop-blur-2xl border border-white/60 dark:border-slate-800/80 shadow-[0_10px_35px_rgba(0,0,0,0.04)] space-y-5"
    >
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Education & Academic Credentials
            </h2>
            <p className="text-xs text-slate-500">
              Higher education degrees, academic distinctions, and honors
            </p>
          </div>
        </div>

        {isEditing && (
          <button
            type="button"
            onClick={handleAddEdu}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Degree</span>
          </button>
        )}
      </div>

      {education.length === 0 ? (
        <div className="p-5 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 text-center space-y-2">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            No education records added yet.
          </p>
          {isEditing && (
            <button
              type="button"
              onClick={handleAddEdu}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Degree</span>
            </button>
          )}
        </div>
      ) : (
      <div className="grid grid-cols-1 gap-3.5">
        {education.map((item) => (
          <div
            key={item.id}
            className="p-4 sm:p-5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 space-y-2.5 hover:shadow-md transition-all"
          >
            {isEditing ? (
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-400 uppercase">Degree Record</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveEdu(item.id)}
                    className="text-rose-500 hover:text-rose-700"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <input
                  type="text"
                  value={item.institution}
                  onChange={(e) => handleUpdateEdu(item.id, 'institution', e.target.value)}
                  placeholder="Institution / University"
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
                <input
                  type="text"
                  value={item.degree}
                  onChange={(e) => handleUpdateEdu(item.id, 'degree', e.target.value)}
                  placeholder="Degree (e.g. Master of Science)"
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
                <input
                  type="text"
                  value={item.fieldOfStudy}
                  onChange={(e) => handleUpdateEdu(item.id, 'fieldOfStudy', e.target.value)}
                  placeholder="Field of Study / Major"
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={item.graduationDate}
                    onChange={(e) => handleUpdateEdu(item.id, 'graduationDate', e.target.value)}
                    placeholder="Graduation Year (e.g. 2021)"
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                  <input
                    type="text"
                    value={item.gpaOrHonors || ''}
                    onChange={(e) => handleUpdateEdu(item.id, 'gpaOrHonors', e.target.value)}
                    placeholder="GPA / Honors"
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      {item.degree} in {item.fieldOfStudy}
                    </h3>
                    <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                      {item.institution}
                    </p>
                  </div>
                  {item.graduationDate && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-slate-500 shrink-0">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{item.graduationDate}</span>
                    </span>
                  )}
                </div>

                {item.location && (
                  <p className="flex items-center gap-1 text-xs text-slate-500">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{item.location}</span>
                  </p>
                )}

                {item.gpaOrHonors && (
                  <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/80">
                    <Award className="w-3 h-3" />
                    <span>{item.gpaOrHonors}</span>
                  </div>
                )}

                {item.highlights && item.highlights.length > 0 && (
                  <ul className="text-xs text-slate-600 dark:text-slate-400 list-disc list-inside space-y-0.5 pt-1">
                    {item.highlights.map((h, i) => (
                      <li key={i}>{h}</li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        ))}
      </div>
      )}
    </section>
  );
};
