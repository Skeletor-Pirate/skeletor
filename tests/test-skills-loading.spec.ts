import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { discoverSkills } from '../src/skills.js';

describe('Skill Loading', () => {
  it('should load skills from a single directory', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-test-'));
    const skillDir = path.join(dir, 'auth-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, 'SKILL.md'),
      '---\nname: auth-skill\ndescription: A test skill\n---\n\nSkill content here.',
    );

    const result = discoverSkills([dir]);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('auth-skill');
    expect(result[0].description).toBe('A test skill');
    expect(result[0].content.trim()).toBe('Skill content here.');

    fs.rmSync(dir, { recursive: true });
  });

  it('should not load duplicate skill names from multiple directories', () => {
    const dir1 = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-test-'));
    const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-test-'));
    for (const d of [dir1, dir2]) {
      const skillDir = path.join(d, 'auth-skill');
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(
        path.join(skillDir, 'SKILL.md'),
        '---\nname: auth-skill\ndescription: A test skill\n---\n\nSkill content here.',
      );
    }

    const result = discoverSkills([dir1, dir2]);
    expect(result).toHaveLength(1);

    fs.rmSync(dir1, { recursive: true });
    fs.rmSync(dir2, { recursive: true });
  });

  it('should handle missing directories gracefully', () => {
    const result = discoverSkills(['/nonexistent/path/that/does/not/exist']);
    expect(result).toHaveLength(0);
  });
});
