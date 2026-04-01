# Claude Codex Desktop Application Design Spec

## Overview

Transform the Claude Code CLI (reverse-engineered Anthropic CLI) into a desktop GUI application named **Claude Codex**, following the Cursor Codex style: conversation panel + file tree + editor preview. The CLI remains fully functional; the GUI is an enhancement layer sharing core logic.

## Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Desktop framework | Electron | Existing codebase is TypeScript + React; maximum code reuse |
| UI framework | React 19 | Already used in CLI (Ink); direct component logic reuse |
| Styling | Tailwind CSS + shadcn/ui | Rapid development, consistent design tokens |
| Code editor | Monaco Editor | VS Code-grade editing, built-in diff view |
| Build | Bun (monorepo workspaces) | Already in use; electron-builder for packaging |
| State management | Zustand | Already used in CLI (`src/state/store.ts`) |
| IPC | Electron IPC (contextBridge) | Secure main/renderer communication |

## Architecture

### Monorepo Structure

```
claude-codex/
├── packages/
│   ├── core/                    # Shared core logic (zero UI deps)
│   │   ├── src/
│   │   │   ├── api/             # API clients (Anthropic/Bedrock/Vertex/Azure)
│   │   │   ├── query/           # query.ts + QueryEngine.ts
│   │   │   ├── tools/           # Tool system (BashTool, FileEditTool, etc.)
│   │   │   ├── state/           # AppState, store, bootstrap state
│   │   │   ├── permissions/     # Permission modes, rule matching
│   │   │   ├── context/         # System prompt, CLAUDE.md, git context
│   │   │   ├── messages/        # Message types, creation, formatting
│   │   │   ├── mcp/             # MCP client/server logic
│   │   │   ├── cost/            # Cost tracking
│   │   │   └── utils/           # Shared utilities
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── cli/                     # CLI app (keeps existing terminal UI)
│   │   ├── src/
│   │   │   ├── entrypoints/     # cli.tsx entry
│   │   │   ├── screens/         # REPL.tsx, Doctor.tsx, etc.
│   │   │   ├── ink/             # Forked Ink framework
│   │   │   └── components/      # Terminal UI components
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── desktop/                 # Electron desktop app
│   │   ├── src/
│   │   │   ├── main/            # Electron main process
│   │   │   │   ├── index.ts     # App entry, window management
│   │   │   │   ├── ipc.ts       # IPC handler registration
│   │   │   │   ├── menu.ts      # Native menu bar
│   │   │   │   └── tray.ts      # System tray
│   │   │   ├── preload/
│   │   │   │   └── index.ts     # contextBridge API exposure
│   │   │   └── renderer/        # React SPA
│   │   │       ├── App.tsx       # Root component
│   │   │       ├── layouts/
│   │   │       │   └── MainLayout.tsx   # Three-panel layout
│   │   │       ├── panels/
│   │   │       │   ├── FileTree.tsx     # Left: file tree
│   │   │       │   ├── ChatPanel.tsx    # Center: conversation
│   │   │       │   └── EditorPanel.tsx  # Right: Monaco editor/diff
│   │   │       ├── components/
│   │   │       │   ├── MessageBubble.tsx
│   │   │       │   ├── ToolCallCard.tsx
│   │   │       │   ├── PermissionModal.tsx
│   │   │       │   ├── CommandPalette.tsx
│   │   │       │   ├── SessionList.tsx
│   │   │       │   └── SettingsPanel.tsx
│   │   │       ├── hooks/
│   │   │       │   ├── useQueryEngine.ts
│   │   │       │   ├── useFileTree.ts
│   │   │       │   └── useSession.ts
│   │   │       └── stores/
│   │   │           ├── chatStore.ts
│   │   │           ├── fileStore.ts
│   │   │           └── settingsStore.ts
│   │   ├── electron-builder.yml
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── ... (existing stub packages: @ant/*, *-napi)
│
├── package.json                 # Root workspace config
├── tsconfig.json
└── CLAUDE.md
```

### Process Architecture

