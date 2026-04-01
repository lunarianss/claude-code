# Claude Codex Desktop Implementation Plan

**Design Spec:** `docs/superpowers/specs/2026-04-01-claude-codex-desktop-design.md`

**Goal:** Transform Claude Code CLI into a desktop GUI application (Claude Codex) with Cursor-style three-panel layout, while keeping CLI fully functional. Both share core logic via monorepo architecture.

---

## Phase 1: Core Package Extraction (Week 1-2)

### Milestone 1.1: Create Core Package Structure

**Objective:** Set up `packages/core/` with clean package.json and tsconfig

**Tasks:**
1. Create `packages/core/` directory structure
2. Write `packages/core/package.json`:
   - Name: `@claude-codex/core`
   - Type: `module`
   - Main: `./src/index.ts`
   - Exports: API, query, tools, state, permissions, context, messages, mcp, cost
   - Dependencies: Copy from root (Anthropic SDK, Zod, etc.) - exclude React/Ink
   - Peer dependencies: None (fully self-contained)
3. Write `packages/core/tsconfig.json`:
   - Extends root tsconfig
   - Compiler options: strict: false, skipLibCheck: true
   - No path aliases (use relative imports within core)
4. Create directory structure:
   ```
   packages/core/src/
   ├── api/
   ├── query/
   ├── tools/
   ├── state/
   ├── permissions/
   ├── context/
   ├── messages/
   ├── mcp/
   ├── cost/
   ├── utils/
   └── index.ts
   ```

**Verification:**
- `bun install` succeeds
- `packages/core/` appears in workspace list

---

### Milestone 1.2: Extract API Layer

**Objective:** Move API client modules to core

**Files to move:**
- `src/services/api/claude.ts` → `core/src/api/claude.ts`
- `src/services/api/bootstrap.ts` → `core/src/api/bootstrap.ts`
- `src/services/api/logging.ts` → `core/src/api/logging.ts`
- `src/services/api/withRetry.ts` → `core/src/api/withRetry.ts`
- `src/utils/model/providers.ts` → `core/src/api/providers.ts`
- `src/utils/model/model.ts` → `core/src/api/model.ts`
- `src/utils/api.ts` → `core/src/api/utils.ts`

**Tasks:**
1. Copy files to `core/src/api/`
2. Update imports to use relative paths (no `src/` alias)
3. Export public API from `core/src/api/index.ts`
4. Update CLI imports to use `@claude-codex/core/api`

**Verification:**
- CLI still runs: `bun run dev`
- No broken imports in moved files

---

### Milestone 1.3: Extract Query Engine

**Objective:** Move query orchestration to core

**Files to move:**
- `src/query.ts` → `core/src/query/query.ts`
- `src/QueryEngine.ts` → `core/src/query/QueryEngine.ts`
- `src/utils/queryProfiler.ts` → `core/src/query/profiler.ts`

**Tasks:**
1. Copy files to `core/src/query/`
2. Update imports (relative paths)
3. Export from `core/src/query/index.ts`
4. Update CLI to import from `@claude-codex/core/query`

**Verification:**
- CLI query flow works end-to-end
- Streaming, tool calls, permissions all functional

---

### Milestone 1.4: Extract State Management

**Objective:** Move state modules, strip React from AppState

**Files to move:**
- `src/state/store.ts` → `core/src/state/store.ts` (no changes needed)
- `src/state/AppStateStore.ts` → `core/src/state/AppStateStore.ts`
- `src/bootstrap/state.ts` → `core/src/state/bootstrap.ts`

**Special handling for AppState.tsx:**
- Extract type definitions → `core/src/state/AppState.ts` (pure types)
- Keep React Context Provider in CLI: `packages/cli/src/state/AppStateProvider.tsx`
- Core exports: `AppState` type, `getDefaultAppState()`, state update functions
- CLI wraps with React Context

**Tasks:**
1. Copy `store.ts` and `AppStateStore.ts` as-is
2. Extract `AppState` type from `AppState.tsx` → `core/src/state/AppState.ts`
3. Move `bootstrap/state.ts` → `core/src/state/bootstrap.ts`
4. Create `core/src/state/index.ts` with exports
5. Update CLI to use core state types

**Verification:**
- CLI state management works
- No React imports in core/src/state/

---

