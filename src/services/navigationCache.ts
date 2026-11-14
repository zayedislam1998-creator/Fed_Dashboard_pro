// Bounded, tab-local snapshots. Never persisted to browser storage.
const FRESH_MS = 300_000; // 5 minutes — dashboard data is stable; avoids thrashing on navigation
const MAX_ENTRIES = 64;
const MAX_BODY_CHARS = 500_000;
const MAX_TOTAL_CHARS = 5_000_000;
type Snapshot = { body: string; headers: [string, string][]; status: number; expiresAt: number };
const snapshots = new Map<string, Snapshot>();
const pending = new Map<string, Promise<Response>>();
let generation = 0;
let totalChars = 0;

export function clearNavigationCache(): void {
  generation++;
  snapshots.clear();
  pending.clear();
  totalChars = 0;
}

function snapshotResponse(snapshot: Snapshot): Response {
  return new Response(snapshot.body, { status: snapshot.status, headers: snapshot.headers });
}

export function readNavigationData<T>(key: string): T | undefined {
  const snapshot = snapshots.get(key);
  // Previously visited views can paint their last snapshot while an expired query revalidates.
  if (!snapshot || snapshot.expiresAt + 270_000 <= Date.now()) return undefined;
  try { return JSON.parse(snapshot.body) as T; } catch { return undefined; }
}

export async function fetchNavigationData(
  key: string,
  load: () => Promise<Response>,
  refresh = false,
  signal?: AbortSignal | null
): Promise<Response> {
  if (signal?.aborted) throw signal.reason || new DOMException('Request cancelled', 'AbortError');
  const snapshot = snapshots.get(key);
  if (!refresh && snapshot && snapshot.expiresAt > Date.now()) return snapshotResponse(snapshot);
  const existing = pending.get(key);
  if (!refresh && existing) return observeResponse(existing, signal);

  const startedAtGeneration = generation;
  const request = load().then(async response => {
    if (response.status === 401 || response.status === 403) clearNavigationCache();
    if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
      const body = await response.clone().text();
      if (generation === startedAtGeneration && pending.get(key) === request && body.length <= MAX_BODY_CHARS) {
        const previous = snapshots.get(key);
        if (previous) { totalChars -= previous.body.length; snapshots.delete(key); }
        while (snapshots.size && (snapshots.size >= MAX_ENTRIES || totalChars + body.length > MAX_TOTAL_CHARS)) {
          const oldest = snapshots.keys().next().value!;
          totalChars -= snapshots.get(oldest)!.body.length;
          snapshots.delete(oldest);
        }
        snapshots.set(key, { body, status: response.status, headers: Array.from(response.headers.entries()), expiresAt: Date.now() + FRESH_MS });
        totalChars += body.length;
      }
    }
    return response;
  });
  pending.set(key, request);
  void request.finally(() => { if (pending.get(key) === request) pending.delete(key); }).catch(() => {});
  return observeResponse(request, signal);
}

function observeResponse(request: Promise<Response>, signal?: AbortSignal | null): Promise<Response> {
  if (!signal) return request.then(response => response.clone());
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason || new DOMException('Request cancelled', 'AbortError'));
    signal.addEventListener('abort', abort, { once: true });
    request.then(response => {
      signal.removeEventListener('abort', abort);
      resolve(response.clone());
    }, error => {
      signal.removeEventListener('abort', abort);
      reject(error);
    });
  });
}
