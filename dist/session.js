import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { v4 as uuidv4 } from 'uuid';
function sessionsDir() {
    const home = process.env.HOME || process.env.USERPROFILE || os.homedir();
    return path.join(home, '.agenthub', 'sessions');
}
function sessionPath(id) {
    return path.join(sessionsDir(), `${id}.json`);
}
export function listSessions() {
    const dir = sessionsDir();
    if (!fs.existsSync(dir))
        return [];
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    const sessions = [];
    for (const file of files) {
        try {
            const raw = fs.readFileSync(path.join(dir, file), 'utf8');
            sessions.push(JSON.parse(raw));
        }
        catch {
            // Ignore corrupt session files.
        }
    }
    return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
}
export function createSession(workspace, model, mode = 'code') {
    const session = {
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
export function saveSession(session) {
    session.updatedAt = Date.now();
    const dir = sessionsDir();
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(sessionPath(session.id), JSON.stringify(session, null, 2));
}
export function loadSession(id) {
    const p = sessionPath(id);
    if (!fs.existsSync(p))
        return null;
    try {
        return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
    catch {
        return null;
    }
}
export function deleteSession(id) {
    const p = sessionPath(id);
    if (!fs.existsSync(p))
        return false;
    fs.unlinkSync(p);
    return true;
}
export function appendMessage(session, message) {
    session.messages.push(message);
    saveSession(session);
}
export function clearSessionMessages(session) {
    session.messages = [];
    saveSession(session);
}
