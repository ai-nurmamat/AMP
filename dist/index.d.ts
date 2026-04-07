/**
 * AMP (Agent Memory Protocol) Core
 * 让每一个 AI Agent 都能拥有记忆
 *
 * 融合 Mem0 (多层级作用域)、MemGPT (分层存储) 和 Zep (图结构与语义) 等业界最佳实践，
 * 致力于打造一套标准化的 AI Agent 记忆协议。
 */
export interface MemoryScope {
    userId?: string;
    sessionId?: string;
    agentId?: string;
}
export declare enum MemoryTier {
    WORKING = "working",// 工作记忆 (短期、频繁读写、类似 RAM)
    LONG_TERM = "long_term",// 长期记忆 (持久化、向量/语义检索、类似 Disk)
    GRAPH = "graph"
}
export interface MemoryMetadata {
    importance: number;
    tags: string[];
    timestamp: number;
    lastAccessedAt?: number;
    [key: string]: any;
}
export interface MemoryEvent {
    id?: string;
    tier: MemoryTier;
    scope: MemoryScope;
    content: string;
    metadata?: Partial<MemoryMetadata>;
}
export interface MemoryRef {
    id: string;
    tier: MemoryTier;
    created_at: number;
    updated_at: number;
}
export interface MemoryQuery {
    query: string;
    tier?: MemoryTier;
    scope?: MemoryScope;
    limit?: number;
    tags?: string[];
    minImportance?: number;
}
export interface MemoryResult {
    id: string;
    content: string;
    score: number;
    tier: MemoryTier;
    metadata: MemoryMetadata;
}
export interface MemoryToolSchema {
    name: string;
    description: string;
    parameters: Record<string, any>;
}
export declare class AMPCore {
    private storeMap;
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
    get size(): number;
    /**
     * 生成供 LLM Function Calling 的 Schema
     * 这是受 MemGPT 启发，赋予 LLM 自主管理记忆的能力
     */
    getMemoryTools(): MemoryToolSchema[];
}
export default AMPCore;
