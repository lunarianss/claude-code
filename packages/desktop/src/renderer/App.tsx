import React from 'react';
import { MainLayout } from './layouts/MainLayout';
import { useChatStore } from './stores/chatStore';
import { useDevProxy } from './hooks/useDevProxy';

declare global {
  interface Window {
    claudeCodex: import('../preload/index').ClaudeCodexAPI;
  }
}

export default function App() {
  // In browser dev mode, connect to WebSocket dev proxy
  useDevProxy();

  const { tokenUsage, cost, model, isStreaming } = useChatStore();

  return (
    <div className="h-screen w-screen flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* Title bar drag region (macOS) */}
      <div className="titlebar-drag-region" />

      {/* Header */}
      <header className="h-[52px] flex items-center px-20 border-b border-[var(--border)] shrink-0">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isStreaming ? 'bg-[var(--warning)] animate-pulse' : 'bg-[var(--accent)]'}`} />
          <span className="font-semibold text-sm">Claude Codex</span>
        </div>
        <div className="flex-1 text-center text-xs text-[var(--text-muted)]" id="project-path">
          ~/projects
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        <MainLayout />
      </main>

      {/* Status bar */}
      <footer className="h-6 flex items-center px-3 border-t border-[var(--border)] text-[10px] text-[var(--text-muted)] gap-4 shrink-0">
        <span>tokens: {tokenUsage.input.toLocaleString()} in / {tokenUsage.output.toLocaleString()} out</span>
        <span>cost: ${cost.toFixed(4)}</span>
        <span>{model || 'claude-opus-4-6'}</span>
        {isStreaming && <span className="text-[var(--warning)]">● streaming</span>}
        <span className="ml-auto">Claude Codex v0.1.0</span>
      </footer>
    </div>
  );
}
