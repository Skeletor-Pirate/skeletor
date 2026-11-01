import type { AgentHubConfig } from './config.js';
export type SandboxDecision = 'allow' | 'confirm' | 'block';
export interface SandboxResult {
    decision: SandboxDecision;
    reason: string;
    /** When decision is 'confirm', the user may escalate to allow by typing yes. */
    prompt?: string;
}
export interface SandboxConfig {
    /** When true, no command may run at all (read-only agent). */
    readOnly: boolean;
    /** Glob-style path roots the agent is permitted to touch. Empty = workspace only. */
    allowPaths: string[];
    /** Commands that always require an explicit user confirmation before running. */
    confirmPatterns: RegExp[];
    /** Commands that are always blocked outright. */
    blockPatterns: RegExp[];
}
/**
 * Classify a shell command against the sandbox rules.
 * Order matters: block patterns win, then confirm, then allow.
 */
export declare function classifyCommand(command: string, config: SandboxConfig): SandboxResult;
/**
 * Validate that every path argument referenced by a command falls inside
 * one of the allowed roots. Best-effort: only inspects tokens that look
 * like filesystem paths; unknown tokens are passed through.
 */
export declare function validatePaths(command: string, allowPaths: string[]): SandboxResult;
export declare function defaultSandboxConfig(config: AgentHubConfig): SandboxConfig;
