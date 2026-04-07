# AMP (Agent Memory Protocol)

> 让每一个 AI Agent 都能拥有记忆
> 融合业界顶级项目最佳实践 (Mem0, MemGPT, Zep) 打造的标准 AI 记忆协议。

## 核心设计理念

基于对市面上 10k+ Star 记忆相关开源项目 (Mem0, MemGPT/Letta, Zep 等) 的深度调研，AMP 引入了以下标准化和创新设计：

1. **记忆作用域 (Scope - 借鉴 Mem0)**
   - `userId` (用户级): 跨会话的用户偏好和长期事实。
   - `sessionId` (会话级): 单次对话上下文，短生命周期。
   - `agentId` (Agent级): Agent 的人设、系统设定及过往经验。

2. **分层记忆存储 (Tier - 借鉴 MemGPT)**
   - `working` (工作记忆): 频繁读写、短期的 Scratchpad。
   - `long_term` (长期记忆): 持久化存储、依赖向量或语义检索获取。
   - `graph` (图记忆): 处理复杂的实体关系与多跳推理。

3. **自主记忆管理 (Autonomous - 借鉴 MemGPT)**
   - 内置 `getMemoryTools()` 生成标准 Function Calling / Tool 描述，让 LLM 能够像操作系统一样**自主地存储、更新和检索记忆**。

4. **高级元数据与检索策略 (Metadata & Retrieval)**
   - 引入 `importance` (重要性得分) 和 `lastAccessedAt` (最后访问时间)，以支持未来加入基于艾宾浩斯遗忘曲线的记忆修剪与淘汰机制。

## 快速开始

```typescript
import { AMPCore, MemoryTier } from 'amp-protocol';

const amp = new AMPCore();

// 1. 存储结构化记忆
await amp.store({
  tier: MemoryTier.LONG_TERM,
  scope: { userId: 'user-123' },
  content: '用户偏好使用 TypeScript，并喜欢暗色主题。',
  metadata: { importance: 0.9, tags: ['tech', 'preference'] }
});

// 2. 检索记忆 (支持重要性过滤和标签匹配)
const results = await amp.retrieve({ 
  query: 'TypeScript', 
  tier: MemoryTier.LONG_TERM,
  limit: 5,
  minImportance: 0.5 
});

console.log(results);

// 3. 获取 LLM Function Calling Tools (让大模型自己管理记忆)
const memoryTools = amp.getMemoryTools();
/*
  传递给 OpenAI 或 Claude:
  llm.chat({
    messages: [...],
    tools: memoryTools
  })
*/
```

## 演进与创新

- **融合而非造轮子**：将 Mem0 的层级分类体系和 MemGPT 的 OS 架构相结合，提供了一套轻量、无状态的协议层实现。
- **扩展性强**：`AMPCore` 接口可以轻松被继承，以便底层接入 RedisVL (向量)、Neo4j (图) 或者是 Pinecone 等外部存储。
- **智能化生命周期**：未来支持集成后台进程的 Memory Consolidation（记忆压缩与提取）。

## 许可证

MIT
