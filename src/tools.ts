import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { AgentHubConfig } from './config.js';
import { expandHome } from './util.js';
import {
  classifyCommand,
  defaultSandboxConfig,
  validatePaths,
} from './sandbox.js';
import { applySmartEdit } from './diff.js';

const execAsync = promisify(exec);

export interface ToolResult {
  output: string;
  isError?: boolean;
  /** When true, the agent loop should pause and ask the user before proceeding. */
  needsConfirmation?: boolean;
}

export function resolvePath(p: string, workspace: string): string {
  const expanded = expandHome(p);
  if (path.isAbsolute(expanded)) return path.normalize(expanded);
  return path.normalize(path.resolve(workspace, expanded));
}

export function ensureInside(p: string, workspace: string): void {
  const real = fs.existsSync(p) ? fs.realpathSync(p) : path.resolve(p);
  const realWorkspace = fs.existsSync(workspace) ? fs.realpathSync(workspace) : path.resolve(workspace);

  // Normalize case on Windows for drive letters / paths
  const normReal = process.platform === 'win32' ? real.toLowerCase() : real;
  const normWorkspace = process.platform === 'win32' ? realWorkspace.toLowerCase() : realWorkspace;

  if (!normReal.startsWith(normWorkspace + path.sep) && normReal !== normWorkspace) {
    throw new Error(`Path ${p} is outside the workspace ${workspace}`);
  }
}

export async function toolRead(
  params: { file_path: string; start_line?: number; end_line?: number },
  config: AgentHubConfig,
): Promise<ToolResult> {
  try {
    const p = resolvePath(params.file_path, config.workspace);
    ensureInside(p, config.workspace);
    if (!fs.existsSync(p)) {
      return { output: `File not found: ${params.file_path}`, isError: true };
    }
    const content = fs.readFileSync(p, 'utf8');
    const lines = content.split('\n');

    if (params.start_line !== undefined || params.end_line !== undefined) {
      const start = Math.max(1, params.start_line ?? 1) - 1;
      const end = params.end_line ? Math.min(lines.length, params.end_line) : lines.length;
      const slice = lines.slice(start, end);
      const formatted = slice.map((line, idx) => `${start + idx + 1}: ${line}`).join('\n');
      return { output: formatted };
    }

    if (lines.length > 1000) {
      const head = lines.slice(0, 1000).join('\n');
      return {
        output: `${head}\n\n... [Truncated: showing first 1000 of ${lines.length} lines. Use start_line/end_line to view remaining content]`,
      };
    }

    return { output: content };
  } catch (error) {
    return { output: `Error reading ${params.file_path}: ${error instanceof Error ? error.message : String(error)}`, isError: true };
  }
}

export async function toolWrite(
  params: { file_path: string; content: string },
  config: AgentHubConfig,
): Promise<ToolResult> {
  try {
    const p = resolvePath(params.file_path, config.workspace);
    ensureInside(p, config.workspace);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, params.content, 'utf8');
    return { output: `Wrote ${params.content.length} bytes to ${params.file_path}` };
  } catch (error) {
    return { output: `Error writing ${params.file_path}: ${error instanceof Error ? error.message : String(error)}`, isError: true };
  }
}

export async function toolEdit(
  params: { file_path: string; old_string: string; new_string: string },
  config: AgentHubConfig,
): Promise<ToolResult> {
  try {
    const p = resolvePath(params.file_path, config.workspace);
    ensureInside(p, config.workspace);
    if (!fs.existsSync(p)) {
      return { output: `File not found: ${params.file_path}`, isError: true };
    }
    const content = fs.readFileSync(p, 'utf8');
    const editRes = applySmartEdit(content, params.old_string, params.new_string);
    if (!editRes.success || !editRes.result) {
      return {
        output: `Error editing ${params.file_path}: ${editRes.error || 'Failed to match old_string'}`,
        isError: true,
      };
    }
    fs.writeFileSync(p, editRes.result, 'utf8');
    const matchTag = editRes.matchedBy && editRes.matchedBy !== 'exact' ? ` (${editRes.matchedBy} match)` : '';
    return { output: `Edited ${params.file_path}${matchTag}` };
  } catch (error) {
    return { output: `Error editing ${params.file_path}: ${error instanceof Error ? error.message : String(error)}`, isError: true };
  }
}

