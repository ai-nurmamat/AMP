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
import asyncio
from enum import Enum
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

try:
    import redis.asyncio as redis
    from redis.commands.search.field import TextField, TagField, NumericField
    from redis.commands.search.index_definition import IndexDefinition, IndexType
    from redis.commands.search.query import Query
    from redis.exceptions import ResponseError
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
    async def store(self, event: MemoryEvent) -> Dict[str, Any]:
        raise NotImplementedError

    async def retrieve(self, query: MemoryQuery) -> List[MemoryResult]:
        raise NotImplementedError

    async def delete(self, mem_id: str) -> bool:
        raise NotImplementedError

    async def store_batch(self, events: List[MemoryEvent]) -> List[Dict[str, Any]]:
        raise NotImplementedError

    async def retrieve_batch(self, queries: List[MemoryQuery]) -> List[List[MemoryResult]]:
        raise NotImplementedError


class FileStorageProvider(StorageProvider):
    def __init__(self, file_path: str = "amp_memory.json"):
        import os
        import json
        self.file_path = file_path
        self._store: Dict[str, MemoryResult] = {}
        self._load_from_file()

    def _load_from_file(self):
        import os
        import json
        if os.path.exists(self.file_path):
            try:
                with open(self.file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    for k, v in data.items():
                        self._store[k] = MemoryResult.model_validate(v)
            except Exception as e:
                logger.warning(f"[AMP] Failed to load memory from file: {e}")

    def _save_to_file(self):
        import json
        try:
            with open(self.file_path, 'w', encoding='utf-8') as f:
                data = {k: v.model_dump() for k, v in self._store.items()}
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.warning(f"[AMP] Failed to save memory to file: {e}")

    async def store(self, event: MemoryEvent) -> Dict[str, Any]:
        mem_id = event.id or str(uuid.uuid4())
        now = time.time()
        metadata = event.metadata or MemoryMetadata()
        metadata.timestamp = now
        metadata.last_accessed_at = now
        record = MemoryResult(
            id=mem_id, content=event.content, score=1.0, tier=event.tier, metadata=metadata
        )
        self._store[mem_id] = record
        self._save_to_file()
        return {"id": mem_id, "tier": event.tier.value, "created_at": now, "updated_at": now}

    async def store_batch(self, events: List[MemoryEvent]) -> List[Dict[str, Any]]:
        results = []
        for event in events:
            res = await self.store(event)
            results.append(res)
        return results

    async def retrieve(self, query: MemoryQuery) -> List[MemoryResult]:
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
        self._save_to_file()
        return results[: query.limit]

    async def retrieve_batch(self, queries: List[MemoryQuery]) -> List[List[MemoryResult]]:
        return [await self.retrieve(q) for q in queries]

    async def delete(self, mem_id: str) -> bool:
        if mem_id in self._store:
            del self._store[mem_id]
            self._save_to_file()
            return True
        return False



class RedisStorageProvider(StorageProvider):
    def __init__(self, redis_url: str):
        if not REDIS_AVAILABLE:
            raise ImportError("Redis package is not installed. Run `pip install redis`.")
        self.client = redis.Redis.from_url(redis_url, decode_responses=True)
        self.prefix = "amp:memory:"
        self.index_name = "idx:amp:memory"
        self._initialized = False

    async def initialize(self):
        if self._initialized:
            return
        try:
            await self.client.ft(self.index_name).info()
        except ResponseError:
            schema = (
                TextField("$.content", as_name="content"),
                TagField("$.tier", as_name="tier"),
                TagField("$.metadata.tags.*", as_name="tags"),
                NumericField("$.metadata.importance", as_name="importance")
            )
            definition = IndexDefinition(prefix=[self.prefix], index_type=IndexType.JSON)
            await self.client.ft(self.index_name).create_index(schema, definition=definition)
        self._initialized = True

    async def store(self, event: MemoryEvent) -> Dict[str, Any]:
        await self.initialize()
        mem_id = event.id or str(uuid.uuid4())
        now = time.time()
        metadata = event.metadata or MemoryMetadata()
        metadata.timestamp = now
        metadata.last_accessed_at = now
        record = MemoryResult(
            id=mem_id, content=event.content, score=1.0, tier=event.tier, metadata=metadata
        )
        await self.client.json().set(f"{self.prefix}{mem_id}", "$", record.model_dump(mode="json"))  # type: ignore
        return {"id": mem_id, "tier": event.tier.value, "created_at": now, "updated_at": now}

    async def store_batch(self, events: List[MemoryEvent]) -> List[Dict[str, Any]]:
        await self.initialize()
        pipeline = self.client.pipeline()
        results = []
        now = time.time()
        
        for event in events:
            mem_id = event.id or str(uuid.uuid4())
            metadata = event.metadata or MemoryMetadata()
            metadata.timestamp = now
            metadata.last_accessed_at = now
            record = MemoryResult(
                id=mem_id, content=event.content, score=1.0, tier=event.tier, metadata=metadata
            )
            pipeline.json().set(f"{self.prefix}{mem_id}", "$", record.model_dump(mode="json"))
            results.append({"id": mem_id, "tier": event.tier.value, "created_at": now, "updated_at": now})
            
        await pipeline.execute()
        return results

    async def retrieve(self, query: MemoryQuery) -> List[MemoryResult]:
        await self.initialize()
        
        query_parts = []
        if query.tier:
            query_parts.append(f"@tier:{{{query.tier.value}}}")
        if query.tags:
            tags_str = " | ".join(query.tags)
            query_parts.append(f"@tags:{{{tags_str}}}")
        if query.min_importance is not None:
            query_parts.append(f"@importance:[{query.min_importance} +inf]")
            
        if query.query:
            escaped_q = query.query.replace("-", "\\-").replace(":", "\\:")
            query_parts.append(f"@content:({escaped_q})")
            
        search_query_str = " ".join(query_parts) if query_parts else "*"
        search_query = Query(search_query_str).paging(0, query.limit)
        
        res = await self.client.ft(self.index_name).search(search_query)
        
        results = []
        now = time.time()
        for doc in res.docs:
            data_str = getattr(doc, "json", getattr(doc, "$", None))
            if not data_str:
                data_str = doc.__dict__.get("json", doc.__dict__.get("$"))
            if not data_str:
                continue
                
            record = MemoryResult.model_validate_json(data_str)
            record.metadata.last_accessed_at = now
            results.append(record)
            
        if results:
            pipeline = self.client.pipeline()
            for record in results:
                pipeline.json().set(f"{self.prefix}{record.id}", "$.metadata.last_accessed_at", now)
            await pipeline.execute()
            
        return results

    async def retrieve_batch(self, queries: List[MemoryQuery]) -> List[List[MemoryResult]]:
        # RediSearch doesn't natively support batch search in a single command,
        # but we can use asyncio.gather for concurrent searches.
        return await asyncio.gather(*(self.retrieve(q) for q in queries))

    async def delete(self, mem_id: str) -> bool:
        return await self.client.delete(f"{self.prefix}{mem_id}") > 0


class AMPCore:
    def __init__(self, redis_url: Optional[str] = None):
        self.redis_url = redis_url
        self.provider: Optional[StorageProvider] = None
        self._initialized = False

    async def _ensure_initialized(self):
        if self._initialized:
            return
            
        if self.redis_url and REDIS_AVAILABLE:
            try:
                self.provider = RedisStorageProvider(self.redis_url)
                await self.provider.initialize()
                await self.provider.client.ping()
            except Exception as e:
                logger.warning(
                    f"[AMP] Redis connection failed, falling back to FileStorageProvider: {e}"
                )
                self.provider = FileStorageProvider()
        else:
            self.provider = FileStorageProvider()
            
        self._initialized = True

    async def store(self, event: MemoryEvent) -> Dict[str, Any]:
        await self._ensure_initialized()
        assert self.provider is not None
        return await self.provider.store(event)

    async def retrieve(self, query: MemoryQuery) -> List[MemoryResult]:
        await self._ensure_initialized()
        assert self.provider is not None
        return await self.provider.retrieve(query)

    async def delete(self, mem_id: str) -> bool:
        await self._ensure_initialized()
        assert self.provider is not None
        return await self.provider.delete(mem_id)

    async def store_batch(self, events: List[MemoryEvent]) -> List[Dict[str, Any]]:
        await self._ensure_initialized()
        assert self.provider is not None
        return await self.provider.store_batch(events)

    async def retrieve_batch(self, queries: List[MemoryQuery]) -> List[List[MemoryResult]]:
        await self._ensure_initialized()
        assert self.provider is not None
        return await self.provider.retrieve_batch(queries)

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
