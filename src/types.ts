// 1. 记忆作用域 (Memory Scope) - 多维隔离机制
export interface MemoryScope {
  userId?: string;     // 用户级记忆：用于跨会话、跨生态的长期用户偏好及画像存储
  sessionId?: string;  // 会话级记忆：用于隔离单次对话流，生命周期随对话结束而终止
  agentId?: string;    // 智能体级记忆：用于存储专属人设、系统设定及解决问题的历史经验
}

// 2. 记忆层级 (Memory Tier) - 高速缓存与冷热数据分层模型
export enum MemoryTier {
  WORKING = 'working',       // 工作记忆：针对短期、高频读写场景设计的 Scratchpad（暂存区）
  LONG_TERM = 'long_term',   // 长期记忆：支持向量持久化与深度语义检索的冷数据层
  GRAPH = 'graph'            // 图记忆：面向复杂逻辑、实体关系及多跳推理的结构化图谱层
}

// 3. 记忆元数据 (Memory Metadata)
export interface MemoryMetadata {
  importance: number;      // 重要性得分 (范围 0.0 - 1.0)，为后台艾宾浩斯遗忘曲线及上下文修剪提供决策依据
  tags: string[];          // 分类标签，用于精确的元数据过滤与检索
  timestamp: number;       // 记忆创建时间戳
  lastAccessedAt?: number; // 最后一次检索命中时间，驱动数据淘汰与降维机制
  [key: string]: any;      // 支持扩展的动态字段
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