function normalizeCommandForPlatform(command: string): string {
  if (process.platform !== 'win32') return command;
  let cmd = command.trim();
  // PowerShell 5.1 statement separators: replace && and || with ;
  cmd = cmd.replace(/\s*&&\s*/g, '; ');
  cmd = cmd.replace(/\s*\|\|\s*/g, '; ');
  // Handle /dev/null redirection on Windows
  cmd = cmd.replace(/>\s*\/dev\/null/gi, '| Out-Null');
  cmd = cmd.replace(/2>\s*\/dev\/null/gi, '2>$null');
  cmd = cmd.replace(/\/dev\/null/gi, '$null');
  // ls -la / ls -l / ls -al / ls -lah -> Get-ChildItem -Force
  cmd = cmd.replace(/\bls\s+-(la|al|lah|l|a)\b/gi, 'Get-ChildItem -Force');
  // rm -rf <target> -> Remove-Item -Recurse -Force <target>
  cmd = cmd.replace(/\brm\s+-(rf|fr|r)\s+([^\s;&|]+)/gi, 'Remove-Item -Recurse -Force $2');
  // touch <file> -> New-Item -ItemType File -Force <file>
  cmd = cmd.replace(/\btouch\s+([^\s;&|]+)/gi, 'New-Item -ItemType File -Force $1');
  // which <cmd> -> Get-Command <cmd>
  cmd = cmd.replace(/\bwhich\s+([^\s;&|]+)/gi, 'Get-Command $1');
  // pwd -> (Get-Location).Path
  cmd = cmd.replace(/\bpwd\b/gi, '(Get-Location).Path');
  // | head -30 / | head -> | Select-Object -First 30
  cmd = cmd.replace(/\|\s*head\s*(?:-\d+)?/gi, '| Select-Object -First 30');
  // Convert Unix find <dir> -name "<filter>" or find <dir> -type f to PowerShell
  cmd = cmd.replace(/\bfind\s+([^\s|;]+)(?:\s+-type\s+[fd])?(?:\s+-name\s+['"]?([^'"\s|;]+)['"]?)?/gi, (m, dir, name) => {
    const filter = name ? `-Filter '${name.replace(/\\/g, '')}'` : '';
    return `(Get-ChildItem -Path '${dir}' -Recurse ${filter} -File -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName)`;
  });
  // ts-node -> tsx
  cmd = cmd.replace(/\bts-node\b/g, 'tsx');
  // npx without --yes or -y
  cmd = cmd.replace(/\bnpx\s+(?!-y|--yes)([a-zA-Z0-9@/_-]+)/g, 'npx --yes $1');
  return cmd;
}

export async function toolBash(
  params: { command: string; timeout?: number },
  config: AgentHubConfig,
): Promise<ToolResult> {
  const isContinuous = config.continuous ?? false;
  const defaultTimeout = isContinuous ? 600_000 : 60_000;
  const timeout = Math.min(params.timeout ?? defaultTimeout, isContinuous ? 1_800_000 : 600_000);

  // Sandbox gate: classify before execution.
  const sandbox = defaultSandboxConfig(config);
  const classification = classifyCommand(params.command, sandbox);
  if (classification.decision === 'block') {
    return { output: `[SANDBOX BLOCKED]: ${classification.reason}`, isError: true };
  }
  if (classification.decision === 'confirm' && !config.autoApprove && !isContinuous) {
    return {
      output: `[CONFIRMATION REQUIRED]: ${classification.reason}. ${classification.prompt}`,
      isError: true,
      needsConfirmation: true,
    };
  }

  // Path validation: ensure referenced paths stay inside allowed roots.
  const pathCheck = validatePaths(params.command, sandbox.allowPaths);
  if (pathCheck.decision === 'block') {
    return { output: `[SANDBOX BLOCKED]: ${pathCheck.reason}`, isError: true };
  }

  const isWin = process.platform === 'win32';
  const shell = isWin ? 'powershell.exe' : '/bin/bash';
  const commandToRun = normalizeCommandForPlatform(params.command);

  try {
    const { stdout, stderr } = await execAsync(commandToRun, {
      cwd: config.workspace,
      timeout,
      shell,
      maxBuffer: 20 * 1024 * 1024,
    });
    const combined = (stdout || '') + (stderr ? `\n[stderr]\n${stderr}` : '');
    return { output: combined.trim().slice(0, 50_000) || '(Command completed with no output)' };
  } catch (error: any) {
    const out = (error.stdout ?? '') + (error.stderr ? `\n${error.stderr}` : '') + (error.message ? `\n${error.message}` : '');
    return {
      output: out.trim().slice(0, 50_000) || String(error),
      isError: true,
    };
  }
}

