# AMP (Agent Memory Protocol)

> **Memory is the essence of evolution.**

[![npm version](https://img.shields.io/npm/v/agent-memory-protocol.svg?style=flat-square)](https://www.npmjs.com/package/agent-memory-protocol)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E=18-green?style=flat-square)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-3.8+-orange?style=flat-square)](https://python.org)
[![Build Status](https://img.shields.io/github/actions/workflow/status/ai-nurmamat/AMP/ci.yml?style=flat-square)](.github/workflows/ci.yml)
[![Stars](https://img.shields.io/github/stars/ai-nurmamat/AMP?style=flat-square)](https://github.com/ai-nurmamat/AMP/stargazers)
[![Forks](https://img.shields.io/github/forks/ai-nurmamat/AMP?style=flat-square)](https://github.com/ai-nurmamat/AMP/network)

AMP (Agent Memory Protocol) breaks data silos by giving every AI Agent a persistent, global memory hub. It introduces a revolutionary **cross-ecosystem shared memory mechanism** and a **hybrid Graph-Vector retrieval architecture**. 

[English](#english) | [中文说明](#中文说明)

---

<a id="english"></a>
## English Documentation

## 🌟 Breakthrough Innovations

AMP is more than just a key-value store; it's a "Memory OS" for the LLM era:

### 1. Cross-Application Sharing & Implicit Capture (The "Memory Hub" Extension)
Unlike traditional memory systems restricted to a single chat window (like ChatGPT or Cursor alone), AMP natively provides a **Chrome Browser Extension (`extension/`)**.
- **Invisible Data Collection**: The extension captures user highlights, reading preferences, and frequent searches in the background, transforming them into dynamically weighted memory fragments.
- **Global Interoperability**: Whether you are using a web LLM, a local terminal Agent (e.g. OpenClaw), or a code editor (e.g. Claude Code), they can all connect to the same AMP memory hub via the MCP (Model Context Protocol).

### 2. Autonomous LLM Paging (OS-level Memory Management)
Inspired by modern OS memory paging, we not only provide APIs but also expose `getMemoryTools()` directly formatted for OpenAI/Claude Function Calling.
- **Dynamic Paging**: The LLM can autonomously invoke tools to "page out" unimportant context to AMP's long-term memory and "page in" relevant background knowledge when needed, shattering physical Context Window limits.

### 3. Hybrid Graph-Vector Retrieval Architecture
Pure vector databases struggle with multi-hop logical reasoning.
- From day one, AMP aligns `working` (Scratchpad), `long_term` (Vector retrieval), and `graph` (Temporal graph memory) tiers in its `MemoryTier`. This paves the way for handling deep entity relationships (e.g., "A knows B, and B likes C").

### 4. Ebbinghaus Forgetting Curve & Dynamic Weighting
Every memory entering AMP carries an `importance` score and `lastAccessedAt` timestamp. Frequently accessed memories automatically gain weight, while low-value info decays over time (Memory Consolidation).

---

## 📦 Installation & Quick Start

### One-line Local Demo (Quick Start)

Run the full **memory write + semantic retrieval** flow with zero configuration! The system will automatically create a persistent `amp_memory.json` file for you.

```bash
git clone https://github.com/ai-nurmamat/AMP.git
cd AMP
npm install
npm run build
npm run demo
```

In the Demo terminal:
1. **Type anything** to permanently save your preferences (e.g., "I prefer dark themes for coding").
2. Type `? theme` to experience cross-Agent semantic retrieval.

---

## 🏗️ Architecture & Ecosystem Support

To satisfy both hardcore developers and full-scenario apps, AMP provides identical core implementations across multiple languages:

### 📦 1. TypeScript / Node.js Core (`/src`)
Best suited for frontend and browser ecosystems.
```typescript
import { AMPCore, MemoryTier } from 'agent-memory-protocol';

const amp = new AMPCore();
await amp.store({
  tier: MemoryTier.LONG_TERM,
  scope: { userId: 'global-user' },
  content: 'User prefers writing backend code in TypeScript.',
  metadata: { importance: 0.9, tags: ['tech', 'preference'] }
});
```

### 🐍 2. Python Core (`/python`)
Tailored for AI Native developers and data scientists. Perfectly integrated with Pydantic type validation.
```python
from amp import AMPCore, MemoryEvent, MemoryTier, MemoryScope, MemoryMetadata

amp_core = AMPCore()
await amp_core.store(MemoryEvent(
    tier=MemoryTier.WORKING,
    scope=MemoryScope(user_id="global-user"),
    content="Developing a disruptive AI memory protocol.",
    metadata=MemoryMetadata(importance=0.8, tags=["project"])
))

# Directly get LLM Tools to mount onto GPT-4 or Claude
tools = amp_core.get_memory_tools()
```

### 🔌 3. MCP Server & REST API
Run the global memory hub daemon:
```bash
npm run start
```
This single process mounts both standard **Model Context Protocol (MCP)** endpoints (for Cursor, Claude Code) and **HTTP REST APIs** (port 3000, for legacy Agents). They both share the identical underlying persistence layer!

---

## 🎯 Vision

The ultimate form of AMP is to become the **HTTP of the AI Era**.
Just as web pages fetch resources via HTTP, all future Agents will shake hands via **AMP** to synchronize human preferences and facts. Users will no longer need to repeat "who I am and what I need" to every new AI that appears.

## 📄 License

MIT License - Open Source for the AI Community.

---

<a id="中文说明"></a>
## 中文说明

> **记忆是进化的本质** · Memory is the essence of evolution

AMP (Agent Memory Protocol) — 完全自主研发的大模型时代 AI Agent 记忆管理引擎。首创**跨生态共享机制**与**图向量双轨检索架构**，打破信息孤岛，让每一个 AI Agent 都能拥有跨越会话、跨越设备、跨越平台的永恒记忆。

---

## 🌟 颠覆性创新点

AMP 不仅仅是一个简单的 K-V 数据库，它是大模型时代的“记忆操作系统”，具备以下核心特性：

### 1. 跨应用共享与隐式捕获 (The "Memory Hub" Extension)
传统的记忆系统受限于单一对话框（如单独的 ChatGPT 或 Cursor），而 AMP 提供原生的 **Chrome 浏览器插件 (`extension/`)** 支持。
- **无感记忆收集**：插件在后台隐式捕获用户高亮内容、阅读偏好及高频搜索，将其转化为动态权重的记忆碎片。
- **全局打通**：无论是网页版大模型、本地终端 Agent（如 OpenClaw），还是代码编辑器（如 Claude Code），都可以通过 MCP 协议或 REST API 接入同一个 AMP 记忆中枢，实现真正的记忆继承与共享。

### 2. OS 级的大模型记忆自治 (Autonomous LLM Paging)
借鉴现代操作系统的“内存分页机制”，我们不仅提供了 API，还直接暴露出适配 OpenAI/Claude 的 `getMemoryTools()` 函数。
- **动态换页**：大模型可以通过主动调用工具，在上下文溢出时自动将不重要的内容“换出”到 AMP 的长期记忆库，并在需要时“换入”关联的背景知识，彻底打破 Context Window 的物理限制。

### 3. 向量与图谱的双轨混合检索 (Hybrid Graph-Vector Architecture)
传统系统单纯依赖向量（Vector DB），难以处理多跳逻辑推理（Multi-hop Reasoning）。
- AMP 从设计之初就在 `MemoryTier` 中并列了 `working` (工作记忆)、`long_term` (向量检索) 和 `graph` (时序图谱记忆)。这为接入 Neo4j 等图数据库，处理“A认识B，且B喜欢C”这类深层实体关系铺平了道路。

### 4. 艾宾浩斯遗忘曲线与动态权重 (Dynamic Importance)
每一条进入 AMP 的记忆都自带 `importance`（重要性得分）和 `lastAccessedAt`（最后访问时间）。高频访问的记忆权重自动增加，低价值信息随时间自动降级（Memory Consolidation），确保检索效率永远保持在最巅峰。

---

## 📦 安装与快速体验

### 一行命令跑通本地体验 (Quick Start Demo)

无需任何数据库配置，克隆后直接跑通**记忆写入+智能检索**的全流程！系统将自动为你创建持久化文件 `amp_memory.json`，确保断电不丢失。

```bash
git clone https://github.com/ai-nurmamat/AMP.git
cd AMP
npm install
npm run build
npm run demo
```

在 Demo 终端中：
1. **直接打字输入**即可永久保存你的偏好（如：“我平时写代码最喜欢用深色主题”）。
2. 输入 `? 偏好` 即可体验跨 Agent 维度的语义检索引擎。

---

## 🏗️ 架构与生态支持

为了满足最极客的开发者和全场景应用，AMP 提供完全一致的多语言核心实现，并 **共用同一个底层存储架构**：

### 📦 1. TypeScript / Node.js 核心库 (`/src`)
最契合前端及浏览器生态的实现。
```typescript
import { AMPCore, MemoryTier } from 'agent-memory-protocol';

const amp = new AMPCore();
await amp.store({
  tier: MemoryTier.LONG_TERM,
  scope: { userId: 'global-user' },
  content: '用户偏好使用 TypeScript 编写高并发服务端代码。',
  metadata: { importance: 0.9, tags: ['tech', 'preference'] }
});
```

### 🐍 2. Python 核心库 (`/python`)
为 AI Native 开发者及数据科学家量身定制。完美集成 Pydantic 类型校验。
```python
from amp import AMPCore, MemoryEvent, MemoryTier, MemoryScope, MemoryMetadata

amp_core = AMPCore()
await amp_core.store(MemoryEvent(
    tier=MemoryTier.WORKING,
    scope=MemoryScope(user_id="global-user"),
    content="正在开发一个颠覆性的 AI 记忆协议。",
    metadata=MemoryMetadata(importance=0.8, tags=["project"])
))

# 直接获取 LLM Tools，挂载给 GPT-4 或 Claude
tools = amp_core.get_memory_tools()
```

### 🔌 3. MCP 记忆中枢与 REST API 
启动全局记忆守护进程：
```bash
npm run start
```
该进程将同时提供 **MCP (Model Context Protocol)** 协议接口（供 Claude Code / Cursor 直接读取）以及暴露在 3000 端口的 **HTTP REST API**（供其它 Agent 如 OpenClaw 写入）。它们都在底层读写相同的 `amp_memory.json` / Redis 数据库！

---

## 🎯 发展愿景

AMP 的最终形态是成为 **AI 时代的 HTTP**。
就像网页通过 HTTP 获取资源一样，未来的所有智能体（Agents）都将通过 **AMP** 握手，同步人类的偏好与事实，让用户不再需要向每一个新出现的 AI 重复解释“我是谁，我需要什么”。

## 📄 许可证

MIT License - Open Source for the AI Community.