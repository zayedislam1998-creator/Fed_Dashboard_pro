import React from 'react';
import { motion } from 'motion/react';
import {
  Building2,
  ShieldCheck,
  Calendar,
  Phone,
  Mail,
  Camera,
  Globe,
  ExternalLink,
  Send,
  Sparkles,
} from 'lucide-react';
import type { CorporateOrgProfileData } from '../../../services/workspaceApi';

interface CorporateWebsiteHeaderProps {
  branding: CorporateOrgProfileData['branding'];
  themeAccent?: 'blue' | 'emerald' | 'indigo' | 'amber';
  isEditing: boolean;
  onChangeBranding: (branding: CorporateOrgProfileData['branding']) => void;
  onEditLogo: () => void;
  onScrollToContact: () => void;
  onNavigateSection?: (sectionId: string) => void;
}

const ACCENT_GRADIENTS: Record<string, string> = {
  blue: 'from-blue-600 via-indigo-600 to-sky-500',
  emerald: 'from-emerald-600 via-teal-600 to-cyan-500',
  indigo: 'from-indigo-600 via-violet-600 to-purple-500',
  amber: 'from-amber-500 via-orange-600 to-rose-500',
};

const ACCENT_BUTTONS: Record<string, string> = {
  blue: 'from-blue-600 to-indigo-600 shadow-blue-600/25 hover:from-blue-700 hover:to-indigo-700',
  emerald: 'from-emerald-600 to-teal-600 shadow-emerald-600/25 hover:from-emerald-700 hover:to-teal-700',
  indigo: 'from-indigo-600 to-violet-600 shadow-indigo-600/25 hover:from-indigo-700 hover:to-violet-700',
  amber: 'from-amber-600 to-orange-600 shadow-amber-600/25 hover:from-amber-700 hover:to-orange-700',
};

