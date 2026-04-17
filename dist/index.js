"use strict";
/**
 * AMP (Agent Memory Protocol) Core
 * 打破信息孤岛，赋予所有 AI Agent 永恒且全局的记忆中枢。
 *
 * 业界首创的多维记忆折叠架构，自主研发的跨生态、图向量双轨检索引擎。
 * 致力于成为 AI 记忆管理领域的最顶级形态。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AMPCore = exports.MemoryTier = void 0;
const storage_1 = require("./storage");
const types_1 = require("./types");
Object.defineProperty(exports, "MemoryTier", { enumerable: true, get: function () { return types_1.MemoryTier; } });
class AMPCore {
    provider;
    constructor(config) {
        if (config?.redisUrl) {
            this.provider = new storage_1.RedisStorageProvider(config.redisUrl);
            // 触发异步连接并实现优雅降级
            if (this.provider.connect) {
                this.provider.connect().catch(err => {
                    console.error('[AMP] 工业级存储引擎连接失败，正在平滑降级至文件持久化索引模式 (FileStorageProvider)', err);
                    this.provider = new storage_1.FileStorageProvider();
                });
            }
        }
        else {
            this.provider = new storage_1.FileStorageProvider();
        }
    }
    /**
     * 存储结构化记忆事件
     * 支持通过 Tier (层级) 和 Scope (作用域) 进行细粒度隔离
     */
    async store(event) {
        return this.provider.store(event);
    }
    /**
     * 基于查询条件检索相关记忆
     * 内部集成了基于阈值、标签和重要性的复合打分机制
     */
    async retrieve(query) {
        return this.provider.retrieve(query);
    }
    /**
     * 更新已有记忆的核心内容或元数据属性
     */
    async update(id, updates) {
        return this.provider.update(id, updates);
    }
    /**
     * 物理删除指定的记忆节点
     */
    async delete(id) {
        return this.provider.delete(id);
    }
    /**
     * 获取当前底层存储引擎的记忆节点总数
     */
    async getSize() {
        return this.provider.getSize();
    }
    /**
     * 暴露符合 LLM Function Calling 标准的 Schema 接口
     * 赋予大模型原生的自我意识，使其能够以类操作系统分页的方式自主管理记忆生命周期
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
