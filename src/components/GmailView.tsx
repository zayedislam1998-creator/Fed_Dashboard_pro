import React, { Suspense, lazy, useState, useEffect, useMemo, useRef } from 'react';
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
  X,
  Check,
  Trash2,
  Mail,
  Image as ImageIcon,
  Paperclip,
  Presentation,
  FileText,
  FolderPlus,
  Eye,
  Edit3,
  Settings,
  KeyRound,
  ShieldCheck,
  Plus,
} from 'lucide-react';
import { subscribeWorkspaceEvents } from '../services/realtimeBus';
import {
  ConnectedGmailAccount,
  saveGmailAccountOnServer,
  verifyGmailConnectionOnServer,
  removeGmailAccount,
  switchActiveGmailAccount,
} from '../services/auth';
import {
  ParsedEmail,
  CustomMailTab,
  WorkspaceFileItem,
  WorkspaceSlideDeck,
  WorkspaceDocItem,
  fetchGmailMessages,
  getCachedMessages,
  sendGmailMessage,
  createNotification,
  formatBytes,
  fetchWorkspaceFiles,
  fetchWorkspaceSlides,
  fetchWorkspaceDocs,
  saveMailAttachmentToServerFiles,
} from '../services/workspaceApi';
import { MemberAutocompleteDropdown } from './MemberAutocompleteDropdown';
import { FileManagerPickerModal } from './FileManagerPickerModal';
import {
  UniversalDocumentEngineModal,
  UniversalEngineTarget,
} from './UniversalDocumentEngineModal';
import type { ImageEditorTarget } from './ImageEditorModal';

const ImageEditorModal = lazy(() =>
  import('./ImageEditorModal').then((m) => ({ default: m.ImageEditorModal }))
);

interface GmailViewProps {
  isAuthenticated: boolean;
  accounts?: ConnectedGmailAccount[];
  activeAccountEmail?: string | null;
  onSelectFolder?: (folderId: string) => void;
  onAccountsChanged?: (accounts: ConnectedGmailAccount[], activeEmail?: string | null) => void;
  onRequireAuth: () => void;
  onOpenBulkStudio: () => void;
  onSwitchToServerMail?: () => void;
  activeFolderId: string;
  activeTabId: string;
  onSelectTab: (tabId: string) => void;
  searchQuery: string;
  customTabs: CustomMailTab[];
  onOpenAddTabModal: () => void;
  composeTriggerCount: number;
  focusMessageId?: string | null;
  pendingFileAttachment?: WorkspaceFileItem | null;
  onClearPendingFile?: () => void;
}

const FOLDER_QUERIES: Record<string, string> = {
  inbox: 'in:inbox',
  starred: 'is:starred',
  sent: 'in:sent',
  drafts: 'in:drafts',
  all: 'in:anywhere',
};

