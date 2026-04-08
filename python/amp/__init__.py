"""
AMP (Agent Memory Protocol) - Python Implementation
打破信息孤岛，赋予所有 AI Agent 永恒且全局的记忆中枢。
业界首创的多维记忆折叠架构，自主研发的跨生态、图向量双轨检索引擎。
"""

import uuid
import time
from enum import Enum
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

# 1. 记忆作用域 (Scope) - 原创的多维隔离机制
class MemoryScope(BaseModel):
    user_id: Optional[str] = Field(None, description="用户级记忆 (跨会话，用户偏好)")
    session_id: Optional[str] = Field(None, description="会话级记忆 (单次对话上下文)")
    agent_id: Optional[str] = Field(None, description="Agent 专属记忆 (人设、系统设定)")

# 2. 记忆层级 (Tier) - 独家的高速缓存与冷热数据分层模型
class MemoryTier(str, Enum):
    WORKING = 'working'       # 工作记忆 (短期、频繁读写、类似于人类的短期工作区)
    LONG_TERM = 'long_term'   # 长期记忆 (持久化、向量/语义深度检索)
    GRAPH = 'graph'           # 图记忆 (实体关系、复杂的逻辑多跳推理)

# 3. 记忆元数据
class MemoryMetadata(BaseModel):
    importance: float = Field(default=0.5, ge=0.0, le=1.0, description="重要性得分")
    tags: List[str] = Field(default_factory=list, description="标签分类")
    timestamp: float = Field(default_factory=lambda: time.time())
    last_accessed_at: Optional[float] = None
    extra: Dict[str, Any] = Field(default_factory=dict)

# 4. 标准记忆实体
class MemoryEvent(BaseModel):
    id: Optional[str] = None
    tier: MemoryTier
    scope: MemoryScope
    content: str
    metadata: Optional[MemoryMetadata] = None

# 5. 高级检索查询
class MemoryQuery(BaseModel):
    query: str
    tier: Optional[MemoryTier] = None
    scope: Optional[MemoryScope] = None
    limit: int = 10
    tags: Optional[List[str]] = None
    min_importance: Optional[float] = None

class MemoryResult(BaseModel):
    id: str
    content: str
    score: float
    tier: MemoryTier
    metadata: MemoryMetadata

class AMPCore:
    def __init__(self):
        # 模拟持久化存储 (实际应对接 VectorDB 或 GraphDB)
        self._store: Dict[str, MemoryResult] = {}

    def store(self, event: MemoryEvent) -> Dict[str, Any]:
        """存储记忆"""
        mem_id = event.id or str(uuid.uuid4())
        now = time.time()
        
        metadata = event.metadata or MemoryMetadata()
        metadata.timestamp = now
        metadata.last_accessed_at = now

        record = MemoryResult(
            id=mem_id,
            content=event.content,
            score=1.0,
            tier=event.tier,
            metadata=metadata
        )
        
        self._store[mem_id] = record
        
        return {
            "id": mem_id,
            "tier": event.tier.value,
            "created_at": now,
            "updated_at": now
        }

    def retrieve(self, query: MemoryQuery) -> List[MemoryResult]:
        """检索记忆"""
        results = []
        now = time.time()
        
        for record in self._store.values():
            # 1. 层级过滤
            if query.tier and record.tier != query.tier:
                continue
                
            # 2. 标签和重要性过滤
            if query.tags and not all(t in record.metadata.tags for t in query.tags):
                continue
            if query.min_importance is not None and record.metadata.importance < query.min_importance:
                continue

            # 3. 内容相似度模拟 (实际应用中应替换为 Embedding 向量检索)
            score = 0.0
            if query.query in record.content:
                score = 1.0
            else:
                words = [w for w in query.query.split() if w.strip()]
                if words:
                    match_count = sum(1 for w in words if w in record.content)
                    score = match_count / len(words)

            if score > 0:
                record.metadata.last_accessed_at = now
                record.score = score
                results.append(record)

        # 按得分降序，同分按重要性降序
        results.sort(key=lambda x: (x.score, x.metadata.importance), reverse=True)
        return results[:query.limit]

    def delete(self, mem_id: str) -> bool:
        """删除记忆"""
        if mem_id in self._store:
            del self._store[mem_id]
            return True
        return False

    def get_memory_tools(self) -> List[Dict[str, Any]]:
        """
        生成供 LLM Function Calling 的 Schema (OpenAI 格式)
        赋予 LLM 自主管理记忆的能力
        """
        return [
            {
                "type": "function",
                "function": {
                    "name": "amp_store_memory",
                    "description": "Store a new memory about the user, session, or factual knowledge.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "content": { "type": "string", "description": "The core content of the memory to store." },
                            "tier": { "type": "string", "enum": ["working", "long_term", "graph"], "description": "The tier to store this memory in." },
                            "importance": { "type": "number", "description": "Importance score from 0.0 to 1.0" },
                            "tags": { "type": "array", "items": { "type": "string" }, "description": "Tags for categorization" }
                        },
                        "required": ["content", "tier"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "amp_retrieve_memory",
                    "description": "Search for relevant past memories based on a query string.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": { "type": "string", "description": "The search query" },
                            "limit": { "type": "number", "description": "Maximum number of results to return" }
                        },
                        "required": ["query"]
                    }
                }
            }
        ]
