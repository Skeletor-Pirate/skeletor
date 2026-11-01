export interface AgentHubConfig {
    gatewayUrl: string;
    apiKey: string;
    model: string;
    workspace: string;
    skillsDirs: string[];
    mcpServers: Record<string, McpServerConfig>;
    agents: Record<string, AgentLaunchConfig>;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    maxSteps?: number;
    /** When true, no shell commands or file writes may execute. */
    readOnly?: boolean;
    /** Path roots the agent is permitted to touch (empty = workspace only). */
    allowPaths?: string[];
    /** Custom regex patterns that require user confirmation before executing in shell. */
    confirmPatterns?: string[];
    /** Custom regex patterns that are unconditionally blocked in shell. */
    blockPatterns?: string[];
    /** When true, runs in continuous autonomous mode with uncapped steps and uninterrupted terminal loops. */
    continuous?: boolean;
    /** When true, automatically approves commands without pausing for terminal confirmation. */
    autoApprove?: boolean;
}
export interface McpServerConfig {
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    url?: string;
    headers?: Record<string, string>;
    transport?: 'stdio' | 'sse' | 'http';
}
export interface AgentLaunchConfig {
    command: string;
    args?: string[];
    env?: Record<string, string>;
}
export declare const DEFAULT_CONFIG: AgentHubConfig;
export declare function saveConfig(config: AgentHubConfig): void;
export declare function loadConfig(): AgentHubConfig;
export declare function expandConfigPaths(config: AgentHubConfig): AgentHubConfig;
