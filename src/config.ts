import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { readText, writeText, expandHome } from './util.js';

export interface AgentHubConfig {
  gatewayUrl: string;
  apiKey: string;
  model: string;
  workspace: string;
  skillsDirs: string[];
  mcpServers: Record<string, McpServerConfig>;
  agents: Record<string, AgentLaunchConfig>;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  maxSteps?: number;
  /** When true, no shell commands or file writes may execute. */
  readOnly?: boolean;
  /** Path roots the agent is permitted to touch (empty = workspace only). */
  allowPaths?: string[];
  /** Custom regex patterns that require user confirmation before executing in shell. */
  confirmPatterns?: string[];
  /** Custom regex patterns that are unconditionally blocked in shell. */
  blockPatterns?: string[];
  /** When true, runs in continuous autonomous mode with uncapped steps and uninterrupted terminal loops. */
  continuous?: boolean;
  /** When true, automatically approves commands without pausing for terminal confirmation. */
  autoApprove?: boolean;
}

export interface McpServerConfig {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  transport?: 'stdio' | 'sse' | 'http';
}

export interface AgentLaunchConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

function findFreeLLMAPIKey(): string {
  if (process.env.FREELLMAPI_API_KEY?.trim()) {
    return process.env.FREELLMAPI_API_KEY.trim();
  }

  // Check known FreeLLMAPI key file locations
  const candidateFiles = [
    path.join(os.homedir(), '.freellmapi', 'key'),
    path.join(process.cwd(), '.freellmapi-key'),
  ];
  for (const f of candidateFiles) {
    if (fs.existsSync(f)) {
      const content = readText(f)?.trim();
      if (content) return content;
    }
  }

  // Check SQLite database if local FreeLLMAPI server directory exists.
  // Scan is size-bounded: only the first 1 MB of the file is read, so a
  // corrupt or unexpectedly large database cannot exhaust memory.
  const MAX_DB_SCAN_BYTES = 1024 * 1024;
  const candidateDbs = [
    path.join(process.cwd(), 'server', 'data', 'freeapi.db'),
    path.join(process.cwd(), '..', 'freellmapi', 'server', 'data', 'freeapi.db'),
    'c:\\Users\\HP\\app\\freellmapi\\server\\data\\freeapi.db',
  ];
  for (const dbPath of candidateDbs) {
    if (fs.existsSync(dbPath)) {
      try {
        const stat = fs.statSync(dbPath);
        if (!stat.isFile() || stat.size > MAX_DB_SCAN_BYTES) continue;
        // Bounded read: only the first MAX_DB_SCAN_BYTES of the file are loaded,
        // so a corrupt or unexpectedly large database cannot exhaust memory.
        const fd = fs.openSync(dbPath, 'r');
        try {
          const buf = Buffer.alloc(MAX_DB_SCAN_BYTES);
          const bytesRead = fs.readSync(fd, buf, 0, MAX_DB_SCAN_BYTES, 0);
          const data = buf.slice(0, bytesRead);
          const marker = 'freellmapi-';
          const idx = data.indexOf(marker);
          if (idx !== -1) {
            // Key format: freellmapi- + 48 hex chars = 59 chars
            const candidate = data.slice(idx, idx + 59).toString('utf8');
            if (/^freellmapi-[0-9a-f]{48}$/.test(candidate)) {
              return candidate;
            }
          }
        } finally {
          fs.closeSync(fd);
        }
      } catch {
        // Ignore DB read errors
      }
    }
  }

  return '';
}

export const DEFAULT_CONFIG: AgentHubConfig = {
  gatewayUrl: process.env.FREELLMAPI_URL || 'http://localhost:3001',
  apiKey: findFreeLLMAPIKey(),
  model: 'auto',
  workspace: process.cwd(),
  skillsDirs: [
    path.join(process.cwd(), '.skeletor', 'skills'),
    path.join(process.cwd(), '.agents', 'skills'),
    path.join(os.homedir(), '.skeletor', 'skills'),
    path.join(os.homedir(), '.agents', 'skills'),
    path.join(os.homedir(), '.opencode', 'skills'),
    path.join(os.homedir(), '.claude', 'skills'),
  ],
  mcpServers: {
    freellmapi: {
      url: (process.env.FREELLMAPI_URL || 'http://localhost:3001') + '/mcp',
      transport: 'http',
    },
    playwright: {
      command: 'npx',
      args: ['-y', '@playwright/mcp@latest'],
    },
    git: {
      command: 'uvx',
      args: ['mcp-server-git'],
    },
    fetch: {
      command: 'uvx',
      args: ['mcp-server-fetch'],
    },
    memory: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-memory'],
    },
  },
  agents: {},
  logLevel: 'info',
  maxSteps: 50,
  readOnly: false,
  allowPaths: [],
  confirmPatterns: [],
  blockPatterns: [],
  continuous: false,
  autoApprove: false,
};

