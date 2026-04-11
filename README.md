# AMP (Agent Memory Protocol)

> **记忆是进化的本质** · Memory is the essence of evolution

[![npm version](https://img.shields.io/npm/v/amp.svg?style=flat-square)](https://www.npmjs.com/package/amp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E=18-green?style=flat-square)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-3.8+-orange?style=flat-square)](https://python.org)
[![Build Status](https://img.shields.io/github/actions/workflow/status/ai-nurmamat/AMP/ci.yml?style=flat-square)](.github/workflows/ci.yml)
[![Stars](https://img.shields.io/github/stars/ai-nurmamat/AMP?style=flat-square)](https://github.com/ai-nurmamat/AMP/stargazers)
[![Forks](https://img.shields.io/github/forks/ai-nurmamat/AMP?style=flat-square)](https://github.com/ai-nurmamat/AMP/network)

**AMP (Agent Memory Protocol)** — 完全自主研发的大模型时代 AI Agent 记忆管理引擎。首创**跨生态共享机制**与**图向量双轨检索架构**，让每一个 AI Agent 都能拥有跨越会话、跨越设备、跨越平台的永恒记忆。

[English](./README.md) · [中文](./README.md)

---

## 🎯 项目目标

**5万星 ⭐** — 成为 AI Agent 记忆管理领域的标准协议

---

## 🧬 核心哲学

在现有的 AI 交互模式中，每一次对话框的关闭，都意味着一个智能体生命周期的终结。无论你在上一次对话中与 AI 产生了多么深刻的共鸣，下一次开启时，它依然是一张白纸。

**AMP 的诞生正是为了终结这种"记忆孤岛"。** 我们认为：

> 没有记忆的 AI 永远只是工具，拥有记忆的 AI 才能进化为伙伴。

通过多维度的记忆折叠以及自主换页机制，AMP 让 AI 能够像人类一样，在交互中学习、在遗忘中提炼、在岁月中进化。

---

## 🌟 核心特性

### 🔄 跨生态记忆共享
- **浏览器插件** (`extension/`)：Manifest V3，原生捕获用户高亮、搜索偏好、阅读行为
- **MCP 协议** (`mcp/`)：Model Context Protocol 标准实现，无缝接入 Claude Desktop / Cursor / 任意 MCP 客户端
- **多语言 SDK**：TypeScript (Node.js)、Python 全平台覆盖，API 完全一致

### 🏗️ 三层记忆架构 (Memory Tier)

```
┌─────────────────────────────────────────────────────┐
│                  AMP Memory System                   │
├─────────────┬──────────────────┬────────────────────┤
│   WORKING   │    LONG_TERM      │       GRAPH        │
│  (工作记忆)  │    (长期记忆)      │      (图谱记忆)      │
│             │                  │                    │
│ Scratchpad  │ Redis + Vector   │  Neo4j / 关系推理   │
│ 高频读写     │ 深度语义检索       │   多跳逻辑推理       │
│ 毫秒级响应   │ 持久化存储         │   实体关系网络       │
└─────────────┴──────────────────┴────────────────────┘
```

### 🧠 LLM 原生自治
- 完美适配 OpenAI / Claude Function Calling
- `getMemoryTools()` 暴露自研工具 Schema
- 模型自主管理记忆生命周期：自主"换入换出"，打破 Context Window 限制

### 📉 艾宾浩斯遗忘曲线
- `importance` + `lastAccessedAt` 双驱动
- 高频唤醒 → 权重固化
- 低价值信息 → 自然衰减降级

---

## 🏛️ 架构图

```
                                    ┌──────────────────┐
                                    │   AI Agent       │
                                    │  (任意大模型)     │
                                    └────────┬─────────┘
                                             │ Function Calling
                                             │ getMemoryTools()
                                    ┌────────▼─────────┐
                                    │   AMP Core       │
                                    │  ┌────────────┐  │
                                    │  │ MemoryTier │  │
                                    │  │ WORKING    │  │
                                    │  │ LONG_TERM  │  │
                                    │  │ GRAPH      │  │
                                    │  └────────────┘  │
                                    └────────┬─────────┘
                                             │
                         ┌───────────────────┼───────────────────┐
                         │                   │                    │
              ┌──────────▼──────┐  ┌────────▼──────┐  ┌────────▼──────┐
              │ MemoryProvider  │  │RedisProvider │  │ GraphProvider │
              │  (内存模式)      │  │(工业级模式)   │  │  (图谱模式)    │
              └─────────────────┘  └───────────────┘  └───────────────┘
```

---

## 📦 安装

### TypeScript / Node.js

```bash
# 方式一：从 GitHub 直接安装（推荐）
npm install github:ai-nurmamat/AMP

# 方式二：克隆源码
git clone https://github.com/ai-nurmamat/AMP.git
cd AMP
npm install
npm run build
```

### Python

```bash
# 从源码安装
git clone https://github.com/ai-nurmamat/AMP.git
cd AMP/python
pip install -e .
```

---

## 🐳 Docker 快速部署 (Redis)

AMP 依赖 Redis 和 RediSearch/RedisJSON 模块。你可以使用提供的 `docker-compose.yml` 快速启动一个兼容的环境：

```bash
# 启动包含 RedisJSON & RediSearch 的 Redis 实例
docker-compose up -d
```

### TypeScript / Node.js

```typescript
import { AMPCore, MemoryTier, MemoryScope, MemoryMetadata } from 'agent-memory-protocol';

// 初始化 — 自动降级（Redis → 内存）
const amp = new AMPCore({ redisUrl: 'redis://localhost:6379' });

// 存储一条长期记忆
await amp.store({
  tier: MemoryTier.LONG_TERM,
  scope: { userId: 'global-user' },
  content: '用户偏好使用 TypeScript 编写高并发服务端代码。',
  metadata: { importance: 0.9, tags: ['tech', 'preference'] }
});

// 获取 LLM 工具链
const tools = amp.getMemoryTools();

// 检索记忆
const results = await amp.retrieve({
  query: 'TypeScript 偏好',
  limit: 5
});

// 更新记忆
await amp.update(results[0].id, {
  content: '用户偏好使用 TypeScript 编写高并发服务端代码，最近开始学习 Rust。',
  metadata: { importance: 0.95 }
});

// 删除记忆
await amp.delete(results[0].id);
```

### Python

```python
import asyncio
from amp import AMPCore, MemoryEvent, MemoryTier, MemoryScope, MemoryMetadata

async def main():
    amp_core = AMPCore()

    await amp_core.store(MemoryEvent(
        tier=MemoryTier.WORKING,
        scope=MemoryScope(user_id="global-user"),
        content="正在开发一个颠覆性的 AI 记忆协议。",
        metadata=MemoryMetadata(importance=0.95, tags=["project", "AI"])
    ))

    tools = amp_core.get_memory_tools()
    print(f"LLM 工具数: {len(tools)}")

    results = await amp_core.retrieve(MemoryQuery(query="AI 记忆协议"))
    for r in results:
        print(f"  [{r.score:.2f}] {r.content[:60]}...")

asyncio.run(main())
```

### MCP (Model Context Protocol)

```bash
# 启动 MCP 服务器
node mcp/index.ts
```

然后在 Claude Desktop 或 Cursor 中配置：

```json
{
  "mcpServers": {
    "amp": {
      "command": "node",
      "args": ["/path/to/mcp/index.js"]
    }
  }
}
```

### Chrome 浏览器插件

```bash
# 加载插件
# 1. 打开 chrome://extensions/
# 2. 开启"开发者模式"
# 3. 点击"加载已解压的扩展程序"
# 4. 选择 extension/ 目录
```

---

## 📁 项目结构

```
AMP/
├── README.md              # 本文件
├── LICENSE                # MIT License
├── package.json           # npm 包配置
├── tsconfig.json          # TypeScript 配置
├── jest.config.js         # Jest 测试配置
│
├── src/                   # TypeScript 核心源码
│   ├── index.ts           # AMPCore 主入口
│   ├── storage.ts         # 存储引擎 (Memory / Redis)
│   ├── types.ts           # 类型定义
│   └── __tests__/         # 单元测试
│
├── dist/                  # 编译产物 (npm 发布用)
│
├── mcp/                   # Model Context Protocol 实现
│   └── index.ts           # MCP 服务器入口
│
├── extension/              # Chrome 浏览器插件
│   ├── manifest.json       # Manifest V3 配置
│   ├── popup.html          # 记忆可视化面板
│   └── src/
│       ├── background.js   # Service Worker
│       ├── content.js     # 内容脚本 (隐式捕获)
│       └── popup.js       # 面板逻辑
│
├── python/                 # Python 实现
│   ├── amp/
│   │   └── __init__.py    # 核心实现
│   ├── tests/
│   │   └── test_amp.py    # 单元测试
│   └── setup.py            # PyPI 发布配置
│
└── .github/
    └── workflows/
        └── ci.yml          # GitHub Actions CI
```

---

## 🔌 API 概览

### MemoryTier (记忆层级)

| Tier | 说明 | 适用场景 |
|------|------|---------|
| `WORKING` | 工作记忆 (Scratchpad) | 短期、高频读写 |
| `LONG_TERM` | 长期记忆 (向量检索) | 持久化、语义搜索 |
| `GRAPH` | 图谱记忆 (关系推理) | 复杂逻辑、多跳推理 |

### 核心方法

| 方法 | 说明 |
|------|------|
| `amp.store(event)` | 存储记忆事件 |
| `amp.retrieve(query)` | 检索相关记忆 |
| `amp.update(id, updates)` | 更新记忆 |
| `amp.delete(id)` | 删除记忆 |
| `amp.getSize()` | 获取记忆总数 |
| `amp.getMemoryTools()` | 获取 LLM Function Calling Schema |

---

## 🧪 测试

```bash
# Node.js 测试
npm test

# Python 测试
cd python && pytest tests/
```

---

## 🌐 相关项目

| 项目 | 描述 | Stars |
|------|------|-------|
| [tradememory-protocol](https://github.com/mnemox-ai/tradememory-protocol) | 交易 Agent 记忆协议 | 502 |
| [LightAgent](https://github.com/wanxingai/LightAgent) | 轻量级 Agent 框架 | 820 |
| [icarus-daedalus](https://github.com/esaradev/icarus-daedalus) | 通用 Agent 记忆 (50行) | 249 |
| [mcp-memory-libsql](https://github.com/spences10/mcp-memory-libsql) | libSQL 向量记忆 | 82 |

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

请阅读 [Pull Request 模板](./.github/PULL_REQUEST_TEMPLATE.md) 和 [Bug 报告模板](./.github/ISSUE_TEMPLATE/bug_report.md)。

---

## 📜 License

MIT License - 详见 [LICENSE](./LICENSE)

---

**⭐ 如果这个项目对你有帮助，请给我们一个星！**
