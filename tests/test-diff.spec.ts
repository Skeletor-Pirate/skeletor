import { describe, it, expect } from 'vitest';
import { applySmartEdit, parseSearchReplaceBlocks } from '../src/diff.js';

describe('Smart Edit & Diff Engine (Aider/Claude grade)', () => {
  it('performs exact 1:1 match replacement', () => {
    const original = 'const x = 10;\nconsole.log(x);';
    const res = applySmartEdit(original, 'const x = 10;', 'const x = 20;');
    expect(res.success).toBe(true);
    expect(res.result).toBe('const x = 20;\nconsole.log(x);');
    expect(res.matchedBy).toBe('exact');
  });

  it('normalizes CRLF and LF cross-platform line endings', () => {
    const original = 'first\r\nsecond\r\nthird';
    // LLM sends LF only
    const res = applySmartEdit(original, 'second\n', 'second_modified\n');
    expect(res.success).toBe(true);
    expect(res.result).toContain('second_modified\r\n');
  });

  it('tolerates indentation offset via sliding-window matching', () => {
    const original = 'class Greeter {\n    greet(name: string) {\n        console.log("hi " + name);\n    }\n}';
    // LLM sent 2-space indentation instead of 4-space
    const oldStr = '  greet(name: string) {\n    console.log("hi " + name);\n  }';
    const newStr = '  greet(name: string) {\n    console.log("hello " + name);\n  }';
    const res = applySmartEdit(original, oldStr, newStr);
    expect(res.success).toBe(true);
    expect(res.result).toContain('console.log("hello " + name);');
    expect(res.matchedBy).toBe('whitespace-tolerant');
  });

  it('parses and applies Aider/Git style SEARCH/REPLACE blocks', () => {
    const original = 'let count = 0;\nfunction inc() {\n  count++;\n}';
    const hunk = `<<<<<<< SEARCH\n  count++;\n=======\n  count += 2;\n>>>>>>> REPLACE`;
    const res = applySmartEdit(original, hunk, '');
    expect(res.success).toBe(true);
    expect(res.result).toContain('count += 2;');
    expect(res.matchedBy).toBe('hunk');
  });

  it('rejects ambiguous non-unique matches and suggests context expansion', () => {
    const original = 'test\ntest\ntest';
    const res = applySmartEdit(original, 'test', 'replacement');
    expect(res.success).toBe(false);
    expect(res.error).toContain('must be unique');
  });
});
