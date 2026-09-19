import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MCP_STRATEGY } from '@rekog/mcp-nest';
import request from 'supertest';
import { createHttpMcpStrategy } from '../../mcp.strategy';
import { TasksModule } from '../tasks.module';
import { TasksService } from '../tasks.service';
import { callTool, rpc, textOf } from './mcp-client';

describe('Tasks over MCP', () => {
  let app: INestApplication;
  let tasks: TasksService;

  before(async () => {
    const mcp = createHttpMcpStrategy();

    const moduleRef = await Test.createTestingModule({
      imports: [TasksModule],
      providers: [{ provide: MCP_STRATEGY, useValue: mcp }],
    }).compile();

    app = moduleRef.createNestApplication();
    mcp.setHttpAdapter(app.getHttpAdapter());
    app.connectMicroservice({ strategy: mcp });

    await app.startAllMicroservices();
    await app.init();

    tasks = app.get(TasksService);
  });

  beforeEach(() => tasks.reset());
  after(() => app.close());

  describe('tools/list', () => {
    it('advertises both tools', async () => {
      const body = await rpc(app, 'tools/list');
      const names = body.result.tools.map((tool: any) => tool.name);

      assert.ok(names.includes('list-tasks'));
      assert.ok(names.includes('close-task'));
    });

    it('converts the Zod schema into JSON Schema, enum included', async () => {
      const body = await rpc(app, 'tools/list');
      const listTasks = body.result.tools.find((tool: any) => tool.name === 'list-tasks');

      assert.equal(listTasks.inputSchema.type, 'object');
      assert.deepEqual(listTasks.inputSchema.properties.status, {
        type: 'string',
        enum: ['open', 'done'],
      });
      assert.deepEqual(listTasks.inputSchema.properties.assignee, { type: 'string' });
    });

    it('passes the annotations through to the client', async () => {
      const body = await rpc(app, 'tools/list');
      const closeTask = body.result.tools.find((tool: any) => tool.name === 'close-task');

      // These drive whether a client asks the user before calling. Be honest.
      assert.equal(closeTask.annotations.destructiveHint, false);
      assert.equal(closeTask.annotations.idempotentHint, true);
    });
  });

  describe('tools/call', () => {
    it('filters through the injected service', async () => {
      const result = await callTool(app, 'list-tasks', { status: 'open' });

      assert.match(textOf(result), /2 task\(s\)/);
      assert.match(textOf(result), /T-1/);
      assert.doesNotMatch(textOf(result), /T-3/);
    });

    it('mutates real state', async () => {
      await callTool(app, 'close-task', { id: 'T-1' });

      assert.equal(tasks.findOne('T-1').status, 'done');
    });

    it('reports a failure as a SUCCESSFUL result with isError, not a JSON-RPC error', async () => {
      const result = await callTool(app, 'close-task', { id: 'NOPE' });

      // This is the shape that surprises people coming from REST. The model is
      // meant to read the failure and decide what to do next, so a tool failure
      // must not break the JSON-RPC conversation.
      assert.equal(result.error, undefined);
      assert.equal(result.result.isError, true);
    });

    it('validates arguments with Zod and explains what was wrong', async () => {
      const result = await callTool(app, 'close-task', { id: 123 });

      assert.equal(result.result.isError, true);
      assert.match(textOf(result), /expected string, received number/);
    });
  });

  describe('resources and prompts', () => {
    it('lists and reads the open-tasks resource', async () => {
      const list = await rpc(app, 'resources/list');
      assert.equal(list.result.resources[0].uri, 'tasks://open');
      assert.equal(list.result.resources[0].mimeType, 'application/json');

      const read = await rpc(app, 'resources/read', { uri: 'tasks://open' });
      const contents = JSON.parse(read.result.contents[0].text);

      assert.equal(contents.length, 2);
      assert.ok(contents.every((task: any) => task.status === 'open'));
    });

    it('builds the standup prompt from live data', async () => {
      const body = await rpc(app, 'prompts/get', {
        name: 'standup-summary',
        arguments: { assignee: 'ana' },
      });

      const text = body.result.messages[0].content.text;

      assert.match(text, /Fix the flaky test/);
      assert.doesNotMatch(text, /Write the blog post/);
    });
  });

  it('serves the REST API from the same application', async () => {
    // The point being made in the post: MCP is an extra transport over the
    // service you already expose, not a separate deployment.
    const response = await request(app.getHttpServer()).get('/tasks?status=done');

    assert.equal(response.status, 200);
    assert.equal(response.body.length, 1);
    assert.equal(response.body[0].id, 'T-3');
  });
});
