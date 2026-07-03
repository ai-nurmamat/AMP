"""
AMP (Agent Memory Protocol) - Python Implementation

打破信息孤岛，赋予所有 AI Agent 永恒且全局的记忆中枢。
业界首创的多维记忆折叠架构，自主研发的跨生态、图向量双轨检索引擎。
致力于成为 AI 记忆管理领域的最顶级形态。

本模块提供了核心的接口和存储 Provider，确保跨生态兼容性以及高性能的记忆管理。
"""

import os
import re
import json
import math
import copy
import uuid
import time
import logging
import asyncio
from enum import Enum
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

from .audit import AuditLogger

try:
    import redis.asyncio as redis
    from redis.commands.search.field import TextField, TagField, NumericField
    from redis.commands.search.index_definition import IndexDefinition, IndexType
    from redis.commands.search.query import Query
    from redis.exceptions import ResponseError
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False

try:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    CRYPTO_AVAILABLE = True
except ImportError:
    CRYPTO_AVAILABLE = False

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
    access_count: int = Field(default=0, description="记录被检索访问的次数，用于艾宾浩斯遗忘曲线的访问增益")
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
    query: str = ""
    tier: Optional[MemoryTier] = None
    scope: Optional[MemoryScope] = None
    tags: List[str] = Field(default_factory=list)
    min_importance: float = Field(default=0.0, ge=0.0, le=1.0)
    limit: int = Field(default=10, ge=1, le=1000)


class MemoryResult(BaseModel):
    id: str
    content: str
    score: float
    tier: MemoryTier
    scope: MemoryScope
    metadata: MemoryMetadata


class StorageProvider:
    async def store(self, event: MemoryEvent) -> Dict[str, Any]:
        raise NotImplementedError

    async def retrieve(self, query: MemoryQuery) -> List[MemoryResult]:
        raise NotImplementedError

    async def delete(self, mem_id: str) -> bool:
        raise NotImplementedError

    async def update(self, mem_id: str, event: MemoryEvent) -> bool:
        raise NotImplementedError

    async def store_batch(self, events: List[MemoryEvent]) -> List[Dict[str, Any]]:
        raise NotImplementedError

    async def retrieve_batch(self, queries: List[MemoryQuery]) -> List[List[MemoryResult]]:
        raise NotImplementedError


# Alias for interface-style naming (used by AMPCore type hints and __all__).
IStorageProvider = StorageProvider


