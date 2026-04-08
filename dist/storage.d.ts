import { MemoryEvent, MemoryQuery, MemoryResult, MemoryRef } from './types';
export interface IStorageProvider {
    store(event: MemoryEvent): Promise<MemoryRef>;
    retrieve(query: MemoryQuery): Promise<MemoryResult[]>;
    update(id: string, updates: Partial<MemoryEvent>): Promise<MemoryRef | null>;
    delete(id: string): Promise<boolean>;
    getSize(): Promise<number>;
    connect?(): Promise<void>;
    disconnect?(): Promise<void>;
}
export declare class MemoryStorageProvider implements IStorageProvider {
    private storeMap;
    store(event: MemoryEvent): Promise<MemoryRef>;
    retrieve(query: MemoryQuery): Promise<MemoryResult[]>;
    update(id: string, updates: Partial<MemoryEvent>): Promise<MemoryRef | null>;
    delete(id: string): Promise<boolean>;
    getSize(): Promise<number>;
}
export declare class RedisStorageProvider implements IStorageProvider {
    private client;
    private prefix;
    constructor(redisUrl: string);
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    store(event: MemoryEvent): Promise<MemoryRef>;
    retrieve(query: MemoryQuery): Promise<MemoryResult[]>;
    update(id: string, updates: Partial<MemoryEvent>): Promise<MemoryRef | null>;
    delete(id: string): Promise<boolean>;
    getSize(): Promise<number>;
}
