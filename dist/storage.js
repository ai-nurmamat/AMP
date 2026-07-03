import { createClient } from 'redis';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
/**
 * 基于本地文件（JSON）的存储 Provider。
 *
 * 可选的端到端加密（Feature D）：当传入合法的 32 字节 encryptionKey 时，
 * 文件内容会以 AES-256-GCM 加密后再落盘，每次写入随机生成 IV，密文格式为
 * `base64(iv) : base64(authTag) : base64(ciphertext)`。
 * 未传入 encryptionKey 时，行为完全保持向后兼容（明文 JSON）。
 */
export class FileStorageProvider {
    storeMap = new Map();
    filePath;
    encryptionKey;
    constructor(options = {}) {
        if (typeof options === 'string') {
            this.filePath = options;
            this.encryptionKey = null;
        }
        else {
            this.filePath = options.filePath ?? path.join(process.cwd(), 'amp_memory.json');
            this.encryptionKey = options.encryptionKey ? this.deriveKey(options.encryptionKey) : null;
        }
        this.loadFromFile();
    }
    /**
     * 将用户传入的 hex 或 base64 字符串解析为 32 字节对称密钥。
     * 若长度不对则抛出异常，避免静默使用弱密钥。
     */
    deriveKey(encryptionKey) {
        let buf;
        if (/^[0-9a-fA-F]{64}$/.test(encryptionKey)) {
            buf = Buffer.from(encryptionKey, 'hex');
        }
        else {
            buf = Buffer.from(encryptionKey, 'base64');
        }
        if (buf.length !== 32) {
            throw new Error(`[AMP] encryptionKey must decode to 32 bytes (AES-256-GCM), got ${buf.length} bytes`);
        }
        return buf;
    }
    /**
     * Fix 11: 加载时进行最小形态校验。缺失必填字段的条目会被跳过并告警，
     * 避免后续读取时出现 undefined 访问导致 retrieve/store 崩溃。
     */
    loadFromFile() {
        if (!fs.existsSync(this.filePath))
            return;
        try {
            const data = fs.readFileSync(this.filePath, 'utf-8');
            const parsed = this.encryptionKey ? this.decrypt(data) : JSON.parse(data);
            if (typeof parsed !== 'object' || parsed === null)
                return;
            for (const [k, v] of Object.entries(parsed)) {
                if (v && typeof v === 'object' && 'id' in v && 'content' in v && 'tier' in v && 'metadata' in v) {
                    this.storeMap.set(k, v);
                }
                else {
                    console.warn(`[AMP] Skipping malformed memory entry: ${k}`);
                }
            }
        }
        catch (err) {
            console.error('[AMP] Failed to load memory from file:', err);
        }
    }
    saveToFile() {
        try {
            const obj = Object.fromEntries(this.storeMap);
            const json = JSON.stringify(obj, null, 2);
            const output = this.encryptionKey ? this.encrypt(json) : json;
            fs.writeFileSync(this.filePath, output, 'utf-8');
        }
        catch (err) {
            console.error('[AMP] Failed to save memory to file:', err);
        }
    }
    /**
     * AES-256-GCM 加密：返回 `iv:authTag:ciphertext`（均为 base64）。
     * 每次写入随机生成 12 字节 IV，authTag 由 GCM 模式自动产生。
     */
    encrypt(plaintext) {
        if (!this.encryptionKey)
            return plaintext;
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
        const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
        const authTag = cipher.getAuthTag();
        return `${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext.toString('base64')}`;
    }
    /**
     * AES-256-GCM 解密：解析 `iv:authTag:ciphertext` 并校验 authTag。
     * 若 authTag 校验失败会抛错（说明密钥错误或数据被篡改），由调用方捕获。
     */
    decrypt(stored) {
        if (!this.encryptionKey)
            return JSON.parse(stored);
        const parts = stored.split(':');
        if (parts.length !== 3) {
            throw new Error('[AMP] Encrypted file is malformed (expected iv:authTag:ciphertext)');
        }
        const iv = Buffer.from(parts[0], 'base64');
        const authTag = Buffer.from(parts[1], 'base64');
        const ciphertext = Buffer.from(parts[2], 'base64');
        const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
        decipher.setAuthTag(authTag);
        const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
        return JSON.parse(plain);
    }
    /**
     * Feature A: 艾宾浩斯遗忘曲线 / 动态重要性。
     * 重要性每 30 天减半，访问频次提供最多 +0.3 的增益，最终夹紧到 [0, 1]。
     */
    computeDecayedImportance(record, now) {
        const halfLifeDays = 30; // 重要性每 30 天衰减一半
        const lastAccess = record.metadata.lastAccessedAt ?? record.metadata.timestamp ?? now;
        const daysSinceAccess = Math.max(0, (now - lastAccess) / (1000 * 60 * 60 * 24));
        const accessBoost = Math.min(0.3, (record.metadata.accessCount ?? 0) * 0.05); // 增益上限 +0.3
        const decayed = record.metadata.importance * Math.pow(0.5, daysSinceAccess / halfLifeDays) + accessBoost;
        return Math.max(0, Math.min(1, decayed));
    }
    async store(event) {
        // Fix 5: 若显式提供了 id 且已存在，抛错而非静默覆盖。
        const id = event.id || crypto.randomUUID();
        if (event.id && this.storeMap.has(id)) {
            throw new Error(`Memory with id ${id} already exists; use update() to modify`);
        }
        const now = Date.now();
        const memoryRecord = {
            id,
            content: event.content,
            // score 仅为运行时检索量，不持久化；这里仅占位以匹配 MemoryResult 类型。
            score: 1.0,
            tier: event.tier,
            // Fix 4: 持久化 scope，使 retrieve 阶段能做作用域隔离过滤。
            scope: event.scope,
            metadata: {
                // Fix 1: 先展开用户传入的 metadata，再用服务端权威字段覆盖，
                // 防止客户端伪造 timestamp / lastAccessedAt 等审计字段。
                ...event.metadata,
                importance: event.metadata?.importance ?? 0.5,
                tags: event.metadata?.tags || [],
                timestamp: now,
                lastAccessedAt: now,
            },
        };
        this.storeMap.set(id, memoryRecord);
        this.saveToFile();
        return { id, tier: event.tier, created_at: now, updated_at: now };
    }
    async retrieve(query) {
        const results = [];
        // Fix 2: 用 dirty 标志仅在 lastAccessedAt 真正变化时才落盘，
        // 避免每次 retrieve 都触发一次完整的文件重写。
        let dirty = false;
        const now = Date.now();
        for (const [id, record] of this.storeMap.entries()) {
            if (query.tier && record.tier !== query.tier)
                continue;
            if (query.tags && !query.tags.every(t => record.metadata.tags.includes(t)))
                continue;
            // Fix 3: minImportance: 0 边界，使用 != null 以兼容 0 这个合法值。
            if (query.minImportance != null && record.metadata.importance < query.minImportance)
                continue;
            // Fix 4: 作用域隔离。仅对显式声明的维度做相等匹配；未声明的维度不限制。
            if (query.scope) {
                const memScope = record.scope ?? {};
                if (query.scope.userId !== undefined && memScope.userId !== query.scope.userId)
                    continue;
                if (query.scope.sessionId !== undefined && memScope.sessionId !== query.scope.sessionId)
                    continue;
                if (query.scope.agentId !== undefined && memScope.agentId !== query.scope.agentId)
                    continue;
            }
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
                // Feature A: 命中检索时使用动态衰减后的重要性参与排序，
                // 同时累计 accessCount 并更新 lastAccessedAt（仅在真正变化时才置脏）。
                record.metadata.accessCount = (record.metadata.accessCount ?? 0) + 1;
                const prevLastAccess = record.metadata.lastAccessedAt;
                record.metadata.lastAccessedAt = now;
                if (prevLastAccess !== now)
                    dirty = true;
                // 用衰减后的重要性作为排序依据。
                const decayedImportance = this.computeDecayedImportance(record, now);
                // Fix 2: 返回深拷贝（metadata 为全新对象），避免调用方修改污染存储层。
                // score 为运行时字段，不持久化（不写回 record.score）。
                results.push({
                    ...record,
                    metadata: { ...record.metadata },
                    score,
                    // 注入一个运行时 view，便于上层按衰减后的重要性排序时取用。
                    // 这里通过闭包 capture decayedImportance 用于排序。
                });
                // 使用 decayedImportance 进行排序——直接挂到结果对象上无法做到不影响类型，
                // 所以这里通过附加一个运行时非类型字段的方式，仅供 sort 使用。
                // 为保持类型纯净，转而使用闭包数组保存 (result, decayedImportance) 对。
                results[results.length - 1]._decayedImportance = decayedImportance;
            }
        }
        // 按 score 主排序、衰减后的重要性次排序。
        results.sort((a, b) => {
            if (b.score !== a.score)
                return b.score - a.score;
            const ai = a._decayedImportance ?? a.metadata.importance;
            const bi = b._decayedImportance ?? b.metadata.importance;
            return bi - ai;
        });
        // 清理运行时临时字段，避免泄漏到调用方。
        for (const r of results) {
            delete r._decayedImportance;
        }
        if (dirty)
            this.saveToFile();
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
        // updated_at 已在类型上显式声明，避免依赖动态字段。
        record.metadata.updated_at = now;
        this.storeMap.set(id, record);
        this.saveToFile();
        return { id, tier: record.tier, created_at: record.metadata.timestamp, updated_at: now };
    }
    async delete(id) {
        const deleted = this.storeMap.delete(id);
        if (deleted)
            this.saveToFile();
        return deleted;
    }
    async getSize() {
        return this.storeMap.size;
    }
}
export class RedisStorageProvider {
    client;
    prefix = 'amp:memory:';
    constructor(redisUrl) {
        this.client = createClient({
            url: redisUrl,
            socket: {
                // 限制初始 TCP 连接超时，避免连不上时无限挂起（Fix 6 降级路径需要快速失败）。
                connectTimeout: 5000,
                // 重连策略：最多重试 3 次（间隔 200ms），之后停止重连，
                // 让 connect() reject 从而触发 AMPCore 降级到 FileStorageProvider。
                reconnectStrategy(retries) {
                    if (retries > 3)
                        return false;
                    return Math.min(retries * 200, 1000);
                },
            },
        });
        this.client.on('error', (err) => console.error('[AMP Redis Error]', err));
    }
    /**
     * Fix 9: 真实的 ft.create 失败（非“索引已存在”）现在会让 connect() reject，
     * 以便 AMPCore 的降级逻辑触发，回退到 FileStorageProvider。
     */
    async connect() {
        await this.client.connect();
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
        }
        catch (e) {
            const msg = e?.message ?? '';
            if (msg.includes('Index already exists')) {
                // 索引已存在是正常情况，忽略即可。
                return;
            }
            // Fix 9: 真正的失败要抛错，让上层降级逻辑生效。
            console.warn('[AMP Redis Index Warning] Could not create index:', msg);
            throw new Error(`[AMP] Redis ft.create failed: ${msg}`);
        }
    }
    async disconnect() {
        await this.client.disconnect();
    }
    /**
     * Feature A: 艾宾浩斯遗忘曲线 / 动态重要性（与 FileStorageProvider 实现一致）。
     */
    computeDecayedImportance(record, now) {
        const halfLifeDays = 30;
        const lastAccess = record.metadata.lastAccessedAt ?? record.metadata.timestamp ?? now;
        const daysSinceAccess = Math.max(0, (now - lastAccess) / (1000 * 60 * 60 * 24));
        const accessBoost = Math.min(0.3, (record.metadata.accessCount ?? 0) * 0.05);
        const decayed = record.metadata.importance * Math.pow(0.5, daysSinceAccess / halfLifeDays) + accessBoost;
        return Math.max(0, Math.min(1, decayed));
    }
    async store(event) {
        const id = event.id || crypto.randomUUID();
        const key = `${this.prefix}${id}`;
        // Fix 5: 显式 id 冲突检测，避免静默覆盖既有记忆。
        if (event.id) {
            const exists = await this.client.json.get(key);
            if (exists) {
                throw new Error(`Memory with id ${id} already exists; use update() to modify`);
            }
        }
        const now = Date.now();
        const memoryRecord = {
            id,
            content: event.content,
            score: 1.0,
            tier: event.tier,
            // Fix 4: 持久化 scope，使 retrieve 阶段能做作用域隔离过滤。
            scope: event.scope,
            metadata: {
                // Fix 1: 先展开用户 metadata，再用服务端权威字段覆盖。
                ...event.metadata,
                importance: event.metadata?.importance ?? 0.5,
                tags: event.metadata?.tags || [],
                timestamp: now,
                lastAccessedAt: now,
            },
        };
        await this.client.json.set(key, '$', memoryRecord);
        return { id, tier: event.tier, created_at: now, updated_at: now };
    }
    async retrieve(query) {
        const filters = [];
        if (query.tier) {
            filters.push(`@tier:{${query.tier}}`);
        }
        if (query.tags && query.tags.length > 0) {
            const tagQuery = query.tags.map(t => `{${t.replace(/([\\.\-@_~"'])/g, '\\$1')}}`).join(' ');
            filters.push(`@tags:(${tagQuery})`);
        }
        // Fix 3: 同 FileStorageProvider，使用 != null 兼容 minImportance: 0。
        if (query.minImportance != null) {
            filters.push(`@importance:[${query.minImportance} +inf]`);
        }
        if (query.query) {
            const escapedQuery = query.query.replace(/([\\.\-@_~"'])/g, '\\$1');
            filters.push(`@content:${escapedQuery}`);
        }
        else {
            if (filters.length === 0) {
                filters.push('*');
            }
        }
        const ftQuery = filters.join(' ');
        try {
            const searchResult = await this.client.ft.search('idx:amp:memory', ftQuery, {
                LIMIT: { from: 0, size: query.limit || 10 },
                // Fix 7: RETURN 之前请求了不存在的 'score' 字段导致 RediSearch 报错。
                // score 是运行时计算量，未持久化；这里只取整个 JSON 文档即可。
                RETURN: ['$'],
            });
            const results = [];
            const now = Date.now();
            for (const doc of searchResult.documents) {
                let record;
                // Fix 7: 删除针对不存在的 score 字段的死代码分支，
                // 仅保留“解析整个 JSON 文档”这一条真实路径。
                if (doc.value && typeof doc.value === 'object' && doc.value.$) {
                    record = JSON.parse(doc.value.$);
                }
                else if (doc.value && typeof doc.value === 'object') {
                    record = doc.value;
                }
                else {
                    continue;
                }
                // Fix 4: 作用域隔离，逻辑与 FileStorageProvider 完全一致。
                if (query.scope) {
                    const memScope = record.scope ?? {};
                    if (query.scope.userId !== undefined && memScope.userId !== query.scope.userId)
                        continue;
                    if (query.scope.sessionId !== undefined && memScope.sessionId !== query.scope.sessionId)
                        continue;
                    if (query.scope.agentId !== undefined && memScope.agentId !== query.scope.agentId)
                        continue;
                }
                // score 为运行时计算量；通过文本匹配近似估算相关性。
                let score = 1.0;
                if (query.query) {
                    const words = query.query.split(' ').filter(w => w.trim().length > 0);
                    if (words.length > 0) {
                        const matchCount = words.filter(w => record.content.includes(w)).length;
                        score = matchCount / words.length;
                    }
                }
                if (score > 0) {
                    // Feature A: accessCount 累计 + 衰减后重要性参与排序。
                    record.metadata.accessCount = (record.metadata.accessCount ?? 0) + 1;
                    record.metadata.lastAccessedAt = now;
                    // 异步更新访问时间与计数（不阻塞返回）。
                    this.client.json
                        .set(doc.id, '$.metadata.lastAccessedAt', record.metadata.lastAccessedAt)
                        .catch(() => { });
                    this.client.json
                        .set(doc.id, '$.metadata.accessCount', record.metadata.accessCount)
                        .catch(() => { });
                    const decayedImportance = this.computeDecayedImportance(record, now);
                    // Fix 2: 返回深拷贝，避免调用方修改污染 Redis 缓存中的对象。
                    const result = {
                        ...record,
                        metadata: { ...record.metadata },
                        score,
                    };
                    result._decayedImportance = decayedImportance;
                    results.push(result);
                }
            }
            results.sort((a, b) => {
                if (b.score !== a.score)
                    return b.score - a.score;
                const ai = a._decayedImportance ?? a.metadata.importance;
                const bi = b._decayedImportance ?? b.metadata.importance;
                return bi - ai;
            });
            // 清理运行时临时字段。
            for (const r of results) {
                delete r._decayedImportance;
            }
            return results;
        }
        catch (e) {
            console.error('[AMP Redis Search Error]', e.message);
            return [];
        }
    }
    async update(id, updates) {
        const key = `${this.prefix}${id}`;
        const data = await this.client.json.get(key);
        if (!data)
            return null;
        const record = data;
        if (updates.content)
            record.content = updates.content;
        if (updates.tier)
            record.tier = updates.tier;
        if (updates.metadata) {
            record.metadata = { ...record.metadata, ...updates.metadata };
        }
        const now = Date.now();
        // updated_at 已显式声明在类型中。
        record.metadata.updated_at = now;
        await this.client.json.set(key, '$', record);
        return { id, tier: record.tier, created_at: record.metadata.timestamp, updated_at: now };
    }
    async delete(id) {
        const deleted = await this.client.json.del(`${this.prefix}${id}`);
        return deleted > 0;
    }
    /**
     * Fix 8: 用 SCAN 循环替换 KEYS，避免在大规模 key 空间下阻塞 Redis。
     * redis v5: client.scan(cursor, {MATCH, COUNT}) -> {cursor, keys}
     */
    async getSize() {
        let count = 0;
        let cursor = '0';
        do {
            const reply = await this.client.scan(cursor, { MATCH: `${this.prefix}*`, COUNT: 1000 });
            cursor = reply.cursor;
            count += reply.keys.length;
        } while (cursor !== '0');
        return count;
    }
}
