import type { AgentHubConfig } from './config.js';
export interface ToolResult {
    output: string;
    isError?: boolean;
    /** When true, the agent loop should pause and ask the user before proceeding. */
    needsConfirmation?: boolean;
}
export declare function resolvePath(p: string, workspace: string): string;
export declare function ensureInside(p: string, workspace: string): void;
export declare function toolRead(params: {
    file_path: string;
    start_line?: number;
    end_line?: number;
}, config: AgentHubConfig): Promise<ToolResult>;
export declare function toolWrite(params: {
    file_path: string;
    content: string;
}, config: AgentHubConfig): Promise<ToolResult>;
export declare function toolEdit(params: {
    file_path: string;
    old_string: string;
    new_string: string;
}, config: AgentHubConfig): Promise<ToolResult>;
export declare function toolBash(params: {
    command: string;
    timeout?: number;
}, config: AgentHubConfig): Promise<ToolResult>;
export declare function toolGit(params: {
    args: string[];
}, config: AgentHubConfig): Promise<ToolResult>;
export declare function toolGlob(params: {
    pattern: string;
    path?: string;
}, config: AgentHubConfig): Promise<ToolResult>;
export declare function toolGrep(params: {
    query: string;
    path?: string;
    is_regex?: boolean;
    case_sensitive?: boolean;
    max_results?: number;
}, config: AgentHubConfig): Promise<ToolResult>;
export declare function toolLs(params: {
    path: string;
}, config: AgentHubConfig): Promise<ToolResult>;
export declare function toolFetch(params: {
    url: string;
}, _config: AgentHubConfig): Promise<ToolResult>;
export declare function toolRepoMap(params: {
    path?: string;
    max_depth?: number;
}, config: AgentHubConfig): Promise<ToolResult>;
export declare function toolGraphify(params: {
    path?: string;
    query?: string;
    max_depth?: number;
}, config: AgentHubConfig): Promise<ToolResult>;
export declare function toolLearnSkill(params: {
    name: string;
    description: string;
    instructions: string;
    tags?: string[];
}, config: AgentHubConfig): Promise<ToolResult>;
