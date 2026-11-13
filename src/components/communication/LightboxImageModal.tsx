import React from 'react';
import { X, Download } from 'lucide-react';

interface LightboxImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  imageName?: string;
}

export const LightboxImageModal: React.FC<LightboxImageModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  imageName,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Control Bar */}
        <div className="w-full flex items-center justify-between pb-3 text-white">
          <span className="text-xs font-semibold truncate max-w-md">
            {imageName || 'Photo Preview'}
          </span>
          <div className="flex items-center gap-2">
            <a
              href={imageUrl}
              download={imageName || 'image.png'}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer transition-colors"
              title="Download image"
            >
              <Download className="w-4 h-4" />
            </a>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scaled Image */}
        <div className="rounded-2xl overflow-hidden border border-white/15 shadow-2xl bg-black max-h-[80vh] flex items-center justify-center">
          <img
            src={imageUrl}
            alt={imageName || 'Preview'}
            className="max-h-[78vh] w-auto max-w-full object-contain"
          />
        </div>
      </div>
    </div>
  );
};
