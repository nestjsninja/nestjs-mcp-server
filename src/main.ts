import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule, mcp } from './app.module';

/**
 * Streamable HTTP. One process serves both the REST API (GET /tasks) and the
 * MCP server (POST /mcp) on port 3000.
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Required for HTTP transports: the MCP routes are mounted onto this adapter.
  mcp.setHttpAdapter(app.getHttpAdapter());
  app.connectMicroservice({ strategy: mcp });

  // Order matters. startAllMicroservices() mounts /mcp; calling listen() first
  // gives you a healthy app with a 404 where the MCP server should be.
  await app.startAllMicroservices();
  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
