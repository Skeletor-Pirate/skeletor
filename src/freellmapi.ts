import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { readText } from './util.js';

export function findFreeLLMAPIDir(): string | null {
  const candidates = [
    process.env.FREELLMAPI_DIR,
    path.resolve(process.cwd(), '../freellmapi'),
    path.resolve(process.cwd(), 'freellmapi'),
    'C:\\Users\\HP\\app\\freellmapi',
    path.resolve(os.homedir(), 'app', 'freellmapi'),
    path.resolve(os.homedir(), 'freellmapi'),
  ].filter(Boolean) as string[];

  for (const dir of candidates) {
    if (fs.existsSync(dir) && fs.existsSync(path.join(dir, 'package.json'))) {
      return dir;
    }
  }
  return null;
}

export function getFreeLLMAPIKeyFromDisk(): string {
  if (process.env.FREELLMAPI_API_KEY?.trim()) {
    return process.env.FREELLMAPI_API_KEY.trim();
  }

  const keyFiles = [
    path.join(os.homedir(), '.freellmapi', 'key'),
    path.join(process.cwd(), '.freellmapi-key'),
  ];
  for (const kf of keyFiles) {
    if (fs.existsSync(kf)) {
      const val = readText(kf)?.trim();
      if (val) return val;
    }
  }

  const dbs = [
    path.join(process.cwd(), 'server', 'data', 'freeapi.db'),
    path.join(process.cwd(), '..', 'freellmapi', 'server', 'data', 'freeapi.db'),
    'C:\\Users\\HP\\app\\freellmapi\\server\\data\\freeapi.db',
  ];
  for (const dbPath of dbs) {
    if (fs.existsSync(dbPath)) {
      try {
        const buf = fs.readFileSync(dbPath);
        const marker = 'freellmapi-';
        const idx = buf.indexOf(marker);
        if (idx !== -1) {
          const candidate = buf.slice(idx, idx + 59).toString('utf8');
          if (/^freellmapi-[0-9a-f]{48}$/.test(candidate)) {
            return candidate;
          }
        }
      } catch {
        // Ignore read errors
      }
    }
  }
  return '';
}

export async function isFreeLLMAPIRunning(gatewayUrl = 'http://localhost:3001'): Promise<boolean> {
  if (!gatewayUrl || gatewayUrl.includes('example.com')) return false;
  const root = gatewayUrl.replace(/\/+$/, '').replace(/\/v1$/i, '');
  try {
    const res = await fetch(`${root}/v1/models`, {
      method: 'GET',
      signal: AbortSignal.timeout(1500),
    });
    if (res.status === 200 || res.status === 401 || res.status === 403) {
      const contentType = res.headers.get('content-type') || '';
      return contentType.includes('application/json');
    }
    return false;
  } catch {
    return false;
  }
}

export async function ensureFreeLLMAPIRunning(
  gatewayUrl = 'http://localhost:3001',
  onLog?: (msg: string) => void,
): Promise<{ running: boolean; spawned: boolean; key: string }> {
  const alive = await isFreeLLMAPIRunning(gatewayUrl);
  if (alive) {
    return { running: true, spawned: false, key: getFreeLLMAPIKeyFromDisk() };
  }

  const dir = findFreeLLMAPIDir();
  if (!dir) {
    onLog?.('FreeLLMAPI server is offline and no local FreeLLMAPI folder was found.');
    return { running: false, spawned: false, key: getFreeLLMAPIKeyFromDisk() };
  }

  onLog?.(`FreeLLMAPI is offline. Auto-starting FreeLLMAPI server in ${dir}...`);
  const isWin = process.platform === 'win32';

  const child = spawn('npm', ['run', 'dev', '-w', 'server'], {
    cwd: dir,
    detached: true,
    stdio: 'ignore',
    shell: isWin,
  });
  child.unref();

  const start = Date.now();
  while (Date.now() - start < 35_000) {
    await new Promise(r => setTimeout(r, 800));
    if (await isFreeLLMAPIRunning(gatewayUrl)) {
      const key = getFreeLLMAPIKeyFromDisk();
      onLog?.('FreeLLMAPI server started and ready!');
      return { running: true, spawned: true, key };
    }
  }

  onLog?.('FreeLLMAPI server start timed out after 35 seconds.');
  return { running: false, spawned: true, key: getFreeLLMAPIKeyFromDisk() };
}
