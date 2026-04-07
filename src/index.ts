/**
 * AMP (Agent Memory Protocol) Core
 * 让每一个 AI Agent 都能拥有记忆
 */

export interface MemoryEvent {
  id: string;
  type: 'store' | 'retrieve' | 'update' | 'delete';
  content: string;
  metadata: {
    importance: number;
    tags: string[];
    timestamp: number;
  };
}

export interface MemoryRef {
  id: string;
  created_at: number;
  updated_at: number;
}

export interface Query {
  query: string;
  limit?: number;
  tags?: string[];
}

export interface MemoryResult {
  id: string;
  content: string;
  score: number;
  metadata: any;
}

export class AMPCore {
  private store: Map<string, MemoryEvent> = new Map();

  async store(event: MemoryEvent): Promise<MemoryRef> {
    const ref: MemoryRef = {
      id: event.id || crypto.randomUUID(),
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    this.store.set(ref.id, event);
    return ref;
  }

  async retrieve(query: Query): Promise<MemoryResult[]> {
    const results: MemoryResult[] = [];
    for (const [id, event] of this.store.entries()) {
      if (event.content.includes(query.query)) {
        results.push({
          id,
          content: event.content,
          score: 1.0,
          metadata: event.metadata,
        });
      }
    }
    return results.slice(0, query.limit || 10);
  }

  async delete(id: string): Promise<boolean> {
    return this.store.delete(id);
  }
}

export default AMPCore;
