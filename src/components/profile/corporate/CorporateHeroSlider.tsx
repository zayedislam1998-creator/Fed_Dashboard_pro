import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Camera,
  ExternalLink,
  Image as ImageIcon,
} from 'lucide-react';
import type { CorporateOrgProfileData } from '../../../services/workspaceApi';

interface CorporateHeroSliderProps {
  slides: CorporateOrgProfileData['heroSlider'];
  isEditing: boolean;
  onChangeSlides: (slides: CorporateOrgProfileData['heroSlider']) => void;
  onEditSlideImage: (slideId: string, currentUrl: string) => void;
}

export const CorporateHeroSlider: React.FC<CorporateHeroSliderProps> = ({
  slides,
  isEditing,
  onChangeSlides,
  onEditSlideImage,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const autoPlayTimerRef = useRef<any>(null);

  const safeSlides = slides && slides.length > 0 ? slides : [];

  useEffect(() => {
    if (currentIndex >= safeSlides.length && safeSlides.length > 0) {
      setCurrentIndex(safeSlides.length - 1);
    }
  }, [currentIndex, safeSlides.length]);

  // Auto-play effect
  useEffect(() => {
    if (isPaused || isEditing || safeSlides.length <= 1) return;

    autoPlayTimerRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % safeSlides.length);
    }, 6000);

    return () => {
      if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
    };
  }, [isPaused, isEditing, safeSlides.length]);

  const handlePrev = () => {
    if (safeSlides.length === 0) return;
    setCurrentIndex((prev) => (prev === 0 ? safeSlides.length - 1 : prev - 1));
  };

  const handleNext = () => {
    if (safeSlides.length === 0) return;
    setCurrentIndex((prev) => (prev + 1) % safeSlides.length);
  };

  const handleAddSlide = () => {
    const newSlide = {
      id: `slide-${Date.now()}`,
      imageUrl: '',
      title: '',
      subtitle: '',
      buttonText: '',
      buttonUrl: '',
    };
    const updated = [...safeSlides, newSlide];
    onChangeSlides(updated);
    setCurrentIndex(updated.length - 1);
  };

  const handleDeleteSlide = (index: number) => {
    const updated = safeSlides.filter((_, i) => i !== index);
    onChangeSlides(updated);
    setCurrentIndex((prev) => Math.max(0, Math.min(prev, updated.length - 1)));
  };

  if (safeSlides.length === 0) {
    if (!isEditing) return null;
    return (
      <section
        id="sec-org-hero"
        aria-label="Corporate Hero Slider"
        className="relative w-full rounded-3xl overflow-hidden border border-dashed border-slate-300 dark:border-slate-700 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 p-8 sm:p-12 text-center text-white space-y-4"
      >
        <div className="w-12 h-12 rounded-2xl bg-white/10 mx-auto flex items-center justify-center">
          <ImageIcon className="w-6 h-6 text-blue-400" />
        </div>
        <div className="space-y-1 max-w-md mx-auto">
          <h2 className="text-base sm:text-lg font-black">No Hero Slides Added Yet</h2>
          <p className="text-xs text-slate-300">
            Add a custom banner slide with your own headline, call-to-action, and background image.
          </p>
        </div>
        <button
          type="button"
          onClick={handleAddSlide}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Hero Slide</span>
        </button>
      </section>
    );
  }

  const activeSlide = safeSlides[currentIndex] || safeSlides[0];

  return (
    <section
      id="sec-org-hero"
      aria-label="Corporate Hero Slider"
      className="relative w-full rounded-3xl overflow-hidden shadow-xl border border-slate-200/80 dark:border-slate-800/80 group bg-slate-900"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* 16:9 / Compact Panoramic Height */}
      <div className="relative h-80 sm:h-96 md:h-[420px] w-full overflow-hidden">
        {/* Animated Background Image or Clean Gradient */}
        <AnimatePresence mode="wait">
          {activeSlide.imageUrl ? (
            <motion.div
              key={activeSlide.id || currentIndex}
              initial={false}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url("${activeSlide.imageUrl}")` }}
            />
          ) : (
            <motion.div
              key={`grad-${activeSlide.id || currentIndex}`}
              initial={false}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950"
            />
          )}
        </AnimatePresence>
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/55 to-slate-950/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-950/40 to-transparent" />

        {/* Edit Slide Image Button in Edit Mode */}
        {isEditing && (
          <motion.button
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={() => onEditSlideImage(activeSlide.id, activeSlide.imageUrl)}
            className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-900 text-white text-xs font-semibold backdrop-blur-md border border-white/20 shadow-lg cursor-pointer"
          >
            <Camera className="w-3.5 h-3.5 text-blue-400" />
            <span>{activeSlide.imageUrl ? 'Change Slide Image' : 'Upload Slide Image'}</span>
          </motion.button>
        )}

        {/* Slide Content Overlay */}
        <div className="absolute inset-0 z-10 flex flex-col justify-end p-4 pb-12 sm:p-10 max-w-2xl text-white">
          {isEditing ? (
            <div className="space-y-2.5 bg-slate-950/85 backdrop-blur-md p-3.5 sm:p-4 rounded-2xl border border-white/10">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">
                Slide #{currentIndex + 1} Editor
              </span>
              <div>
                <input
                  type="text"
                  value={activeSlide.title}
                  onChange={(e) => {
                    const updated = [...safeSlides];
                    updated[currentIndex] = {
                      ...updated[currentIndex],
                      title: e.target.value,
                    };
                    onChangeSlides(updated);
                  }}
                  className="w-full text-sm sm:text-xl font-black bg-slate-900/90 border border-slate-700 rounded-xl px-3 py-1.5 text-white"
                  placeholder="Hero Slide Headline"
                />
              </div>
              <div>
                <textarea
                  rows={2}
                  value={activeSlide.subtitle}
                  onChange={(e) => {
                    const updated = [...safeSlides];
                    updated[currentIndex] = {
                      ...updated[currentIndex],
                      subtitle: e.target.value,
                    };
                    onChangeSlides(updated);
                  }}
                  className="w-full text-xs bg-slate-900/90 border border-slate-700 rounded-xl px-3 py-1.5 text-slate-200 resize-none"
                  placeholder="Hero Slide Subtitle description"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={activeSlide.buttonText || ''}
                  onChange={(e) => {
                    const updated = [...safeSlides];
                    updated[currentIndex] = {
                      ...updated[currentIndex],
                      buttonText: e.target.value,
                    };
                    onChangeSlides(updated);
                  }}
                  className="w-full text-xs bg-slate-900/90 border border-slate-700 rounded-xl px-3 py-1.5 text-slate-200"
                  placeholder="CTA Button Label"
                />
                <input
                  type="text"
                  value={activeSlide.buttonUrl || ''}
                  onChange={(e) => {
                    const updated = [...safeSlides];
                    updated[currentIndex] = {
                      ...updated[currentIndex],
                      buttonUrl: e.target.value,
                    };
                    onChangeSlides(updated);
                  }}
                  className="w-full text-xs bg-slate-900/90 border border-slate-700 rounded-xl px-3 py-1.5 text-slate-200"
                  placeholder="Target Link (#sec-org-services)"
                />
              </div>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSlide.id || currentIndex}
                initial={false}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.28 }}
                className="space-y-2.5 sm:space-y-3"
              >
                <span className="inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-blue-600/90 text-white backdrop-blur-md shadow-xs">
                  Featured Initiative
                </span>
                {activeSlide.title && (
                  <h2 className="text-lg sm:text-3xl md:text-4xl font-black text-white leading-tight drop-shadow-md">
                    {activeSlide.title}
                  </h2>
                )}
                {activeSlide.subtitle && (
                  <p className="text-xs sm:text-sm text-slate-200 max-w-xl font-normal leading-relaxed drop-shadow-sm line-clamp-3 sm:line-clamp-none">
                    {activeSlide.subtitle}
                  </p>
                )}
                {activeSlide.buttonText && (
                  <div className="pt-1">
                    <motion.a
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.96 }}
                      href={activeSlide.buttonUrl || '#sec-org-services'}
                      className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs shadow-md transition-all cursor-pointer"
                    >
                      <span>{activeSlide.buttonText}</span>
                      <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                    </motion.a>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        {/* Prev / Next Arrows */}
        {safeSlides.length > 1 && (
          <>
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Previous Slide"
              className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-slate-900/50 hover:bg-slate-900/80 text-white flex items-center justify-center backdrop-blur-md border border-white/10 transition-all cursor-pointer shadow-md"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              aria-label="Next Slide"
              className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-slate-900/50 hover:bg-slate-900/80 text-white flex items-center justify-center backdrop-blur-md border border-white/10 transition-all cursor-pointer shadow-md"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        {/* Slide Indicators Dots & Controls */}
        <div className="absolute bottom-3.5 right-4 sm:bottom-4 sm:right-6 z-20 flex items-center gap-2">
          {safeSlides.map((slide, idx) => (
            <button
              key={slide.id || idx}
              type="button"
              onClick={() => setCurrentIndex(idx)}
              aria-label={`Jump to slide ${idx + 1}`}
              className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                currentIndex === idx
                  ? 'w-7 bg-blue-500'
                  : 'w-2 bg-white/40 hover:bg-white/70'
              }`}
            />
          ))}

          {isEditing && (
            <div className="flex items-center gap-1.5 ml-3">
              <button
                type="button"
                onClick={handleAddSlide}
                title="Add New Slide"
                className="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 transition-colors shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleDeleteSlide(currentIndex)}
                title="Delete This Slide"
                className="w-7 h-7 rounded-xl bg-rose-600 text-white flex items-center justify-center hover:bg-rose-700 transition-colors shadow-xs cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
