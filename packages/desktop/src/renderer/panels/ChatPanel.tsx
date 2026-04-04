import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MarkdownMessage } from '../components/MarkdownMessage';
import { ToolCallDisplay, type ToolCallInfo } from '../components/ToolCallDisplay';
import { PermissionToast } from '../components/PermissionDialog';
import { useChatStore } from '../stores/chatStore';

/**
 * Wire up all IPC event listeners from the CLI subprocess.
 */
function useQueryBridge() {
  const store = useChatStore;

  useEffect(() => {
    const api = window.claudeCodex;
    if (!api) return;

    const unsubs: (() => void)[] = [];

    unsubs.push(
      api.query.onStreamChunk((chunk) => {
        if (chunk.text) store.getState().appendTurnText(chunk.text);
        if (chunk.done) store.getState().finalizeTurn();
      })
    );

    unsubs.push(
      api.query.onToolCall((tc) => {
        store.getState().addToolCall({
          id: tc.id,
          name: tc.name,
          input: tc.input,
          status: 'running',
          startTime: Date.now(),
        });
      })
    );

    unsubs.push(
      api.query.onToolResult((result) => {
        store.getState().updateToolCall(result.toolUseId, {
          status: result.isError ? 'error' : 'done',
          result: result.result,
        });
      })
    );

    unsubs.push(
      api.query.onResult((result) => {
        const s = store.getState();
        if (result.costUSD !== undefined) s.setCost(result.costUSD);
        if (result.inputTokens !== undefined && result.outputTokens !== undefined) {
          s.setTokenUsage(result.inputTokens, result.outputTokens);
        }
      })
    );

    unsubs.push(
      api.query.onSystem((data) => {
        if (data.model) store.getState().setModel(data.model);
      })
    );

    unsubs.push(
      api.query.onError((err) => {
        const msg = err.message || err.stderr || `Process exited with code ${err.code}`;
        const s = store.getState();
        s.setError(msg);
        s.addMessage({ id: Date.now().toString(), role: 'system', content: `Error: ${msg}`, timestamp: Date.now() });
        s.setStreaming(false);
      })
    );

    return () => unsubs.forEach((fn) => fn());
  }, []);
}

