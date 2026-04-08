import { describe, it, expect, beforeAll } from '@jest/globals';
import { AMPCore, MemoryTier } from '../index';

describe('AMPCore with MemoryStorageProvider', () => {
  let amp: AMPCore;

  beforeAll(() => {
    amp = new AMPCore();
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

describe('AMPCore with RedisStorageProvider', () => {
  let amp: AMPCore;

  beforeAll(async () => {
    amp = new AMPCore({ redisUrl: process.env.REDIS_URL || 'redis://localhost:6379' });
    // Wait for the async connect to complete
    await new Promise((resolve) => setTimeout(resolve, 1000));
  });

  it('should store and retrieve in redis', async () => {
    const mem = await amp.store({
      tier: MemoryTier.LONG_TERM,
      scope: { userId: 'u1' },
      content: 'Redis test content async',
      metadata: { importance: 0.8, tags: ['test', 'redis'], timestamp: Date.now() },
    });
    expect(mem.id).toBeDefined();

    // wait a bit for redis search indexing
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const results = await amp.retrieve({ query: 'async' });
    // If Redis is not available, it might fallback to Memory, which is also fine.
    // But we test the retrieval logic anyway.
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].content).toContain('async');
    
    await amp.delete(mem.id);
  });
});
