# AMP (Agent Memory Protocol)

> 让每一个 AI Agent 都能拥有记忆

## 核心功能

- 长期记忆存储
- 跨会话持久化
- 智能记忆检索
- 多 Agent 记忆共享

## 快速开始

```typescript
import { AMPCore } from 'amp-protocol';

const amp = new AMPCore();

// 存储记忆
await amp.store({
  id: crypto.randomUUID(),
  type: 'store',
  content: '用户偏好使用 TypeScript',
  metadata: { importance: 0.9, tags: ['tech'], timestamp: Date.now() }
});

// 检索记忆
const results = await amp.retrieve({ query: 'TypeScript', limit: 10 });
```

## 许可证

MIT
