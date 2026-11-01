export declare class LRUCache<K, V> {
    private capacity;
    private defaultTTL;
    private map;
    private head;
    private tail;
    constructor(capacity: number, defaultTTL?: number | null);
    get(key: K): V | undefined;
    set(key: K, value: V, ttlOverride?: number | null): void;
    delete(key: K): boolean;
    size(): number;
    pruneExpired(): number;
    private addToHead;
    private deleteNode;
    private moveToHead;
    private evictLRU;
}
