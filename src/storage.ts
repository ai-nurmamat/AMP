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

import * as fs from 'fs';
import * as path from 'path';

export class FileStorageProvider implements IStorageProvider {
  private storeMap: Map<string, MemoryResult> = new Map();
  private filePath: string;

  constructor(filePath: string = path.join(process.cwd(), 'amp_memory.json')) {
    this.filePath = filePath;
    this.loadFromFile();
  }

  private loadFromFile() {
    if (fs.existsSync(this.filePath)) {
      try {
        const data = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(data);
        for (const [k, v] of Object.entries(parsed)) {
          this.storeMap.set(k, v as MemoryResult);
        }
      } catch (err) {
        console.error('[AMP] Failed to load memory from file:', err);
      }
    }
  }

  private saveToFile() {
    try {
      const obj = Object.fromEntries(this.storeMap);
      fs.writeFileSync(this.filePath, JSON.stringify(obj, null, 2), 'utf-8');
    } catch (err) {
      console.error('[AMP] Failed to save memory to file:', err);
    }
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
    this.storeMap.set(id, memoryRecord);
    this.saveToFile();
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

    this.saveToFile();
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
    this.saveToFile();
    return { id, tier: record.tier, created_at: record.metadata.timestamp, updated_at: now };
  }

  async delete(id: string): Promise<boolean> {
    const deleted = this.storeMap.delete(id);
    if (deleted) this.saveToFile();
    return deleted;
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
    
    // 颠覆性创新：在真实生产环境中，此处自动创建 RediSearch 索引 (FT.CREATE)
    try {
      await this.client.ft.create('idx:amp:memory', {
        '$.content': {
          type: 'TEXT',
          AS: 'content',
          WEIGHT: 5.0
        },
        '$.tier': {
          type: 'TAG',
          AS: 'tier'
        },
        '$.metadata.importance': {
          type: 'NUMERIC',
          AS: 'importance'
        },
        '$.metadata.tags[*]': {
          type: 'TAG',
          AS: 'tags'
        }
      }, {
        ON: 'JSON',
        PREFIX: this.prefix
      });
    } catch (e: any) {
      if (e.message && !e.message.includes('Index already exists')) {
        console.warn('[AMP Redis Index Warning] Could not create index:', e.message);
      }
    }
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
    
    // 使用 JSON.SET 保存记录
    await this.client.json.set(`${this.prefix}${id}`, '$', memoryRecord as any);
    return { id, tier: event.tier, created_at: now, updated_at: now };
  }

  async retrieve(query: MemoryQuery): Promise<MemoryResult[]> {
    const filters: string[] = [];

    if (query.tier) {
      filters.push(`@tier:{${query.tier}}`);
    }
    
    if (query.tags && query.tags.length > 0) {
      // 匹配所有指定的 tags (使用交集，即每个 tag 都必须存在)
      const tagQuery = query.tags.map(t => `{${t.replace(/([\\.\-@_~"'])/g, '\\$1')}}`).join(' ');
      filters.push(`@tags:(${tagQuery})`);
    }
    
    if (query.minImportance !== undefined) {
      filters.push(`@importance:[${query.minImportance} +inf]`);
    }

    if (query.query) {
      // 对文本搜索进行转义
      const escapedQuery = query.query.replace(/([\\.\-@_~"'])/g, '\\$1');
      filters.push(`@content:${escapedQuery}`);
    } else {
      // 如果没有具体的文本搜索，并且也没有其他过滤器，则匹配全部
      if (filters.length === 0) {
        filters.push('*');
      }
    }

    const ftQuery = filters.join(' ');

    try {
      const searchResult = await this.client.ft.search('idx:amp:memory', ftQuery, {
        LIMIT: { from: 0, size: query.limit || 10 },
        RETURN: ['$', 'score']
      });

      const results: MemoryResult[] = [];
      
      for (const doc of searchResult.documents) {
        // RediSearch 返回的 JSON 包含在 '$' 字段中，如果是 Node redis 客户端通常在 doc.value 中直接解析
        // 注意不同版本的 redis 库返回值格式可能不同，这里处理常见的 JSON 返回格式
        let record: MemoryResult;
        
        if (doc.value && typeof doc.value === 'object' && doc.value.$) {
          record = JSON.parse(doc.value.$ as string) as MemoryResult;
        } else if (doc.value && typeof doc.value === 'object') {
          // Node Redis 最新版本直接将 JSON 存在 doc.value 里或其子属性
          record = (doc.value as any) as MemoryResult;
          // 有些版本 JSON 的根就是整个对象，而有些版本根被提取出来了
          if (record && (record as any).$) {
             try {
                 record = JSON.parse((record as any).$) as MemoryResult;
             } catch {
                 record = (doc.value as any) as MemoryResult;
             }
          }
        } else {
          continue; // 无法解析则跳过
        }

        // 处理 score：如果没有明确的 score，默认为 1.0
        let score = 1.0;
        if (query.query) {
          // 如果有全文搜索，通常可以通过 TF-IDF 或者后续计算出相关性
          // 我们这里做一个简单的模拟，如果文本中包含 query 的词
          const words = query.query.split(' ').filter(w => w.trim().length > 0);
          if (words.length > 0) {
              const matchCount = words.filter(w => record.content.includes(w)).length;
              score = matchCount / words.length;
          }
        }

        if (score > 0) {
          record.metadata.lastAccessedAt = Date.now();
          // 异步更新访问时间
          this.client.json.set(doc.id, '$.metadata.lastAccessedAt', record.metadata.lastAccessedAt).catch(() => {});
          results.push({ ...record, score });
        }
      }

      // 按照 score 和 importance 排序
      results.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.metadata.importance - a.metadata.importance;
      });

      return results;
    } catch (e: any) {
      console.error('[AMP Redis Search Error]', e.message);
      return [];
    }
  }

  async update(id: string, updates: Partial<MemoryEvent>): Promise<MemoryRef | null> {
    const key = `${this.prefix}${id}`;
    const data = await this.client.json.get(key);
    if (!data) return null;

    const record = data as unknown as MemoryResult;
    if (updates.content) record.content = updates.content;
    if (updates.tier) record.tier = updates.tier;
    if (updates.metadata) {
      record.metadata = { ...record.metadata, ...updates.metadata };
    }
    const now = Date.now();
    record.metadata.updated_at = now;
    
    await this.client.json.set(key, '$', record as any);
    return { id, tier: record.tier, created_at: record.metadata.timestamp, updated_at: now };
  }

  async delete(id: string): Promise<boolean> {
    const deleted = await this.client.json.del(`${this.prefix}${id}`);
    return deleted > 0;
  }

  async getSize(): Promise<number> {
    const keys = await this.client.keys(`${this.prefix}*`);
    return keys.length;
  }
}
