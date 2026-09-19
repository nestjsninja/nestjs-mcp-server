import { Module } from '@nestjs/common';
import { MCP_STRATEGY } from '@rekog/mcp-nest';
import { createHttpMcpStrategy } from './mcp.strategy';
import { TasksModule } from './tasks/tasks.module';

export const mcp = createHttpMcpStrategy();

@Module({
  imports: [TasksModule],
  providers: [{ provide: MCP_STRATEGY, useValue: mcp }],
})
export class AppModule {}
