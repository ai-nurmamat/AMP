# Tasks
- [x] Task 1: 底层存储与检索引擎重构 (Redis Development)
  - 描述：在 TS 和 Python 核心库中引入 RedisVL/RediSearch 支持，配置 HNSW 向量索引，替换现有的遍历搜索。
  - 提示：重点参考 redis-development 最佳实践，确保高性能索引和查询的并发安全。
- [x] Task 2: Python SDK 异步化与批处理
  - 描述：将 `AMPCore` 和 `StorageProvider` 重构为 `async def`，新增 `store_batch` 和 `retrieve_batch` 接口，并使用 `redis.asyncio`。
  - 提示：注意异步上下文管理与连接池的释放。
- [x] Task 3: MCP 服务器安全与架构标准化 (MCP Builder & Security)
  - 描述：对所有的输入参数进行深度清洗（防止注入攻击），并在 MCP Server 中开放一个受保护的 HTTP 服务（使用 JWT 或 Token），接收 Chrome 扩展的实时记忆推送。
  - 提示：遵循 security-best-practices，严禁使用明文传输或缺乏校验的输入。
- [x] Task 4: Chrome扩展UI重构与通信对接
- [x] Task 5: 自动化测试与持续集成配置

# Task Dependencies
- [Task 3] depends on [Task 1]
- [Task 4] depends on [Task 3]
- [Task 5] depends on [Task 1], [Task 2], [Task 3]