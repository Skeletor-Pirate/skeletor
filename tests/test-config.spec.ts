import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadConfig, saveConfig, expandConfigPaths } from '../src/config.js';

describe('Config', () => {
  let tmpDir: string;
  let originalHome: string | undefined;
  let originalUser: string | undefined;
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agenthub-cfg-'));
    originalHome = process.env.HOME;
    originalUser = process.env.USERPROFILE;
    process.env.HOME = tmpDir;
    process.env.USERPROFILE = tmpDir;
    process.env.AGENTHUB_CONFIG_DIR = path.join(tmpDir, '.agenthub');
    process.env.AGENTHUB_CONFIG = path.join(tmpDir, '.agenthub', 'config.json');
  });
  afterEach(() => {
    if (originalHome !== undefined) process.env.HOME = originalHome;
    else delete process.env.HOME;
    if (originalUser !== undefined) process.env.USERPROFILE = originalUser;
    else delete process.env.USERPROFILE;
    delete process.env.AGENTHUB_CONFIG_DIR;
    delete process.env.AGENTHUB_CONFIG;
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('should return defaults when no config exists', () => {
    const config = loadConfig();
    expect(config.gatewayUrl).toBe('http://localhost:3001');
    expect(config.model).toBe('auto');
    expect(config.skillsDirs.length).toBeGreaterThanOrEqual(3);
  });

  it('should save and reload config', () => {
    const config = {
      gatewayUrl: 'http://custom-gw.local',
      apiKey: 'custom-key',
      model: 'custom-model',
      workspace: '/tmp',
      skillsDirs: [],
      mcpServers: {},
      agents: {},
      logLevel: 'debug' as const,
    };
    saveConfig(config);
    const loaded = loadConfig();
    expect(loaded.gatewayUrl).toBe('http://custom-gw.local');
    expect(loaded.apiKey).toBe('custom-key');
    expect(loaded.model).toBe('custom-model');
  });

  it('should expand ~ in paths', () => {
    const config = {
      gatewayUrl: 'http://localhost:3001',
      apiKey: '',
      model: 'auto',
      workspace: '~/project',
      skillsDirs: ['~/skills'],
      mcpServers: {},
      agents: {},
      logLevel: 'info' as const,
    };
    const expanded = expandConfigPaths(config);
    expect(expanded.workspace).toBe(path.join(tmpDir, 'project'));
    expect(expanded.skillsDirs[0]).toBe(path.join(tmpDir, 'skills'));
  });
});
