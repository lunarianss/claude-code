/**
 * Dev proxy bridge — connects to ws://localhost:5174 when no Electron IPC.
 * Installs window.claudeCodex backed by WebSocket.
 *
 * This module runs synchronously at import time so the API is available
 * before any React component mounts.
 */

const WS_URL = 'ws://localhost:5174';

type Listener = (data: any) => void;
type Channel = string;

const listeners = new Map<Channel, Set<Listener>>();
let ws: WebSocket | null = null;
let connected = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function connect() {
  if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) return;

  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    connected = true;
    console.log('[devProxy] Connected');
  };

  ws.onmessage = (event) => {
    let msg: any;
    try {
      msg = JSON.parse(event.data);
    } catch {
      return;
    }
    const channel: Channel = msg.type;
    const data = msg.data;
    const fns = listeners.get(channel);
    if (fns) {
      for (const fn of fns) {
        try { fn(data); } catch (e) { console.error('[devProxy] listener error', e); }
      }
    }
  };

  ws.onclose = () => {
    connected = false;
    console.log('[devProxy] Disconnected');
    // Reconnect after 2s
    reconnectTimer = setTimeout(connect, 2000);
  };

  ws.onerror = () => {
    // onclose will fire after this
  };
}

function onChannel<T>(channel: Channel, callback: (data: T) => void): () => void {
  if (!listeners.has(channel)) {
    listeners.set(channel, new Set());
  }
  listeners.get(channel)!.add(callback as Listener);
  return () => {
    listeners.get(channel)?.delete(callback as Listener);
  };
}

function sendJson(data: object) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  } else {
    console.warn('[devProxy] WebSocket not connected, message dropped');
  }
}

// Install immediately if no Electron preload
export function initDevProxy() {
  if ((window as any).claudeCodex) {
    // Already have Electron IPC, skip
    return;
  }

  console.log('[devProxy] No Electron IPC detected, connecting to dev proxy...');
  connect();

  (window as any).claudeCodex = {
    app: {
      getVersion: async () => '0.1.0-dev',
      getCwd: async () => '.',
    },
    query: {
      send: async (message: string) => {
        sendJson({ type: 'query:send', message });
      },
      cancel: () => {
        sendJson({ type: 'query:cancel' });
      },
      onStreamChunk: (cb: Listener) => onChannel('query:stream-chunk', cb),
      onToolCall: (cb: Listener) => onChannel('query:tool-call', cb),
      onToolResult: (cb: Listener) => onChannel('query:tool-result', cb),
      onToolProgress: (cb: Listener) => onChannel('query:tool-progress', cb),
      onResult: (cb: Listener) => onChannel('query:result', cb),
      onError: (cb: Listener) => onChannel('query:error', cb),
      onSystem: (cb: Listener) => onChannel('query:system', cb),
      onEvent: (cb: Listener) => onChannel('query:event', cb),
    },
    permissions: {
      respond: (requestId: string, approved: boolean) => {
        sendJson({ type: 'permissions:respond', requestId, approved });
      },
    },
  };
}

export function cleanupDevProxy() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (ws) ws.close();
  ws = null;
  listeners.clear();
}

// No-op hook for backwards compat
export function useDevProxy() {
  // Initialization happens at module level via initDevProxy()
}
