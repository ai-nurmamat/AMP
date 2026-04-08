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
     * 存储记忆
     */
    store(event: MemoryEvent): Promise<MemoryRef>;
    /**
     * 检索记忆
     */
    retrieve(query: MemoryQuery): Promise<MemoryResult[]>;
    /**
     * 更新记忆
     */
    update(id: string, updates: Partial<MemoryEvent>): Promise<MemoryRef | null>;
    /**
     * 删除记忆
     */
    delete(id: string): Promise<boolean>;
    /**
     * 获取核心记忆存储量
     */
    getSize(): Promise<number>;
    /**
     * 生成供 LLM Function Calling 的 Schema
     * 赋予大模型原生的自我意识，让其能够自主管理记忆生命周期
     */
    getMemoryTools(): MemoryToolSchema[];
}
export default AMPCore;
