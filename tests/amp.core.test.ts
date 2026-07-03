/**
 * AMP Core - Comprehensive Test Suite
 * Tests for AMPCore, MemoryStorageProvider, and all public APIs
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  AMPCore,
  MemoryTier
} from '../src/index.js';
import type {
  MemoryScope,
  MemoryMetadata,
  MemoryEvent,
  MemoryQuery,
  MemoryResult,
  MemoryRef,
  MemoryToolSchema,
} from '../src/types.js';

// ============================================================
// Test Helper Types
// ============================================================
function createTestMemory(overrides: Partial<MemoryEvent> = {}): MemoryEvent {
  return {
    tier: MemoryTier.WORKING,
    scope: { sessionId: 'test-session' },
    content: 'test memory content',
    metadata: { importance: 0.5, tags: ['test'], timestamp: Date.now(), ...overrides.metadata },
    ...overrides,
  };
}

// ============================================================
// Test Fix 1: 临时文件工具
// 用唯一的临时文件替代共享的 cwd/amp_memory.json，避免并行测试 / 重复运行互相污染。
// ============================================================
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

function makeTmpFile(prefix: string = 'core'): string {
  return path.join(
    os.tmpdir(),
    `amp_core_${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}.json`
  );
}

// ============================================================
// AMPCore Basic Functionality
// ============================================================
describe('AMPCore', () => {
  let amp: AMPCore;
  let tmpFile: string;

  beforeEach(() => {
    tmpFile = makeTmpFile('basic');
    amp = new AMPCore({ storagePath: tmpFile });
  });

  afterEach(() => {
    try { if (tmpFile && fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile); } catch { /* ignore */ }
  });

  // ---- Store ----
  describe('store()', () => {
    it('should store a memory event and return a MemoryRef', async () => {
      const mem = createTestMemory({ content: 'Hello, AMP!' });
      const ref = await amp.store(mem);

      expect(ref).toBeDefined();
      expect(ref.id).toBeDefined();
      expect(typeof ref.id).toBe('string');
      expect(ref.tier).toBe(MemoryTier.WORKING);
      expect(ref.created_at).toBeGreaterThan(0);
      expect(ref.updated_at).toBeGreaterThan(0);
    });

    it('should store memory with all three tiers', async () => {
      const tiers = [MemoryTier.WORKING, MemoryTier.LONG_TERM, MemoryTier.GRAPH];

      for (const tier of tiers) {
        const ref = await amp.store(createTestMemory({ tier }));
        expect(ref.tier).toBe(tier);
      }
    });

    it('should auto-generate UUID if id is not provided', async () => {
      const ref = await amp.store(createTestMemory());
      expect(ref.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it('should store with custom metadata', async () => {
      const mem = createTestMemory({
        metadata: {
          importance: 0.95,
          tags: ['important', 'user-preference'],
          timestamp: Date.now(),
        },
      });
      const ref = await amp.store(mem);
      expect(ref.tier).toBe(MemoryTier.WORKING);
    });

    it('should store multiple memories independently', async () => {
      const ref1 = await amp.store(createTestMemory({ content: 'Memory 1' }));
      const ref2 = await amp.store(createTestMemory({ content: 'Memory 2' }));
      const ref3 = await amp.store(createTestMemory({ content: 'Memory 3' }));

      expect(ref1.id).not.toBe(ref2.id);
      expect(ref2.id).not.toBe(ref3.id);
      expect(ref3.id).not.toBe(ref1.id);
    });

    // Fix 5: 显式 id 冲突应抛错而非静默覆盖。
    it('should throw on duplicate explicit id', async () => {
      const mem = createTestMemory({ id: 'fixed-id-123', content: 'first' });
      await amp.store(mem);
      await expect(amp.store(createTestMemory({ id: 'fixed-id-123', content: 'second' })))
        .rejects.toThrow(/already exists/);
    });
  });

  // ---- Retrieve ----
  describe('retrieve()', () => {
    it('should retrieve stored memory by exact content match', async () => {
      await amp.store(createTestMemory({ content: 'Unique content 12345' }));

      const results = await amp.retrieve({ query: 'Unique content 12345' });
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].content).toContain('Unique content 12345');
    });

    it('should retrieve by partial keyword match', async () => {
      await amp.store(createTestMemory({ content: 'JavaScript is awesome' }));

      const results = await amp.retrieve({ query: 'JavaScript' });
      expect(results.length).toBeGreaterThan(0);
    });

    it('should retrieve by multiple keyword matches (AND logic)', async () => {
      await amp.store(
        createTestMemory({ content: 'TypeScript and Python are great' })
      );

      const results = await amp.retrieve({ query: 'TypeScript Python' });
      expect(results.length).toBeGreaterThan(0);
    });

    it('should return empty array when no match found', async () => {
      const results = await amp.retrieve({ query: 'NonExistentXYZ123456' });
      expect(results).toEqual([]);
    });

    it('should filter by tier when specified', async () => {
      await amp.store(createTestMemory({ tier: MemoryTier.WORKING, content: 'Working memory' }));
      await amp.store(createTestMemory({ tier: MemoryTier.LONG_TERM, content: 'Long term memory' }));

      const results = await amp.retrieve({ query: 'memory', tier: MemoryTier.LONG_TERM });
      expect(results.every((r) => r.tier === MemoryTier.LONG_TERM)).toBe(true);
    });

    it('should filter by tags', async () => {
      await amp.store(createTestMemory({ metadata: { tags: ['python', 'ai'] } }));
      await amp.store(createTestMemory({ metadata: { tags: ['javascript'] } }));

      const results = await amp.retrieve({ query: 'test', tags: ['python'] });
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].metadata.tags).toContain('python');
    });

    it('should filter by minimum importance', async () => {
      await amp.store(createTestMemory({ metadata: { importance: 0.3 } }));
      await amp.store(createTestMemory({ metadata: { importance: 0.8 } }));

      const results = await amp.retrieve({ query: 'test', minImportance: 0.7 });
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].metadata.importance).toBeGreaterThanOrEqual(0.7);
    });

    // Fix 3: minImportance: 0 是合法边界值，不应被当作 falsy 跳过过滤。
    it('should treat minImportance: 0 as a valid boundary filter', async () => {
      await amp.store(createTestMemory({ content: 'zero importance', metadata: { importance: 0 } }));
      await amp.store(createTestMemory({ content: 'high importance', metadata: { importance: 0.9 } }));

      // minImportance: 0 应当过滤掉所有 importance < 0 的（即不过滤任何东西，因为最小就是 0），
      // 关键是不应被 `if (query.minImportance && ...)` 的 falsy 判断误判为“未设置”。
      const results = await amp.retrieve({ query: 'importance', minImportance: 0 });
      expect(results.length).toBe(2);
    });

    it('should limit results with limit parameter', async () => {
      for (let i = 0; i < 20; i++) {
        await amp.store(createTestMemory({ content: `Memory number ${i}` }));
      }

      const results = await amp.retrieve({ query: 'Memory', limit: 5 });
      expect(results.length).toBeLessThanOrEqual(5);
    });

    it('should sort results by score then importance', async () => {
      await amp.store(createTestMemory({ content: 'Common word', metadata: { importance: 0.3 } }));
      await amp.store(createTestMemory({ content: 'Common word exact', metadata: { importance: 0.9 } }));

      const results = await amp.retrieve({ query: 'Common word exact' });
      expect(results[0].metadata.importance).toBeGreaterThanOrEqual(results[1]?.metadata.importance ?? 0);
    });

    it('should update lastAccessedAt on retrieve', async () => {
      const before = Date.now() - 10000;
      await amp.store(createTestMemory({ metadata: { lastAccessedAt: before } }));

      const results = await amp.retrieve({ query: 'test' });
      expect(results[0].metadata.lastAccessedAt).toBeGreaterThanOrEqual(before);
    });

    // Fix 2: 返回结果应是深拷贝，调用方修改不应污染存储层。
    it('should return deep-copied metadata that does not pollute storage', async () => {
      const ref = await amp.store(createTestMemory({ content: 'pollution guard' }));
      const results = await amp.retrieve({ query: 'pollution' });
      expect(results.length).toBeGreaterThan(0);
      // 调用方篡改返回结果的 metadata。
      results[0].metadata.importance = 999;
      results[0].content = 'tampered';
      // 再次检索，存储层应未受影响。
      const results2 = await amp.retrieve({ query: 'pollution' });
      expect(results2[0].metadata.importance).not.toBe(999);
      expect(results2[0].content).toBe('pollution guard');
    });

    // Feature A: accessCount 应在每次命中检索时递增。
    it('should increment accessCount on retrieve hits', async () => {
      await amp.store(createTestMemory({ content: 'access counter memory' }));
      await amp.retrieve({ query: 'access counter' });
      const results = await amp.retrieve({ query: 'access counter' });
      expect(results[0].metadata.accessCount).toBeGreaterThanOrEqual(2);
    });
  });

  // ---- Update ----
  describe('update()', () => {
    it('should update memory content', async () => {
      const ref = await amp.store(createTestMemory({ content: 'Original content' }));
      const updated = await amp.update(ref.id, { content: 'Updated content' });

      expect(updated).not.toBeNull();
      expect(updated!.content).toBeUndefined(); // content is not in MemoryRef

      const results = await amp.retrieve({ query: 'Updated content' });
      expect(results.length).toBeGreaterThan(0);
    });

    it('should update memory tier', async () => {
      const ref = await amp.store(createTestMemory({ tier: MemoryTier.WORKING }));
      const updated = await amp.update(ref.id, { tier: MemoryTier.LONG_TERM });

      expect(updated).not.toBeNull();
      expect(updated!.tier).toBe(MemoryTier.LONG_TERM);
    });

    it('should update metadata partially', async () => {
      const ref = await amp.store(
        createTestMemory({ metadata: { importance: 0.5, tags: ['old'] } })
      );
      await amp.update(ref.id, { metadata: { importance: 0.9 } });

      const results = await amp.retrieve({ query: 'test' });
      expect(results[0].metadata.importance).toBe(0.9);
      // tags should still be there
      expect(results[0].metadata.tags).toContain('old');
    });

    it('should return null for non-existent id', async () => {
      const result = await amp.update('non-existent-id', { content: 'new' });
      expect(result).toBeNull();
    });

    it('should update created_at to preserve original time', async () => {
      const ref = await amp.store(createTestMemory());
      const before = ref.created_at;

      await new Promise((r) => setTimeout(r, 10));
      const updated = await amp.update(ref.id, { content: 'Updated' });

      expect(updated!.created_at).toBe(before);
    });
  });

  // ---- Delete ----
  describe('delete()', () => {
    it('should delete an existing memory', async () => {
      const ref = await amp.store(createTestMemory({ content: 'To be deleted' }));
      const deleted = await amp.delete(ref.id);

      expect(deleted).toBe(true);
    });

    it('should return false for non-existent id', async () => {
      const result = await amp.delete('non-existent-id');
      expect(result).toBe(false);
    });

    it('should remove memory from retrieve results after deletion', async () => {
      const ref = await amp.store(createTestMemory({ content: 'Will be gone' }));
      await amp.delete(ref.id);

      const results = await amp.retrieve({ query: 'Will be gone' });
      expect(results.length).toBe(0);
    });
  });

  // ---- getSize ----
  describe('getSize()', () => {
    it('should return current memory count', async () => {
      const initialSize = await amp.getSize();
      await amp.store(createTestMemory());
      await amp.store(createTestMemory());

      const newSize = await amp.getSize();
      expect(newSize).toBe(initialSize + 2);
    });

    it('should reflect deletions', async () => {
      const ref1 = await amp.store(createTestMemory());
      const ref2 = await amp.store(createTestMemory());

      const sizeBefore = await amp.getSize();
      await amp.delete(ref1.id);
      const sizeAfter = await amp.getSize();

      expect(sizeAfter).toBe(sizeBefore - 1);
    });
  });

  // ---- getMemoryTools ----
  describe('getMemoryTools()', () => {
    it('should return at least 2 tools', () => {
      const tools = amp.getMemoryTools();
      expect(tools.length).toBeGreaterThanOrEqual(2);
    });

    it('should return valid Function Calling schemas', () => {
      const tools = amp.getMemoryTools();

      for (const tool of tools) {
        expect(tool.name).toBeDefined();
        expect(tool.description).toBeDefined();
        expect(tool.parameters).toBeDefined();
        expect(tool.parameters.type).toBe('object');
        expect(tool.parameters.properties).toBeDefined();
      }
    });

    it('should include amp_store_memory tool', () => {
      const tools = amp.getMemoryTools();
      const storeTool = tools.find((t) => t.name === 'amp_store_memory');

      expect(storeTool).toBeDefined();
      expect(storeTool!.parameters.required).toContain('content');
      expect(storeTool!.parameters.required).toContain('tier');
    });

    it('should include amp_retrieve_memory tool', () => {
      const tools = amp.getMemoryTools();
      const retrieveTool = tools.find((t) => t.name === 'amp_retrieve_memory');

      expect(retrieveTool).toBeDefined();
      expect(retrieveTool!.parameters.required).toContain('query');
    });
  });
});