### Milestone 1.5: Extract Tools System

**Objective:** Move all 49 tools to core, strip UI components

**Strategy:**
- Tools export data structures (ToolCallResult), not React components
- UI rendering stays in CLI (`packages/cli/src/tools/*/UI.tsx`)
- Core tools export: name, schema, call(), description, validation, permissions

**Files to move:**
- `src/Tool.ts` → `core/src/tools/Tool.ts`
- `src/tools.ts` → `core/src/tools/registry.ts`
- `src/tools/*/` → `core/src/tools/*/` (49 tool directories)

**Per-tool refactoring:**
1. Keep main tool file (e.g., `BashTool.tsx`) in core
2. Remove `renderToolUseMessage`, `renderToolResultMessage`, etc. from tool definition
3. Move `UI.tsx` to CLI: `packages/cli/src/tools/*/UI.tsx`
4. Tool exports structured data; CLI/Desktop render it separately

**Tasks:**
1. Copy `Tool.ts` and `tools.ts` to core
2. For each tool directory:
   - Copy main tool file + supporting files (prompt.ts, utils.ts, constants.ts)
   - Remove React rendering methods from tool definition
   - Move `UI.tsx` to CLI package
3. Create `core/src/tools/index.ts` exporting all tools
4. Update CLI to import tools from core, use CLI-side UI renderers

**Verification:**
- CLI tools work (BashTool, FileEditTool, GrepTool tested)
- No React imports in core/src/tools/

---

### Milestone 1.6: Extract Permissions System

**Objective:** Move permission logic to core

**Files to move:**
- `src/utils/permissions/` → `core/src/permissions/`
- `src/types/permissions.ts` → `core/src/permissions/types.ts`

**Tasks:**
1. Copy permissions directory to core
2. Update imports to relative paths
3. Export from `core/src/permissions/index.ts`
4. Update CLI imports

**Verification:**
- Permission modes (plan/auto/manual) work in CLI
- YOLO classifier functional

---

### Milestone 1.7: Extract Context & Messages

**Objective:** Move context building and message utilities

**Files to move:**
- `src/context.ts` → `core/src/context/context.ts`
- `src/utils/claudemd.ts` → `core/src/context/claudemd.ts`
- `src/constants/prompts.js` → `core/src/context/prompts.ts`
- `src/types/message.ts` → `core/src/messages/types.ts`
- `src/utils/messages.ts` → `core/src/messages/messages.ts`

**Tasks:**
1. Copy files to core
2. Update imports
3. Export from `core/src/context/index.ts` and `core/src/messages/index.ts`
4. Update CLI imports

**Verification:**
- System prompt generation works
- CLAUDE.md loading works
- Message creation/formatting works

---

### Milestone 1.8: Extract MCP & Cost Tracking

**Objective:** Move MCP client and cost tracking

**Files to move:**
- `src/services/mcp/` → `core/src/mcp/`
- `src/cost-tracker.ts` → `core/src/cost/tracker.ts`

**Tasks:**
1. Copy MCP directory to core
2. Copy cost-tracker to core
3. Update imports
4. Export from `core/src/mcp/index.ts` and `core/src/cost/index.ts`
5. Update CLI imports

**Verification:**
- MCP servers connect and work
- Cost tracking displays correctly

---

### Milestone 1.9: Core Integration Tests

**Objective:** Verify core package works independently

**Tasks:**
1. Create `packages/core/test/` directory
2. Write integration tests:
   - API client can make requests
   - QueryEngine can run a full query cycle
   - Tools can be called and return results
   - State management works
   - Permissions evaluate correctly
3. Run tests: `bun test packages/core/test/`

**Verification:**
- All core tests pass
- CLI still fully functional

---

## Phase 2: Desktop Skeleton (Week 3)

### Milestone 2.1: Electron Project Setup

**Objective:** Create `packages/desktop/` with Electron + React

**Tasks:**
1. Create directory structure:
   ```
   packages/desktop/
   ├── src/
   │   ├── main/index.ts
   │   ├── preload/index.ts
   │   └── renderer/
   │       ├── index.html
   │       ├── index.tsx
   │       └── App.tsx
   ├── package.json
   ├── tsconfig.json
   ├── vite.config.ts
   └── electron-builder.yml
   ```

