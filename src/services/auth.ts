/**
 * Standalone Credential-Based Gmail Account Manager (Prisma + PostgreSQL Backend)
 * Stores and manages Gmail accounts via PostgreSQL (/api/gmail/accounts).
 */

import { wsFetch as fetch } from './sessionFetch';

export interface WorkspaceUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export interface ConnectedGmailAccount {
  id: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  accessToken: string;
  expiresAt: number;
  imapHost?: string;
  imapPort?: number;
  imapSecure?: boolean;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  authMode?: 'app_password' | 'oauth_secret';
  clientId?: string;
  passwordHashPreview?: string;
  lastVerifiedAt?: string;
  role?: string;
  isSystemPrimary?: boolean;
}

export interface WorkspaceAuthState {
  isAuthenticated: boolean;
  userEmail: string | null;
  displayName: string | null;
  photoURL: string | null;
  activeAccount: ConnectedGmailAccount | null;
  accounts: ConnectedGmailAccount[];
}

let accountsList: ConnectedGmailAccount[] = [];
let activeEmail: string | null = null;
const authListeners = new Set<() => void>();

function notifyListeners() {
  authListeners.forEach((listener) => listener());
}

export function subscribeToAuthState(listener: () => void): () => void {
  authListeners.add(listener);
  return () => {
    authListeners.delete(listener);
  };
}

export function initAuth(
  callback: (
    user: WorkspaceUser | null,
    accessToken: string | null,
    allAccounts: ConnectedGmailAccount[]
  ) => void
): () => void {
  const emit = () => {
    const state = getAuthState();
    const user: WorkspaceUser | null = state.activeAccount
      ? {
          uid: state.activeAccount.id,
          email: state.activeAccount.email,
          displayName: state.activeAccount.displayName,
          photoURL: state.activeAccount.photoURL,
        }
      : null;
    callback(user, state.activeAccount?.accessToken || null, state.accounts);
  };

  const unsubscribe = subscribeToAuthState(emit);
  loadGmailAccountsFromServer().then(() => {
    emit();
  });
  return unsubscribe;
}

export function getAuthState(): WorkspaceAuthState {
  const active =
    accountsList.find((a) => a.email === activeEmail) || accountsList[0] || null;

  if (active && activeEmail !== active.email) {
    activeEmail = active.email;
  }

  return {
    isAuthenticated: Boolean(active),
    userEmail: active?.email || null,
    displayName: active?.displayName || null,
    photoURL: active?.photoURL || null,
    activeAccount: active,
    accounts: [...accountsList],
  };
}

export function getConnectedGmailAccounts(): ConnectedGmailAccount[] {
  return [...accountsList];
}

export function getActiveGmailEmail(): string | null {
  const state = getAuthState();
  return state.userEmail;
}

export function getActiveGmailAccountId(): string | null {
  const state = getAuthState();
  return state.activeAccount?.id || null;
}

export function switchActiveGmailAccount(email: string): ConnectedGmailAccount | null {
  const exists = accountsList.find((a) => a.email.toLowerCase() === email.toLowerCase());
  if (exists) {
    activeEmail = exists.email;
    notifyListeners();
    return exists;
  }
  return null;
}

export async function loadGmailAccountsFromServer(): Promise<ConnectedGmailAccount[]> {
  try {
    const res = await fetch('/api/gmail/accounts');
    if (!res.ok) return accountsList;
    const data = await res.json();
    const rawList: any[] = data.accounts || [];
    accountsList = rawList.map((acc) => ({
      id: acc.id,
      email: acc.email,
      displayName: acc.label || acc.email.split('@')[0],
      photoURL: null,
      accessToken: `server-managed:${acc.id}`,
      expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
      imapHost: acc.imapHost || 'imap.gmail.com',
      imapPort: acc.imapPort || 993,
      imapSecure: acc.imapSecure !== false,
      smtpHost: acc.smtpHost || 'smtp.gmail.com',
      smtpPort: acc.smtpPort || 465,
      smtpSecure: acc.smtpSecure !== false,
      authMode: acc.authMode || 'app_password',
      clientId: acc.clientId || '',
      passwordHashPreview: acc.passwordHashPreview || '',
      lastVerifiedAt: acc.lastVerifiedAt,
    }));
    if (accountsList.length > 0 && !accountsList.some((a) => a.email === activeEmail)) {
      activeEmail = accountsList[0].email;
    } else if (accountsList.length === 0) {
      activeEmail = null;
    }
    notifyListeners();
    return accountsList;
  } catch {
    return accountsList;
  }
}

export async function saveGmailAccountOnServer(payload: {
  id?: string;
  label: string;
  email: string;
  username?: string;
  password?: string;
  authMode?: 'app_password' | 'oauth_secret';
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  imapHost?: string;
  imapPort?: number;
  imapSecure?: boolean;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
}): Promise<{ account: ConnectedGmailAccount; accounts: ConnectedGmailAccount[] }> {
  const res = await fetch('/api/gmail/accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to save Gmail account.');
  }
  const updatedList = await loadGmailAccountsFromServer();
  if (data.account?.email) {
    activeEmail = data.account.email;
    notifyListeners();
  }
  const saved = updatedList.find((a) => a.email === data.account?.email) || updatedList[0];
  return {
    account: saved,
    accounts: updatedList,
  };
}

export async function verifyGmailConnectionOnServer(payload: {
  accountId?: string;
  email: string;
  username?: string;
  password?: string;
  imapHost?: string;
  imapPort?: number;
  imapSecure?: boolean;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
}): Promise<{
  ok: boolean;
  imapOk: boolean;
  imapMessage: string;
  smtpOk: boolean;
  smtpMessage: string;
}> {
  const res = await fetch('/api/gmail/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Gmail connection verification failed.');
  }
  return data;
}

export async function removeGmailAccount(idOrEmail: string): Promise<ConnectedGmailAccount[]> {
  const target = accountsList.find(
    (a) => a.id === idOrEmail || a.email.toLowerCase() === idOrEmail.toLowerCase()
  );
  if (target) {
    await fetch(`/api/gmail/accounts/${encodeURIComponent(target.id)}`, {
      method: 'DELETE',
    });
  }
  return await loadGmailAccountsFromServer();
}

export async function signOutWorkspace(): Promise<void> {
  if (activeEmail) {
    await removeGmailAccount(activeEmail);
  }
}

export const logout = signOutWorkspace;

export async function getAccessToken(): Promise<string | null> {
  const state = getAuthState();
  return state.activeAccount?.accessToken || null;
}
