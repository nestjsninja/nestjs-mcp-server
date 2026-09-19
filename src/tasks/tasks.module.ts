import { Module } from '@nestjs/common';
import { TasksMcpController } from './tasks.mcp.controller';
import { TasksRestController } from './tasks.rest.controller';
import { TasksService } from './tasks.service';

@Module({
  controllers: [TasksMcpController, TasksRestController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
