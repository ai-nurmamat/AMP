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
  redisUrl?: string; // 如果提供，自动启用工业级持久化；否则回退到高级内存索引模式
}

export class AMPCore {
  private provider: IStorageProvider;

  constructor(config?: AMPConfig) {
    if (config?.redisUrl) {
      this.provider = new RedisStorageProvider(config.redisUrl);
      // 触发异步连接
      if (this.provider.connect) {
        this.provider.connect().catch(err => {
          console.error('[AMP] Redis connection failed, falling back to MemoryStorageProvider', err);
          this.provider = new MemoryStorageProvider();
        });
      }
    } else {
      this.provider = new MemoryStorageProvider();
    }
  }

  /**
   * 存储记忆
   */
  async store(event: MemoryEvent): Promise<MemoryRef> {
    return this.provider.store(event);
  }

  /**
   * 检索记忆
   */
  async retrieve(query: MemoryQuery): Promise<MemoryResult[]> {
    return this.provider.retrieve(query);
  }

  /**
   * 更新记忆
   */
  async update(id: string, updates: Partial<MemoryEvent>): Promise<MemoryRef | null> {
    return this.provider.update(id, updates);
  }

  /**
   * 删除记忆
   */
  async delete(id: string): Promise<boolean> {
    return this.provider.delete(id);
  }

  /**
   * 获取核心记忆存储量
   */
  async getSize(): Promise<number> {
    return this.provider.getSize();
  }

  /**
   * 生成供 LLM Function Calling 的 Schema
   * 赋予大模型原生的自我意识，让其能够自主管理记忆生命周期
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
