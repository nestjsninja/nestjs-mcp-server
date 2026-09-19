import { McpStrategy, StreamableHttpTransport } from '@rekog/mcp-nest';

/**
 * The strategy IS the configuration. There is no McpModule in v2 of
 * @rekog/mcp-nest; you build one of these and hand it to connectMicroservice().
 *
 * statefulMode: false keeps every request independent, so any instance can
 * serve any request. That is what you want behind a load balancer. Switch it on
 * only when you need the server to push notifications to a connected client,
 * and accept that you have taken on sticky sessions.
 */
export function createHttpMcpStrategy(): McpStrategy {
  return new McpStrategy({
    name: 'tasks-mcp',
    version: '1.0.0',
    instructions:
      'A small task tracker. Use list-tasks to see what exists before closing anything.',
    transports: [new StreamableHttpTransport({ statefulMode: false })],
  });
}
