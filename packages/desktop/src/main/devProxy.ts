/**
 * Dev WebSocket proxy — runs alongside Vite dev server to bridge
 * browser ↔ CLI subprocess communication without Electron.
 *
 * Usage: bun run packages/desktop/src/main/devProxy.ts
 *
 * The browser connects via WebSocket (ws://localhost:5174).
 * Messages from browser → spawn CLI with --print --output-format stream-json --verbose
 * Events from CLI stdout → send to browser via WebSocket.
 */

import { spawn, type ChildProcess } from 'child_process';
import { join } from 'path';
import type { ServerWebSocket } from 'bun';

const WS_PORT = 5174;
const CLI_DIR = join(import.meta.dir, '../../../../');

let cliProcess: ChildProcess | null = null;
let activeWs: ServerWebSocket<unknown> | null = null;

function killCli() {
  if (cliProcess) {
    cliProcess.kill('SIGTERM');
    cliProcess = null;
  }
}

function wsSend(data: object) {
  try {
    if (activeWs) {
      activeWs.send(JSON.stringify(data));
    }
  } catch (e) {
    console.error('[devProxy] wsSend error:', e);
  }
}

const server = Bun.serve({
  port: WS_PORT,
  fetch(req, server) {
    if (server.upgrade(req)) return;
    return new Response('Claude Codex Dev Proxy', { status: 200 });
  },
  websocket: {
    open(ws) {
      console.log('[devProxy] Browser connected');
      activeWs = ws;
    },
    message(ws, data) {
      const text = typeof data === 'string' ? data : new TextDecoder().decode(data as ArrayBuffer);
      let msg: any;
      try {
        msg = JSON.parse(text);
      } catch {
        return;
      }

      if (msg.type === 'query:send') {
        handleQuery(msg.message);
      } else if (msg.type === 'query:cancel') {
        killCli();
        wsSend({ type: 'query:stream-chunk', data: { text: '', done: true } });
      }
    },
    close() {
      console.log('[devProxy] Browser disconnected');
      activeWs = null;
      killCli();
    },
  },
});

function handleQuery(message: string) {
  killCli();

  console.log(`[devProxy] Query: "${message.slice(0, 80)}"`);

  const args = [
    'run',
    join(CLI_DIR, 'src/entrypoints/cli.tsx'),
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

  cliProcess = spawn('bun', args, {
    cwd: CLI_DIR,
    env: {
      ...process.env,
      CLAUDE_CODE_ENTRYPOINT: 'sdk-cli',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const proc = cliProcess;
  let stdoutBuffer = '';

  proc.stdout!.on('data', (chunk: Buffer) => {
    stdoutBuffer += chunk.toString();
    // Process complete lines
    let newlineIdx: number;
    while ((newlineIdx = stdoutBuffer.indexOf('\n')) !== -1) {
      const line = stdoutBuffer.slice(0, newlineIdx).trim();
      stdoutBuffer = stdoutBuffer.slice(newlineIdx + 1);
      if (line) processLine(line);
    }
  });

  proc.stderr!.on('data', (chunk: Buffer) => {
    const text = chunk.toString().trim();
    if (text) console.error(`[devProxy] stderr: ${text.slice(0, 300)}`);
  });

  proc.on('close', (code) => {
    cliProcess = null;
    // Process any remaining buffer
    if (stdoutBuffer.trim()) processLine(stdoutBuffer.trim());
    console.log(`[devProxy] CLI exited with code ${code}`);
  });

  proc.on('error', (err) => {
    console.error(`[devProxy] spawn error: ${err.message}`);
    wsSend({ type: 'query:error', data: { message: err.message } });
    wsSend({ type: 'query:stream-chunk', data: { text: '', done: true } });
  });
}

function processLine(line: string) {
  let sdkMsg: any;
  try {
    sdkMsg = JSON.parse(line);
  } catch {
    console.log(`[devProxy] non-JSON line: ${line.slice(0, 100)}`);
    return;
  }

  console.log(`[devProxy] event: ${sdkMsg.type}${sdkMsg.subtype ? '/' + sdkMsg.subtype : ''}`);

  switch (sdkMsg.type) {
    case 'system': {
      wsSend({
        type: 'query:system',
        data: {
          subtype: sdkMsg.subtype,
          model: sdkMsg.model,
          sessionId: sdkMsg.session_id,
          tools: sdkMsg.tools,
        },
      });
      break;
    }
    case 'assistant': {
      const content = sdkMsg.message?.content;
      let text = '';
      if (typeof content === 'string') {
        text = content;
      } else if (Array.isArray(content)) {
        text = content
          .filter((b: any) => b.type === 'text')
          .map((b: any) => b.text)
          .join('');

        // Tool use blocks
        const toolUses = content.filter((b: any) => b.type === 'tool_use');
        for (const tu of toolUses) {
          wsSend({
            type: 'query:tool-call',
            data: { id: tu.id, name: tu.name, input: tu.input, status: 'running' },
          });
        }
      }

      if (text) {
        wsSend({
          type: 'query:stream-chunk',
          data: { text, done: false },
        });
      }
      break;
    }
    case 'user': {
      // Tool results come in message.content[] as tool_result blocks
      const userContent = sdkMsg.message?.content;
      if (Array.isArray(userContent)) {
        for (const block of userContent) {
          if (block.type === 'tool_result' && block.tool_use_id) {
            const resultContent = typeof block.content === 'string'
              ? block.content
              : Array.isArray(block.content)
                ? block.content.map((c: any) => c.text || '').join('')
                : JSON.stringify(block.content ?? '');
            wsSend({
              type: 'query:tool-result',
              data: {
                toolUseId: block.tool_use_id,
                result: resultContent.slice(0, 2000),
                isError: block.is_error || false,
              },
            });
          }
        }
      }
      break;
    }
    case 'result': {
      wsSend({
        type: 'query:stream-chunk',
        data: { text: '', done: true },
      });
      wsSend({
        type: 'query:result',
        data: {
          subtype: sdkMsg.subtype,
          result: sdkMsg.result,
          costUSD: sdkMsg.total_cost_usd,
          inputTokens: sdkMsg.usage?.input_tokens,
          outputTokens: sdkMsg.usage?.output_tokens,
        },
      });
      break;
    }
    default: {
      wsSend({ type: 'query:event', data: sdkMsg });
      break;
    }
  }
}

console.log(`[devProxy] WebSocket proxy running on ws://localhost:${WS_PORT}`);
console.log(`[devProxy] CLI dir: ${CLI_DIR}`);
