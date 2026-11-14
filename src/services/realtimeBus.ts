import { getStoredSessionToken } from './sessionFetch';
import { clearNavigationCache } from './navigationCache';

type WorkspaceEventHandler = (eventName: string, payload: any) => void;

const listeners = new Set<WorkspaceEventHandler>();
let eventSource: EventSource | null = null;
let broadcastChannel: BroadcastChannel | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function notifyListeners(eventName: string, payload: any) {
  if (eventName !== 'connected') clearNavigationCache();
  for (const handler of Array.from(listeners)) {
    try {
      handler(eventName, payload);
    } catch (err) {
      console.error('[RealtimeBus] Listener error:', err);
    }
  }
}

function ensureBroadcastChannel() {
  if (broadcastChannel || typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    return;
  }
  try {
    broadcastChannel = new BroadcastChannel('workspace_live_bus_v1');
    broadcastChannel.onmessage = (event) => {
      if (event?.data?.event) {
        notifyListeners(event.data.event, event.data.payload);
      }
    };
  } catch {
    // Ignore environments where BroadcastChannel is restricted
  }
}

export function connectRealtimeBus() {
  if (typeof window === 'undefined') return;
  ensureBroadcastChannel();

  if (eventSource && eventSource.readyState !== EventSource.CLOSED) {
    return;
  }

  const token = getStoredSessionToken();
  const params = new URLSearchParams();
  if (token) params.set('ws_token', token);
  const qs = params.toString();
  const streamUrl = qs ? `/api/realtime/stream?${qs}` : '/api/realtime/stream';

  try {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }

    const es = new EventSource(streamUrl, { withCredentials: true });
    eventSource = es;

    es.onmessage = (msg) => {
      try {
        const parsed = JSON.parse(msg.data);
        if (parsed && parsed.event && parsed.event !== 'connected') {
          notifyListeners(parsed.event, parsed.payload);
        }
      } catch {
        // Ignore non-JSON comments/heartbeats
      }
    };

    es.onerror = () => {
      es.close();
      if (eventSource === es) {
        eventSource = null;
      }
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => {
        if (listeners.size > 0) {
          connectRealtimeBus();
        }
      }, 2500);
    };
  } catch {
    // Ignore connection initialization error
  }
}

export function reconnectRealtimeBus() {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  if (listeners.size > 0) {
    connectRealtimeBus();
  }
}

export function emitLocalWorkspaceEvent(eventName: string, payload: any = {}) {
  notifyListeners(eventName, payload);
  ensureBroadcastChannel();
  try {
    broadcastChannel?.postMessage({ event: eventName, payload, ts: Date.now() });
  } catch {
    // Ignore broadcast channel errors
  }
}

export function subscribeWorkspaceEvents(handler: WorkspaceEventHandler): () => void {
  listeners.add(handler);
  connectRealtimeBus();
  return () => {
    listeners.delete(handler);
  };
}
