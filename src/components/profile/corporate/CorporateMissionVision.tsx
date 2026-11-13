import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Target, Compass, Sparkles, Plus, X, ArrowUpRight } from 'lucide-react';
import type { CorporateOrgProfileData } from '../../../services/workspaceApi';

interface CorporateMissionVisionProps {
  missionVision: CorporateOrgProfileData['missionVision'];
  isEditing: boolean;
  onChangeMissionVision: (mv: CorporateOrgProfileData['missionVision']) => void;
}

export const CorporateMissionVision: React.FC<CorporateMissionVisionProps> = ({
  missionVision,
  isEditing,
  onChangeMissionVision,
}) => {
  const [newValueInput, setNewValueInput] = useState('');

  const handleAddValue = () => {
    if (!newValueInput.trim()) return;
    const updatedValues = [...(missionVision.values || []), newValueInput.trim()];
    onChangeMissionVision({ ...missionVision, values: updatedValues });
    setNewValueInput('');
  };

  const handleRemoveValue = (idx: number) => {
    const updatedValues = (missionVision.values || []).filter((_, i) => i !== idx);
    onChangeMissionVision({ ...missionVision, values: updatedValues });
  };

  return (
    <section
      id="sec-org-mission"
      aria-label="Corporate Mission, Vision and Values"
      className="space-y-5 scroll-mt-24"
    >
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <span className="text-[11px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 block">
            01 / Strategic Foundation
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Institutional Mission, Vision &amp; Governance Principles
          </h2>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md">
          Built on measurable impact, transparent execution, and sustainable long-term value creation.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* 1. Mission Card */}
        <motion.div
          whileHover={{ y: -3 }}
          transition={{ duration: 0.2 }}
          className="relative p-6 sm:p-7 rounded-[26px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/90 shadow-[0_14px_40px_-15px_rgba(15,23,42,0.06)] flex flex-col justify-between overflow-hidden group"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 to-indigo-500" />
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-11 h-11 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Target className="w-5 h-5" />
              </div>
              <span className="text-xs font-black font-mono text-slate-300 dark:text-slate-700">
                01
              </span>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">
                Core Mandate
              </span>
              <h3 className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
                Our Mission
              </h3>
            </div>

            {isEditing ? (
              <textarea
                rows={4}
                value={missionVision.mission}
                onChange={(e) =>
                  onChangeMissionVision({
                    ...missionVision,
                    mission: e.target.value,
                  })
                }
                className="w-full text-xs p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                placeholder="State your organization's mission statement..."
              />
            ) : (
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {missionVision.mission.trim() ? (
                  missionVision.mission
                ) : (
                  <span className="text-slate-400 dark:text-slate-500 italic">
                    No mission statement added yet.
                  </span>
                )}
              </p>
            )}
          </div>

          <div className="mt-6 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] font-bold text-slate-400">
            <span>Strategic Execution</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-blue-500" />
          </div>
        </motion.div>

        {/* 2. Vision Card */}
        <motion.div
          whileHover={{ y: -3 }}
          transition={{ duration: 0.2 }}
          className="relative p-6 sm:p-7 rounded-[26px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/90 shadow-[0_14px_40px_-15px_rgba(15,23,42,0.06)] flex flex-col justify-between overflow-hidden group"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-600 to-purple-500" />
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Compass className="w-5 h-5" />
              </div>
              <span className="text-xs font-black font-mono text-slate-300 dark:text-slate-700">
                02
              </span>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                Future Horizon
              </span>
              <h3 className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
                Our Vision
              </h3>
            </div>

            {isEditing ? (
              <textarea
                rows={4}
                value={missionVision.vision}
                onChange={(e) =>
                  onChangeMissionVision({
                    ...missionVision,
                    vision: e.target.value,
                  })
                }
                className="w-full text-xs p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                placeholder="State your long-term organizational vision..."
              />
            ) : (
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {missionVision.vision.trim() ? (
                  missionVision.vision
                ) : (
                  <span className="text-slate-400 dark:text-slate-500 italic">
                    No vision statement added yet.
                  </span>
                )}
              </p>
            )}
          </div>

          <div className="mt-6 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] font-bold text-slate-400">
            <span>Global Benchmark</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-indigo-500" />
          </div>
        </motion.div>

        {/* 3. Core Values Card */}
        <motion.div
          whileHover={{ y: -3 }}
          transition={{ duration: 0.2 }}
          className="relative p-6 sm:p-7 rounded-[26px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/90 shadow-[0_14px_40px_-15px_rgba(15,23,42,0.06)] flex flex-col justify-between overflow-hidden group"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <span className="text-xs font-black font-mono text-slate-300 dark:text-slate-700">
                03
              </span>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                Cultural DNA
              </span>
              <h3 className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
                Core Values
              </h3>
            </div>

            {isEditing ? (
              <div className="space-y-2.5">
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={newValueInput}
                    onChange={(e) => setNewValueInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddValue())}
                    placeholder="Add value (e.g. Integrity)"
                    className="flex-1 text-xs px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddValue}
                    className="p-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                  {(missionVision.values || []).map((val, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold"
                    >
                      <span>{val}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveValue(idx)}
                        className="text-rose-500 hover:text-rose-700 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 pt-1">
                {missionVision.values && missionVision.values.length > 0 ? (
                  missionVision.values.map((val, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/90 text-slate-800 dark:text-slate-200 text-xs font-bold border border-slate-200/70 dark:border-slate-700/70"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>{val}</span>
                    </span>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 dark:text-slate-500 italic">
                    No core values added yet.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="mt-6 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] font-bold text-slate-400">
            <span>Operational Ethics</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
          </div>
        </motion.div>
      </div>
    </section>
  );
};
