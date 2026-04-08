# AMP (Agent Memory Protocol) 颠覆性优化与全栈工程化方案

## 1. 现状分析 (Current State Analysis)
目前 AMP 的核心逻辑已经统一了品牌并确立了“多层级作用域”、“工作/长期/图记忆”等顶级理论模型。然而在工程落地层面仍存在以下局限：
1. **底层存储脆弱**：目前仅依赖基于内存的 `Map` 和 `Dict`，一旦进程重启记忆就会丢失，无法支撑真实的生产级高并发场景。
2. **MCP 服务健壮性不足**：MCP Server (TypeScript) 目前只进行了极其基础的类型断言，缺乏如 `Zod` 等强类型校验库的防御性编程，不符合现代高要求协议的标准。
3. **缺乏开源标准工程化**：作为对标十万星级项目的开源底座，目前完全缺失单元测试（Jest / Pytest）、代码规范（ESLint / Flake8 / Prettier）以及 CI/CD 自动化测试工作流。

## 2. 目标与颠覆性创新 (Goals & Disruptive Innovations)
- **即插即用与工业级持久化的完美平衡 (Plug-and-Play & Enterprise Storage)**：
  我们将在底层引入 **Redis (RedisJSON + RediSearch + RedisVL)** 作为默认的工业级记忆引擎，支持 HNSW 向量索引与元数据混合检索。为了保持“颠覆性的即插即用体验”，我们将设计**无缝智能降级机制**：若用户环境未配置 Redis，系统将瞬间零感知降级为“高级内存索引模式”，使得极客小白和企业级集群都能获得最优体验。
- **MCP 服务的极致标准化 (Defensive MCP Architecture)**：
  深度集成 Zod 强类型校验和标准的错误状态机，让大模型调用工具时哪怕传入幻觉参数，也能得到带有明确修复建议的标准化错误反馈。
- **十万星级的开源工程化底座 (Top-Tier Open Source Engineering)**：
  全面补齐双语（TS/Python）单元测试、Lint 规范与 GitHub Actions 流水线，打造无可挑剔的代码质量壁垒。

---

## 3. 详细实施步骤 (Proposed Changes)

### 阶段一：底层存储架构的颠覆与重构 (Storage Architecture)
1. **抽象存储接口 (`StorageProvider`)**：
   - 提取通用的 `IStorageProvider` 接口，定义 `store`, `retrieve`, `update`, `delete` 等标准记忆方法。
2. **实现双轨检索引擎 (`RedisStorageProvider` & `MemoryStorageProvider`)**：
   - **Redis 引擎 (颠覆性)**：利用 DIALECT 2 和 HNSW 结构实现真正的长期记忆（Long-term）向量检索，利用 Redis 的 Hash/JSON 支持 Graph 层级的多跳关联存储。
   - **Memory 引擎 (即插即用)**：作为默认的 fallback 机制，保留现有的内存搜索并加以强化。
3. **改造 `AMPCore` 类**：
   - 引入动态适配器模式，初始化时探测存储环境，自动挂载合适的 Provider。

### 阶段二：MCP 服务的极致标准化 (MCP Server Enhancement)
1. **引入 Zod 强类型校验**：
   - 在 `mcp/index.ts` 中使用 `zod` 严格定义 `amp_store_memory` 和 `amp_retrieve_memory` 的入参 Schema。
2. **错误边界与优雅降级**：
   - 捕获异常，并以 MCP 规范的格式（`isError: true`）返回包含纠错引导的结构化文本。

### 阶段三：扩展程序的健壮性提升 (Extension Robustness)
1. **优化 Background 通信**：
   - 在 `extension/src/background.js` 中增加异常捕获和超时重试逻辑。
2. **增强 Popup 交互闭环**：
   - 在 `extension/src/popup.js` 增加持久化同步的状态机动画，让隐式捕获的数据可视化流转更加极客。

### 阶段四：全栈工程化底座 (Engineering & CI/CD)
1. **TypeScript 侧规范化 (`src`, `mcp`)**：
   - 安装并配置 `eslint`, `prettier`, `jest` 及 `ts-jest`。
   - 编写 `AMPCore` 的核心单元测试。
2. **Python 侧规范化 (`python`)**：
   - 安装并配置 `flake8`, `black`, `pytest`。
   - 编写 Python 版 `AMPCore` 的单元测试用例。
3. **CI/CD 工作流 (`.github/workflows/ci.yml`)**：
   - 创建自动化 GitHub Actions 脚本，在每次 Push 或 PR 时并行执行 TS 和 Python 的依赖安装、代码规范检查与单元测试。

---

## 4. 假设与决策 (Assumptions & Decisions)
- **架构决策**：`AMPCore` 对外暴露的 API 保持绝对的向后兼容，所有的复杂性（Redis 的连接池管理、向量索引的构建、内存降级）全被封装在底层的 Provider 中。
- **依赖决策**：在 TS 和 Python 中，Redis 客户端作为可选依赖（Optional Dependencies / `extras_require`），只有用户显式传入 Redis URL 时才会激活高性能模式。

## 5. 验证标准 (Verification Steps)
- 运行 `npm run lint` 无任何警告。
- 运行 `npm test` (Jest) 和 `pytest` 核心测试用例全部绿标通过。
- GitHub Actions 流水线能够成功触发并报告成功。
- MCP Server 启动后，故意发送非法的 JSON 参数，系统能够通过 Zod 返回精准的参数校验错误，而非直接崩溃。