// ============================================================
// Memory Scope Isolation
// Test Fix 2: 之前的断言 `results.length >= 2` 实际验证的是“非隔离”。
// Fix 4 实现真正的 scope 过滤后，这些用例改为断言“仅返回匹配 scope 的记忆”。
// ============================================================
describe('Memory Scope Isolation', () => {
  let amp: AMPCore;
  let tmpFile: string;

  beforeEach(() => {
    tmpFile = makeTmpFile('scope');
    amp = new AMPCore({ storagePath: tmpFile });
  });

  afterEach(() => {
    try { if (tmpFile && fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile); } catch { /* ignore */ }
  });

  it('should isolate memories by userId', async () => {
    await amp.store({ tier: MemoryTier.WORKING, scope: { userId: 'alice' }, content: 'alice memory' });
    await amp.store({ tier: MemoryTier.WORKING, scope: { userId: 'bob' }, content: 'bob memory' });

    const aliceResults = await amp.retrieve({ query: 'memory', scope: { userId: 'alice' } });
    expect(aliceResults.length).toBe(1);
    expect(aliceResults[0].content).toBe('alice memory');

    const bobResults = await amp.retrieve({ query: 'memory', scope: { userId: 'bob' } });
    expect(bobResults.length).toBe(1);
    expect(bobResults[0].content).toBe('bob memory');
  });

  it('should isolate memories by sessionId', async () => {
    await amp.store({ tier: MemoryTier.WORKING, scope: { sessionId: 'session-1' }, content: 'session one memory' });
    await amp.store({ tier: MemoryTier.WORKING, scope: { sessionId: 'session-2' }, content: 'session two memory' });

    const s1Results = await amp.retrieve({ query: 'session', scope: { sessionId: 'session-1' } });
    expect(s1Results.length).toBe(1);
    expect(s1Results[0].content).toBe('session one memory');

    const s2Results = await amp.retrieve({ query: 'session', scope: { sessionId: 'session-2' } });
    expect(s2Results.length).toBe(1);
    expect(s2Results[0].content).toBe('session two memory');
  });

  it('should isolate memories by agentId', async () => {
    await amp.store({ tier: MemoryTier.WORKING, scope: { agentId: 'agent-alpha' }, content: 'alpha agent memory' });
    await amp.store({ tier: MemoryTier.WORKING, scope: { agentId: 'agent-beta' }, content: 'beta agent memory' });

    const alphaResults = await amp.retrieve({ query: 'agent', scope: { agentId: 'agent-alpha' } });
    expect(alphaResults.length).toBe(1);
    expect(alphaResults[0].content).toBe('alpha agent memory');

    const betaResults = await amp.retrieve({ query: 'agent', scope: { agentId: 'agent-beta' } });
    expect(betaResults.length).toBe(1);
    expect(betaResults[0].content).toBe('beta agent memory');
  });

  it('should support compound scopes', async () => {
    await amp.store(
      createTestMemory({
        scope: { userId: 'u1', sessionId: 's1', agentId: 'a1' },
        content: 'Compound scope memory',
      })
    );

    // 不指定 scope 时应能检索到（不应用隔离过滤）。
    const results = await amp.retrieve({ query: 'Compound scope' });
    expect(results.length).toBeGreaterThan(0);

    // 指定完全匹配的复合 scope 时也应能检索到。
    const scopedResults = await amp.retrieve({
      query: 'Compound scope',
      scope: { userId: 'u1', sessionId: 's1', agentId: 'a1' },
    });
    expect(scopedResults.length).toBe(1);
    expect(scopedResults[0].content).toBe('Compound scope memory');

    // 任一维度不匹配时，应被过滤掉。
    const mismatchResults = await amp.retrieve({
      query: 'Compound scope',
      scope: { userId: 'someone-else' },
    });
    expect(mismatchResults.length).toBe(0);
  });
});

