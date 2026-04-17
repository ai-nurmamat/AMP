# AMP (Agent Memory Protocol)

> **Memory is the essence of evolution.**

AMP (Agent Memory Protocol) breaks data silos by giving every AI Agent a persistent, global memory hub. It introduces a revolutionary **cross-ecosystem shared memory mechanism** and a **hybrid Graph-Vector retrieval architecture**. 

---

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