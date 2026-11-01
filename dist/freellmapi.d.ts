export declare function findFreeLLMAPIDir(): string | null;
export declare function getFreeLLMAPIKeyFromDisk(): string;
export declare function isFreeLLMAPIRunning(gatewayUrl?: string): Promise<boolean>;
export declare function ensureFreeLLMAPIRunning(gatewayUrl?: string, onLog?: (msg: string) => void): Promise<{
    running: boolean;
    spawned: boolean;
    key: string;
}>;
