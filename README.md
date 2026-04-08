# AMP (Agent Memory Protocol)

> **记忆是进化的本质** (Memory is the essence of evolution)
>
> 就像生物通过记忆环境规律获得生存优势，AI 智能体也需要记忆来打破“朝生暮死”的循环。
> **AMP (Agent Memory Protocol)** 是一款完全自主研发、颠覆行业的记忆管理引擎。我们首创了跨应用共享插件机制和图向量混合检索架构，致力于为所有 AI Agent 赋予永恒且全局的记忆中枢，成为 **AI 记忆管理领域的最顶级形态**。

---

## 🧬 核心哲学：记忆是进化的本质

在现有的 AI 交互模式中，每一次对话框的关闭，都意味着一个智能体生命周期的终结。无论你在上一次对话中与 AI 产生了多么深刻的共鸣，下一次开启时，它依然是一张白纸。
AMP 的诞生正是为了终结这种“记忆孤岛”。我们认为，**没有记忆的 AI 永远只是工具，拥有记忆的 AI 才能进化为伙伴**。通过跨设备的意图捕获、多维度的记忆折叠以及自主换页机制，AMP 让 AI 能够像人类一样，在交互中学习、在遗忘中提炼、在岁月中进化。

---

## 🌟 颠覆性原生创新

AMP 不仅仅是一个简单的 K-V 数据库或向量检索库，它是大模型时代的**“记忆操作系统”**，具备以下引领行业标准的原生核心特性：

### 1. 跨应用共享与隐式捕获 (The "Memory Hub" Extension)
传统的记忆系统受限于单一对话框（如单独的 ChatGPT 或 Cursor），而 AMP 提供了原生的 **Chrome 浏览器插件 (`extension/`)** 支持，将记忆的触角延伸至用户数字生活的每一个角落。
- **无感记忆收集 (Implicit Capture)**：插件（基于 Manifest V3）在后台通过 `content.js` 隐式捕获用户高亮内容、阅读偏好及高频搜索行为，将其转化为携带动态权重的记忆碎片，并可在 `popup.html` 实时可视化全局意图的演变轨迹。
- **全局打通 (MCP 革命)**：借助最新引入的 **Model Context Protocol (MCP)** 服务（位于 `mcp/` 目录），无论是网页版大模型、本地终端 Agent，还是代码编辑器（如 Cursor / Claude Desktop），都能无缝接入同一个 AMP 记忆中枢，实现真正的跨设备、跨生态上下文共享。

### 2. OS 级的大模型记忆自治 (Autonomous LLM Paging)
我们摒弃了“由人类硬编码规则喂给 AI 记忆”的传统模式，在业界首创了类操作系统的“内存分页机制”，并直接暴露出自研的、完美适配 OpenAI/Claude Function Calling 的 `getMemoryTools()` 接口。
- **动态换页 (Dynamic Paging)**：大模型获得了对自己记忆的完全控制权。在面临 Context Window 上下文溢出时，模型可以自主调用工具，将低优信息“换出 (Store)”至 AMP 的长期记忆库，并在需要时精准“换入 (Retrieve)”关联的背景知识，彻底打破物理内存限制。

### 3. 向量与图谱的双轨混合检索 (Hybrid Graph-Vector Architecture)
传统系统单纯依赖向量（Vector DB），难以处理多跳逻辑推理（Multi-hop Reasoning）和深层实体关系。
- AMP 从设计之初就在 `MemoryTier` 中构建了三层立体的折叠架构：
  - `working` (工作记忆)：面向短期、高频读写的 Scratchpad。
  - `long_term` (长期记忆)：支持 Redis 全文与向量持久化的冷数据检索层。
  - `graph` (图谱记忆)：面向复杂逻辑和实体关系的时序图谱层。这为接入 Neo4j 等图数据库，处理“A认识B，且B喜欢C”这类深层推理铺平了道路。

### 4. 艾宾浩斯遗忘曲线与动态权重 (Dynamic Importance & Consolidation)
进化的另一个法则是“遗忘无用之物，提炼生存智慧”。
- 每一条进入 AMP 的记忆都自带 `importance`（重要性得分）和 `lastAccessedAt`（最后访问时间戳）。
- 伴随用户的持续交互，高频唤醒的记忆其权重会自动攀升并被固化；而低价值的冗余信息则会遵循艾宾浩斯遗忘曲线随时间自然衰减降级（Memory Consolidation），确保检索效率与上下文的纯净度永远保持在巅峰状态。

---

## 🏗️ 架构与多语言生态支持

为了满足最极客的开发者和覆盖全场景的 AI 应用，AMP 提供了高度一致的多语言核心实现：

### 📦 1. TypeScript / Node.js 核心库 (`/src`)
最契合前端及浏览器生态的实现，支持纯内存及 Redis 工业级引擎的平滑降级。
```typescript
import { AMPCore, MemoryTier } from 'amp';

const amp = new AMPCore({ redisUrl: 'redis://localhost:6379' });

// 存储一条影响深远的长期记忆
await amp.store({
  tier: MemoryTier.LONG_TERM,
  scope: { userId: 'global-user' },
  content: '用户偏好使用 TypeScript 编写高并发服务端代码。',
  metadata: { importance: 0.9, tags: ['tech', 'preference'] }
});

// 提取大模型工具链
const tools = amp.getMemoryTools();
```

### 🐍 2. Python 核心库 (`/python`)
为 AI Native 开发者及数据科学家量身定制。完美集成 Pydantic 类型强校验，且已通过 `setup.py` 标准化打包，可直接发布至 PyPI。支持 `asyncio` 异步高并发。
```python
import asyncio
from amp import AMPCore, MemoryEvent, MemoryTier, MemoryScope, MemoryMetadata

async def main():
    amp_core = AMPCore()
    await amp_core.store(MemoryEvent(
        tier=MemoryTier.WORKING,
        scope=MemoryScope(user_id="global-user"),
        content="正在开发一个颠覆性的 AI 记忆协议，记忆是进化的本质。",
        metadata=MemoryMetadata(importance=0.95, tags=["project", "philosophy"])
    ))

    # 直接获取 LLM Tools，挂载给 GPT-4 或 Claude
    tools = amp_core.get_memory_tools()

asyncio.run(main())
```

### 🌐 3. MCP 记忆服务器 (`/mcp`)
颠覆性特性！基于 Anthropic 的 Model Context Protocol (MCP) 标准，让所有兼容 MCP 的客户端（如 Claude Desktop）直接连通 AMP 的全局记忆网络。
- 启动服务器：`node mcp/index.ts`
- 即可在 IDE 或 AI 助手中直接呼出 `amp_store_memory` 与 `amp_retrieve_memory` 专属工具。

### 🧩 4. Chrome 浏览器插件锚点 (`/extension`)
无需编写一行代码即可部署的全局记忆收集器。
- `content.js` 负责拦截 DOM 事件并自动提取交互意图（停留、高亮）。
- `background.js` 中的隐式记忆处理引擎负责计算动态权重。
- `popup.html` 提供精美的可视化面板，展示记忆增长曲线。

---

## 🎯 发展愿景

AMP 的最终形态是成为 **AI 时代的 HTTP**。
就像今天所有的浏览器都通过 HTTP 协议获取网页资源一样，未来成千上万的智能体（Agents）都将通过 **AMP** 协议握手。它们将无缝同步人类的偏好、事实与历史，让用户不再需要向每一个新诞生的 AI 重复解释“我是谁，我需要什么”。

**记忆是进化的本质，而 AMP，正是推动 AI 完成下一次进化的基石。**

---

## 📄 许可证

MIT License - Open Source for the AI Community.