// ============================================================
// Memory Tier Behavior
// ============================================================
describe('Memory Tier Behavior', () => {
  let amp: AMPCore;
  let tmpFile: string;

  beforeEach(() => {
    tmpFile = makeTmpFile('tier');
    amp = new AMPCore({ storagePath: tmpFile });
  });

  afterEach(() => {
    try { if (tmpFile && fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile); } catch { /* ignore */ }
  });

  it('should store and retrieve WORKING tier', async () => {
    await amp.store(createTestMemory({ tier: MemoryTier.WORKING, content: 'Working tier' }));
    const results = await amp.retrieve({ query: 'Working', tier: MemoryTier.WORKING });
    expect(results.some((r) => r.tier === MemoryTier.WORKING)).toBe(true);
  });

  it('should store and retrieve LONG_TERM tier', async () => {
    await amp.store(createTestMemory({ tier: MemoryTier.LONG_TERM, content: 'Long term tier' }));
    const results = await amp.retrieve({ query: 'Long term', tier: MemoryTier.LONG_TERM });
    expect(results.some((r) => r.tier === MemoryTier.LONG_TERM)).toBe(true);
  });

  it('should store and retrieve GRAPH tier', async () => {
    await amp.store(createTestMemory({ tier: MemoryTier.GRAPH, content: 'Graph tier' }));
    const results = await amp.retrieve({ query: 'Graph', tier: MemoryTier.GRAPH });
    expect(results.some((r) => r.tier === MemoryTier.GRAPH)).toBe(true);
  });
});

