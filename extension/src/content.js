/**
 * AMP Content Script
 * 职责: 在用户浏览网页时，隐式捕获高价值行为（如高亮文本、停留时间），并发送给 Background
 */

let pageEntryTime = Date.now();

// 监听用户的文本高亮选中事件
document.addEventListener('mouseup', () => {
  const selection = window.getSelection().toString().trim();
  
  // 只有当用户选中了有意义的长句时，才视为隐式记忆的线索
  if (selection.length > 20 && selection.length < 500) {
    const dwellTime = Math.floor((Date.now() - pageEntryTime) / 1000);
    
    // 发送给 Background Service Worker
    chrome.runtime.sendMessage({
      type: 'STORE_IMPLICIT_MEMORY',
      payload: {
        action: 'highlight',
        text: selection,
        url: window.location.href,
        domain: window.location.hostname,
        dwellTime: dwellTime
      }
    });
  }
});
