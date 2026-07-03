/**
 * AMP Content Script
 * 职责: 在用户浏览网页时，隐式捕获高价值行为（如高亮文本、停留时间），并发送给 Background
 */

let pageEntryTime = Date.now();

// Feature A: track reading preferences (max scroll depth reached on this page)
let maxScrollDepth = 0;
window.addEventListener('scroll', () => {
  const scrollPercent = (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight * 100;
  maxScrollDepth = Math.max(maxScrollDepth, scrollPercent);
}, { passive: true });

// Feature A: send a reading_preference memory when user leaves a page if dwell & scroll thresholds met
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    const dwellTime = (Date.now() - pageEntryTime) / 1000;
    if (dwellTime > 30 && maxScrollDepth > 50) {
      chrome.runtime.sendMessage({
        type: 'READING_PREFERENCE',
        url: location.href,
        domain: location.hostname,
        dwellTime,
        scrollDepth: maxScrollDepth,
      }).catch(err => {
        console.warn('[AMP] Reading preference message failed:', err);
      });
    }
  }
});

// Fix 15: debounce text-selection capture so rapid selections don't flood the background
let lastCapture = 0;

// 监听用户的文本高亮选中事件
document.addEventListener('mouseup', () => {
  const now = Date.now();
  if (now - lastCapture < 1000) return;  // 1s debounce
  lastCapture = now;

  try {
    const selection = window.getSelection()?.toString().trim() || '';

    // 只有当用户选中了有意义的长句时，才视为隐式记忆的线索
    if (selection.length > 20 && selection.length < 500) {
      const dwellTime = Math.floor((Date.now() - pageEntryTime) / 1000);

      // 发送给 Background Service Worker，增加错误捕获
      chrome.runtime.sendMessage({
        type: 'STORE_IMPLICIT_MEMORY',
        payload: {
          action: 'highlight',
          text: selection,
          url: window.location.href,
          domain: window.location.hostname,
          dwellTime: dwellTime,
          scrollDepth: maxScrollDepth
        }
      }).catch(err => {
        console.warn('[AMP] Content script message failed:', err);
      });
    }
  } catch (error) {
    console.error('[AMP] Error in content script:', error);
  }
});
