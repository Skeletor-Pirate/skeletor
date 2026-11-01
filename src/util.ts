import fs from 'node:fs';
import path from 'node:path';

export function expandHome(p: string): string {
  if (p === '~') {
    return process.env.USERPROFILE || process.env.HOME || '/';
  }
  if (p.startsWith('~/') || p.startsWith('~\\')) {
    const home = process.env.USERPROFILE || process.env.HOME || '/';
    return path.join(home, p.slice(2));
  }
  return p;
}

export function readText(p: string): string | null {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}

export function writeText(p: string, content: string): void {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}

export function listDir(p: string): string[] {
  try {
    return fs.readdirSync(p).filter(f => !f.startsWith('.'));
  } catch {
    return [];
  }
}

export function isDirectory(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

export function findUp(start: string, filename: string): string | null {
  let dir = path.resolve(start);
  for (let i = 0; i < 20; i += 1) {
    const candidate = path.join(dir, filename);
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
};