// ============================================================
// Edge Cases
// ============================================================
describe('Edge Cases', () => {
  let amp: AMPCore;
  let tmpFile: string;

  beforeEach(() => {
    tmpFile = makeTmpFile('edge');
    amp = new AMPCore({ storagePath: tmpFile });
  });

  afterEach(() => {
    try { if (tmpFile && fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile); } catch { /* ignore */ }
  });

  it('should handle empty content gracefully', async () => {
    const ref = await amp.store(createTestMemory({ content: '' }));
    expect(ref.id).toBeDefined();
  });

  it('should handle very long content', async () => {
    const longContent = 'x'.repeat(100000);
    const ref = await amp.store(createTestMemory({ content: longContent }));
    expect(ref.id).toBeDefined();
  });

  it('should handle unicode content', async () => {
    const ref = await amp.store(
      createTestMemory({ content: '中文内容 🎉 emoji 🚀 + special chars: éàü' })
    );
    const results = await amp.retrieve({ query: '中文' });
    expect(results.length).toBeGreaterThan(0);
  });

  it('should handle many tags', async () => {
    const manyTags = Array.from({ length: 50 }, (_, i) => `tag-${i}`);
    const ref = await amp.store(createTestMemory({ metadata: { tags: manyTags } }));
    expect(ref.id).toBeDefined();
  });

  it('should handle query with only whitespace', async () => {
    const ref = await amp.store(createTestMemory({ content: 'Content with meaning' }));
    const results = await amp.retrieve({ query: '   ' });
    // Should return 0 because no keyword matches
    expect(results.length).toBe(0);
  });

  it('should handle importance boundary values (0 and 1)', async () => {
    await amp.store(createTestMemory({ metadata: { importance: 0 } }));
    await amp.store(createTestMemory({ metadata: { importance: 1 } }));

    const size = await amp.getSize();
    expect(size).toBeGreaterThanOrEqual(2);
  });
});