function configDir(): string {
  if (process.env.AGENTHUB_CONFIG_DIR) return process.env.AGENTHUB_CONFIG_DIR;
  const home = process.env.USERPROFILE || process.env.HOME || os.homedir();
  return path.join(home, '.agenthub');
}

function userConfigPath(): string {
  return path.join(configDir(), 'config.json');
}

function configPath(): string {
  if (process.env.AGENTHUB_CONFIG) return process.env.AGENTHUB_CONFIG;
  const isTest = Boolean(process.env.HOME?.includes('agenthub-cfg-') || process.env.USERPROFILE?.includes('agenthub-cfg-'));
  const uPath = userConfigPath();
  if (isTest) return uPath;
  const localConfig = path.join(process.cwd(), 'config.json');
  if (fs.existsSync(localConfig)) return localConfig;
  if (fs.existsSync(uPath)) return uPath;
  return localConfig;
}

export function saveConfig(config: AgentHubConfig): void {
  const target = process.env.AGENTHUB_CONFIG || userConfigPath();
  fs.mkdirSync(path.dirname(target), { recursive: true });
  writeText(target, JSON.stringify(config, null, 2));
}

export function loadConfig(): AgentHubConfig {
  const cPath = configPath();
  const raw = readText(cPath);
  let parsed: Partial<AgentHubConfig> = {};
  if (raw) {
    try {
      parsed = JSON.parse(raw) as Partial<AgentHubConfig>;
    } catch {
      // Use defaults
    }
  }

  let gatewayUrl = parsed.gatewayUrl || DEFAULT_CONFIG.gatewayUrl;
  if (gatewayUrl.includes('example.com') || gatewayUrl === 'http://localhost:3000') {
    gatewayUrl = process.env.FREELLMAPI_URL || 'http://localhost:3001';
  }

  const detectedKey = findFreeLLMAPIKey();
  let apiKey = parsed.apiKey || process.env.FREELLMAPI_API_KEY || detectedKey || DEFAULT_CONFIG.apiKey;
  if (apiKey === 'secret' || !apiKey) {
    apiKey = detectedKey || DEFAULT_CONFIG.apiKey;
  }

  let model = parsed.model || DEFAULT_CONFIG.model;
  if ((!model || model === 'gpt-4') && (gatewayUrl.includes('localhost') || gatewayUrl.includes('127.0.0.1'))) {
    model = 'auto';
  }

  // Import extra MCP servers from Claude desktop if found
  const mcpServers = { ...DEFAULT_CONFIG.mcpServers, ...(parsed.mcpServers || {}) };
  const claudeDesktopPaths = [
    path.join(os.homedir(), 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json'),
    path.join(os.homedir(), '.claude', 'desktop', 'config.json'),
  ];
  for (const cdp of claudeDesktopPaths) {
    if (fs.existsSync(cdp)) {
      try {
        const cdData = JSON.parse(fs.readFileSync(cdp, 'utf8'));
        if (cdData.mcpServers) {
          for (const [k, v] of Object.entries(cdData.mcpServers)) {
            if (!mcpServers[k]) mcpServers[k] = v as McpServerConfig;
          }
        }
      } catch {
        // Ignore desktop config errors
      }
    }
  }

  return {
    gatewayUrl,
    apiKey,
    model,
    workspace: parsed.workspace || DEFAULT_CONFIG.workspace,
    skillsDirs: parsed.skillsDirs?.length ? parsed.skillsDirs : DEFAULT_CONFIG.skillsDirs,
    mcpServers,
    agents: parsed.agents || DEFAULT_CONFIG.agents,
    logLevel: parsed.logLevel || DEFAULT_CONFIG.logLevel,
    readOnly: Boolean(parsed.readOnly),
    allowPaths: parsed.allowPaths ?? DEFAULT_CONFIG.allowPaths,
    confirmPatterns: parsed.confirmPatterns ?? DEFAULT_CONFIG.confirmPatterns,
    blockPatterns: parsed.blockPatterns ?? DEFAULT_CONFIG.blockPatterns,
    continuous: Boolean(parsed.continuous),
    autoApprove: Boolean(parsed.autoApprove),
  };
}

export function expandConfigPaths(config: AgentHubConfig): AgentHubConfig {
  return {
    ...config,
    workspace: expandHome(config.workspace),
    skillsDirs: config.skillsDirs.map(expandHome),
    allowPaths: (config.allowPaths ?? []).map(expandHome),
  };
}
