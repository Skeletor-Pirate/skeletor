import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { toolGrep, toolRepoMap, toolRead, toolGlob } from '../src/tools.js';
import type { AgentHubConfig } from '../src/config.js';

const config: AgentHubConfig = {
  gatewayUrl: 'http://localhost:3001',
  apiKey: '',
  model: 'auto',
  workspace: '.',
  skillsDirs: [],
  mcpServers: {},
  agents: {},
  logLevel: 'info',
};

describe('Advanced Tools', () => {
  let tmpDir: string;
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agenthub-adv-'));
    config.workspace = tmpDir;
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('should search with Grep across files with line numbers', async () => {
    fs.writeFileSync(path.join(tmpDir, 'file1.txt'), 'const foo = 42;\nconst bar = 100;');
    fs.writeFileSync(path.join(tmpDir, 'file2.txt'), 'console.log(foo);\n');
    const result = await toolGrep({ query: 'foo' }, config);
    expect(result.output).toContain('file1.txt:1: const foo = 42;');
    expect(result.output).toContain('file2.txt:1: console.log(foo);');
  });

  it('should read file slices with line numbers', async () => {
    const lines = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`);
    fs.writeFileSync(path.join(tmpDir, 'multi.txt'), lines.join('\n'));
    const result = await toolRead({ file_path: 'multi.txt', start_line: 5, end_line: 7 }, config);
    expect(result.output).toContain('5: line 5');
    expect(result.output).toContain('6: line 6');
    expect(result.output).toContain('7: line 7');
    expect(result.output).not.toContain('line 4');
    expect(result.output).not.toContain('line 8');
  });

  it('should generate a RepoMap of the directory structure', async () => {
    fs.mkdirSync(path.join(tmpDir, 'src', 'components'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src', 'index.ts'), 'export {}');
    fs.writeFileSync(path.join(tmpDir, 'src', 'components', 'button.ts'), 'export {}');
    const result = await toolRepoMap({ path: '.' }, config);
    expect(result.output).toContain('src/');
    expect(result.output).toContain('components/');
    expect(result.output).toContain('index.ts');
  });

  it('should glob files properly', async () => {
    fs.mkdirSync(path.join(tmpDir, 'nested'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'nested', 'target.spec.ts'), '');
    fs.writeFileSync(path.join(tmpDir, 'ignore.txt'), '');
    const result = await toolGlob({ pattern: '**/*.spec.ts' }, config);
    expect(result.output).toContain('target.spec.ts');
    expect(result.output).not.toContain('ignore.txt');
  });
});
