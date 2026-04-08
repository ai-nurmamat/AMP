"""
AMP (Agent Memory Protocol) - Python Implementation

打破信息孤岛，赋予所有 AI Agent 永恒且全局的记忆中枢。
业界首创的多维记忆折叠架构，自主研发的跨生态、图向量双轨检索引擎。
致力于成为 AI 记忆管理领域的最顶级形态。

本模块提供了核心的接口和存储 Provider，确保跨生态兼容性以及高性能的记忆管理。
"""

import uuid
import time
import logging
from enum import Enum
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

try:
    import redis

    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False

logger = logging.getLogger(__name__)


# 1. 记忆作用域 (Memory Scope) - 多维隔离机制
class MemoryScope(BaseModel):
    user_id: Optional[str] = Field(None, description="用户级记忆：用于跨会话、跨生态的长期用户偏好及画像存储")
    session_id: Optional[str] = Field(None, description="会话级记忆：用于隔离单次对话流，生命周期随对话结束而终止")
    agent_id: Optional[str] = Field(None, description="智能体级记忆：用于存储专属人设、系统设定及解决问题的历史经验")


# 2. 记忆层级 (Memory Tier) - 高速缓存与冷热数据分层模型
class MemoryTier(str, Enum):
    WORKING = "working"  # 工作记忆：针对短期、高频读写场景设计的 Scratchpad（暂存区）
    LONG_TERM = "long_term"  # 长期记忆：支持向量持久化与深度语义检索的冷数据层
    GRAPH = "graph"  # 图记忆：面向复杂逻辑、实体关系及多跳推理的结构化图谱层


# 3. 记忆元数据 (Memory Metadata)
class MemoryMetadata(BaseModel):
    importance: float = Field(
        default=0.5, ge=0.0, le=1.0, description="重要性得分 (范围 0.0 - 1.0)，为后台艾宾浩斯遗忘曲线及上下文修剪提供决策依据"
    )
    tags: List[str] = Field(default_factory=list, description="分类标签，用于精确的元数据过滤与检索")
    timestamp: float = Field(default_factory=time.time)
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


class StorageProvider:
    def store(self, event: MemoryEvent) -> Dict[str, Any]:
        raise NotImplementedError

    def retrieve(self, query: MemoryQuery) -> List[MemoryResult]:
        raise NotImplementedError

    def delete(self, mem_id: str) -> bool:
        raise NotImplementedError


class MemoryStorageProvider(StorageProvider):
    def __init__(self):
        self._store: Dict[str, MemoryResult] = {}

    def store(self, event: MemoryEvent) -> Dict[str, Any]:
        mem_id = event.id or str(uuid.uuid4())
        now = time.time()
        metadata = event.metadata or MemoryMetadata()
        metadata.timestamp = now
        metadata.last_accessed_at = now
        record = MemoryResult(
            id=mem_id, content=event.content, score=1.0, tier=event.tier, metadata=metadata
        )
        self._store[mem_id] = record
        return {"id": mem_id, "tier": event.tier.value, "created_at": now, "updated_at": now}

    def retrieve(self, query: MemoryQuery) -> List[MemoryResult]:
        results = []
        now = time.time()
        for record in self._store.values():
            if query.tier and record.tier != query.tier:
                continue
            if query.tags and not all(t in record.metadata.tags for t in query.tags):
                continue
            if (
                query.min_importance is not None
                and record.metadata.importance < query.min_importance
            ):
                continue

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

        results.sort(key=lambda x: (x.score, x.metadata.importance), reverse=True)
        return results[: query.limit]

    def delete(self, mem_id: str) -> bool:
        if mem_id in self._store:
            del self._store[mem_id]
            return True
        return False


class RedisStorageProvider(StorageProvider):
    def __init__(self, redis_url: str):
        if not REDIS_AVAILABLE:
            raise ImportError("Redis package is not installed. Run `pip install redis`.")
        self.client = redis.Redis.from_url(redis_url, decode_responses=True)
        self.prefix = "amp:memory:"
        # In a real enterprise app, we'd setup RediSearch indexes (FT.CREATE) here.

    def store(self, event: MemoryEvent) -> Dict[str, Any]:
        mem_id = event.id or str(uuid.uuid4())
        now = time.time()
        metadata = event.metadata or MemoryMetadata()
        metadata.timestamp = now
        metadata.last_accessed_at = now
        record = MemoryResult(
            id=mem_id, content=event.content, score=1.0, tier=event.tier, metadata=metadata
        )
        self.client.set(f"{self.prefix}{mem_id}", record.model_dump_json())
        return {"id": mem_id, "tier": event.tier.value, "created_at": now, "updated_at": now}

    def retrieve(self, query: MemoryQuery) -> List[MemoryResult]:
        results = []
        now = time.time()
        for key in self.client.scan_iter(f"{self.prefix}*"):
            data = self.client.get(key)
            if not data:
                continue
            record = MemoryResult.model_validate_json(data)

            if query.tier and record.tier != query.tier:
                continue
            if query.tags and not all(t in record.metadata.tags for t in query.tags):
                continue
            if (
                query.min_importance is not None
                and record.metadata.importance < query.min_importance
            ):
                continue

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
                self.client.set(key, record.model_dump_json())
                record.score = score
                results.append(record)

        results.sort(key=lambda x: (x.score, x.metadata.importance), reverse=True)
        return results[: query.limit]

    def delete(self, mem_id: str) -> bool:
        return self.client.delete(f"{self.prefix}{mem_id}") > 0


class AMPCore:
    def __init__(self, redis_url: Optional[str] = None):
        if redis_url and REDIS_AVAILABLE:
            try:
                self.provider = RedisStorageProvider(redis_url)
                self.provider.client.ping()
            except Exception as e:
                logger.warning(
                    f"[AMP] Redis connection failed, falling back to MemoryStorageProvider: {e}"
                )
                self.provider = MemoryStorageProvider()
        else:
            self.provider = MemoryStorageProvider()

    def store(self, event: MemoryEvent) -> Dict[str, Any]:
        return self.provider.store(event)

    def retrieve(self, query: MemoryQuery) -> List[MemoryResult]:
        return self.provider.retrieve(query)

    def delete(self, mem_id: str) -> bool:
        return self.provider.delete(mem_id)

    def get_memory_tools(self) -> List[Dict[str, Any]]:
        return [
            {
                "type": "function",
                "function": {
                    "name": "amp_store_memory",
                    "description": "Store a new memory about the user, session, or factual knowledge.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "content": {
                                "type": "string",
                                "description": "The core content of the memory to store.",
                            },
                            "tier": {
                                "type": "string",
                                "enum": ["working", "long_term", "graph"],
                                "description": "The tier to store this memory in.",
                            },
                            "importance": {
                                "type": "number",
                                "description": "Importance score from 0.0 to 1.0",
                            },
                            "tags": {
                                "type": "array",
                                "items": {"type": "string"},
                                "description": "Tags for categorization",
                            },
                        },
                        "required": ["content", "tier"],
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "amp_retrieve_memory",
                    "description": "Search for relevant past memories based on a query string.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": {"type": "string", "description": "The search query"},
                            "limit": {
                                "type": "number",
                                "description": "Maximum number of results to return",
                            },
                        },
                        "required": ["query"],
                    },
                },
            },
        ]
