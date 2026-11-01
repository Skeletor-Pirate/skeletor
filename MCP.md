# MCP Integration in Agent Hub

Agent Hub includes an MCP bridge that runs MCP servers as stdio processes and exports their tools into the Agent Hub tool surface.

## Server Registry

MCP servers are defined in `~/.agenthub/config.json`:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"],
      "env": { "TERM": "dumb" }
    },
    "git": {
      "command": "uvx",
      "args": ["mcp-server-git"],
      "env": { "GIT_DIR": "~/.agenthub" }
    },
    "fetch": {
      "command": "uvx",
      "args": ["mcp-server-fetch"]
    },
    "memory": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"],
      "env": { "MCP_SERVER_MEMORY_CACHE": "~/.agenthub/.mcp-memory" }
    }
  }
}
```

Each server is started via `spawn()` with its configured command, args, and env.

## Tool Naming Convention

MCP tools are exposed in the Agent Hub tool surface with the format `{server}__{tool}`:

- `mcp__playwright__screenshot`
- `mcp__git__status`
- `mcp__fetch__read`
- `mcp__memory__read`

This ensures uniqueness across different MCP servers and allows the Agent Loop to dispatch calls to the correct server.

## Tool Execution

When the Agent Loop executes a tool call:

1. It checks if the tool name starts with `mcp__`
2. It splits the name to extract server name and tool name
3. It calls the registered MCP server's `callTool()` method
4. The result (including error status) is returned as a string

## Tool Definitions

MCP server tool schemas are converted to OpenAI-compatible tool definitions via `mcpToolsToDefinitions()`:

```typescript
export function mcpToolsToDefinitions(tools: McpTool[]): ToolDefinition[] {
  return tools.map(t => ({
    type: 'function',
    function: {
      name: `${t.server}__${t.name}`,
      description: t.description || `${t.server} tool`,
      parameters: t.inputSchema ?? { type: 'object', properties: {} },
    },
  }));
}
```

## Lifecycle Management

MCP servers are started in `AgentHub.startAll()` when the Agent Hub is initialized and stopped via `AgentHub.stopAll()` when the Agent Hub exits or the REPL ends.

## MCP Server Autostart with Skills

Skills that require MCP can be declared with a `mcp` property:

```markdown
---
name: Screenshot the page
mcp: playwright
---

Take a screenshot of the current page using the Playwright MCP server.
```

When the skill's tool is called, the Agent Hub will automatically execute the appropriate MCP server call.

## Error Handling

MCP servers may fail to start or execute. The Agent Hub:

- Logs errors to stderr with `[mcp] error: ...`
- Reports tool execution errors as strings with `isError: true`
- Gracefully handles server exit and processes the MCP server exit code

## Security Considerations

- MCP servers run in separate processes with limited permissions
- Environment variables are forwarded from the agent environment
- Tool calls are limited to the defined server/tool mappings

## Configuring Additional MCP Servers

Add new MCP servers to the `mcpServers` section in `~/.agenthub/config.json`. Supported commands include:

- `npx` (standard Node.js package runner)
- `uvx` (Python package runner)
- Custom shell commands

The Agent Hub reads the configuration on startup and attempts to start each server.
