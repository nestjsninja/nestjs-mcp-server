import { Injectable, NotFoundException } from '@nestjs/common';
import { Task, TaskFilter } from './task';

/**
 * A completely ordinary NestJS service. It knows nothing about MCP, and that is
 * the point: the MCP layer is a transport over the domain you already have.
 *
 * In a real project the Map below is your TypeORM repository, your Prisma
 * client, or an HTTP client to another service.
 */
@Injectable()
export class TasksService {
  private tasks = new Map<string, Task>();

  constructor() {
    this.reset();
  }

  findAll(filter: TaskFilter = {}): Task[] {
    return [...this.tasks.values()].filter(
      (task) =>
        (!filter.status || task.status === filter.status) &&
        (!filter.assignee || task.assignee === filter.assignee),
    );
  }

  findOne(id: string): Task {
    const task = this.tasks.get(id);

    if (!task) {
      throw new NotFoundException(`Task ${id} does not exist`);
    }

    return task;
  }

  close(id: string): Task {
    const task = this.findOne(id);
    task.status = 'done';

    return task;
  }

  /** Test helper, so each spec starts from the same three tasks. */
  reset(): void {
    this.tasks = new Map<string, Task>([
      ['T-1', { id: 'T-1', title: 'Ship the MCP server', status: 'open', assignee: 'henrique' }],
      ['T-2', { id: 'T-2', title: 'Write the blog post', status: 'open', assignee: 'henrique' }],
      ['T-3', { id: 'T-3', title: 'Fix the flaky test', status: 'done', assignee: 'ana' }],
    ]);
  }
}
