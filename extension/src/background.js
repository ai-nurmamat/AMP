/**
 * AMP Background Service Worker
 * 职责: 监听浏览器级事件，与云端/本地 AMP Core 进行数据同步。
 */

// 监听内容脚本发来的隐式记忆片段 (如高亮、深度阅读的内容)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'STORE_IMPLICIT_MEMORY') {
    handleImplicitMemory(request.payload, sender.tab);
    sendResponse({ status: 'success' });
  }
});

async function handleImplicitMemory(payload, tab) {
  const memoryEvent = {
    tier: 'long_term',
    scope: { userId: 'global-user' }, // 插件形态下，绑定全局 User
    content: `用户在浏览 [${tab.title}](${tab.url}) 时，关注了以下内容: "${payload.text}"`,
    metadata: {
      importance: calculateImportance(payload), // 根据交互深度计算重要性
      tags: ['web-browsing', payload.domain],
      timestamp: Date.now()
    }
  };

  console.log('[AMP] 同步隐式记忆至核心库:', memoryEvent);
  // TODO: 通过 Fetch API 调用本地或云端的 AMP Server 接口
  // await fetch('http://localhost:8000/api/v1/memory', { ... })
}

function calculateImportance(payload) {
  // 颠覆性创新点：通过停留时间、选中次数等计算动态权重
  let score = 0.3; 
  if (payload.action === 'highlight') score += 0.4;
  if (payload.dwellTime > 60) score += 0.2;
  return Math.min(score, 1.0);
}
