/**
 * SQLiteStorageProvider —— 基于本地 SQLite 的存储后端。
 *
 * 适用场景：当 FileStorageProvider 的「单文件全量重写」模式在大数据量下成为瓶颈时，
 * 切换到 SQLite 可获得真正的索引/事务能力，避免每次 retrieve 都重写整个文件。
 *
 * 注意：本模块依赖 `sqlite` 与 `sqlite3` 两个原生包。若未安装，导入会失败 ——
 * 这是预期行为，因为 SQLite 是可选后端。未使用 SQLite 时，主入口 src/index.ts
 * 不会导入本模块，因此不会影响默认的 File/Redis 路径。
 */
import { Database } from 'sqlite';
import sqlite3 from 'sqlite3';
import * as crypto from 'crypto';
import * as path from 'path';
import { MemoryEvent, MemoryQuery, MemoryResult, MemoryRef, MemoryScope, MemoryTier } from './types.js';
import { IStorageProvider } from './storage.js';

export interface SQLiteStorageProviderOptions {
  /** SQLite 数据库文件路径。`:memory:` 表示内存数据库（测试用）。 */
  dbPath?: string;
}

interface MemoryRow {
  id: string;
  content: string;
  tier: string;
  scope: string | null;
  metadata: string;
  created_at: number;
  updated_at: number;
}

export class SQLiteStorageProvider implements IStorageProvider {
  private dbPath: string;
  private db: Database | null = null;

  constructor(options: SQLiteStorageProviderOptions | string = {}) {
    if (typeof options === 'string') {
      this.dbPath = options;
    } else {
      this.dbPath = options.dbPath ?? path.join(process.cwd(), 'amp_memory.sqlite');
    }
  }

  async connect(): Promise<void> {
    if (this.db) return;
    const db = new Database({ filename: this.dbPath, driver: sqlite3.Database });
    await db.open();
    this.db = db;
    await db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        tier TEXT NOT NULL,
        scope TEXT,
        metadata TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_memories_tier ON memories(tier);
      CREATE INDEX IF NOT EXISTS idx_memories_user_id ON memories(json_extract(scope, '$.userId'));
      CREATE INDEX IF NOT EXISTS idx_memories_session_id ON memories(json_extract(scope, '$.sessionId'));
      CREATE INDEX IF NOT EXISTS idx_memories_agent_id ON memories(json_extract(scope, '$.agentId'));
    `);
  }

  private async ensureConnected(): Promise<Database> {
    if (!this.db) await this.connect();
    if (!this.db) throw new Error('[AMP] SQLite database failed to initialize');
    return this.db;
  }

  async disconnect(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }

  /**
   * Feature A: 艾宾浩斯遗忘曲线 / 动态重要性（与 File/Redis provider 实现一致）。
   */
  private computeDecayedImportance(record: MemoryResult, now: number): number {
    const halfLifeDays = 30;
    const lastAccess = record.metadata.lastAccessedAt ?? record.metadata.timestamp ?? now;
    const daysSinceAccess = Math.max(0, (now - lastAccess) / (1000 * 60 * 60 * 24));
    const accessBoost = Math.min(0.3, (record.metadata.accessCount ?? 0) * 0.05);
    const decayed = record.metadata.importance * Math.pow(0.5, daysSinceAccess / halfLifeDays) + accessBoost;
    return Math.max(0, Math.min(1, decayed));
  }

  async store(event: MemoryEvent): Promise<MemoryRef> {
    const db = await this.ensureConnected();
    const id = event.id || crypto.randomUUID();

    // Fix 5: 显式 id 冲突检测。
    if (event.id) {
      const existing = await db.get('SELECT id FROM memories WHERE id = ?', id);
      if (existing) {
        throw new Error(`Memory with id ${id} already exists; use update() to modify`);
      }
    }

    const now = Date.now();
    // Fix 1: 先展开用户 metadata，再用服务端权威字段覆盖。
    const metadata = {
      ...event.metadata,
      importance: event.metadata?.importance ?? 0.5,
      tags: event.metadata?.tags || [],
      timestamp: now,
      lastAccessedAt: now,
      accessCount: 0,
    };

    await db.run(
      `INSERT INTO memories (id, content, tier, scope, metadata, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      id,
      event.content,
      event.tier,
      JSON.stringify(event.scope ?? {}),
      JSON.stringify(metadata),
      now,
      now,
    );

    return { id, tier: event.tier, created_at: now, updated_at: now };
  }

