/**
 * AMP (Agent Memory Protocol) Core
 * 打破信息孤岛，赋予所有 AI Agent 永恒且全局的记忆中枢。
 *
 * 业界首创的多维记忆折叠架构，自主研发的跨生态、图向量双轨检索引擎。
 * 致力于成为 AI 记忆管理领域的最顶级形态。
 */

import { IStorageProvider, FileStorageProvider, RedisStorageProvider } from './storage.js';
import { SQLiteStorageProvider } from './sqlite-storage.js';
import { MemoryTier, MemoryScope, MemoryMetadata, MemoryEvent, MemoryQuery, MemoryResult, MemoryRef, MemoryToolSchema } from './types.js';
import { AuditLogger } from './audit.js';

export { MemoryTier };
export type { MemoryScope, MemoryMetadata, MemoryEvent, MemoryQuery, MemoryResult, MemoryRef, MemoryToolSchema };
// Fix 6 / 注入支持：导出 provider 接口与实现，便于用户接入自定义存储。
export { FileStorageProvider, RedisStorageProvider, SQLiteStorageProvider };
export type { IStorageProvider, FileStorageProviderOptions } from './storage.js';
export type { SQLiteStorageProviderOptions } from './sqlite-storage.js';
export { AuditLogger } from './audit.js';
export type { AuditEntry } from './audit.js';

export interface AMPConfig {
  /** 若提供有效的 Redis URL，系统将自动激活工业级持久化引擎；否则将平滑回退至高级内存索引模式 */
  redisUrl?: string;
  /** 文件存储路径（仅在使用 FileStorageProvider 时生效）。便于测试注入临时文件路径。 */
  storagePath?: string;
  /** 本地静态文件的 at-rest 加密密钥（AES-256-GCM，32-byte hex 或 base64）。 */
  encryptionKey?: string;
  /** 可选的审计日志文件路径；提供后将按行追加 JSON 审计条目。 */
  auditLogPath?: string;
  /**
   * 直接注入自定义存储后端（如 SQLiteStorageProvider）。
   * 提供后将忽略 redisUrl / storagePath / encryptionKey。
   * 这是为了满足"插件化存储"的核心定位：用户可接入任何符合 IStorageProvider 接口的后端。
   */
  provider?: IStorageProvider;
}

export class AMPCore {
  private provider: IStorageProvider;
  // Fix 6: 异步连接的“就绪 promise”。store/retrieve 等操作必须先 await 它，
  // 才能保证 Redis provider 已真正连上（或在失败时已降级到 FileStorageProvider）。
  private initPromise: Promise<void> | null = null;
  // Feature C: 审计日志器。仅当配置了 auditLogPath 时启用，否则所有 log() 调用都为空操作。
  private auditLogger: AuditLogger;
  // 缓存配置以便在降级到 FileStorageProvider 时复用 storagePath / encryptionKey。
  private config: AMPConfig | undefined;

  constructor(config?: AMPConfig) {
    this.config = config;
    this.auditLogger = new AuditLogger(config?.auditLogPath ?? null);

    // 优先使用注入的自定义 provider（如 SQLiteStorageProvider）。
    if (config?.provider) {
      this.provider = config.provider;
      this.initPromise = config.provider.connect ? config.provider.connect().catch((err) => {
        console.error('[AMP] Custom provider connect failed:', err);
        throw err;
      }) : null;
      return;
    }

    if (config?.redisUrl) {
      this.provider = new RedisStorageProvider(config.redisUrl);
      // Fix 6: 不再 fire-and-forget；将连接逻辑封装进 initialize()，
      // 由 ensureReady() 在每次操作前 await，确保“用前必连”。
      // 失败时降级到 FileStorageProvider 并 resolve promise（而非 reject），
      // 这样后续操作才能落到可用的 FileStorageProvider 上继续工作。
      this.initPromise = this.initialize().catch((err) => {
        console.error('[AMP] 工业级存储引擎连接失败，正在平滑降级至文件持久化索引模式 (FileStorageProvider)', err);
        this.provider = new FileStorageProvider({
          filePath: this.config?.storagePath,
          encryptionKey: this.config?.encryptionKey,
        });
      });
    } else {
      this.provider = new FileStorageProvider({
        filePath: config?.storagePath,
        encryptionKey: config?.encryptionKey,
      });
      this.initPromise = null;
    }
  }

  /**
   * Fix 6: 异步初始化逻辑（从构造器抽离出来）。
   * 仅 Redis provider 路径会真正连接；连接失败会抛错，
   * 由构造器里的 .catch() 兜底并降级到 FileStorageProvider。
   */
  private async initialize(): Promise<void> {
    if (this.provider.connect) {
      await this.provider.connect();
    }
  }

  /**
   * Fix 6: 公开的就绪屏障。
   * - 若 initPromise 存在（Redis 路径），await 直到连接完成或降级完成。
   * - 若为 null（FileStorageProvider 路径），立即返回。
   */
  async ensureReady(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  /**
   * 存储结构化记忆事件
   * 支持通过 Tier (层级) 和 Scope (作用域) 进行细粒度隔离
   */
  async store(event: MemoryEvent): Promise<MemoryRef> {
    await this.ensureReady();
    const ref = await this.provider.store(event);
    // Feature C: 在 AMPCore 层记录审计日志（provider 内部不感知审计，保持职责单一）。
    this.auditLogger.log({
      timestamp: Date.now(),
      action: 'store',
      memoryId: ref.id,
      userId: event.scope?.userId,
      agentId: event.scope?.agentId,
      details: `tier=${event.tier}`,
    });
    return ref;
  }

  /**
   * 基于查询条件检索相关记忆
   * 内部集成了基于阈值、标签和重要性的复合打分机制
   */
  async retrieve(query: MemoryQuery): Promise<MemoryResult[]> {
    await this.ensureReady();
    const results = await this.provider.retrieve(query);
    this.auditLogger.log({
      timestamp: Date.now(),
      action: 'retrieve',
      userId: query.scope?.userId,
      agentId: query.scope?.agentId,
      details: `query="${query.query}" hits=${results.length}`,
    });
    return results;
  }

  /**
   * 更新已有记忆的核心内容或元数据属性
   */
  async update(id: string, updates: Partial<MemoryEvent>): Promise<MemoryRef | null> {
    await this.ensureReady();
    const ref = await this.provider.update(id, updates);
    this.auditLogger.log({
      timestamp: Date.now(),
      action: 'update',
      memoryId: id,
      details: ref ? 'updated' : 'not-found',
    });
    return ref;
  }

  /**
   * 物理删除指定的记忆节点
   */
  async delete(id: string): Promise<boolean> {
    await this.ensureReady();
    const deleted = await this.provider.delete(id);
    this.auditLogger.log({
      timestamp: Date.now(),
      action: 'delete',
      memoryId: id,
      details: deleted ? 'deleted' : 'not-found',
    });
    return deleted;
  }

  /**
   * 获取当前底层存储引擎的记忆节点总数
   */
  async getSize(): Promise<number> {
    await this.ensureReady();
    return this.provider.getSize();
  }

  /**
   * Fix 10: 显式释放底层连接（如 Redis client）。
   * 适合 MCP server / 长进程在关闭前清理资源。provider 未实现 disconnect 时安全 no-op。
   */
  async dispose(): Promise<void> {
    try {
      await this.provider.disconnect?.();
    } catch (err) {
      console.error('[AMP] Error during dispose:', err);
    }
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
