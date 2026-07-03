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
/**
 * FileStorageProvider 构造选项。
 *
 * 注意：encryptionKey 仅提供“本地静态文件”的 at-rest 加密（AES-256-GCM），
 * 并非传输层加密。如需传输加密，请通过 TLS/HTTPS 在更上层处理。
 */
export interface FileStorageProviderOptions {
    filePath?: string;
    encryptionKey?: string;
}
/**
 * 基于本地文件（JSON）的存储 Provider。
 *
 * 可选的端到端加密（Feature D）：当传入合法的 32 字节 encryptionKey 时，
 * 文件内容会以 AES-256-GCM 加密后再落盘，每次写入随机生成 IV，密文格式为
 * `base64(iv) : base64(authTag) : base64(ciphertext)`。
 * 未传入 encryptionKey 时，行为完全保持向后兼容（明文 JSON）。
 */
export declare class FileStorageProvider implements IStorageProvider {
    private storeMap;
    private filePath;
    private encryptionKey;
    constructor(options?: FileStorageProviderOptions | string);
    /**
     * 将用户传入的 hex 或 base64 字符串解析为 32 字节对称密钥。
     * 若长度不对则抛出异常，避免静默使用弱密钥。
     */
    private deriveKey;
    /**
     * Fix 11: 加载时进行最小形态校验。缺失必填字段的条目会被跳过并告警，
     * 避免后续读取时出现 undefined 访问导致 retrieve/store 崩溃。
     */
    private loadFromFile;
    private saveToFile;
    /**
     * AES-256-GCM 加密：返回 `iv:authTag:ciphertext`（均为 base64）。
     * 每次写入随机生成 12 字节 IV，authTag 由 GCM 模式自动产生。
     */
    private encrypt;
    /**
     * AES-256-GCM 解密：解析 `iv:authTag:ciphertext` 并校验 authTag。
     * 若 authTag 校验失败会抛错（说明密钥错误或数据被篡改），由调用方捕获。
     */
    private decrypt;
    /**
     * Feature A: 艾宾浩斯遗忘曲线 / 动态重要性。
     * 重要性每 30 天减半，访问频次提供最多 +0.3 的增益，最终夹紧到 [0, 1]。
     */
    private computeDecayedImportance;
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
    /**
     * Fix 9: 真实的 ft.create 失败（非“索引已存在”）现在会让 connect() reject，
     * 以便 AMPCore 的降级逻辑触发，回退到 FileStorageProvider。
     */
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    /**
     * Feature A: 艾宾浩斯遗忘曲线 / 动态重要性（与 FileStorageProvider 实现一致）。
     */
    private computeDecayedImportance;
    store(event: MemoryEvent): Promise<MemoryRef>;
    retrieve(query: MemoryQuery): Promise<MemoryResult[]>;
    update(id: string, updates: Partial<MemoryEvent>): Promise<MemoryRef | null>;
    delete(id: string): Promise<boolean>;
    /**
     * Fix 8: 用 SCAN 循环替换 KEYS，避免在大规模 key 空间下阻塞 Redis。
     * redis v5: client.scan(cursor, {MATCH, COUNT}) -> {cursor, keys}
     */
    getSize(): Promise<number>;
}