export async function toolGit(
  params: { args: string[] },
  config: AgentHubConfig,
): Promise<ToolResult> {
  try {
    const cmd = `git ${params.args.map(a => (a.includes(' ') ? `"${a}"` : a)).join(' ')}`;
    const { stdout, stderr } = await execAsync(cmd, {
      cwd: config.workspace,
      maxBuffer: 10 * 1024 * 1024,
    });
    return { output: ((stdout || '') + (stderr || '')).trim().slice(0, 50_000) || '(Git command completed)' };
  } catch (error: any) {
    return {
      output: ((error.stdout ?? '') + (error.stderr ?? '') + (error.message ?? String(error))).trim(),
      isError: true,
    };
  }
}

export async function toolGlob(
  params: { pattern: string; path?: string },
  config: AgentHubConfig,
): Promise<ToolResult> {
  try {
    const base = params.path ? resolvePath(params.path, config.workspace) : config.workspace;
    ensureInside(base, config.workspace);
    const results: string[] = [];

    const walk = (dir: string, depth: number): void => {
      if (depth > 8) return;
      let entries: string[];
      try {
        entries = fs.readdirSync(dir);
      } catch {
        return;
      }
      for (const entry of entries) {
        if (entry === '.git' || entry === 'node_modules' || entry === '.gemini') continue;
        if (entry.startsWith('.') && params.pattern !== '.*') continue;
        const full = path.join(dir, entry);
        const rel = path.relative(base, full).replace(/\\/g, '/');
        if (minimatch(rel, params.pattern) || minimatch(entry, params.pattern)) {
          results.push(rel);
        }
        try {
          if (fs.statSync(full).isDirectory()) walk(full, depth + 1);
        } catch {
          // Ignore
        }
      }
    };
    walk(base, 0);
    return { output: results.slice(0, 500).join('\n') || 'No matching files found.' };
  } catch (error) {
    return { output: `Glob error: ${error instanceof Error ? error.message : String(error)}`, isError: true };
  }
}

function minimatch(value: string, pattern: string): boolean {
  const normPattern = pattern.replace(/\\/g, '/');
  const normValue = value.replace(/\\/g, '/');
  const regex = new RegExp(
    '^' +
      normPattern
        .replace(/[.+^${}()|[\\]]/g, '\\$&')
        .replace(/\*\*/g, '§DOUBLESTAR§')
        .replace(/\*/g, '[^/]*')
        .replace(/§DOUBLESTAR§/g, '.*') +
      '$',
    'i',
  );
  return regex.test(normValue);
}

export async function toolGrep(
  params: { query: string; path?: string; is_regex?: boolean; case_sensitive?: boolean; max_results?: number },
  config: AgentHubConfig,
): Promise<ToolResult> {
  try {
    const base = params.path ? resolvePath(params.path, config.workspace) : config.workspace;
    ensureInside(base, config.workspace);
    const maxResults = params.max_results ?? 50;
    const results: string[] = [];

    const flags = params.case_sensitive ? 'g' : 'gi';
    const regex = params.is_regex
      ? new RegExp(params.query, flags)
      : new RegExp(params.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);

    const searchDir = (dir: string, depth: number): void => {
      if (depth > 7 || results.length >= maxResults) return;
      let entries: string[];
      try {
        entries = fs.readdirSync(dir);
      } catch {
        return;
      }

      for (const entry of entries) {
        if (entry === '.git' || entry === 'node_modules' || entry === 'dist' || entry === '.next') continue;
        const full = path.join(dir, entry);
        let stat: fs.Stats;
        try {
          stat = fs.statSync(full);
        } catch {
          continue;
        }

        if (stat.isDirectory()) {
          searchDir(full, depth + 1);
        } else if (stat.isFile() && stat.size < 2 * 1024 * 1024) {
          try {
            const content = fs.readFileSync(full, 'utf8');
            const lines = content.split('\n');
            const rel = path.relative(config.workspace, full).replace(/\\/g, '/');
            for (let i = 0; i < lines.length; i++) {
              if (regex.test(lines[i])) {
                results.push(`${rel}:${i + 1}: ${lines[i].trim()}`);
                if (results.length >= maxResults) return;
              }
            }
          } catch {
            // Binary or unreadable file
          }
        }
      }
    };

    searchDir(base, 0);
    return {
      output: results.length ? results.join('\n') : `No occurrences found for "${params.query}".`,
    };
  } catch (error) {
    return { output: `Grep error: ${error instanceof Error ? error.message : String(error)}`, isError: true };
  }
}

