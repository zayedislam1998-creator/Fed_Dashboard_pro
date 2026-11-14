import React, { useState } from 'react';
import {
  Video,
  Plus,
  Trash2,
  Play,
  X,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import {
  CorporateOrgProfileData,
  extractYouTubeVideoIdClient,
} from '../../../services/workspaceApi';

interface CorporateVideoGalleryProps {
  videos: CorporateOrgProfileData['videoGallery'];
  isEditing: boolean;
  onChangeVideos: (videos: CorporateOrgProfileData['videoGallery']) => void;
}

export const CorporateVideoGallery: React.FC<CorporateVideoGalleryProps> = ({
  videos,
  isEditing,
  onChangeVideos,
}) => {
  const [activeVideoModal, setActiveVideoModal] = useState<{
    id: string;
    title: string;
    youtubeId: string;
  } | null>(null);

  const handleAddVideo = () => {
    const newVideo = {
      id: `vid-${Date.now()}`,
      title: '',
      youtubeUrl: '',
      youtubeId: undefined,
      description: '',
    };
    onChangeVideos([...(videos || []), newVideo]);
  };

  const handleDeleteVideo = (id: string) => {
    onChangeVideos((videos || []).filter((v) => v.id !== id));
  };

  const handleUpdateVideo = (
    id: string,
    field: keyof CorporateOrgProfileData['videoGallery'][0],
    val: string
  ) => {
    onChangeVideos(
      (videos || []).map((v) => {
        if (v.id !== id) return v;
        const updated = { ...v, [field]: val };
        if (field === 'youtubeUrl') {
          const extracted = extractYouTubeVideoIdClient(val);
          updated.youtubeId = extracted || undefined;
        }
        return updated;
      })
    );
  };

  return (
    <section
      id="sec-org-video"
      aria-label="Corporate Video Showcase"
      className="space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Video className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
            Video Showcase & Field Documentaries
          </h2>
        </div>

        {isEditing && (
          <button
            type="button"
            onClick={handleAddVideo}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Video</span>
          </button>
        )}
      </div>

      {(!videos || videos.length === 0) ? (
        <div className="p-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 text-center space-y-2">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            No videos added yet.
          </p>
          {isEditing && (
            <button
              type="button"
              onClick={handleAddVideo}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add First Video</span>
            </button>
          )}
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {videos.map((vid) => {
          const resolvedId = vid.youtubeId || extractYouTubeVideoIdClient(vid.youtubeUrl);
          const thumbUrl = resolvedId
            ? `https://img.youtube.com/vi/${resolvedId}/hqdefault.jpg`
            : null;

          return (
            <div
              key={vid.id}
              className="group rounded-3xl overflow-hidden bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-md hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
            >
              {/* Video Thumbnail & Play Action */}
              <div className="relative aspect-video w-full bg-slate-950 overflow-hidden">
                {thumbUrl ? (
                  <img
                    src={thumbUrl}
                    alt={vid.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-500">
                    <Video className="w-8 h-8 mb-1" />
                    <span className="text-[11px]">No YouTube ID</span>
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />

                {resolvedId && !isEditing && (
                  <button
                    type="button"
                    onClick={() =>
                      setActiveVideoModal({
                        id: vid.id,
                        title: vid.title,
                        youtubeId: resolvedId,
                      })
                    }
                    aria-label={`Play ${vid.title}`}
                    className="absolute inset-0 flex items-center justify-center cursor-pointer group/play"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-red-600 group-hover/play:bg-red-700 text-white flex items-center justify-center shadow-xl shadow-red-600/30 group-hover/play:scale-110 transition-all duration-200">
                      <Play className="w-6 h-6 fill-white ml-0.5" />
                    </div>
                  </button>
                )}

                <div className="absolute top-3 left-3 px-2 py-0.5 rounded-lg bg-slate-900/80 text-white text-[10px] font-bold backdrop-blur-md">
                  YouTube
                </div>
              </div>

              {/* Title & Description */}
              <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                {isEditing ? (
                  <div className="space-y-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase">
                        Video Title
                      </label>
                      <input
                        type="text"
                        value={vid.title}
                        onChange={(e) =>
                          handleUpdateVideo(vid.id, 'title', e.target.value)
                        }
                        className="w-full text-xs font-bold px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                        placeholder="Video Title"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase">
                        YouTube URL
                      </label>
                      <input
                        type="text"
                        value={vid.youtubeUrl}
                        onChange={(e) =>
                          handleUpdateVideo(vid.id, 'youtubeUrl', e.target.value)
                        }
                        className="w-full text-[11px] px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                        placeholder="https://youtube.com/watch?v=..."
                      />
                      <div className="flex items-center gap-1 mt-1 text-[10px]">
                        {resolvedId ? (
                          <span className="text-emerald-600 flex items-center gap-0.5 font-semibold">
                            <CheckCircle2 className="w-3 h-3" />
                            ID: {resolvedId}
                          </span>
                        ) : (
                          <span className="text-amber-500 flex items-center gap-0.5 font-semibold">
                            <AlertCircle className="w-3 h-3" />
                            Invalid YouTube URL
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase">
                        Description
                      </label>
                      <textarea
                        rows={2}
                        value={vid.description || ''}
                        onChange={(e) =>
                          handleUpdateVideo(vid.id, 'description', e.target.value)
                        }
                        className="w-full text-[11px] p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                        placeholder="Short summary of the video content..."
                      />
                    </div>
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => handleDeleteVideo(vid.id)}
                        className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Video</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white line-clamp-1 group-hover:text-blue-600 transition-colors">
                      {vid.title}
                    </h3>
                    {vid.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                        {vid.description}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* Video Modal Player (Responsive 16:9 Iframe) */}
      {activeVideoModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/90 backdrop-blur-md   duration-200"
          onClick={() => setActiveVideoModal(null)}
        >
          <div
            className="relative w-full max-w-4xl bg-black rounded-3xl overflow-hidden border border-white/20 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header bar */}
            <div className="p-4 bg-slate-900 flex items-center justify-between text-white border-b border-white/10">
              <h3 className="text-sm font-black truncate max-w-md">
                {activeVideoModal.title}
              </h3>
              <button
                type="button"
                onClick={() => setActiveVideoModal(null)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Responsive 16:9 Player container */}
            <div className="relative aspect-video w-full bg-black">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${activeVideoModal.youtubeId}?autoplay=1&rel=0&modestbranding=1`}
                title={activeVideoModal.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="absolute inset-0 w-full h-full border-0"
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