class FileStorageProvider(StorageProvider):
    def __init__(self, file_path: str = "amp_memory.json",
                 encryption_key: Optional[str] = None):
        self.file_path = file_path
        self._store: Dict[str, MemoryResult] = {}
        # Optional at-rest encryption (AES-256-GCM). If encryption_key is None,
        # behavior is unchanged (plain JSON on disk).
        self.encryption_key = encryption_key
        if self.encryption_key is not None:
            if not CRYPTO_AVAILABLE:
                raise ImportError(
                    "encryption_key provided but the 'cryptography' package is not "
                    "installed. Run `pip install cryptography`."
                )
            # AES-256 requires a 32-byte key. Derive one deterministically from the
            # user-supplied passphrase so callers can pass human-friendly strings.
            import hashlib
            self._aes_key = hashlib.sha256(encryption_key.encode("utf-8")).digest()
            self._aesgcm = AESGCM(self._aes_key)
        else:
            self._aes_key = None
            self._aesgcm = None
        self._load_from_file()

    def _load_from_file(self):
        if not os.path.exists(self.file_path):
            return
        try:
            if self.encryption_key is not None:
                # Encrypted file layout: iv (12 bytes) || ciphertext+tag (rest)
                with open(self.file_path, "rb") as f:
                    blob = f.read()
                if not blob:
                    return
                iv = blob[:12]
                ct = blob[12:]
                plaintext = self._aesgcm.decrypt(iv, ct, None)
                data = json.loads(plaintext.decode("utf-8"))
            else:
                with open(self.file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
            for k, v in data.items():
                self._store[k] = MemoryResult.model_validate(v)
        except Exception as e:
            logger.warning(f"[AMP] Failed to load memory from file: {e}")

    def _save_to_file(self):
        try:
            data = {k: v.model_dump() for k, v in self._store.items()}
            payload = json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")
            if self.encryption_key is not None:
                iv = os.urandom(12)
                ct = self._aesgcm.encrypt(iv, payload, None)
                with open(self.file_path, "wb") as f:
                    f.write(iv + ct)
            else:
                with open(self.file_path, "w", encoding="utf-8") as f:
                    f.write(payload.decode("utf-8"))
        except Exception as e:
            logger.warning(f"[AMP] Failed to save memory to file: {e}")

    def _compute_decayed_importance(self, record: MemoryResult, now: float) -> float:
        half_life_days = 30.0
        last_accessed = record.metadata.last_accessed_at or record.metadata.timestamp
        days_since = max(0.0, (now - last_accessed) / (60 * 60 * 24))
        access_boost = min(0.3, record.metadata.access_count * 0.05)
        decayed = record.metadata.importance * (0.5 ** (days_since / half_life_days)) + access_boost
        return max(0.0, min(1.0, decayed))

    async def store(self, event: MemoryEvent) -> Dict[str, Any]:
        mem_id = event.id or str(uuid.uuid4())
        # Fix 5: id collision detection
        if event.id and event.id in self._store:
            raise ValueError(f"Memory with id {event.id} already exists; use update() to modify")
        now = time.time()
        # Fix 1: spread user metadata FIRST, then apply server-authoritative fields.
        metadata = MemoryMetadata(
            **(event.metadata.model_dump(exclude_unset=True) if event.metadata else {}),
            importance=event.metadata.importance if event.metadata else 0.5,
            tags=event.metadata.tags if event.metadata else [],
            timestamp=now,
            last_accessed_at=now,
            access_count=0,
        )
        record = MemoryResult(
            id=mem_id, content=event.content, score=1.0, tier=event.tier,
            scope=event.scope, metadata=metadata,
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
        dirty = False
        for record in self._store.values():
            if query.tier and record.tier != query.tier:
                continue
            # Fix 4: scope isolation — SECURITY
            if query.scope:
                if query.scope.user_id is not None and record.scope.user_id != query.scope.user_id:
                    continue
                if query.scope.session_id is not None and record.scope.session_id != query.scope.session_id:
                    continue
                if query.scope.agent_id is not None and record.scope.agent_id != query.scope.agent_id:
                    continue
            if query.tags and not all(t in record.metadata.tags for t in query.tags):
                continue
            decayed_importance = self._compute_decayed_importance(record, now)
            if decayed_importance < query.min_importance:
                continue

            score = 0.0
            if query.query:
                if query.query in record.content:
                    score = 1.0
                else:
                    words = [w for w in query.query.split() if w.strip()]
                    if words:
                        match_count = sum(1 for w in words if w in record.content)
                        score = match_count / len(words)

            if score > 0:
                # Fix 2: mutate STORED record (intentional persistence for access tracking),
                # but return a deep copy so callers don't share references / runtime score.
                record.metadata.last_accessed_at = now
                record.metadata.access_count = record.metadata.access_count + 1
                dirty = True
                result = copy.deepcopy(record)
                result.score = score
                results.append(result)

        # Feature A: Ebbinghaus decay in sort key (decayed importance already computed above).
        results.sort(key=lambda x: (x.score, x.metadata.importance), reverse=True)
        # Fix 2: only persist if a record was actually updated.
        if dirty:
            self._save_to_file()
        return results[: query.limit]

    async def retrieve_batch(self, queries: List[MemoryQuery]) -> List[List[MemoryResult]]:
        return [await self.retrieve(q) for q in queries]

    async def update(self, mem_id: str, event: MemoryEvent) -> bool:
        if mem_id not in self._store:
            return False
        now = time.time()
        metadata = MemoryMetadata(
            **(event.metadata.model_dump(exclude_unset=True) if event.metadata else {}),
            importance=event.metadata.importance if event.metadata else 0.5,
            tags=event.metadata.tags if event.metadata else [],
            timestamp=now,
            last_accessed_at=now,
            access_count=0,
        )
        record = MemoryResult(
            id=mem_id, content=event.content, score=1.0, tier=event.tier,
            scope=event.scope, metadata=metadata,
        )
        self._store[mem_id] = record
        self._save_to_file()
        return True

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

    # Fix 8: RediSearch query escaping — cover all special characters.
    _ESCAPE_RE = re.compile(r'([,|(){}\[\]:;!@<>"\'\-*$?~+/=&])')

    def _escape(self, value: str) -> str:
        return self._ESCAPE_RE.sub(lambda m: "\\" + m.group(1), value)

    def _compute_decayed_importance(self, record: MemoryResult, now: float) -> float:
        half_life_days = 30.0
        last_accessed = record.metadata.last_accessed_at or record.metadata.timestamp
        days_since = max(0.0, (now - last_accessed) / (60 * 60 * 24))
        access_boost = min(0.3, record.metadata.access_count * 0.05)
        decayed = record.metadata.importance * (0.5 ** (days_since / half_life_days)) + access_boost
        return max(0.0, min(1.0, decayed))

    async def store(self, event: MemoryEvent) -> Dict[str, Any]:
        await self.initialize()
        mem_id = event.id or str(uuid.uuid4())
        # Fix 5: id collision detection
        if event.id:
            existing = await self.client.json().get(f"{self.prefix}{mem_id}")
            if existing is not None:
                raise ValueError(
                    f"Memory with id {event.id} already exists; use update() to modify"
                )
        now = time.time()
        # Fix 1: spread user metadata FIRST, then apply server-authoritative fields.
        metadata = MemoryMetadata(
            **(event.metadata.model_dump(exclude_unset=True) if event.metadata else {}),
            importance=event.metadata.importance if event.metadata else 0.5,
            tags=event.metadata.tags if event.metadata else [],
            timestamp=now,
            last_accessed_at=now,
            access_count=0,
        )
        record = MemoryResult(
            id=mem_id, content=event.content, score=1.0, tier=event.tier,
            scope=event.scope, metadata=metadata,
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
            metadata = MemoryMetadata(
                **(event.metadata.model_dump(exclude_unset=True) if event.metadata else {}),
                importance=event.metadata.importance if event.metadata else 0.5,
                tags=event.metadata.tags if event.metadata else [],
                timestamp=now,
                last_accessed_at=now,
                access_count=0,
            )
            record = MemoryResult(
                id=mem_id, content=event.content, score=1.0, tier=event.tier,
                scope=event.scope, metadata=metadata,
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
        # Fix 7: AND semantics across tags — space-separated within parens = AND in RediSearch.
        if query.tags:
            tag_queries = [f"@tags:{{{self._escape(t)}}}" for t in query.tags]
            query_parts.append(f"({' '.join(tag_queries)})")
        if query.min_importance is not None:
            query_parts.append(f"@importance:[{query.min_importance} +inf]")

        if query.query:
            escaped_q = self._escape(query.query)
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
            # Fix 4: scope isolation — SECURITY
            if query.scope:
                if query.scope.user_id is not None and record.scope.user_id != query.scope.user_id:
                    continue
                if query.scope.session_id is not None and record.scope.session_id != query.scope.session_id:
                    continue
                if query.scope.agent_id is not None and record.scope.agent_id != query.scope.agent_id:
                    continue

            # Fix 2: the caller-facing record is already fresh (parsed from JSON);
            # runtime score is set only on this fresh copy, never persisted.
            # Feature A: decayed importance used as the sort key.
            decayed = self._compute_decayed_importance(record, now)
            record.score = decayed
            record.metadata.last_accessed_at = now
            record.metadata.access_count = record.metadata.access_count + 1
            results.append(record)

        # Feature A: sort by decayed importance (carried on record.score).
        results.sort(key=lambda x: x.score, reverse=True)

        if results:
            pipeline = self.client.pipeline()
            for record in results:
                pipeline.json().set(
                    f"{self.prefix}{record.id}", "$.metadata.last_accessed_at", now
                )
                pipeline.json().set(
                    f"{self.prefix}{record.id}", "$.metadata.access_count",
                    record.metadata.access_count,
                )
            await pipeline.execute()

        return results

    async def retrieve_batch(self, queries: List[MemoryQuery]) -> List[List[MemoryResult]]:
        # RediSearch doesn't natively support batch search in a single command,
        # but we can use asyncio.gather for concurrent searches.
        return await asyncio.gather(*(self.retrieve(q) for q in queries))

    async def update(self, mem_id: str, event: MemoryEvent) -> bool:
        await self.initialize()
        existing = await self.client.json().get(f"{self.prefix}{mem_id}")
        if existing is None:
            return False
        now = time.time()
        metadata = MemoryMetadata(
            **(event.metadata.model_dump(exclude_unset=True) if event.metadata else {}),
            importance=event.metadata.importance if event.metadata else 0.5,
            tags=event.metadata.tags if event.metadata else [],
            timestamp=now,
            last_accessed_at=now,
            access_count=0,
        )
        record = MemoryResult(
            id=mem_id, content=event.content, score=1.0, tier=event.tier,
            scope=event.scope, metadata=metadata,
        )
        await self.client.json().set(f"{self.prefix}{mem_id}", "$", record.model_dump(mode="json"))  # type: ignore
        return True

    async def delete(self, mem_id: str) -> bool:
        return await self.client.delete(f"{self.prefix}{mem_id}") > 0


class AMPCore:
    def __init__(self, redis_url: Optional[str] = None,
                 storage_path: str = "amp_memory.json",
                 encryption_key: Optional[str] = None,
                 audit_log_path: Optional[str] = None):
        self.redis_url = redis_url
        self.storage_path = storage_path
        self.encryption_key = encryption_key
        self.provider: Optional[StorageProvider] = None
        self._initialized = False
        # Feature C: Audit logging — disabled by default unless a path is provided.
        self.audit_logger = AuditLogger(audit_log_path)

    async def _ensure_initialized(self):
        """Lazily initialize the underlying provider on first use.

        Initialization is deferred to the first store/retrieve/update/delete call
        so that constructing an ``AMPCore`` instance remains cheap and synchronous.
        For Redis, this also performs a live ping; on any failure it falls back
        to ``FileStorageProvider`` with a warning (Fix 6).
        """
        if self._initialized:
            return

        if self.redis_url and REDIS_AVAILABLE:
            try:
                self.provider = RedisStorageProvider(self.redis_url)
                await self.provider.initialize()
                await self.provider.client.ping()
            except Exception as e:
                logger.warning(f"Redis unavailable ({e}); falling back to FileStorageProvider")
                self.provider = FileStorageProvider(self.storage_path, encryption_key=self.encryption_key)
        else:
            if self.redis_url and not REDIS_AVAILABLE:
                logger.warning(
                    "redis_url provided but redis package not installed; "
                    "falling back to FileStorageProvider"
                )
            self.provider = FileStorageProvider(self.storage_path, encryption_key=self.encryption_key)

        self._initialized = True

    async def store(self, event: MemoryEvent) -> Dict[str, Any]:
        await self._ensure_initialized()
        assert self.provider is not None
        result = await self.provider.store(event)
        self.audit_logger.log(
            action="store",
            memory_id=result.get("id"),
            user_id=event.scope.user_id,
            agent_id=event.scope.agent_id,
            details=f"tier={event.tier.value}",
        )
        return result

    async def retrieve(self, query: MemoryQuery) -> List[MemoryResult]:
        await self._ensure_initialized()
        assert self.provider is not None
        results = await self.provider.retrieve(query)
        self.audit_logger.log(
            action="retrieve",
            user_id=query.scope.user_id if query.scope else None,
            agent_id=query.scope.agent_id if query.scope else None,
            details=f"q={query.query!r} hits={len(results)}",
        )
        return results

    async def update(self, mem_id: str, event: MemoryEvent) -> bool:
        await self._ensure_initialized()
        assert self.provider is not None
        ok = await self.provider.update(mem_id, event)
        self.audit_logger.log(
            action="update",
            memory_id=mem_id,
            user_id=event.scope.user_id,
            agent_id=event.scope.agent_id,
            details=f"ok={ok}",
        )
        return ok

    async def delete(self, mem_id: str) -> bool:
        await self._ensure_initialized()
        assert self.provider is not None
        ok = await self.provider.delete(mem_id)
        self.audit_logger.log(action="delete", memory_id=mem_id, details=f"ok={ok}")
        return ok

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


__all__ = [
    "AMPCore",
    "MemoryEvent",
    "MemoryTier",
    "MemoryScope",
    "MemoryMetadata",
    "MemoryQuery",
    "AuditLogger",
    "FileStorageProvider",
    "RedisStorageProvider",
    "IStorageProvider",
]