export const CorporateWebsiteHeader: React.FC<CorporateWebsiteHeaderProps> = ({
  branding,
  themeAccent = 'blue',
  isEditing,
  onChangeBranding,
  onEditLogo,
  onScrollToContact,
  onNavigateSection,
}) => {
  const topStripe = ACCENT_GRADIENTS[themeAccent] || ACCENT_GRADIENTS.blue;
  const ctaClass = ACCENT_BUTTONS[themeAccent] || ACCENT_BUTTONS.blue;

  return (
    <motion.header
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="relative w-full rounded-[28px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/90 shadow-[0_18px_50px_-15px_rgba(15,23,42,0.08)] overflow-hidden transition-all"
    >
      {/* Top Dynamic Brand Stripe */}
      <div className={`h-1.5 w-full bg-gradient-to-r ${topStripe}`} />

      {/* Top Enterprise Announcement & Quick Navigation Bar */}
      <div className="px-4 sm:px-8 py-2.5 bg-slate-50/90 dark:bg-slate-950/60 border-b border-slate-200/60 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-semibold">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Organization Portal</span>
          </span>
          {branding.regNumber && (
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-500">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
              <span>Reg: {branding.regNumber}</span>
            </span>
          )}
          {branding.establishedYear && (
            <span className="hidden md:inline-flex items-center gap-1 text-[11px] text-slate-500">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Est. {branding.establishedYear}</span>
            </span>
          )}
        </div>

        {/* Inline Landing Page Navigation Links */}
        <nav className="hidden lg:flex items-center gap-5 text-xs font-bold text-slate-600 dark:text-slate-300">
          <button
            type="button"
            onClick={() => onNavigateSection?.('sec-org-mission')}
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
          >
            Mission &amp; Vision
          </button>
          <button
            type="button"
            onClick={() => onNavigateSection?.('sec-org-services')}
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
          >
            Programs &amp; Services
          </button>
          <button
            type="button"
            onClick={() => onNavigateSection?.('sec-org-team')}
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
          >
            Leadership
          </button>
          <button
            type="button"
            onClick={() => onNavigateSection?.('sec-org-photo')}
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
          >
            Media Gallery
          </button>
          <button
            type="button"
            onClick={onScrollToContact}
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
          >
            Headquarters
          </button>
        </nav>

        <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          {branding.phone && (
            <a
              href={`tel:${branding.phone}`}
              className="hover:text-blue-600 transition-colors flex items-center gap-1"
            >
              <Phone className="w-3 h-3 text-blue-500" />
              <span>{branding.phone}</span>
            </a>
          )}
          {branding.websiteUrl && (
            <a
              href={branding.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-600 transition-colors flex items-center gap-1"
            >
              <Globe className="w-3 h-3 text-blue-500" />
              <span className="hidden sm:inline">Live Domain</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </div>
      </div>

      {/* Main Brand Identity & CTA Bar */}
      <div className="p-5 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-5 sm:gap-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 text-center sm:text-left flex-1 min-w-0 w-full">
          {/* Logo Frame */}
          <div className="relative group shrink-0">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 border-2 border-slate-200/80 dark:border-slate-700 shadow-xl flex items-center justify-center overflow-hidden">
              {branding.logoUrl ? (
                <img
                  src={branding.logoUrl}
                  alt={branding.name}
                  className="w-full h-full object-contain p-2 bg-white"
                />
              ) : (
                <Building2 className="w-10 h-10 text-blue-400" />
              )}
            </div>

            {isEditing && (
              <button
                type="button"
                onClick={onEditLogo}
                aria-label="Upload and Edit Organization Logo"
                className="absolute inset-0 bg-slate-950/70 rounded-3xl flex flex-col items-center justify-center text-white text-[11px] font-bold opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity cursor-pointer backdrop-blur-xs"
              >
                <Camera className="w-5 h-5 mb-1 text-blue-400" />
                <span>Logo</span>
              </button>
            )}
          </div>

          {/* Organization Title & Tagline */}
          <div className="flex-1 min-w-0 space-y-2 w-full">
            {isEditing ? (
              <div className="space-y-2.5 w-full max-w-xl mx-auto sm:mx-0 text-left p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Organization Name
                  </label>
                  <input
                    type="text"
                    value={branding.name}
                    onChange={(e) =>
                      onChangeBranding({ ...branding, name: e.target.value })
                    }
                    className="w-full text-sm sm:text-base font-bold px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    placeholder="e.g. Apex Global Initiative"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                      Legal Entity Name
                    </label>
                    <input
                      type="text"
                      value={branding.legalName || ''}
                      onChange={(e) =>
                        onChangeBranding({ ...branding, legalName: e.target.value })
                      }
                      className="w-full text-xs px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      placeholder="Legal Name"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                      Reg / License #
                    </label>
                    <input
                      type="text"
                      value={branding.regNumber || ''}
                      onChange={(e) =>
                        onChangeBranding({ ...branding, regNumber: e.target.value })
                      }
                      className="w-full text-xs px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      placeholder="ORG-REG-2024"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                      Founded Year
                    </label>
                    <input
                      type="text"
                      value={branding.establishedYear || ''}
                      onChange={(e) =>
                        onChangeBranding({
                          ...branding,
                          establishedYear: e.target.value,
                        })
                      }
                      className="w-full text-xs px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      placeholder="2020"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                    Mission Tagline / Value Proposition
                  </label>
                  <input
                    type="text"
                    value={branding.tagline}
                    onChange={(e) =>
                      onChangeBranding({ ...branding, tagline: e.target.value })
                    }
                    className="w-full text-xs px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    placeholder="Empowering Next-Generation Scalable Impact"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                  <h1 className="text-xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                    {branding.name.trim() || 'Organization Website'}
                  </h1>
                  {branding.legalName && (
                    <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700">
                      {branding.legalName}
                    </span>
                  )}
                </div>

                {branding.tagline.trim() ? (
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-2xl font-medium leading-relaxed flex items-center justify-center sm:justify-start gap-1.5">
                    <Sparkles className="w-4 h-4 text-blue-500 shrink-0 hidden sm:inline" />
                    <span>{branding.tagline}</span>
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 dark:text-slate-500 italic">
                    Organization tagline not added yet
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Primary Contact & CTA */}
        <div className="flex flex-col sm:flex-row md:flex-col items-center md:items-end gap-2.5 shrink-0 w-full md:w-auto pt-3 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800">
          {branding.email && (
            <a
              href={`mailto:${branding.email}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-blue-600 transition-colors"
            >
              <Mail className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span className="truncate max-w-[200px]">{branding.email}</span>
            </a>
          )}

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
            type="button"
            onClick={onScrollToContact}
            className={`w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r ${ctaClass} text-white text-xs font-bold shadow-lg transition-all cursor-pointer`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Partner &amp; Inquire</span>
          </motion.button>
        </div>
      </div>
    </motion.header>
  );
};
