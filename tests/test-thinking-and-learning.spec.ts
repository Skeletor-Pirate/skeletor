import { describe, it, expect } from 'vitest';
import { LLMClient } from '../src/llm.js';
import { renderThinking } from '../src/tui.js';
import { saveLearnedSkill, synthesizeSkillFromSession } from '../src/skills.js';
import { toolLearnSkill } from '../src/tools.js';
import type { AgentHubConfig } from '../src/config.js';
import fs from 'node:fs';
import path from 'node:path';

describe('Thinking & Hermes Continuous Skill Learning', () => {
  const dummyConfig: AgentHubConfig = {
    gatewayUrl: 'http://localhost:3001',
    apiKey: 'test',
    model: 'gpt-4',
    workspace: process.cwd(),
    skillsDirs: [],
    mcpServers: {},
    agents: {},
    logLevel: 'info',
  };

  it('should render thought blocks with Claude Code styling without error', () => {
    // Check that renderThinking formats smoothly
    expect(() => renderThinking('Analyzing dependencies...\nGraph looks clean.')).not.toThrow();
  });

  it('should synthesize and save a permanent skill (Hermes style)', () => {
    const mockMessages = [
      { role: 'user', content: 'Fix the capacitor build error on Windows' },
      { role: 'assistant', content: '1. Update capacitor.config.ts\n2. Run npx cap sync android' },
    ];
    const synthesized = synthesizeSkillFromSession(mockMessages, 'test-capacitor-fix');
    expect(synthesized.name).toBe('test-capacitor-fix');
    expect(synthesized.content).toContain('Update capacitor.config.ts');

    const saved = saveLearnedSkill(dummyConfig.workspace, synthesized);
    expect(fs.existsSync(saved.path)).toBe(true);
    const content = fs.readFileSync(saved.path, 'utf8');
    expect(content).toContain('name: test-capacitor-fix');
    expect(content).toContain('hermes-continuous-learning');

    // Clean up temporary test skill
    fs.rmSync(path.dirname(saved.path), { recursive: true, force: true });
  });

  it('should execute toolLearnSkill successfully', async () => {
    const res = await toolLearnSkill(
      {
        name: 'test-vite-recipe',
        description: 'Vite bundling configuration recipe',
        instructions: 'Use vite build with outDir dist',
      },
      dummyConfig
    );
    expect(res.isError).toBeFalsy();
    expect(res.output).toContain('Acquired new permanent skill');

    const expectedDir = path.join(dummyConfig.workspace, '.skeletor', 'skills', 'test-vite-recipe');
    expect(fs.existsSync(expectedDir)).toBe(true);

    // Clean up temporary test skill
    fs.rmSync(expectedDir, { recursive: true, force: true });
  });
});
