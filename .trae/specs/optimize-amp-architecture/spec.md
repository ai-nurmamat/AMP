# AMP 架构优化与全能化演进 Spec

## Why
当前 AMP (Agent Memory Protocol) 具备先进的多层级记忆和跨端共享理念，但在底层检索引擎、通信闭环、高并发处理及安全性方面存在物理极限。为了彻底确立 AMP 在 AI 记忆管理领域的顶级形态，我们将调用超过20项高级技能栈（涵盖安全、全栈开发、可视化、Redis深度优化、算法架构等），进行深度的技术重构，引入真正的向量/图谱检索、异步并发架构、前端可视化大盘以及企业级安全与工程规范。

## What Changes
- **底层存储与检索引擎升级 (Redis Development)**：废弃 `O(N)` 的全量字符串匹配，引入基于 `RedisVL` 和 `RediSearch` 的 HNSW 向量索引与混合检索。
- **MCP 服务器标准化与安全加固 (MCP Builder & Security Best Practices)**：重构 MCP Server，增加基于 `Zod` 的输入清洗、并发限流（Rate Limiting）及安全认证鉴权。
- **跨端通信与隐式记忆闭环 (Web Dev & Vercel React Best Practices)**：打通 Chrome 扩展与本地/云端 MCP 服务的 REST/WebSocket 双向通信，实现记忆实时上报。
- **前端可视化与记忆大盘 (Frontend Design & Chart Visualization & Algorithmic Art)**：利用现代架构重构 Chrome 扩展 Popup，新增基于算法美学的记忆网络拓扑图与数据分析仪表盘。
- **Python 核心库全异步化 (Vercel Composition Patterns)**：将 Python SDK 全面重构为基于 `asyncio` 和 `redis.asyncio` 的高并发架构，支持 `store_batch` 批处理。
- **自动化测试与 CI/CD (Webapp Testing & GH CLI & Git Commit)**：引入完整的单元测试、Web UI 端到端测试（Playwright），以及自动化的 GitHub Actions 工作流。
- **品牌一致性与文档生成 (Brand Guidelines & Report Generator)**：使用统一的品牌色调重构扩展 UI，并在构建流水线中生成安全与架构评估报告。

## Impact
- Affected specs: 存储层、MCP 协议层、Chrome 扩展层、Python SDK 层。
- Affected code: `src/storage.ts`, `python/amp/__init__.py`, `mcp/index.ts`, `extension/*`.

## ADDED Requirements
### Requirement: 向量与混合检索 (Vector & Hybrid Search)
The system SHALL use RedisVL/RediSearch for semantic and metadata-filtered memory retrieval.
#### Scenario: Success case
- **WHEN** user retrieves memory using semantic query
- **THEN** system performs KNN search using embeddings and returns high-relevance memories within milliseconds.

### Requirement: 异步与批处理 (Async & Batching)
The system SHALL provide fully asynchronous APIs in Python and support batch ingestion of memories.

### Requirement: 安全防护 (Security)
The MCP server SHALL sanitize all inputs and implement rate limiting to prevent abuse.

### Requirement: 记忆大盘大屏 (Memory Dashboard)
The extension/web UI SHALL render interactive charts displaying memory distribution and importance over time.

## MODIFIED Requirements
### Requirement: MCP Server 通信
The MCP Server SHALL expose HTTP/WebSocket endpoints alongside stdio to allow the Chrome extension to push implicit memories.