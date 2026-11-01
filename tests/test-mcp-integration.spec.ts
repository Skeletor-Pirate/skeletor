import { describe, it, expect } from 'vitest';
import { mcpToolsToDefinitions, McpRegistry, type McpTool } from '../src/mcp.js';
import { BUILTIN_TOOL_DEFINITIONS } from '../src/loop.js';

describe('MCP Integration', () => {
  it('should prefix MCP tool definitions with mcp__<server>__<name>', () => {
    const mockTools: McpTool[] = [
      {
        server: 'playwright',
        name: 'screenshot',
        description: 'Take a screenshot',
        inputSchema: { type: 'object', properties: { url: { type: 'string' } } },
      },
      {
        server: 'git',
        name: 'status',
        description: 'Git status',
        inputSchema: { type: 'object', properties: {} },
      },
    ];

    const defs = mcpToolsToDefinitions(mockTools);
    expect(defs).toHaveLength(2);
    expect(defs[0].function.name).toBe('mcp__playwright__screenshot');
    expect(defs[1].function.name).toBe('mcp__git__status');
  });

  it('should include full suite of builtin tools in loop', () => {
    const names = BUILTIN_TOOL_DEFINITIONS.map(d => d.function.name);
    expect(names).toContain('Read');
    expect(names).toContain('Write');
    expect(names).toContain('Edit');
    expect(names).toContain('Bash');
    expect(names).toContain('Git');
    expect(names).toContain('Glob');
    expect(names).toContain('Grep');
    expect(names).toContain('LS');
    expect(names).toContain('Fetch');
    expect(names).toContain('RepoMap');
  });
});