export function ChatPanel() {
  useQueryBridge();

  const messages = useChatStore((s) => s.messages);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const turnTextChunks = useChatStore((s) => s.turnTextChunks);
  const turnToolCalls = useChatStore((s) => s.turnToolCalls);
  const pendingPermissions = useChatStore((s) => s.pendingPermissions);
  const model = useChatStore((s) => s.model);
  const addMessage = useChatStore((s) => s.addMessage);
  const setStreaming = useChatStore((s) => s.setStreaming);
  const removePermissionRequest = useChatStore((s) => s.removePermissionRequest);

  const streamingText = turnTextChunks.join('');

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, turnTextChunks, turnToolCalls]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [input]);

  const handleSubmit = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    addMessage({ id: Date.now().toString(), role: 'user', content: text, timestamp: Date.now() });
    setInput('');
    setStreaming(true);

    const api = window.claudeCodex;
    if (api) {
      try {
        await api.query.send(text);
      } catch (e) {
        addMessage({
          id: (Date.now() + 1).toString(), role: 'system',
          content: `Failed to send. ${e instanceof Error ? e.message : 'Is the dev proxy running?'}`,
          timestamp: Date.now(),
        });
        setStreaming(false);
      }
    } else {
      addMessage({
        id: (Date.now() + 1).toString(), role: 'system',
        content: 'No connection. Run: `bun run packages/desktop/src/main/devProxy.ts`',
        timestamp: Date.now(),
      });
      setStreaming(false);
    }
  }, [input, isStreaming]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  };

  return (
    <div className="h-full flex flex-col bg-[var(--bg-primary)]">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && !isStreaming && (
          <div className="flex items-center justify-center h-full text-[var(--text-muted)]">
            <div className="text-center space-y-2">
              <div className="text-3xl opacity-40">{'>'}_</div>
              <p className="text-sm">Send a message to start</p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageRow key={msg.id} message={msg} model={model} />
        ))}

        {/* Active streaming turn */}
        {isStreaming && (streamingText || turnToolCalls.length > 0) && (
          <AssistantCard
            content={streamingText}
            toolCalls={turnToolCalls}
            model={model}
            isStreaming={true}
          />
        )}

        {/* Thinking indicator */}
        {isStreaming && !streamingText && turnToolCalls.length === 0 && (
          <div className="flex items-center gap-2 px-4 py-2 text-sm text-[var(--text-muted)]">
            <span className="inline-block w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
            Thinking...
          </div>
        )}

        {pendingPermissions.map((req) => (
          <PermissionToast
            key={req.id}
            request={req}
            onApprove={() => { removePermissionRequest(req.id); window.claudeCodex?.permissions.respond(req.id, true); }}
            onDeny={() => { removePermissionRequest(req.id); window.claudeCodex?.permissions.respond(req.id, false); }}
          />
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-[var(--border)] p-4">
        <div className="relative max-w-4xl mx-auto">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isStreaming ? 'Claude is working...' : 'Message Claude... (Enter to send, Shift+Enter for newline)'}
            rows={1}
            disabled={isStreaming}
            className="w-full resize-none rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border)] px-4 py-3 pr-12 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] disabled:opacity-50 transition-colors"
            style={{ minHeight: '44px', maxHeight: '200px' }}
          />
          {isStreaming ? (
            <button
              onClick={() => { window.claudeCodex?.query.cancel(); setStreaming(false); }}
              className="absolute right-2 bottom-2 p-2 rounded-md text-[var(--error)] hover:bg-[var(--error)]/10"
              title="Cancel"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="3" y="3" width="10" height="10" rx="1" fill="currentColor" />
              </svg>
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!input.trim()}
              className="absolute right-2 bottom-2 p-2 rounded-md text-[var(--text-muted)] hover:text-[var(--accent)] disabled:opacity-30"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 14L14.5 8L2 2V6.5L10 8L2 9.5V14Z" fill="currentColor" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Message Row — routes to correct display component
// =============================================================================

interface ChatMessageType {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  toolCalls?: ToolCallInfo[];
}

function MessageRow({ message, model }: { message: ChatMessageType; model: string | null }) {
  if (message.role === 'system') {
    return (
      <div className="text-xs text-[var(--text-muted)] px-4 py-2 rounded bg-[var(--error)]/5 border border-[var(--error)]/20">
        {message.content}
      </div>
    );
  }

  if (message.role === 'user') {
    return <UserMessage content={message.content} timestamp={message.timestamp} />;
  }

  // Assistant
  return (
    <AssistantCard
      content={message.content}
      toolCalls={message.toolCalls || []}
      model={model}
      isStreaming={false}
    />
  );
}

// =============================================================================
// User Message — right-aligned bubble (matches devtools)
// =============================================================================

function UserMessage({ content, timestamp }: { content: string; timestamp: number }) {
  const time = new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
  return (
    <div className="flex items-start justify-end gap-3">
      <div className="max-w-[75%]">
        {/* Timestamp + label */}
        <div className="flex items-center justify-end gap-2 mb-1">
          <span className="text-[10px] text-[var(--text-muted)]">{time}</span>
          <span className="text-xs font-medium text-[var(--text-secondary)]">You</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-[var(--text-muted)]">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
          </svg>
        </div>
        {/* Message bubble */}
        <div className="bg-[#2a2a3e] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)]">
          <span className="whitespace-pre-wrap">{content}</span>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Assistant Card — matches claude-devtools AIChatGroup layout
//
// Layout:
//   🤖 Claude  [model]  ·  N tool calls, M messages  ∨
//   ├── [tool item rows when expanded]
//   └── [last output text - always visible]
// =============================================================================

function AssistantCard({
  content,
  toolCalls,
  model,
  isStreaming,
}: {
  content: string;
  toolCalls: ToolCallInfo[];
  model: string | null;
  isStreaming: boolean;
}) {
  const [expanded, setExpanded] = useState(true);

  const toolCount = toolCalls.length;
  const summary = buildItemsSummary(toolCalls, content);
  const modelDisplay = model || 'claude-opus-4-6';

  return (
    <div
      className="space-y-2 border-l-2 pl-3"
      style={{ borderColor: 'var(--accent)' }}
    >
      {/* Header Row — matches devtools: 🤖 Claude [model] · summary ∨ */}
      {(toolCount > 0 || isStreaming) && (
        <div className="flex items-center gap-2">
          {/* Clickable toggle area */}
          <div
            role="button"
            tabIndex={0}
            className="group flex min-w-0 flex-1 cursor-pointer items-center gap-2 overflow-hidden"
            onClick={() => setExpanded(!expanded)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(!expanded); } }}
          >
            {/* Bot icon */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0 text-[var(--text-secondary)]">
              <rect x="3" y="11" width="18" height="10" rx="2" stroke="currentColor" strokeWidth="2"/>
              <circle cx="9" cy="16" r="1" fill="currentColor"/>
              <circle cx="15" cy="16" r="1" fill="currentColor"/>
              <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>

            <span className="shrink-0 text-xs font-semibold text-[var(--text-secondary)]">
              Claude
            </span>

            {/* Model name */}
            <span className="shrink-0 text-xs text-[var(--accent)]">
              {modelDisplay}
            </span>

            <span className="shrink-0 text-xs text-[var(--text-muted)]">·</span>

            {/* Items summary */}
            <span className="truncate text-xs text-[var(--text-muted)]">
              {summary}
            </span>

            {/* Chevron */}
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none"
              className={`shrink-0 text-[var(--text-muted)] transition-transform ${expanded ? 'rotate-180' : ''}`}
            >
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          {/* Streaming indicator */}
          {isStreaming && (
            <span className="shrink-0 inline-flex items-center gap-1 text-xs text-[var(--accent)]">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
            </span>
          )}
        </div>
      )}

      {/* Expanded: Tool call list */}
      {expanded && toolCount > 0 && (
        <div className="pl-2 space-y-0.5">
          {toolCalls.map((tc) => (
            <ToolCallDisplay key={tc.id} tool={tc} />
          ))}
        </div>
      )}

      {/* Always visible: Last output text */}
      {content && (
        <div className="text-sm leading-relaxed">
          <MarkdownMessage content={content} />
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function buildItemsSummary(toolCalls: ToolCallInfo[], content: string): string {
  const parts: string[] = [];
  if (toolCalls.length > 0) {
    parts.push(`${toolCalls.length} tool call${toolCalls.length > 1 ? 's' : ''}`);
  }
  if (content) {
    parts.push('1 message');
  }
  return parts.join(', ') || (content ? '1 message' : '');
}
