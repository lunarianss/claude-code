/**
 * QueryBridge — spawns the CLI subprocess in stream-json mode and bridges
 * SDKMessage events to/from the Electron renderer via IPC.
 *
 * Architecture:
 *   Renderer ──IPC──> Main Process ──stdin──> CLI subprocess
 *   Renderer <──IPC── Main Process <──stdout── CLI subprocess (stream-json)
 *
 * The CLI is spawned with:
 *   bun run src/entrypoints/cli.tsx --print --output-format stream-json --verbose
 *
 * Each line of stdout is a JSON-encoded SDKMessage. We parse it and forward
 * the relevant events to the renderer.
 */

import { BrowserWindow, ipcMain } from 'electron';
import { spawn, type ChildProcess } from 'child_process';
import { join } from 'path';
import { createInterface } from 'readline';

export interface QueryBridgeConfig {
  cwd: string;
  cliDir: string; // Path to the claude-code repo root
}

interface PendingPermission {
  resolve: (approved: boolean) => void;
}

let cliProcess: ChildProcess | null = null;
let abortController: AbortController | null = null;
let pendingPermissions = new Map<string, PendingPermission>();
let config: QueryBridgeConfig;

/**
 * Register all IPC handlers for the query bridge.
 */
export function registerQueryBridge(cfg: QueryBridgeConfig) {
  config = cfg;

  ipcMain.handle('query:send', async (event, message: string) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    await handleQuery(win, message);
  });

  ipcMain.on('query:cancel', () => {
    killCli();
  });

  ipcMain.on('permissions:respond', (_event, requestId: string, approved: boolean) => {
    const pending = pendingPermissions.get(requestId);
    if (pending) {
      pending.resolve(approved);
      pendingPermissions.delete(requestId);
    }
  });
}

function killCli() {
  if (cliProcess) {
    cliProcess.kill('SIGTERM');
    cliProcess = null;
  }
  abortController?.abort();
  abortController = null;
}

/**
 * Spawn CLI subprocess and stream events to renderer.
 */
async function handleQuery(win: BrowserWindow, message: string) {
  // Kill any previous query
  killCli();

  abortController = new AbortController();

  const args = [
    'run',
    join(config.cliDir, 'src/entrypoints/cli.tsx'),
    '--print',
    message,
    '--output-format',
    'stream-json',
    '--verbose',
    '--permission-mode',
    'acceptEdits',
    '--allowedTools',
    'WebSearch',
    'WebFetch',
  ];

  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    // Ensure non-interactive
    CLAUDE_CODE_ENTRYPOINT: 'sdk-cli',
  };

  try {
    cliProcess = spawn('bun', args, {
      cwd: config.cwd,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const proc = cliProcess;
    let fullAssistantText = '';

    // Parse stdout line-by-line (each line is a JSON SDKMessage)
    const rl = createInterface({ input: proc.stdout! });

    rl.on('line', (line: string) => {
      if (!line.trim()) return;

      let msg: any;
      try {
        msg = JSON.parse(line);
      } catch {
        // Not JSON — likely a log line, ignore
        return;
      }

      if (win.isDestroyed()) return;

      switch (msg.type) {
        case 'assistant': {
          // Complete assistant message
          const content = extractTextContent(msg);
          if (content) {
            fullAssistantText = content;
            win.webContents.send('query:stream-chunk', { text: content, done: false });
          }

          // Check for tool use blocks
          const toolUses = extractToolUses(msg);
          for (const tu of toolUses) {
            win.webContents.send('query:tool-call', {
              id: tu.id,
              name: tu.name,
              input: tu.input,
              status: 'running',
            });
          }
          break;
        }

        case 'partial_assistant': {
          // Streaming delta
          const event = msg.event;
          if (event?.type === 'content_block_delta' && event?.delta?.type === 'text_delta') {
            const text = event.delta.text || '';
            fullAssistantText += text;
            win.webContents.send('query:stream-chunk', { text, done: false });
          }
          break;
        }

        case 'user': {
          // Tool results come in message.content[] as tool_result blocks
          const userContent = msg.message?.content;
          if (Array.isArray(userContent)) {
            for (const block of userContent) {
              if (block.type === 'tool_result' && block.tool_use_id) {
                const resultContent = typeof block.content === 'string'
                  ? block.content
                  : Array.isArray(block.content)
                    ? block.content.map((c: any) => c.text || '').join('')
                    : JSON.stringify(block.content ?? '');
                win.webContents.send('query:tool-result', {
                  toolUseId: block.tool_use_id,
                  result: resultContent.slice(0, 2000),
                  isError: block.is_error || false,
                });
              }
            }
          }
          break;
        }

        case 'tool_progress': {
          win.webContents.send('query:tool-progress', {
            toolName: msg.tool_name,
            toolUseId: msg.tool_use_id,
            elapsed: msg.elapsed_time_seconds,
          });
          break;
        }

        case 'system': {
          // System events (model info, session state, etc.)
          if (msg.subtype === 'init') {
            win.webContents.send('query:system', {
              subtype: 'init',
              model: msg.model,
              sessionId: msg.session_id,
            });
          }
          break;
        }

        case 'result': {
          // Query complete
          win.webContents.send('query:stream-chunk', { text: '', done: true });
          win.webContents.send('query:result', {
            subtype: msg.subtype,
            result: msg.result,
            costUSD: msg.cost_usd,
            inputTokens: msg.usage?.input_tokens,
            outputTokens: msg.usage?.output_tokens,
          });
          break;
        }

        default:
          // Forward unknown types for debugging
          win.webContents.send('query:event', msg);
          break;
      }
    });

    // Capture stderr for errors/debugging
    const stderrChunks: string[] = [];
    proc.stderr?.on('data', (chunk: Buffer) => {
      stderrChunks.push(chunk.toString());
    });

    // Handle process exit
    await new Promise<void>((resolve, reject) => {
      proc.on('close', (code) => {
        cliProcess = null;
        if (code !== 0 && !abortController?.signal.aborted) {
          const stderr = stderrChunks.join('');
          if (!win.isDestroyed()) {
            win.webContents.send('query:error', {
              code,
              stderr: stderr.slice(0, 2000),
            });
            win.webContents.send('query:stream-chunk', { text: '', done: true });
          }
        }
        resolve();
      });

      proc.on('error', (err) => {
        if (!win.isDestroyed()) {
          win.webContents.send('query:error', {
            message: err.message,
          });
          win.webContents.send('query:stream-chunk', { text: '', done: true });
        }
        reject(err);
      });
    });
  } catch (err: unknown) {
    if ((err as Error).name !== 'AbortError' && !win.isDestroyed()) {
      win.webContents.send('query:error', {
        message: (err as Error).message,
      });
      win.webContents.send('query:stream-chunk', { text: '', done: true });
    }
  }
}

/**
 * Extract text content from an assistant message.
 */
function extractTextContent(msg: any): string {
  const content = msg.message?.content || msg.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('');
  }
  return '';
}

/**
 * Extract tool_use blocks from assistant message content.
 */
function extractToolUses(msg: any): { id: string; name: string; input: unknown }[] {
  const content = msg.message?.content || msg.content;
  if (!Array.isArray(content)) return [];
  return content
    .filter((block: any) => block.type === 'tool_use')
    .map((block: any) => ({
      id: block.id,
      name: block.name,
      input: block.input,
    }));
}
