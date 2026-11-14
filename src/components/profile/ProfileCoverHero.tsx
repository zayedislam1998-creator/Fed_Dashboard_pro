import React from 'react';
import { motion } from 'motion/react';
import {
  ShieldCheck,
  Camera,
  Image as ImageIcon,
  Sparkles,
  ArrowLeft,
  FileDown,
  QrCode,
  Edit3,
  Check,
  MapPin,
  Mail,
  Phone,
  Linkedin,
  Github,
  Globe,
  Briefcase,
  FolderGit2,
  Award,
  Layers,
} from 'lucide-react';
import { ResumeProfileData } from '../../services/workspaceApi';

interface ProfileCoverHeroProps {
  resume: ResumeProfileData;
  isEditing: boolean;
  canEdit: boolean;
  onToggleEdit: () => void;
  onEditAvatar: () => void;
  onEditCover: () => void;
  onExportPdf: () => void;
  onOpenQrCard: () => void;
  onBackToTeams?: () => void;
  isSaving?: boolean;
  onChangeHeader?: (header: ResumeProfileData['header']) => void;
}

export const ProfileCoverHero: React.FC<ProfileCoverHeroProps> = ({
  resume,
  isEditing,
  canEdit,
  onToggleEdit,
  onEditAvatar,
  onEditCover,
  onExportPdf,
  onOpenQrCard,
  onBackToTeams,
  isSaving = false,
  onChangeHeader,
}) => {
  const { header, contact, experience = [], projects = [], skills = [], certifications = [] } = resume;

  const totalSkillsCount = skills.reduce((acc, cat) => acc + (cat.items?.length || 0), 0);

  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="relative w-full rounded-[28px] overflow-hidden bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/90 shadow-[0_20px_60px_-15px_rgba(15,23,42,0.08)] transition-all"
    >
      {/* Top Floating "Back to Teams" button if viewing member profile */}
      {onBackToTeams && (
        <div className="absolute top-3.5 left-3.5 sm:top-5 sm:left-5 z-20">
          <motion.button
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={onBackToTeams}
            className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-slate-950/75 hover:bg-slate-950 text-white backdrop-blur-xl border border-white/15 text-xs font-bold shadow-lg transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-blue-400" />
            <span>Back to Directory</span>
          </motion.button>
        </div>
      )}

      {/* Ultra-Modern Architectural Hero Cover Banner */}
      <div className="relative h-44 sm:h-64 w-full overflow-hidden bg-slate-950">
        {header.coverImageUrl ? (
          <>
            <img
              src={header.coverImageUrl}
              alt="Executive Cover"
              className="w-full h-full object-cover opacity-90"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent" />
          </>
        ) : (
          <>
            {/* Modern Aurora & Architectural Mesh */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950" />
            <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-blue-500/25 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 right-10 w-96 h-96 rounded-full bg-indigo-500/25 blur-3xl pointer-events-none" />
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-full h-32 bg-gradient-to-r from-cyan-500/10 via-blue-500/15 to-purple-500/10 blur-2xl pointer-events-none" />
          </>
        )}

        {/* Fine Architectural Grid Overlay */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.08) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />

        {/* Top-Right Executive Badge or Cover Edit Button */}
        <div className="absolute top-3.5 right-3.5 sm:top-5 sm:right-5 z-20 flex items-center gap-2">
          {canEdit && isEditing ? (
            <motion.button
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={onEditCover}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold backdrop-blur-xl border border-white/20 transition-all shadow-lg cursor-pointer"
            >
              <ImageIcon className="w-3.5 h-3.5 text-blue-300" />
              <span>Customize Cover</span>
            </motion.button>
          ) : (
            <div className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-[11px] font-bold text-white/90 tracking-wide uppercase">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>Verified Executive Dossier</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Executive Identity & Action Deck */}
      <div className="px-4 sm:px-8 pb-6 sm:pb-8">
        <div className="flex flex-col sm:flex-row items-center sm:items-end justify-between gap-4 sm:gap-6 -mt-16 sm:-mt-20 mb-5 relative z-10">
          {/* Avatar Frame */}
          <motion.div
            initial={false}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.06, type: 'spring', stiffness: 300, damping: 24 }}
            className="relative group"
          >
            <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-3xl p-1.5 bg-white dark:bg-slate-900 shadow-[0_12px_32px_rgba(0,0,0,0.18)] border border-slate-200/80 dark:border-slate-800 shrink-0 overflow-hidden">
              {header.avatarUrl ? (
                <img
                  src={header.avatarUrl}
                  alt={header.fullName}
                  className="w-full h-full rounded-2xl object-cover"
                />
              ) : (
                <div className="w-full h-full rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-slate-900 text-white font-black text-3xl sm:text-4xl flex items-center justify-center">
                  {(header.fullName || 'U').trim().charAt(0).toUpperCase() || 'U'}
                </div>
              )}
            </div>

            {header.verifiedBadge && (
              <div
                className="absolute -bottom-1 -right-1 p-1.5 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-lg border-2 border-white dark:border-slate-900"
                title="Verified Executive Identity"
              >
                <ShieldCheck className="w-4 h-4" />
              </div>
            )}

            {canEdit && isEditing && (
              <button
                type="button"
                onClick={onEditAvatar}
                className="absolute inset-1.5 rounded-2xl bg-slate-950/65 text-white flex flex-col items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity backdrop-blur-xs font-bold text-xs gap-1 cursor-pointer"
                title="Update Profile Photo"
              >
                <Camera className="w-5 h-5 text-blue-400" />
                <span>Photo</span>
              </button>
            )}
          </motion.div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-end w-full sm:w-auto">
            <motion.button
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={onExportPdf}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-slate-100/90 dark:bg-slate-800/90 hover:bg-slate-200/80 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs font-bold border border-slate-200/80 dark:border-slate-700/80 transition-all cursor-pointer"
            >
              <FileDown className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Export CV</span>
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={onOpenQrCard}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-slate-100/90 dark:bg-slate-800/90 hover:bg-slate-200/80 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs font-bold border border-slate-200/80 dark:border-slate-700/80 transition-all cursor-pointer"
            >
              <QrCode className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Digital Pass</span>
            </motion.button>

            {canEdit && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                type="button"
                onClick={onToggleEdit}
                disabled={isSaving}
                className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-2xl text-xs font-bold shadow-lg transition-all cursor-pointer ${
                  isEditing
                    ? 'bg-emerald-600 text-white shadow-emerald-600/25 hover:bg-emerald-700'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-blue-600/25 hover:from-blue-700 hover:to-indigo-700'
                }`}
              >
                {isEditing ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Edit3 className="w-4 h-4" />
                )}
                <span>{isEditing ? 'Save CV Changes' : 'Customize CV'}</span>
              </motion.button>
            )}
          </div>
        </div>

        {/* Identity Details or Inline Editor */}
        {isEditing && onChangeHeader ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 mb-5 text-left">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Full Executive Name
              </label>
              <input
                type="text"
                value={header.fullName}
                onChange={(e) =>
                  onChangeHeader({ ...header, fullName: e.target.value })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm font-bold text-slate-900 dark:text-white"
                placeholder="Full Name"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Professional Headline / Role
              </label>
              <input
                type="text"
                value={header.professionalTitle}
                onChange={(e) =>
                  onChangeHeader({ ...header, professionalTitle: e.target.value })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm font-semibold text-blue-600 dark:text-blue-400"
                placeholder="e.g. Chief Technology Officer"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Availability / Status Badge
              </label>
              <input
                type="text"
                value={header.statusText || ''}
                onChange={(e) =>
                  onChangeHeader({ ...header, statusText: e.target.value })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm text-emerald-700 dark:text-emerald-400"
                placeholder="e.g. Available for Strategic Initiatives"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-center sm:text-left">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                {header.fullName.trim() || 'Profile Not Named Yet'}
              </h1>
              {header.statusText && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60 w-fit mx-auto sm:mx-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>{header.statusText}</span>
                </span>
              )}
            </div>

            {header.professionalTitle.trim() ? (
              <p className="text-sm sm:text-lg font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 bg-clip-text text-transparent flex items-center justify-center sm:justify-start gap-2">
                <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <span>{header.professionalTitle}</span>
              </p>
            ) : (
              <p className="text-xs sm:text-sm font-medium text-slate-400 dark:text-slate-500 italic">
                Professional headline not added yet
              </p>
            )}

            {/* Quick Contact & Social Pills */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
              {contact.email && (
                <a
                  href={`mailto:${contact.email}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200/60 dark:border-slate-700/60 transition-colors"
                >
                  <Mail className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span className="truncate max-w-[200px] sm:max-w-none">{contact.email}</span>
                </a>
              )}
              {contact.phone && (
                <a
                  href={`tel:${contact.phone}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200/60 dark:border-slate-700/60 transition-colors"
                >
                  <Phone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>{contact.phone}</span>
                </a>
              )}
              {(contact.city || contact.country) && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60">
                  <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>
                    {[contact.city, contact.state, contact.country]
                      .filter(Boolean)
                      .join(', ')}
                  </span>
                </span>
              )}
              {contact.linkedInUrl && (
                <a
                  href={contact.linkedInUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 hover:text-blue-600 border border-slate-200/60 dark:border-slate-700/60 transition-colors"
                  title="LinkedIn"
                >
                  <Linkedin className="w-3.5 h-3.5 text-blue-600" />
                </a>
              )}
              {contact.githubUrl && (
                <a
                  href={contact.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white border border-slate-200/60 dark:border-slate-700/60 transition-colors"
                  title="GitHub"
                >
                  <Github className="w-3.5 h-3.5" />
                </a>
              )}
              {contact.portfolioUrl && (
                <a
                  href={contact.portfolioUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 hover:text-indigo-600 border border-slate-200/60 dark:border-slate-700/60 transition-colors"
                  title="Portfolio Website"
                >
                  <Globe className="w-3.5 h-3.5 text-indigo-500" />
                </a>
              )}
            </div>
          </div>
        )}

        {/* Executive KPI Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mt-6 pt-5 border-t border-slate-100 dark:border-slate-800/80">
          <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-50/90 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800/80 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
              <Briefcase className="w-4 h-4" />
            </div>
            <div>
              <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-none">
                {experience.length}
              </div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1">
                Career Roles
              </div>
            </div>
          </div>

          <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-50/90 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800/80 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
              <FolderGit2 className="w-4 h-4" />
            </div>
            <div>
              <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-none">
                {projects.length}
              </div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1">
                Key Projects
              </div>
            </div>
          </div>

          <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-50/90 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800/80 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-none">
                {totalSkillsCount}
              </div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1">
                Core Skills
              </div>
            </div>
          </div>

          <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-50/90 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800/80 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-none">
                {certifications.length}
              </div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1">
                Credentials
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
