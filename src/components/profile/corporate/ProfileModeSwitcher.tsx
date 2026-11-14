import React from 'react';
import { motion } from 'motion/react';
import {
  User,
  Building2,
  Edit3,
  Check,
  ArrowLeft,
  Globe,
  FileDown,
  QrCode,
  LayoutTemplate,
  Palette,
  Link2,
} from 'lucide-react';

export type ProfileViewMode = 'PERSONAL' | 'CORPORATE';
export type CorporateWebsiteMode = 'CUSTOM' | 'EMBED';

interface ProfileModeSwitcherProps {
  mode: ProfileViewMode;
  onSelectMode: (mode: ProfileViewMode) => void;
  isEditing: boolean;
  canEdit: boolean;
  onToggleEdit: () => void;
  onBackToTeams?: () => void;
  isSaving?: boolean;
  resumeTemplate?: 'MODERN_EXECUTIVE' | 'TECH_ATS' | 'MINIMAL_ELEGANT';
  onChangeResumeTemplate?: (
    tpl: 'MODERN_EXECUTIVE' | 'TECH_ATS' | 'MINIMAL_ELEGANT'
  ) => void;
  websiteMode?: CorporateWebsiteMode;
  onChangeWebsiteMode?: (mode: CorporateWebsiteMode) => void;
  corporateTheme?: 'blue' | 'emerald' | 'indigo' | 'amber';
  onChangeCorporateTheme?: (
    theme: 'blue' | 'emerald' | 'indigo' | 'amber'
  ) => void;
  isLivePreview?: boolean;
  onToggleLivePreview?: () => void;
  onExportPdf?: () => void;
  onOpenQrCard?: () => void;
}