2. Write `package.json`:
   - Dependencies: `@claude-codex/core`, `electron`, `react`, `react-dom`
   - Scripts: `dev`, `build`, `package`

3. Set up Vite for renderer (vite.config.ts)
4. Write basic main process (BrowserWindow creation)
5. Write preload script (contextBridge skeleton)
6. Write basic renderer ("Hello Claude Codex")

**Verification:**
- `bun run dev` launches Electron window
- React app displays

---

### Milestone 2.2: Three-Panel Layout

**Objective:** Implement resizable three-panel layout

**Tasks:**
1. Install `react-resizable-panels`, `tailwindcss`
2. Create `MainLayout.tsx` with three panels
3. Create placeholder panels (FileTree, ChatPanel, EditorPanel)
4. Configure Tailwind CSS

**Verification:**
- Three panels visible and resizable
- Right panel collapsible

---

### Milestone 2.3: IPC Bridge

**Objective:** Establish typed IPC communication

**Tasks:**
1. Define IPC types (`src/shared/ipc-types.ts`)
2. Implement main process handlers (`src/main/ipc.ts`)
3. Implement preload bridge
4. Create renderer hooks (`useQuery`, `usePermissions`)

**Verification:**
- Renderer can call main process
- Main can push events to renderer

---

### Milestone 2.4: Basic Query Flow

**Objective:** Send message, receive streaming response

**Tasks:**
1. Integrate QueryEngine in main process
2. Implement `query:send` IPC handler
3. Stream chunks to renderer via IPC events
4. Display streaming text in ChatPanel

**Verification:**
- Send "Hello" → receive Claude response
- Streaming works in real-time

---

## Phase 3: Chat Panel (Week 4-5)

### Milestone 3.1: Message Rendering

**Objective:** Display user and assistant messages

**Tasks:**
1. Create `MessageBubble.tsx` component
2. Implement markdown rendering (react-markdown)
3. Add code block syntax highlighting (highlight.js)
4. Style user messages (right-aligned) vs assistant (left-aligned)
5. Implement message list with auto-scroll

**Verification:**
- Messages display correctly
- Markdown and code blocks render
- Auto-scrolls to latest message

---

### Milestone 3.2: Tool Call Cards

**Objective:** Display tool calls as collapsible cards

**Tasks:**
1. Create `ToolCallCard.tsx` component
2. Show tool name, summary, expand/collapse
3. Display tool input/output when expanded
4. Add [View Diff] button for file edits
5. Style with icons per tool type

**Verification:**
- Tool calls display as cards
- Expand/collapse works
- File edits show diff preview

---

### Milestone 3.3: Streaming & Thinking

**Objective:** Real-time streaming with thinking blocks

**Tasks:**
1. Implement streaming text display with typing animation
2. Create `ThinkingBlock.tsx` (collapsible)
3. Handle partial tokens during streaming
4. Show "Claude is thinking..." indicator

**Verification:**
- Streaming feels smooth
- Thinking blocks collapsible
- No UI jank during streaming

---

### Milestone 3.4: Input Component

**Objective:** Multi-line input with send button

**Tasks:**
1. Create `ChatInput.tsx` with textarea
2. Implement Cmd+Enter to send
3. Add send button with loading state
4. Handle multi-line input (auto-resize)
5. Add `/` command palette trigger

**Verification:**
- Input works, Cmd+Enter sends
- Multi-line input auto-resizes
- Loading state during query

---

## Phase 4: Editor Panel (Week 6)

### Milestone 4.1: Monaco Editor Integration

**Objective:** Embed Monaco Editor for file preview

**Tasks:**
1. Install `@monaco-editor/react`
2. Create `EditorPanel.tsx` with Monaco
3. Configure Monaco for TypeScript/JavaScript
4. Implement read-only mode by default
5. Add theme switching (dark/light)

**Verification:**
- Monaco loads and displays code
- Syntax highlighting works
- Theme switching works

---

### Milestone 4.2: Diff View

**Objective:** Show file changes in diff mode

**Tasks:**
1. Use Monaco's diff editor
2. Display original vs modified side-by-side
3. Highlight added/removed lines
4. Add line numbers

**Verification:**
- Diff view displays correctly
- Changes clearly visible

---

### Milestone 4.3: File Tabs

**Objective:** Multiple files in tabs

