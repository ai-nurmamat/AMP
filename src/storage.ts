import { createClient, RedisClientType } from 'redis';
import { MemoryEvent, MemoryQuery, MemoryResult, MemoryRef } from './types';

export interface IStorageProvider {
  store(event: MemoryEvent): Promise<MemoryRef>;
  retrieve(query: MemoryQuery): Promise<MemoryResult[]>;
  update(id: string, updates: Partial<MemoryEvent>): Promise<MemoryRef | null>;
  delete(id: string): Promise<boolean>;
  getSize(): Promise<number>;
  connect?(): Promise<void>;
  disconnect?(): Promise<void>;
}

export class MemoryStorageProvider implements IStorageProvider {
  private storeMap: Map<string, MemoryResult> = new Map();

  async store(event: MemoryEvent): Promise<MemoryRef> {
    const id = event.id || crypto.randomUUID();
    const now = Date.now();
    const memoryRecord: MemoryResult = {
      id,
      content: event.content,
      score: 1.0,
      tier: event.tier,
      metadata: {
        importance: event.metadata?.importance ?? 0.5,
        tags: event.metadata?.tags || [],
        timestamp: now,
        lastAccessedAt: now,
        ...event.metadata
      }
    };
    this.storeMap.set(id, memoryRecord);
    return { id, tier: event.tier, created_at: now, updated_at: now };
  }

  async retrieve(query: MemoryQuery): Promise<MemoryResult[]> {
    const results: MemoryResult[] = [];
    for (const [id, record] of this.storeMap.entries()) {
      if (query.tier && record.tier !== query.tier) continue;
      if (query.tags && !query.tags.every(t => record.metadata.tags.includes(t))) continue;
      if (query.minImportance && record.metadata.importance < query.minImportance) continue;

      let score = 0;
      if (record.content.includes(query.query)) {
        score = 1.0;
      } else {
        const words = query.query.split(' ').filter(w => w.trim().length > 0);
        if (words.length > 0) {
            const matchCount = words.filter(w => record.content.includes(w)).length;
            score = matchCount / words.length;
        }
      }

      if (score > 0) {
        record.metadata.lastAccessedAt = Date.now();
        results.push({ ...record, score });
      }
    }

    results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.metadata.importance - a.metadata.importance;
    });

    return results.slice(0, query.limit || 10);
  }

  async update(id: string, updates: Partial<MemoryEvent>): Promise<MemoryRef | null> {
    const record = this.storeMap.get(id);
    if (!record) return null;
    if (updates.content) record.content = updates.content;
    if (updates.tier) record.tier = updates.tier;
    if (updates.metadata) {
      record.metadata = { ...record.metadata, ...updates.metadata };
    }
    const now = Date.now();
    record.metadata.updated_at = now;
    this.storeMap.set(id, record);
    return { id, tier: record.tier, created_at: record.metadata.timestamp, updated_at: now };
  }

  async delete(id: string): Promise<boolean> {
    return this.storeMap.delete(id);
  }

  async getSize(): Promise<number> {
    return this.storeMap.size;
  }
}

export class RedisStorageProvider implements IStorageProvider {
  private client: RedisClientType;
  private prefix = 'amp:memory:';

  constructor(redisUrl: string) {
    this.client = createClient({ url: redisUrl });
    this.client.on('error', (err) => console.error('[AMP Redis Error]', err));
  }

  async connect(): Promise<void> {
    await this.client.connect();
    // 颠覆性创新：在真实生产环境中，此处应自动创建 RediSearch 索引 (FT.CREATE)
    // 这里为保证代码即插即用和简洁性，先用 JSON 结构模拟高维检索。
  }

  async disconnect(): Promise<void> {
    await this.client.disconnect();
  }

  async store(event: MemoryEvent): Promise<MemoryRef> {
    const id = event.id || crypto.randomUUID();
    const now = Date.now();
    const memoryRecord: MemoryResult = {
      id,
      content: event.content,
      score: 1.0,
      tier: event.tier,
      metadata: {
        importance: event.metadata?.importance ?? 0.5,
        tags: event.metadata?.tags || [],
        timestamp: now,
        lastAccessedAt: now,
        ...event.metadata
      }
    };
    
    await this.client.set(`${this.prefix}${id}`, JSON.stringify(memoryRecord));
    return { id, tier: event.tier, created_at: now, updated_at: now };
  }

  async retrieve(query: MemoryQuery): Promise<MemoryResult[]> {
    const keys = await this.client.keys(`${this.prefix}*`);
    const results: MemoryResult[] = [];
    
    for (const key of keys) {
      const data = await this.client.get(key);
      if (!data) continue;
      
      const record = JSON.parse(data) as MemoryResult;
      
      if (query.tier && record.tier !== query.tier) continue;
      if (query.tags && !query.tags.every(t => record.metadata.tags.includes(t))) continue;
      if (query.minImportance && record.metadata.importance < query.minImportance) continue;

      let score = 0;
      if (record.content.includes(query.query)) {
        score = 1.0;
      } else {
        const words = query.query.split(' ').filter(w => w.trim().length > 0);
        if (words.length > 0) {
            const matchCount = words.filter(w => record.content.includes(w)).length;
            score = matchCount / words.length;
        }
      }

      if (score > 0) {
        record.metadata.lastAccessedAt = Date.now();
        await this.client.set(key, JSON.stringify(record));
        results.push({ ...record, score });
      }
    }

    results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.metadata.importance - a.metadata.importance;
    });

    return results.slice(0, query.limit || 10);
  }

  async update(id: string, updates: Partial<MemoryEvent>): Promise<MemoryRef | null> {
    const key = `${this.prefix}${id}`;
    const data = await this.client.get(key);
    if (!data) return null;

    const record = JSON.parse(data) as MemoryResult;
    if (updates.content) record.content = updates.content;
    if (updates.tier) record.tier = updates.tier;
    if (updates.metadata) {
      record.metadata = { ...record.metadata, ...updates.metadata };
    }
    const now = Date.now();
    record.metadata.updated_at = now;
    
    await this.client.set(key, JSON.stringify(record));
    return { id, tier: record.tier, created_at: record.metadata.timestamp, updated_at: now };
  }

  async delete(id: string): Promise<boolean> {
    const deleted = await this.client.del(`${this.prefix}${id}`);
    return deleted > 0;
  }

  async getSize(): Promise<number> {
    const keys = await this.client.keys(`${this.prefix}*`);
    return keys.length;
  }
}
