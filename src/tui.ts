import readline from 'node:readline';
import process from 'node:process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Cyberpunk / Skeletor ANSI 24-bit TrueColor & 256-color palette
export const t = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  inverse: '\x1b[7m',

  // TrueColor Neons
  purple: '\x1b[38;2;191;90;242m',
  purpleDark: '\x1b[38;2;120;40;180m',
  cyan: '\x1b[38;2;0;240;255m',
  cyanDark: '\x1b[38;2;0;130;180m',
  green: '\x1b[38;2;57;255;20m',
  yellow: '\x1b[38;2;255;215;0m',
  red: '\x1b[38;2;255;40;80m',
  gray: '\x1b[38;2;130;135;150m',
  white: '\x1b[38;2;240;245;255m',

  // Badges & Backgrounds
  bgPurple: '\x1b[48;2;80;20;120m',
  bgCyan: '\x1b[48;2;0;80;100m',
  bgDark: '\x1b[48;2;25;26;35m',
  bgRed: '\x1b[48;2;100;15;30m',
  bgGreen: '\x1b[48;2;15;70;25m',
};

export function renderBanner(stats: {
  gatewayUrl: string;
  gatewayOnline: boolean;
  model: string;
  mode: string;
  skillsCount: number;
  mcpToolsCount: number;
  continuous?: boolean;
}): void {
  const gwDot = stats.gatewayOnline ? `${t.green}●${t.reset}` : `${t.red}○${t.reset}`;
  const gwText = stats.gatewayOnline ? `${t.green}gateway: 3001${t.reset}` : `${t.red}gateway: offline${t.reset}`;
  const contBadge = stats.continuous ? `  ${t.dim}│${t.reset}  ${t.bold}${t.green}mode: continuous (uncapped)${t.reset}` : '';

  process.stdout.write(`
${t.purple}╭────────────────────────────────────────────────────────────────────────╮${t.reset}
${t.purple}│${t.reset}  ${t.bold}${t.white}SKELETOR${t.reset} ${t.dim}· autonomous cli coding engine v2.0${t.reset}
${t.purple}│${t.reset}  ${gwDot} ${gwText}  ${t.dim}│${t.reset}  ${t.purple}${stats.mode.toUpperCase()}${t.reset}  ${t.dim}│${t.reset}  ${t.cyan}${stats.model}${t.reset}${contBadge}  ${t.dim}│${t.reset}  ${t.dim}${stats.skillsCount} skills${t.reset}  ${t.dim}│${t.reset}  ${t.dim}${stats.mcpToolsCount} tools${t.reset}
${t.purple}╰────────────────────────────────────────────────────────────────────────╯${t.reset}
  ${t.dim}commands: ${t.cyan}/help${t.reset}${t.dim}, ${t.cyan}/continuous${t.reset}${t.dim}, ${t.cyan}/mode${t.reset}${t.dim}, ${t.cyan}/models${t.reset}${t.dim}, ${t.cyan}/skills${t.reset}${t.dim}, ${t.cyan}/diff${t.reset}${t.dim}, ${t.cyan}/benchmark${t.reset}
`);
}

export function formatCodeBlock(lang: string, code: string): string {
  const cleanCode = code.replace(/\r\n/g, '\n').trimEnd();
  const rawLines = cleanCode.split('\n');
  const width = 66;
  const label = `── [ ${lang.toUpperCase() || 'CODE'} ] `;
  const topBar = '─'.repeat(Math.max(4, width - label.length));
  const top = `${t.purple}╭${label}${topBar}╮${t.reset}`;
  const bottom = `${t.purple}╰${'─'.repeat(width)}╯${t.reset}`;

  const lines = rawLines.map((l, idx) => {
    let colored = l;
    if (lang === 'diff' || l.startsWith('+') || l.startsWith('-')) {
      if (l.startsWith('+')) colored = `${t.green}${l}${t.reset}`;
      else if (l.startsWith('-')) colored = `${t.red}${l}${t.reset}`;
    }
    const lineNum = `${t.dim}${String(idx + 1).padStart(3, ' ')} │${t.reset}`;
    return `${t.purple}│${t.reset} ${lineNum} ${colored}`;
  });

  return `\n${top}\n${lines.join('\n')}\n${bottom}\n`;
}

