import type { AgentHubConfig } from './config.js';
import { LLMClient } from './llm.js';
export interface BenchmarkCase {
    id: string;
    category: 'HumanEval' | 'AiderEdit' | 'SWE-bench' | 'HermesReasoning' | 'ToolReliability';
    name: string;
    description: string;
    run: (config: AgentHubConfig, llm: LLMClient) => Promise<{
        passed: boolean;
        score: number;
        details: string;
        latencyMs: number;
    }>;
}
export interface BenchmarkReport {
    timestamp: string;
    model: string;
    totalCases: number;
    passedCases: number;
    overallScore: number;
    categoryScores: Record<string, {
        total: number;
        passed: number;
        percent: number;
    }>;
    results: Array<{
        id: string;
        category: string;
        name: string;
        passed: boolean;
        score: number;
        details: string;
        latencyMs: number;
    }>;
    leaderboard: Array<{
        agent: string;
        model: string;
        humanEval: number;
        sweBench: number;
        aiderEdit: number;
        overall: number;
        status: string;
    }>;
}
export declare const GLOBAL_BENCHMARK_CASES: BenchmarkCase[];
export declare function runGlobalBenchmark(config: AgentHubConfig, onProgress?: (caseName: string, passed: boolean) => void): Promise<BenchmarkReport>;
export declare function renderBenchmarkReport(report: BenchmarkReport): void;
