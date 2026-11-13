import React from 'react';
import { Award, Plus, Trash2, Calendar, ExternalLink, ShieldCheck, FileCheck } from 'lucide-react';
import { ResumeProfileData } from '../../services/workspaceApi';

interface ResumeCertificationsSectionProps {
  certifications: ResumeProfileData['certifications'];
  isEditing: boolean;
  onChangeCertifications: (certs: ResumeProfileData['certifications']) => void;
  onPreviewCredentialFile?: (fileId: string) => void;
}

export const ResumeCertificationsSection: React.FC<ResumeCertificationsSectionProps> = ({
  certifications,
  isEditing,
  onChangeCertifications,
  onPreviewCredentialFile,
}) => {
  const handleAddCert = () => {
    const newCert: ResumeProfileData['certifications'][0] = {
      id: `cert-${Date.now()}`,
      title: '',
      issuingOrganization: '',
      issueDate: '',
      credentialId: '',
      verificationUrl: '',
    };
    onChangeCertifications([...certifications, newCert]);
  };

  const handleRemoveCert = (id: string) => {
    onChangeCertifications(certifications.filter((c) => c.id !== id));
  };

  const handleUpdateCert = (
    id: string,
    field: keyof ResumeProfileData['certifications'][0],
    value: any
  ) => {
    onChangeCertifications(
      certifications.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  return (
    <section
      id="sec-certifications"
      className="scroll-mt-24 rounded-3xl p-6 sm:p-8 bg-white/75 dark:bg-slate-900/75 backdrop-blur-2xl border border-white/60 dark:border-slate-800/80 shadow-[0_10px_35px_rgba(0,0,0,0.04)] space-y-6"
    >
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Licenses, Certifications & Credentials
            </h2>
            <p className="text-xs text-slate-500">
              Verified professional credentials with instant document viewing support
            </p>
          </div>
        </div>

        {isEditing && (
          <button
            type="button"
            onClick={handleAddCert}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Certification</span>
          </button>
        )}
      </div>

      {certifications.length === 0 ? (
        <div className="p-5 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 text-center space-y-2">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            No licenses or certifications added yet.
          </p>
          {isEditing && (
            <button
              type="button"
              onClick={handleAddCert}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Certification</span>
            </button>
          )}
        </div>
      ) : (
      <div className="grid grid-cols-1 gap-3.5">
        {certifications.map((cert) => (
          <div
            key={cert.id}
            className="p-4 sm:p-5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 space-y-3 hover:shadow-md transition-all"
          >
            {isEditing ? (
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-400 uppercase">Credential Entry</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveCert(cert.id)}
                    className="text-rose-500 hover:text-rose-700"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <input
                  type="text"
                  value={cert.title}
                  onChange={(e) => handleUpdateCert(cert.id, 'title', e.target.value)}
                  placeholder="Certification Title"
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
                />

                <input
                  type="text"
                  value={cert.issuingOrganization}
                  onChange={(e) =>
                    handleUpdateCert(cert.id, 'issuingOrganization', e.target.value)
                  }
                  placeholder="Issuing Authority (e.g. AWS, Google Cloud)"
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={cert.issueDate}
                    onChange={(e) => handleUpdateCert(cert.id, 'issueDate', e.target.value)}
                    placeholder="Issue Date"
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                  <input
                    type="text"
                    value={cert.expiryDate || ''}
                    onChange={(e) =>
                      handleUpdateCert(cert.id, 'expiryDate', e.target.value)
                    }
                    placeholder="Expiry Date (optional)"
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={cert.credentialId || ''}
                    onChange={(e) =>
                      handleUpdateCert(cert.id, 'credentialId', e.target.value)
                    }
                    placeholder="Credential ID"
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                  <input
                    type="text"
                    value={cert.verificationUrl || ''}
                    onChange={(e) =>
                      handleUpdateCert(cert.id, 'verificationUrl', e.target.value)
                    }
                    placeholder="Verification URL"
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 shrink-0">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                        {cert.title}
                      </h3>
                      <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                        {cert.issuingOrganization}
                      </p>
                    </div>
                  </div>

                  <span className="flex items-center gap-1 text-[11px] font-medium text-slate-500 shrink-0">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    <span>
                      {cert.issueDate}
                      {cert.expiryDate ? ` – ${cert.expiryDate}` : ''}
                    </span>
                  </span>
                </div>

                {cert.credentialId && (
                  <p className="text-xs font-mono text-slate-500">
                    Credential ID: <span className="text-slate-700 dark:text-slate-300 font-semibold">{cert.credentialId}</span>
                  </p>
                )}

                <div className="flex items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                  {cert.verificationUrl && (
                    <a
                      href={cert.verificationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Verify Credential</span>
                    </a>
                  )}

                  {cert.attachedFileId && onPreviewCredentialFile && (
                    <button
                      type="button"
                      onClick={() => onPreviewCredentialFile(cert.attachedFileId!)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline ml-auto"
                    >
                      <FileCheck className="w-3.5 h-3.5" />
                      <span>View Verified Document</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
      )}
    </section>
  );
};
