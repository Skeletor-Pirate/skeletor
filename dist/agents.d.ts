import type { ChildProcess } from 'node:child_process';
import type { AgentHubConfig } from './config.js';
export interface AgentLaunchConfig {
    command: string;
    args?: string[];
    env?: Record<string, string>;
}
export interface AgentInfo {
    id: string;
    name: string;
    category: 'code' | 'agent';
    protocol: string;
}
export declare const BUILTIN_AGENTS: AgentInfo[];
export declare function claudeEnv(config: AgentHubConfig, apiKey: string, model: string): NodeJS.ProcessEnv;
export declare function codexArgs(config: AgentHubConfig, model: string): string[];
export declare function aiderArgs(config: AgentHubConfig, model: string): string[];
export declare function opencodeArgs(config: AgentHubConfig, model: string): string[];
export declare function gooseEnv(config: AgentHubConfig, model: string): NodeJS.ProcessEnv;
export declare function crushEnv(config: AgentHubConfig, model: string): NodeJS.ProcessEnv;
export declare function launchAgent(agentId: string, config: AgentHubConfig, extraArgs?: string[]): ChildProcess;
export declare function agentInfo(id: string): AgentInfo | undefined;
