import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { v4 as uuidv4 } from 'uuid';
import type { ChatMessage } from './llm.js';

export interface Session {
  id: string;
  createdAt: number;
  updatedAt: number;
  workspace: string;
  model: string;
  messages: ChatMessage[];
  mode: string;
}

function sessionsDir(): string {
  const home = process.env.HOME || process.env.USERPROFILE || os.homedir();
  return path.join(home, '.agenthub', 'sessions');
}

function sessionPath(id: string): string {
  return path.join(sessionsDir(), `${id}.json`);
}

export function listSessions(): Session[] {
  const dir = sessionsDir();
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  const sessions: Session[] = [];
  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(dir, file), 'utf8');
      sessions.push(JSON.parse(raw) as Session);
    } catch {
      // Ignore corrupt session files.
    }
  }
  return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function createSession(workspace: string, model: string, mode = 'code'): Session {
  const session: Session = {
    id: uuidv4(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    workspace,
    model,
    messages: [],
    mode,
  };
  saveSession(session);
  return session;
}

export function saveSession(session: Session): void {
  session.updatedAt = Date.now();
  const dir = sessionsDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(sessionPath(session.id), JSON.stringify(session, null, 2));
}

export function loadSession(id: string): Session | null {
  const p = sessionPath(id);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8')) as Session;
  } catch {
    return null;
  }
}

export function deleteSession(id: string): boolean {
  const p = sessionPath(id);
  if (!fs.existsSync(p)) return false;
  fs.unlinkSync(p);
  return true;
}

export function appendMessage(session: Session, message: ChatMessage): void {
  session.messages.push(message);
  saveSession(session);
}

export function clearSessionMessages(session: Session): void {
  session.messages = [];
  saveSession(session);
}
