import React from 'react';
import { motion } from 'motion/react';
import {
  Briefcase,
  Plus,
  Trash2,
  CheckCircle2,
  Tag,
  ArrowUpRight,
} from 'lucide-react';
import type { CorporateOrgProfileData } from '../../../services/workspaceApi';

interface CorporateServicesGridProps {
  services: CorporateOrgProfileData['services'];
  isEditing: boolean;
  onChangeServices: (services: CorporateOrgProfileData['services']) => void;
}

export const CorporateServicesGrid: React.FC<CorporateServicesGridProps> = ({
  services,
  isEditing,
  onChangeServices,
}) => {
  const handleAddService = () => {
    const newService = {
      id: `svc-${Date.now()}`,
      title: '',
      category: '',
      description: '',
      statusBadge: '',
    };
    onChangeServices([...(services || []), newService]);
  };

  const handleDeleteService = (id: string) => {
    onChangeServices((services || []).filter((s) => s.id !== id));
  };

  const handleUpdateService = (
    id: string,
    field: keyof CorporateOrgProfileData['services'][0],
    val: string
  ) => {
    onChangeServices(
      (services || []).map((s) => (s.id === id ? { ...s, [field]: val } : s))
    );
  };

  return (
    <section
      id="sec-org-services"
      aria-label="Services and Key Initiatives"
      className="space-y-5 scroll-mt-24"
    >
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <span className="text-[11px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 block">
            02 / Capabilities &amp; Solutions
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <span>Programs, Services &amp; Strategic Offerings</span>
          </h2>
        </div>

        {isEditing && (
          <button
            type="button"
            onClick={handleAddService}
            className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/20 cursor-pointer w-fit"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Program / Service</span>
          </button>
        )}
      </div>

      {(!services || services.length === 0) ? (
        <div className="p-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 text-center space-y-2">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            No programs or services added yet.
          </p>
          {isEditing && (
            <button
              type="button"
              onClick={handleAddService}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add First Program</span>
            </button>
          )}
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {services.map((service, idx) => (
          <motion.div
            key={service.id}
            whileHover={{ y: -3 }}
            transition={{ duration: 0.2 }}
            className="p-6 sm:p-7 rounded-[26px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/90 shadow-[0_14px_40px_-15px_rgba(15,23,42,0.06)] hover:border-blue-500/40 transition-all flex flex-col justify-between group"
          >
            <div className="space-y-4">
              {/* Top Index & Badges */}
              <div className="flex items-center justify-between gap-2">
                {isEditing ? (
                  <div className="flex items-center gap-2 w-full">
                    <input
                      type="text"
                      value={service.category || ''}
                      onChange={(e) =>
                        handleUpdateService(service.id, 'category', e.target.value)
                      }
                      placeholder="Category"
                      className="text-[10px] px-2.5 py-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 w-1/2"
                    />
                    <input
                      type="text"
                      value={service.statusBadge || ''}
                      onChange={(e) =>
                        handleUpdateService(service.id, 'statusBadge', e.target.value)
                      }
                      placeholder="Status Badge"
                      className="text-[10px] px-2.5 py-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-blue-600 w-1/2"
                    />
                  </div>
                ) : (
                  <>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      <Tag className="w-3 h-3 text-blue-500" />
                      <span>{service.category || 'Strategic Program'}</span>
                    </span>
                    {service.statusBadge && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        <span>{service.statusBadge}</span>
                      </span>
                    )}
                  </>
                )}
              </div>

              {/* Title */}
              {isEditing ? (
                <input
                  type="text"
                  value={service.title}
                  onChange={(e) =>
                    handleUpdateService(service.id, 'title', e.target.value)
                  }
                  className="w-full text-sm font-bold px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  placeholder="Service Title"
                />
              ) : (
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-snug">
                  {service.title}
                </h3>
              )}

              {/* Description */}
              {isEditing ? (
                <textarea
                  rows={3}
                  value={service.description}
                  onChange={(e) =>
                    handleUpdateService(service.id, 'description', e.target.value)
                  }
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  placeholder="Detailed description of the program/offering..."
                />
              ) : (
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-normal leading-relaxed">
                  {service.description}
                </p>
              )}
            </div>

            {isEditing ? (
              <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <button
                  type="button"
                  onClick={() => handleDeleteService(service.id)}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove</span>
                </button>
              </div>
            ) : (
              <div className="mt-6 pt-3.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs font-bold text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                <span className="font-mono text-[11px]">
                  PROGRAM // {String(idx + 1).padStart(2, '0')}
                </span>
                <ArrowUpRight className="w-4 h-4" />
              </div>
            )}
          </motion.div>
        ))}
      </div>
      )}
    </section>
  );
};
