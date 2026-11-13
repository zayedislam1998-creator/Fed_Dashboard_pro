export const SESSION_STORAGE_KEY = 'ws_session_token';

const nativeFetch: typeof fetch =
  typeof window !== 'undefined' && typeof window.fetch === 'function'
    ? window.fetch.bind(window)
    : fetch;

// Pure in-memory session token for active tab headers; reload persistence uses HttpOnly cookies.
// Zero browser localStorage / sessionStorage caching.
let inMemorySessionToken = '';
let legacyStorageCleaned = false;

function purgeLegacyBrowserCacheKeys(): void {
  if (legacyStorageCleaned || typeof window === 'undefined') return;
  legacyStorageCleaned = true;
  try {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    window.localStorage.removeItem('ws_session_token_v1');
    window.localStorage.removeItem('ws_saved_watermark_preset');
    window.localStorage.removeItem('ws_finance_brand_logo');
  } catch {
    // ignore storage restrictions
  }
}

export function getStoredSessionToken(): string {
  purgeLegacyBrowserCacheKeys();
  return inMemorySessionToken;
}

export function setStoredSessionToken(token: string | null): void {
  purgeLegacyBrowserCacheKeys();
  if (token && token.trim().length > 0) {
    inMemorySessionToken = token.trim();
  } else {
    inMemorySessionToken = '';
  }
}

export async function wsFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  purgeLegacyBrowserCacheKeys();

  const urlStr =
    typeof input === 'string'
      ? input
      : input instanceof URL
      ? input.toString()
      : input?.url || '';

  const isLocalApi =
    typeof window !== 'undefined' &&
    (urlStr.startsWith('/api/') ||
      urlStr.startsWith('/uploads/') ||
      urlStr.startsWith(`${window.location.origin}/api/`) ||
      urlStr.startsWith(`${window.location.origin}/uploads/`));

  let nextInit = init;
  if (isLocalApi) {
    const storedToken = getStoredSessionToken();
    const headers = new Headers(
      init?.headers || (input instanceof Request ? input.headers : undefined)
    );
    if (storedToken && !headers.has('x-workspace-session')) {
      headers.set('x-workspace-session', storedToken);
    }
    nextInit = {
      credentials: 'include',
      cache: 'no-store',
      ...init,
      headers,
    };
  }

  const response = await nativeFetch(input, nextInit);

  if (isLocalApi) {
    const newToken = response.headers.get('X-Workspace-Session-Token');
    if (newToken !== null) {
      setStoredSessionToken(newToken);
    }
    if (urlStr.includes('/api/auth/logout') && response.ok) {
      setStoredSessionToken(null);
    }
  }

  return response;
}

/**
 * Safely attempts to install the session-aware fetch interceptor on window
 * without throwing if window.fetch is defined as a getter-only property.
 */
export function installPersistentSessionFetchInterceptor(): void {
  purgeLegacyBrowserCacheKeys();
  if (typeof window === 'undefined' || (window as any).__wsFetchInstalled) return;
  (window as any).__wsFetchInstalled = true;

  try {
    const descriptor =
      Object.getOwnPropertyDescriptor(window, 'fetch') ||
      Object.getOwnPropertyDescriptor(Object.getPrototypeOf(window), 'fetch');

    if (!descriptor || descriptor.writable) {
      window.fetch = wsFetch;
    } else if (descriptor.configurable) {
      Object.defineProperty(window, 'fetch', {
        value: wsFetch,
        configurable: true,
        writable: true,
      });
    }
  } catch {
    // Environment restricts overriding window.fetch; service modules use wsFetch directly.
  }
}
