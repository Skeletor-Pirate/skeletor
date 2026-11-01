import { describe, it, expect } from 'vitest';
import { GLOBAL_BENCHMARK_CASES, runGlobalBenchmark } from '../src/benchmark.js';
import { DEFAULT_CONFIG } from '../src/config.js';

describe('Global Coding Agent Benchmark Engine', () => {
  it('registers comprehensive benchmark cases covering HumanEval, SWE-bench, and Aider', () => {
    expect(GLOBAL_BENCHMARK_CASES.length).toBeGreaterThanOrEqual(9);
    const categories = GLOBAL_BENCHMARK_CASES.map(c => c.category);
    expect(categories).toContain('HumanEval');
    expect(categories).toContain('AiderEdit');
    expect(categories).toContain('SWE-bench');
    expect(categories).toContain('HermesReasoning');
    expect(categories).toContain('ToolReliability');
  });

  it('computes deterministic score and leaderboard ranking', async () => {
    // Run benchmark in mock / offline test configuration
    const report = await runGlobalBenchmark({
      ...DEFAULT_CONFIG,
      gatewayUrl: 'http://localhost:3001',
      workspace: process.cwd(),
    });

    expect(report).toBeDefined();
    expect(report.totalCases).toBeGreaterThan(0);
    expect(typeof report.overallScore).toBe('number');
    expect(report.leaderboard.length).toBeGreaterThan(0);

    const skeletorRow = report.leaderboard.find(r => r.agent.includes('SKELETOR'));
    expect(skeletorRow).toBeDefined();
    expect(typeof skeletorRow?.overall).toBe('number');
  });
});
