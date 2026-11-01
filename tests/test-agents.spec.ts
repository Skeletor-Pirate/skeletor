import { describe, it, expect } from 'vitest';
import {
  BUILTIN_AGENTS,
  agentInfo,
  claudeEnv,
  codexArgs,
  aiderArgs,
} from '../src/agents.js';
import type { AgentHubConfig } from '../src/config.js';

const config: AgentHubConfig = {
  gatewayUrl: 'http://localhost:3001',
  apiKey: 'free_test',
  model: 'auto',
  workspace: '/tmp',
  skillsDirs: [],
  mcpServers: {},
  agents: {},
  logLevel: 'info',
};

describe('Agents', () => {
  it('should list all builtin agents', () => {
    expect(BUILTIN_AGENTS.length).toBeGreaterThan(10);
    const ids = BUILTIN_AGENTS.map(a => a.id);
    expect(ids).toContain('claude');
    expect(ids).toContain('codex');
    expect(ids).toContain('aider');
    expect(ids).toContain('opencode');
  });

  it('should find agent info by id', () => {
    const info = agentInfo('claude');
    expect(info).toBeDefined();
    expect(info?.name).toBe('Claude Code');
  });

  it('should return undefined for unknown agent', () => {
    expect(agentInfo('unknown')).toBeUndefined();
  });

  it('should build claude env without leaking real keys', () => {
    const env = claudeEnv(config, 'free_test', 'auto');
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(env.ANTHROPIC_AUTH_TOKEN).toBe('free_test');
    expect(env.ANTHROPIC_BASE_URL).toBe('http://localhost:3001');
    expect(env.ANTHROPIC_MODEL).toBe('auto');
  });

  it('should build codex args', () => {
    const args = codexArgs(config, 'auto');
    expect(args).toContain('-c');
    expect(args).toContain('model_provider="freellmapi"');
    expect(args.some(a => a.includes('base_url'))).toBe(true);
  });

  it('should build aider args', () => {
    const args = aiderArgs(config, 'auto');
    expect(args).toContain('--model');
    expect(args).toContain('openai/auto');
    expect(args).toContain('--openai-api-base');
  });
});