// ============================================================
// Concurrent Operations
// ============================================================
describe('Concurrent Operations', () => {
  let tmpFiles: string[] = [];

  beforeEach(() => {
    tmpFiles = [];
  });

  afterEach(() => {
    for (const f of tmpFiles) {
      try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch { /* ignore */ }
    }
  });

  it('should handle concurrent store operations', async () => {
    const file = makeTmpFile('concstore');
    tmpFiles.push(file);
    const amp = new AMPCore({ storagePath: file });
    const promises = Array.from({ length: 50 }, (_, i) =>
      amp.store(createTestMemory({ content: `Concurrent memory ${i}` }))
    );

    const refs = await Promise.all(promises);
    expect(refs.length).toBe(50);
    expect(new Set(refs.map((r) => r.id)).size).toBe(50); // all unique
  });

  it('should handle concurrent retrieve operations', async () => {
    const file = makeTmpFile('concretv');
    tmpFiles.push(file);
    const amp = new AMPCore({ storagePath: file });
    await amp.store(createTestMemory({ content: 'Shared content' }));

    const promises = Array.from({ length: 20 }, () => amp.retrieve({ query: 'Shared' }));
    const results = await Promise.all(promises);

    for (const result of results) {
      expect(result.length).toBeGreaterThan(0);
    }
  });
});

