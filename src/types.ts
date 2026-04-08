// 1. 记忆作用域 (Scope) - 原创的多维隔离机制
export interface MemoryScope {
  userId?: string;     // 用户级记忆 (跨会话，用户偏好)
  sessionId?: string;  // 会话级记忆 (单次对话上下文)
  agentId?: string;    // Agent 专属记忆 (人设、系统设定、过往经验)
}

// 2. 记忆层级 (Tier) - 独家的高速缓存与冷热数据分层模型
export enum MemoryTier {
  WORKING = 'working',       // 工作记忆 (短期、频繁读写、类似于人类的短期工作区)
  LONG_TERM = 'long_term',   // 长期记忆 (持久化、向量/语义深度检索)
  GRAPH = 'graph'            // 图记忆 (实体关系、复杂的逻辑多跳推理)
}

// 3. 记忆元数据
export interface MemoryMetadata {
  importance: number;      // 重要性得分 (0-1，用于遗忘曲线和上下文修剪)
  tags: string[];          // 标签分类
  timestamp: number;       // 创建时间
  lastAccessedAt?: number; // 最后访问时间 (用于淘汰机制)
  [key: string]: any;      // 扩展字段
}

// 4. 标准记忆实体
export interface MemoryEvent {
  id?: string;
  tier: MemoryTier;
  scope: MemoryScope;
  content: string;
  metadata?: Partial<MemoryMetadata>;
}

// 5. 记忆引用
export interface MemoryRef {
  id: string;
  tier: MemoryTier;
  created_at: number;
  updated_at: number;
}

// 6. 高级检索查询
export interface MemoryQuery {
  query: string;
  tier?: MemoryTier;
  scope?: MemoryScope;
  limit?: number;
  tags?: string[];
  minImportance?: number; // 过滤低重要性记忆
}

export interface MemoryResult {
  id: string;
  content: string;
  score: number;      // 相似度得分 (向量检索时)
  tier: MemoryTier;
  metadata: MemoryMetadata;
}

// 7. 记忆抽取工具定义 (供 LLM Function Calling 使用)
export interface MemoryToolSchema {
  name: string;
  description: string;
  parameters: Record<string, any>;
}