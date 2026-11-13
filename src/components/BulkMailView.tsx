import React, { Suspense, lazy, useState, useMemo, useRef, useEffect } from 'react';
import {
  Send,
  Plus,
  Trash2,
  ChevronDown,
  MoreVertical,
  FileSpreadsheet,
  Eye,
  X,
  Users,
  Paperclip,
  Search,
} from 'lucide-react';
import {
  ServerMailAccount,
  WorkspaceFileItem,
  WorkspaceMemberItem,
  WorkspaceTeamGroup,
  fetchWorkspaceTeamsAndMembers,
  searchMembersInstant,
  sendGmailMessage,
  sendServerMailMessage,
} from '../services/workspaceApi';
import { ConfirmModal } from './ConfirmModal';
import { FileManagerPickerModal } from './FileManagerPickerModal';
import type { ImageEditorTarget } from './ImageEditorModal';

const ImageEditorModal = lazy(() =>
  import('./ImageEditorModal').then((m) => ({ default: m.ImageEditorModal }))
);

export interface BulkRecipient {
  id: string;
  email: string;
  name: string;
  company: string;
  customNote: string;
  status: 'READY' | 'SENDING' | 'SENT' | 'ERROR';
  errorText?: string;
}

export interface CampaignPreset {
  id: string;
  tabTitle: string;
  subjectTemplate: string;
  bodyTemplate: string;
  signatureHtml: string;
  accentColor: string;
}

interface BulkMailViewProps {
  isAuthenticated: boolean;
  activeGmailEmail?: string | null;
  serverAccounts: ServerMailAccount[];
  defaultChannel?: string; // 'gmail' or server account id
  onRequireAuth: () => void;
  initialTeamRecipients?: Array<{ email: string; name: string; company: string }> | null;
  onClearInitialTeamRecipients?: () => void;
}

const DEFAULT_CAMPAIGNS: CampaignPreset[] = [
  {
    id: 'camp-blank-1',
    tabTitle: 'New Bulk Campaign',
    subjectTemplate: '',
    bodyTemplate: '',
    signatureHtml: '',
    accentColor: '#0B57D0',
  },
];

const INITIAL_RECIPIENTS: BulkRecipient[] = [];

function interpolateTemplate(template: string, recipient: BulkRecipient): string {
  return template
    .replace(/\{\{\s*name\s*\}\}/gi, recipient.name || 'there')
    .replace(/\{\{\s*email\s*\}\}/gi, recipient.email || '')
    .replace(/\{\{\s*company\s*\}\}/gi, recipient.company || 'your organization')
    .replace(/\{\{\s*customNote\s*\}\}/gi, recipient.customNote || '');
}

