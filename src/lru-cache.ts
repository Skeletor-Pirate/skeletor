interface CacheNode<V> {
  key: unknown;
  value: V;
  expire: number | null; // timestamp in ms when expires, null means no expiration
  prev: CacheNode<V> | null;
  next: CacheNode<V> | null;
}

export class LRUCache<K, V> {
  private capacity: number;
  private defaultTTL: number | null;
  private map: Map<K, CacheNode<V>>;
  private head: CacheNode<V> | null;
  private tail: CacheNode<V> | null;

  constructor(capacity: number, defaultTTL: number | null = null) {
    if (capacity <= 0) {
      throw new Error('Capacity must be greater than 0');
    }
    this.capacity = capacity;
    this.defaultTTL = defaultTTL;
    this.map = new Map();
    this.head = null;
    this.tail = null;
  }

  get(key: K): V | undefined {
    const node = this.map.get(key);
    if (!node) return undefined;

    // Check expiration
    if (node.expire !== null && Date.now() > node.expire) {
      this.deleteNode(node);
      this.map.delete(key);
      return undefined;
    }

    // Move to head (most recently used)
    this.moveToHead(node);
    return node.value;
  }

  set(key: K, value: V, ttlOverride: number | null = this.defaultTTL): void {
    // If key exists, update value and move to head
    if (this.map.has(key)) {
      const node = this.map.get(key)!;
      node.value = value;
      // Update expiration: if ttlOverride is null, no expiration; else compute timestamp
      node.expire = ttlOverride !== null ? Date.now() + ttlOverride : null;
      this.moveToHead(node);
      return;
    }

    // Create new node
    const newNode: CacheNode<V> = {
      key,
      value,
      expire: ttlOverride !== null ? Date.now() + ttlOverride : null,
      prev: null,
      next: null,
    };

    // Add to map and move to head
    this.map.set(key, newNode);
    this.addToHead(newNode);

    // Evict if over capacity
    if (this.map.size > this.capacity) {
      this.evictLRU();
    }
  }

  delete(key: K): boolean {
    const node = this.map.get(key);
    if (!node) return false;
    this.deleteNode(node);
    this.map.delete(key);
    return true;
  }

  size(): number {
    return this.map.size;
  }

  pruneExpired(): number {
    let count = 0;
    const now = Date.now();
    // Iterate over all entries; remove expired ones
    for (const [key, node] of this.map) {
      if (node.expire !== null && now > node.expire) {
        this.deleteNode(node);
        this.map.delete(key);
        count++;
      }
    }
    return count;
  }

  // --- Internal helpers ---

  private addToHead(node: CacheNode<V>): void {
    node.prev = null;
    node.next = this.head;
    if (this.head) {
      this.head.prev = node;
    }
    this.head = node;
    if (!this.tail) {
      this.tail = node;
    }
  }

  private deleteNode(node: CacheNode<V>): void {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }
    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }
    node.prev = null;
    node.next = null;
  }

  private moveToHead(node: CacheNode<V>): void {
    if (this.head === node) return; // already head
    this.deleteNode(node);
    this.addToHead(node);
  }

  private evictLRU(): void {
    if (!this.tail) return;
    const lru = this.tail;
    this.deleteNode(lru);
    this.map.delete(lru.key as K);
  }
}