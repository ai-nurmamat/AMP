// AMP Popup Script
document.addEventListener('DOMContentLoaded', async () => {
  const countEl = document.getElementById('memory-count');
  const syncBtn = document.getElementById('btn-sync');
  const tokenInput = document.getElementById('mcp-token');
  const canvas = document.getElementById('memoryChart');
  const ctx = canvas.getContext('2d');

  // 初始化 Canvas 尺寸
  function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
  }
  resizeCanvas();

  // 从 Storage 中读取数据
  const data = await chrome.storage.local.get(['implicitMemoryCount', 'mcpAuthToken']);
  let memoryCount = data.implicitMemoryCount || 0;
  countEl.textContent = memoryCount;
  
  if (data.mcpAuthToken) {
    tokenInput.value = data.mcpAuthToken;
  }

  // Canvas 高端动画图表渲染 (模拟内存活动波动)
  let points = [];
  const maxPoints = 40;
  for (let i = 0; i < maxPoints; i++) {
    points.push(Math.random() * 50 + 20);
  }

  let offset = 0;
  function drawChart() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 更新点位数据实现动画滚动
    if (offset % 5 === 0) {
      points.shift();
      // 根据 memoryCount 加入一点扰动
      const base = memoryCount > 0 ? 40 : 20;
      points.push(Math.random() * 40 + base);
    }
    offset++;

    const width = canvas.width;
    const height = canvas.height;
    const step = width / (maxPoints - 1);

    ctx.beginPath();
    ctx.moveTo(0, height);

    for (let i = 0; i < maxPoints; i++) {
      const x = i * step;
      const y = height - points[i];
      if (i === 0) ctx.lineTo(x, y);
      else {
        // 平滑曲线
        const prevX = (i - 1) * step;
        const prevY = height - points[i - 1];
        const cpX = prevX + step / 2;
        ctx.bezierCurveTo(cpX, prevY, cpX, y, x, y);
      }
    }

    ctx.lineTo(width, height);
    ctx.closePath();

    // 渐变填充
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(88, 166, 255, 0.4)');
    gradient.addColorStop(1, 'rgba(88, 166, 255, 0.0)');
    ctx.fillStyle = gradient;
    ctx.fill();

    // 绘制线
    ctx.beginPath();
    for (let i = 0; i < maxPoints; i++) {
      const x = i * step;
      const y = height - points[i];
      if (i === 0) ctx.moveTo(x, y);
      else {
        const prevX = (i - 1) * step;
        const prevY = height - points[i - 1];
        const cpX = prevX + step / 2;
        ctx.bezierCurveTo(cpX, prevY, cpX, y, x, y);
      }
    }
    ctx.strokeStyle = '#58a6ff';
    ctx.lineWidth = 2;
    ctx.stroke();

    requestAnimationFrame(drawChart);
  }
  
  drawChart();

  syncBtn.addEventListener('click', async () => {
    const token = tokenInput.value.trim();
    if (token) {
      await chrome.storage.local.set({ mcpAuthToken: token });
    }

    syncBtn.classList.add('syncing');
    syncBtn.innerHTML = '<span>Syncing to MCP...</span>';
    
    // Trigger force sync via background script
    chrome.runtime.sendMessage({ type: 'FORCE_SYNC' }, (response) => {
      const isSuccess = response && response.status === 'success';
      
      syncBtn.classList.remove('syncing');
      syncBtn.style.background = isSuccess ? '#2ea043' : '#da3633';
      syncBtn.innerHTML = `<span>${isSuccess ? 'Synced Successfully!' : 'Sync Failed'}</span>`;
      
      setTimeout(() => {
        syncBtn.style.background = '';
        syncBtn.innerHTML = '<span>Force Sync to MCP</span>';
      }, 2000);
    });
  });
});