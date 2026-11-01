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
export declare function listSessions(): Session[];
export declare function createSession(workspace: string, model: string, mode?: string): Session;
export declare function saveSession(session: Session): void;
export declare function loadSession(id: string): Session | null;
export declare function deleteSession(id: string): boolean;
export declare function appendMessage(session: Session, message: ChatMessage): void;
export declare function clearSessionMessages(session: Session): void;
