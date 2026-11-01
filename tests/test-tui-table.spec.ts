import { describe, it, expect } from 'vitest';
import { formatTable, renderMarkdown } from '../src/tui.js';

describe('TUI Table & Markdown Formatter', () => {
  it('should format markdown tables with Unicode box-drawing characters', () => {
    const rawTable = `
| Command | Mode | Status |
|---|---|---|
| /plan | plan | Active |
| /code | code | Ready |
`;
    const formatted = formatTable(rawTable);
    expect(formatted).toContain('┌');
    expect(formatted).toContain('┬');
    expect(formatted).toContain('┐');
    expect(formatted).toContain('│');
    expect(formatted).toContain('├');
    expect(formatted).toContain('┼');
    expect(formatted).toContain('┤');
    expect(formatted).toContain('└');
    expect(formatted).toContain('┴');
    expect(formatted).toContain('┘');
    expect(formatted).toContain('Command');
    expect(formatted).toContain('/plan');
  });

  it('should unwrap accidental outer code fences in renderMarkdown', () => {
    const aiSlop = '```markdown\n# Project Architecture\n\nHere is the plan:\n```';
    const clean = renderMarkdown(aiSlop);
    expect(clean).not.toContain('```markdown');
    expect(clean).toContain('PROJECT ARCHITECTURE');
  });

  it('should automatically detect and render tables inside prose in renderMarkdown', () => {
    const proseWithTable = `
Here is the status summary:

| Service | Port | State |
|---|---|---|
| FreeLLMAPI | 3001 | Online |
| Skeletor | REPL | Ready |

Enjoy coding!
`;
    const output = renderMarkdown(proseWithTable);
    expect(output).toContain('┌');
    expect(output).toContain('FreeLLMAPI');
    expect(output).toContain('Online');
  });
});
