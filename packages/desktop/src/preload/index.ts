import { contextBridge, ipcRenderer } from 'electron';

export interface ClaudeCodexAPI {
  app: {
    getVersion(): Promise<string>;
    getCwd(): Promise<string>;
  };
  query: {
    send(message: string): Promise<void>;
    cancel(): void;
    onStreamChunk(callback: (chunk: { text: string; done: boolean }) => void): () => void;
    onToolCall(callback: (toolCall: { id: string; name: string; input: unknown; status: string }) => void): () => void;
    onToolResult(callback: (result: { toolUseId: string; result: string }) => void): () => void;
    onToolProgress(callback: (progress: { toolName: string; toolUseId: string; elapsed: number }) => void): () => void;
    onResult(callback: (result: { subtype: string; result?: string; costUSD?: number; inputTokens?: number; outputTokens?: number }) => void): () => void;
    onError(callback: (error: { message?: string; stderr?: string; code?: number }) => void): () => void;
    onSystem(callback: (data: { subtype: string; model?: string; sessionId?: string }) => void): () => void;
    onEvent(callback: (event: unknown) => void): () => void;
  };
  permissions: {
    respond(requestId: string, approved: boolean): void;
  };
}

function onChannel<T>(channel: string, callback: (data: T) => void): () => void {
  const handler = (_: unknown, data: T) => callback(data);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

const api: ClaudeCodexAPI = {
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    getCwd: () => ipcRenderer.invoke('app:getCwd'),
  },
  query: {
    send: (message: string) => ipcRenderer.invoke('query:send', message),
    cancel: () => ipcRenderer.send('query:cancel'),
    onStreamChunk: (cb) => onChannel('query:stream-chunk', cb),
    onToolCall: (cb) => onChannel('query:tool-call', cb),
    onToolResult: (cb) => onChannel('query:tool-result', cb),
    onToolProgress: (cb) => onChannel('query:tool-progress', cb),
    onResult: (cb) => onChannel('query:result', cb),
    onError: (cb) => onChannel('query:error', cb),
    onSystem: (cb) => onChannel('query:system', cb),
    onEvent: (cb) => onChannel('query:event', cb),
  },
  permissions: {
    respond: (requestId: string, approved: boolean) => {
      ipcRenderer.send('permissions:respond', requestId, approved);
    },
  },
};

contextBridge.exposeInMainWorld('claudeCodex', api);
