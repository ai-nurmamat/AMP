import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { AMPCore, MemoryTier } from '../index.js';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

// Test Fix 1: 用唯一的临时文件替代默认的 cwd/amp_memory.json，
// 避免并行测试 / 重复运行之间互相污染。
function makeTmpFile(prefix: string): string {
  return path.join(
    os.tmpdir(),
    `amp_test_${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}.json`
  );
}

// Test Fix 3: 仅在 REDIS_URL 可用时运行 Redis 相关用例；否则逐条 skip，
// 而不是整块 describe.skip 把整个套件吃掉。
const REDIS_URL = process.env.REDIS_URL;
const itIfRedis = REDIS_URL ? it : it.skip;

describe('AMPCore with FileStorageProvider', () => {
  let amp: AMPCore;
  let tmpFile: string;

  beforeAll(() => {
    tmpFile = makeTmpFile('fs');
    amp = new AMPCore({ storagePath: tmpFile });
  });

  afterAll(() => {
    // Test Fix 1: 清理临时文件，避免 /tmp 堆积。
    try { if (tmpFile && fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile); } catch { /* ignore */ }
  });

  it('should store a memory event', async () => {
    const mem = await amp.store({
      tier: MemoryTier.WORKING,
      scope: { sessionId: 's1' },
      content: 'The user loves apples',
    });
    expect(mem.id).toBeDefined();
    expect(mem.tier).toBe(MemoryTier.WORKING);
  });

  it('should retrieve a memory event', async () => {
    await amp.store({
      tier: MemoryTier.WORKING,
      scope: { sessionId: 's1' },
      content: 'The user hates bananas',
    });

    const results = await amp.retrieve({ query: 'bananas' });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].content).toContain('hates bananas');
  });

  it('should update a memory event', async () => {
    const mem = await amp.store({
      tier: MemoryTier.WORKING,
      scope: { sessionId: 's1' },
      content: 'Old content',
    });

    const updated = await amp.update(mem.id, { content: 'New content' });
    expect(updated).not.toBeNull();

    const results = await amp.retrieve({ query: 'New content' });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].content).toBe('New content');
  });

  it('should delete a memory event', async () => {
    const mem = await amp.store({
      tier: MemoryTier.WORKING,
      scope: { sessionId: 's1' },
      content: 'To be deleted',
    });

    const deleted = await amp.delete(mem.id);
    expect(deleted).toBe(true);

    const size = await amp.getSize();
    expect(typeof size).toBe('number');
  });

  it('should return memory tools', () => {
    const tools = amp.getMemoryTools();
    expect(tools.length).toBeGreaterThan(0);
    expect(tools[0].name).toBe('amp_store_memory');
  });
});

// Test Fix 4: 验证审计日志在配置了 auditLogPath 后会被写入。
describe('AMPCore audit logging', () => {
  let amp: AMPCore;
  let tmpFile: string;
  let auditFile: string;

  beforeAll(() => {
    tmpFile = makeTmpFile('audit_store');
    auditFile = makeTmpFile('audit_log').replace('.json', '.audit.log');
    amp = new AMPCore({ storagePath: tmpFile, auditLogPath: auditFile });
  });

  afterAll(() => {
    try { if (tmpFile && fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile); } catch { /* ignore */ }
    try { if (auditFile && fs.existsSync(auditFile)) fs.unlinkSync(auditFile); } catch { /* ignore */ }
  });

  it('should write audit entries for store/retrieve/update/delete', async () => {
    const ref = await amp.store({
      tier: MemoryTier.WORKING,
      scope: { userId: 'audit-user' },
      content: 'audited memory',
    });
    await amp.retrieve({ query: 'audited' });
    await amp.update(ref.id, { content: 'audited memory updated' });
    await amp.delete(ref.id);

    // 等待 appendFileSync 落盘（同步写其实已落盘，但读前留一个 tick 更稳妥）。
    await new Promise((r) => setTimeout(r, 10));

    const logContent = fs.readFileSync(auditFile, 'utf-8');
    const lines = logContent.split('\n').filter((l) => l.trim().length > 0);
    const entries = lines.map((l) => JSON.parse(l));

    const actions = entries.map((e: { action: string }) => e.action);
    expect(actions).toContain('store');
    expect(actions).toContain('retrieve');
    expect(actions).toContain('update');
    expect(actions).toContain('delete');

    // store 条目应带上 userId（来自 event.scope）。
    const storeEntry = entries.find((e: { action: string }) => e.action === 'store');
    expect(storeEntry.userId).toBe('audit-user');
    expect(storeEntry.memoryId).toBe(ref.id);
  });
});

// Test Fix 3: 不再整块 describe.skip；改成 REDIS_URL 未设置时逐条 skip。
describe('AMPCore with RedisStorageProvider', () => {
  let amp: AMPCore;
  let connected = false;

  beforeAll(async () => {
    if (!REDIS_URL) return; // itIfRedis 会跳过所有用例，beforeAll 仍会执行
    amp = new AMPCore({ redisUrl: REDIS_URL });
    // Fix 6: AMPCore 现在支持 ensureReady()，确保用前已连接（或已降级）。
    await amp.ensureReady();
    connected = true;
  });

  afterAll(async () => {
    if (connected && amp) {
      // Fix 10: dispose() 显式关闭 Redis 连接。
      await amp.dispose();
    }
  });

  itIfRedis('should store and retrieve in redis', async () => {
    const mem = await amp.store({
      tier: MemoryTier.LONG_TERM,
      scope: { userId: 'u1' },
      content: 'Redis test content async',
      metadata: { importance: 0.8, tags: ['test', 'redis'], timestamp: Date.now() },
    });
    expect(mem.id).toBeDefined();

    // 等待 RediSearch 索引建立。
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const results = await amp.retrieve({ query: 'async' });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].content).toContain('async');

    await amp.delete(mem.id);
  });

  // 非 Redis 环境下验证降级逻辑：传一个无效 redisUrl，应自动回退到 FileStorageProvider。
  it('should gracefully fall back to FileStorageProvider when redis is unreachable', async () => {
    const fallbackFile = makeTmpFile('fallback');
    const badAmp = new AMPCore({ redisUrl: 'redis://127.0.0.1:1/0', storagePath: fallbackFile });
    // ensureReady 应在 Redis 连接失败后 resolve（而非一直 pending），
    // 并把 provider 降级为 FileStorageProvider，使后续操作可用。
    await badAmp.ensureReady();
    const ref = await badAmp.store({
      tier: MemoryTier.WORKING,
      scope: { sessionId: 'fallback' },
      content: 'fallback content',
    });
    expect(ref.id).toBeDefined();
    const results = await badAmp.retrieve({ query: 'fallback' });
    expect(results.length).toBeGreaterThan(0);
    await badAmp.dispose();
    try { if (fs.existsSync(fallbackFile)) fs.unlinkSync(fallbackFile); } catch { /* ignore */ }
  });
});
