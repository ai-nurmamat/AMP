"use strict";
/**
 * AMP (Agent Memory Protocol) Core
 * 让每一个 AI Agent 都能拥有记忆
 *
 * 融合 Mem0 (多层级作用域)、MemGPT (分层存储) 和 Zep (图结构与语义) 等业界最佳实践，
 * 致力于打造一套标准化的 AI Agent 记忆协议。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AMPCore = exports.MemoryTier = void 0;
// 2. 记忆层级 (Tier) - 借鉴 MemGPT / Letta
var MemoryTier;
(function (MemoryTier) {
    MemoryTier["WORKING"] = "working";
    MemoryTier["LONG_TERM"] = "long_term";
    MemoryTier["GRAPH"] = "graph"; // 图记忆 (实体关系、复杂多跳推理)
})(MemoryTier || (exports.MemoryTier = MemoryTier = {}));
class AMPCore {
    // 模拟持久化存储 (实际应对接 VectorDB 或 GraphDB)
    storeMap = new Map();
    /**
     * 存储记忆
     */
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
        // 可以在这里扩展向 Vector DB 或 Graph DB 的写入逻辑
        this.storeMap.set(id, memoryRecord);
        return {
            id,
            tier: event.tier,
            created_at: now,
            updated_at: now,
        };
    }
    /**
     * 检索记忆
     */
    async retrieve(query) {
        const results = [];
        for (const [id, record] of this.storeMap.entries()) {
            // 1. 层级和作用域过滤
            if (query.tier && record.tier !== query.tier)
                continue;
            // 2. 标签和重要性过滤
            if (query.tags && !query.tags.every(t => record.metadata.tags.includes(t)))
                continue;
            if (query.minImportance && record.metadata.importance < query.minImportance)
                continue;
            // 3. 内容相似度模拟 (实际应用中应替换为 Embedding 向量检索)
            // 此处使用简单的子串包含和关键词匹配计算得分
            let score = 0;
            if (record.content.includes(query.query)) {
                score = 1.0;
            }
            else {
                // 简单计算重合词
                const words = query.query.split(' ').filter(w => w.trim().length > 0);
                if (words.length > 0) {
                    const matchCount = words.filter(w => record.content.includes(w)).length;
                    score = matchCount / words.length;
                }
            }
            if (score > 0) {
                record.metadata.lastAccessedAt = Date.now(); // 更新访问时间
                results.push({ ...record, score });
            }
        }
        // 按得分降序，同分按重要性降序
        results.sort((a, b) => {
            if (b.score !== a.score)
                return b.score - a.score;
            return b.metadata.importance - a.metadata.importance;
        });
        return results.slice(0, query.limit || 10);
    }
    /**
     * 更新记忆
     */
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
        return {
            id,
            tier: record.tier,
            created_at: record.metadata.timestamp,
            updated_at: now,
        };
    }
    /**
     * 删除记忆
     */
    async delete(id) {
        return this.storeMap.delete(id);
    }
    /**
     * 获取核心记忆存储量
     */
    get size() {
        return this.storeMap.size;
    }
    /**
     * 生成供 LLM Function Calling 的 Schema
     * 这是受 MemGPT 启发，赋予 LLM 自主管理记忆的能力
     */
    getMemoryTools() {
        return [
            {
                name: "amp_store_memory",
                description: "Store a new memory about the user, session, or factual knowledge.",
                parameters: {
                    type: "object",
                    properties: {
                        content: { type: "string", description: "The core content of the memory to store." },
                        tier: { type: "string", enum: ["working", "long_term", "graph"], description: "The tier to store this memory in." },
                        importance: { type: "number", description: "Importance score from 0.0 to 1.0" },
                        tags: { type: "array", items: { type: "string" }, description: "Tags for categorization" }
                    },
                    required: ["content", "tier"]
                }
            },
            {
                name: "amp_retrieve_memory",
                description: "Search for relevant past memories based on a query string.",
                parameters: {
                    type: "object",
                    properties: {
                        query: { type: "string", description: "The search query" },
                        limit: { type: "number", description: "Maximum number of results to return" }
                    },
                    required: ["query"]
                }
            }
        ];
    }
}
exports.AMPCore = AMPCore;
exports.default = AMPCore;
