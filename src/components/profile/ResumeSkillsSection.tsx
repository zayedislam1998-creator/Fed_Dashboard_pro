import React from 'react';
import { Sparkles, Plus, Trash2 } from 'lucide-react';
import { ResumeProfileData } from '../../services/workspaceApi';

interface ResumeSkillsSectionProps {
  skills: ResumeProfileData['skills'];
  isEditing: boolean;
  onChangeSkills: (skills: ResumeProfileData['skills']) => void;
}

export const ResumeSkillsSection: React.FC<ResumeSkillsSectionProps> = ({
  skills,
  isEditing,
  onChangeSkills,
}) => {
  const handleAddCategory = () => {
    const newCategory: ResumeProfileData['skills'][0] = {
      category: '',
      items: [{ name: '', levelPercent: 80, levelBadge: 'Advanced' }],
    };
    onChangeSkills([...skills, newCategory]);
  };

  const handleRemoveCategory = (catIndex: number) => {
    onChangeSkills(skills.filter((_, i) => i !== catIndex));
  };

  const handleUpdateCategoryName = (catIndex: number, name: string) => {
    onChangeSkills(
      skills.map((cat, i) => (i === catIndex ? { ...cat, category: name } : cat))
    );
  };

  const handleAddItem = (catIndex: number) => {
    onChangeSkills(
      skills.map((cat, i) =>
        i === catIndex
          ? {
              ...cat,
              items: [
                ...cat.items,
                { name: '', levelPercent: 80, levelBadge: 'Advanced' },
              ],
            }
          : cat
      )
    );
  };

  const handleUpdateItem = (
    catIndex: number,
    itemIndex: number,
    field: 'name' | 'levelPercent' | 'levelBadge',
    value: any
  ) => {
    onChangeSkills(
      skills.map((cat, i) =>
        i === catIndex
          ? {
              ...cat,
              items: cat.items.map((item, j) =>
                j === itemIndex ? { ...item, [field]: value } : item
              ),
            }
          : cat
      )
    );
  };

  const handleRemoveItem = (catIndex: number, itemIndex: number) => {
    onChangeSkills(
      skills.map((cat, i) =>
        i === catIndex
          ? {
              ...cat,
              items: cat.items.filter((_, j) => j !== itemIndex),
            }
          : cat
      )
    );
  };

  return (
    <section
      id="sec-skills"
      className="scroll-mt-24 rounded-3xl p-6 sm:p-8 bg-white/75 dark:bg-slate-900/75 backdrop-blur-2xl border border-white/60 dark:border-slate-800/80 shadow-[0_10px_35px_rgba(0,0,0,0.04)] space-y-6"
    >
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Core Competencies & Proficiency Matrix
            </h2>
            <p className="text-xs text-slate-500">
              Technical, architectural, and executive competencies
            </p>
          </div>
        </div>

        {isEditing && (
          <button
            type="button"
            onClick={handleAddCategory}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Category</span>
          </button>
        )}
      </div>

      {skills.length === 0 ? (
        <div className="p-5 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 text-center space-y-2">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            No skills added yet.
          </p>
          {isEditing && (
            <button
              type="button"
              onClick={handleAddCategory}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Skill Category</span>
            </button>
          )}
        </div>
      ) : (
      <div className="grid grid-cols-1 gap-4">
        {skills.map((categoryGroup, catIdx) => (
          <div
            key={catIdx}
            className="p-4 sm:p-5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 space-y-3.5 hover:shadow-md transition-all"
          >
            {isEditing ? (
              <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
                <input
                  type="text"
                  value={categoryGroup.category}
                  onChange={(e) => handleUpdateCategoryName(catIdx, e.target.value)}
                  className="font-bold text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex-1"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveCategory(catIdx)}
                  className="text-rose-500 hover:text-rose-700 p-1"
                  title="Remove Category"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-2">
                {categoryGroup.category}
              </h3>
            )}

            <div className="space-y-3">
              {categoryGroup.items.map((skill, itemIdx) => (
                <div key={itemIdx} className="space-y-1.5">
                  {isEditing ? (
                    <div className="flex items-center gap-2 text-xs">
                      <input
                        type="text"
                        value={skill.name}
                        onChange={(e) =>
                          handleUpdateItem(catIdx, itemIdx, 'name', e.target.value)
                        }
                        className="flex-1 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                        placeholder="Skill Name"
                      />
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={skill.levelPercent}
                        onChange={(e) =>
                          handleUpdateItem(
                            catIdx,
                            itemIdx,
                            'levelPercent',
                            Number(e.target.value)
                          )
                        }
                        className="w-14 px-1.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-center"
                      />
                      <select
                        value={skill.levelBadge}
                        onChange={(e) =>
                          handleUpdateItem(catIdx, itemIdx, 'levelBadge', e.target.value)
                        }
                        className="px-1.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                      >
                        <option value="Expert">Expert</option>
                        <option value="Advanced">Advanced</option>
                        <option value="Intermediate">Intermediate</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(catIdx, itemIdx)}
                        className="text-rose-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {skill.name}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400">
                          {skill.levelBadge} ({skill.levelPercent}%)
                        </span>
                      </div>

                      {/* Visual Progress Bar */}
                      <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-all duration-500"
                          style={{ width: `${skill.levelPercent}%` }}
                        />
                      </div>
                    </>
                  )}
                </div>
              ))}

              {isEditing && (
                <button
                  type="button"
                  onClick={() => handleAddItem(catIdx)}
                  className="w-full py-1 text-center text-xs font-semibold text-blue-600 hover:underline flex items-center justify-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Skill to {categoryGroup.category}</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      )}
    </section>
  );
};
