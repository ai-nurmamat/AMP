"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const index_1 = require("../index");
(0, globals_1.describe)('AMPCore with MemoryStorageProvider', () => {
    let amp;
    (0, globals_1.beforeAll)(() => {
        amp = new index_1.AMPCore();
    });
    (0, globals_1.it)('should store a memory event', async () => {
        const mem = await amp.store({
            tier: index_1.MemoryTier.WORKING,
            scope: { sessionId: 's1' },
            content: 'The user loves apples',
        });
        (0, globals_1.expect)(mem.id).toBeDefined();
        (0, globals_1.expect)(mem.tier).toBe(index_1.MemoryTier.WORKING);
    });
    (0, globals_1.it)('should retrieve a memory event', async () => {
        await amp.store({
            tier: index_1.MemoryTier.WORKING,
            scope: { sessionId: 's1' },
            content: 'The user hates bananas',
        });
        const results = await amp.retrieve({ query: 'bananas' });
        (0, globals_1.expect)(results.length).toBeGreaterThan(0);
        (0, globals_1.expect)(results[0].content).toContain('hates bananas');
    });
    (0, globals_1.it)('should update a memory event', async () => {
        const mem = await amp.store({
            tier: index_1.MemoryTier.WORKING,
            scope: { sessionId: 's1' },
            content: 'Old content',
        });
        const updated = await amp.update(mem.id, { content: 'New content' });
        (0, globals_1.expect)(updated).not.toBeNull();
        const results = await amp.retrieve({ query: 'New content' });
        (0, globals_1.expect)(results.length).toBeGreaterThan(0);
        (0, globals_1.expect)(results[0].content).toBe('New content');
    });
    (0, globals_1.it)('should delete a memory event', async () => {
        const mem = await amp.store({
            tier: index_1.MemoryTier.WORKING,
            scope: { sessionId: 's1' },
            content: 'To be deleted',
        });
        const deleted = await amp.delete(mem.id);
        (0, globals_1.expect)(deleted).toBe(true);
        const size = await amp.getSize();
        (0, globals_1.expect)(typeof size).toBe('number');
    });
    (0, globals_1.it)('should return memory tools', () => {
        const tools = amp.getMemoryTools();
        (0, globals_1.expect)(tools.length).toBeGreaterThan(0);
        (0, globals_1.expect)(tools[0].name).toBe('amp_store_memory');
    });
});
(0, globals_1.describe)('AMPCore with RedisStorageProvider', () => {
    let amp;
    (0, globals_1.beforeAll)(async () => {
        amp = new index_1.AMPCore({ redisUrl: process.env.REDIS_URL || 'redis://localhost:6379' });
        // Wait for the async connect to complete
        await new Promise((resolve) => setTimeout(resolve, 1000));
    });
    (0, globals_1.it)('should store and retrieve in redis', async () => {
        const mem = await amp.store({
            tier: index_1.MemoryTier.LONG_TERM,
            scope: { userId: 'u1' },
            content: 'Redis test content async',
            metadata: { importance: 0.8, tags: ['test', 'redis'], timestamp: Date.now() },
        });
        (0, globals_1.expect)(mem.id).toBeDefined();
        // wait a bit for redis search indexing
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const results = await amp.retrieve({ query: 'async' });
        // If Redis is not available, it might fallback to Memory, which is also fine.
        // But we test the retrieval logic anyway.
        (0, globals_1.expect)(results.length).toBeGreaterThan(0);
        (0, globals_1.expect)(results[0].content).toContain('async');
        await amp.delete(mem.id);
    });
});
