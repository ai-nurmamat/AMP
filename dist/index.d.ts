/**
 * AMP (Agent Memory Protocol) Core
 * 打破信息孤岛，赋予所有 AI Agent 永恒且全局的记忆中枢。
 *
 * 业界首创的多维记忆折叠架构，自主研发的跨生态、图向量双轨检索引擎。
 * 致力于成为 AI 记忆管理领域的最顶级形态。
 */
import { MemoryEvent, MemoryQuery, MemoryResult, MemoryRef, MemoryToolSchema, MemoryTier, MemoryScope, MemoryMetadata } from './types';
export { MemoryTier, MemoryScope, MemoryMetadata, MemoryEvent, MemoryQuery, MemoryResult, MemoryRef, MemoryToolSchema };
export interface AMPConfig {
    redisUrl?: string;
}
export declare class AMPCore {
    private provider;
    constructor(config?: AMPConfig);
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
     * 暴露符合 LLM Function Calling 标准的 Schema 接口
     * 赋予大模型原生的自我意识，使其能够以类操作系统分页的方式自主管理记忆生命周期
     */
    getMemoryTools(): MemoryToolSchema[];
}
export default AMPCore;
