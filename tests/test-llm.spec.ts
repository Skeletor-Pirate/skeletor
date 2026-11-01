import { describe, it, expect } from 'vitest';
import { LLMClient } from '../src/llm.js';

describe('LLM Client', () => {
  it('should normalize gateway URL', async () => {
    const client = new LLMClient({
      gatewayUrl: 'http://localhost:3001/v1/',
      apiKey: 'test',
      model: 'auto',
      workspace: '.',
      skillsDirs: [],
      mcpServers: {},
      agents: {},
      logLevel: 'info',
    });
    // Access private method via any
    const root = (client as any).rootUrl();
    expect(root).toBe('http://localhost:3001');
  });

  it('should throw on HTTP error', async () => {
    const client = new LLMClient({
      gatewayUrl: 'http://localhost:3000',
      apiKey: 'bad',
      model: 'auto',
      workspace: '.',
      skillsDirs: [],
      mcpServers: {},
      agents: {},
      logLevel: 'info',
    });
    await expect(client.chat([{ role: 'user', content: 'hi' }])).rejects.toThrow();
  });
});
