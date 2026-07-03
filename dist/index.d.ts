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
export { MemoryTier };
export type { MemoryScope, MemoryMetadata, MemoryEvent, MemoryQuery, MemoryResult, MemoryRef, MemoryToolSchema };
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
export declare class AMPCore {
    private provider;
    private initPromise;
    private auditLogger;
    private config;
    constructor(config?: AMPConfig);
    /**
     * Fix 6: 异步初始化逻辑（从构造器抽离出来）。
     * 仅 Redis provider 路径会真正连接；连接失败会抛错，
     * 由构造器里的 .catch() 兜底并降级到 FileStorageProvider。
     */
    private initialize;
    /**
     * Fix 6: 公开的就绪屏障。
     * - 若 initPromise 存在（Redis 路径），await 直到连接完成或降级完成。
     * - 若为 null（FileStorageProvider 路径），立即返回。
     */
    ensureReady(): Promise<void>;
    /**
     * 存储结构化记忆事件
     * 支持通过 Tier (层级) 和 Scope (作用域) 进行细粒度隔离
     */
    store(event: MemoryEvent): Promise<MemoryRef>;
    /**
     * 基于查询条件检索相关记忆
     * 内部集成了基于阈值、标签和重要性的复合打分机制
     */
    retrieve(query: MemoryQuery): Promise<MemoryResult[]>;
    /**
     * 更新已有记忆的核心内容或元数据属性
     */
    update(id: string, updates: Partial<MemoryEvent>): Promise<MemoryRef | null>;
    /**
     * 物理删除指定的记忆节点
     */
    delete(id: string): Promise<boolean>;
    /**
     * 获取当前底层存储引擎的记忆节点总数
     */
    getSize(): Promise<number>;
    /**
     * Fix 10: 显式释放底层连接（如 Redis client）。
     * 适合 MCP server / 长进程在关闭前清理资源。provider 未实现 disconnect 时安全 no-op。
     */
    dispose(): Promise<void>;
    /**
     * 暴露符合 LLM Function Calling 标准的 Schema 接口
     * 赋予大模型原生的自我意识，使其能够以类操作系统分页的方式自主管理记忆生命周期
     */
    getMemoryTools(): MemoryToolSchema[];
}
export default AMPCore;