// ============================================================
// Feature D: Encryption (at-rest, AES-256-GCM)
// ============================================================
describe('FileStorageProvider encryption', () => {
  let tmpFile: string;

  beforeEach(() => {
    tmpFile = makeTmpFile('enc');
  });

  afterEach(() => {
    try { if (tmpFile && fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile); } catch { /* ignore */ }
  });

  it('should encrypt the file at rest and still round-trip data', async () => {
    // 32-byte key in hex (64 chars).
    const key = '0'.repeat(64);
    const amp = new AMPCore({ storagePath: tmpFile, encryptionKey: key });
    await amp.store({ tier: MemoryTier.LONG_TERM, scope: { userId: 'enc' }, content: 'secret memory' });

    // 文件落盘后不应是明文 JSON。
    const raw = fs.readFileSync(tmpFile, 'utf-8');
    expect(raw).not.toContain('secret memory');
    expect(raw.split(':').length).toBe(3); // iv:authTag:ciphertext

    // 用相同密钥重新构造 AMPCore，应能解密并检索。
    const amp2 = new AMPCore({ storagePath: tmpFile, encryptionKey: key });
    const results = await amp2.retrieve({ query: 'secret' });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].content).toBe('secret memory');
  });

  it('should reject an invalid encryption key length', () => {
    expect(() => new AMPCore({ storagePath: tmpFile, encryptionKey: 'too-short' }))
      .toThrow(/32 bytes/);
  });
});
