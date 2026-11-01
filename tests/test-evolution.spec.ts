import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  inspectBrotherAgents,
  runSelfEvolution,
} from '../src/evolution.js';

describe('Hermes 2.0 Self-Evolution Engine', () => {
  let tempWorkspace: string;

  beforeEach(() => {
    tempWorkspace = path.join(os.tmpdir(), `skeletor-evo-test-${Date.now()}`);
    fs.mkdirSync(tempWorkspace, { recursive: true });
  });

  afterEach(() => {
    try {
      fs.rmSync(tempWorkspace, { recursive: true, force: true });
    } catch {}
  });

  it('inspects brother CLI agents and detects mock OpenCode and Claude directories', () => {
    // Scaffold mock OpenCode brother agent
    const opencodeDir = path.join(tempWorkspace, '.opencode');
    fs.mkdirSync(path.join(opencodeDir, 'agents'), { recursive: true });
    fs.mkdirSync(path.join(opencodeDir, 'skills', 'data-architect'), { recursive: true });
    fs.writeFileSync(
      path.join(opencodeDir, 'agents', 'backend-architect.md'),
      '# Backend Architect Persona\nDesigns clean REST APIs.'
    );
    fs.writeFileSync(
      path.join(opencodeDir, 'skills', 'data-architect', 'SKILL.md'),
      '# Data Architect Skill\nData modeling and PostgreSQL.'
    );

    const siblings = inspectBrotherAgents(tempWorkspace);
    const opencode = siblings.find(s => s.name === 'OpenCode');
    expect(opencode).toBeDefined();
    expect(opencode?.found).toBe(true);
    expect(opencode?.personasFound).toContain('backend-architect');
    expect(opencode?.skillsFound).toContain('data-architect');
  });

  it('evolves and synthesizes skills from brother agents into .skeletor/skills without internet', async () => {
    // Scaffold mock brother agent
    const opencodeDir = path.join(tempWorkspace, '.opencode');
    fs.mkdirSync(path.join(opencodeDir, 'agents'), { recursive: true });
    fs.writeFileSync(
      path.join(opencodeDir, 'agents', 'test-ninja.md'),
      '# Test Ninja\nGenerates unit and integration tests.'
    );

    const result = await runSelfEvolution(tempWorkspace, [], { allowInternet: false });
    expect(result.skillsAcquired.length).toBeGreaterThan(0);
    expect(result.skillsAcquired.some(s => s.name.includes('test-ninja'))).toBe(true);

    const targetSkillPath = path.join(tempWorkspace, '.skeletor', 'skills', 'test-ninja', 'SKILL.md');
    expect(fs.existsSync(targetSkillPath)).toBe(true);
    const content = fs.readFileSync(targetSkillPath, 'utf8');
    expect(content).toContain('Test Ninja');
  });

  it('acquires curated online skills when internet permission is granted', async () => {
    const result = await runSelfEvolution(tempWorkspace, [], { allowInternet: true });
    const onlineSkills = result.skillsAcquired.map(s => s.name);
    expect(onlineSkills).toContain('cloud-deploy-craft');
    expect(onlineSkills).toContain('owasp-api-sentinel');

    const sentinelPath = path.join(tempWorkspace, '.skeletor', 'skills', 'owasp-api-sentinel', 'SKILL.md');
    expect(fs.existsSync(sentinelPath)).toBe(true);
  });
});
