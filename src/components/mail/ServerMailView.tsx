import React, { Suspense, lazy, useState, useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import {
  Inbox,
  Star,
  Send,
  RefreshCw,
  PenSquare,
  ArrowLeft,
  Reply,
  CornerUpRight,
  MoreVertical,
  Server,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Edit3,
  X,
  Check,
  Lock,
  Paperclip,
  Presentation,
  FileText,
  FolderPlus,
  Eye,
  Edit3 as EditDocIcon,
} from 'lucide-react';
import { subscribeWorkspaceEvents } from '../../services/realtimeBus';
import {
  ParsedEmail,
  ServerMailAccount,
  ServerMailVerifyResult,
  WorkspaceFileItem,
  WorkspaceSlideDeck,
  WorkspaceDocItem,
  fetchServerMailMessages,
  getCachedServerMailMessages,
  verifyServerMailConnection,
  saveServerMailAccount,
  deleteServerMailAccount,
  toggleServerMailStar,
  saveServerMailDraft,
  sendServerMailMessage,
  fetchWorkspaceFiles,
  fetchWorkspaceSlides,
  fetchWorkspaceDocs,
  saveMailAttachmentToServerFiles,
} from '../../services/workspaceApi';
import { MemberAutocompleteDropdown } from '../shared/MemberAutocompleteDropdown';
import { FileManagerPickerModal } from '../filemanager/FileManagerPickerModal';
import {
  UniversalDocumentEngineModal,
  UniversalEngineTarget,
} from '../shared/UniversalDocumentEngineModal';
import type { ImageEditorTarget } from '../shared/ImageEditorModal';

const ImageEditorModal = lazy(() =>
  import('../shared/ImageEditorModal').then((m) => ({ default: m.ImageEditorModal }))
);

export type ServerMailFolder = 'inbox' | 'starred' | 'sent' | 'drafts' | 'all' | 'settings';

interface ServerMailViewProps {
  accounts: ServerMailAccount[];
  activeAccountId: string | null;
  onSelectAccount: (id: string) => void;
  onAccountsChanged: (accounts: ServerMailAccount[], newActiveId?: string) => void;
  activeFolder: ServerMailFolder;
  onSelectFolder: (folder: ServerMailFolder) => void;
  onOpenSettingsAccounts?: () => void;
  searchQuery: string;
  composeTriggerCount: number;
  onOpenBulkStudio: () => void;
  realtimeIncomingMessage?: ParsedEmail | null;
  focusMessageId?: string | null;
  pendingFileAttachment?: WorkspaceFileItem | null;
  onClearPendingAttachment?: () => void;
}

export const ServerMailView: React.FC<ServerMailViewProps> = ({
  accounts,
  activeAccountId,
  onSelectAccount,
  onAccountsChanged,
  activeFolder,
  onSelectFolder,
  onOpenSettingsAccounts,
  searchQuery,
  composeTriggerCount,
  onOpenBulkStudio,
  realtimeIncomingMessage,
  focusMessageId,
  pendingFileAttachment,
  onClearPendingAttachment,
}) => {
  const [messages, setMessages] = useState<ParsedEmail[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<ParsedEmail | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [warningMsg, setWarningMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [splitView, setSplitView] = useState<boolean>(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState<boolean>(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Compose State (Supports both Single Mail & Inline Bulk Mail from Header)
  const [isComposeOpen, setIsComposeOpen] = useState<boolean>(false);
  const [composeMode, setComposeMode] = useState<'single' | 'bulk'>('single');
  const [composeTo, setComposeTo] = useState<string>('');
  const [composeCc, setComposeCc] = useState<string>('');
  const [composeSubject, setComposeSubject] = useState<string>('');
  const [composeBody, setComposeBody] = useState<string>('');
  const [composeAttachments, setComposeAttachments] = useState<WorkspaceFileItem[]>([]);
  const [isFilePickerOpen, setIsFilePickerOpen] = useState<boolean>(false);
  const [editingAttachImage, setEditingAttachImage] = useState<{
    fileId: string;
    target: ImageEditorTarget;
  } | null>(null);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [toastBanner, setToastBanner] = useState<string | null>(null);

  // Universal In-App Engine (Slides, PDFs, Docs) + Server File Manager Sync State
  const [serverFiles, setServerFiles] = useState<WorkspaceFileItem[]>([]);
  const [slideDecks, setSlideDecks] = useState<WorkspaceSlideDeck[]>([]);
  const [workspaceDocs, setWorkspaceDocs] = useState<WorkspaceDocItem[]>([]);
  const [engineTarget, setEngineTarget] = useState<UniversalEngineTarget | null>(null);
  const [savingToDocsId, setSavingToDocsId] = useState<string | null>(null);

  const loadWorkspaceDocumentIndex = async () => {
    try {
      const [filesRes, slidesRes, docsRes] = await Promise.all([
        fetchWorkspaceFiles(),
        fetchWorkspaceSlides(),
        fetchWorkspaceDocs(),
      ]);
      setServerFiles(filesRes.files);
      setSlideDecks(slidesRes.slides);
      setWorkspaceDocs(docsRes);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadWorkspaceDocumentIndex();
  }, []);

  // Settings Form State (cPanel / Custom Domain IMAP & SMTP)
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [label, setLabel] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [imapHost, setImapHost] = useState<string>('');
  const [imapPort, setImapPort] = useState<number>(993);
  const [imapSecure, setImapSecure] = useState<boolean>(true);
  const [smtpHost, setSmtpHost] = useState<string>('');
  const [smtpPort, setSmtpPort] = useState<number>(465);
  const [smtpSecure, setSmtpSecure] = useState<boolean>(true);

  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [isSavingAccount, setIsSavingAccount] = useState<boolean>(false);
  const [verifyResult, setVerifyResult] = useState<ServerMailVerifyResult | null>(null);

  const activeAccount = accounts.find((a) => a.id === activeAccountId) || accounts[0] || null;

  useEffect(() => {
    if (composeTriggerCount > 0) {
      if (!activeAccount) {
        onOpenSettingsAccounts?.();
      } else {
        setComposeTo('');
        setComposeCc('');
        setComposeSubject('');
        setComposeBody('');
        setComposeAttachments([]);
        setIsComposeOpen(true);
      }
    }
  }, [composeTriggerCount]);

  useEffect(() => {
    if (pendingFileAttachment && activeAccount) {
      setComposeAttachments((prev) =>
        prev.some((f) => f.id === pendingFileAttachment.id)
          ? prev
          : [...prev, pendingFileAttachment]
      );
      setIsComposeOpen(true);
      onClearPendingAttachment?.();
    }
  }, [pendingFileAttachment, activeAccount]);

  useEffect(() => {
    setSelectedMessage(null);
  }, [activeFolder, activeAccountId]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setIsMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const loadServerMessages = async (force = false, silent = false) => {
    if (!activeAccount || activeFolder === 'settings') return;

    const cached = getCachedServerMailMessages(activeAccount.id, activeFolder, searchQuery);
    if (cached && !force) {
      setMessages(cached);
      return;
    }

    if (!silent) {
      setIsLoading(cached === null);
      setIsSyncing(true);
    }
    setErrorMsg(null);

    try {
      const { messages: fetched, warning } = await fetchServerMailMessages(
        activeAccount.id,
        activeFolder,
        searchQuery,
        force
      );
      setMessages(fetched);
      setWarningMsg(warning);
    } catch (err: any) {
      if (!silent) {
        setErrorMsg(err?.message || 'Unable to fetch messages from server.');
      }
    } finally {
      if (!silent) {
        setIsLoading(false);
        setIsSyncing(false);
      }
    }
  };

  useEffect(() => {
    if (activeAccount && activeFolder !== 'settings') {
      loadServerMessages(false, false);
    }
  }, [activeAccount?.id, activeFolder, searchQuery]);

  // Instant Real-Time Push: Prepend incoming SSE message immediately without reload or spinner
  useEffect(() => {
    if (!realtimeIncomingMessage || !activeAccount) return;
    if (activeFolder === 'inbox' || activeFolder === 'all') {
      setMessages((prev) => {
        if (prev.some((m) => m.id === realtimeIncomingMessage.id)) return prev;
        return [realtimeIncomingMessage, ...prev];
      });
    }
  }, [realtimeIncomingMessage]);

  // Open specific message when user clicks a notification in the Bell menu
  useEffect(() => {
    if (!focusMessageId) return;
    const found = messages.find((m) => m.id === focusMessageId);
    if (found) {
      found.isUnread = false;
      setSelectedMessage(found);
    }
  }, [focusMessageId, messages]);

  // Event-driven updates when new server mail arrives (Zero background polling)
  useEffect(() => {
    if (!activeAccount || activeFolder === 'settings') return;
    const unsubscribe = subscribeWorkspaceEvents((eventName) => {
      if (eventName === 'mail:arrived' || eventName === 'cmh:admin_mail') {
        loadServerMessages(true, true);
      }
    });
    return unsubscribe;
  }, [activeAccount?.id, activeFolder, searchQuery]);

  // Auto-populate cPanel hosts when user types a domain email
  const handleEmailChange = (val: string) => {
    setEmail(val);
    if (!username || username === email) {
      setUsername(val);
    }
    const domain = val.split('@')[1];
    if (domain && domain.includes('.') && !editingId) {
      if (!imapHost || imapHost.startsWith('mail.')) {
        setImapHost(`mail.${domain}`);
      }
      if (!smtpHost || smtpHost.startsWith('mail.')) {
        setSmtpHost(`mail.${domain}`);
      }
    }
  };

  const resetSettingsForm = () => {
    setEditingId(undefined);
    setLabel('');
    setEmail('');
    setUsername('');
    setPassword('');
    setImapHost('');
    setImapPort(993);
    setImapSecure(true);
    setSmtpHost('');
    setSmtpPort(465);
    setSmtpSecure(true);
    setVerifyResult(null);
  };

  const handleEditAccount = (acc: ServerMailAccount) => {
    setEditingId(acc.id);
    setLabel(acc.label);
    setEmail(acc.email);
    setUsername(acc.username);
    setPassword('');
    setImapHost(acc.imapHost);
    setImapPort(acc.imapPort);
    setImapSecure(acc.imapSecure);
    setSmtpHost(acc.smtpHost);
    setSmtpPort(acc.smtpPort);
    setSmtpSecure(acc.smtpSecure);
    setVerifyResult(null);
  };

  const handleTestConnection = async (targetAccount?: ServerMailAccount) => {
    setIsVerifying(true);
    setVerifyResult(null);
    setErrorMsg(null);

    try {
      const payload = targetAccount
        ? {
            accountId: targetAccount.id,
            email: targetAccount.email,
            username: targetAccount.username,
            imapHost: targetAccount.imapHost,
            imapPort: targetAccount.imapPort,
            imapSecure: targetAccount.imapSecure,
            smtpHost: targetAccount.smtpHost,
            smtpPort: targetAccount.smtpPort,
            smtpSecure: targetAccount.smtpSecure,
          }
        : {
            accountId: editingId,
            email,
            username: username || email,
            password,
            imapHost,
            imapPort,
            imapSecure,
            smtpHost,
            smtpPort,
            smtpSecure,
          };

      const res = await verifyServerMailConnection(payload);
      setVerifyResult(res);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Connection test failed.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSaveAccountForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingAccount(true);
    setErrorMsg(null);

    try {
      const result = await saveServerMailAccount({
        id: editingId,
        label: label.trim() || email.split('@')[0],
        email: email.trim(),
        username: (username || email).trim(),
        password: password || undefined,
        imapHost: imapHost.trim(),
        imapPort: Number(imapPort) || 993,
        imapSecure,
        smtpHost: smtpHost.trim(),
        smtpPort: Number(smtpPort) || 465,
        smtpSecure,
      });

      onAccountsChanged(result.accounts, result.account.id);
      setToastBanner(`Server Mail "${result.account.email}" saved with hashed password in DB.`);
      setTimeout(() => setToastBanner(null), 4000);
      resetSettingsForm();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save Server Mail account.');
    } finally {
      setIsSavingAccount(false);
    }
  };

  const handleRemoveAccount = async (id: string) => {
    try {
      const next = await deleteServerMailAccount(id);
      onAccountsChanged(next, next[0]?.id);
      if (editingId === id) resetSettingsForm();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not remove account.');
    }
  };

  const handleToggleStar = async (msg: ParsedEmail, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeAccount) return;
    setMessages((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, isStarred: !m.isStarred } : m))
    );
    await toggleServerMailStar(activeAccount.id, msg.id);
  };

  const handleSaveDraft = async () => {
    if (!activeAccount) return;
    await saveServerMailDraft(activeAccount.id, {
      to: composeTo,
      cc: composeCc,
      subject: composeSubject,
      bodyText: composeBody,
    });
    setIsComposeOpen(false);
    setToastBanner('Draft saved to Server Mail.');
    setTimeout(() => setToastBanner(null), 3000);
    if (activeFolder === 'drafts') {
      loadServerMessages(true, true);
    }
  };

  // Detect any attached/linked Slides, PDFs, or Documents in a Server Mail message
  const getEmailAttachedDocuments = (msg: ParsedEmail) => {
    const combined = `${msg.bodyHtml || ''}\n${msg.bodyText || ''}`;
    const detected: Array<{
      id: string;
      name: string;
      url?: string;
      kind: 'SLIDES' | 'PDF' | 'DOC';
      mimeType: string;
      fileItem?: WorkspaceFileItem;
      slideDeck?: WorkspaceSlideDeck;
      docItem?: WorkspaceDocItem;
      bodyText?: string;
    }> = [];
    const seenKeys = new Set<string>();

    const uploadRegex = /(?:https?:\/\/[^\s"'<>]+)?(\/uploads\/[^\s"'<>)]+)/gi;
    let match: RegExpExecArray | null;
    while ((match = uploadRegex.exec(combined)) !== null) {
      const relUrl = match[1];
      if (seenKeys.has(relUrl)) continue;
      seenKeys.add(relUrl);

      const matchedFile = serverFiles.find((f) => f.url === relUrl);
      const matchedDeck = slideDecks.find(
        (s) => s.fileUrl === relUrl || (matchedFile && s.id === matchedFile.slideDeckId)
      );
      const matchedDoc = workspaceDocs.find(
        (d) => d.fileUrl === relUrl || (matchedFile && d.id === matchedFile.docId)
      );

      const lower = (matchedFile?.name || relUrl).toLowerCase();
      const kind: 'SLIDES' | 'PDF' | 'DOC' =
        matchedDeck || lower.includes('.slide') || lower.endsWith('.pptx') || lower.endsWith('.ppt')
          ? 'SLIDES'
          : lower.endsWith('.pdf')
          ? 'PDF'
          : 'DOC';

      detected.push({
        id: matchedFile?.id || relUrl,
        name:
          matchedDeck?.title ||
          matchedDoc?.title ||
          matchedFile?.name ||
          decodeURIComponent(relUrl.split('/').pop() || 'Attached Document'),
        url: relUrl,
        kind,
        mimeType:
          matchedFile?.mimeType ||
          (kind === 'PDF'
            ? 'application/pdf'
            : kind === 'SLIDES'
            ? 'application/vnd.workspace.slides+json'
            : 'text/plain'),
        fileItem: matchedFile,
        slideDeck: matchedDeck,
        docItem: matchedDoc,
        bodyText: matchedDoc?.bodyText || matchedFile?.bodyText || msg.bodyText,
      });
    }

    const fileMentionRegex = /\b([A-Za-z0-9_\-.]+\.(?:pdf|slides|pptx|ppt|docx|doc|txt))\b/gi;
    while ((match = fileMentionRegex.exec(`${msg.subject} ${combined}`)) !== null) {
      const fileName = match[1];
      const lower = fileName.toLowerCase();
      if (seenKeys.has(lower) || Array.from(seenKeys).some((k) => k.toLowerCase().includes(lower))) {
        continue;
      }
      seenKeys.add(lower);

      const matchedFile = serverFiles.find((f) => f.name.toLowerCase() === lower);
      const matchedDeck = slideDecks.find(
        (s) => `${s.title.toLowerCase()}.slides` === lower || s.id === matchedFile?.slideDeckId
      );
      const matchedDoc = workspaceDocs.find(
        (d) => `${d.title.toLowerCase()}.doc` === lower || d.id === matchedFile?.docId
      );

      const kind: 'SLIDES' | 'PDF' | 'DOC' =
        lower.endsWith('.slides') || lower.endsWith('.pptx') || lower.endsWith('.ppt')
          ? 'SLIDES'
          : lower.endsWith('.pdf')
          ? 'PDF'
          : 'DOC';

      detected.push({
        id: matchedFile?.id || `mail-att-${fileName}`,
        name: fileName,
        url: matchedFile?.url,
        kind,
        mimeType:
          kind === 'PDF'
            ? 'application/pdf'
            : kind === 'SLIDES'
            ? 'application/vnd.workspace.slides+json'
            : 'text/plain',
        fileItem: matchedFile,
        slideDeck: matchedDeck,
        docItem: matchedDoc,
        bodyText: matchedDoc?.bodyText || matchedFile?.bodyText || msg.bodyText,
      });
    }

    return detected;
  };

  const handleSaveMailAttachmentToDocuments = async (att: {
    id: string;
    name: string;
    url?: string;
    kind: 'SLIDES' | 'PDF' | 'DOC';
    mimeType: string;
    fileItem?: WorkspaceFileItem;
    slideDeck?: WorkspaceSlideDeck;
    docItem?: WorkspaceDocItem;
    bodyText?: string;
  }) => {
    setSavingToDocsId(att.id);
    try {
      const res = await saveMailAttachmentToServerFiles({
        name: att.name,
        mimeType: att.mimeType,
        bodyText: att.bodyText || selectedMessage?.bodyText || '',
        url: att.url,
        slideDeckId: att.slideDeck?.id || att.fileItem?.slideDeckId,
        docId: att.docItem?.id || att.fileItem?.docId,
      });
      setServerFiles(res.files);
      setToastBanner(`Saved "${res.file.name}" to File Manager â†’ Documents`);
      setTimeout(() => setToastBanner(null), 4000);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save attachment to File Manager.');
    } finally {
      setSavingToDocsId(null);
    }
  };

  const handleDirectSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAccount || !composeTo.trim() || isSending) return;

    // Parse 1 or multiple recipients (comma, semicolon, newline, or space separated)
    const recipients = Array.from(
      new Set(
        composeTo
          .split(/[\s,;]+/)
          .map((item) => item.trim())
          .filter((item) => item.includes('@'))
      )
    );

    if (recipients.length === 0) {
      setErrorMsg('Please enter at least one valid recipient email address.');
      return;
    }

    setIsSending(true);
    setErrorMsg(null);
    try {
      const attachmentHtml =
        composeAttachments.length > 0
          ? `<div style="margin-top:16px;padding-top:12px;border-top:1px solid #e2e8f0;">
              <div style="font-size:12px;font-weight:600;color:#475569;margin-bottom:8px;">Attached Files (${composeAttachments.length}):</div>
              ${composeAttachments
                .map((att) => {
                  const fullUrl = `${window.location.origin}${att.url}`;
                  return att.isImage
                    ? `<div style="margin-bottom:10px;"><a href="${fullUrl}" target="_blank" style="font-size:12px;color:#0B57D0;text-decoration:none;font-weight:600;">${att.name}</a><br/><img src="${fullUrl}" alt="${att.name}" style="max-width:360px;border-radius:8px;margin-top:4px;border:1px solid #e2e8f0;"/></div>`
                    : `<div style="margin-bottom:6px;"><a href="${fullUrl}" target="_blank" style="font-size:12px;color:#0B57D0;text-decoration:underline;">ðŸ“Ž ${att.name}</a></div>`;
                })
                .join('')}
            </div>`
          : '';

      const htmlBody =
        composeBody
          .split('\n')
          .map(
            (line) =>
              `<p style="margin:0 0 8px 0;font-family:sans-serif;font-size:14px;">${
                line || '&nbsp;'
              }</p>`
          )
          .join('') + attachmentHtml;

      const textWithLinks =
        composeAttachments.length > 0
          ? `${composeBody}\n\nAttachments:\n${composeAttachments
              .map((a) => `- ${a.name}: ${window.location.origin}${a.url}`)
              .join('\n')}`
          : composeBody;

      for (const recipient of recipients) {
        await sendServerMailMessage(activeAccount.id, {
          to: recipient,
          cc: recipients.length === 1 ? composeCc : undefined,
          subject: composeSubject || '(No Subject)',
          bodyHtml: htmlBody,
          bodyText: textWithLinks,
        });
      }

      setIsComposeOpen(false);
      setComposeTo('');
      setComposeCc('');
      setComposeSubject('');
      setComposeBody('');
      setComposeAttachments([]);
      setToastBanner(
        recipients.length > 1
          ? `Bulk Server Mail sent to ${recipients.length} recipients via ${activeAccount.smtpHost}`
          : `Email sent via ${activeAccount.smtpHost} to ${recipients[0]}`
      );
      setTimeout(() => setToastBanner(null), 4000);
      loadServerMessages(true, true);
    } catch (err: any) {
      setErrorMsg(err?.message || 'SMTP send failed.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 md:rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200/80 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 capitalize">
            {`${activeFolder === 'settings' ? 'inbox' : activeFolder} ${
              activeAccount ? `Â· ${activeAccount.email}` : ''
            }`}
          </span>

          {/* Quick Account Switcher Pills if multiple Server Mail accounts exist */}
          {accounts.length > 1 && (
            <select
              value={activeAccount?.id || ''}
              onChange={(e) => onSelectAccount(e.target.value)}
              className="px-2.5 py-1 text-xs font-medium rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.label} ({acc.email})
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => loadServerMessages(true, false)}
            disabled={!activeAccount || isSyncing}
            className="p-2 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Sync with IMAP Server"
          >
            <RefreshCw className={`w-4 h-4 ${''}`} />
          </button>

          <div className="relative" ref={moreMenuRef}>
            <button
              type="button"
              onClick={() => setIsMoreMenuOpen((prev) => !prev)}
              className="p-2 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {isMoreMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-52 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg py-1.5 z-40 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setSplitView((prev) => !prev);
                    setIsMoreMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between"
                >
                  <span>Split Reading Pane</span>
                  <span className="font-semibold text-blue-600">
                    {splitView ? 'On' : 'Off'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    onOpenSettingsAccounts?.();
                  }}
                  className="w-full text-left px-4 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Manage Accounts in Settings
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    onOpenBulkStudio();
                  }}
                  className="w-full text-left px-4 py-2 text-[#0B57D0] font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 border-t border-slate-100 dark:border-slate-800"
                >
                  Send Bulk Mail via Server
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Banners */}
      {toastBanner && (
        <div className="flex items-center justify-between px-4 py-2 bg-emerald-50 dark:bg-emerald-950/60 border-b border-emerald-200 text-xs font-medium text-emerald-800 dark:text-emerald-200">
          <span className="flex items-center gap-2">
            <Check className="w-4 h-4" />
            {toastBanner}
          </span>
          <button type="button" onClick={() => setToastBanner(null)}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center justify-between px-4 py-2 bg-red-50 dark:bg-red-950/60 border-b border-red-200 text-xs text-red-700 dark:text-red-300">
          <span>{errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg(null)}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {warningMsg && activeFolder !== 'settings' && (
        <div className="flex items-center justify-between px-4 py-1.5 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 text-xs text-amber-800 dark:text-amber-200">
          <span>IMAP Notice: {warningMsg}</span>
          <button type="button" onClick={() => setWarningMsg(null)}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* INBOX VIEW (Account configuration is exclusively in the global Settings -> Accounts module) */}
      {!activeAccount ? (
        <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
          <Inbox className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3" />
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">
            Your Server Mail Inbox is Blank
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mb-5">
            No Server Mail or Domain IMAP/SMTP account is connected yet. Add your account from Settings â†’ Accounts to start receiving and sending domain emails.
          </p>
          <button
            type="button"
            onClick={() => onOpenSettingsAccounts?.()}
            className="px-5 py-2 text-xs font-semibold text-white bg-[#0B57D0] rounded-full hover:bg-blue-700 transition-colors"
          >
            Go to Settings â†’ Accounts
          </button>
        </div>
      ) : (
        /* MESSAGE LIST + READER (Same clean Gmail-style layout) */
        <div className="flex-1 flex min-h-0 overflow-hidden">
          <div
            className={`${
              selectedMessage && !splitView
                ? 'hidden'
                : selectedMessage && splitView
                ? 'w-full md:w-[44%] border-r border-slate-200 dark:border-slate-800'
                : 'w-full'
            } flex flex-col overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/70`}
          >
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 p-12 text-center">
                <Inbox className="w-9 h-9 text-slate-300 dark:text-slate-600 mb-2" />
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  No messages in {activeFolder}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Connected to {activeAccount.imapHost}:{activeAccount.imapPort}
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                const isSelected = selectedMessage?.id === msg.id;
                return (
                  <div
                    key={msg.id}
                    onClick={() => {
                      msg.isUnread = false;
                      setSelectedMessage(msg);
                    }}
                    className={`group flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[#C2E7FF]/45 dark:bg-blue-950/60'
                        : msg.isUnread
                        ? 'bg-white dark:bg-slate-900 hover:bg-slate-50/90'
                        : 'bg-[#F2F6FC]/65 dark:bg-slate-900/50 hover:bg-slate-100/80'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={(e) => handleToggleStar(msg, e)}
                      className="text-slate-400 hover:text-amber-400 transition-colors shrink-0"
                    >
                      <Star
                        className={`w-4 h-4 ${
                          msg.isStarred ? 'fill-amber-400 text-amber-400' : ''
                        }`}
                      />
                    </button>

                    <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-4">
                      <span
                        className={`w-44 truncate text-sm shrink-0 ${
                          msg.isUnread
                            ? 'font-semibold text-slate-950 dark:text-white'
                            : 'font-normal text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {msg.fromName}
                      </span>

                      <div className="min-w-0 flex-1 truncate text-sm">
                        <span
                          className={
                            msg.isUnread
                              ? 'font-semibold text-slate-900 dark:text-slate-100'
                              : 'font-normal text-slate-800 dark:text-slate-200'
                          }
                        >
                          {msg.subject}
                        </span>
                        <span className="mx-1.5 text-slate-400">â€”</span>
                        <span className="text-slate-500 dark:text-slate-400 font-normal">
                          {msg.snippet}
                        </span>
                      </div>
                    </div>

                    <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap shrink-0">
                      {msg.date}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {selectedMessage && (
            <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 overflow-y-auto">
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs z-10">
                <button
                  type="button"
                  onClick={() => setSelectedMessage(null)}
                  className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setComposeTo(selectedMessage.fromEmail);
                      setComposeSubject(
                        selectedMessage.subject.startsWith('Re:')
                          ? selectedMessage.subject
                          : `Re: ${selectedMessage.subject}`
                      );
                      setComposeBody('');
                      setIsComposeOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-full"
                  >
                    <Reply className="w-3.5 h-3.5" />
                    <span>Reply</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setComposeTo('');
                      setComposeSubject(`Fwd: ${selectedMessage.subject}`);
                      setComposeBody(
                        `\n\n---------- Forwarded message ---------\nFrom: ${selectedMessage.fromName} <${selectedMessage.fromEmail}>\nDate: ${selectedMessage.date}\nSubject: ${selectedMessage.subject}\n\n${selectedMessage.bodyText}`
                      );
                      setIsComposeOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-full"
                  >
                    <CornerUpRight className="w-3.5 h-3.5" />
                    <span>Forward</span>
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-5">
                <h2 className="text-xl font-normal text-slate-900 dark:text-slate-100">
                  {selectedMessage.subject}
                </h2>

                <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-[#0B57D0] text-white flex items-center justify-center font-semibold text-sm shrink-0">
                      {selectedMessage.fromName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-sm">
                        <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {selectedMessage.fromName}
                        </span>
                        <span className="text-xs text-slate-500 truncate">
                          &lt;{selectedMessage.fromEmail}&gt;
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 truncate">
                        to {selectedMessage.to}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-slate-500 tabular-nums whitespace-nowrap shrink-0">
                    {selectedMessage.date}
                  </span>
                </div>

                {/* Universal In-App Engine Bar for Attached Slides, PDFs & Documents (plus Quick Open Email as Doc) */}
                {(() => {
                  const emailAttachments = getEmailAttachedDocuments(selectedMessage);
                  return (
                    <div className="rounded-xl border border-blue-200/80 dark:border-blue-900/60 bg-[#F8FAFD] dark:bg-slate-800/70 p-3.5 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-100">
                          <Presentation className="w-4 h-4 text-[#0B57D0]" />
                          <span>
                            {emailAttachments.length > 0
                              ? `Attached Slides, PDFs & Documents (${emailAttachments.length})`
                              : 'Instant Document & Slide Engine'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setEngineTarget({
                                title: selectedMessage.subject || 'Server Mail Document',
                                bodyText: selectedMessage.bodyText,
                                mimeType: 'text/plain',
                                extension: 'doc',
                                initialMode: 'EDIT',
                                fromMailAttachment: true,
                              })
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:border-[#0B57D0] hover:text-[#0B57D0]"
                          >
                            <EditDocIcon className="w-3 h-3" />
                            <span>Open / Edit Email in Doc Engine</span>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleSaveMailAttachmentToDocuments({
                                id: `email-doc-${selectedMessage.id}`,
                                name: `${selectedMessage.subject || 'Server_Mail_Note'}.doc`,
                                kind: 'DOC',
                                mimeType: 'text/plain',
                                bodyText: `Subject: ${selectedMessage.subject}\nFrom: ${selectedMessage.fromName} <${selectedMessage.fromEmail}>\nDate: ${selectedMessage.date}\n\n${selectedMessage.bodyText}`,
                              })
                            }
                            disabled={savingToDocsId === `email-doc-${selectedMessage.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-[11px] font-semibold text-[#0B57D0] dark:text-blue-300 hover:bg-blue-100"
                          >
                            <FolderPlus className="w-3 h-3" />
                            <span>
                              {'Save to File Manager'}
                            </span>
                          </button>
                        </div>
                      </div>

                      {emailAttachments.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          {emailAttachments.map((att) => (
                            <div
                              key={att.id}
                              className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                    att.kind === 'SLIDES'
                                      ? 'bg-amber-50 text-amber-600'
                                      : att.kind === 'PDF'
                                      ? 'bg-red-50 text-red-600'
                                      : 'bg-blue-50 text-[#0B57D0]'
                                  }`}
                                >
                                  {att.kind === 'SLIDES' ? (
                                    <Presentation className="w-4 h-4" />
                                  ) : (
                                    <FileText className="w-4 h-4" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                                    {att.name}
                                  </div>
                                  <div className="text-[10px] text-slate-500">
                                    {att.kind === 'SLIDES'
                                      ? 'Google Slides Presentation'
                                      : att.kind === 'PDF'
                                      ? 'PDF Document'
                                      : 'Workspace Document'}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEngineTarget({
                                      title: att.name,
                                      url: att.url || att.fileItem?.url,
                                      mimeType: att.mimeType,
                                      extension:
                                        att.kind === 'SLIDES'
                                          ? 'slides'
                                          : att.kind === 'PDF'
                                          ? 'pdf'
                                          : 'doc',
                                      fileId: att.fileItem?.id,
                                      slideDeckId: att.slideDeck?.id || att.fileItem?.slideDeckId,
                                      docId: att.docItem?.id || att.fileItem?.docId,
                                      bodyText: att.bodyText,
                                      fromMailAttachment: true,
                                    })
                                  }
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0B57D0] hover:bg-blue-700 text-white text-[11px] font-semibold"
                                  title="View or Edit directly inside the app"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>Open & Edit</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleSaveMailAttachmentToDocuments(att)}
                                  disabled={savingToDocsId === att.id}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-[11px] font-semibold"
                                  title="Save to File Manager -> Documents"
                                >
                                  <FolderPlus className="w-3 h-3 text-[#0284C7]" />
                                  <span>{savingToDocsId === att.id ? '...' : 'Save'}</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {selectedMessage.bodyHtml ? (
                  <div
                    className="prose prose-sm max-w-none dark:prose-invert text-slate-800 dark:text-slate-200 overflow-x-auto"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedMessage.bodyHtml) }}
                  />
                ) : (
                  <pre className="whitespace-pre-wrap font-sans text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                    {selectedMessage.bodyText}
                  </pre>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mobile Floating Compose Button */}
      {activeAccount && activeFolder !== 'settings' && (
        <button
          type="button"
          onClick={() => setIsComposeOpen(true)}
          className="md:hidden fixed bottom-16 right-4 z-20 flex items-center gap-2 px-4 py-3 rounded-2xl bg-[#C2E7FF] text-[#001D35] font-semibold text-sm shadow-md"
        >
          <PenSquare className="w-4 h-4" />
          <span>Compose</span>
        </button>
      )}

      {/* Server Mail Floating Compose Window (Single & Inline Bulk Support, Instant Send without Confirmation Modal) */}
      {isComposeOpen && activeAccount && (
        <div className="fixed bottom-0 right-4 md:right-8 z-40 w-[calc(100vw-2rem)] sm:w-[480px] bg-white dark:bg-slate-900 rounded-t-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-[#F2F6FC] dark:bg-slate-800">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                New Server Mail
              </span>
              {/* Header Switch: Single Mail vs Bulk Mail */}
              <div className="flex items-center bg-white dark:bg-slate-900 rounded-full p-0.5 border border-slate-200 dark:border-slate-700 text-[11px]">
                <button
                  type="button"
                  onClick={() => setComposeMode('single')}
                  className={`px-2.5 py-0.5 rounded-full font-semibold transition-all ${
                    composeMode === 'single'
                      ? 'bg-[#0B57D0] text-white'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Single
                </button>
                <button
                  type="button"
                  onClick={() => setComposeMode('bulk')}
                  className={`px-2.5 py-0.5 rounded-full font-semibold transition-all ${
                    composeMode === 'bulk'
                      ? 'bg-[#0B57D0] text-white'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Bulk Mail
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsComposeOpen(false)}
              className="p-1 text-slate-500 hover:text-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleDirectSend} className="p-4 space-y-2">
            {composeMode === 'bulk' ? (
              <div className="relative">
                <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                  <span>To (Type 1+ letter to search members/teams or enter emails)</span>
                  <span className="font-semibold text-[#0B57D0]">
                    {
                      composeTo
                        .split(/[\s,;]+/)
                        .filter((x) => x.trim().includes('@')).length
                    }{' '}
                    recipients
                  </span>
                </div>
                <textarea
                  rows={2}
                  required
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                  placeholder="Type a letter to search members/teams, or enter emails..."
                  className="w-full p-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800 focus:outline-none focus:border-blue-600 resize-none"
                />
                <MemberAutocompleteDropdown
                  inputValue={composeTo}
                  onSelectEmails={(newVal) => setComposeTo(newVal)}
                />
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  required
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                  placeholder="To (Type 1+ letter to search members/teams or enter email)"
                  className="w-full pb-2 text-sm border-b border-slate-200 dark:border-slate-800 bg-transparent focus:outline-none focus:border-blue-600"
                />
                <MemberAutocompleteDropdown
                  inputValue={composeTo}
                  onSelectEmails={(newVal) => setComposeTo(newVal)}
                />
              </div>
            )}

            {composeMode === 'single' && (
              <input
                type="text"
                value={composeCc}
                onChange={(e) => setComposeCc(e.target.value)}
                placeholder="Cc"
                className="w-full pb-2 text-xs border-b border-slate-200 dark:border-slate-800 bg-transparent focus:outline-none focus:border-blue-600"
              />
            )}

            <input
              type="text"
              required
              value={composeSubject}
              onChange={(e) => setComposeSubject(e.target.value)}
              placeholder="Subject"
              className="w-full pb-2 text-sm border-b border-slate-200 dark:border-slate-800 bg-transparent focus:outline-none focus:border-blue-600"
            />
            <textarea
              rows={5}
              required
              value={composeBody}
              onChange={(e) => setComposeBody(e.target.value)}
              placeholder="Compose message..."
              className="w-full pt-2 text-sm bg-transparent focus:outline-none resize-none"
            />

            {composeAttachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {composeAttachments.map((att) => (
                  <span
                    key={att.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-200"
                  >
                    <Paperclip className="w-3 h-3 text-[#0B57D0]" />
                    <span className="max-w-[150px] truncate">{att.name}</span>
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
                        setComposeAttachments((prev) => prev.filter((item) => item.id !== att.id))
                      }
                      className="text-slate-400 hover:text-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={isSending}
                  className="flex items-center gap-2 px-5 py-2 rounded-full bg-[#0B57D0] hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {composeMode === 'bulk'
                      ? 'Send Bulk Mail'
                      : 'Send'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsFilePickerOpen(true)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
                  title="Attach Photo or File from Server File Manager"
                >
                  <Paperclip className="w-3.5 h-3.5 text-[#0B57D0]" />
                  <span>File Manager</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-full"
                >
                  Save Draft
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsComposeOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      )}

      <FileManagerPickerModal
        isOpen={isFilePickerOpen}
        onClose={() => setIsFilePickerOpen(false)}
        defaultFolderId="folder-documents"
        title="Attach Slide Deck, PDF, Document, or Image from Server File Manager"
        onSelectFile={(file) => {
          setComposeAttachments((prev) =>
            prev.some((f) => f.id === file.id) ? prev : [...prev, file]
          );
        }}
      />

      <UniversalDocumentEngineModal
        isOpen={Boolean(engineTarget)}
        target={engineTarget}
        onClose={() => setEngineTarget(null)}
        onSavedOrUpdated={() => {
          loadWorkspaceDocumentIndex();
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
                setComposeAttachments((prev) =>
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


