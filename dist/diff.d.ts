/**
 * Smart Edit & Patch Engine for Skeletor
 * Implements Aider/Claude Code-grade whitespace tolerance, line-ending normalization,
 * sliding-window fuzzy matching, and search/replace diff block parsing.
 */
export interface SmartEditResult {
    success: boolean;
    result?: string;
    error?: string;
    matchedBy?: 'exact' | 'normalized-line-endings' | 'whitespace-tolerant' | 'hunk';
}
/**
 * Normalizes string line endings to LF (\n).
 */
export declare function normalizeLineEndings(str: string): string;
/**
 * Detects whether a string primarily uses CRLF line endings.
 */
export declare function usesCrlf(str: string): boolean;
/**
 * Extracts search and replace chunks if input is wrapped in Aider/Git style markers:
 * <<<<<<< SEARCH
 * old code
 * =======
 * new code
 * >>>>>>> REPLACE
 */
export declare function parseSearchReplaceBlocks(input: string): Array<{
    search: string;
    replace: string;
}> | null;
/**
 * Applies smart edit using multi-tier matching strategies:
 * Tier 1: Exact string match
 * Tier 2: Normalized line endings (\r\n vs \n)
 * Tier 3: Whitespace-tolerant sliding-window line matching
 */
export declare function applySmartEdit(originalContent: string, rawOldString: string, rawNewString: string): SmartEditResult;
