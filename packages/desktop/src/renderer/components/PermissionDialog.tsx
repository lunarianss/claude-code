import React from 'react';
import type { PermissionRequest } from '../stores/chatStore';

interface PermissionDialogProps {
  request: PermissionRequest;
  onApprove: () => void;
  onDeny: () => void;
}

export function PermissionDialog({ request, onApprove, onDeny }: PermissionDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl shadow-2xl w-[440px] overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--border)]">
          <div className="w-8 h-8 rounded-full bg-[var(--warning)]/20 flex items-center justify-center">
            <span className="text-[var(--warning)]">⚠</span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Permission Required</h3>
            <p className="text-xs text-[var(--text-muted)]">Claude wants to use a tool</p>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--accent)]">
              {request.tool}
            </span>
          </div>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            {request.description}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 px-5 py-3 border-t border-[var(--border)] bg-[var(--bg-primary)]">
          <button
            onClick={onDeny}
            className="flex-1 px-4 py-2 rounded-lg text-sm border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            Deny
          </button>
          <button
            onClick={onApprove}
            className="flex-1 px-4 py-2 rounded-lg text-sm bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors font-medium"
          >
            Approve
          </button>
        </div>

        {/* Keyboard hint */}
        <div className="px-5 py-2 text-center text-[10px] text-[var(--text-muted)] border-t border-[var(--border)]">
          <kbd className="px-1 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-muted)]">Enter</kbd> to approve
          {' · '}
          <kbd className="px-1 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-muted)]">Esc</kbd> to deny
        </div>
      </div>
    </div>
  );
}

/** Inline permission toast variant (less intrusive) */
export function PermissionToast({ request, onApprove, onDeny }: PermissionDialogProps) {
  return (
    <div className="mx-auto max-w-3xl my-2 rounded-lg border border-[var(--warning)]/30 bg-[var(--warning)]/5 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="text-[var(--warning)]">⚠</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-[var(--accent)]">{request.tool}</span>
            <span className="text-xs text-[var(--text-muted)]">—</span>
            <span className="text-xs text-[var(--text-secondary)] truncate">
              {request.description}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onDeny}
            className="px-3 py-1 rounded text-xs border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            Deny
          </button>
          <button
            onClick={onApprove}
            className="px-3 py-1 rounded text-xs bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors"
          >
            Allow
          </button>
        </div>
      </div>
    </div>
  );
}