```
┌─────────────────────────────────────────────┐
│              Electron Main Process           │
│                                             │
│  ┌─────────────┐  ┌──────────────────────┐  │
│  │ Window Mgr  │  │  @claude-codex/core   │  │
│  │             │  │                      │  │
│  │ - BrowserWin│  │  - QueryEngine       │  │
│  │ - Tray      │  │  - Tool execution    │  │
│  │ - Menu      │  │  - API calls         │  │
│  │             │  │  - File operations   │  │
│  │             │  │  - Permission checks │  │
│  └─────────────┘  └──────────────────────┘  │
│         │                    │               │
│         └────── IPC ─────────┘               │
│                  │                           │
├──────────────────┼───────────────────────────┤
│                  │                           │
│         Renderer Process (React)             │
│                                             │
│  ┌──────────┬──────────────┬──────────────┐  │
│  │ FileTree │  ChatPanel   │ EditorPanel  │  │
│  │          │              │              │  │
│  │ chokidar │  Messages    │ Monaco       │  │
│  │ watcher  │  Input       │ Diff view    │  │
│  │          │  Tool cards  │              │  │
│  └──────────┴──────────────┴──────────────┘  │
│                                             │
└─────────────────────────────────────────────┘
```

### IPC Protocol

Core logic runs in the **main process** (full Node.js/Bun API access). Renderer communicates via typed IPC channels:

```typescript
// preload/index.ts - exposed API
interface ClaudeCodexAPI {
  // Query
  query: {
    send(message: string): void;
    onStreamChunk(callback: (chunk: StreamChunk) => void): void;
    onToolCall(callback: (toolCall: ToolCallEvent) => void): void;
    cancel(): void;
  };

  // Permissions
  permissions: {
    onRequest(callback: (req: PermissionRequest) => void): void;
    respond(requestId: string, approved: boolean): void;
  };

  // File system
  fs: {
    readDir(path: string): Promise<FileTreeNode[]>;
    readFile(path: string): Promise<string>;
    watchDir(path: string, callback: (event: FSEvent) => void): void;
  };

  // Session
  session: {
    list(): Promise<SessionInfo[]>;
    resume(sessionId: string): Promise<void>;
    getCurrent(): Promise<SessionInfo>;
  };

  // Settings
  settings: {
    get(): Promise<Settings>;
    update(patch: Partial<Settings>): Promise<void>;
  };
}
```

## UI Design

### Main Layout (Three Panels)

```
┌────────────────────────────────────────────────────────────┐
│  🔵 Claude Codex          ~/projects/my-app     [─ □ ×]   │
├────────┬───────────────────────────────┬───────────────────┤
│ 📂 src │                               │ file.ts (diff)    │
│ ├ api/ │  You                          │                   │
│ ├ comp │  > 帮我重构 auth 模块          │  3  - const old   │
│ ├ util │                               │  3  + const new   │
│ │      │  Claude                        │  4    return x    │
│ 📂 pkg │  我来帮你重构。首先分析一下      │  5  - if (bad)    │
│ 📄 ... │  现有结构...                   │  5  + if (good)   │
│        │                               │                   │
│ ────── │  ┌─ 🔧 FileEditTool ────────┐ │ ─── Changes ───── │
│ SESSIONS│  │ ✏️ src/auth/login.ts     │ │ M src/auth/login  │
│ 今天    │  │ +15 -8 lines            │ │ M src/auth/guard  │
│ · auth │  │ [View Diff] [Apply]      │ │ A src/auth/types  │
│ · bug  │  └──────────────────────────┘ │                   │
│ 昨天    │                               │                   │
│ · feat │  ┌──────────────────────────┐ │                   │
│        │  │ 💬 输入消息...    [⌘⏎]   │ │                   │
├────────┴──┴──────────────────────────┴─┴───────────────────┤
│ tokens: 12.5k in / 3.2k out  │  cost: $0.08  │  claude-4  │
└────────────────────────────────────────────────────────────┘
```

### Panel Details

