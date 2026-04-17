import { AMPCore } from './src/index';

async function main() {
  console.log('========================================');
  console.log('⚡ [Node.js / Claude Code MCP] 正在启动...');
  
  const amp = new AMPCore();
  
  console.log('⚡ [Node.js] 让我看看 NanoClaw 和 Hermes 在 Python 里聊了什么...');
  
  const results = await amp.retrieve({ query: '爵士乐', limit: 1 });
  
  if (results.length > 0) {
    console.log('\n⚡ [Node.js] 跨生态内存检索成功！读取到记录：');
    console.log(`   >>> "${results[0].content}"`);
    console.log('\n⚡ [Node.js] 证明了 TypeScript 环境完美继承了 Python 写入的持久化数据！');
  } else {
    console.log('\n⚡ [Node.js] 没有找到记忆。');
  }
  console.log('========================================');
}

main().catch(console.error);