function formatInline(line: string): string {
  let str = line;
  // Bold **text**
  str = str.replace(/\*\*(.*?)\*\*/g, `${t.bold}$1${t.reset}`);
  // Italic *text*
  str = str.replace(/(^|[^*])\*([^*]+)\*([^*]|$)/g, `$1${t.italic}$2${t.reset}$3`);
  // Inline code `code`
  str = str.replace(/`([^`]+)`/g, `${t.bgDark}${t.cyan} $1 ${t.reset}`);
  return str;
}

export function formatTable(tableMarkdown: string): string {
  const lines = tableMarkdown.trim().split('\n').filter(l => l.trim().startsWith('|'));
  if (lines.length < 2) return tableMarkdown;

  const rows = lines.map(l =>
    l.split('|')
     .slice(1, -1)
     .map(cell => cell.trim())
  );

  const isSep = rows[1]?.every(c => /^:?-+:?$/.test(c));
  if (!isSep) return tableMarkdown;

  const header = rows[0];
  const body = rows.slice(2);
  const colCount = header.length;

  const widths = new Array(colCount).fill(0);
  for (const r of [header, ...body]) {
    for (let c = 0; c < colCount; c++) {
      widths[c] = Math.max(widths[c], (r[c] || '').length);
    }
  }

  const pad = (str: string, len: number) => str + ' '.repeat(Math.max(0, len - str.length));

  const topBorder = `${t.purple}┌${widths.map(w => '─'.repeat(w + 2)).join('┬')}┐${t.reset}`;
  const midBorder = `${t.purple}├${widths.map(w => '─'.repeat(w + 2)).join('┼')}┤${t.reset}`;
  const botBorder = `${t.purple}└${widths.map(w => '─'.repeat(w + 2)).join('┴')}┘${t.reset}`;

  const formatRow = (row: string[], isHdr = false) => {
    const cells = widths.map((w, i) => {
      const cellText = pad(row[i] || '', w);
      return isHdr ? `${t.bold}${t.white}${cellText}${t.reset}` : `${t.cyan}${cellText}${t.reset}`;
    });
    return `${t.purple}│${t.reset} ${cells.join(` ${t.purple}│${t.reset} `)} ${t.purple}│${t.reset}`;
  };

  const rendered: string[] = [];
  rendered.push(topBorder);
  rendered.push(formatRow(header, true));
  rendered.push(midBorder);
  for (const row of body) {
    rendered.push(formatRow(row, false));
  }
  rendered.push(botBorder);

  return '\n' + rendered.join('\n') + '\n';
}

function formatProseMarkdown(content: string): string {
  // Check if content contains markdown tables
  const lines = content.split('\n');
  const renderedChunks: string[] = [];
  let tableBuffer: string[] = [];

  const flushTable = () => {
    if (tableBuffer.length > 0) {
      renderedChunks.push(formatTable(tableBuffer.join('\n')));
      tableBuffer = [];
    }
  };

  for (const line of lines) {
    if (/^\s*\|.+\|\s*$/.test(line)) {
      tableBuffer.push(line);
      continue;
    } else {
      flushTable();
    }

    // Headings
    if (/^#\s+(.+)$/.test(line)) {
      const title = line.replace(/^#\s+/, '').trim();
      renderedChunks.push(`\n${t.bold}${t.purple}━━━ ${title.toUpperCase()} ━━━${t.reset}`);
      continue;
    }
    if (/^##\s+(.+)$/.test(line)) {
      const title = line.replace(/^##\s+/, '').trim();
      renderedChunks.push(`\n${t.bold}${t.cyan}■ ${title}${t.reset}`);
      continue;
    }
    if (/^###\s+(.+)$/.test(line)) {
      const title = line.replace(/^###\s+/, '').trim();
      renderedChunks.push(`\n${t.bold}${t.white}▶ ${title}${t.reset}`);
      continue;
    }

    // Bullet lists (- or * or +)
    if (/^\s*[-*+]\s+(.+)$/.test(line)) {
      const indent = line.match(/^(\s*)/)?.[1] || '';
      const text = line.replace(/^\s*[-*+]\s+/, '');
      renderedChunks.push(`${indent}  ${t.cyan}•${t.reset} ${formatInline(text)}`);
      continue;
    }

    // Numbered lists (1. 2.)
    const numMatch = line.match(/^\s*(\d+)\.\s+(.+)$/);
    if (numMatch) {
      renderedChunks.push(`  ${t.purple}${numMatch[1]}.${t.reset} ${formatInline(numMatch[2])}`);
      continue;
    }

    // Blockquote (> )
    if (/^\s*>\s*(.+)$/.test(line)) {
      const quote = line.replace(/^\s*>\s*/, '');
      renderedChunks.push(`  ${t.purple}│${t.reset} ${t.dim}${formatInline(quote)}${t.reset}`);
      continue;
    }

    // Regular line
    renderedChunks.push(formatInline(line));
  }
  flushTable();

  return renderedChunks.join('\n');
}

export function renderMarkdown(raw: string): string {
  if (!raw) return '';

  let text = raw.trim();

  // 1. Unwrap accidental outer full-response markdown/text code fences
  const fullFenceMatch = text.match(/^```(?:markdown|md|text)?\r?\n([\s\S]*?)\r?\n```$/i);
  if (fullFenceMatch) {
    text = fullFenceMatch[1].trim();
  }

  // 2. Separate code blocks from regular prose
  const codeBlockRegex = /```(\w+)?\r?\n([\s\S]*?)```/g;
  const segments: Array<{ isCode: boolean; lang?: string; content: string }> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ isCode: false, content: text.slice(lastIndex, match.index) });
    }
    const lang = (match[1] || 'text').toLowerCase();
    // If the block is tagged as markdown/text and doesn't contain source code keywords, unwrap it
    if ((lang === 'markdown' || lang === 'md' || lang === 'text') && !match[2].includes('export ') && !match[2].includes('function ')) {
      segments.push({ isCode: false, content: match[2] });
    } else {
      segments.push({ isCode: true, lang, content: match[2] });
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ isCode: false, content: text.slice(lastIndex) });
  }

  return segments.map(seg => {
    if (seg.isCode) {
      return formatCodeBlock(seg.lang || 'code', seg.content);
    }
    return formatProseMarkdown(seg.content);
  }).join('');
}

export function renderToolCall(name: string, input: string): void {
  let target = '';
  try {
    const parsed = JSON.parse(input);
    target = parsed.command || parsed.file_path || parsed.path || parsed.pattern || '';
  } catch {
    target = input;
  }
  if (target.length > 60) target = target.slice(0, 57) + '...';
  const targetStr = target ? ` ${t.dim}·${t.reset} ${t.white}${target}${t.reset}` : '';
  process.stdout.write(`\n${t.cyan}❯${t.reset} ${t.bold}${name}${t.reset}${targetStr}\n`);
}

export function renderToolOutput(name: string, output: string, isError = false): void {
  const lines = output.trim().split('\n').filter(Boolean);
  const first = lines[0] || (isError ? 'Failed' : 'Done');
  const summary = first.length > 80 ? first.slice(0, 77) + '...' : first;
  const more = lines.length > 1 ? ` ${t.dim}(+${lines.length - 1} lines)${t.reset}` : '';
  const branch = isError ? `${t.red}×${t.reset}` : `${t.purple}│${t.reset}`;
  const color = isError ? t.red : t.gray;
  process.stdout.write(`  ${branch} ${color}${summary}${t.reset}${more}\n`);
}

export function renderThinking(thinking: string): void {
  const trimmed = thinking.trim();
  if (!trimmed) return;
  const lines = trimmed.split('\n');
  process.stdout.write(`\n${t.purple}┌─${t.reset} ${t.dim}${t.italic}thinking${t.reset}\n`);
  for (const line of lines) {
    process.stdout.write(`${t.purple}│${t.reset} ${t.dim}${t.italic}${line}${t.reset}\n`);
  }
  process.stdout.write(`${t.purple}└─────────────────────────────────────────────────────────${t.reset}\n`);
}

export function renderSummaryLine(stats: { durationMs: number; steps: number; model: string }): void {
  const sec = (stats.durationMs / 1000).toFixed(1);
  process.stdout.write(`\n${t.dim}Completed in ${sec}s · ${stats.steps} step${stats.steps === 1 ? '' : 's'} · ${stats.model}${t.reset}\n`);
}

const SLASH_COMMANDS: Array<{ cmd: string; desc: string }> = [
  { cmd: '/help', desc: 'Show all slash commands and shortcuts' },
  { cmd: '/continuous', desc: 'Toggle uncapped continuous autonomous coding mode (no stops, auto-heal)' },
  { cmd: '/plan', desc: 'Switch to read-only blueprint architecture mode' },
  { cmd: '/code', desc: 'Switch to implementation coding mode' },
  { cmd: '/debug', desc: 'Switch to systematic hypothesis-driven debug mode' },
  { cmd: '/review', desc: 'Switch to security & architectural code review mode' },
  { cmd: '/test', desc: 'Switch to test engineering & suite coverage mode' },
  { cmd: '/learn', desc: 'Synthesize & save a permanent skill from session (Hermes style)' },
  { cmd: '/evolve', desc: 'Trigger Hermes 2.0 self-evolution (learn from brother agents & web)' },
  { cmd: '/doctor', desc: 'Run full system health and environment diagnostic audit' },
  { cmd: '/benchmark', desc: 'Run global coding agent benchmark evaluation & leaderboard' },
  { cmd: '/steps', desc: 'Adjust max steps per turn before synthesis (e.g. /steps 100)' },
  { cmd: '/mode', desc: 'Switch persona: code, plan, debug, review, test' },
  { cmd: '/graphify', desc: 'AST code graph & symbol intelligence (Context7x)' },
  { cmd: '/model', desc: 'Select or pin active LLM model' },
  { cmd: '/models', desc: 'List all live models from FreeLLMAPI' },
  { cmd: '/skills', desc: 'List all discovered skills' },
  { cmd: '/skill', desc: 'Inspect & activate a specific skill' },
  { cmd: '/mcp', desc: 'List connected MCP servers and tools' },
  { cmd: '/tools', desc: 'List all active native and MCP tools' },
  { cmd: '/diff', desc: 'Inspect current git working tree diff' },
  { cmd: '/commit', desc: 'Stage and commit current changes' },
  { cmd: '/undo', desc: 'Discard uncommitted changes (git checkout)' },
  { cmd: '/repomap', desc: 'View hierarchical codebase structure' },
  { cmd: '/sessions', desc: 'List all saved agent sessions' },
  { cmd: '/session', desc: 'Load a saved session by ID' },
  { cmd: '/new', desc: 'Start a fresh conversation session' },
  { cmd: '/clear', desc: 'Clear current conversation messages' },
  { cmd: '/save', desc: 'Save current session snapshot' },
  { cmd: '/exit', desc: 'Quit Skeletor' },
];

function historyFile(): string {
  const dir = path.join(process.env.USERPROFILE || process.env.HOME || os.homedir(), '.skeletor');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'history.txt');
}

export function loadHistory(): string[] {
  try {
    const f = historyFile();
    if (!fs.existsSync(f)) return [];
    return fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).slice(-200);
  } catch {
    return [];
  }
}

export function appendHistory(line: string): void {
  if (!line.trim()) return;
  try {
    fs.appendFileSync(historyFile(), `${line.trim()}\n`, 'utf8');
  } catch {
    // Ignore
  }
}

function getGitBranch(): string {
  try {
    const gitHeadPath = path.join(process.cwd(), '.git', 'HEAD');
    if (fs.existsSync(gitHeadPath)) {
      const content = fs.readFileSync(gitHeadPath, 'utf8').trim();
      if (content.startsWith('ref: refs/heads/')) {
        return content.replace('ref: refs/heads/', '');
      }
      return content.slice(0, 7);
    }
  } catch {
    // Ignore
  }
  return '';
}

export async function askPrompt(opts: {
  sessionId: string;
  mode: string;
  model: string;
  onCycleMode?: () => void;
}): Promise<string> {
  const shortDir = path.basename(process.cwd());
  const branch = getGitBranch();
  const branchStr = branch ? ` ${t.dim}[${branch}]${t.reset}` : '';
  const header = `\n${t.purple}╭─${t.reset} ${t.bold}${t.purple}skeletor${t.reset} ${t.dim}·${t.reset} ${t.cyan}${shortDir}${t.reset}${branchStr} ${t.dim}[${opts.mode}:${opts.model}]${t.reset}`;
  const promptLine = `${t.purple}╰─❯${t.reset} `;

  process.stdout.write(`${header}\n`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    completer: (line: string) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('/')) {
        const hits = SLASH_COMMANDS.filter(c => c.cmd.startsWith(trimmed));
        return [hits.map(c => c.cmd), trimmed];
      }
      return [[], line];
    },
  });

  return new Promise<string>(resolve => {
    // Listen for Shift+Tab (\x1b[Z)
    const onData = (chunk: Buffer) => {
      if (chunk.toString() === '\x1b[Z') {
        opts.onCycleMode?.();
      }
    };
    if (process.stdin.isTTY) {
      process.stdin.on('data', onData);
    }

    rl.on('SIGINT', () => {
      if (process.stdin.isTTY) {
        process.stdin.removeListener('data', onData);
      }
      process.stdout.write(`\n  ${t.dim}(Type ${t.cyan}/exit${t.reset} ${t.dim}to quit Skeletor)${t.reset}\n`);
      rl.close();
      resolve('');
    });

    rl.question(promptLine, answer => {
      if (process.stdin.isTTY) {
        process.stdin.removeListener('data', onData);
      }
      rl.close();
      const trimmed = answer.trim();
      if (trimmed) appendHistory(trimmed);
      resolve(trimmed);
    });
  });
}

export async function askConfirmation(question: string, defaultYes = false): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise<boolean>(resolve => {
    rl.question(question, answer => {
      rl.close();
      const trimmed = answer.trim().toLowerCase();
      if (!trimmed) resolve(defaultYes);
      else resolve(trimmed === 'y' || trimmed === 'yes');
    });
  });
}

export function createSpinner(title: string) {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  let timer: NodeJS.Timeout | null = null;

  return {
    start() {
      process.stdout.write('\x1b[?25l'); // Hide cursor
      timer = setInterval(() => {
        process.stdout.write(`\r\x1b[2K  ${t.cyan}${frames[i++ % frames.length]}${t.reset} ${t.dim}${title}${t.reset} `);
      }, 80);
    },
    update(newTitle: string) {
      title = newTitle;
    },
    updateRetry(attempt: number, maxAttempts: number, delayMs: number, error: Error) {
      const sec = (delayMs / 1000).toFixed(1);
      const isRate = error.message.includes('429') || error.message.toLowerCase().includes('rate');
      const isOverload = error.message.includes('50') || error.message.includes('529');
      const tag = isRate ? 'Rate limit reached' : isOverload ? 'Gateway busy' : 'Connection retry';
      title = `${t.yellow}[${tag} — retrying in ${sec}s (attempt ${attempt}/${maxAttempts})]${t.reset}`;
    },
    stop(finalMessage?: string) {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      process.stdout.write(`\r\x1b[2K\x1b[?25h`); // Clear line & show cursor
      if (finalMessage) {
        process.stdout.write(`  ${t.green}✓${t.reset} ${finalMessage}\n`);
      }
    },
  };
}