**Tasks:**
1. Create tab bar component
2. Track open files in state
3. Switch between files on tab click
4. Close tab with X button
5. Show modified indicator (dot)

**Verification:**
- Multiple files open in tabs
- Switch between tabs works
- Close tabs works

---

### Milestone 4.4: Apply/Reject Changes

**Objective:** Apply or reject file changes

**Tasks:**
1. Add [Apply] and [Reject] buttons per file
2. Implement apply: write changes to disk via IPC
3. Implement reject: discard changes
4. Add bulk apply/reject for all files
5. Show success/error notifications

**Verification:**
- Apply writes changes to disk
- Reject discards changes
- Bulk operations work

---

## Phase 5: File Tree & Session Management (Week 7-8)

### Milestone 5.1: File Tree Component

**Objective:** Display project file tree

**Tasks:**
1. Create `FileTree.tsx` with recursive tree structure
2. Implement folder expand/collapse
3. Add file/folder icons
4. Implement click to preview file in editor
5. Add right-click context menu (copy path, add to context)

**Verification:**
- File tree displays project structure
- Expand/collapse works
- Click opens file in editor

---

### Milestone 5.2: File Watcher

**Objective:** Real-time file system updates

**Tasks:**
1. Integrate `chokidar` in main process
2. Watch project directory for changes
3. Push file system events to renderer via IPC
4. Update file tree on add/change/delete
5. Add git status indicators (M/A/D/?)

**Verification:**
- File tree updates in real-time
- Git status shows correctly

---

### Milestone 5.3: Session List

**Objective:** Display and manage sessions

**Tasks:**
1. Create `SessionList.tsx` in left panel (bottom)
2. Load sessions from disk via IPC
3. Display sessions grouped by date
4. Implement click to resume session
5. Add search/filter sessions

**Verification:**
- Sessions list displays
- Resume session works
- Search filters sessions

---

### Milestone 5.4: Settings Panel

**Objective:** Visual settings editor

**Tasks:**
1. Create `SettingsPanel.tsx` (modal or sidebar)
2. Implement API key input with secure storage
3. Add permission mode selector (plan/auto/manual)
4. Add model selector
5. Add MCP server configuration UI
6. Save settings to disk via IPC

**Verification:**
- Settings panel opens
- Changes persist
- API key stored securely

---

### Milestone 5.5: Command Palette

**Objective:** Cmd+K command palette

**Tasks:**
1. Create `CommandPalette.tsx` (modal)
2. Implement fuzzy search (fuse.js)
3. List all `/` commands
4. Show recent commands at top
5. Execute command on select

**Verification:**
- Cmd+K opens palette
- Fuzzy search works
- Commands execute

---

## Phase 6: Polish & Package (Week 9-10)

### Milestone 6.1: Permission Modal

**Objective:** Visual permission approval UI

**Tasks:**
1. Create `PermissionModal.tsx`
2. Display tool name, command/action preview
3. Add [Deny] and [Allow Once] buttons
4. Add "Always allow" checkbox
5. Handle permission response via IPC

**Verification:**
- Permission modal appears for tool calls
- Approve/deny works
- "Always allow" persists

---

### Milestone 6.2: Native OS Integration

**Objective:** System tray, notifications, hotkey

**Tasks:**
1. Implement system tray with menu
2. Add native notifications (electron notifications)
3. Implement global hotkey (Cmd+Shift+C) to toggle window
4. Add dock badge for pending permissions (macOS)

**Verification:**
- Tray icon appears with menu
- Notifications work
- Global hotkey toggles window

---

### Milestone 6.3: Auto-Updater

**Objective:** Automatic updates

**Tasks:**
1. Integrate `electron-updater`
2. Configure update server (GitHub releases)
3. Check for updates on launch
4. Show update notification
5. Download and install updates

**Verification:**
- Update check works
- Update downloads and installs

---

### Milestone 6.4: Packaging

**Objective:** Build distributable packages

**Tasks:**
1. Configure `electron-builder.yml`:
   - macOS: DMG + auto-update
   - Windows: NSIS installer
   - Linux: AppImage
2. Set up code signing (macOS/Windows)
3. Create build scripts
4. Test packages on all platforms

**Verification:**
- DMG/exe/AppImage build successfully
- Apps launch and work
- Auto-update works

---

### Milestone 6.5: Performance Optimization

