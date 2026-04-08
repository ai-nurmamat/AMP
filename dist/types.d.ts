export interface MemoryScope {
    userId?: string;
    sessionId?: string;
    agentId?: string;
}
export declare enum MemoryTier {
    WORKING = "working",// 工作记忆：针对短期、高频读写场景设计的 Scratchpad（暂存区）
    LONG_TERM = "long_term",// 长期记忆：支持向量持久化与深度语义检索的冷数据层
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
