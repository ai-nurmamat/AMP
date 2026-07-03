import * as fs from 'fs';

/**
 * 审计日志条目（Feature C）。
 *
 * 记录每一次 store / retrieve / update / delete 的关键元数据，
 * 以便事后追踪“谁在什么时候访问/修改了哪条记忆”，满足可追溯性诉求。
 */
export interface AuditEntry {
  timestamp: number;
  action: 'store' | 'retrieve' | 'update' | 'delete';
  memoryId?: string;
  userId?: string;
  agentId?: string;
  details?: string;
}

/**
 * 审计日志记录器。
 *
 * 设计原则：
 *  - 永不抛错——审计失败绝不能拖垮主数据路径。
 *  - 追加写入——保证历史不可篡改，便于合规审计。
 *  - 显式启用——仅当传入 auditLogPath 时才启用，避免无谓 IO。
 */
export class AuditLogger {
  private logPath: string | null;
  private enabled: boolean;

  constructor(logPath: string | null = null) {
    this.logPath = logPath;
    this.enabled = logPath !== null;
  }

  /**
   * 追加一条审计记录。失败时静默吞掉异常，绝不影响业务流程。
   * 每条记录以单行 JSON 写入，便于后续按行流式解析。
   */
  log(entry: AuditEntry): void {
    if (!this.enabled || !this.logPath) return;
    const line = JSON.stringify(entry) + '\n';
    try {
      fs.appendFileSync(this.logPath, line);
    } catch {
      // 故意吞掉：审计失败不应导致数据写入路径崩溃
    }
  }

  /** 是否处于启用状态（便于上层判断是否需要采集 userId/agentId 等上下文）。 */
  isEnabled(): boolean {
    return this.enabled;
  }
}
