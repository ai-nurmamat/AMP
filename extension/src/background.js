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
  
  if (request.type === 'FORCE_SYNC') {
    // 强制同步的逻辑：可以构造一条特殊的记录或只检查连通性
    forceSyncToMcp()
      .then(() => sendResponse({ status: 'success' }))
      .catch(err => sendResponse({ status: 'error', message: err.message }));
    return true;
  }
});

async function forceSyncToMcp() {
  const mcpToken = await getMcpToken();
  const pingEvent = {
    tier: 'short_term',
    scope: { userId: 'global-user' },
    content: `[Manual Sync] 用户手动触发了与 MCP 服务器的同步。`,
    metadata: {
      importance: 1.0,
      tags: ['system', 'manual-sync'],
      timestamp: Date.now()
    }
  };

  const response = await fetch('http://localhost:3000/memory', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${mcpToken}`
    },
    body: JSON.stringify(pingEvent)
  });
  
  if (!response.ok) {
    throw new Error(`MCP Sync Failed: ${response.status}`);
  }
}

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

    // Update local count for popup display
    const { implicitMemoryCount = 0 } = await chrome.storage.local.get(['implicitMemoryCount']);
    await chrome.storage.local.set({ implicitMemoryCount: implicitMemoryCount + 1 });

    // Send memory to MCP Server (http://localhost:3000/memory) using Bearer token auth
    const mcpToken = await getMcpToken(); // Fetch from storage or use default
    
    try {
      const response = await fetch('http://localhost:3000/memory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mcpToken}`
        },
        body: JSON.stringify(memoryEvent)
      });
      
      if (!response.ok) {
        console.warn(`[AMP] MCP Server Sync Failed: ${response.status} ${response.statusText}`);
      } else {
        console.log('[AMP] Successfully synced memory to MCP Server');
      }
    } catch (networkError) {
      console.warn('[AMP] Could not connect to MCP Server:', networkError.message);
    }
  } catch (error) {
    console.error('[AMP] Background Sync Error:', error);
    throw error;
  }
}

async function getMcpToken() {
  const { mcpAuthToken } = await chrome.storage.local.get(['mcpAuthToken']);
  return mcpAuthToken || 'YOUR_DEFAULT_BEARER_TOKEN';
}

function calculateImportance(payload) {
  let score = 0.3; 
  if (payload.action === 'highlight') score += 0.4;
  if (payload.dwellTime > 60) score += 0.2;
  return Math.min(score, 1.0);
}
