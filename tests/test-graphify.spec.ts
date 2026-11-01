import { describe, it, expect } from 'vitest';
import { parseFileSymbols, buildCodeGraph, renderCompressedCodeMap, queryCodeGraph } from '../src/graphify.js';

describe('Graphify AST Code Intelligence', () => {
  it('should parse functions, classes, and types from TypeScript source', () => {
    const code = `
import { foo } from './bar.js';

export interface UserProfile {
  id: string;
  name: string;
}

export class UserManager {
  getUser(id: string): UserProfile {
    return { id, name: 'Alice' };
  }
}

export async function fetchUserById(id: string): Promise<UserProfile> {
  return new UserManager().getUser(id);
}
`;
    const res = parseFileSymbols(code, '.ts');
    expect(res.imports).toContain('./bar.js');
    expect(res.symbols.length).toBeGreaterThanOrEqual(3);

    const iface = res.symbols.find(s => s.kind === 'interface');
    expect(iface?.name).toBe('UserProfile');

    const cls = res.symbols.find(s => s.kind === 'class');
    expect(cls?.name).toBe('UserManager');

    const fn = res.symbols.find(s => s.kind === 'function');
    expect(fn?.name).toBe('fetchUserById');
    expect(fn?.isExported).toBe(true);
  });

  it('should parse Python functions and classes', () => {
    const code = `
import os
from pathlib import Path

class ModelTrainer:
    def __init__(self, lr: float = 0.01):
        self.lr = lr

def train_epoch(data, epochs: int) -> float:
    return 0.42
`;
    const res = parseFileSymbols(code, '.py');
    expect(res.symbols.length).toBeGreaterThanOrEqual(2);
    expect(res.symbols.some(s => s.name === 'ModelTrainer')).toBe(true);
    expect(res.symbols.some(s => s.name === 'train_epoch')).toBe(true);
  });

  it('should build code graph and query symbols', () => {
    const graph = buildCodeGraph(process.cwd(), { maxDepth: 2 });
    expect(graph.totalFiles).toBeGreaterThan(0);

    const compressed = renderCompressedCodeMap(graph);
    expect(compressed).toContain('Codebase Graph');

    const queryRes = queryCodeGraph(graph, 'executeTool');
    expect(typeof queryRes).toBe('string');
  });
});
