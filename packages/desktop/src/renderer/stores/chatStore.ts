import { create } from 'zustand';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  toolCalls?: ToolCallInfo[];
}

export interface ToolCallInfo {
  id: string;
  name: string;
  input: unknown;
  status: 'running' | 'done' | 'error';
  result?: string;
  startTime?: number;
}

export interface PermissionRequest {
  id: string;
  tool: string;
  description: string;
}

interface ChatStore {
  messages: ChatMessage[];
  isStreaming: boolean;
  // Accumulated text from all assistant messages in the current turn
  turnTextChunks: string[];
  // All tool calls across the entire multi-turn query
  turnToolCalls: ToolCallInfo[];
  pendingPermissions: PermissionRequest[];
  tokenUsage: { input: number; output: number };
  cost: number;
  model: string | null;
  error: string | null;

  addMessage: (msg: ChatMessage) => void;
  setStreaming: (v: boolean) => void;
  appendTurnText: (text: string) => void;
  addToolCall: (tc: ToolCallInfo) => void;
  updateToolCall: (id: string, update: Partial<ToolCallInfo>) => void;
  finalizeTurn: () => void;
  addPermissionRequest: (req: PermissionRequest) => void;
  removePermissionRequest: (id: string) => void;
  setTokenUsage: (input: number, output: number) => void;
  setCost: (cost: number) => void;
  setModel: (model: string) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  isStreaming: false,
  turnTextChunks: [],
  turnToolCalls: [],
  pendingPermissions: [],
  tokenUsage: { input: 0, output: 0 },
  cost: 0,
  model: null,
  error: null,

  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),

  setStreaming: (isStreaming) => set({ isStreaming }),

  appendTurnText: (text) =>
    set((s) => ({ turnTextChunks: [...s.turnTextChunks, text] })),

  addToolCall: (tc) =>
    set((s) => ({ turnToolCalls: [...s.turnToolCalls, tc] })),

  updateToolCall: (id, update) =>
    set((s) => ({
      turnToolCalls: s.turnToolCalls.map((tc) =>
        tc.id === id ? { ...tc, ...update } : tc
      ),
    })),

  finalizeTurn: () => {
    const { turnTextChunks, turnToolCalls } = get();
    const content = turnTextChunks.join('');
    if (content || turnToolCalls.length > 0) {
      // Mark any still-running tools as done (orphaned)
      const finalizedTools = turnToolCalls.map((tc) =>
        tc.status === 'running' ? { ...tc, status: 'done' as const } : tc
      );
      set((s) => ({
        messages: [
          ...s.messages,
          {
            id: Date.now().toString(),
            role: 'assistant' as const,
            content,
            timestamp: Date.now(),
            toolCalls: finalizedTools.length > 0 ? finalizedTools : undefined,
          },
        ],
        turnTextChunks: [],
        turnToolCalls: [],
        isStreaming: false,
      }));
    } else {
      set({ isStreaming: false, turnTextChunks: [], turnToolCalls: [] });
    }
  },

  addPermissionRequest: (req) =>
    set((s) => ({ pendingPermissions: [...s.pendingPermissions, req] })),
  removePermissionRequest: (id) =>
    set((s) => ({ pendingPermissions: s.pendingPermissions.filter((p) => p.id !== id) })),

  setTokenUsage: (input, output) => set({ tokenUsage: { input, output } }),
  setCost: (cost) => set({ cost }),
  setModel: (model) => set({ model }),
  setError: (error) => set({ error }),

  reset: () =>
    set({
      messages: [],
      isStreaming: false,
      turnTextChunks: [],
      turnToolCalls: [],
      pendingPermissions: [],
      tokenUsage: { input: 0, output: 0 },
      cost: 0,
      error: null,
    }),
}));
