import React from 'react';
import {
  MessageSquareQuote,
  Plus,
  Trash2,
  Quote,
  Building,
} from 'lucide-react';
import type { CorporateOrgProfileData } from '../../../services/workspaceApi';

interface CorporateTestimonialsSectionProps {
  testimonials: CorporateOrgProfileData['testimonials'];
  isEditing: boolean;
  onChangeTestimonials: (
    testimonials: CorporateOrgProfileData['testimonials']
  ) => void;
}

export const CorporateTestimonialsSection: React.FC<
  CorporateTestimonialsSectionProps
> = ({ testimonials, isEditing, onChangeTestimonials }) => {
  const handleAddTestimonial = () => {
    const newTestimonial = {
      id: `testim-${Date.now()}`,
      quote: '',
      authorName: '',
      authorTitle: '',
      organization: '',
      authorAvatarUrl: '',
    };
    onChangeTestimonials([...(testimonials || []), newTestimonial]);
  };

  const handleDeleteTestimonial = (id: string) => {
    onChangeTestimonials((testimonials || []).filter((t) => t.id !== id));
  };

  const handleUpdateTestimonial = (
    id: string,
    field: keyof CorporateOrgProfileData['testimonials'][0],
    val: string
  ) => {
    onChangeTestimonials(
      (testimonials || []).map((t) =>
        t.id === id ? { ...t, [field]: val } : t
      )
    );
  };

  return (
    <section
      id="sec-org-testimonials"
      aria-label="Institutional Endorsements"
      className="space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquareQuote className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
            Institutional Endorsements & Stakeholder Feedback
          </h2>
        </div>

        {isEditing && (
          <button
            type="button"
            onClick={handleAddTestimonial}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Endorsement</span>
          </button>
        )}
      </div>

      {(!testimonials || testimonials.length === 0) ? (
        <div className="p-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 text-center space-y-2">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            No endorsements added yet.
          </p>
          {isEditing && (
            <button
              type="button"
              onClick={handleAddTestimonial}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add First Endorsement</span>
            </button>
          )}
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {testimonials.map((t) => (
          <div
            key={t.id}
            className="p-6 rounded-3xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-md hover:shadow-lg transition-all flex flex-col justify-between relative group"
          >
            <Quote className="w-8 h-8 text-blue-600/20 dark:text-blue-400/20 mb-2" />

            {/* Quote */}
            {isEditing ? (
              <textarea
                rows={3}
                value={t.quote}
                onChange={(e) =>
                  handleUpdateTestimonial(t.id, 'quote', e.target.value)
                }
                className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white mb-3"
                placeholder="Endorsement quote text..."
              />
            ) : (
              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 italic leading-relaxed mb-4">
                "{t.quote}"
              </p>
            )}

            {/* Author details */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                {t.authorAvatarUrl && (
                  <img
                    src={t.authorAvatarUrl}
                    alt={t.authorName}
                    className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700 shadow-xs"
                  />
                )}
                <div>
                  {isEditing ? (
                    <div className="space-y-1">
                      <input
                        type="text"
                        value={t.authorName}
                        onChange={(e) =>
                          handleUpdateTestimonial(
                            t.id,
                            'authorName',
                            e.target.value
                          )
                        }
                        className="text-xs font-bold px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700"
                        placeholder="Author Name"
                      />
                      <input
                        type="text"
                        value={t.authorTitle}
                        onChange={(e) =>
                          handleUpdateTestimonial(
                            t.id,
                            'authorTitle',
                            e.target.value
                          )
                        }
                        className="text-[11px] px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700"
                        placeholder="Author Title"
                      />
                      <input
                        type="text"
                        value={t.organization || ''}
                        onChange={(e) =>
                          handleUpdateTestimonial(
                            t.id,
                            'organization',
                            e.target.value
                          )
                        }
                        className="text-[10px] px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700"
                        placeholder="Organization / Company"
                      />
                    </div>
                  ) : (
                    <div>
                      <h4 className="text-xs font-black text-slate-900 dark:text-white">
                        {t.authorName}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {t.authorTitle}
                      </p>
                      {t.organization && (
                        <div className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 font-semibold mt-0.5">
                          <Building className="w-2.5 h-2.5" />
                          <span>{t.organization}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {isEditing && (
                <button
                  type="button"
                  onClick={() => handleDeleteTestimonial(t.id)}
                  className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
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