**Left Panel - File Tree + Sessions (240px, resizable)**
- Project file tree with git status indicators (M/A/D)
- Collapsible session history list at bottom
- Right-click context menu: open, copy path, add to context
- Files mentioned by AI are highlighted

**Center Panel - Chat (flex, min 400px)**
- Message bubbles: user (right-aligned), assistant (left-aligned)
- Tool call cards: collapsible, show tool name + summary + [View Diff]
- Streaming: real-time token rendering with typing indicator
- Input: multi-line textarea, Cmd+Enter to send, `/` triggers command palette
- Thinking blocks: collapsible with "thinking..." animation

**Right Panel - Editor Preview (400px, resizable, collapsible)**
- Monaco Editor in diff mode by default
- Tab bar for multiple changed files
- Changes summary list at bottom
- [Apply] / [Reject] buttons per file or bulk
- Click a file in chat or file tree to preview it here

### Key Interactions

**1. Permission Flow**
- CLI: inline terminal prompt (y/n)
- GUI: modal dialog with context preview
```
┌─ Permission Required ──────────────────┐
│                                        │
│  BashTool wants to execute:            │
│  ┌────────────────────────────────┐    │
│  │ $ npm install express          │    │
│  └────────────────────────────────┘    │
│                                        │
│  ☐ Always allow npm install commands   │
│                                        │
│         [Deny]    [Allow Once]         │
└────────────────────────────────────────┘
```

**2. Command Palette (Cmd+K)**
- Fuzzy search all `/` commands
- Recent commands at top
- Keyboard navigable

**3. Settings Panel**
- Visual editor for `settings.json`
- API key management with secure storage
- Permission mode selector (plan/auto/manual)
- MCP server configuration
- Theme switching (dark/light)

**4. Tool Call Cards**
- Collapsible by default, show summary
- Expand to see full input/output
- File edits show inline diff preview
- Bash commands show output with ANSI color support
- Click to jump to relevant file in editor panel

## Core Logic Extraction Plan

### Files to Move to `packages/core/`

**API Layer** (move as-is):
- `src/services/api/claude.ts` → `core/src/api/claude.ts`
- `src/services/api/bootstrap.ts` → `core/src/api/bootstrap.ts`
- `src/utils/model/providers.ts` → `core/src/api/providers.ts`
- `src/utils/model/model.ts` → `core/src/api/model.ts`

**Query Engine** (move as-is):
- `src/query.ts` → `core/src/query/query.ts`
- `src/QueryEngine.ts` → `core/src/query/QueryEngine.ts`

**Tools** (move as-is, ~20 tool directories):
- `src/tools/` → `core/src/tools/`
- `src/Tool.ts` → `core/src/tools/Tool.ts`
- `src/tools.ts` → `core/src/tools/registry.ts`
- Note: strip Ink rendering components from tools; tools export data, UI renders it

**State** (move as-is):
- `src/state/AppState.tsx` → `core/src/state/AppState.ts` (remove React deps)
- `src/state/store.ts` → `core/src/state/store.ts`
- `src/bootstrap/state.ts` → `core/src/state/bootstrap.ts`

**Permissions**:
- `src/utils/permissions/` → `core/src/permissions/`
- `src/types/permissions.ts` → `core/src/permissions/types.ts`

**Context**:
- `src/context.ts` → `core/src/context/context.ts`
- `src/utils/claudemd.ts` → `core/src/context/claudemd.ts`
- `src/constants/prompts.js` → `core/src/context/prompts.ts`

**Messages**:
- `src/types/message.ts` → `core/src/messages/types.ts`
- `src/utils/messages.ts` → `core/src/messages/messages.ts`

**MCP**:
- `src/services/mcp/` → `core/src/mcp/`

**Cost tracking**:
- `src/cost-tracker.ts` → `core/src/cost/tracker.ts`

### Files That Stay in CLI

- `src/ink/` — terminal rendering framework
- `src/screens/` — Ink screen components
- `src/components/` — Ink UI components
- `src/entrypoints/cli.tsx` — CLI entry point

### Boundary Contract

Core exposes event-driven interfaces that both CLI and Desktop consume:

```typescript
// core/src/query/QueryEngine.ts
interface QueryEngineEvents {
  'stream:start': () => void;
  'stream:chunk': (chunk: TextChunk) => void;
  'stream:thinking': (thinking: ThinkingBlock) => void;
  'tool:call': (toolCall: ToolCallRequest) => void;
  'tool:result': (result: ToolCallResult) => void;
  'permission:request': (request: PermissionRequest) => void;
  'message:complete': (message: AssistantMessage) => void;
  'error': (error: Error) => void;
  'cost:update': (cost: CostInfo) => void;
}
```

CLI subscribes to these events and renders via Ink. Desktop subscribes and renders via React DOM.

## Desktop-Specific Features

### 1. File Watcher Integration
- `chokidar` watches project directory from main process
- Real-time file tree updates pushed to renderer
- Git status integration (shows M/A/D/? indicators)

### 2. Drag & Drop Context
- Drag files from OS or file tree into chat input
- Automatically adds file content as context
- Image files rendered inline

### 3. Native OS Integration
- System tray with quick access
- Native notifications for long-running tasks
- macOS: dock badge for pending permissions
- Global hotkey (Cmd+Shift+C) to toggle window

### 4. Multi-Session Tabs
- Browser-style tabs for parallel conversations
- Each tab has independent QueryEngine instance
- Tab title auto-generated from first message

### 5. Inline Terminal
- Embedded terminal panel (xterm.js) at bottom
- Toggle with Cmd+`
- Shows Bash tool output in real-time
- Can also run manual commands

## Implementation Phases

### Phase 1: Core Extraction (Week 1-2)
- Create `packages/core/` with clean package.json
- Move API, query, tools, state, permissions, context modules
- Strip React/Ink dependencies from core modules
- Add EventEmitter-based boundary contracts
- Verify CLI still works with core as dependency
- Add basic integration tests for core

### Phase 2: Desktop Skeleton (Week 3)
- Set up Electron project in `packages/desktop/`
- Implement BrowserWindow with three-panel layout
- Set up IPC bridge (preload + contextBridge)
- Integrate core QueryEngine in main process
- Basic message send/receive flow working

### Phase 3: Chat Panel (Week 4-5)
- Message rendering (markdown, code blocks, syntax highlighting)
- Streaming display with typing animation
- Tool call cards (collapsible, with summary)
- Thinking block display
- Multi-line input with Cmd+Enter
- Message history scrollback

### Phase 4: Editor Panel (Week 6)
- Monaco Editor integration
- Diff view for file changes
- Tab bar for multiple files
- Apply/Reject per file
- Click-to-navigate from tool call cards

### Phase 5: File Tree & Session Management (Week 7-8)
- File tree with chokidar watcher
- Git status indicators
- Session list, search, resume
- Settings panel (visual config editor)
- Command palette (Cmd+K)

### Phase 6: Polish & Package (Week 9-10)
- Permission modal UI
- Native OS integration (tray, notifications, hotkey)
- Auto-updater (electron-updater)
- electron-builder packaging (dmg/exe/AppImage)
- Dark/light theme
- Performance optimization

## Non-Goals (Explicit Exclusions)

- **Not an IDE**: no syntax checking, no IntelliSense, no debugging. Monaco is for preview only.
- **No collaboration**: single-user application.
- **No plugin marketplace**: MCP servers configured via settings, not a store.
- **No mobile**: desktop only (macOS, Windows, Linux).
- **No cloud sync**: sessions stored locally, same as CLI.
- **No voice mode**: stripped from CLI, not added to GUI.

## Open Questions (Resolved)

1. **Bun in Electron main process?** — Use Node.js for Electron main process (Electron bundles Node). Core package must be compatible with both Bun (CLI) and Node (Desktop). Avoid Bun-only APIs in core.
2. **Monaco bundle size?** — Use `@monaco-editor/react` with lazy loading. Only load diff-related language workers.
3. **How to handle tool rendering?** — Tools return structured data (not Ink components). Each consumer (CLI/Desktop) has its own renderers. Core tools export `ToolCallResult` objects, not UI.
