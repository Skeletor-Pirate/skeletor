import type { ChatMessage } from './llm.js';
export interface CompactionResult {
    messages: ChatMessage[];
    summary: string;
    removed: number;
    compressedTokensSaved?: number;
}
export declare function estimateTokens(message: ChatMessage): number;
/**
 * Context7x Hierarchical Compactor:
 * Preserves the system directives, initial user intent, and recent active turns.
 * Distills historical tool responses and conversational intermediate steps into a high-density summary.
 */
export declare function compactMessages(messages: ChatMessage[], maxTokens: number, keepLast?: number): CompactionResult;
