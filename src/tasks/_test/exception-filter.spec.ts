import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { INestApplication, UseFilters } from '@nestjs/common';
import { Ctx, Payload } from '@nestjs/microservices';
import { Test } from '@nestjs/testing';
import {
  MCP_STRATEGY,
  McpContext,
  McpController,
  McpExceptionFilter,
  Tool,
} from '@rekog/mcp-nest';
import { z } from 'zod';
import { createHttpMcpStrategy } from '../../mcp.strategy';
import { TasksService } from '../tasks.service';
import { callTool, textOf } from './mcp-client';

/**
 * The same controller twice, with and without the filter, so the difference is
 * visible rather than asserted in prose. This is the gotcha from the post: your
 * domain exceptions are flattened unless you opt in.
 */
@McpController()
class UnfilteredController {
  constructor(private readonly tasks: TasksService) {}

  @Tool({
    name: 'close-task',
    description: 'Mark a task as done.',
    parameters: z.object({ id: z.string() }),
  })
  close(@Payload() { id }: { id: string }, @Ctx() _ctx: McpContext) {
    return { content: [{ type: 'text' as const, text: this.tasks.close(id).id }] };
  }
}

@McpController()
@UseFilters(McpExceptionFilter)
class FilteredController {
  constructor(private readonly tasks: TasksService) {}

  @Tool({
    name: 'close-task',
    description: 'Mark a task as done.',
    parameters: z.object({ id: z.string() }),
  })
  close(@Payload() { id }: { id: string }, @Ctx() _ctx: McpContext) {
    return { content: [{ type: 'text' as const, text: this.tasks.close(id).id }] };
  }
}

async function bootstrap(controller: any): Promise<INestApplication> {
  const mcp = createHttpMcpStrategy();

  const moduleRef = await Test.createTestingModule({
    controllers: [controller],
    providers: [TasksService, { provide: MCP_STRATEGY, useValue: mcp }],
  }).compile();

  const app = moduleRef.createNestApplication();
  mcp.setHttpAdapter(app.getHttpAdapter());
  app.connectMicroservice({ strategy: mcp });

  await app.startAllMicroservices();
  await app.init();

  return app;
}

describe('McpExceptionFilter', () => {
  it('WITHOUT the filter, a NotFoundException reaches the model as "Internal server error"', async () => {
    const app = await bootstrap(UnfilteredController);

    try {
      const result = await callTool(app, 'close-task', { id: 'NOPE' });

      assert.equal(result.result.isError, true);
      assert.equal(textOf(result), 'Internal server error');
      // The model is told nothing actionable, so it cannot correct itself.
      assert.doesNotMatch(textOf(result), /NOPE/);
    } finally {
      await app.close();
    }
  });

  it('WITH the filter, the model gets the real message and can retry', async () => {
    const app = await bootstrap(FilteredController);

    try {
      const result = await callTool(app, 'close-task', { id: 'NOPE' });

      assert.equal(result.result.isError, true);
      assert.equal(textOf(result), 'Task NOPE does not exist');
    } finally {
      await app.close();
    }
  });
});
