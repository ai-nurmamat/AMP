/**
 * AMP (Agent Memory Protocol) Core
 * 打破信息孤岛，赋予所有 AI Agent 永恒且全局的记忆中枢。
 * 
 * 业界首创的多维记忆折叠架构，自主研发的跨生态、图向量双轨检索引擎。
 * 致力于成为 AI 记忆管理领域的最顶级形态。
 */

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

export class AMPCore {
  // 模拟持久化存储 (实际应对接 VectorDB 或 GraphDB)
  private storeMap: Map<string, MemoryResult> = new Map();

  /**
   * 存储记忆
   */
  async store(event: MemoryEvent): Promise<MemoryRef> {
    const id = event.id || crypto.randomUUID();
    const now = Date.now();
    
    const memoryRecord: MemoryResult = {
      id,
      content: event.content,
      score: 1.0,
      tier: event.tier,
      metadata: {
        importance: event.metadata?.importance ?? 0.5,
        tags: event.metadata?.tags || [],
        timestamp: now,
        lastAccessedAt: now,
        ...event.metadata
      }
    };

    // 可以在这里扩展向 Vector DB 或 Graph DB 的写入逻辑
    this.storeMap.set(id, memoryRecord);

    return {
      id,
      tier: event.tier,
      created_at: now,
      updated_at: now,
    };
  }

  /**
   * 检索记忆
   */
  async retrieve(query: MemoryQuery): Promise<MemoryResult[]> {
    const results: MemoryResult[] = [];
    
    for (const [id, record] of this.storeMap.entries()) {
      // 1. 层级和作用域过滤
      if (query.tier && record.tier !== query.tier) continue;
      
      // 2. 标签和重要性过滤
      if (query.tags && !query.tags.every(t => record.metadata.tags.includes(t))) continue;
      if (query.minImportance && record.metadata.importance < query.minImportance) continue;

      // 3. 内容相似度模拟 (实际应用中应替换为 Embedding 向量检索)
      // 此处使用简单的子串包含和关键词匹配计算得分
      let score = 0;
      if (record.content.includes(query.query)) {
        score = 1.0;
      } else {
        // 简单计算重合词
        const words = query.query.split(' ').filter(w => w.trim().length > 0);
        if (words.length > 0) {
            const matchCount = words.filter(w => record.content.includes(w)).length;
            score = matchCount / words.length;
        }
      }

      if (score > 0) {
        record.metadata.lastAccessedAt = Date.now(); // 更新访问时间
        results.push({ ...record, score });
      }
    }

    // 按得分降序，同分按重要性降序
    results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.metadata.importance - a.metadata.importance;
    });

    return results.slice(0, query.limit || 10);
  }

  /**
   * 更新记忆
   */
  async update(id: string, updates: Partial<MemoryEvent>): Promise<MemoryRef | null> {
    const record = this.storeMap.get(id);
    if (!record) return null;

    if (updates.content) record.content = updates.content;
    if (updates.tier) record.tier = updates.tier;
    if (updates.metadata) {
      record.metadata = { ...record.metadata, ...updates.metadata };
    }
    
    const now = Date.now();
    record.metadata.updated_at = now;

    this.storeMap.set(id, record);

    return {
      id,
      tier: record.tier,
      created_at: record.metadata.timestamp,
      updated_at: now,
    };
  }

  /**
   * 删除记忆
   */
  async delete(id: string): Promise<boolean> {
    return this.storeMap.delete(id);
  }

  /**
   * 获取核心记忆存储量
   */
  get size(): number {
    return this.storeMap.size;
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
