import React, { useState } from 'react';

export interface ToolCallInfo {
  id: string;
  name: string;
  input: unknown;
  status: 'running' | 'done' | 'error';
  result?: string;
  startTime?: number;
}

const TOOL_ICONS: Record<string, React.ReactNode> = {
  Read: <ReadIcon />,
  Write: <WriteIcon />,
  Edit: <EditIcon />,
  Bash: <BashIcon />,
  Glob: <GlobIcon />,
  Grep: <GrepIcon />,
  Agent: <AgentIcon />,
  WebSearch: <WebIcon />,
  WebFetch: <WebIcon />,
};

/**
 * Single tool call row — matches claude-devtools BaseItem:
 * [Icon] [Name] - [Summary]   ~tokens  [StatusDot] [Duration] [Chevron]
 */
export function ToolCallDisplay({ tool }: { tool: ToolCallInfo }) {
  const [expanded, setExpanded] = useState(false);
  const icon = TOOL_ICONS[tool.name] || <DefaultIcon />;
  const summary = formatToolSummary(tool.name, tool.input);

  return (
    <div className="rounded transition-colors">
      {/* Clickable header row */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(!expanded); } }}
        className="group flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs"
        style={{ backgroundColor: 'transparent' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.03)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
      >
        {/* Icon */}
        <span className="size-4 shrink-0 text-[var(--text-muted)]">{icon}</span>

        {/* Tool name */}
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {tool.name}
        </span>

        {/* Separator + Summary */}
        {summary && (
          <>
            <span className="text-sm text-[var(--text-muted)]">-</span>
            <span className="flex-1 truncate text-sm text-[var(--text-muted)]">{summary}</span>
          </>
        )}
        {!summary && <span className="flex-1" />}

        {/* Status dot */}
        <StatusDot status={tool.status} />

        {/* Chevron */}
        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none"
          className={`shrink-0 text-[var(--text-muted)] opacity-40 transition-transform ${expanded ? 'rotate-90' : ''}`}
        >
          <path d="M4.5 2.5L8 6L4.5 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="ml-6 pl-3 border-l border-[var(--border)] mb-2 mt-1 space-y-2">
          {/* Input */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">Input</div>
            <pre className="text-xs font-mono text-[var(--text-secondary)] bg-[#161616] rounded-md p-2.5 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed">
              {formatToolInputExpanded(tool.name, tool.input)}
            </pre>
          </div>

          {/* Result */}
          {tool.result && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">Result</div>
              <pre className="text-xs font-mono text-[var(--text-secondary)] bg-[#161616] rounded-md p-2.5 overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                {tool.result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Status Dot
// =============================================================================

function StatusDot({ status }: { status: 'running' | 'done' | 'error' }) {
  if (status === 'running') {
    return (
      <span className="inline-block w-3.5 h-3.5 shrink-0">
        <span className="inline-block w-3.5 h-3.5 rounded-full border-[1.5px] border-[var(--accent)] border-t-transparent animate-spin" />
      </span>
    );
  }
  const color = status === 'error' ? '#ef4444' : '#22c55e';
  return (
    <span
      className="inline-block w-1.5 h-1.5 shrink-0 rounded-full"
      style={{ backgroundColor: color }}
    />
  );
}

// =============================================================================
// Tool Icons (SVG, matches devtools style)
// =============================================================================

function ReadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/>
    </svg>
  );
}

function WriteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 13.5V4a2 2 0 0 1 2-2h8.5L20 7.5V20a2 2 0 0 1-2 2h-5.5"/><path d="M14 2v6h6"/>
      <path d="m3.5 22 1.5-4L14 9l3 3-9 9-4.5 1z"/>
    </svg>
  );
}

function BashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m7 15 3-3-3-3"/><path d="M14 15h3"/>
    </svg>
  );
}

function GlobIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
    </svg>
  );
}

function GrepIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><path d="M8 11h6"/>
    </svg>
  );
}

function AgentIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="9" cy="16" r="1" fill="currentColor"/><circle cx="15" cy="16" r="1" fill="currentColor"/>
      <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
    </svg>
  );
}

function WebIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  );
}

function DefaultIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
    </svg>
  );
}

// =============================================================================
// Summary formatting
// =============================================================================

function formatToolSummary(name: string, input: unknown): string {
  if (!input || typeof input !== 'object') return '';
  const obj = input as Record<string, unknown>;
  switch (name) {
    case 'Read': return shortenPath(String(obj.file_path || ''));
    case 'Write': return shortenPath(String(obj.file_path || ''));
    case 'Edit': return `${shortenPath(String(obj.file_path || ''))} - ${countLines(String(obj.old_string || ''))} -> ${countLines(String(obj.new_string || ''))} lines`;
    case 'Bash': return String(obj.command || '').slice(0, 120);
    case 'Glob': return String(obj.pattern || '');
    case 'Grep': return `"${String(obj.pattern || '')}" in ${shortenPath(String(obj.path || '**'))}`;
    case 'WebSearch': return String(obj.query || '');
    case 'WebFetch': return String(obj.url || '');
    case 'Agent': return String(obj.description || obj.prompt || '').slice(0, 80);
    default: return Object.values(obj).map(v => String(v)).join(', ').slice(0, 80);
  }
}

function formatToolInputExpanded(name: string, input: unknown): string {
  if (!input || typeof input !== 'object') return String(input ?? '');
  const obj = input as Record<string, unknown>;
  switch (name) {
    case 'Bash': return String(obj.command || '');
    case 'Read': return String(obj.file_path || '') + (obj.offset ? ` (offset: ${obj.offset}, limit: ${obj.limit})` : '');
    case 'Write': return `${obj.file_path}\n---\n${String(obj.content || '').slice(0, 500)}`;
    case 'Edit': return `${obj.file_path}\n- ${String(obj.old_string || '').slice(0, 200)}\n+ ${String(obj.new_string || '').slice(0, 200)}`;
    case 'Grep': return `pattern: ${obj.pattern}\npath: ${obj.path || '.'}\nmode: ${obj.output_mode || 'files_with_matches'}`;
    case 'Glob': return `pattern: ${obj.pattern}\npath: ${obj.path || '.'}`;
    default: return JSON.stringify(obj, null, 2);
  }
}

function shortenPath(path: string): string {
  return path.replace(/^\/Users\/[^/]+/, '~');
}

function countLines(s: string): number {
  return s.split('\n').length;
}
