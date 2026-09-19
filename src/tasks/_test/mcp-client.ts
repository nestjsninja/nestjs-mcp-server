import { INestApplication } from '@nestjs/common';
import request from 'supertest';

/**
 * A minimal MCP client over Streamable HTTP. The protocol is plain JSON-RPC, so
 * the tests can speak it directly without pulling in an SDK client.
 *
 * The Accept header carrying BOTH application/json and text/event-stream is
 * mandatory in the Streamable HTTP spec. It is the first thing to check when a
 * real client cannot connect.
 */
export async function rpc(
  app: INestApplication,
  method: string,
  params?: Record<string, unknown>,
  headers: Record<string, string> = {},
) {
  const response = await request(app.getHttpServer())
    .post('/mcp')
    .set('Accept', 'application/json, text/event-stream')
    .set('Content-Type', 'application/json')
    .set(headers)
    .send({ jsonrpc: '2.0', id: 1, method, ...(params ? { params } : {}) });

  return response.body;
}

export function callTool(
  app: INestApplication,
  name: string,
  args: Record<string, unknown> = {},
  headers: Record<string, string> = {},
) {
  return rpc(app, 'tools/call', { name, arguments: args }, headers);
}

/** The single text block of a tool result, which is where errors land too. */
export function textOf(result: any): string {
  return result?.result?.content?.[0]?.text ?? '';
}
