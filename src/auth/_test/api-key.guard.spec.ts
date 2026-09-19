import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { INestApplication, UseFilters, UseGuards } from '@nestjs/common';
import { Payload } from '@nestjs/microservices';
import { Test } from '@nestjs/testing';
import { MCP_STRATEGY, McpController, McpExceptionFilter, Tool } from '@rekog/mcp-nest';
import { z } from 'zod';
import { createHttpMcpStrategy } from '../../mcp.strategy';
import { TasksService } from '../../tasks/tasks.service';
import { callTool, rpc, textOf } from '../../tasks/_test/mcp-client';
import { ApiKeyGuard } from '../api-key.guard';

@McpController()
@UseFilters(McpExceptionFilter)
@UseGuards(ApiKeyGuard)
class GuardedController {
  constructor(private readonly tasks: TasksService) {}

  @Tool({
    name: 'list-tasks',
    description: 'List tasks in the tracker.',
    parameters: z.object({ status: z.enum(['open', 'done']).optional() }),
  })
  list(@Payload() filter: { status?: 'open' | 'done' }) {
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(this.tasks.findAll(filter)) }],
    };
  }
}

describe('ApiKeyGuard on MCP tools', () => {
  let app: INestApplication;
  const authorised = { Authorization: 'Bearer dev-key' };

  before(async () => {
    const mcp = createHttpMcpStrategy();

    const moduleRef = await Test.createTestingModule({
      controllers: [GuardedController],
      providers: [TasksService, { provide: MCP_STRATEGY, useValue: mcp }],
    }).compile();

    app = moduleRef.createNestApplication();
    mcp.setHttpAdapter(app.getHttpAdapter());
    app.connectMicroservice({ strategy: mcp });

    await app.startAllMicroservices();
    await app.init();
  });

  after(() => app.close());

  it('rejects tools/call without a key', async () => {
    const result = await callTool(app, 'list-tasks', {});

    assert.equal(result.result.isError, true);
    assert.equal(textOf(result), 'Missing or invalid API key');
  });

  it('rejects tools/call with the wrong key', async () => {
    const result = await callTool(app, 'list-tasks', {}, { Authorization: 'Bearer nope' });

    assert.equal(result.result.isError, true);
  });

  it('allows tools/call with the right key', async () => {
    const result = await callTool(app, 'list-tasks', { status: 'done' }, authorised);

    assert.equal(result.result.isError, undefined);
    assert.match(textOf(result), /T-3/);
  });

  it('DOES NOT protect tools/list: discovery answers unauthenticated', async () => {
    // The gotcha from the post. The transport answers tools/list before any
    // handler runs, so a controller guard never sees it. Anyone who can reach
    // /mcp can enumerate your tools and their argument schemas.
    //
    // This test asserts the CURRENT behaviour so the hole stays visible. If
    // your tool list is sensitive, authenticate in front of the endpoint
    // (middleware, a reverse proxy, or OAuth) rather than with a guard.
    const body = await rpc(app, 'tools/list');

    assert.equal(body.error, undefined);
    assert.ok(body.result.tools.map((tool: any) => tool.name).includes('list-tasks'));
    assert.ok(body.result.tools[0].inputSchema);
  });
});
