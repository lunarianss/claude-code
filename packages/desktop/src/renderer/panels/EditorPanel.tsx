import React, { useState, useCallback, lazy, Suspense } from 'react';
import { useEditorStore, type FileTab } from '../stores/editorStore';

// Lazy load Monaco to avoid blocking initial render
const MonacoEditor = lazy(() =>
  import('@monaco-editor/react').then((mod) => ({ default: mod.default }))
);
const DiffEditor = lazy(() =>
  import('@monaco-editor/react').then((mod) => ({ default: mod.DiffEditor }))
);

const LANGUAGE_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  go: 'go',
  json: 'json',
  md: 'markdown',
  css: 'css',
  html: 'html',
  sh: 'shell',
  bash: 'shell',
  yml: 'yaml',
  yaml: 'yaml',
  toml: 'toml',
  sql: 'sql',
};

function getLanguage(filename: string): string {
  const ext = filename.split('.').pop() || '';
  return LANGUAGE_MAP[ext] || 'plaintext';
}

export function EditorPanel() {
  const { tabs, activeTabIndex, setActiveTab, closeTab, acceptChange, rejectChange } =
    useEditorStore();
  const file = tabs[activeTabIndex];

  if (!file) {
    return (
      <div className="h-full flex items-center justify-center bg-[var(--bg-secondary)] text-[var(--text-muted)] text-sm">
        <div className="text-center space-y-2">
          <div className="text-3xl opacity-40">{ }</div>
          <p>No file open</p>
          <p className="text-xs text-[var(--text-muted)]">
            Files opened or edited by Claude will appear here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[var(--bg-secondary)]">
      {/* Tab bar */}
      <div className="flex items-center h-9 border-b border-[var(--border)] overflow-x-auto scrollbar-none">
        {tabs.map((tab, i) => (
          <TabButton
            key={tab.path}
            tab={tab}
            isActive={i === activeTabIndex}
            onClick={() => setActiveTab(i)}
            onClose={() => closeTab(i)}
          />
        ))}
      </div>

      {/* File path breadcrumb */}
      <div className="px-3 py-1 text-[11px] text-[var(--text-muted)] border-b border-[var(--border)] flex items-center gap-2">
        <span className="truncate">{file.path}</span>
        {file.diff && (
          <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] bg-[var(--warning)]/20 text-[var(--warning)]">
            modified
          </span>
        )}
      </div>

      {/* Editor area */}
      <div className="flex-1 overflow-hidden">
        <Suspense
          fallback={
            <div className="h-full flex items-center justify-center text-[var(--text-muted)] text-sm">
              Loading editor...
            </div>
          }
        >
          {file.diff ? (
            <DiffEditor
              original={file.diff.original}
              modified={file.diff.modified}
              language={getLanguage(file.name)}
              theme="vs-dark"
              options={{
                readOnly: true,
                minimap: { enabled: false },
                fontSize: 13,
                lineHeight: 20,
                scrollBeyondLastLine: false,
                renderSideBySide: true,
                padding: { top: 8 },
              }}
            />
          ) : (
            <MonacoEditor
              value={file.content}
              language={getLanguage(file.name)}
              theme="vs-dark"
              options={{
                readOnly: true,
                minimap: { enabled: false },
                fontSize: 13,
                lineHeight: 20,
                scrollBeyondLastLine: false,
                padding: { top: 8 },
                wordWrap: 'on',
              }}
            />
          )}
        </Suspense>
      </div>

      {/* Diff action bar */}
      {file.diff && (
        <div className="px-3 py-2 border-t border-[var(--border)] flex items-center gap-2 bg-[var(--bg-primary)]">
          <button
            onClick={() => acceptChange(activeTabIndex)}
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-[var(--success)]/20 text-[var(--success)] hover:bg-[var(--success)]/30 transition-colors"
          >
            Accept
          </button>
          <button
            onClick={() => rejectChange(activeTabIndex)}
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-[var(--error)]/20 text-[var(--error)] hover:bg-[var(--error)]/30 transition-colors"
          >
            Reject
          </button>
          <span className="text-[11px] text-[var(--text-muted)] ml-auto">
            {countDiffLines(file.diff.original, file.diff.modified)} lines changed
          </span>
        </div>
      )}
    </div>
  );
}

function TabButton({
  tab,
  isActive,
  onClick,
  onClose,
}: {
  tab: FileTab;
  isActive: boolean;
  onClick: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className={`group h-full flex items-center gap-1.5 px-3 border-r border-[var(--border)] shrink-0 cursor-pointer transition-colors ${
        isActive
          ? 'bg-[var(--bg-primary)] text-[var(--text-primary)]'
          : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
      }`}
      onClick={onClick}
    >
      <span className="text-xs truncate max-w-[120px]">{tab.name}</span>
      {tab.diff && <span className="w-1.5 h-1.5 rounded-full bg-[var(--warning)] shrink-0" />}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-[var(--text-primary)] ml-1 transition-opacity"
      >
        ×
      </button>
    </div>
  );
}

function countDiffLines(original: string, modified: string): number {
  const origLines = original.split('\n');
  const modLines = modified.split('\n');
  let changed = 0;
  const max = Math.max(origLines.length, modLines.length);
  for (let i = 0; i < max; i++) {
    if (origLines[i] !== modLines[i]) changed++;
  }
  return changed;
}
