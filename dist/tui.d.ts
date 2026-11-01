export declare const t: {
    reset: string;
    bold: string;
    dim: string;
    italic: string;
    underline: string;
    inverse: string;
    purple: string;
    purpleDark: string;
    cyan: string;
    cyanDark: string;
    green: string;
    yellow: string;
    red: string;
    gray: string;
    white: string;
    bgPurple: string;
    bgCyan: string;
    bgDark: string;
    bgRed: string;
    bgGreen: string;
};
export declare function renderBanner(stats: {
    gatewayUrl: string;
    gatewayOnline: boolean;
    model: string;
    mode: string;
    skillsCount: number;
    mcpToolsCount: number;
    continuous?: boolean;
}): void;
export declare function formatCodeBlock(lang: string, code: string): string;
export declare function formatTable(tableMarkdown: string): string;
export declare function renderMarkdown(raw: string): string;
export declare function renderToolCall(name: string, input: string): void;
export declare function renderToolOutput(name: string, output: string, isError?: boolean): void;
export declare function renderThinking(thinking: string): void;
export declare function renderSummaryLine(stats: {
    durationMs: number;
    steps: number;
    model: string;
}): void;
export declare function loadHistory(): string[];
export declare function appendHistory(line: string): void;
export declare function askPrompt(opts: {
    sessionId: string;
    mode: string;
    model: string;
    onCycleMode?: () => void;
}): Promise<string>;
export declare function askConfirmation(question: string, defaultYes?: boolean): Promise<boolean>;
export declare function createSpinner(title: string): {
    start(): void;
    update(newTitle: string): void;
    updateRetry(attempt: number, maxAttempts: number, delayMs: number, error: Error): void;
    stop(finalMessage?: string): void;
};
