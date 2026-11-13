import React from 'react';
import { motion } from 'motion/react';
import {
  User,
  Briefcase,
  GraduationCap,
  Sparkles,
  FolderGit2,
  Award,
  Globe,
} from 'lucide-react';

export interface DockSectionItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const DOCK_SECTIONS: DockSectionItem[] = [
  { id: 'sec-summary', label: 'Summary', icon: User },
  { id: 'sec-experience', label: 'Experience', icon: Briefcase },
  { id: 'sec-education', label: 'Education', icon: GraduationCap },
  { id: 'sec-skills', label: 'Skills', icon: Sparkles },
  { id: 'sec-projects', label: 'Projects', icon: FolderGit2 },
  { id: 'sec-certifications', label: 'Certifications', icon: Award },
  { id: 'sec-contact', label: 'Contact', icon: Globe },
];

interface FloatingScrollSpyDockProps {
  activeSectionId: string;
  onSelectSection: (id: string) => void;
  isEditing?: boolean;
  canEdit?: boolean;
  onToggleEdit?: () => void;
  onExportPdf?: () => void;
  onOpenQrCard?: () => void;
  isSaving?: boolean;
}

export const FloatingScrollSpyDock: React.FC<FloatingScrollSpyDockProps> = ({
  activeSectionId,
  onSelectSection,
}) => {
  return (
    <nav
      aria-label="Resume Builder Sections"
      className="max-w-5xl mx-auto px-3 sm:px-8 pt-3 sm:pt-4 print:hidden"
    >
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar p-1.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        {DOCK_SECTIONS.map((item) => {
          const Icon = item.icon;
          const isActive = activeSectionId === item.id;
          return (
            <motion.button
              key={item.id}
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={() => onSelectSection(item.id)}
              className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer z-10 ${
                isActive
                  ? 'text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="resumeSectionDockActive"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  className="absolute inset-0 rounded-xl bg-blue-600 shadow-2xs -z-10"
                />
              )}
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{item.label}</span>
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
};
