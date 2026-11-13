import React from 'react';
import {
  Globe,
  Mail,
  Phone,
  MapPin,
  Linkedin,
  Github,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { ResumeProfileData } from '../../services/workspaceApi';

interface ResumeContactSectionProps {
  contact: ResumeProfileData['contact'];
  isEditing: boolean;
  onChangeContact: (contact: ResumeProfileData['contact']) => void;
}

export const ResumeContactSection: React.FC<ResumeContactSectionProps> = ({
  contact,
  isEditing,
  onChangeContact,
}) => {
  const handleUpdate = (field: keyof ResumeProfileData['contact'], value: string) => {
    onChangeContact({
      ...contact,
      [field]: value,
    });
  };

  return (
    <section
      id="sec-contact"
      className="scroll-mt-24 rounded-3xl p-6 sm:p-8 bg-white/75 dark:bg-slate-900/75 backdrop-blur-2xl border border-white/60 dark:border-slate-800/80 shadow-[0_10px_35px_rgba(0,0,0,0.04)] space-y-6"
    >
      <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="p-2.5 rounded-2xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400">
          <Globe className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Global Contact & Professional Network
          </h2>
          <p className="text-xs text-slate-500">
            Direct communication channels, timezones, and professional profiles
          </p>
        </div>
      </div>

      {isEditing ? (
        <div className="grid grid-cols-1 gap-3 text-xs">
          <div>
            <label className="block font-semibold mb-1">Primary Email</label>
            <input
              type="email"
              value={contact.email}
              onChange={(e) => handleUpdate('email', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Phone Number</label>
            <input
              type="text"
              value={contact.phone}
              onChange={(e) => handleUpdate('phone', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">City</label>
            <input
              type="text"
              value={contact.city}
              onChange={(e) => handleUpdate('city', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">State / Province</label>
            <input
              type="text"
              value={contact.state}
              onChange={(e) => handleUpdate('state', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Country</label>
            <input
              type="text"
              value={contact.country}
              onChange={(e) => handleUpdate('country', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Timezone</label>
            <input
              type="text"
              value={contact.timezone}
              onChange={(e) => handleUpdate('timezone', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">LinkedIn Profile URL</label>
            <input
              type="text"
              value={contact.linkedInUrl || ''}
              onChange={(e) => handleUpdate('linkedInUrl', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">GitHub Profile URL</label>
            <input
              type="text"
              value={contact.githubUrl || ''}
              onChange={(e) => handleUpdate('githubUrl', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Portfolio / Website URL</label>
            <input
              type="text"
              value={contact.portfolioUrl || ''}
              onChange={(e) => handleUpdate('portfolioUrl', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
          {/* Email */}
          <div className="p-4 rounded-2xl bg-white/60 dark:bg-slate-850/60 border border-slate-200/60 dark:border-slate-800 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 shrink-0">
              <Mail className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">
                Official Email
              </span>
              {contact.email ? (
                <a
                  href={`mailto:${contact.email}`}
                  className="text-xs font-semibold text-slate-900 dark:text-slate-100 hover:text-blue-600 truncate block"
                >
                  {contact.email}
                </a>
              ) : (
                <span className="text-xs text-slate-400 italic block">Not provided</span>
              )}
            </div>
          </div>

          {/* Phone */}
          <div className="p-4 rounded-2xl bg-white/60 dark:bg-slate-850/60 border border-slate-200/60 dark:border-slate-800 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 shrink-0">
              <Phone className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">
                Direct Line
              </span>
              {contact.phone ? (
                <a
                  href={`tel:${contact.phone}`}
                  className="text-xs font-semibold text-slate-900 dark:text-slate-100 hover:text-emerald-600 truncate block"
                >
                  {contact.phone}
                </a>
              ) : (
                <span className="text-xs text-slate-400 italic block">Not provided</span>
              )}
            </div>
          </div>

          {/* Location */}
          <div className="p-4 rounded-2xl bg-white/60 dark:bg-slate-850/60 border border-slate-200/60 dark:border-slate-800 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 shrink-0">
              <MapPin className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">
                Location
              </span>
              <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate block">
                {[contact.city, contact.state, contact.country].filter(Boolean).join(', ') || (
                  <span className="text-slate-400 font-normal italic">Not specified</span>
                )}
              </span>
            </div>
          </div>

          {/* Timezone */}
          <div className="p-4 rounded-2xl bg-white/60 dark:bg-slate-850/60 border border-slate-200/60 dark:border-slate-800 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">
                Timezone
              </span>
              <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate block">
                {contact.timezone || (
                  <span className="text-slate-400 font-normal italic">Not specified</span>
                )}
              </span>
            </div>
          </div>

          {/* Social Profiles */}
          {contact.linkedInUrl && (
            <div className="p-4 rounded-2xl bg-white/60 dark:bg-slate-850/60 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 shrink-0">
                  <Linkedin className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">
                    LinkedIn
                  </span>
                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate block">
                    LinkedIn Profile
                  </span>
                </div>
              </div>
              <a
                href={contact.linkedInUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700 p-1"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          )}

          {contact.githubUrl && (
            <div className="p-4 rounded-2xl bg-white/60 dark:bg-slate-850/60 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 shrink-0">
                  <Github className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">
                    GitHub
                  </span>
                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate block">
                    Architecture & Code
                  </span>
                </div>
              </div>
              <a
                href={contact.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-600 hover:text-slate-800 dark:hover:text-white p-1"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          )}

          {contact.portfolioUrl && (
            <div className="p-4 rounded-2xl bg-white/60 dark:bg-slate-850/60 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 shrink-0">
                  <Globe className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">
                    Portfolio
                  </span>
                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate block">
                    Digital Showcase
                  </span>
                </div>
              </div>
              <a
                href={contact.portfolioUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-600 hover:text-purple-700 p-1"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
