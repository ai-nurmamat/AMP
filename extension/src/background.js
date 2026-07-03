/**
 * AMP Background Service Worker
 * 职责: 监听浏览器级事件，与云端/本地 AMP Core 进行数据同步。
 */

const MCP_URL = 'http://localhost:3000/memory';

// Feature B: periodically capture frequent search-engine queries via chrome.history
chrome.alarms.create('captureSearches', { periodInMinutes: 30 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'captureSearches') {
    captureFrequentSearches().catch(err => {
      console.warn('[AMP] Frequent search capture failed:', err);
    });
  }
});

// 监听内容脚本发来的隐式记忆片段
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'STORE_IMPLICIT_MEMORY') {
    handleImplicitMemory(request.payload, sender.tab)
      .then(() => sendResponse({ status: 'success' }))
      .catch(err => sendResponse({ status: 'error', message: err.message }));
    return true; // 表示将异步发送响应
  }

  // Feature A: reading preferences (dwell time + scroll depth) from content.js
  if (request.type === 'READING_PREFERENCE') {
    handleReadingPreference(request)
      .then(() => sendResponse({ status: 'success' }))
      .catch(err => sendResponse({ status: 'error', message: err.message }));
    return true;
  }

  if (request.type === 'FORCE_SYNC') {
    // 强制同步的逻辑：可以构造一条特殊的记录或只检查连通性
    forceSyncToMcp()
      .then(() => sendResponse({ status: 'success' }))
      .catch(err => sendResponse({ status: 'error', message: err.message }));
    return true;
  }
});

// Fix 13: read auth token from chrome.storage; refuse to sync if unset
async function getAuthToken() {
  const { mcpAuthToken } = await chrome.storage.local.get('mcpAuthToken');
  if (!mcpAuthToken) {
    console.warn('[AMP] No MCP auth token configured; skipping sync. Set it in extension popup.');
    return null;
  }
  return mcpAuthToken;
}

// Shared helper: send a memory event to the MCP server (skips if no token configured)
async function sendToMcp(memoryEvent) {
  const token = await getAuthToken();
  if (!token) return;  // skip sync instead of sending an invalid token

  try {
    const response = await fetch(MCP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
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
}

async function forceSyncToMcp() {
  const token = await getAuthToken();
  if (!token) return;  // Fix 13: skip sync when no token configured

  // Fix 12: 'short_term' is not a valid MemoryTier; use 'long_term' for persisted sync events
  const pingEvent = {
    tier: 'long_term',
    scope: { userId: 'global-user' },
    content: `[Manual Sync] 用户手动触发了与 MCP 服务器的同步。`,
    metadata: {
      importance: 1.0,
      tags: ['system', 'manual-sync'],
      timestamp: Date.now()
    }
  };

  const response = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
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
        // Feature C: dynamic importance based on content length, dwell time, scroll depth
        importance: calculateImportance(payload.text, payload.dwellTime, payload.scrollDepth),
        tags: ['web-browsing', payload.domain],
        timestamp: Date.now()
      }
    };

    console.log('[AMP] 同步隐式记忆至核心库:', memoryEvent);

    // Update local count for popup display
    const { implicitMemoryCount = 0 } = await chrome.storage.local.get(['implicitMemoryCount']);
    await chrome.storage.local.set({ implicitMemoryCount: implicitMemoryCount + 1 });

    await sendToMcp(memoryEvent);
  } catch (error) {
    console.error('[AMP] Background Sync Error:', error);
    throw error;
  }
}

// Feature A: store reading preferences when user dwells and scrolls deeply on a page
async function handleReadingPreference(request) {
  const memoryEvent = {
    tier: 'long_term',
    scope: { userId: 'global-user' },
    content: `用户在 [${request.domain}](${request.url}) 阅读了 ${Math.round(request.dwellTime)}s，滚动深度 ${Math.round(request.scrollDepth)}%`,
    metadata: {
      importance: calculateImportance('', request.dwellTime, request.scrollDepth),
      tags: ['reading-preference', request.domain],
      timestamp: Date.now()
    }
  };

  console.log('[AMP] 同步阅读偏好:', memoryEvent);

  // Update local count for popup display
  const { implicitMemoryCount = 0 } = await chrome.storage.local.get(['implicitMemoryCount']);
  await chrome.storage.local.set({ implicitMemoryCount: implicitMemoryCount + 1 });

  await sendToMcp(memoryEvent);
}

// Feature B: detect frequent search-engine queries from chrome.history
async function captureFrequentSearches() {
  const since = Date.now() - 30 * 60 * 1000;
  const items = await chrome.history.search({ text: '', startTime: since, maxResults: 100 });

  const searchEngines = [
    { pattern: /google\.[a-z.]+\/search.*[?&]q=([^&]+)/i, host: 'google' },
    { pattern: /bing\.com\/search.*[?&]q=([^&]+)/i, host: 'bing' },
    { pattern: /duckduckgo\.com\/.*[?&]q=([^&]+)/i, host: 'ddg' },
    { pattern: /baidu\.com\/s.*[?&]wd=([^&]+)/i, host: 'baidu' },
  ];

  const counts = {};
  for (const item of items) {
    for (const engine of searchEngines) {
      const m = item.url.match(engine.pattern);
      if (m) {
        const term = decodeURIComponent(m[1]).toLowerCase().trim();
        if (term.length > 2) counts[term] = (counts[term] || 0) + 1;
      }
    }
  }

  for (const [term, count] of Object.entries(counts)) {
    if (count >= 2) {
      // Store as memory via MCP
      await sendToMcp({
        content: `User frequently searched for: ${term}`,
        tier: 'long_term',
        metadata: { importance: 0.7, tags: ['search', 'preference'] }
      });
    }
  }
}

// Feature C: dynamic importance based on content length, dwell time, scroll depth
function calculateImportance(text, dwellTime = 0, scrollDepth = 0) {
  let importance = 0.3;  // base
  if (text && text.length > 100) importance += 0.2;
  if (text && text.length > 300) importance += 0.1;
  if (dwellTime > 60) importance += 0.2;
  else if (dwellTime > 30) importance += 0.1;
  if (scrollDepth > 75) importance += 0.2;
  return Math.min(1.0, importance);
}