export const BulkMailView: React.FC<BulkMailViewProps> = ({
  isAuthenticated,
  activeGmailEmail,
  serverAccounts,
  defaultChannel = 'gmail',
  onRequireAuth,
  initialTeamRecipients,
  onClearInitialTeamRecipients,
}) => {
  const [campaigns, setCampaigns] = useState<CampaignPreset[]>(DEFAULT_CAMPAIGNS);
  const [activeCampaignId, setActiveCampaignId] = useState<string>(DEFAULT_CAMPAIGNS[0].id);
  const [recipients, setRecipients] = useState<BulkRecipient[]>(INITIAL_RECIPIENTS);
  const [activeSubView, setActiveSubView] = useState<'compose' | 'recipients' | 'preview'>(
    'compose'
  );
  const [previewIndex, setPreviewIndex] = useState<number>(0);
  const [selectedChannel, setSelectedChannel] = useState<string>(defaultChannel);

  // Workspace Members & Teams for 1-character instant lookup & Team Group import
  const [allMembers, setAllMembers] = useState<WorkspaceMemberItem[]>([]);
  const [allGroups, setAllGroups] = useState<WorkspaceTeamGroup[]>([]);
  const [memberQuickQuery, setMemberQuickQuery] = useState<string>('');
  const [campaignAttachments, setCampaignAttachments] = useState<WorkspaceFileItem[]>([]);
  const [isFilePickerOpen, setIsFilePickerOpen] = useState<boolean>(false);
  const [editingAttachImage, setEditingAttachImage] = useState<{
    fileId: string;
    target: ImageEditorTarget;
  } | null>(null);

  useEffect(() => {
    setSelectedChannel(defaultChannel);
  }, [defaultChannel]);

  useEffect(() => {
    fetchWorkspaceTeamsAndMembers()
      .then(({ members, groups }) => {
        setAllMembers(members);
        setAllGroups(groups);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (initialTeamRecipients && initialTeamRecipients.length > 0) {
      setRecipients(
        initialTeamRecipients.map((r, idx) => ({
          id: `team-rec-${Date.now()}-${idx}`,
          email: r.email,
          name: r.name,
          company: r.company,
          customNote: '',
          status: 'READY',
        }))
      );
      setActiveSubView('recipients');
      onClearInitialTeamRecipients?.();
    }
  }, [initialTeamRecipients]);

  // Dropdown menus
  const [isTemplateMenuOpen, setIsTemplateMenuOpen] = useState<boolean>(false);
  const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState<boolean>(false);
  const templateMenuRef = useRef<HTMLDivElement>(null);
  const optionsMenuRef = useRef<HTMLDivElement>(null);

  // Inline recipient inputs
  const [newEmail, setNewEmail] = useState<string>('');
  const [newName, setNewName] = useState<string>('');
  const [newCompany, setNewCompany] = useState<string>('');
  const [newNote, setNewNote] = useState<string>('');

  // Modals
  const [isCsvModalOpen, setIsCsvModalOpen] = useState<boolean>(false);
  const [csvRawText, setCsvRawText] = useState<string>('');
  const [isNewCampOpen, setIsNewCampOpen] = useState<boolean>(false);
  const [newCampTitle, setNewCampTitle] = useState<string>('');

  // Sending State
  const [isConfirmBulkOpen, setIsConfirmBulkOpen] = useState<boolean>(false);
  const [isSendingBatch, setIsSendingBatch] = useState<boolean>(false);
  const [sentCount, setSentCount] = useState<number>(0);
  const [delayMs, setDelayMs] = useState<number>(400);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (templateMenuRef.current && !templateMenuRef.current.contains(e.target as Node)) {
        setIsTemplateMenuOpen(false);
      }
      if (optionsMenuRef.current && !optionsMenuRef.current.contains(e.target as Node)) {
        setIsOptionsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const activeCampaign = useMemo(
    () => campaigns.find((c) => c.id === activeCampaignId) || campaigns[0],
    [campaigns, activeCampaignId]
  );

  const updateActiveCampaign = (patch: Partial<CampaignPreset>) => {
    setCampaigns((prev) =>
      prev.map((c) => (c.id === activeCampaign.id ? { ...c, ...patch } : c))
    );
  };

  const previewRecipient = recipients[previewIndex] || {
    id: 'preview',
    email: 'recipient@example.com',
    name: 'Sample Recipient',
    company: 'Sample Corp',
    customNote: 'Personalized note',
    status: 'READY',
  };

  const handleAddRecipient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setRecipients((prev) => [
      ...prev,
      {
        id: `rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        email: newEmail.trim(),
        name: newName.trim() || newEmail.split('@')[0],
        company: newCompany.trim() || 'Partner',
        customNote: newNote.trim(),
        status: 'READY',
      },
    ]);
    setNewEmail('');
    setNewName('');
    setNewCompany('');
    setNewNote('');
  };

  const handleImportCsv = () => {
    const lines = csvRawText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const imported: BulkRecipient[] = [];
    for (const line of lines) {
      const parts = line.split(',').map((p) => p.trim());
      if (parts[0] && parts[0].includes('@')) {
        imported.push({
          id: `csv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          email: parts[0],
          name: parts[1] || parts[0].split('@')[0],
          company: parts[2] || '',
          customNote: parts.slice(3).join(', ') || '',
          status: 'READY',
        });
      }
    }

    if (imported.length > 0) {
      setRecipients((prev) => [...prev, ...imported]);
      setIsCsvModalOpen(false);
    }
  };

  const handleCreateCampaignTab = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCampTitle.trim()) return;
    const created: CampaignPreset = {
      id: `camp-${Date.now()}`,
      tabTitle: newCampTitle.trim(),
      subjectTemplate: 'Update for {{name}} at {{company}}',
      bodyTemplate: 'Hi {{name}},\n\n{{customNote}}\n\nBest regards,',
      signatureHtml: 'Sent via Workspace Pro',
      accentColor: '#0B57D0',
    };
    setCampaigns((prev) => [...prev, created]);
    setActiveCampaignId(created.id);
    setNewCampTitle('');
    setIsNewCampOpen(false);
  };

  const readyRecipients = recipients.filter((r) => r.status === 'READY' || r.status === 'ERROR');
  const selectedServerAccount = serverAccounts.find((a) => a.id === selectedChannel);

  const handleExecuteBulkSend = async () => {
    if (selectedChannel === 'gmail' && !isAuthenticated) {
      setIsConfirmBulkOpen(false);
      onRequireAuth();
      return;
    }

    setIsSendingBatch(true);
    setSentCount(0);

    for (let i = 0; i < recipients.length; i++) {
      const rec = recipients[i];
      if (rec.status === 'SENT') continue;

      setRecipients((prev) =>
        prev.map((item, idx) => (idx === i ? { ...item, status: 'SENDING' } : item))
      );

      try {
        const personalizedSubject = interpolateTemplate(activeCampaign.subjectTemplate, rec);
        const personalizedBody = interpolateTemplate(activeCampaign.bodyTemplate, rec);

        const htmlParagraphs = personalizedBody
          .split('\n')
          .map(
            (line) =>
              `<p style="margin:0 0 10px 0;font-family:'Plus Jakarta Sans',sans-serif;font-size:14px;color:#1e293b;line-height:1.6;">${
                line || '&nbsp;'
              }</p>`
          )
          .join('');

        const attachmentHtml =
          campaignAttachments.length > 0
            ? `<div style="margin-top:16px;padding-top:12px;border-top:1px solid #e2e8f0;">
                <div style="font-size:12px;font-weight:600;color:#475569;margin-bottom:8px;">Attached Files (${campaignAttachments.length}):</div>
                ${campaignAttachments
                  .map((att) => {
                    const fullUrl = `${window.location.origin}${att.url}`;
                    return att.isImage
                      ? `<div style="margin-bottom:10px;"><a href="${fullUrl}" target="_blank" style="font-size:12px;color:#0B57D0;text-decoration:none;font-weight:600;">${att.name}</a><br/><img src="${fullUrl}" alt="${att.name}" style="max-width:360px;border-radius:8px;margin-top:4px;border:1px solid #e2e8f0;"/></div>`
                      : `<div style="margin-bottom:6px;"><a href="${fullUrl}" target="_blank" style="font-size:12px;color:#0B57D0;text-decoration:underline;">📎 ${att.name}</a></div>`;
                  })
                  .join('')}
              </div>`
            : '';

        const fullHtml = `
          <div style="max-width:600px;padding:16px;">
            ${htmlParagraphs}
            ${attachmentHtml}
            ${
              activeCampaign.signatureHtml
                ? `<div style="margin-top:20px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:13px;font-weight:600;color:#475569;">${activeCampaign.signatureHtml}</div>`
                : ''
            }
          </div>
        `;

        if (selectedServerAccount) {
          await sendServerMailMessage(selectedServerAccount.id, {
            to: rec.email,
            subject: personalizedSubject,
            bodyHtml: fullHtml,
            bodyText: personalizedBody,
          });
        } else {
          await sendGmailMessage({
            to: rec.email,
            subject: personalizedSubject,
            bodyHtml: fullHtml,
          });
        }

        setRecipients((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, status: 'SENT', errorText: undefined } : item
          )
        );
        setSentCount((prev) => prev + 1);

        if (delayMs > 0 && i < recipients.length - 1) {
          await new Promise((r) => setTimeout(r, delayMs));
        }
      } catch (err: any) {
        setRecipients((prev) =>
          prev.map((item, idx) =>
            idx === i
              ? { ...item, status: 'ERROR', errorText: err?.message || 'Send failed' }
              : item
          )
        );
      }
    }

    setIsSendingBatch(false);
    setIsConfirmBulkOpen(false);
  };

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 md:rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
      {/* Clean Single Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-b border-slate-200/80 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-1">
          {[
            { id: 'compose', label: '1. Template Editor' },
            { id: 'recipients', label: `2. Recipients (${recipients.length})` },
            { id: 'preview', label: '3. Live Preview' },
          ].map((tab) => {
            const active = activeSubView === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSubView(tab.id as any)}
                className={`relative px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'text-[#0B57D0] dark:text-blue-400'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg'
                }`}
              >
                <span className="tabular-nums">{tab.label}</span>
                {active && (
                  <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-[#0B57D0] dark:bg-blue-400 rounded-t-full" />
                )}
              </button>
            );
          })}
        </div>

        {/* Right: Sender Account Dropdown + Template Dropdown + More Actions + Send CTA */}
        <div className="flex items-center gap-2">
          {/* Sender Channel Selector (Gmail vs Server Mail Accounts) */}
          <select
            value={selectedChannel}
            onChange={(e) => setSelectedChannel(e.target.value)}
            className="px-3 py-1.5 text-xs font-medium rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-transparent focus:outline-none"
            title="Select sending account"
          >
            <option value="gmail">
              Gmail {activeGmailEmail ? `(${activeGmailEmail})` : ''}
            </option>
            {serverAccounts.map((sa) => (
              <option key={sa.id} value={sa.id}>
                Server Mail: {sa.email}
              </option>
            ))}
          </select>

          {/* Template Selector Dropdown */}
          <div className="relative" ref={templateMenuRef}>
            <button
              type="button"
              onClick={() => setIsTemplateMenuOpen((prev) => !prev)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/70 rounded-full transition-colors whitespace-nowrap"
            >
              <span className="max-w-[130px] truncate">{activeCampaign.tabTitle}</span>
              <ChevronDown className="w-3.5 h-3.5 shrink-0" />
            </button>

            {isTemplateMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-60 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg py-1.5 z-40 text-xs">
                <div className="px-3 py-1 text-[11px] font-semibold text-slate-400">
                  Saved Campaign Templates
                </div>
                {campaigns.map((camp) => (
                  <button
                    key={camp.id}
                    type="button"
                    onClick={() => {
                      setActiveCampaignId(camp.id);
                      setIsTemplateMenuOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between ${
                      camp.id === activeCampaign.id
                        ? 'text-[#0B57D0] font-semibold bg-blue-50/50 dark:bg-blue-950/40'
                        : 'text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <span className="truncate">{camp.tabTitle}</span>
                  </button>
                ))}
                <div className="border-t border-slate-100 dark:border-slate-800 mt-1 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsTemplateMenuOpen(false);
                      setIsNewCampOpen(true);
                    }}
                    className="w-full text-left px-3.5 py-2 text-[#0B57D0] dark:text-blue-400 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    + New Template Preset
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* More Actions Dropdown */}
          <div className="relative" ref={optionsMenuRef}>
            <button
              type="button"
              onClick={() => setIsOptionsMenuOpen((prev) => !prev)}
              className="p-1.5 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Bulk options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {isOptionsMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-56 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg py-1.5 z-40 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setIsOptionsMenuOpen(false);
                    setIsCsvModalOpen(true);
                  }}
                  className="w-full text-left px-4 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Import CSV / Paste List...
                </button>
                <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800">
                  <label className="block text-[11px] text-slate-400 mb-1">Send Speed</label>
                  <select
                    value={delayMs}
                    onChange={(e) => setDelayMs(Number(e.target.value))}
                    className="w-full px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  >
                    <option value={100}>Ultra-Fast (100ms)</option>
                    <option value={400}>Balanced (400ms)</option>
                    <option value={1000}>Safe Throttle (1.0s)</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setRecipients((prev) => prev.map((r) => ({ ...r, status: 'READY' })));
                    setIsOptionsMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border-t border-slate-100 dark:border-slate-800"
                >
                  Reset Sent Statuses
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              if (selectedChannel === 'gmail' && !isAuthenticated) {
                onRequireAuth();
                return;
              }
              setIsConfirmBulkOpen(true);
            }}
            disabled={readyRecipients.length === 0 || isSendingBatch}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#0B57D0] hover:bg-blue-700 disabled:bg-slate-300 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="tabular-nums">
              {isSendingBatch
                ? `Sending ${sentCount}/${recipients.length}`
                : `Send (${readyRecipients.length})`}
            </span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-5 md:p-8 max-w-4xl w-full mx-auto">
        {activeSubView === 'compose' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>
                Sending via:{' '}
                <strong>
                  {selectedServerAccount
                    ? `${selectedServerAccount.email} (${selectedServerAccount.smtpHost})`
                    : `Gmail (${activeGmailEmail || 'Connected Account'})`}
                </strong>
              </span>
              <span className="font-mono">
                Merge tags: {'{{name}}'} · {'{{company}}'} · {'{{customNote}}'}
              </span>
            </div>

            <div>
              <input
                type="text"
                value={activeCampaign.subjectTemplate}
                onChange={(e) => updateActiveCampaign({ subjectTemplate: e.target.value })}
                placeholder="Subject line template..."
                className="w-full pb-2.5 text-base font-medium border-b border-slate-200 dark:border-slate-800 bg-transparent text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <textarea
                rows={11}
                value={activeCampaign.bodyTemplate}
                onChange={(e) => updateActiveCampaign({ bodyTemplate: e.target.value })}
                placeholder="Write your personalized message body..."
                className="w-full text-sm leading-relaxed bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none resize-none"
              />
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
              {campaignAttachments.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {campaignAttachments.map((att) => (
                    <span
                      key={att.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200"
                    >
                      <Paperclip className="w-3.5 h-3.5 text-[#0B57D0]" />
                      <span className="max-w-[180px] truncate">{att.name}</span>
                      {att.isImage && (
                        <button
                          type="button"
                          onClick={() =>
                            setEditingAttachImage({
                              fileId: att.id,
                              target: { title: att.name, imageUrl: att.url, fileId: att.id },
                            })
                          }
                          className="px-1.5 py-0.5 rounded bg-purple-600 text-white text-[9px] font-bold cursor-pointer"
                        >
                          Edit
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setCampaignAttachments((prev) =>
                            prev.filter((item) => item.id !== att.id)
                          )
                        }
                        className="text-slate-400 hover:text-red-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1">
                  <label className="block text-[11px] text-slate-400 mb-1">Signature Line</label>
                  <input
                    type="text"
                    value={activeCampaign.signatureHtml}
                    onChange={(e) => updateActiveCampaign({ signatureHtml: e.target.value })}
                    className="w-full text-xs text-slate-700 dark:text-slate-300 bg-transparent border-b border-slate-200 dark:border-slate-800 pb-1 focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div className="flex items-center gap-2 self-end">
                  <button
                    type="button"
                    onClick={() => setIsFilePickerOpen(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-full transition-colors"
                  >
                    <Paperclip className="w-3.5 h-3.5 text-[#0B57D0]" />
                    <span>Attach from File Manager ({campaignAttachments.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSubView('recipients')}
                    className="px-4 py-2 text-xs font-semibold text-[#0B57D0] bg-blue-50 dark:bg-blue-950/50 rounded-full hover:bg-blue-100 transition-colors"
                  >
                    Next: Manage Recipients ({recipients.length}) →
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSubView === 'recipients' && (
          <div className="space-y-5">
            {/* 1-Character Instant Member & Team Group Importer */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                  <Users className="w-4 h-4 text-[#0B57D0]" />
                  <span>Quick Add from Workspace Teams & Members</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {allGroups.map((grp) => {
                    const grpMembers = allMembers.filter((m) => m.teamId === grp.id);
                    if (grpMembers.length === 0) return null;
                    return (
                      <button
                        key={grp.id}
                        type="button"
                        onClick={() => {
                          setRecipients((prev) => {
                            const existingEmails = new Set(prev.map((r) => r.email.toLowerCase()));
                            const toAdd: BulkRecipient[] = grpMembers
                              .filter((m) => !existingEmails.has(m.email.toLowerCase()))
                              .map((m) => ({
                                id: `grp-${m.id}-${Date.now()}`,
                                email: m.email,
                                name: m.fullName,
                                company: `${grp.name} · ${m.designation}`,
                                customNote: '',
                                status: 'READY',
                              }));
                            return [...prev, ...toAdd];
                          });
                        }}
                        className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-blue-500 text-slate-700 dark:text-slate-200 transition-colors"
                      >
                        + {grp.name} ({grpMembers.length})
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="relative">
                <div className="flex items-center bg-white dark:bg-slate-900 rounded-xl px-3 py-1.5 border border-slate-200 dark:border-slate-700">
                  <Search className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" />
                  <input
                    type="text"
                    value={memberQuickQuery}
                    onChange={(e) => setMemberQuickQuery(e.target.value)}
                    placeholder="Type 1+ letter to search and add any team member or group..."
                    className="w-full bg-transparent text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                  {memberQuickQuery && (
                    <button
                      type="button"
                      onClick={() => setMemberQuickQuery('')}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {memberQuickQuery.trim().length >= 1 && (
                  <div className="mt-1.5 max-h-44 overflow-y-auto rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800 shadow-lg">
                    {searchMembersInstant(memberQuickQuery, allMembers).map((m) => {
                      const alreadyAdded = recipients.some(
                        (r) => r.email.toLowerCase() === m.email.toLowerCase()
                      );
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            if (!alreadyAdded) {
                              setRecipients((prev) => [
                                ...prev,
                                {
                                  id: `mem-${m.id}-${Date.now()}`,
                                  email: m.email,
                                  name: m.fullName,
                                  company: m.designation,
                                  customNote: '',
                                  status: 'READY',
                                },
                              ]);
                            }
                            setMemberQuickQuery('');
                          }}
                          className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-blue-50/60 dark:hover:bg-slate-800 text-left"
                        >
                          <div className="min-w-0">
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                              {m.fullName}
                            </span>{' '}
                            <span className="text-slate-500">({m.designation})</span>
                            <span className="ml-2 font-mono text-[11px] text-slate-400">
                              {m.email}
                            </span>
                          </div>
                          <span className="text-[11px] font-semibold text-[#0B57D0]">
                            {alreadyAdded ? 'Added ✓' : '+ Add'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <form
              onSubmit={handleAddRecipient}
              className="flex flex-wrap items-center gap-2 pb-4 border-b border-slate-200 dark:border-slate-800"
            >
              <input
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Email address *"
                className="flex-1 min-w-[160px] px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Name"
                className="w-36 px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
              <input
                type="text"
                value={newCompany}
                onChange={(e) => setNewCompany(e.target.value)}
                placeholder="Company"
                className="w-36 px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
              <input
                type="text"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Custom note"
                className="flex-1 min-w-[160px] px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
              <button
                type="submit"
                className="flex items-center gap-1 px-4 py-2 text-xs font-semibold text-white bg-[#0B57D0] hover:bg-blue-700 rounded-lg whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
              <button
                type="button"
                onClick={() => setIsCsvModalOpen(true)}
                className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg whitespace-nowrap"
              >
                Import CSV
              </button>
            </form>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {recipients.map((rec, idx) => (
                <div key={rec.id} className="flex items-center justify-between gap-4 py-3 text-xs">
                  <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                    <span className="font-semibold text-slate-900 dark:text-slate-100 w-40 truncate shrink-0">
                      {rec.name}
                    </span>
                    <span className="font-mono text-slate-500 w-48 truncate shrink-0">
                      {rec.email}
                    </span>
                    <span className="text-slate-500 truncate">
                      {rec.company} {rec.customNote ? `· ${rec.customNote}` : ''}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewIndex(idx);
                        setActiveSubView('preview');
                      }}
                      className="text-blue-600 hover:underline"
                    >
                      Preview
                    </button>
                    <span className="font-mono text-[11px] text-slate-500">{rec.status}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setRecipients((prev) => prev.filter((item) => item.id !== rec.id))
                      }
                      className="text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeSubView === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <Eye className="w-4 h-4 text-blue-600" />
                <span>
                  Previewing recipient {previewIndex + 1} of {recipients.length}:{' '}
                  <strong>{previewRecipient.email}</strong>
                </span>
              </div>
              {recipients.length > 1 && (
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() =>
                      setPreviewIndex((prev) => (prev - 1 + recipients.length) % recipients.length)
                    }
                    className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewIndex((prev) => (prev + 1) % recipients.length)}
                    className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>

            <div className="py-4 space-y-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {interpolateTemplate(activeCampaign.subjectTemplate, previewRecipient)}
              </h2>
              <pre className="whitespace-pre-wrap font-sans text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                {interpolateTemplate(activeCampaign.bodyTemplate, previewRecipient)}
              </pre>
              {activeCampaign.signatureHtml && (
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-500">
                  {activeCampaign.signatureHtml}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* CSV Import Modal */}
      {isCsvModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[2px] p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                <span>Import Recipients (CSV)</span>
              </h3>
              <button type="button" onClick={() => setIsCsvModalOpen(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Format per line: <code className="font-mono">email, name, company, customNote</code>
            </p>
            <textarea
              rows={6}
              value={csvRawText}
              onChange={(e) => setCsvRawText(e.target.value)}
              className="w-full p-3 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCsvModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImportCsv}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#0B57D0] rounded-lg"
              >
                Import
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Template Preset Modal */}
      {isNewCampOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[2px] p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-6 space-y-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              New Campaign Template
            </h3>
            <form onSubmit={handleCreateCampaignTab} className="space-y-3">
              <input
                type="text"
                required
                value={newCampTitle}
                onChange={(e) => setNewCampTitle(e.target.value)}
                placeholder="Template name..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewCampOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-[#0B57D0] rounded-lg"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={isConfirmBulkOpen}
        title={`Send Bulk Campaign to ${readyRecipients.length} Recipient(s)?`}
        description={`Confirm sending personalized emails via ${
          selectedServerAccount
            ? `Server Mail (${selectedServerAccount.email})`
            : `Gmail (${activeGmailEmail || 'Connected Account'})`
        }.`}
        details={readyRecipients.map(
          (r) =>
            `${r.name} <${r.email}> — "${interpolateTemplate(activeCampaign.subjectTemplate, r)}"`
        )}
        confirmLabel={`Send ${readyRecipients.length} Email(s)`}
        isLoading={isSendingBatch}
        onConfirm={handleExecuteBulkSend}
        onCancel={() => setIsConfirmBulkOpen(false)}
      />

      <FileManagerPickerModal
        isOpen={isFilePickerOpen}
        onClose={() => setIsFilePickerOpen(false)}
        title="Attach Server File or Compressed Image to Bulk Campaign"
        onSelectFile={(file) => {
          setCampaignAttachments((prev) =>
            prev.some((f) => f.id === file.id) ? prev : [...prev, file]
          );
        }}
      />

      {editingAttachImage && (
        <Suspense fallback={null}>
          <ImageEditorModal
            isOpen={Boolean(editingAttachImage)}
            target={editingAttachImage.target}
            onClose={() => setEditingAttachImage(null)}
            onSaved={(res) => {
              if (res.file) {
                setCampaignAttachments((prev) =>
                  prev.map((item) => (item.id === editingAttachImage.fileId ? res.file! : item))
                );
              }
              setEditingAttachImage(null);
            }}
          />
        </Suspense>
      )}
    </div>
  );
};
