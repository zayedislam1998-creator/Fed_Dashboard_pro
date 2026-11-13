import React from 'react';
import { motion } from 'motion/react';
import {
  Compass,
  Target,
  Briefcase,
  Users,
  Bell,
  Image as ImageIcon,
  Video,
  MessageSquareQuote,
  MapPin,
  ExternalLink,
} from 'lucide-react';

export interface CorporateDockSection {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const CORPORATE_DOCK_SECTIONS: CorporateDockSection[] = [
  { id: 'sec-org-hero', label: 'Hero Banner', icon: Compass },
  { id: 'sec-org-mission', label: 'Mission & Vision', icon: Target },
  { id: 'sec-org-services', label: 'Programs & Services', icon: Briefcase },
  { id: 'sec-org-team', label: 'Leadership Team', icon: Users },
  { id: 'sec-org-updates', label: 'News & Updates', icon: Bell },
  { id: 'sec-org-photo', label: 'Photo Gallery', icon: ImageIcon },
  { id: 'sec-org-video', label: 'Video Showcase', icon: Video },
  { id: 'sec-org-testimonials', label: 'Testimonials', icon: MessageSquareQuote },
  { id: 'sec-org-contact', label: 'HQ & Contact', icon: MapPin },
];

interface CorporateScrollSpyDockProps {
  activeSectionId: string;
  onSelectSection: (id: string) => void;
  websiteUrl?: string;
}

export const CorporateScrollSpyDock: React.FC<CorporateScrollSpyDockProps> = ({
  activeSectionId,
  onSelectSection,
  websiteUrl,
}) => {
  return (
    <nav
      aria-label="Corporate Website Sections"
      className="max-w-6xl mx-auto px-3 sm:px-8 pt-3 sm:pt-4 print:hidden"
    >
      <div className="flex items-center justify-between gap-2 p-1.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1">
          {CORPORATE_DOCK_SECTIONS.map((sec) => {
            const Icon = sec.icon;
            const isActive = activeSectionId === sec.id;
            return (
              <motion.button
                key={sec.id}
                whileTap={{ scale: 0.95 }}
                type="button"
                onClick={() => onSelectSection(sec.id)}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer z-10 ${
                  isActive
                    ? 'text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="corpSectionDockActive"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    className="absolute inset-0 rounded-xl bg-blue-600 shadow-2xs -z-10"
                  />
                )}
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{sec.label}</span>
              </motion.button>
            );
          })}
        </div>

        {websiteUrl && (
          <a
            href={websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-xs font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap shrink-0"
          >
            <span>Visit Site</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </nav>
  );
};
