import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { spawn } from 'node:child_process';
import path from 'node:path';

/**
 * Drives the STDIO entrypoint the way Claude Desktop does: spawn it, write
 * JSON-RPC frames to stdin, read them back from stdout.
 *
 * Requires `npm run build` first, which is what CI does.
 */
function speak(frames: string[], timeoutMs = 20000): Promise<string[]> {
  const entrypoint = path.join(__dirname, '..', '..', '..', 'dist', 'main.stdio.js');

  return new Promise((resolve, reject) => {
    const child = spawn('node', [entrypoint], { stdio: ['pipe', 'pipe', 'pipe'] });
    const lines: string[] = [];
    let buffer = '';

    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Timed out. Received: ${JSON.stringify(lines)}`));
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      buffer += chunk.toString();
      const parts = buffer.split('\n');
      buffer = parts.pop() ?? '';

      for (const part of parts) {
        if (part.trim()) lines.push(part);
      }

      if (lines.length >= frames.filter((f) => f.includes('"id"')).length) {
        clearTimeout(timer);
        child.kill();
        resolve(lines);
      }
    });

    child.on('error', reject);

    for (const frame of frames) child.stdin.write(`${frame}\n`);
  });
}

describe('STDIO transport', () => {
  it('completes the handshake and answers a tool call on stdout', { timeout: 30000 }, async () => {
    const lines = await speak([
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'jest', version: '1' },
        },
      }),
      JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
      JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'list-tasks', arguments: { status: 'open' } },
      }),
    ]);

    // Every line must be parseable JSON. This is the real assertion: with
    // logger: false, nothing but the protocol reaches stdout. Leave Nest's
    // logger on and this test fails on the startup banner.
    const messages = lines.map((line) => JSON.parse(line));

    assert.equal(messages[0].result.serverInfo.name, 'tasks-mcp');
    assert.match(messages[1].result.content[0].text, /T-1/);
  });
});
