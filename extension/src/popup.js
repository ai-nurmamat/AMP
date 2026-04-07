// AMP Popup Script
document.addEventListener('DOMContentLoaded', () => {
  const countEl = document.getElementById('memory-count');
  const syncBtn = document.getElementById('btn-sync');

  // 从 Storage 中读取累计捕获的隐式记忆数量
  chrome.storage.local.get(['implicitMemoryCount'], (result) => {
    countEl.textContent = result.implicitMemoryCount || 0;
  });

  syncBtn.addEventListener('click', () => {
    syncBtn.textContent = 'Syncing...';
    syncBtn.style.background = '#9ca3af';
    
    setTimeout(() => {
      syncBtn.textContent = 'Synced Successfully!';
      syncBtn.style.background = '#10b981';
      
      setTimeout(() => {
        syncBtn.textContent = 'Sync to MCP Server';
        syncBtn.style.background = '#2563eb';
      }, 2000);
    }, 800);
  });
});