import type { Skill } from './skills.js';
export interface SiblingAgentInfo {
    name: string;
    location: string;
    found: boolean;
    skillsFound: string[];
    personasFound: string[];
}
export interface EvolutionResult {
    siblingsInspected: SiblingAgentInfo[];
    skillsAcquired: Array<{
        name: string;
        description: string;
        path: string;
    }>;
    alreadyHadCount: number;
    message: string;
}
/**
 * Inspect sibling CLI agents (Claude Code, OpenCode, Aider, Antigravity)
 * to harvest state-of-the-art workflows, personas, and specialized skills.
 */
export declare function inspectBrotherAgents(workspace: string): SiblingAgentInfo[];
/**
 * Hermes 2.0 Autonomous Self-Evolution Engine:
 * Analyzes sibling capabilities, identifies skill gaps, and synthesizes permanent skills.
 */
export declare function runSelfEvolution(workspace: string, existingSkills: Skill[], options?: {
    allowInternet?: boolean;
}): Promise<EvolutionResult>;
export declare function renderEvolutionReport(result: EvolutionResult): void;
