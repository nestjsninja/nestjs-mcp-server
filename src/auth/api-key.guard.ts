import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { McpContext } from '@rekog/mcp-nest';

/**
 * A normal NestJS guard, applied to MCP tools.
 *
 * Two things to notice:
 *
 * 1. `switchToRpc()`, not `switchToHttp()`. Under the strategy API an MCP tool
 *    is a microservice message handler, so the HTTP request is reached through
 *    the MCP context's `getRawRequest()`.
 * 2. This guard protects `tools/call`. It does NOT protect `tools/list`, which
 *    the transport answers before any handler runs. See
 *    `_test/api-key.guard.spec.ts`. If your tool list is sensitive, authenticate
 *    in front of the endpoint instead.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const mcp = context.switchToRpc().getContext<McpContext>();
    const request = mcp.getRawRequest<{ headers: Record<string, string> }>();
    const expected = `Bearer ${process.env.MCP_API_KEY ?? 'dev-key'}`;

    if (request?.headers?.authorization !== expected) {
      throw new UnauthorizedException('Missing or invalid API key');
    }

    return true;
  }
}