**Objective:** Optimize rendering and memory

**Tasks:**
1. Implement virtual scrolling for message list
2. Lazy load Monaco Editor
3. Debounce file tree updates
4. Optimize IPC message size
5. Add performance monitoring

**Verification:**
- Smooth scrolling with 1000+ messages
- Low memory usage
- Fast startup time

---

## Critical Dependencies

### Core Package Dependencies
- `@anthropic-ai/sdk` - API client
- `@modelcontextprotocol/sdk` - MCP protocol
- `zod` - Schema validation
- `chalk` - Terminal colors (for CLI only)

### Desktop Package Dependencies
- `electron` - Desktop framework
- `react` + `react-dom` - UI framework
- `@monaco-editor/react` - Code editor
- `react-resizable-panels` - Panel layout
- `tailwindcss` - Styling
- `chokidar` - File watching
- `fuse.js` - Fuzzy search
- `react-markdown` - Markdown rendering
- `highlight.js` - Syntax highlighting
- `electron-updater` - Auto-updates
- `electron-builder` - Packaging

---

## Risk Mitigation

### Risk 1: Tool Rendering Separation
**Risk:** Tools have React rendering mixed with logic
**Mitigation:** 
- Phase 1.5 explicitly separates tool logic from UI
- Core tools export data, CLI/Desktop render separately
- Test with 3-4 representative tools first

### Risk 2: AppState React Dependency
**Risk:** AppState.tsx is a React Context Provider
**Mitigation:**
- Extract pure types to core
- Keep React wrapper in CLI
- Desktop creates its own state management

### Risk 3: Import Path Hell
**Risk:** Circular dependencies, broken imports after extraction
**Mitigation:**
- Move modules in dependency order (API → Query → Tools → State)
- Test CLI after each milestone
- Use relative imports in core (no path aliases)

### Risk 4: Bun vs Node Compatibility
**Risk:** Core uses Bun-specific APIs, breaks in Electron (Node)
**Mitigation:**
- Avoid `Bun.*` APIs in core
- Use standard Node.js APIs
- Test core with Node runtime

### Risk 5: Performance - Large Message Lists
**Risk:** Rendering 1000+ messages causes lag
**Mitigation:**
- Implement virtual scrolling (react-window)
- Lazy load Monaco Editor
- Debounce file tree updates

---

## Success Criteria

### Phase 1 Complete
- ✅ Core package builds successfully
- ✅ CLI runs with core as dependency
- ✅ All tools work in CLI
- ✅ No React/Ink imports in core

### Phase 2 Complete
- ✅ Desktop app launches
- ✅ Three-panel layout renders
- ✅ Basic query flow works (send message → receive response)

### Phase 3 Complete
- ✅ Messages display with markdown/code highlighting
- ✅ Tool calls show as cards
- ✅ Streaming works smoothly
- ✅ Input sends messages

### Phase 4 Complete
- ✅ Monaco Editor displays code
- ✅ Diff view shows changes
- ✅ Apply/reject changes work

### Phase 5 Complete
- ✅ File tree displays and updates
- ✅ Sessions list and resume work
- ✅ Settings panel functional
- ✅ Command palette works

### Phase 6 Complete
- ✅ Permission modal works
- ✅ System tray + notifications work
- ✅ Packages build for macOS/Windows/Linux
- ✅ Auto-updater functional

---

## Timeline Summary

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Phase 1 | Week 1-2 | Core package extracted, CLI works |
| Phase 2 | Week 3 | Desktop skeleton, basic query flow |
| Phase 3 | Week 4-5 | Chat panel complete |
| Phase 4 | Week 6 | Editor panel complete |
| Phase 5 | Week 7-8 | File tree + sessions complete |
| Phase 6 | Week 9-10 | Polished, packaged, ready to ship |

**Total:** 10 weeks

---

## Next Steps

1. Review this plan with stakeholders
2. Set up project tracking (GitHub issues/milestones)
3. Begin Phase 1.1: Create core package structure
4. Daily standups to track progress
5. Weekly demos to show progress

---

## Notes

- This plan assumes 1 full-time developer
- Phases can be parallelized with multiple developers
- CLI remains fully functional throughout
- Desktop is additive, not replacing CLI
- All changes committed incrementally
- Each milestone is independently testable

