import type { McpServerConfig } from './config.js';
import type { ToolDefinition } from './llm.js';
export interface McpTool {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
    server: string;
}
export interface McpResult {
    content: string;
    isError?: boolean;
}
export declare class McpClient {
    readonly name: string;
    private readonly config;
    private process;
    private nextId;
    private pending;
    private tools;
    private rl;
    constructor(name: string, config: McpServerConfig);
    start(): Promise<void>;
    private startHttp;
    private request;
    private requestHttp;
    listTools(): McpTool[];
    callTool(toolName: string, args: Record<string, unknown>): Promise<McpResult>;
    stop(): Promise<void>;
}
export declare class McpRegistry {
    private servers;
    private clients;
    constructor(servers: Record<string, McpServerConfig>);
    startAll(timeoutMs?: number): Promise<McpTool[]>;
    getTools(): McpTool[];
    callTool(server: string, toolName: string, args: Record<string, unknown>): Promise<McpResult>;
    stopAll(): Promise<void>;
}
export declare function mcpToolsToDefinitions(tools: McpTool[]): ToolDefinition[];