  async retrieve(query: MemoryQuery): Promise<MemoryResult[]> {
    const db = await this.ensureConnected();
    const conditions: string[] = [];
    const params: any[] = [];

    if (query.tier) {
      conditions.push('tier = ?');
      params.push(query.tier);
    }
    // Fix 3: 使用 != null 兼容 minImportance: 0。
    if (query.minImportance != null) {
      conditions.push("json_extract(metadata, '$.importance') >= ?");
      params.push(query.minImportance);
    }
    if (query.query) {
      conditions.push('content LIKE ?');
      params.push(`%${query.query}%`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    // 拉取一批候选（含 accessCount 用于衰减计算），上限放大到 limit*5 以便排序后仍有足够结果。
    const limit = Math.min(query.limit || 10, 1000);
    const rows = (await db.all<MemoryRow[]>(
      `SELECT * FROM memories ${where} ORDER BY json_extract(metadata, '$.importance') DESC LIMIT ?`,
      ...params,
      limit * 5,
    )) as MemoryRow[];

    const results: MemoryResult[] = [];
    const now = Date.now();

    for (const row of rows) {
      const scope: MemoryScope = row.scope ? JSON.parse(row.scope) : {};
      // Fix 4: 作用域隔离，逻辑与 File/Redis provider 完全一致。
      if (query.scope) {
        if (query.scope.userId !== undefined && scope.userId !== query.scope.userId) continue;
        if (query.scope.sessionId !== undefined && scope.sessionId !== query.scope.sessionId) continue;
        if (query.scope.agentId !== undefined && scope.agentId !== query.scope.agentId) continue;
      }

      const metadata = JSON.parse(row.metadata);
      // Fix 2: 通过深拷贝构造返回值，避免调用方修改污染内部对象。
      const record: MemoryResult = {
        id: row.id,
        content: row.content,
        tier: row.tier as MemoryTier,
        scope,
        metadata: { ...metadata },
        score: 1.0,
      };

      // tags AND 过滤（与 FileStorageProvider 保持一致）。
      if (query.tags && query.tags.length > 0) {
        if (!query.tags.every(t => metadata.tags?.includes(t))) continue;
      }

      // score 计算（与其它 provider 一致：子串匹配 + 分词命中率）。
      let score = 1.0;
      if (query.query) {
        if (record.content.includes(query.query)) {
          score = 1.0;
        } else {
          const words = query.query.split(' ').filter(w => w.trim().length > 0);
          if (words.length > 0) {
            const matchCount = words.filter(w => record.content.includes(w)).length;
            score = matchCount / words.length;
          }
        }
      }
      if (score <= 0) continue;

      // Feature A: accessCount 累计 + 衰减后重要性参与排序。
      const accessCount = (metadata.accessCount ?? 0) + 1;
      const decayedImportance = this.computeDecayedImportance(record, now);

      // 异步回写访问时间与计数（不阻塞返回）。
      db.run(
        `UPDATE memories SET metadata = json_set(metadata, '$.lastAccessedAt', ?, '$.accessCount', ?), updated_at = ? WHERE id = ?`,
        now,
        accessCount,
        now,
        row.id,
      ).catch(() => { /* 永不阻断检索路径 */ });

      record.metadata.lastAccessedAt = now;
      record.metadata.accessCount = accessCount;
      record.score = score;
      (record as MemoryResult & { _decayedImportance?: number })._decayedImportance = decayedImportance;
      results.push(record);
    }

    results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const ai = (a as MemoryResult & { _decayedImportance?: number })._decayedImportance ?? a.metadata.importance;
      const bi = (b as MemoryResult & { _decayedImportance?: number })._decayedImportance ?? b.metadata.importance;
      return bi - ai;
    });

    // 清理运行时临时字段。
    for (const r of results) {
      delete (r as MemoryResult & { _decayedImportance?: number })._decayedImportance;
    }

    return results.slice(0, limit);
  }

  async update(id: string, updates: Partial<MemoryEvent>): Promise<MemoryRef | null> {
    const db = await this.ensureConnected();
    const row = await db.get<MemoryRow | undefined>('SELECT * FROM memories WHERE id = ?', id);
    if (!row) return null;

    const now = Date.now();
    let content = row.content;
    let tier = row.tier;
    let metadata = JSON.parse(row.metadata);

    if (updates.content !== undefined) content = updates.content;
    if (updates.tier !== undefined) tier = updates.tier;
    if (updates.metadata) {
      metadata = { ...metadata, ...updates.metadata };
    }
    metadata.updated_at = now;

    await db.run(
      `UPDATE memories SET content = ?, tier = ?, metadata = ?, updated_at = ? WHERE id = ?`,
      content,
      tier,
      JSON.stringify(metadata),
      now,
      id,
    );

    return { id, tier: tier as MemoryTier, created_at: row.created_at, updated_at: now };
  }

  async delete(id: string): Promise<boolean> {
    const db = await this.ensureConnected();
    const result = await db.run('DELETE FROM memories WHERE id = ?', id);
    return (result.changes ?? 0) > 0;
  }

  async getSize(): Promise<number> {
    const db = await this.ensureConnected();
    const row = await db.get<{ count: number }>('SELECT COUNT(*) AS count FROM memories');
    return row?.count ?? 0;
  }
}
