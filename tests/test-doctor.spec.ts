import { describe, it, expect } from 'vitest';
import { runDiagnostics } from '../src/doctor.js';
import { DEFAULT_CONFIG } from '../src/config.js';

describe('Skeletor System Doctor', () => {
  it('runs diagnostics and returns structured system health metrics', async () => {
    const report = await runDiagnostics({
      ...DEFAULT_CONFIG,
      gatewayUrl: 'http://localhost:3001',
      workspace: process.cwd(),
    });

    expect(report).toBeDefined();
    expect(report.gateway).toBeDefined();
    expect(typeof report.gateway.online).toBe('boolean');
    expect(typeof report.gateway.latencyMs).toBe('number');
    expect(report.brothers.totalInspected).toBeGreaterThan(0);
    expect(Array.isArray(report.brothers.details)).toBe(true);
    expect(typeof report.skills.totalDiscovered).toBe('number');
    expect(report.workspace.path).toBe(process.cwd());
  });
});
