/**
 * SQLiteStorageProvider 烟雾测试。
 * 验证 SQLite 后端：CRUD、scope 隔离、id 冲突、衰减重要性、tags 过滤。
 */
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { AMPCore, MemoryTier, SQLiteStorageProvider } from '../src/index.js';

describe('SQLiteStorageProvider', () => {
  let tmpFile: string;
  let amp: AMPCore;

  beforeAll(() => {
    tmpFile = path.join(os.tmpdir(), `amp_sqlite_${Date.now()}_${Math.random().toString(36).slice(2)}.sqlite`);
    const provider = new SQLiteStorageProvider({ dbPath: tmpFile });
    amp = new AMPCore({ provider });
  });

  afterAll(async () => {
    await amp.dispose();
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
  });

  it('should store and retrieve memory', async () => {
    await amp.store({
      tier: MemoryTier.LONG_TERM,
      scope: { userId: 'alice' },
      content: 'SQLite is awesome for structured memory',
      metadata: { importance: 0.9, tags: ['tech', 'storage'] },
    });
    const r = await amp.retrieve({ query: 'SQLite' });
    expect(r.length).toBeGreaterThanOrEqual(1);
    expect(r[0].content).toContain('SQLite');
  });

  it('should isolate memories by scope', async () => {
    await amp.store({ tier: MemoryTier.LONG_TERM, scope: { userId: 'alice' }, content: 'alice private memory' });
    await amp.store({ tier: MemoryTier.LONG_TERM, scope: { userId: 'bob' }, content: 'bob private memory' });

    const alice = await amp.retrieve({ query: 'memory', scope: { userId: 'alice' } });
    expect(alice.every(r => r.scope?.userId === 'alice')).toBe(true);
    expect(alice.some(r => r.content === 'alice private memory')).toBe(true);
    expect(alice.some(r => r.content === 'bob private memory')).toBe(false);

    const bob = await amp.retrieve({ query: 'memory', scope: { userId: 'bob' } });
    expect(bob.every(r => r.scope?.userId === 'bob')).toBe(true);
  });

  it('should reject duplicate id', async () => {
    await amp.store({ id: 'fixed-sqlite-id', tier: MemoryTier.WORKING, content: 'first' });
    await expect(
      amp.store({ id: 'fixed-sqlite-id', tier: MemoryTier.WORKING, content: 'second' })
    ).rejects.toThrow(/already exists/);
  });

  it('should filter by tags with AND semantics', async () => {
    await amp.store({ tier: MemoryTier.LONG_TERM, content: 'tagged memory a', metadata: { importance: 0.5, tags: ['alpha', 'beta'] } });
    await amp.store({ tier: MemoryTier.LONG_TERM, content: 'tagged memory b', metadata: { importance: 0.5, tags: ['alpha'] } });
    const r = await amp.retrieve({ query: 'tagged', tags: ['alpha', 'beta'] });
    expect(r.every(m => m.metadata.tags?.includes('alpha') && m.metadata.tags?.includes('beta'))).toBe(true);
  });

  it('should update memory', async () => {
    const ref = await amp.store({ tier: MemoryTier.WORKING, content: 'before update' });
    await amp.update(ref.id, { content: 'after update' });
    const r = await amp.retrieve({ query: 'after' });
    expect(r.some(m => m.id === ref.id && m.content === 'after update')).toBe(true);
  });

  it('should delete memory', async () => {
    const ref = await amp.store({ tier: MemoryTier.WORKING, content: 'to be deleted' });
    const ok = await amp.delete(ref.id);
    expect(ok).toBe(true);
    const r = await amp.retrieve({ query: 'to be deleted' });
    expect(r.some(m => m.id === ref.id)).toBe(false);
  });

  it('should respect minImportance=0 boundary', async () => {
    await amp.store({ tier: MemoryTier.LONG_TERM, content: 'zero importance boundary test', metadata: { importance: 0.0 } });
    const r = await amp.retrieve({ query: 'zero', minImportance: 0 });
    expect(r.some(m => m.content === 'zero importance boundary test')).toBe(true);
  });

  it('should report size', async () => {
    const size = await amp.getSize();
    expect(size).toBeGreaterThan(0);
  });
});
