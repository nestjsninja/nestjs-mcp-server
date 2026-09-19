# Building an MCP Server with NestJS

[![CI](https://github.com/nestjsninja/nestjs-mcp-server/actions/workflows/ci.yml/badge.svg)](https://github.com/nestjsninja/nestjs-mcp-server/actions/workflows/ci.yml)

Example project for the blog post **"Building an MCP Server with NestJS"**.

📖 Read the post: https://nestjs-ninja.com/blog/2026-09-24-building-an-mcp-server-with-nestjs/

A small task tracker exposed over the **Model Context Protocol**, so an AI client
(Claude Desktop, Claude Code, ChatGPT, Cursor) can call it. The point of the
example is how little of it is MCP-specific:

- [`tasks.service.ts`](src/tasks/tasks.service.ts) is an ordinary
  `@Injectable()` that knows nothing about MCP.
- [`tasks.mcp.controller.ts`](src/tasks/tasks.mcp.controller.ts) exposes it as
  **two tools, one resource and one prompt**, with Zod schemas.
- [`tasks.rest.controller.ts`](src/tasks/tasks.rest.controller.ts) exposes the
  same service over REST, from the same process, to make the point that MCP is
  an extra transport rather than a separate deployment.

## Run it

```bash
npm install
npm run start:dev
```

`http://localhost:3000/mcp` is the MCP endpoint, `http://localhost:3000/tasks`
is the REST API.

MCP over Streamable HTTP is plain JSON-RPC, so `curl` is a perfectly good client:

```bash
curl -s -X POST http://127.0.0.1:3000/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

The `Accept` header must carry **both** `application/json` and
`text/event-stream`. It is mandatory in the Streamable HTTP spec, and it is the
first thing to check when a real client cannot connect.

## Connect a desktop client

Build first, then point the client at the STDIO entrypoint:

```bash
npm run build
```

```json
{
  "mcpServers": {
    "tasks": {
      "command": "node",
      "args": ["/absolute/path/to/nestjs-mcp-server/dist/main.stdio.js"]
    }
  }
}
```

Use an absolute path. The client does not run it from this directory.

## Tests

```bash
npm run build && npm test
```

21 tests, and they exist to prove the claims in the post rather than to pad a
coverage number:

| Spec | What it pins down |
| --- | --- |
| [`tasks.service.spec.ts`](src/tasks/_test/tasks.service.spec.ts) | The domain service on its own, with no MCP anywhere near it. |
| [`tasks.mcp.spec.ts`](src/tasks/_test/tasks.mcp.spec.ts) | Zod becomes JSON Schema, annotations reach the client, tools mutate real state, a failed call is a **successful** result with `isError: true`, and REST still works from the same app. |
| [`exception-filter.spec.ts`](src/tasks/_test/exception-filter.spec.ts) | The same controller with and without `McpExceptionFilter`, side by side: `"Internal server error"` vs. `"Task NOPE does not exist"`. |
| [`api-key.guard.spec.ts`](src/auth/_test/api-key.guard.spec.ts) | A guard protects `tools/call` and **does not** protect `tools/list`. The last test asserts that hole on purpose, so it stays visible. |
| [`stdio.spec.ts`](src/tasks/_test/stdio.spec.ts) | Spawns the STDIO server the way a desktop client does and parses every stdout line as JSON, which is what fails the moment a stray log escapes. |

`npm test` compiles with `tsc` and runs Node's built-in test runner. There is no
Jest here, and that is deliberate: NestJS 12 ships as **pure ESM**, which Jest's
CommonJS runtime cannot `require`. Compiling with `tsc` keeps
`emitDecoratorMetadata` (which NestJS DI needs, and which esbuild-based runners
do not emit) and Node 22 handles `require(esm)` natively.

## Two gotchas this repo exists to document

**1. Your exceptions reach the model as "Internal server error."**

`TasksService` throws `NotFoundException("Task NOPE does not exist")`. Without a
filter the model is told only `"Internal server error"`, so it cannot correct
itself. One decorator fixes it:

```ts
@McpController()
@UseFilters(McpExceptionFilter)
export class TasksMcpController {}
```

Note what that filter does, though: it forwards **every** `Error.message` to the
client. That is right for domain exceptions and wrong for a database driver
error carrying a connection string. Write your own mapping if anything you throw
could leak.

**2. Guards do not protect `tools/list`.**

`@UseGuards(ApiKeyGuard)` rejects unauthenticated `tools/call`, but discovery is
answered by the transport before any handler runs. Anyone who can reach `/mcp`
can enumerate every tool and its argument schema. If that matters, authenticate
in front of the endpoint (middleware, a reverse proxy, or OAuth) rather than
with a guard.

## Versions

Built against NestJS `12`, [`@rekog/mcp-nest`](https://github.com/rekog-labs/MCP-Nest)
`2.x`, the MCP SDK packages at `2.x`, and Zod `4`.

Two install notes that cost time:

- The `@rekog/mcp-nest` README still says to install `@modelcontextprotocol/sdk`.
  v2 needs the split packages instead: `@modelcontextprotocol/core`, `/node` and
  `/server`.
- `McpModule.forRoot()` is gone. v2 runs MCP as a NestJS **microservice
  transport strategy**, which is why guards, pipes, interceptors and exception
  filters apply to tools at all.
