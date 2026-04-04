import React, { useState } from 'react';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  expanded?: boolean;
}

const MOCK_FILES: FileNode[] = [
  {
    name: 'src',
    path: 'src',
    type: 'directory',
    expanded: true,
    children: [
      { name: 'main.tsx', path: 'src/main.tsx', type: 'file' },
      { name: 'query.ts', path: 'src/query.ts', type: 'file' },
      { name: 'QueryEngine.ts', path: 'src/QueryEngine.ts', type: 'file' },
      {
        name: 'tools',
        path: 'src/tools',
        type: 'directory',
        children: [
          { name: 'BashTool', path: 'src/tools/BashTool', type: 'directory' },
          { name: 'FileEditTool', path: 'src/tools/FileEditTool', type: 'directory' },
          { name: 'GrepTool', path: 'src/tools/GrepTool', type: 'directory' },
        ],
      },
    ],
  },
  { name: 'package.json', path: 'package.json', type: 'file' },
  { name: 'CLAUDE.md', path: 'CLAUDE.md', type: 'file' },
];

function FileTreeItem({ node, depth = 0 }: { node: FileNode; depth?: number }) {
  const [expanded, setExpanded] = useState(node.expanded ?? false);
  const isDir = node.type === 'directory';
  const indent = depth * 16;

  return (
    <div>
      <div
        className="flex items-center h-7 px-2 cursor-pointer hover:bg-[var(--bg-tertiary)] text-sm transition-colors"
        style={{ paddingLeft: `${indent + 8}px` }}
        onClick={() => isDir && setExpanded(!expanded)}
      >
        <span className="w-4 text-[var(--text-muted)] text-xs mr-1 shrink-0">
          {isDir ? (expanded ? '▾' : '▸') : ' '}
        </span>
        <span className="truncate text-[var(--text-secondary)]">{node.name}</span>
      </div>
      {isDir && expanded && node.children?.map((child) => (
        <FileTreeItem key={child.path} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

export function FileTreePanel() {
  return (
    <div className="h-full flex flex-col bg-[var(--bg-secondary)] border-r border-[var(--border)]">
      {/* Sessions section */}
      <div className="px-3 py-2 border-b border-[var(--border)]">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
            Sessions
          </span>
          <button className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-sm">
            +
          </button>
        </div>
        <div className="mt-1 px-2 py-1.5 rounded bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-xs text-[var(--accent)]">
          New Session
        </div>
      </div>

      {/* File tree */}
      <div className="px-3 py-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
          Files
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {MOCK_FILES.map((node) => (
          <FileTreeItem key={node.path} node={node} />
        ))}
      </div>
    </div>
  );
}
