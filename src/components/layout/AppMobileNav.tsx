import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Megaphone,
  Briefcase,
  CheckSquare,
  Users,
} from 'lucide-react';
import { WorkspaceModule } from './types';
import { NavigationContent, NavigationContentProps } from './AppSidebar';
import type { PostsNoticesSubTab } from '../PostsNoticesView';
import type { CmhProjectsSubTab } from '../CmhProjectsView';
import type { CmhTasksSubTab } from '../CmhTasksView';
import type { TeamsSubTab } from '../TeamsView';

export interface AppMobileNavProps extends NavigationContentProps {
  isMobileDrawerOpen: boolean;
  setIsMobileDrawerOpen: (val: boolean) => void;
  workspaceTitle: string;
  setPostsSubTab: (tab: PostsNoticesSubTab) => void;
  setCmhProjectsSubTab: (tab: CmhProjectsSubTab) => void;
  setCmhTasksSubTab: (tab: CmhTasksSubTab) => void;
  setTeamsSubTab: (tab: TeamsSubTab) => void;
}

export const AppMobileNav: React.FC<AppMobileNavProps> = (props) => {
  const {
    isMobileDrawerOpen,
    setIsMobileDrawerOpen,
    workspaceTitle,
    activeModule,
    setActiveModule,
    setPostsSubTab,
    setCmhProjectsSubTab,
    setCmhTasksSubTab,
    setTeamsSubTab,
  } = props;

  const mobileDrawerTouchStartRef = useRef<{ x: number; y: number } | null>(null);

  return (
    <>
      <AnimatePresence>
        {isMobileDrawerOpen && (
          <div
            className="md:hidden fixed inset-0 z-50 flex"
            onTouchStart={(e) => {
              const touch = e.touches[0];
              if (touch) {
                mobileDrawerTouchStartRef.current = { x: touch.clientX, y: touch.clientY };
              }
            }}
            onTouchEnd={(e) => {
              const start = mobileDrawerTouchStartRef.current;
              const touch = e.changedTouches[0];
              mobileDrawerTouchStartRef.current = null;
              if (!start || !touch) return;
              const dx = touch.clientX - start.x;
              const dy = Math.abs(touch.clientY - start.y);
              if (dx < -55 && Math.abs(dx) > dy * 1.2) {
                setIsMobileDrawerOpen(false);
              }
            }}
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px]"
              onClick={() => setIsMobileDrawerOpen(false)}
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 360, damping: 32 }}
              drag="x"
              dragDirectionLock
              dragConstraints={{ left: -320, right: 0 }}
              dragElastic={{ left: 0.12, right: 0 }}
              onDragEnd={(_event, info) => {
                if (info.offset.x < -64 || info.velocity.x < -280) {
                  setIsMobileDrawerOpen(false);
                }
              }}
              style={{ touchAction: 'pan-y' }}
              className="relative w-72 max-w-[82vw] bg-[#F6F8FC] dark:bg-slate-900 h-full shadow-2xl flex flex-col z-10 overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/80 dark:border-slate-800 shrink-0">
                <div className="min-w-0">
                  <span className="text-base font-bold text-slate-800 dark:text-slate-100 block truncate">
                    {workspaceTitle}
                  </span>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 block">
                    Swipe left to close
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileDrawerOpen(false)}
                  aria-label="Close navigation drawer"
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-200/60 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto overscroll-contain touch-pan-y">
                <NavigationContent {...props} isMobile={true} />
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Frosted Glassmorphism Mobile Bottom Navigation: Post, Project, Task, Team Profile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200/80 dark:border-slate-800 grid grid-cols-4 items-center px-2 z-30">
        {[
          { id: 'posts', label: 'Post', icon: Megaphone },
          { id: 'cmh_projects', label: 'Project', icon: Briefcase },
          { id: 'cmh_tasks', label: 'Task', icon: CheckSquare },
          { id: 'teams', label: 'Team Profile', icon: Users },
        ].map((item) => {
          const Icon = item.icon;
          const active = activeModule === item.id;
          return (
            <motion.button
              key={item.id}
              whileTap={{ scale: 0.93 }}
              type="button"
              onClick={() => {
                setActiveModule(item.id as WorkspaceModule);
                if (item.id === 'posts') setPostsSubTab('feed');
                if (item.id === 'cmh_projects') setCmhProjectsSubTab('all_projects');
                if (item.id === 'cmh_tasks') setCmhTasksSubTab('all_tasks');
                if (item.id === 'teams') setTeamsSubTab('all_members');
              }}
              className={`relative flex flex-col items-center justify-center py-1.5 rounded-xl text-[11px] transition-all whitespace-nowrap z-10 ${
                active
                  ? 'text-[#0B57D0] dark:text-blue-400 font-extrabold'
                  : 'text-slate-500 dark:text-slate-400 font-semibold hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="adminBottomNavActive"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  className="absolute inset-0 rounded-xl bg-blue-50/90 dark:bg-blue-950/50 -z-10"
                />
              )}
              {active && (
                <span className="absolute -top-1 w-6 h-0.5 rounded-full bg-[#0B57D0] dark:bg-blue-400" />
              )}
              <Icon className="w-4 h-4 mb-0.5" />
              <span>{item.label}</span>
            </motion.button>
          );
        })}
      </nav>
    </>
  );
};
