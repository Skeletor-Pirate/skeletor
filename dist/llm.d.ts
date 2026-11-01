import type { AgentHubConfig } from './config.js';
export interface ChatMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    tool_calls?: ToolCall[];
    tool_call_id?: string;
}
export interface ToolCall {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string;
    };
}
export interface ToolDefinition {
    type: 'function';
    function: {
        name: string;
        description: string;
        parameters: Record<string, unknown>;
    };
}
export interface ChatOptions {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    tools?: ToolDefinition[];
    signal?: AbortSignal;
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    onRetry?: (attempt: number, maxAttempts: number, delayMs: number, error: Error) => void;
    fallbackModels?: string[];
}
export interface ChatResponse {
    content: string;
    thinking?: string;
    toolCalls?: ToolCall[];
    usage?: {
        promptTokens: number;
        completionTokens: number;
    };
    modelUsed?: string;
}
export interface GatewayModel {
    id: string;
    name?: string;
    context_window?: number;
    owned_by?: string;
}
export declare class LLMClient {
    private config;
    constructor(config: AgentHubConfig);
    private rootUrl;
    listModels(): Promise<GatewayModel[]>;
    chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse>;
    stream(messages: ChatMessage[], options?: ChatOptions): AsyncGenerator<string, void, unknown>;
}
