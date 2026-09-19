import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MCP_STRATEGY, McpStrategy, StdioTransport } from '@rekog/mcp-nest';
import { TasksModule } from './tasks/tasks.module';

const mcp = new McpStrategy({
  name: 'tasks-mcp',
  version: '1.0.0',
  transports: [new StdioTransport()],
});

@Module({
  imports: [TasksModule],
  providers: [{ provide: MCP_STRATEGY, useValue: mcp }],
})
class StdioModule {}

/**
 * STDIO, for local clients such as Claude Desktop and Claude Code, which launch
 * the server as a subprocess.
 *
 * logger: false is mandatory, not a preference. In STDIO mode stdout IS the
 * protocol channel, so Nest's startup banner (or any stray console.log) lands
 * in the middle of the JSON-RPC stream and the client drops the connection.
 * Log to stderr if you need logs.
 */
async function bootstrap() {
  const app = await NestFactory.createMicroservice(StdioModule, {
    strategy: mcp,
    logger: false,
  });

  await app.listen();
}

void bootstrap();