export const GmailView: React.FC<GmailViewProps> = ({
  isAuthenticated,
  accounts = [],
  activeAccountEmail,
  onSelectFolder,
  onAccountsChanged,
  onRequireAuth,
  onOpenBulkStudio,
  onSwitchToServerMail,
  activeFolderId,
  activeTabId,
  onSelectTab,
  searchQuery,
  customTabs,
  onOpenAddTabModal,
  composeTriggerCount,
  focusMessageId,
  pendingFileAttachment,
  onClearPendingFile,
}) => {
  const [messages, setMessages] = useState<ParsedEmail[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<ParsedEmail | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [splitView, setSplitView] = useState<boolean>(false);
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState<boolean>(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const knownMessageIdsRef = useRef<Set<string>>(new Set());

  // Standalone Gmail Account Credential Setup State (IMAP/SMTP + App Password / Secret Key)
  const [cfgLabel, setCfgLabel] = useState<string>('');
  const [cfgEmail, setCfgEmail] = useState<string>('');
  const [cfgPassword, setCfgPassword] = useState<string>('');
  const [cfgImapHost, setCfgImapHost] = useState<string>('imap.gmail.com');
  const [cfgImapPort, setCfgImapPort] = useState<number>(993);
  const [cfgSmtpHost, setCfgSmtpHost] = useState<string>('smtp.gmail.com');
  const [cfgSmtpPort, setCfgSmtpPort] = useState<number>(465);
  const [isVerifyingGmail, setIsVerifyingGmail] = useState<boolean>(false);
  const [isSavingGmail, setIsSavingGmail] = useState<boolean>(false);
  const [gmailVerifyResult, setGmailVerifyResult] = useState<{
    ok: boolean;
    imapMessage: string;
    smtpMessage: string;
  } | null>(null);

  // Compose state (Supports Single & Inline Bulk Mail + 1-Char Member Autocomplete + File Manager Attachments)
  const [isComposeOpen, setIsComposeOpen] = useState<boolean>(false);
  const [composeMode, setComposeMode] = useState<'single' | 'bulk'>('single');
  const [composeTo, setComposeTo] = useState<string>('');
  const [isToFocused, setIsToFocused] = useState<boolean>(false);
  const [composeCc, setComposeCc] = useState<string>('');
  const [composeSubject, setComposeSubject] = useState<string>('');
  const [composeBody, setComposeBody] = useState<string>('');
  const [attachedServerFiles, setAttachedServerFiles] = useState<WorkspaceFileItem[]>([]);
  const [isFilePickerOpen, setIsFilePickerOpen] = useState<boolean>(false);
  const [editingAttachImage, setEditingAttachImage] = useState<{
    fileId: string;
    target: ImageEditorTarget;
  } | null>(null);
  const [replyThreadId, setReplyThreadId] = useState<string | undefined>(undefined);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [sendSuccessBanner, setSendSuccessBanner] = useState<string | null>(null);

  // Universal In-App Engine (Slides, PDFs, Docs) + Server File Manager Sync State
  const [serverFiles, setServerFiles] = useState<WorkspaceFileItem[]>([]);
  const [slideDecks, setSlideDecks] = useState<WorkspaceSlideDeck[]>([]);
  const [workspaceDocs, setWorkspaceDocs] = useState<WorkspaceDocItem[]>([]);
  const [engineTarget, setEngineTarget] = useState<UniversalEngineTarget | null>(null);
  const [savingToDocsId, setSavingToDocsId] = useState<string | null>(null);

  const handleTestGmailConfig = async () => {
    if (!cfgEmail.trim() || !cfgPassword.trim()) {
      setErrorMsg('Please enter your Gmail address and App Password / Secret Key.');
      return;
    }
    setIsVerifyingGmail(true);
    setErrorMsg(null);
    setGmailVerifyResult(null);
    try {
      const res = await verifyGmailConnectionOnServer({
        email: cfgEmail.trim(),
        username: cfgEmail.trim(),
        password: cfgPassword.trim(),
        imapHost: cfgImapHost.trim() || 'imap.gmail.com',
        imapPort: Number(cfgImapPort) || 993,
        imapSecure: true,
        smtpHost: cfgSmtpHost.trim() || 'smtp.gmail.com',
        smtpPort: Number(cfgSmtpPort) || 465,
        smtpSecure: true,
      });
      setGmailVerifyResult(res);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to verify Gmail connection.');
    } finally {
      setIsVerifyingGmail(false);
    }
  };

  const handleSaveGmailAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cfgEmail.trim() || !cfgPassword.trim()) {
      setErrorMsg('Gmail address and App Password / Secret Key are required.');
      return;
    }
    setIsSavingGmail(true);
    setErrorMsg(null);
    try {
      const { account, accounts: allUpdated } = await saveGmailAccountOnServer({
        label: cfgLabel.trim() || cfgEmail.split('@')[0],
        email: cfgEmail.trim(),
        username: cfgEmail.trim(),
        password: cfgPassword.trim(),
        imapHost: cfgImapHost.trim() || 'imap.gmail.com',
        imapPort: Number(cfgImapPort) || 993,
        imapSecure: true,
        smtpHost: cfgSmtpHost.trim() || 'smtp.gmail.com',
        smtpPort: Number(cfgSmtpPort) || 465,
        smtpSecure: true,
      });
      onAccountsChanged?.(allUpdated, account.email);
      setCfgLabel('');
      setCfgEmail('');
      setCfgPassword('');
      setGmailVerifyResult(null);
      setSendSuccessBanner(`Connected Gmail account ${account.email}`);
      setTimeout(() => setSendSuccessBanner(null), 4000);
      onSelectFolder?.('inbox');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save Gmail account.');
    } finally {
      setIsSavingGmail(false);
    }
  };

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

  useEffect(() => {
    if (composeTriggerCount > 0) {
      handleOpenCompose();
    }
  }, [composeTriggerCount]);

  useEffect(() => {
    if (pendingFileAttachment) {
      setIsComposeOpen(true);
      setAttachedServerFiles((prev) =>
        prev.some((f) => f.id === pendingFileAttachment.id)
          ? prev
          : [...prev, pendingFileAttachment]
      );
      onClearPendingFile?.();
    }
  }, [pendingFileAttachment]);

  useEffect(() => {
    setSelectedMessage(null);
  }, [activeFolderId, activeTabId]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setIsMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const effectiveQuery = useMemo(() => {
    if (searchQuery.trim()) {
      return searchQuery.trim();
    }
    if (activeFolderId !== 'inbox') {
      return FOLDER_QUERIES[activeFolderId] || 'in:inbox';
    }
    if (activeTabId === 'primary') return 'in:inbox category:primary';
    if (activeTabId === 'promotions') return 'in:inbox category:promotions';
    if (activeTabId === 'updates') return 'in:inbox category:updates';

    const custom = customTabs.find((t) => t.id === activeTabId);
    if (custom) return custom.query;
    return 'in:inbox';
  }, [activeFolderId, activeTabId, searchQuery, customTabs]);

  const loadEmails = async (forceRefresh = false, silent = false) => {
    if (!isAuthenticated) return;

    const cached = getCachedMessages(effectiveQuery, 25);
    if (cached && !forceRefresh) {
      setMessages(cached);
      const initialStars = new Set<string>();
      cached.forEach((m) => {
        knownMessageIdsRef.current.add(m.id);
        if (m.isStarred) initialStars.add(m.id);
      });
      setStarredIds((prev) => new Set([...prev, ...initialStars]));
      return;
    }

    // Never show any spinner during automatic silent real-time checks
    if (!silent) {
      setIsLoading(cached === null);
      setIsSyncing(true);
    }
    setErrorMsg(null);

    try {
      const fetched = await fetchGmailMessages(effectiveQuery, 25, forceRefresh);

      // Detect newly arrived emails during silent check & emit real-time notification
      if (silent && knownMessageIdsRef.current.size > 0 && activeFolderId === 'inbox') {
        const newArrivals = fetched.filter((m) => !knownMessageIdsRef.current.has(m.id));
        for (const arrived of newArrivals) {
          createNotification({
            type: 'gmail_received',
            title: `New Gmail from ${arrived.fromName}`,
            description: `${arrived.subject} — ${arrived.snippet.slice(0, 80)}`,
            module: 'gmail',
            targetId: arrived.id,
          }).catch(() => {});
        }
      }

      fetched.forEach((m) => knownMessageIdsRef.current.add(m.id));
      setMessages(fetched);

      const stars = new Set<string>();
      fetched.forEach((m) => {
        if (m.isStarred) stars.add(m.id);
      });
      setStarredIds((prev) => new Set([...prev, ...stars]));
    } catch (err: any) {
      if (!silent) {
        if (err?.message === 'AUTH_REQUIRED') {
          onRequireAuth();
        } else {
          setErrorMsg(err?.message || 'Unable to load emails.');
        }
      }
    } finally {
      if (!silent) {
        setIsLoading(false);
        setIsSyncing(false);
      }
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadEmails(false, false);
    }
  }, [isAuthenticated, effectiveQuery]);

  // Open specific message when user clicks a notification in the Bell menu
  useEffect(() => {
    if (!focusMessageId) return;
    const found = messages.find((m) => m.id === focusMessageId);
    if (found) {
      found.isUnread = false;
      setSelectedMessage(found);
    }
  }, [focusMessageId, messages]);

  // Event-driven updates when new mail arrives (Zero background polling)
  useEffect(() => {
    if (!isAuthenticated || accounts.length === 0) return;
    const unsubscribe = subscribeWorkspaceEvents((eventName) => {
      if (eventName === 'mail:arrived' || eventName === 'cmh:admin_mail') {
        loadEmails(true, true);
      }
    });
    return unsubscribe;
  }, [isAuthenticated, accounts.length, effectiveQuery]);

  const toggleStar = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleOpenCompose = (prefill?: {
    to?: string;
    subject?: string;
    body?: string;
    threadId?: string;
  }) => {
    if (!isAuthenticated) {
      onRequireAuth();
      return;
    }
    setComposeTo(prefill?.to || '');
    setComposeCc('');
    setComposeSubject(prefill?.subject || '');
    setComposeBody(prefill?.body || '');
    setReplyThreadId(prefill?.threadId);
    setIsComposeOpen(true);
  };

  // Detect any attached/linked Slides, PDFs, or Documents in an email message
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

    // 1. Check /uploads/... URLs in message body
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

    // 2. Also check explicit filenames (.pdf, .slides, .pptx, .doc, .docx) mentioned in subject/body
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
      setSendSuccessBanner(`Saved "${res.file.name}" to File Manager → Documents`);
      setTimeout(() => setSendSuccessBanner(null), 4000);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save attachment to File Manager.');
    } finally {
      setSavingToDocsId(null);
    }
  };

  const handleDirectSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeTo.trim() || isSending) return;

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
    try {
      const attachmentsHtml =
        attachedServerFiles.length > 0
          ? `<div style="margin-top:16px;padding-top:12px;border-top:1px solid #e2e8f0;">
              <div style="font-size:12px;font-weight:600;color:#475569;margin-bottom:8px;">Attached Workspace Files:</div>
              ${attachedServerFiles
                .map((f) => {
                  const fullUrl = `${window.location.origin}${f.url}`;
                  return f.isImage
                    ? `<div style="margin-bottom:10px;"><a href="${fullUrl}" target="_blank" style="font-size:12px;color:#0B57D0;font-weight:600;">${f.name}</a><br/><img src="${fullUrl}" alt="${f.name}" style="max-width:420px;border-radius:8px;margin-top:4px;border:1px solid #e2e8f0;" /></div>`
                    : `<div style="margin-bottom:6px;"><a href="${fullUrl}" target="_blank" style="font-size:12px;color:#0B57D0;font-weight:600;">📎 ${f.name} (${formatBytes(f.compressedSizeBytes)})</a></div>`;
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
          .join('') + attachmentsHtml;

      for (const recipient of recipients) {
        await sendGmailMessage({
          to: recipient,
          cc: recipients.length === 1 ? composeCc : undefined,
          subject: composeSubject || '(No Subject)',
          bodyHtml: htmlBody,
          threadId: recipients.length === 1 ? replyThreadId : undefined,
        });
      }

      createNotification({
        type: 'mail_sent',
        title:
          recipients.length > 1
            ? `Bulk Gmail Sent (${recipients.length} recipients)`
            : `Gmail Sent to ${recipients[0]}`,
        description: `Subject: ${composeSubject || '(No Subject)'}`,
        module: 'gmail',
      }).catch(() => {});

      setIsComposeOpen(false);
      setComposeTo('');
      setComposeCc('');
      setComposeSubject('');
      setComposeBody('');
      setAttachedServerFiles([]);
      setSendSuccessBanner(
        recipients.length > 1
          ? `Bulk message sent to ${recipients.length} recipients`
          : `Message sent to ${recipients[0]}`
      );
      setTimeout(() => setSendSuccessBanner(null), 4000);
      loadEmails(true, true);
    } catch (err: any) {
      if (err?.message === 'AUTH_REQUIRED') {
        onRequireAuth();
      } else {
        setErrorMsg(err?.message || 'Failed to send email.');
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 md:rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
      {/* Clean Single Gmail Action & Category Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-200/80 dark:border-slate-800 shrink-0">
        {/* Left: Category Tabs (when in Inbox) or Current Folder Title */}
        <div className="flex items-center overflow-x-auto no-scrollbar">
          {activeFolderId === 'inbox' && !searchQuery.trim() ? (
            <>
              {[
                { id: 'primary', label: 'Primary' },
                { id: 'promotions', label: 'Promotions' },
                { id: 'updates', label: 'Updates' },
              ].map((cat) => {
                const active = activeTabId === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => onSelectTab(cat.id)}
                    className={`relative px-4 py-2.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'text-[#0B57D0] dark:text-blue-400'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg'
                    }`}
                  >
                    <span>{cat.label}</span>
                    {active && (
                      <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-[#0B57D0] dark:bg-blue-400 rounded-t-full" />
                    )}
                  </button>
                );
              })}

              {customTabs.map((tab) => {
                const active = activeTabId === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => onSelectTab(tab.id)}
                    className={`relative px-4 py-2.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'text-[#0B57D0] dark:text-blue-400'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg'
                    }`}
                  >
                    <span>{tab.name}</span>
                    {active && (
                      <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-[#0B57D0] dark:bg-blue-400 rounded-t-full" />
                    )}
                  </button>
                );
              })}
            </>
          ) : (
            <span className="px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 capitalize">
              {searchQuery.trim() ? `Search: "${searchQuery}"` : activeFolderId}
            </span>
          )}
        </div>

        {/* Right: Minimal Refresh + Clean Dropdown Menu for Extra Options */}
        <div className="flex items-center gap-1 shrink-0 pl-2">
          <button
            type="button"
            onClick={() => loadEmails(true, false)}
            disabled={!isAuthenticated || isSyncing}
            className="p-2 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Refresh mail"
            aria-label="Refresh mail"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-blue-600' : ''}`} />
          </button>

          {/* More Options Dropdown (⋮) */}
          <div className="relative" ref={moreMenuRef}>
            <button
              type="button"
              onClick={() => setIsMoreMenuOpen((prev) => !prev)}
              className="p-2 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="More view options"
              aria-label="More options"
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
                  <span>Reading Pane (Split View)</span>
                  <span className="font-semibold text-blue-600">{splitView ? 'On' : 'Off'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    onOpenAddTabModal();
                  }}
                  className="w-full text-left px-4 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  + Add Custom Filter Tab
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    onOpenBulkStudio();
                  }}
                  className="w-full text-left px-4 py-2 text-[#0B57D0] dark:text-blue-400 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 border-t border-slate-100 dark:border-slate-800"
                >
                  Open Bulk Mail Studio
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Subtle Toast Banners */}
      {sendSuccessBanner && (
        <div className="flex items-center justify-between px-4 py-2 bg-emerald-50 dark:bg-emerald-950/60 border-b border-emerald-200 text-xs font-medium text-emerald-800 dark:text-emerald-200">
          <span className="flex items-center gap-2">
            <Check className="w-4 h-4" />
            {sendSuccessBanner}
          </span>
          <button type="button" onClick={() => setSendSuccessBanner(null)}>
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

      {/* Main Inbox List / Reader Viewport */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Email List */}
        <div
          className={`${
            selectedMessage && !splitView
              ? 'hidden'
              : selectedMessage && splitView
              ? 'w-full md:w-[44%] border-r border-slate-200 dark:border-slate-800'
              : 'w-full'
          } flex flex-col overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/70`}
        >
          {!isAuthenticated ? (
            <div className="flex flex-col items-center justify-center flex-1 p-10 text-center">
              <Inbox className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3" />
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">
                Your Gmail Inbox is Blank
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-5">
                No Gmail account is connected yet. Add your Gmail account credentials from Settings → Accounts to sync your inbox.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={onRequireAuth}
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-[#0B57D0] rounded-full hover:bg-blue-700 transition-colors shadow-xs"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Go to Settings → Accounts</span>
                </button>
              </div>
            </div>
          ) : isLoading ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3 animate-pulse">
                  <div className="w-4 h-4 rounded bg-slate-200 dark:bg-slate-800 shrink-0" />
                  <div className="w-36 h-3.5 rounded bg-slate-200 dark:bg-slate-800 shrink-0" />
                  <div className="flex-1 h-3.5 rounded bg-slate-100 dark:bg-slate-800/60" />
                  <div className="w-14 h-3 rounded bg-slate-200 dark:bg-slate-800 shrink-0" />
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 p-12 text-center">
              <Inbox className="w-9 h-9 text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Your folder is empty
              </p>
              <p className="text-xs text-slate-500 mt-1">
                No messages matched "{effectiveQuery}".
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isSelected = selectedMessage?.id === msg.id;
              const isStarred = starredIds.has(msg.id);
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
                      ? 'bg-white dark:bg-slate-900 hover:shadow-xs hover:bg-slate-50/90 dark:hover:bg-slate-800/60'
                      : 'bg-[#F2F6FC]/65 dark:bg-slate-900/50 hover:bg-slate-100/80 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <button
                    type="button"
                    onClick={(e) => toggleStar(msg.id, e)}
                    className="text-slate-400 hover:text-amber-400 transition-colors shrink-0"
                    aria-label="Star email"
                  >
                    <Star
                      className={`w-4 h-4 ${
                        isStarred ? 'fill-amber-400 text-amber-400' : ''
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
                      <span className="mx-1.5 text-slate-400">—</span>
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

        {/* Thread Reader View */}
        {selectedMessage && (
          <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs z-10">
              <button
                type="button"
                onClick={() => setSelectedMessage(null)}
                className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    handleOpenCompose({
                      to: selectedMessage.fromEmail,
                      subject: selectedMessage.subject.startsWith('Re:')
                        ? selectedMessage.subject
                        : `Re: ${selectedMessage.subject}`,
                      threadId: selectedMessage.threadId,
                    })
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                >
                  <Reply className="w-3.5 h-3.5" />
                  <span>Reply</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleOpenCompose({
                      subject: `Fwd: ${selectedMessage.subject}`,
                      body: `\n\n---------- Forwarded message ---------\nFrom: ${selectedMessage.fromName} <${selectedMessage.fromEmail}>\nDate: ${selectedMessage.date}\nSubject: ${selectedMessage.subject}\n\n${selectedMessage.bodyText}`,
                    })
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                >
                  <CornerUpRight className="w-3.5 h-3.5" />
                  <span>Forward</span>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <h2 className="text-xl font-normal text-slate-900 dark:text-slate-100 leading-snug">
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
                      <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        &lt;{selectedMessage.fromEmail}&gt;
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      to {selectedMessage.to || 'me'}
                    </div>
                  </div>
                </div>

                <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap shrink-0">
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
                              title: selectedMessage.subject || 'Email Document',
                              bodyText: selectedMessage.bodyText,
                              mimeType: 'text/plain',
                              extension: 'doc',
                              initialMode: 'EDIT',
                              fromMailAttachment: true,
                            })
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:border-[#0B57D0] hover:text-[#0B57D0]"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Open / Edit Email in Doc Engine</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleSaveMailAttachmentToDocuments({
                              id: `email-doc-${selectedMessage.id}`,
                              name: `${selectedMessage.subject || 'Email_Note'}.doc`,
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
                            {savingToDocsId === `email-doc-${selectedMessage.id}`
                              ? 'Saving...'
                              : 'Save to File Manager'}
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
                                    ? 'Slides Presentation'
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
                  dangerouslySetInnerHTML={{ __html: selectedMessage.bodyHtml }}
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

      {/* Mobile Floating Compose Button */}
      <button
        type="button"
        onClick={() => handleOpenCompose()}
        className="md:hidden fixed bottom-16 right-4 z-20 flex items-center gap-2 px-4 py-3 rounded-2xl bg-[#C2E7FF] text-[#001D35] font-semibold text-sm shadow-md"
      >
        <PenSquare className="w-4 h-4" />
        <span>Compose</span>
      </button>

      {/* Gmail Floating Compose Box (Single & Inline Bulk Support, Instant Send without Confirmation Modal) */}
      {isComposeOpen && (
        <div className="fixed bottom-0 right-4 md:right-8 z-40 w-[calc(100vw-2rem)] sm:w-[480px] bg-white dark:bg-slate-900 rounded-t-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-[#F2F6FC] dark:bg-slate-800">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                New Message
              </span>
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
              className="p-1 text-slate-500 hover:text-slate-800 dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleDirectSend} className="p-4 space-y-2">
            <div className="relative">
              {composeMode === 'bulk' ? (
                <div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                    <span>To (Type 1 letter to search Members/Teams, or paste emails)</span>
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
                    onFocus={() => setIsToFocused(true)}
                    onBlur={() => setTimeout(() => setIsToFocused(false), 180)}
                    onChange={(e) => setComposeTo(e.target.value)}
                    placeholder="Type 1 letter for member/team search or enter emails..."
                    className="w-full p-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600 resize-none"
                  />
                </div>
              ) : (
                <input
                  type="text"
                  required
                  value={composeTo}
                  onFocus={() => setIsToFocused(true)}
                  onBlur={() => setTimeout(() => setIsToFocused(false), 180)}
                  onChange={(e) => setComposeTo(e.target.value)}
                  placeholder="To (Type 1 letter to search Members/Teams or enter email)"
                  className="w-full pb-2 text-sm border-b border-slate-200 dark:border-slate-800 bg-transparent text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
                />
              )}

              <MemberAutocompleteDropdown
                inputValue={composeTo}
                isFocused={isToFocused}
                onSelectEmails={(nextVal) => setComposeTo(nextVal)}
              />
            </div>

            {composeMode === 'single' && (
              <input
                type="text"
                value={composeCc}
                onChange={(e) => setComposeCc(e.target.value)}
                placeholder="Cc"
                className="w-full pb-2 text-xs border-b border-slate-200 dark:border-slate-800 bg-transparent text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
              />
            )}

            <input
              type="text"
              required
              value={composeSubject}
              onChange={(e) => setComposeSubject(e.target.value)}
              placeholder="Subject"
              className="w-full pb-2 text-sm border-b border-slate-200 dark:border-slate-800 bg-transparent text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
            />
            <textarea
              rows={5}
              required
              value={composeBody}
              onChange={(e) => setComposeBody(e.target.value)}
              placeholder="Compose email..."
              className="w-full pt-2 text-sm bg-transparent text-slate-900 dark:text-slate-100 focus:outline-none resize-none"
            />

            {/* Attached Files from Server File Manager */}
            {attachedServerFiles.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {attachedServerFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-[11px] font-medium text-[#0B57D0] dark:text-blue-300"
                  >
                    {file.isImage ? (
                      <ImageIcon className="w-3 h-3 shrink-0" />
                    ) : (
                      <Paperclip className="w-3 h-3 shrink-0" />
                    )}
                    <span className="truncate max-w-[140px]">{file.name}</span>
                    {file.isImage && (
                      <button
                        type="button"
                        onClick={() =>
                          setEditingAttachImage({
                            fileId: file.id,
                            target: { title: file.name, imageUrl: file.url, fileId: file.id },
                          })
                        }
                        title="Edit / Compress Image before sending"
                        className="px-1.5 py-0.5 rounded bg-purple-600 text-white text-[9px] font-bold cursor-pointer"
                      >
                        Edit
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setAttachedServerFiles((prev) => prev.filter((f) => f.id !== file.id))
                      }
                      className="text-slate-400 hover:text-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
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
                    {isSending
                      ? 'Sending...'
                      : composeMode === 'bulk'
                      ? 'Send Bulk Mail'
                      : 'Send'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsFilePickerOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium"
                  title="Attach photo or file from Server File Manager"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-[#0B57D0]" />
                  <span>File Manager</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsComposeOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600"
                title="Discard draft"
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
          setAttachedServerFiles((prev) =>
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
                setAttachedServerFiles((prev) =>
                  prev.map((f) => (f.id === editingAttachImage.fileId ? res.file! : f))
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