export async function toolLs(
  params: { path: string },
  config: AgentHubConfig,
): Promise<ToolResult> {
  try {
    const p = resolvePath(params.path, config.workspace);
    ensureInside(p, config.workspace);
    const entries = fs.readdirSync(p, { withFileTypes: true });
    const formatted = entries
      .filter(e => e.name !== '.git' && e.name !== 'node_modules')
      .map(e => `${e.isDirectory() ? '[DIR] ' : '[FILE]'} ${e.name}`)
      .join('\n');
    return { output: formatted || 'Empty directory' };
  } catch (error) {
    return { output: `Error listing ${params.path}: ${error instanceof Error ? error.message : String(error)}`, isError: true };
  }
}

export async function toolFetch(
  params: { url: string },
  _config: AgentHubConfig,
): Promise<ToolResult> {
  try {
    const res = await fetch(params.url, {
      headers: { 'User-Agent': 'AgentHub/1.0.0 (Unified CLI Coding Agent)' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      return { output: `HTTP error ${res.status}: ${res.statusText}`, isError: true };
    }
    const text = await res.text();
    // Strip simple HTML tags if html
    const clean = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
                      .replace(/<[^>]+>/g, ' ')
                      .replace(/\s{2,}/g, ' ')
                      .trim();
    return { output: clean.slice(0, 20_000) };
  } catch (error) {
    return { output: `Fetch error: ${error instanceof Error ? error.message : String(error)}`, isError: true };
  }
}

export async function toolRepoMap(
  params: { path?: string; max_depth?: number },
  config: AgentHubConfig,
): Promise<ToolResult> {
  try {
    const base = params.path ? resolvePath(params.path, config.workspace) : config.workspace;
    ensureInside(base, config.workspace);
    const maxDepth = params.max_depth ?? 3;
    const lines: string[] = [`Repository structure (${path.basename(base)}):`];

    const printTree = (dir: string, depth: number, prefix: string): void => {
      if (depth > maxDepth) return;
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      const filtered = entries.filter(e => !e.name.startsWith('.') && e.name !== 'node_modules' && e.name !== 'dist');
      for (let i = 0; i < filtered.length; i++) {
        const entry = filtered[i];
        const isLast = i === filtered.length - 1;
        const pointer = isLast ? '└── ' : '├── ';
        lines.push(`${prefix}${pointer}${entry.name}${entry.isDirectory() ? '/' : ''}`);
        if (entry.isDirectory()) {
          printTree(path.join(dir, entry.name), depth + 1, prefix + (isLast ? '    ' : '│   '));
        }
      }
    };

    printTree(base, 0, '');
    return { output: lines.join('\n') };
  } catch (error) {
    return { output: `RepoMap error: ${error instanceof Error ? error.message : String(error)}`, isError: true };
  }
}

import { buildCodeGraph, queryCodeGraph, renderCompressedCodeMap } from './graphify.js';

export async function toolGraphify(
  params: { path?: string; query?: string; max_depth?: number },
  config: AgentHubConfig,
): Promise<ToolResult> {
  try {
    const base = params.path ? resolvePath(params.path, config.workspace) : config.workspace;
    ensureInside(base, config.workspace);
    const graph = buildCodeGraph(base, { maxDepth: params.max_depth ?? 6 });
    if (params.query) {
      return { output: queryCodeGraph(graph, params.query) };
    }
    return { output: renderCompressedCodeMap(graph, params.path) };
  } catch (error) {
    return { output: `Graphify error: ${error instanceof Error ? error.message : String(error)}`, isError: true };
  }
}

import { saveLearnedSkill } from './skills.js';

export async function toolLearnSkill(
  params: { name: string; description: string; instructions: string; tags?: string[] },
  config: AgentHubConfig,
): Promise<ToolResult> {
  try {
    const res = saveLearnedSkill(config.workspace, {
      name: params.name,
      description: params.description,
      content: params.instructions,
      tags: params.tags,
    });
    return {
      output: `✓ Acquired new permanent skill '${res.skill.name}' (saved to ${path.relative(config.workspace, res.path)}). This skill is immediately active in your session context and stored permanently.`,
    };
  } catch (error) {
    return { output: `LearnSkill error: ${error instanceof Error ? error.message : String(error)}`, isError: true };
  }
}


