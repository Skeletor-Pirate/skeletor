import { describe, it, expect } from 'vitest';
import { compactMessages } from '../src/compaction.js';
import type { ChatMessage } from '../src/llm.js';

describe('Compaction', () => {
  it('should not compact small message lists', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi' },
    ];
    const result = compactMessages(messages, 100_000);
    expect(result.removed).toBe(0);
    expect(result.messages).toBe(messages);
  });

  it('should compact large message lists', () => {
    const messages: ChatMessage[] = [];
    for (let i = 0; i < 20; i++) {
      messages.push({ role: 'user', content: `Message ${i}` });
      messages.push({ role: 'assistant', content: `Response ${i}` });
    }
    const result = compactMessages(messages, 1000, 4);
    expect(result.removed).toBeGreaterThan(0);
    expect(result.messages.length).toBeLessThan(messages.length);
    expect(result.summary).toContain('[Conversation summary]');
  });

  it('should keep the last N messages', () => {
    const messages: ChatMessage[] = [];
    for (let i = 0; i < 20; i++) {
      messages.push({ role: 'user', content: `Message ${i}` });
    }
    const result = compactMessages(messages, 1000, 4);
    const lastMessages = result.messages.slice(-4);
    expect(lastMessages[0].content).toBe('Message 16');
    expect(lastMessages[3].content).toBe('Message 19');
  });
});
