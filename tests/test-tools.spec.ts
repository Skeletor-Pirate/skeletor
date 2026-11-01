import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { toolRead, toolWrite, toolEdit, toolLs } from '../src/tools.js';
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

describe('Tools', () => {
  let tmpDir: string;
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agenthub-tools-'));
    config.workspace = tmpDir;
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('should read a file', async () => {
    fs.writeFileSync(path.join(tmpDir, 'hello.txt'), 'hello world');
    const result = await toolRead({ file_path: 'hello.txt' }, config);
    expect(result.output).toBe('hello world');
  });

  it('should write a file', async () => {
    const result = await toolWrite({ file_path: 'sub/dir/file.txt', content: 'new content' }, config);
    expect(result.output).toContain('Wrote');
    expect(fs.readFileSync(path.join(tmpDir, 'sub/dir/file.txt'), 'utf8')).toBe('new content');
  });

  it('should edit a file', async () => {
    fs.writeFileSync(path.join(tmpDir, 'edit.txt'), 'old value here');
    const result = await toolEdit({ file_path: 'edit.txt', old_string: 'old value', new_string: 'new value' }, config);
    expect(result.output).toContain('Edited');
    expect(fs.readFileSync(path.join(tmpDir, 'edit.txt'), 'utf8')).toBe('new value here');
  });

  it('should fail edit when old_string not found', async () => {
    fs.writeFileSync(path.join(tmpDir, 'edit.txt'), 'some content');
    const result = await toolEdit({ file_path: 'edit.txt', old_string: 'missing', new_string: 'x' }, config);
    expect(result.isError).toBe(true);
  });

  it('should list directory', async () => {
    fs.writeFileSync(path.join(tmpDir, 'a.txt'), '');
    fs.writeFileSync(path.join(tmpDir, 'b.txt'), '');
    const result = await toolLs({ path: '.' }, config);
    expect(result.output).toContain('a.txt');
    expect(result.output).toContain('b.txt');
  });
});
