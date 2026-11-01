import type { AgentHubConfig } from './config.js';
import { LLMClient, type ChatMessage, type ToolDefinition } from './llm.js';
import { McpRegistry } from './mcp.js';
export type AgentMode = 'code' | 'plan' | 'architect' | 'debug' | 'review' | 'test';
export declare const ALL_MODES: AgentMode[];
export declare const MODE_ICONS: Record<AgentMode, string>;
export interface AgentLoopOptions {
    prompt: string;
    model?: string;
    maxSteps?: number;
    maxTokens?: number;
    onToken?: (token: string) => void;
    onThinking?: (thought: string) => void;
    onTool?: (name: string, input: string) => void;
    onToolOutput?: (name: string, output: string, isError?: boolean) => void;
    onRetry?: (attempt: number, maxAttempts: number, delayMs: number, error: Error) => void;
    onModeChange?: (mode: AgentMode) => void;
    signal?: AbortSignal;
    /** When true, runs without step capping (up to 1,000 steps) and auto-corrects on failures without stopping */
    continuous?: boolean;
}
export interface AgentLoopResult {
    response: string;
    thinking?: string;
    steps: number;
    toolCalls: Array<{
        name: string;
        input: string;
        output: string;
    }>;
}
export declare const BUILTIN_TOOL_DEFINITIONS: ToolDefinition[];
export declare const MODE_PROMPTS: Record<AgentMode, string>;
export declare class AgentLoop {
    private llm;
    private config;
    private mcp;
    messages: ChatMessage[];
    private tools;
    private toolCalls;
    mode: AgentMode;
    private baseSystemPrompt;
    constructor(llm: LLMClient, config: AgentHubConfig, mcp: McpRegistry);
    init(systemPrompt: string, externalTools?: ToolDefinition[]): Promise<void>;
    setMode(mode: AgentMode): void;
    run(options: AgentLoopOptions): Promise<AgentLoopResult>;
}
