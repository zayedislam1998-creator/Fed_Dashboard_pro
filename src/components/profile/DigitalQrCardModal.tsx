import React from 'react';
import { X, QrCode, Download, Copy, Check, ShieldCheck } from 'lucide-react';
import { ResumeProfileData } from '../../services/workspaceApi';

interface DigitalQrCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  resume: ResumeProfileData;
}

export const DigitalQrCardModal: React.FC<DigitalQrCardModalProps> = ({
  isOpen,
  onClose,
  resume,
}) => {
  const [copied, setCopied] = React.useState(false);
  if (!isOpen) return null;

  const { header, contact } = resume;
  const profileUrl = typeof window !== 'undefined' ? window.location.href : 'https://workspace.pro';

  // Generate vCard format
  const vCardData = `BEGIN:VCARD
VERSION:3.0
FN:${header.fullName}
TITLE:${header.professionalTitle}
EMAIL;TYPE=INTERNET,WORK:${contact.email}
TEL;TYPE=CELL:${contact.phone}
ADR;TYPE=WORK:;;${contact.city || ''};${contact.state || ''};;${contact.country || ''}
URL:${contact.portfolioUrl || profileUrl}
END:VCARD`;

  const handleDownloadVCard = () => {
    const blob = new Blob([vCardData], { type: 'text/vcard;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${header.fullName.replace(/\s+/g, '_')}_contact.vcf`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(profileUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Modern SVG QR Code Representation
  const qrSvgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
    profileUrl
  )}&format=svg`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md ws-animate-in">
      <div className="relative w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-6 text-center">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Badge */}
        <div className="flex flex-col items-center space-y-2">
          <div className="w-16 h-16 rounded-2xl p-0.5 bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg">
            {header.avatarUrl ? (
              <img
                src={header.avatarUrl}
                alt={header.fullName}
                className="w-full h-full rounded-2xl object-cover"
              />
            ) : (
              <div className="w-full h-full rounded-2xl bg-slate-900 text-white font-bold text-xl flex items-center justify-center">
                {header.fullName.charAt(0)}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-center gap-1.5 font-bold text-base text-slate-900 dark:text-slate-100">
              <span>{header.fullName}</span>
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
            </div>
            <p className="text-xs text-blue-600 font-semibold">{header.professionalTitle}</p>
          </div>
        </div>

        {/* QR Code Container */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center space-y-2">
          <img
            src={qrSvgUrl}
            alt="Executive Profile QR Code"
            className="w-48 h-48 rounded-xl bg-white p-2 shadow-inner"
          />
          <span className="text-[11px] text-slate-500 font-medium">
            Scan to inspect Executive CV & save contact
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadVCard}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Save vCard</span>
          </button>
          <button
            type="button"
            onClick={handleCopyLink}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition-all"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied!' : 'Copy Link'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
