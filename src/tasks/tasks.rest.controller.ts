import { Controller, Get, Param, Query } from '@nestjs/common';
import { TasksService } from './tasks.service';

/**
 * A normal REST controller, here only to prove a point made in the post: the
 * same process serves your existing HTTP API and the MCP server side by side.
 * Both call the same TasksService.
 */
@Controller('tasks')
export class TasksRestController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  findAll(@Query('status') status?: 'open' | 'done') {
    return this.tasks.findAll({ status });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tasks.findOne(id);
  }
}
