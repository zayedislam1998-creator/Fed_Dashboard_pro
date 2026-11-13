import React from 'react';
import {
  MapPin,
  Phone,
  Mail,
  Linkedin,
  Youtube,
  Facebook,
  Twitter,
  Globe,
  ExternalLink,
} from 'lucide-react';
import type { CorporateOrgProfileData } from '../../../services/workspaceApi';

interface CorporateFooterSectionProps {
  contact: CorporateOrgProfileData['contact'];
  branding: CorporateOrgProfileData['branding'];
  isEditing: boolean;
  onChangeContact: (contact: CorporateOrgProfileData['contact']) => void;
}

export const CorporateFooterSection: React.FC<CorporateFooterSectionProps> = ({
  contact,
  branding,
  isEditing,
  onChangeContact,
}) => {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      id="sec-org-contact"
      aria-label="Corporate Headquarters and Contact"
      className="relative rounded-3xl bg-slate-900 text-slate-200 border border-slate-800 shadow-2xl overflow-hidden mt-12"
    >
      {/* Background ambient gradient */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative p-8 sm:p-12 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Col 1: Headquarters & Entity Info */}
          <div className="space-y-3">
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-400" />
              <span>Headquarters</span>
            </h3>

            {isEditing ? (
              <textarea
                rows={3}
                value={contact.hqAddress}
                onChange={(e) =>
                  onChangeContact({ ...contact, hqAddress: e.target.value })
                }
                className="w-full text-xs p-2 rounded-xl bg-slate-800 border border-slate-700 text-white"
                placeholder="HQ Physical Address"
              />
            ) : (
              <p className="text-xs text-slate-400 leading-relaxed">
                {contact.hqAddress || branding.address || 'Address not added yet.'}
              </p>
            )}

            {contact.googleMapsUrl && !isEditing && (
              <a
                href={contact.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-semibold"
              >
                <span>View on Maps</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          {/* Col 2: Direct Communications */}
          <div className="space-y-3">
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Mail className="w-4 h-4 text-blue-400" />
              <span>Direct Inquiries</span>
            </h3>

            {isEditing ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={contact.primaryEmail}
                  onChange={(e) =>
                    onChangeContact({ ...contact, primaryEmail: e.target.value })
                  }
                  className="w-full text-xs px-2.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-white"
                  placeholder="Primary Email"
                />
                <input
                  type="text"
                  value={contact.inquiryEmail || ''}
                  onChange={(e) =>
                    onChangeContact({ ...contact, inquiryEmail: e.target.value })
                  }
                  className="w-full text-xs px-2.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-white"
                  placeholder="Secondary / Inquiries Email"
                />
                <input
                  type="text"
                  value={contact.primaryPhone}
                  onChange={(e) =>
                    onChangeContact({ ...contact, primaryPhone: e.target.value })
                  }
                  className="w-full text-xs px-2.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-white"
                  placeholder="Primary Phone"
                />
                <input
                  type="text"
                  value={contact.secondaryPhone || ''}
                  onChange={(e) =>
                    onChangeContact({ ...contact, secondaryPhone: e.target.value })
                  }
                  className="w-full text-xs px-2.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-white"
                  placeholder="Secondary Phone"
                />
              </div>
            ) : (
              <div className="space-y-2 text-xs text-slate-400">
                {contact.primaryEmail ? (
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-500" />
                    <a
                      href={`mailto:${contact.primaryEmail}`}
                      className="hover:text-blue-400 transition-colors"
                    >
                      {contact.primaryEmail}
                    </a>
                  </div>
                ) : (
                  <p className="text-slate-500 italic">Primary email not added</p>
                )}
                {contact.inquiryEmail && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-500" />
                    <a
                      href={`mailto:${contact.inquiryEmail}`}
                      className="hover:text-blue-400 transition-colors"
                    >
                      {contact.inquiryEmail}
                    </a>
                  </div>
                )}
                {contact.primaryPhone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-500" />
                    <a
                      href={`tel:${contact.primaryPhone}`}
                      className="hover:text-blue-400 transition-colors"
                    >
                      {contact.primaryPhone}
                    </a>
                  </div>
                )}
                {contact.secondaryPhone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-500" />
                    <a
                      href={`tel:${contact.secondaryPhone}`}
                      className="hover:text-blue-400 transition-colors"
                    >
                      {contact.secondaryPhone}
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Col 3: Institutional Channels & Social Media */}
          <div className="space-y-3">
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-400" />
              <span>Connect Globally</span>
            </h3>

            {isEditing ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={contact.socialLinks?.linkedin || ''}
                  onChange={(e) =>
                    onChangeContact({
                      ...contact,
                      socialLinks: {
                        ...contact.socialLinks,
                        linkedin: e.target.value,
                      },
                    })
                  }
                  className="w-full text-xs px-2.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-white"
                  placeholder="LinkedIn URL"
                />
                <input
                  type="text"
                  value={contact.socialLinks?.youtube || ''}
                  onChange={(e) =>
                    onChangeContact({
                      ...contact,
                      socialLinks: {
                        ...contact.socialLinks,
                        youtube: e.target.value,
                      },
                    })
                  }
                  className="w-full text-xs px-2.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-white"
                  placeholder="YouTube URL"
                />
                <input
                  type="text"
                  value={contact.socialLinks?.facebook || ''}
                  onChange={(e) =>
                    onChangeContact({
                      ...contact,
                      socialLinks: {
                        ...contact.socialLinks,
                        facebook: e.target.value,
                      },
                    })
                  }
                  className="w-full text-xs px-2.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-white"
                  placeholder="Facebook URL"
                />
                <input
                  type="text"
                  value={contact.socialLinks?.twitter || ''}
                  onChange={(e) =>
                    onChangeContact({
                      ...contact,
                      socialLinks: {
                        ...contact.socialLinks,
                        twitter: e.target.value,
                      },
                    })
                  }
                  className="w-full text-xs px-2.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-white"
                  placeholder="Twitter / X URL"
                />
              </div>
            ) : (
              <div className="flex flex-wrap gap-2.5 pt-1">
                {contact.socialLinks?.linkedin && (
                  <a
                    href={contact.socialLinks.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="LinkedIn"
                    className="p-2.5 rounded-2xl bg-slate-800 hover:bg-blue-600 text-white transition-all shadow-md"
                  >
                    <Linkedin className="w-4 h-4" />
                  </a>
                )}
                {contact.socialLinks?.youtube && (
                  <a
                    href={contact.socialLinks.youtube}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="YouTube"
                    className="p-2.5 rounded-2xl bg-slate-800 hover:bg-red-600 text-white transition-all shadow-md"
                  >
                    <Youtube className="w-4 h-4" />
                  </a>
                )}
                {contact.socialLinks?.facebook && (
                  <a
                    href={contact.socialLinks.facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Facebook"
                    className="p-2.5 rounded-2xl bg-slate-800 hover:bg-blue-700 text-white transition-all shadow-md"
                  >
                    <Facebook className="w-4 h-4" />
                  </a>
                )}
                {contact.socialLinks?.twitter && (
                  <a
                    href={contact.socialLinks.twitter}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Twitter"
                    className="p-2.5 rounded-2xl bg-slate-800 hover:bg-sky-500 text-white transition-all shadow-md"
                  >
                    <Twitter className="w-4 h-4" />
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Copyright & Verification Notice */}
        <div className="pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <p>
            © {currentYear} {branding.name.trim() || 'Organization Portal'}. All rights reserved.
          </p>
          <div className="flex items-center gap-3">
            {branding.regNumber && <span>Reg: {branding.regNumber}</span>}
          </div>
        </div>
      </div>
    </footer>
  );
};
