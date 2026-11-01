import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createSession, loadSession, saveSession, appendMessage, clearSessionMessages, deleteSession, listSessions } from '../src/session.js';
import type { ChatMessage } from '../src/llm.js';

describe('Session', () => {
  let tmpDir: string;
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agenthub-sess-'));
    process.env.HOME = tmpDir;
    process.env.USERPROFILE = tmpDir;
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('should create a session', () => {
    const session = createSession('/tmp', 'auto', 'code');
    expect(session.id).toBeDefined();
    expect(session.messages).toHaveLength(0);
    expect(session.mode).toBe('code');
    expect(fs.existsSync(path.join(tmpDir, '.agenthub', 'sessions', `${session.id}.json`))).toBe(true);
  });

  it('should load a saved session', () => {
    const session = createSession('/tmp', 'auto');
    const loaded = loadSession(session.id);
    expect(loaded).not.toBeNull();
    expect(loaded?.id).toBe(session.id);
  });

  it('should return null for unknown session', () => {
    expect(loadSession('nonexistent')).toBeNull();
  });

  it('should append messages', () => {
    const session = createSession('/tmp', 'auto');
    appendMessage(session, { role: 'user', content: 'hello' });
    const loaded = loadSession(session.id);
    expect(loaded?.messages).toHaveLength(1);
    expect(loaded?.messages[0].content).toBe('hello');
  });

  it('should clear messages', () => {
    const session = createSession('/tmp', 'auto');
    appendMessage(session, { role: 'user', content: 'hello' });
    clearSessionMessages(session);
    const loaded = loadSession(session.id);
    expect(loaded?.messages).toHaveLength(0);
  });

  it('should delete a session', () => {
    const session = createSession('/tmp', 'auto');
    expect(deleteSession(session.id)).toBe(true);
    expect(loadSession(session.id)).toBeNull();
    expect(deleteSession(session.id)).toBe(false);
  });

  it('should list sessions sorted by updatedAt', () => {
    const s1 = createSession('/tmp', 'auto');
    const s2 = createSession('/tmp', 'auto');
    const sessions = listSessions();
    expect(sessions).toHaveLength(2);
    expect(sessions[0].updatedAt).toBeGreaterThanOrEqual(sessions[1].updatedAt);
  });
});
