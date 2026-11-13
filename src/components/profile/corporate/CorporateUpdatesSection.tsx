import React from 'react';
import {
  Bell,
  Plus,
  Trash2,
  Calendar,
  ExternalLink,
} from 'lucide-react';
import type { CorporateOrgProfileData } from '../../../services/workspaceApi';

interface CorporateUpdatesSectionProps {
  updates: CorporateOrgProfileData['recentUpdates'];
  isEditing: boolean;
  onChangeUpdates: (updates: CorporateOrgProfileData['recentUpdates']) => void;
}

export const CorporateUpdatesSection: React.FC<CorporateUpdatesSectionProps> = ({
  updates,
  isEditing,
  onChangeUpdates,
}) => {
  const handleAddUpdate = () => {
    const newUpdate = {
      id: `update-${Date.now()}`,
      title: '',
      date: new Date().toISOString().split('T')[0],
      summary: '',
      imageUrl: '',
    };
    onChangeUpdates([newUpdate, ...(updates || [])]);
  };

  const handleDeleteUpdate = (id: string) => {
    onChangeUpdates((updates || []).filter((u) => u.id !== id));
  };

  const handleUpdateField = (
    id: string,
    field: keyof CorporateOrgProfileData['recentUpdates'][0],
    val: string
  ) => {
    onChangeUpdates(
      (updates || []).map((u) => (u.id === id ? { ...u, [field]: val } : u))
    );
  };

  return (
    <section
      id="sec-org-updates"
      aria-label="Recent Updates and News"
      className="space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
            Institutional News & Updates
          </h2>
        </div>

        {isEditing && (
          <button
            type="button"
            onClick={handleAddUpdate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Publish Update</span>
          </button>
        )}
      </div>

      {(!updates || updates.length === 0) ? (
        <div className="p-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 text-center space-y-2">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            No news or announcements published yet.
          </p>
          {isEditing && (
            <button
              type="button"
              onClick={handleAddUpdate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Publish First Update</span>
            </button>
          )}
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {updates.map((item) => (
          <div
            key={item.id}
            className="p-5 rounded-3xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-md hover:shadow-lg transition-all flex flex-col sm:flex-row gap-4 items-start group"
          >
            {/* Thumbnail if present */}
            {item.imageUrl && (
              <div className="w-full sm:w-32 h-28 rounded-2xl overflow-hidden shrink-0 bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60">
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
            )}

            <div className="flex-1 min-w-0 space-y-2 w-full">
              {/* Date */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  {isEditing ? (
                    <input
                      type="date"
                      value={item.date}
                      onChange={(e) =>
                        handleUpdateField(item.id, 'date', e.target.value)
                      }
                      className="text-[11px] px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                    />
                  ) : (
                    <span>{item.date}</span>
                  )}
                </div>

                {isEditing && (
                  <button
                    type="button"
                    onClick={() => handleDeleteUpdate(item.id)}
                    className="p-1 text-rose-500 hover:text-rose-700 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Title */}
              {isEditing ? (
                <input
                  type="text"
                  value={item.title}
                  onChange={(e) =>
                    handleUpdateField(item.id, 'title', e.target.value)
                  }
                  className="w-full text-sm font-bold px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  placeholder="Update Headline"
                />
              ) : (
                <h3 className="text-sm font-black text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {item.title}
                </h3>
              )}

              {/* Summary */}
              {isEditing ? (
                <textarea
                  rows={2}
                  value={item.summary}
                  onChange={(e) =>
                    handleUpdateField(item.id, 'summary', e.target.value)
                  }
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                  placeholder="Brief summary..."
                />
              ) : (
                <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                  {item.summary}
                </p>
              )}

              {/* Action / Link */}
              {item.linkUrl && !isEditing && (
                <a
                  href={item.linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline pt-1"
                >
                  <span>Read Full Release</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}

              {isEditing && (
                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={item.imageUrl || ''}
                    onChange={(e) =>
                      handleUpdateField(item.id, 'imageUrl', e.target.value)
                    }
                    placeholder="Image URL"
                    className="flex-1 text-[10px] px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                  <input
                    type="text"
                    value={item.linkUrl || ''}
                    onChange={(e) =>
                      handleUpdateField(item.id, 'linkUrl', e.target.value)
                    }
                    placeholder="Link URL"
                    className="flex-1 text-[10px] px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      )}
    </section>
  );
};
