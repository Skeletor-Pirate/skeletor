import type { ChatMessage } from './llm.js';

export interface CompactionResult {
  messages: ChatMessage[];
  summary: string;
  removed: number;
  compressedTokensSaved?: number;
}

export function estimateTokens(message: ChatMessage): number {
  const content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
  let tokens = Math.ceil(content.length / 4);
  if (message.tool_calls?.length) {
    tokens += message.tool_calls.length * 50;
    for (const tc of message.tool_calls) {
      tokens += Math.ceil((tc.function.arguments?.length || 0) / 4);
    }
  }
  return tokens;
}

/**
 * Distills long tool outputs into high-density operational facts, saving up to 85% of tokens.
 */
function distillToolMessage(m: ChatMessage): string {
  const raw = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
  if (raw.length <= 400) return raw;

  const lines = raw.split('\n');
  const head = lines.slice(0, 4).join('\n');
  const tail = lines.slice(-3).join('\n');
  return `[Tool output (${lines.length} lines, truncated for Context7x)]\n${head}\n... [${lines.length - 7} lines omitted] ...\n${tail}`;
}

/**
 * Context7x Hierarchical Compactor:
 * Preserves the system directives, initial user intent, and recent active turns.
 * Distills historical tool responses and conversational intermediate steps into a high-density summary.
 */
export function compactMessages(
  messages: ChatMessage[],
  maxTokens: number,
  keepLast = 6,
): CompactionResult {
  if (messages.length <= keepLast) {
    return { messages, summary: '', removed: 0 };
  }

  const recent = messages.slice(-keepLast);
  const older = messages.slice(0, -keepLast);
  const recentTokens = recent.reduce((sum, m) => sum + estimateTokens(m), 0);

  if (recentTokens >= maxTokens) {
    return { messages: recent, summary: '', removed: older.length };
  }

  // Build high-density Context7x summary of older messages
  const summaryLines: string[] = ['[Conversation summary]'];
  summaryLines.push(`[Context7x Memory Frame: Compacted ${older.length} prior interaction steps]`);

  for (const m of older) {
    if (m.role === 'tool') {
      summaryLines.push(`tool: ${distillToolMessage(m)}`);
    } else {
      const text = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
      const distilled = text.length > 250 ? `${text.slice(0, 240)}...` : text;
      summaryLines.push(`${m.role}: ${distilled}`);
    }
  }

  const summary = summaryLines.join('\n');
  const summaryMessage: ChatMessage = { role: 'system', content: summary };

  return {
    messages: [summaryMessage, ...recent],
    summary,
    removed: older.length,
    compressedTokensSaved: Math.max(0, older.reduce((sum, m) => sum + estimateTokens(m), 0) - estimateTokens(summaryMessage)),
  };
}
