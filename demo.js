#!/usr/bin/env node
import { AMPCore, MemoryTier } from './dist/index.js';
import * as readline from 'readline';

const amp = new AMPCore();
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const helpText = `
==============================================
🧠 AMP (Agent Memory Protocol) 极速体验终端
==============================================
命令列表：
  [写入] 随便输入任何句子，将自动存入记忆。
  [检索] ? <关键词>  (例如: ? 苹果)
  [数量] size
  [退出] exit / quit
==============================================
`;

console.log(helpText);

function ask() {
  rl.question('🤖 AMP > ', async (input) => {
    const text = input.trim();
    
    if (text === 'exit' || text === 'quit') {
      rl.close();
      return;
    }

    if (text === 'size') {
      const size = await amp.getSize();
      console.log(`\n📦 当前记忆库总条数: ${size}\n`);
      return ask();
    }

    if (text.startsWith('?')) {
      const query = text.substring(1).trim();
      if (!query) {
        console.log('\n❌ 请输入检索词，如: ? 苹果\n');
        return ask();
      }
      
      console.log(`\n🔍 正在检索: "${query}"...`);
      const results = await amp.retrieve({ query, limit: 3 });
      
      if (results.length === 0) {
        console.log('   (暂无相关记忆)\n');
      } else {
        results.forEach((r, i) => {
          console.log(`   [${i+1}] (匹配度 ${r.score.toFixed(2)}) ${r.content}`);
        });
        console.log('');
      }
    } else if (text) {
      // Store
      await amp.store({
        tier: MemoryTier.LONG_TERM,
        scope: { userId: "demo-user" },
        content: text
      });
      console.log('\n✅ 记忆已成功写入并持久化至 amp_memory.json!\n');
    }
    
    ask();
  });
}

ask();