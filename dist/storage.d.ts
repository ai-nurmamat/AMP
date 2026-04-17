import { MemoryEvent, MemoryQuery, MemoryResult, MemoryRef } from './types.js';
export interface IStorageProvider {
    store(event: MemoryEvent): Promise<MemoryRef>;
    retrieve(query: MemoryQuery): Promise<MemoryResult[]>;
    update(id: string, updates: Partial<MemoryEvent>): Promise<MemoryRef | null>;
    delete(id: string): Promise<boolean>;
    getSize(): Promise<number>;
    connect?(): Promise<void>;
    disconnect?(): Promise<void>;
}
export declare class FileStorageProvider implements IStorageProvider {
    private storeMap;
    private filePath;
    constructor(filePath?: string);
    private loadFromFile;
    private saveToFile;
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
