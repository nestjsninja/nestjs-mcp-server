import { UseFilters } from '@nestjs/common';
import { Ctx, Payload } from '@nestjs/microservices';
import {
  McpContext,
  McpController,
  McpExceptionFilter,
  Prompt,
  Resource,
  Tool,
} from '@rekog/mcp-nest';
import { z } from 'zod';
import { TaskFilter } from './task';
import { TasksService } from './tasks.service';

/**
 * Tools, resources and prompts for the task tracker.
 *
 * `@UseFilters(McpExceptionFilter)` is load bearing. Without it a thrown
 * NotFoundException reaches the model as the string "Internal server error",
 * which tells it nothing and leaves it unable to correct itself. See
 * `_test/exception-filter.spec.ts` for both behaviours side by side.
 */
@McpController()
@UseFilters(McpExceptionFilter)
export class TasksMcpController {
  constructor(private readonly tasks: TasksService) {}

  @Tool({
    name: 'list-tasks',
    description:
      'List tasks in the tracker, optionally filtered by status or assignee. ' +
      'Returns every task when no filter is given.',
    parameters: z.object({
      status: z.enum(['open', 'done']).optional(),
      assignee: z.string().optional(),
    }),
    annotations: { readOnlyHint: true },
  })
  listTasks(@Payload() filter: TaskFilter) {
    const found = this.tasks.findAll(filter);

    return {
      content: [
        {
          type: 'text' as const,
          text:
            found.length === 0
              ? 'No tasks matched that filter.'
              : `${found.length} task(s):\n${JSON.stringify(found, null, 2)}`,
        },
      ],
    };
  }

  @Tool({
    name: 'close-task',
    description: 'Mark a single task as done, by its ID (for example "T-1").',
    parameters: z.object({ id: z.string() }),
    annotations: { destructiveHint: false, idempotentHint: true },
  })
  async closeTask(@Payload() { id }: { id: string }, @Ctx() ctx: McpContext) {
    await ctx.reportProgress({ progress: 50, total: 100 });
    const task = this.tasks.close(id);

    return {
      content: [{ type: 'text' as const, text: `Closed ${task.id}: ${task.title}` }],
    };
  }

  @Resource({
    uri: 'tasks://open',
    name: 'open-tasks',
    description: 'The current open tasks as JSON.',
    mimeType: 'application/json',
  })
  openTasks() {
    return {
      contents: [
        {
          uri: 'tasks://open',
          mimeType: 'application/json',
          text: JSON.stringify(this.tasks.findAll({ status: 'open' })),
        },
      ],
    };
  }

  @Prompt({
    name: 'standup-summary',
    description: 'Ask the model for a standup summary of one assignee’s tasks.',
    parameters: z.object({ assignee: z.string() }),
  })
  standupSummary(@Payload() { assignee }: { assignee: string }) {
    const tasks = this.tasks.findAll({ assignee });

    return {
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text:
              `Write a short standup update for ${assignee} based on these tasks, ` +
              `mentioning what is done and what is still open:\n${JSON.stringify(tasks, null, 2)}`,
          },
        },
      ],
    };
  }
}
