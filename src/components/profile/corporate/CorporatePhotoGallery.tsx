import React, { useState } from 'react';
import {
  Image as ImageIcon,
  Plus,
  Trash2,
  Camera,
  Maximize2,
  X,
} from 'lucide-react';
import type { CorporateOrgProfileData } from '../../../services/workspaceApi';

interface CorporatePhotoGalleryProps {
  photos: CorporateOrgProfileData['photoGallery'];
  isEditing: boolean;
  onChangePhotos: (photos: CorporateOrgProfileData['photoGallery']) => void;
  onEditPhotoImage: (photoId: string, currentUrl: string) => void;
}

export const CorporatePhotoGallery: React.FC<CorporatePhotoGalleryProps> = ({
  photos,
  isEditing,
  onChangePhotos,
  onEditPhotoImage,
}) => {
  const [lightboxPhoto, setLightboxPhoto] = useState<
    CorporateOrgProfileData['photoGallery'][0] | null
  >(null);

  const handleAddPhoto = () => {
    const newPhoto = {
      id: `photo-${Date.now()}`,
      title: '',
      imageUrl: '',
      caption: '',
    };
    onChangePhotos([...(photos || []), newPhoto]);
  };

  const handleDeletePhoto = (id: string) => {
    onChangePhotos((photos || []).filter((p) => p.id !== id));
  };

  const handleUpdatePhoto = (
    id: string,
    field: keyof CorporateOrgProfileData['photoGallery'][0],
    val: string
  ) => {
    onChangePhotos(
      (photos || []).map((p) => (p.id === id ? { ...p, [field]: val } : p))
    );
  };

  return (
    <section
      id="sec-org-photo"
      aria-label="Corporate Photo Gallery"
      className="space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
            Field Operations & Media Gallery
          </h2>
        </div>

        {isEditing && (
          <button
            type="button"
            onClick={handleAddPhoto}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Photo</span>
          </button>
        )}
      </div>

      {(!photos || photos.length === 0) ? (
        <div className="p-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 text-center space-y-2">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            No photos added to the gallery yet.
          </p>
          {isEditing && (
            <button
              type="button"
              onClick={handleAddPhoto}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add First Photo</span>
            </button>
          )}
        </div>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
        {photos.map((photo) => (
          <div
            key={photo.id}
            className="group relative rounded-3xl overflow-hidden bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-md hover:shadow-xl transition-all duration-300"
          >
            {/* Image container */}
            <div className="relative h-56 sm:h-64 w-full overflow-hidden">
              {photo.imageUrl ? (
                <img
                  src={photo.imageUrl}
                  alt={photo.title || 'Gallery item'}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800 text-slate-400 text-xs gap-2">
                  <ImageIcon className="w-7 h-7 opacity-60" />
                  <span>No photo uploaded</span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent opacity-80 group-hover:opacity-90 transition-opacity" />

              {/* View Lightbox button */}
              {!isEditing && photo.imageUrl && (
                <button
                  type="button"
                  onClick={() => setLightboxPhoto(photo)}
                  className="absolute inset-0 w-full h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer bg-slate-950/30"
                >
                  <div className="p-3 rounded-2xl bg-white/20 backdrop-blur-md text-white border border-white/20 shadow-lg">
                    <Maximize2 className="w-5 h-5" />
                  </div>
                </button>
              )}

              {/* Edit Image Action */}
              {isEditing && (
                <button
                  type="button"
                  onClick={() => onEditPhotoImage(photo.id, photo.imageUrl)}
                  className="absolute top-3 right-3 p-2 rounded-xl bg-slate-900/80 text-white hover:bg-slate-900 backdrop-blur-md shadow-md cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-blue-400" />
                </button>
              )}

              {/* Caption Overlay */}
              <div className="absolute bottom-0 inset-x-0 p-4 text-white pointer-events-none">
                {photo.title && (
                  <h4 className="text-xs font-bold leading-snug drop-shadow-sm">
                    {photo.title}
                  </h4>
                )}
                {photo.caption && (
                  <p className="text-[11px] text-slate-300 line-clamp-2 mt-0.5 font-normal">
                    {photo.caption}
                  </p>
                )}
              </div>
            </div>

            {/* In-Page Studio Edit Inputs */}
            {isEditing && (
              <div className="p-3 bg-white dark:bg-slate-900 space-y-2 border-t border-slate-200 dark:border-slate-800">
                <input
                  type="text"
                  value={photo.title || ''}
                  onChange={(e) =>
                    handleUpdatePhoto(photo.id, 'title', e.target.value)
                  }
                  placeholder="Photo Title"
                  className="w-full text-xs font-semibold px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
                <input
                  type="text"
                  value={photo.caption || ''}
                  onChange={(e) =>
                    handleUpdatePhoto(photo.id, 'caption', e.target.value)
                  }
                  placeholder="Caption text"
                  className="w-full text-[11px] px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => handleDeletePhoto(photo.id)}
                    className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Photo</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      )}

      {/* Lightbox Modal */}
      {lightboxPhoto && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setLightboxPhoto(null)}
        >
          <div
            className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLightboxPhoto(null)}
              className="absolute -top-12 right-0 p-2 rounded-full bg-white/20 hover:bg-white/30 text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="rounded-3xl overflow-hidden border border-white/20 shadow-2xl bg-black">
              <img
                src={lightboxPhoto.imageUrl}
                alt={lightboxPhoto.title || 'Enlarged photo'}
                className="max-h-[75vh] w-auto object-contain"
              />
            </div>
            <div className="mt-3 text-center text-white">
              <h3 className="text-sm font-bold">{lightboxPhoto.title}</h3>
              {lightboxPhoto.caption && (
                <p className="text-xs text-slate-300 mt-1">
                  {lightboxPhoto.caption}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
