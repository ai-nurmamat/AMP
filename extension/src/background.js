/**
 * AMP Background Service Worker
 * 职责: 监听浏览器级事件，与云端/本地 AMP Core 进行数据同步。
 */

// 监听内容脚本发来的隐式记忆片段
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'STORE_IMPLICIT_MEMORY') {
    handleImplicitMemory(request.payload, sender.tab)
      .then(() => sendResponse({ status: 'success' }))
      .catch(err => sendResponse({ status: 'error', message: err.message }));
    return true; // 表示将异步发送响应
  }
});

async function handleImplicitMemory(payload, tab) {
  try {
    const memoryEvent = {
      tier: 'long_term',
      scope: { userId: 'global-user' },
      content: `用户在浏览 [${tab?.title || payload.domain}](${payload.url}) 时，关注了以下内容: "${payload.text}"`,
      metadata: {
        importance: calculateImportance(payload),
        tags: ['web-browsing', payload.domain],
        timestamp: Date.now()
      }
    };

    console.log('[AMP] 同步隐式记忆至核心库:', memoryEvent);

    // 更新本地累计数量，供 Popup 展示
    const { implicitMemoryCount = 0 } = await chrome.storage.local.get(['implicitMemoryCount']);
    await chrome.storage.local.set({ implicitMemoryCount: implicitMemoryCount + 1 });

    // 颠覆性设计：未来此处应连接至用户的个人 MCP 服务器进行持久化同步
    // await fetch('http://localhost:8000/api/v1/memory', { ... })
  } catch (error) {
    console.error('[AMP] Background Sync Error:', error);
    throw error;
  }
}

function calculateImportance(payload) {
  let score = 0.3; 
  if (payload.action === 'highlight') score += 0.4;
  if (payload.dwellTime > 60) score += 0.2;
  return Math.min(score, 1.0);
}
