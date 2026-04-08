/**
 * AMP (Agent Memory Protocol) Core
 * 打破信息孤岛，赋予所有 AI Agent 永恒且全局的记忆中枢。
 * 
 * 业界首创的多维记忆折叠架构，自主研发的跨生态、图向量双轨检索引擎。
 * 致力于成为 AI 记忆管理领域的最顶级形态。
 */

import { IStorageProvider, MemoryStorageProvider, RedisStorageProvider } from './storage';
import { MemoryEvent, MemoryQuery, MemoryResult, MemoryRef, MemoryToolSchema, MemoryTier, MemoryScope, MemoryMetadata } from './types';

export { MemoryTier, MemoryScope, MemoryMetadata, MemoryEvent, MemoryQuery, MemoryResult, MemoryRef, MemoryToolSchema };

export interface AMPConfig {
  redisUrl?: string; // 若提供有效的 Redis URL，系统将自动激活工业级持久化引擎；否则将平滑回退至高级内存索引模式
}

export class AMPCore {
  private provider: IStorageProvider;

  constructor(config?: AMPConfig) {
    if (config?.redisUrl) {
      this.provider = new RedisStorageProvider(config.redisUrl);
      // 触发异步连接并实现优雅降级
      if (this.provider.connect) {
        this.provider.connect().catch(err => {
          console.error('[AMP] 工业级存储引擎连接失败，正在平滑降级至内存索引模式 (MemoryStorageProvider)', err);
          this.provider = new MemoryStorageProvider();
        });
      }
    } else {
      this.provider = new MemoryStorageProvider();
    }
  }

  /**
   * 存储结构化记忆事件
   * 支持通过 Tier (层级) 和 Scope (作用域) 进行细粒度隔离
   */
  async store(event: MemoryEvent): Promise<MemoryRef> {
    return this.provider.store(event);
  }

  /**
   * 基于查询条件检索相关记忆
   * 内部集成了基于阈值、标签和重要性的复合打分机制
   */
  async retrieve(query: MemoryQuery): Promise<MemoryResult[]> {
    return this.provider.retrieve(query);
  }

  /**
   * 更新已有记忆的核心内容或元数据属性
   */
  async update(id: string, updates: Partial<MemoryEvent>): Promise<MemoryRef | null> {
    return this.provider.update(id, updates);
  }

  /**
   * 物理删除指定的记忆节点
   */
  async delete(id: string): Promise<boolean> {
    return this.provider.delete(id);
  }

  /**
   * 获取当前底层存储引擎的记忆节点总数
   */
  async getSize(): Promise<number> {
    return this.provider.getSize();
  }

  /**
   * 暴露符合 LLM Function Calling 标准的 Schema 接口
   * 赋予大模型原生的自我意识，使其能够以类操作系统分页的方式自主管理记忆生命周期
   */
  getMemoryTools(): MemoryToolSchema[] {
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

export default AMPCore;
