import { describe, it, expect } from 'vitest';
import { AgentLoop } from '../src/loop.js';
import { LLMClient } from '../src/llm.js';
import { McpRegistry } from '../src/mcp.js';
import { toolBash } from '../src/tools.js';
import type { AgentHubConfig } from '../src/config.js';

describe('Continuous Autonomous Coding & Uninterrupted Terminal Engine', () => {
  const baseConfig: AgentHubConfig = {
    gatewayUrl: 'http://localhost:3001',
    apiKey: 'test',
    model: 'gpt-4',
    workspace: process.cwd(),
    skillsDirs: [],
    mcpServers: {},
    agents: {},
    logLevel: 'info',
    continuous: true,
    autoApprove: true,
  };

  it('should inject continuous mode directive and set maxSteps to uncapped', async () => {
    let capturedOptions: any = null;
    const mockLlm = {
      chat: async (messages: any[], options: any) => {
        capturedOptions = options;
        return {
          content: 'Task completed cleanly with zero errors.',
          steps: 1,
        };
      },
      listModels: async () => [],
    } as unknown as LLMClient;

    const mcp = new McpRegistry();
    const loop = new AgentLoop(mockLlm, baseConfig, mcp);
    await loop.init('Base system instructions');

    const result = await loop.run({
      prompt: 'Implement a continuous feature',
      model: 'gpt-4',
      continuous: true,
    });

    expect(result.response).toContain('Task completed');
    // Check that continuous mode directive was injected
    const continuousMsg = loop.messages.find(m => m.content?.includes('CONTINUOUS MODE ENGAGED'));
    expect(continuousMsg).toBeDefined();
    expect(continuousMsg?.content).toContain('UNLIMITED, UNCAPPED steps');
  });

  it('should auto-prompt to remediate and not stop when terminal failure occurs', async () => {
    let callCount = 0;
    const mockLlm = {
      chat: async (messages: any[]) => {
        callCount += 1;
        if (callCount === 1) {
          // Model invokes a bash tool that fails
          return {
            content: 'Running the test suite...',
            toolCalls: [
              {
                id: 'call_1',
                type: 'function',
                function: {
                  name: 'Bash',
                  arguments: JSON.stringify({ command: 'echo "FAIL: test_addition failed with AssertionError"' }),
                },
              },
            ],
          };
        }
        if (callCount === 2) {
          // Model outputs text while error is unresolved — continuous loop should push prompt and continue
          return {
            content: 'I noticed the error.',
          };
        }
        if (callCount === 3) {
          // Model fixes the file and tests pass
          return {
            content: 'Applied fix to test_addition.',
            toolCalls: [
              {
                id: 'call_2',
                type: 'function',
                function: {
                  name: 'Bash',
                  arguments: JSON.stringify({ command: 'echo "PASS: all 12 tests passed"' }),
                },
              },
            ],
          };
        }
        return {
          content: 'Continuous autonomous task fully solved and verified.',
        };
      },
      listModels: async () => [],
    } as unknown as LLMClient;

    const mcp = new McpRegistry();
    const loop = new AgentLoop(mockLlm, baseConfig, mcp);
    await loop.init('Base instructions');

    const result = await loop.run({
      prompt: 'Run test and fix bugs continuously',
      model: 'gpt-4',
      continuous: true,
    });

    expect(callCount).toBeGreaterThanOrEqual(3);
    expect(result.response).toContain('Continuous autonomous task fully solved');

    // Verify self-correction prompts were inserted
    const autonomousPrompts = loop.messages.filter(m => m.content?.includes('CONTINUOUS AUTONOMOUS MODE'));
    expect(autonomousPrompts.length).toBeGreaterThanOrEqual(1);
  }, 20000);

  it('should bypass confirmation in toolBash when continuous or autoApprove is active', async () => {
    const configWithContinuous: AgentHubConfig = {
      ...baseConfig,
      continuous: true,
      autoApprove: true,
    };

    const res = await toolBash({ command: 'echo "uninterrupted execution"' }, configWithContinuous);
    expect(res.needsConfirmation).toBeFalsy();
    expect(res.output).toContain('uninterrupted execution');
  }, 20000);
});
