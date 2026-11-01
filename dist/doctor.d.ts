import type { AgentHubConfig } from './config.js';
export interface DoctorReport {
    gateway: {
        url: string;
        online: boolean;
        latencyMs: number;
        modelsAvailable: number;
        activeModel: string;
        hasKey: boolean;
    };
    brothers: {
        totalInspected: number;
        foundCount: number;
        details: Array<{
            name: string;
            found: boolean;
            capabilities: number;
            location: string;
        }>;
    };
    skills: {
        totalDiscovered: number;
        learnedInWorkspace: number;
    };
    git: {
        isRepo: boolean;
        branch: string;
        hasUncommitted: boolean;
    };
    workspace: {
        path: string;
        hasPackageJson: boolean;
        hasTsConfig: boolean;
    };
}
export declare function runDiagnostics(config: AgentHubConfig): Promise<DoctorReport>;
export declare function renderDoctorReport(report: DoctorReport): void;