export const ProfileModeSwitcher: React.FC<ProfileModeSwitcherProps> = ({
  mode,
  onSelectMode,
  isEditing,
  canEdit,
  onToggleEdit,
  onBackToTeams,
  isSaving = false,
  resumeTemplate = 'MODERN_EXECUTIVE',
  onChangeResumeTemplate,
  websiteMode = 'CUSTOM',
  onChangeWebsiteMode,
  corporateTheme = 'blue',
  onChangeCorporateTheme,
  isLivePreview = false,
  onToggleLivePreview,
  onExportPdf,
  onOpenQrCard,
}) => {
  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="sticky top-0 z-30 w-full py-2.5 px-3 sm:px-8 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-between gap-2.5 print:hidden"
    >
      {/* Top / Left Row: Back button + Segmented App Mode Switcher */}
      <div className="flex items-center gap-2 w-full sm:w-auto">
        {onBackToTeams && (
          <motion.button
            whileTap={{ scale: 0.94 }}
            type="button"
            onClick={onBackToTeams}
            className="flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Back to Teams</span>
          </motion.button>
        )}

        {/* Dual App Builder Mode Switcher */}
        <div className="grid grid-cols-2 sm:flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 flex-1 sm:flex-initial">
          <button
            type="button"
            onClick={() => onSelectMode('PERSONAL')}
            className={`relative flex items-center justify-center gap-1.5 px-2.5 sm:px-3.5 py-2 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-colors cursor-pointer z-10 ${
              mode === 'PERSONAL'
                ? 'text-white'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {mode === 'PERSONAL' && (
              <motion.span
                layoutId="profileStudioActiveTab"
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                className="absolute inset-0 rounded-lg bg-blue-600 shadow-xs -z-10"
              />
            )}
            <User className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Resume Studio</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectMode('CORPORATE')}
            className={`relative flex items-center justify-center gap-1.5 px-2.5 sm:px-3.5 py-2 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-colors cursor-pointer z-10 ${
              mode === 'CORPORATE'
                ? 'text-white'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {mode === 'CORPORATE' && (
              <motion.span
                layoutId="profileStudioActiveTab"
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                className="absolute inset-0 rounded-lg bg-blue-600 shadow-xs -z-10"
              />
            )}
            <Building2 className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Corporate Website</span>
          </button>
        </div>
      </div>

      {/* Bottom / Right Row: Context-Aware Studio Controls */}
      <div className="flex items-center justify-between sm:justify-end gap-2 overflow-x-auto no-scrollbar w-full sm:w-auto">
        <div className="flex items-center gap-1.5 shrink-0">
          {mode === 'PERSONAL' && onChangeResumeTemplate && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-xs shrink-0">
              <LayoutTemplate className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <select
                value={resumeTemplate}
                onChange={(e) =>
                  onChangeResumeTemplate(
                    e.target.value as 'MODERN_EXECUTIVE' | 'TECH_ATS' | 'MINIMAL_ELEGANT'
                  )
                }
                aria-label="Resume Layout Template"
                className="bg-transparent font-semibold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer text-[11px] sm:text-xs"
              >
                <option value="MODERN_EXECUTIVE">Modern Executive CV</option>
                <option value="TECH_ATS">ATS Standard Clean</option>
                <option value="MINIMAL_ELEGANT">Minimal Boardroom</option>
              </select>
            </div>
          )}

          {mode === 'PERSONAL' && onOpenQrCard && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={onOpenQrCard}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer shrink-0"
            >
              <QrCode className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="hidden xs:inline">vCard</span>
            </motion.button>
          )}

          {mode === 'PERSONAL' && onExportPdf && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={onExportPdf}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer shrink-0"
            >
              <FileDown className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>PDF</span>
            </motion.button>
          )}

          {mode === 'CORPORATE' && onChangeWebsiteMode && (
            <div
              role="group"
              aria-label="Corporate Website Mode"
              className="inline-flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shrink-0"
            >
              <button
                type="button"
                onClick={() => onChangeWebsiteMode('CUSTOM')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-bold transition-colors cursor-pointer ${
                  websiteMode === 'CUSTOM'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <LayoutTemplate className="w-3.5 h-3.5 shrink-0" />
                <span>Customize Website</span>
              </button>
              <button
                type="button"
                onClick={() => onChangeWebsiteMode('EMBED')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-bold transition-colors cursor-pointer ${
                  websiteMode === 'EMBED'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Link2 className="w-3.5 h-3.5 shrink-0" />
                <span>Embed Website</span>
              </button>
            </div>
          )}

          {mode === 'CORPORATE' && websiteMode === 'CUSTOM' && onChangeCorporateTheme && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-xs shrink-0">
              <Palette className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <select
                value={corporateTheme}
                onChange={(e) =>
                  onChangeCorporateTheme(
                    e.target.value as 'blue' | 'emerald' | 'indigo' | 'amber'
                  )
                }
                aria-label="Corporate Website Theme"
                className="bg-transparent font-semibold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer text-[11px] sm:text-xs"
              >
                <option value="blue">Royal Blue</option>
                <option value="emerald">Emerald Impact</option>
                <option value="indigo">Indigo Enterprise</option>
                <option value="amber">Amber Executive</option>
              </select>
            </div>
          )}

          {mode === 'CORPORATE' && websiteMode === 'CUSTOM' && onToggleLivePreview && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={onToggleLivePreview}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold border transition-colors cursor-pointer shrink-0 ${
                isLivePreview
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50'
              }`}
            >
              <Globe className="w-3.5 h-3.5 shrink-0" />
              <span>{isLivePreview ? 'Exit Preview' : 'Live Preview'}</span>
            </motion.button>
          )}
        </div>

        {canEdit && (mode === 'PERSONAL' || websiteMode === 'CUSTOM') && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
            type="button"
            onClick={onToggleEdit}
            disabled={isSaving}
            className={`flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold shadow-xs transition-colors cursor-pointer shrink-0 ${
              isEditing
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isEditing ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Edit3 className="w-3.5 h-3.5" />
            )}
            <span>
              {isEditing
                  ? mode === 'PERSONAL'
                    ? 'Save Resume'
                    : 'Save Website'
                  : mode === 'PERSONAL'
                    ? 'Customize Resume'
                    : 'Customize Website'}
            </span>
          </motion.button>
        )}
      </div>
    </motion.div>
  );
};
