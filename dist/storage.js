"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisStorageProvider = exports.MemoryStorageProvider = void 0;
const redis_1 = require("redis");
class MemoryStorageProvider {
    storeMap = new Map();
    async store(event) {
        const id = event.id || crypto.randomUUID();
        const now = Date.now();
        const memoryRecord = {
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
    async retrieve(query) {
        const results = [];
        for (const [id, record] of this.storeMap.entries()) {
            if (query.tier && record.tier !== query.tier)
                continue;
            if (query.tags && !query.tags.every(t => record.metadata.tags.includes(t)))
                continue;
            if (query.minImportance && record.metadata.importance < query.minImportance)
                continue;
            let score = 0;
            if (record.content.includes(query.query)) {
                score = 1.0;
            }
            else {
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
            if (b.score !== a.score)
                return b.score - a.score;
            return b.metadata.importance - a.metadata.importance;
        });
        return results.slice(0, query.limit || 10);
    }
    async update(id, updates) {
        const record = this.storeMap.get(id);
        if (!record)
            return null;
        if (updates.content)
            record.content = updates.content;
        if (updates.tier)
            record.tier = updates.tier;
        if (updates.metadata) {
            record.metadata = { ...record.metadata, ...updates.metadata };
        }
        const now = Date.now();
        record.metadata.updated_at = now;
        this.storeMap.set(id, record);
        return { id, tier: record.tier, created_at: record.metadata.timestamp, updated_at: now };
    }
    async delete(id) {
        return this.storeMap.delete(id);
    }
    async getSize() {
        return this.storeMap.size;
    }
}
exports.MemoryStorageProvider = MemoryStorageProvider;
class RedisStorageProvider {
    client;
    prefix = 'amp:memory:';
    constructor(redisUrl) {
        this.client = (0, redis_1.createClient)({ url: redisUrl });
        this.client.on('error', (err) => console.error('[AMP Redis Error]', err));
    }
    async connect() {
        await this.client.connect();
        // 颠覆性创新：在真实生产环境中，此处应自动创建 RediSearch 索引 (FT.CREATE)
        // 这里为保证代码即插即用和简洁性，先用 JSON 结构模拟高维检索。
    }
    async disconnect() {
        await this.client.disconnect();
    }
    async store(event) {
        const id = event.id || crypto.randomUUID();
        const now = Date.now();
        const memoryRecord = {
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
    async retrieve(query) {
        const keys = await this.client.keys(`${this.prefix}*`);
        const results = [];
        for (const key of keys) {
            const data = await this.client.get(key);
            if (!data)
                continue;
            const record = JSON.parse(data);
            if (query.tier && record.tier !== query.tier)
                continue;
            if (query.tags && !query.tags.every(t => record.metadata.tags.includes(t)))
                continue;
            if (query.minImportance && record.metadata.importance < query.minImportance)
                continue;
            let score = 0;
            if (record.content.includes(query.query)) {
                score = 1.0;
            }
            else {
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
            if (b.score !== a.score)
                return b.score - a.score;
            return b.metadata.importance - a.metadata.importance;
        });
        return results.slice(0, query.limit || 10);
    }
    async update(id, updates) {
        const key = `${this.prefix}${id}`;
        const data = await this.client.get(key);
        if (!data)
            return null;
        const record = JSON.parse(data);
        if (updates.content)
            record.content = updates.content;
        if (updates.tier)
            record.tier = updates.tier;
        if (updates.metadata) {
            record.metadata = { ...record.metadata, ...updates.metadata };
        }
        const now = Date.now();
        record.metadata.updated_at = now;
        await this.client.set(key, JSON.stringify(record));
        return { id, tier: record.tier, created_at: record.metadata.timestamp, updated_at: now };
    }
    async delete(id) {
        const deleted = await this.client.del(`${this.prefix}${id}`);
        return deleted > 0;
    }
    async getSize() {
        const keys = await this.client.keys(`${this.prefix}*`);
        return keys.length;
    }
}
exports.RedisStorageProvider = RedisStorageProvider;
